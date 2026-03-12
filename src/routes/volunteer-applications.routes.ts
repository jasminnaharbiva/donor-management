import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { db } from '../config/database';
import { authenticate, requireRoles } from '../middleware/auth.middleware';
import { writeAuditLog } from '../services/audit.service';

export const volunteerApplicationsRouter = Router();

type SchemaField = {
  name: string;
  label?: string;
  type?: string;
  required?: boolean;
};

const DEFAULT_VOLUNTEER_FORM_SCHEMA: SchemaField[] = [
  { name: 'full_name', label: 'Name', type: 'text', required: true },
  { name: 'father_name', label: "Father's Name", type: 'text', required: true },
  { name: 'date_of_birth', label: 'Date of Birth', type: 'date', required: true },
  { name: 'blood_group', label: 'Blood Group', type: 'select', required: true },
  { name: 'education_level', label: 'Education Level', type: 'select', required: true },
  { name: 'mobile_number', label: 'Mobile Number', type: 'tel', required: true },
  { name: 'email', label: 'Email', type: 'email', required: true },
  { name: 'nid_or_birth_certificate_no', label: 'NID/Birth Certificate Number', type: 'text', required: true },
  { name: 'division', label: 'Division', type: 'bd_division', required: true },
  { name: 'district', label: 'District', type: 'bd_district', required: true },
  { name: 'upazila', label: 'Upazila', type: 'bd_upazila', required: true },
  { name: 'full_address', label: 'Full Address', type: 'textarea', required: true },
  { name: 'passport_photo_url', label: 'Passport Size Photo', type: 'file', required: true },
  { name: 'identity_document_url', label: 'NID/Birth Certificate', type: 'file', required: true },
  { name: 'consent', label: 'Consent', type: 'consent', required: true },
];

function isEmptyValue(val: unknown): boolean {
  if (val === undefined || val === null) return true;
  if (typeof val === 'boolean') return false;
  if (typeof val === 'number') return false;
  if (typeof val === 'string') return val.trim().length === 0;
  if (Array.isArray(val)) return val.length === 0;
  if (typeof val === 'object') return Object.keys(val as Record<string, unknown>).length === 0;
  return false;
}

async function getVolunteerConsentText(): Promise<string> {
  const specific = await db('dfb_system_settings')
    .where({ setting_key: 'legal.volunteer_application_consent_text' })
    .first('setting_value');
  if (specific?.setting_value) return String(specific.setting_value);

  const fallback = await db('dfb_system_settings')
    .where({ setting_key: 'legal.gdpr_consent_text' })
    .first('setting_value');
  return String(fallback?.setting_value || 'I consent to data processing for volunteer application and verification.');
}

async function getActiveVolunteerSchema(): Promise<SchemaField[]> {
  const row = await db('dfb_form_schemas')
    .where({ form_type: 'volunteer_application', is_active: 1 })
    .orderBy('updated_at', 'desc')
    .first('schema_json');

  if (!row?.schema_json) return DEFAULT_VOLUNTEER_FORM_SCHEMA;

  let parsed: unknown = row.schema_json;
  if (typeof parsed === 'string') {
    try { parsed = JSON.parse(parsed); } catch { return DEFAULT_VOLUNTEER_FORM_SCHEMA; }
  }

  if (!Array.isArray(parsed)) return DEFAULT_VOLUNTEER_FORM_SCHEMA;
  return parsed as SchemaField[];
}

// GET /api/v1/volunteer-applications
volunteerApplicationsRouter.get('/', authenticate, requireRoles('Super Admin', 'Admin'), async (req: Request, res: Response): Promise<void> => {
  const page   = Number(req.query.page  || 1);
  const limit  = Number(req.query.limit || 20);
  const offset = (page - 1) * limit;
  const status = req.query.status as string | undefined;

  let qb = db('dfb_volunteer_applications');
  if (status) qb = qb.where({ status });

  const [{ total }] = await qb.clone().count('application_id as total');
  const apps = await qb.orderBy('submitted_at', 'desc').limit(limit).offset(offset)
    .select(
      'application_id', 'applicant_name', 'applicant_email',
      'mobile_number', 'division', 'district', 'upazila',
      'city', 'country', 'status', 'review_notes',
      'submitted_at', 'reviewed_at', 'motivation_statement', 'skills', 'availability',
      'education_level', 'blood_group'
    );

  res.json({ success: true, data: apps, meta: { page, limit, total: Number(total) } });
});

// GET /api/v1/volunteer-applications/:id
volunteerApplicationsRouter.get('/:id', authenticate, requireRoles('Super Admin', 'Admin'), param('id').isInt().toInt(), async (req: Request, res: Response): Promise<void> => {
  const app = await db('dfb_volunteer_applications').where({ application_id: req.params.id as any }).first();
  if (!app) { res.status(404).json({ success: false, message: 'Application not found' }); return; }
  res.json({ success: true, data: app });
});

