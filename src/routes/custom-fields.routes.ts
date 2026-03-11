import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { db } from '../config/database';
import { authenticate, requireRoles } from '../middleware/auth.middleware';
import { writeAuditLog } from '../services/audit.service';

export const customFieldsRouter = Router();

// GET /api/v1/custom-fields?entityType=donor
customFieldsRouter.get('/', authenticate, async (req: Request, res: Response): Promise<void> => {
  const entityType = req.query.entityType as string | undefined;
  let qb = db('dfb_custom_fields').orderBy('display_order');
  if (entityType) qb = qb.where({ entity_type: entityType });
  const fields = await qb;
  res.json({ success: true, data: fields });
});

// POST /api/v1/custom-fields
customFieldsRouter.post('/',
  authenticate, requireRoles('Super Admin', 'Admin'),
  [
    body('entityType').isIn(['donor','expense','campaign','volunteer','beneficiary']),
    body('fieldName').trim().notEmpty().matches(/^[a-z0-9_]+$/).isLength({ max: 60 }),
    body('fieldLabel').trim().notEmpty().isLength({ max: 120 }),
    body('fieldType').isIn(['text','textarea','number','date','boolean','select','multi_select','file','phone','url']),
    body('isRequired').optional().isBoolean().toBoolean(),
    body('displayOrder').optional().isInt({ min: 0 }).toInt(),
    body('validationRegex').optional().isString().isLength({ max: 255 }),
    body('options').optional().isArray(),
  ],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(422).json({ success: false, errors: errors.array() }); return; }

    const { entityType, fieldName, fieldLabel, fieldType, isRequired, displayOrder, validationRegex, options, isVisibleToDonor, isVisibleToVolunteer } = req.body;

    // Check uniqueness within entity_type
    const existing = await db('dfb_custom_fields').where({ entity_type: entityType, field_name: fieldName }).first();
    if (existing) { res.status(409).json({ success: false, message: 'Field name already exists for this entity' }); return; }

    const [id] = await db('dfb_custom_fields').insert({
      entity_type:            entityType,
      field_name:             fieldName,
      field_label:            fieldLabel,
      field_type:             fieldType,
      is_required:            isRequired ? 1 : 0,
      display_order:          displayOrder || 0,
      validation_regex:       validationRegex || null,
      options:                options ? JSON.stringify(options) : null,
      is_visible_to_donor:    isVisibleToDonor ? 1 : 0,
      is_visible_to_volunteer:isVisibleToVolunteer ? 1 : 0,
      created_by:             req.user!.userId,
      created_at:             new Date(),
    });

    await writeAuditLog({ tableAffected: 'dfb_custom_fields', recordId: String(id), actionType: 'INSERT', newPayload: { entityType, fieldName }, actorId: req.user!.userId });
    res.status(201).json({ success: true, data: { field_id: id } });
  }
);

// PATCH /api/v1/custom-fields/:id
customFieldsRouter.patch('/:id',
  authenticate, requireRoles('Super Admin', 'Admin'),
  param('id').isInt().toInt(),
  async (req: Request, res: Response): Promise<void> => {
    const allowed = ['field_label','is_required','display_order','validation_regex','options','is_visible_to_donor','is_visible_to_volunteer'];
    const updates: Record<string, unknown> = {};
    for (const key of allowed) {
      const camel = key.replace(/_([a-z])/g, (_,c) => c.toUpperCase());
      if (req.body[camel] !== undefined) updates[key] = req.body[camel];
      if (req.body[key]   !== undefined) updates[key] = req.body[key];
    }
    if (updates.options && Array.isArray(updates.options)) updates.options = JSON.stringify(updates.options);

    await db('dfb_custom_fields').where({ field_id: req.params.id as any }).update(updates);
    res.json({ success: true, message: 'Custom field updated' });
  }
);

// DELETE /api/v1/custom-fields/:id
customFieldsRouter.delete('/:id', authenticate, requireRoles('Super Admin'), param('id').isInt().toInt(), async (req: Request, res: Response): Promise<void> => {
  // Delete all values for this field first
  await db('dfb_custom_field_values').where({ field_id: req.params.id as any }).delete();
  await db('dfb_custom_fields').where({ field_id: req.params.id as any }).delete();
  await writeAuditLog({ tableAffected: 'dfb_custom_fields', recordId: String(req.params.id), actionType: 'DELETE', actorId: req.user!.userId });
  res.json({ success: true, message: 'Custom field deleted' });
});
