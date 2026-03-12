import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { db } from '../config/database';
import { authenticate, requireRoles } from '../middleware/auth.middleware';
import { invalidatePermissionCache, broadcastConfigChange } from '../services/admin.service';
import { writeAuditLog } from '../services/audit.service';
import { decrypt } from '../utils/crypto';

export const adminRouter = Router();

// Apply global admin authentication
adminRouter.use(authenticate, requireRoles('Super Admin', 'Admin'));

// ---------------------------------------------------------------------------
// 0. Seed extended UI settings (INSERT IGNORE — safe to run on every boot)
// ---------------------------------------------------------------------------
async function ensureUiSettings() {
  const newSettings = [
    { key: 'ui.btn_primary_bg',       value: '#0284c7', type: 'color',  desc: 'Primary button background color' },
    { key: 'ui.btn_primary_text',     value: '#ffffff', type: 'color',  desc: 'Primary button text color' },
    { key: 'ui.btn_primary_hover_bg', value: '#0369a1', type: 'color',  desc: 'Primary button hover background' },
    { key: 'ui.btn_secondary_bg',     value: '#f1f5f9', type: 'color',  desc: 'Secondary button background' },
    { key: 'ui.btn_secondary_text',   value: '#334155', type: 'color',  desc: 'Secondary button text color' },
    { key: 'ui.btn_border_radius',    value: '8px',     type: 'string', desc: 'Button border radius (e.g. 8px, 9999px for pill)' },
    { key: 'ui.btn_font_weight',      value: '600',     type: 'string', desc: 'Button font weight (400/500/600/700/800)' },
    { key: 'ui.btn_alignment',        value: 'center',  type: 'string', desc: 'Button content alignment (left/center/right)' },
    { key: 'ui.h1_size',              value: '2rem',    type: 'string', desc: 'H1 font size (e.g. 2rem, 32px)' },
    { key: 'ui.h1_weight',            value: '700',     type: 'string', desc: 'H1 font weight' },
    { key: 'ui.h1_color',             value: '#0f172a', type: 'color',  desc: 'H1 text color' },
    { key: 'ui.h2_size',              value: '1.5rem',  type: 'string', desc: 'H2 font size' },
    { key: 'ui.h2_weight',            value: '700',     type: 'string', desc: 'H2 font weight' },
    { key: 'ui.h2_color',             value: '#1e293b', type: 'color',  desc: 'H2 text color' },
    { key: 'ui.h3_size',              value: '1.25rem', type: 'string', desc: 'H3 font size' },
    { key: 'ui.h3_weight',            value: '600',     type: 'string', desc: 'H3 font weight' },
    { key: 'ui.h3_color',             value: '#334155', type: 'color',  desc: 'H3 text color' },
    { key: 'ui.h4_size',              value: '1rem',    type: 'string', desc: 'H4 font size' },
    { key: 'ui.h4_weight',            value: '600',     type: 'string', desc: 'H4 font weight' },
    { key: 'ui.h4_color',             value: '#475569', type: 'color',  desc: 'H4 text color' },
    { key: 'ui.heading_alignment',    value: 'left',    type: 'string', desc: 'Heading text alignment (left/center/right)' },
    { key: 'ui.body_font_size',       value: '1rem',    type: 'string', desc: 'Base body font size' },
    { key: 'ui.font_family_heading',  value: "'Inter', sans-serif", type: 'string', desc: 'Heading font family' },
    { key: 'ui.card_border_radius',   value: '12px',    type: 'string', desc: 'Card/panel border radius' },
    { key: 'ui.sidebar_bg',           value: '#ffffff', type: 'color',  desc: 'Sidebar background color' },
    { key: 'ui.sidebar_text',         value: '#334155', type: 'color',  desc: 'Sidebar text color' },
    { key: 'ui.sidebar_active_bg',    value: '#eff6ff', type: 'color',  desc: 'Sidebar active item background' },
    { key: 'ui.sidebar_active_text',  value: '#0284c7', type: 'color',  desc: 'Sidebar active item text color' },
    { key: 'ui.table_header_bg',      value: '#f8fafc', type: 'color',  desc: 'Table header background color' },
    { key: 'ui.table_row_hover_bg',   value: '#f0f9ff', type: 'color',  desc: 'Table row hover background' },
    { key: 'ui.input_border_color',   value: '#cbd5e1', type: 'color',  desc: 'Form input border color' },
    { key: 'ui.input_focus_color',    value: '#0284c7', type: 'color',  desc: 'Form input focus ring color' },
    { key: 'ui.shadow_intensity',     value: 'md',      type: 'string', desc: 'Shadow intensity (none/sm/md/lg/xl)' },
  ];

  for (const s of newSettings) {
    const exists = await db('dfb_system_settings').where({ setting_key: s.key }).first();
    if (!exists) {
      await db('dfb_system_settings').insert({
        setting_key:   s.key,
        setting_value: s.value,
        value_type:    s.type,
        category:      'ui',
        is_public:     true,
        description:   s.desc,
      });
    }
  }
}
ensureUiSettings().catch(() => {});

