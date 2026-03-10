import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { db } from '../config/database';
import { authenticate, requireRoles } from '../middleware/auth.middleware';
import { invalidatePermissionCache, broadcastConfigChange } from '../services/admin.service';
import { writeAuditLog } from '../services/audit.service';

export const adminRouter = Router();

// Apply global admin authentication
adminRouter.use(authenticate, requireRoles('Super Admin', 'Admin'));

// ---------------------------------------------------------------------------
// 1. Settings Management (dfb_system_settings)
// ---------------------------------------------------------------------------
adminRouter.get('/settings', async (_req: Request, res: Response) => {
  const settings = await db('dfb_system_settings').select('*').orderBy('category', 'asc');
  res.json({ success: true, data: settings });
});

adminRouter.put('/settings', 
  [
    body('updates').isArray({ min: 1 }),
    body('updates.*.key').isString().notEmpty(),
    body('updates.*.value').exists()
  ], 
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(422).json({ success: false, errors: errors.array() }); return; }

    const updates: Array<{ key: string, value: string }> = req.body.updates;
    
    await db.transaction(async (trx) => {
      for (const update of updates) {
        // We ensure we only update the value field based on setting_key
        const existing = await trx('dfb_system_settings').where({ setting_key: update.key }).first();
        if (existing) {
          let strVal = update.value;
          if (existing.value_type === 'json' && typeof update.value !== 'string') {
             strVal = JSON.stringify(update.value);
          } else if (typeof update.value !== 'string') {
             strVal = String(update.value);
          }

          await trx('dfb_system_settings')
            .where({ setting_key: update.key })
            .update({ setting_value: strVal, updated_by: req.user!.userId, updated_at: new Date() });
            
          broadcastConfigChange(update.key, 'setting');
        }
      }
    });

    await writeAuditLog({
      tableAffected: 'dfb_system_settings',
      recordId: 'BULK',
      actionType: 'UPDATE',
      newPayload: { updatesCount: updates.length },
      actorId: req.user!.userId,
      ipAddress: req.ip
    });

    res.json({ success: true, message: 'Settings updated successfully' });
});

// ---------------------------------------------------------------------------
// 2. Feature Toggles (dfb_feature_flags)
// ---------------------------------------------------------------------------
adminRouter.get('/features', async (_req: Request, res: Response) => {
  const flags = await db('dfb_feature_flags').select('*').orderBy('flag_name', 'asc');
  res.json({ success: true, data: flags });
});

adminRouter.patch('/features/:id/toggle', 
  param('id').isInt().toInt(),
  body('isEnabled').isBoolean(),
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(422).json({ success: false, errors: errors.array() }); return; }

    const flagId = req.params.id as any;
    const isEnabled = req.body.isEnabled;

    const flag = await db('dfb_feature_flags').where({ flag_id: flagId }).first();
    if (!flag) { res.status(404).json({ success: false, message: 'Feature flag not found' }); return; }

    await db('dfb_feature_flags')
      .where({ flag_id: flagId })
      .update({ is_enabled: isEnabled, updated_by: req.user!.userId, updated_at: new Date() });

    broadcastConfigChange(flag.flag_name, 'feature');

    await writeAuditLog({
      tableAffected: 'dfb_feature_flags',
      recordId: String(flagId),
      actionType: 'UPDATE',
      newPayload: { is_enabled: isEnabled },
      actorId: req.user!.userId,
      ipAddress: req.ip
    });

    res.json({ success: true, message: `Feature '${flag.flag_name}' is now ${isEnabled ? 'enabled' : 'disabled'}` });
});

// ---------------------------------------------------------------------------
// 3. Form Schemas (dfb_form_schemas)
// ---------------------------------------------------------------------------
adminRouter.get('/forms', async (_req: Request, res: Response) => {
  const forms = await db('dfb_form_schemas').select('*');
  res.json({ success: true, data: forms });
});

adminRouter.put('/forms/:id',
  param('id').isInt().toInt(),
  body('schemaJson').isObject(),
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(422).json({ success: false, errors: errors.array() }); return; }
    
    const schemaId = req.params.id as any;
    const schemaJson = JSON.stringify(req.body.schemaJson);

    const updated = await db('dfb_form_schemas')
      .where({ schema_id: schemaId })
      .update({ schema_json: schemaJson, created_by: req.user!.userId, updated_at: new Date() }); // Using created_by as per schema

    if (!updated) { res.status(404).json({ success: false, message: 'Form schema not found' }); return; }

    const form = await db('dfb_form_schemas').where({ schema_id: schemaId }).first('form_type');
    broadcastConfigChange(form?.form_type || 'unknown', 'form_schema');

    res.json({ success: true, message: 'Form schema updated successfully' });
});

