import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { authenticate, requireRoles } from '../middleware/auth.middleware';
import { db } from '../config/database';

export const formSchemasRouter = Router();

const VALID_FORM_TYPES = ['donation', 'registration', 'expense', 'campaign', 'beneficiary_intake', 'volunteer_application', 'beneficiary_application'] as const;

const DEFAULT_VOLUNTEER_SCHEMA = [
  { name: 'full_name', label: 'Name', type: 'text', required: true, placeholder: 'Enter your full name' },
  { name: 'father_name', label: "Father's Name", type: 'text', required: true, placeholder: "Enter your father's name" },
  { name: 'date_of_birth', label: 'Date of Birth', type: 'date', required: true },
  { name: 'blood_group', label: 'Blood Group', type: 'select', required: true, options: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'] },
  { name: 'education_level', label: 'Education Level', type: 'select', required: true, options: ['Primary', 'Secondary', 'SSC', 'HSC', 'Diploma', 'Graduate', 'Post Graduate', 'Other'] },
  { name: 'mobile_number', label: 'Mobile Number', type: 'tel', required: true, placeholder: '01XXXXXXXXX' },
  { name: 'email', label: 'Email', type: 'email', required: true, placeholder: 'you@example.com' },
  { name: 'nid_or_birth_certificate_no', label: 'NID/Birth Certificate Number', type: 'text', required: true, placeholder: 'NID or Birth Certificate Number' },
  { name: 'division', label: 'Division', type: 'bd_division', required: true },
  { name: 'district', label: 'District', type: 'bd_district', required: true },
  { name: 'upazila', label: 'Upazila', type: 'bd_upazila', required: true },
  { name: 'full_address', label: 'Full Address', type: 'textarea', required: true, placeholder: 'Village/Road, Post Office, Thana/Upazila, District' },
  { name: 'passport_photo_url', label: 'Passport Size Photo (max 500KB)', type: 'file', required: true },
  { name: 'identity_document_url', label: 'NID/Birth Certificate Copy (max 500KB)', type: 'file', required: true },
  { name: 'consent', label: 'Consent', type: 'consent', required: true },
];

const DEFAULT_BENEFICIARY_APPLICATION_SCHEMA = [
  { name: 'full_name', label: 'Full Name', type: 'text', required: true, placeholder: 'Beneficiary full name' },
  { name: 'father_name', label: "Father's Name", type: 'text', required: true },
  { name: 'mother_name', label: "Mother's Name", type: 'text', required: true },
  { name: 'date_of_birth', label: 'Date of Birth', type: 'date', required: true },
  { name: 'nid_or_birth_certificate_no', label: 'NID/Birth Certificate Number', type: 'text', required: true },
  { name: 'mobile_number', label: 'Mobile Number', type: 'tel', required: true, placeholder: '01XXXXXXXXX' },
  { name: 'division', label: 'Division', type: 'bd_division', required: true },
  { name: 'district', label: 'District', type: 'bd_district', required: true },
  { name: 'upazila', label: 'Upazila', type: 'bd_upazila', required: true },
  { name: 'village', label: 'Village', type: 'bd_village', required: true },
  { name: 'full_address', label: 'Full Address', type: 'textarea', required: true, placeholder: 'Village/Road, Post Office, Upazila, District' },
  { name: 'identity_document_url', label: 'NID/Birth Certificate Copy (max 500KB)', type: 'file', required: true, maxSizeKb: 500, uploadKind: 'identity' },
  { name: 'passport_photo_url', label: 'Passport Size Photo (max 500KB)', type: 'file', required: true, maxSizeKb: 500, uploadKind: 'passport' },
  { name: 'nationality_certificate_url', label: 'Nationality Certificate (optional)', type: 'file', required: false, maxSizeKb: 500, uploadKind: 'nationality' },
  {
    name: 'project_type',
    label: 'Project Category',
    type: 'select',
    required: true,
    options: ['water', 'health', 'education', 'food', 'shelter', 'cash_support', 'other'],
  },
  { name: 'project_amount_taka', label: 'Application Amount (BDT)', type: 'number', required: true, min: 0 },
  { name: 'case_description', label: 'Full Case Description', type: 'textarea', required: true },
  { name: 'additional_document_url', label: 'Additional Document (max 5MB)', type: 'file', required: false, maxSizeKb: 5120, uploadKind: 'additional' },
];

// GET /api/v1/form-schemas — list all
formSchemasRouter.get(
  '/',
  authenticate,
  requireRoles('Super Admin', 'Admin'),
  async (req: Request, res: Response) => {
    try {
      const rows = await db('dfb_form_schemas')
        .select('schema_id', 'form_type', 'is_active', 'created_by', 'updated_at')
        .orderBy('form_type');
      res.json(rows);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

// GET /api/v1/form-schemas/:id — get single with full schema_json
formSchemasRouter.get(
  '/:id',
  authenticate,
  requireRoles('Super Admin', 'Admin'),
  param('id').isInt({ min: 1 }),
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const schema = await db('dfb_form_schemas').where('schema_id', req.params.id).first();
      if (!schema) return res.status(404).json({ error: 'Form schema not found' });

      // Parse schema_json
      if (schema.schema_json) {
        try { schema.schema_json = JSON.parse(schema.schema_json); } catch {}
      }
      res.json(schema);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

// GET /api/v1/form-schemas/type/:formType — get active schema for a form type (public use)
formSchemasRouter.get(
  '/type/:formType',
  async (req: Request, res: Response) => {
    try {
      if (!VALID_FORM_TYPES.includes(req.params.formType as any)) {
        return res.status(400).json({ error: 'Invalid form type' });
      }

      const schema = await db('dfb_form_schemas')
        .where('form_type', req.params.formType)
        .where('is_active', 1)
        .orderBy('updated_at', 'desc')
        .first();

      if (!schema) {
        if (req.params.formType === 'volunteer_application') {
          return res.json({
            schema_id: 0,
            form_type: 'volunteer_application',
            is_active: true,
            created_by: null,
            updated_at: new Date().toISOString(),
            schema_json: DEFAULT_VOLUNTEER_SCHEMA,
          });
        }
        if (req.params.formType === 'beneficiary_application') {
          return res.json({
            schema_id: 0,
            form_type: 'beneficiary_application',
            is_active: true,
            created_by: null,
            updated_at: new Date().toISOString(),
            schema_json: DEFAULT_BENEFICIARY_APPLICATION_SCHEMA,
          });
        }
        return res.status(404).json({ error: 'No active schema for this form type' });
      }

      if (schema.schema_json) {
        try { schema.schema_json = JSON.parse(schema.schema_json); } catch {}
      }
      res.json(schema);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

// POST /api/v1/form-schemas — create new schema
formSchemasRouter.post(
  '/',
  authenticate,
  requireRoles('Super Admin', 'Admin'),
  [
    body('form_type').isIn(VALID_FORM_TYPES),
    body('schema_json').isString().notEmpty(),
    body('is_active').optional().isBoolean(),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const { form_type, schema_json, is_active } = req.body;

      // Validate schema_json is valid JSON
      try { JSON.parse(schema_json); } catch { return res.status(400).json({ error: 'schema_json must be valid JSON' }); }

      const createdBy = req.user!.userId;

      // If making active, deactivate others of same type
      if (is_active) {
        await db('dfb_form_schemas').where('form_type', form_type).update({ is_active: 0 });
      }

      const [id] = await db('dfb_form_schemas').insert({
        form_type,
        schema_json,
        is_active: is_active ? 1 : 0,
        created_by: createdBy,
      });

      const created = await db('dfb_form_schemas').where('schema_id', id).first();
      if (created.schema_json) {
        try { created.schema_json = JSON.parse(created.schema_json); } catch {}
      }
      res.status(201).json(created);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

// PUT /api/v1/form-schemas/:id — update schema
formSchemasRouter.put(
  '/:id',
  authenticate,
  requireRoles('Super Admin', 'Admin'),
  [
    param('id').isInt({ min: 1 }),
    body('schema_json').optional().isString(),
    body('is_active').optional().isBoolean(),
  ],
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const { id } = req.params;
      const existing = await db('dfb_form_schemas').where('schema_id', id).first();
      if (!existing) return res.status(404).json({ error: 'Form schema not found' });

      const updates: Record<string, any> = {};

      if (req.body.schema_json !== undefined) {
        try { JSON.parse(req.body.schema_json); } catch { return res.status(400).json({ error: 'schema_json must be valid JSON' }); }
        updates.schema_json = req.body.schema_json;
      }

      if (req.body.is_active !== undefined) {
        // If activating, deactivate siblings
        if (req.body.is_active) {
          await db('dfb_form_schemas').where('form_type', existing.form_type).whereNot('schema_id', id).update({ is_active: 0 });
        }
        updates.is_active = req.body.is_active ? 1 : 0;
      }

      if (Object.keys(updates).length > 0) {
        await db('dfb_form_schemas').where('schema_id', id).update(updates);
      }

      const updated = await db('dfb_form_schemas').where('schema_id', id).first();
      if (updated.schema_json) {
        try { updated.schema_json = JSON.parse(updated.schema_json); } catch {}
      }
      res.json(updated);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);

// DELETE /api/v1/form-schemas/:id
formSchemasRouter.delete(
  '/:id',
  authenticate,
  requireRoles('Super Admin', 'Admin'),
  param('id').isInt({ min: 1 }),
  async (req: Request, res: Response) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    try {
      const existing = await db('dfb_form_schemas').where('schema_id', req.params.id).first();
      if (!existing) return res.status(404).json({ error: 'Form schema not found' });

      await db('dfb_form_schemas').where('schema_id', req.params.id).delete();
      res.json({ message: 'Form schema deleted' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  }
);