// POST /api/v1/volunteer-applications — Public endpoint (no auth)
volunteerApplicationsRouter.post('/',
  [
    body('fields').optional().isObject(),
  ],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(422).json({ success: false, errors: errors.array() }); return; }

    const legacyPayload = {
      full_name: req.body.applicantName,
      email: req.body.applicantEmail,
      mobile_number: req.body.phone,
      motivation_statement: req.body.motivationStatement,
      skills: req.body.skills,
      availability: req.body.availability,
      district: req.body.city,
      division: req.body.division,
      upazila: req.body.upazila,
      full_address: req.body.address,
      consent: req.body.consent,
    };

    const fieldsRaw = (req.body.fields && typeof req.body.fields === 'object') ? req.body.fields : legacyPayload;
    const fields: Record<string, unknown> = { ...fieldsRaw };

    const schema = await getActiveVolunteerSchema();
    const required = schema.filter((f) => Boolean(f.required));
    const missing = required.filter((f) => isEmptyValue(fields[f.name]));
    if (missing.length > 0) {
      res.status(422).json({
        success: false,
        message: `Missing required fields: ${missing.map((m) => m.label || m.name).join(', ')}`,
      });
      return;
    }

    if (!fields.email || typeof fields.email !== 'string' || !String(fields.email).includes('@')) {
      res.status(422).json({ success: false, message: 'Valid email is required.' });
      return;
    }

    const consentGiven = fields.consent === true || String(fields.consent).toLowerCase() === 'true';
    if (!consentGiven) {
      res.status(422).json({ success: false, message: 'Consent is required before submission.' });
      return;
    }

    const consentText = await getVolunteerConsentText();

    const applicantName = String(fields.full_name || fields.applicant_name || '').trim();
    const applicantEmail = String(fields.email || fields.applicant_email || '').trim().toLowerCase();
    const district = String(fields.district || fields.city || '').trim();
    const division = String(fields.division || '').trim();
    const upazila = String(fields.upazila || '').trim();
    const fullAddress = String(fields.full_address || fields.address || '').trim();
    const mobileNumber = String(fields.mobile_number || fields.phone || '').trim();
    const nidOrBirthNo = String(fields.nid_or_birth_certificate_no || '').trim();

    const documentUrls = {
      passport_photo_url: fields.passport_photo_url || null,
      identity_document_url: fields.identity_document_url || null,
    };

    const [id] = await db('dfb_volunteer_applications').insert({
      applicant_name: applicantName,
      applicant_email: applicantEmail,
      phone: mobileNumber || null,
      mobile_number: mobileNumber || null,
      national_id_hash: nidOrBirthNo || null,
      nid_or_birth_certificate_no: nidOrBirthNo || null,
      father_name: String(fields.father_name || '').trim() || null,
      date_of_birth: fields.date_of_birth || null,
      blood_group: String(fields.blood_group || '').trim() || null,
      education_level: String(fields.education_level || '').trim() || null,
      address: fullAddress || null,
      full_address: fullAddress || null,
      city: district || null,
      country: 'Bangladesh',
      division: division || null,
      district: district || null,
      upazila: upazila || null,
      passport_photo_url: String(fields.passport_photo_url || '') || null,
      identity_document_url: String(fields.identity_document_url || '') || null,
      motivation_statement: String(fields.motivation_statement || '').trim() || null,
      skills: fields.skills ? JSON.stringify(fields.skills) : null,
      availability: fields.availability ? JSON.stringify(fields.availability) : null,
      reference_name: String(fields.reference_name || req.body.referenceName || '').trim() || null,
      document_urls: JSON.stringify(documentUrls),
      consent_given: true,
      consent_text: consentText,
      consent_given_at: new Date(),
      form_payload: JSON.stringify(fields),
      status: 'pending',
      submitted_at: new Date(),
      updated_at: new Date(),
    });

    res.status(201).json({ success: true, data: { application_id: id }, message: 'Application submitted successfully.' });
  }
);

// PATCH /api/v1/volunteer-applications/:id/review — Approve / reject / put on waitlist
volunteerApplicationsRouter.patch('/:id/review',
  authenticate, requireRoles('Super Admin', 'Admin'),
  param('id').isInt().toInt(),
  [
    body('status').isIn(['under_review','approved','rejected','waitlisted']),
    body('reviewNotes').optional().isString(),
  ],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(422).json({ success: false, errors: errors.array() }); return; }

    const { status, reviewNotes } = req.body;
    const appId = req.params.id as any;

    await db('dfb_volunteer_applications').where({ application_id: appId }).update({
      status,
      review_notes: reviewNotes || null,
      reviewed_by:  req.user!.userId,
      reviewed_at:  new Date(),
      updated_at:   new Date(),
    });

    // If approved, automatically create a volunteer record
    if (status === 'approved') {
      const app = await db('dfb_volunteer_applications').where({ application_id: appId }).first();
      const existing = await db('dfb_volunteers').where({ email: app.applicant_email }).first();
      if (!existing) {
        await db('dfb_volunteers').insert({
          first_name:   app.applicant_name.split(' ')[0] || app.applicant_name,
          last_name:    app.applicant_name.split(' ').slice(1).join(' ') || '',
          email:        app.applicant_email,
          phone:        app.mobile_number || app.phone || null,
          address:      app.full_address || app.address || null,
          city:         app.district || app.city || null,
          country:      app.country || null,
          profile_photo_url: app.passport_photo_url || null,
          id_document_url: app.identity_document_url || null,
          skills:       app.skills || null,
          status:       'active',
          created_at:   new Date(),
          updated_at:   new Date(),
        });
      }
    }

    await writeAuditLog({ tableAffected: 'dfb_volunteer_applications', recordId: String(appId), actionType: 'UPDATE', newPayload: { status, reviewNotes }, actorId: req.user!.userId });
    res.json({ success: true, message: `Application ${status}` });
  }
);