// ---------------------------------------------------------------------------
// 1. Settings Management (dfb_system_settings)
// ---------------------------------------------------------------------------
adminRouter.get('/settings', async (req: Request, res: Response) => {
  const q = db('dfb_system_settings').select('*').orderBy('category', 'asc');
  if (req.query.category) q.where({ category: String(req.query.category) });
  const settings = await q;
  res.json({ success: true, data: settings });
});

// PUT single setting key (convenience endpoint)
adminRouter.put('/settings/:key',
  [body('value').exists()],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(422).json({ success: false, errors: errors.array() }); return; }

    const key = String(req.params.key);
    const existing = await db('dfb_system_settings').where({ setting_key: key }).first();
    if (!existing) { res.status(404).json({ success: false, message: 'Setting not found' }); return; }

    let strVal = req.body.value;
    if (typeof strVal !== 'string') strVal = String(strVal);

    await db('dfb_system_settings').where({ setting_key: key }).update({
      setting_value: strVal,
      updated_by: req.user!.userId,
      updated_at: new Date(),
    });

    broadcastConfigChange(key, 'setting');
    await writeAuditLog({ tableAffected: 'dfb_system_settings', recordId: key, actionType: 'UPDATE', newPayload: { key, value: strVal }, actorId: req.user!.userId, ipAddress: req.ip });
    res.json({ success: true, message: 'Setting updated' });
  }
);

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

// ---------------------------------------------------------------------------
// 6. User Management (dfb_users)
// ---------------------------------------------------------------------------
adminRouter.get('/users', async (_req: Request, res: Response) => {
  const users = await db('dfb_users as u')
    .leftJoin('dfb_roles as r', 'u.role_id', 'r.role_id')
    .select(
      'u.user_id',
      'u.email',
      'u.status',
      'u.last_login_at',
      'u.created_at',
      'r.role_name'
    )
    .orderBy('u.created_at', 'desc');

  // Decrypt emails
  users.forEach((user: any) => {
    try { user.email = decrypt(user.email); } catch { user.email = '[encrypted]'; }
  });

  res.json({ success: true, data: users });
});

// Update User Status or Role
adminRouter.put('/users/:id',
  param('id').isUUID(),
  body('status').optional().isIn(['active', 'pending', 'suspended']),
  body('role_id').optional().isInt(),
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(422).json({ success: false, errors: errors.array() }); return; }

    const userId = req.params.id as string;
    const { status, role_id } = req.body;

    const updateData: any = { updated_at: new Date() };
    if (status) updateData.status = status;
    if (role_id) updateData.role_id = role_id;

    const updated = await db('dfb_users')
      .where({ user_id: userId })
      .update(updateData);

    if (!updated) { res.status(404).json({ success: false, message: 'User not found' }); return; }

    await writeAuditLog({
      tableAffected: 'dfb_users',
      recordId: userId,
      actionType: 'UPDATE',
      newPayload: updateData,
      actorId: req.user!.userId,
      ipAddress: req.ip
    });

    res.json({ success: true, message: 'User updated successfully' });
});

// ---------------------------------------------------------------------------
// 7. Audit Logs (dfb_audit_logs)
// ---------------------------------------------------------------------------
adminRouter.get('/audit', async (_req: Request, res: Response) => {
  const logs = await db('dfb_audit_logs as a')
    .leftJoin('dfb_users as u', 'a.actor_id', 'u.user_id')
    .select(
      'a.log_id',
      'a.table_affected',
      'a.record_id',
      'a.action_type',
      'a.old_payload',
      'a.new_payload',
      'a.actor_id',
      'u.email as actor_email',
      'a.actor_role',
      'a.ip_address',
      'a.timestamp'
    )
    .orderBy('a.timestamp', 'desc')
    .limit(500);

  // Decrypt actor emails if available
  logs.forEach((log: any) => {
    if (log.actor_email) {
      try { log.actor_email = decrypt(log.actor_email); } catch { log.actor_email = '[encrypted]'; }
    }
  });

  res.json({ success: true, data: logs });
});