// ---------------------------------------------------------------------------
// 4. Email Templates (dfb_email_templates)
// ---------------------------------------------------------------------------
adminRouter.get('/emails', async (_req: Request, res: Response) => {
  const emails = await db('dfb_email_templates').select('*');
  res.json({ success: true, data: emails });
});

adminRouter.put('/emails/:id',
  param('id').isInt().toInt(),
  body('subjectTemplate').isString().notEmpty(),
  body('htmlBody').isString().notEmpty(),
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(422).json({ success: false, errors: errors.array() }); return; }

    const templateId = req.params.id as any;

    const updated = await db('dfb_email_templates')
      .where({ template_id: templateId })
      .update({
        subject_template: req.body.subjectTemplate,
        html_body: req.body.htmlBody,
        updated_by: req.user!.userId,
        updated_at: new Date()
      });

    if (!updated) { res.status(404).json({ success: false, message: 'Email template not found' }); return; }

    const template = await db('dfb_email_templates').where({ template_id: templateId }).first('template_slug');
    broadcastConfigChange(template?.template_slug || 'unknown', 'email_template');

    res.json({ success: true, message: 'Email template updated successfully' });
});

// ---------------------------------------------------------------------------
// 5. Roles & Permissions (dfb_roles, dfb_permissions)
// ---------------------------------------------------------------------------
adminRouter.get('/roles', async (_req: Request, res: Response) => {
  const roles = await db('dfb_roles').select('*');
  res.json({ success: true, data: roles });
});

adminRouter.post('/roles',
  body('roleName').isString().notEmpty().isLength({ max: 60 }),
  body('description').optional().isString(),
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(422).json({ success: false, errors: errors.array() }); return; }

    const [roleId] = await db('dfb_roles').insert({
      role_name: req.body.roleName,
      description: req.body.description,
      is_system_role: false,
      created_by: req.user!.userId,
      created_at: new Date()
    });

    res.status(201).json({ success: true, message: 'Role created', roleId });
});

adminRouter.get('/roles/:id/permissions',
  param('id').isInt().toInt(),
  async (req: Request, res: Response): Promise<void> => {
    const permissions = await db('dfb_permissions').where({ role_id: req.params.id as any });
    res.json({ success: true, data: permissions });
});

adminRouter.put('/roles/:id/permissions',
  param('id').isInt().toInt(),
  body('permissions').isArray(),
  body('permissions.*.resource').isString().notEmpty(),
  body('permissions.*.action').isIn(['view', 'create', 'update', 'delete', 'approve', 'reject', 'export', 'impersonate']),
  body('permissions.*.conditions').optional().isObject(),
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(422).json({ success: false, errors: errors.array() }); return; }

    const roleId = req.params.id as any;
    const permissions = req.body.permissions;

    const role = await db('dfb_roles').where({ role_id: roleId }).first();
    if (!role) { res.status(404).json({ success: false, message: 'Role not found' }); return; }

    if (role.is_system_role && role.role_name === 'Super Admin') {
      res.status(403).json({ success: false, message: 'Cannot modify Super Admin permissions directly' });
      return;
    }

    await db.transaction(async (trx) => {
      // Clear existing permissions for this role
      await trx('dfb_permissions').where({ role_id: roleId }).delete();
      
      // Insert new permissions
      if (permissions.length > 0) {
        const toInsert = permissions.map((p: any) => ({
          role_id: roleId,
          resource: p.resource,
          action: p.action,
          conditions: p.conditions ? JSON.stringify(p.conditions) : null
        }));
        await trx('dfb_permissions').insert(toInsert);
      }
    });

    // CRITICAL: Flush redis cached permissions so changes take immediate effect
    await invalidatePermissionCache();

    await writeAuditLog({
      tableAffected: 'dfb_permissions',
      recordId: String(roleId),
      actionType: 'UPDATE',
      newPayload: { updatedPermissionsCount: permissions.length },
      actorId: req.user!.userId,
      ipAddress: req.ip
    });

    res.json({ success: true, message: 'Role permissions updated and caches flushed' });
});
