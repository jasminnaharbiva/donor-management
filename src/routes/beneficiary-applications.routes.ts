import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { createHash } from 'crypto';
import { db } from '../config/database';
import { authenticate, requireRoles } from '../middleware/auth.middleware';
import { writeAuditLog } from '../services/audit.service';
import { encrypt } from '../utils/crypto';

export const beneficiaryApplicationsRouter = Router();

type SchemaField = {
  name: string;
  label?: string;
  type?: string;
  required?: boolean;
};

const DEFAULT_BENEFICIARY_APPLICATION_SCHEMA: SchemaField[] = [
  { name: 'full_name', label: 'Full Name', type: 'text', required: true },
  { name: 'father_name', label: "Father's Name", type: 'text', required: true },
  { name: 'mother_name', label: "Mother's Name", type: 'text', required: true },
  { name: 'date_of_birth', label: 'Date of Birth', type: 'date', required: true },
  { name: 'nid_or_birth_certificate_no', label: 'NID / Birth Certificate Number', type: 'text', required: true },
  { name: 'mobile_number', label: 'Mobile Number', type: 'tel', required: true },
  { name: 'division', label: 'Division', type: 'bd_division', required: true },
  { name: 'district', label: 'District', type: 'bd_district', required: true },
  { name: 'upazila', label: 'Upazila', type: 'bd_upazila', required: true },
  { name: 'village', label: 'Village', type: 'bd_village', required: true },
  { name: 'full_address', label: 'Full Address', type: 'textarea', required: true },
  { name: 'identity_document_url', label: 'NID/Birth Certificate Copy (max 500KB)', type: 'file', required: true },
  { name: 'passport_photo_url', label: 'Passport Photo (max 500KB)', type: 'file', required: true },
  { name: 'nationality_certificate_url', label: 'Nationality Certificate (optional)', type: 'file', required: false },
  { name: 'project_type', label: 'Project Type', type: 'select', required: true },
  { name: 'project_amount_taka', label: 'Requested Amount (BDT)', type: 'number', required: true },
  { name: 'case_description', label: 'Case Description', type: 'textarea', required: true },
  { name: 'additional_document_url', label: 'Additional Document (max 5MB)', type: 'file', required: false },
];

function parseValidationErrors(req: Request, res: Response): boolean {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(422).json({ success: false, errors: errors.array() });
    return true;
  }
  return false;
}

function isEmptyValue(value: unknown): boolean {
  if (value === undefined || value === null) return true;
  if (typeof value === 'boolean' || typeof value === 'number') return false;
  if (typeof value === 'string') return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  if (typeof value === 'object') return Object.keys(value as Record<string, unknown>).length === 0;
  return false;
}

function normalizeFields(raw: unknown): Record<string, unknown> {
  if (!raw || typeof raw !== 'object') return {};
  return { ...(raw as Record<string, unknown>) };
}

function mapWelfareCategory(projectTypeRaw: unknown): 'food' | 'shelter' | 'medical' | 'education' | 'cash_aid' | 'other' {
  const value = String(projectTypeRaw || '').trim().toLowerCase();
  if (['food', 'nutrition'].includes(value)) return 'food';
  if (['shelter', 'housing'].includes(value)) return 'shelter';
  if (['health', 'medical', 'treatment'].includes(value)) return 'medical';
  if (['education', 'schooling'].includes(value)) return 'education';
  if (['cash', 'cash_aid', 'cash support', 'financial support'].includes(value)) return 'cash_aid';
  return 'other';
}

function getFirstNonEmpty(fields: Record<string, unknown>, keys: string[]): string {
  for (const key of keys) {
    const value = fields[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number') return String(value);
  }
  return '';
}

async function getActiveSchema(): Promise<SchemaField[]> {
  const row = await db('dfb_form_schemas')
    .where({ form_type: 'beneficiary_application', is_active: 1 })
    .orderBy('updated_at', 'desc')
    .first('schema_json');

  if (!row?.schema_json) return DEFAULT_BENEFICIARY_APPLICATION_SCHEMA;

  let parsed: unknown = row.schema_json;
  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch {
      return DEFAULT_BENEFICIARY_APPLICATION_SCHEMA;
    }
  }

  if (!Array.isArray(parsed)) return DEFAULT_BENEFICIARY_APPLICATION_SCHEMA;
  return parsed as SchemaField[];
}

async function getRoleName(roleId: number): Promise<string | null> {
  const role = await db('dfb_roles').where({ role_id: roleId }).first('role_name');
  return role?.role_name || null;
}

async function getVolunteerIdFromUser(userId: string): Promise<number | null> {
  const row = await db('dfb_users').where({ user_id: userId }).first('volunteer_id');
  return row?.volunteer_id ? Number(row.volunteer_id) : null;
}

async function getDonorIdFromUser(userId: string): Promise<number | null> {
  const row = await db('dfb_users').where({ user_id: userId }).first('donor_id');
  return row?.donor_id ? Number(row.donor_id) : null;
}

beneficiaryApplicationsRouter.use(authenticate);

// GET /api/v1/beneficiary-applications/my
beneficiaryApplicationsRouter.get('/my', requireRoles('Volunteer', 'Super Admin', 'Admin'), async (req: Request, res: Response): Promise<void> => {
  const volunteerId = await getVolunteerIdFromUser(req.user!.userId);
  if (!volunteerId) {
    res.status(403).json({ success: false, message: 'No volunteer profile linked to this account' });
    return;
  }

  const rows = await db('dfb_beneficiary_applications')
    .where({ volunteer_id: volunteerId })
    .orderBy('created_at', 'desc')
    .select(
      'application_id', 'full_name', 'project_type', 'project_amount_taka',
      'status', 'review_notes', 'reviewed_at', 'created_beneficiary_id', 'created_at'
    );

  res.json({ success: true, data: rows });
});

// GET /api/v1/beneficiary-applications/for-funding (donor)
beneficiaryApplicationsRouter.get('/for-funding', requireRoles('Donor', 'Super Admin', 'Admin'), async (req: Request, res: Response): Promise<void> => {
  const donorId = await getDonorIdFromUser(req.user!.userId);
  if (!donorId && req.user!.roleName !== 'Super Admin' && req.user!.roleName !== 'Admin') {
    res.status(403).json({ success: false, message: 'No donor profile linked to this account' });
    return;
  }

  let qb = db('dfb_beneficiary_applications').where({ status: 'approved' });
  if (donorId) {
    qb = qb.andWhere((builder) => {
      builder.where({ tagged_donor_id: donorId }).orWhere({ allow_interested_donors: 1 });
    });
  }

  const rows = await qb
    .orderBy('reviewed_at', 'desc')
    .select(
      'application_id', 'full_name', 'father_name', 'mother_name', 'date_of_birth',
      'mobile_number', 'division', 'district', 'upazila', 'village', 'full_address',
      'project_type', 'project_amount_taka', 'case_description', 'identity_document_url',
      'passport_photo_url', 'nationality_certificate_url', 'additional_document_url',
      'tagged_donor_id', 'allow_interested_donors', 'linked_project_id', 'fundraiser_required',
      'created_beneficiary_id', 'reviewed_at'
    );

  res.json({ success: true, data: rows });
});

// GET /api/v1/beneficiary-applications (admin list)
beneficiaryApplicationsRouter.get(
  '/',
  requireRoles('Super Admin', 'Admin'),
  [
    query('status').optional().isIn(['pending', 'under_review', 'approved', 'rejected', 'needs_changes']),
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 200 }).toInt(),
    query('search').optional().isString(),
  ],
  async (req: Request, res: Response): Promise<void> => {
    if (parseValidationErrors(req, res)) return;

    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 20);
    const offset = (page - 1) * limit;

    let qb = db('dfb_beneficiary_applications as a')
      .leftJoin('dfb_volunteers as v', 'a.volunteer_id', 'v.volunteer_id')
      .leftJoin('dfb_donors as d', 'a.tagged_donor_id', 'd.donor_id');

    if (req.query.status) qb = qb.where('a.status', String(req.query.status));
    if (req.query.search) {
      const term = `%${String(req.query.search).trim()}%`;
      qb = qb.where((builder) => {
        builder
          .where('a.full_name', 'like', term)
          .orWhere('a.project_type', 'like', term)
          .orWhere('a.district', 'like', term)
          .orWhere('a.upazila', 'like', term);
      });
    }

    const totalRow = await qb.clone().clearSelect().clearOrder().countDistinct({ total: 'a.application_id' }).first();
    const total = Number(totalRow?.total || 0);

    const rows = await qb
      .orderBy('a.created_at', 'desc')
      .limit(limit)
      .offset(offset)
      .select(
        'a.application_id', 'a.full_name', 'a.project_type', 'a.project_amount_taka',
        'a.mobile_number', 'a.division', 'a.district', 'a.upazila', 'a.village',
        'a.status', 'a.review_notes', 'a.reviewed_at', 'a.created_at', 'a.created_beneficiary_id',
        'a.assigned_volunteer_id', 'a.tagged_donor_id', 'a.allow_interested_donors',
        'a.linked_project_id', 'a.fundraiser_required',
        db.raw("CONCAT(v.first_name, ' ', v.last_name) as volunteer_name"),
        db.raw("CONCAT(d.first_name, ' ', d.last_name) as donor_name")
      );

    res.json({ success: true, data: rows, meta: { page, limit, total } });
  }
);

// GET /api/v1/beneficiary-applications/:id
beneficiaryApplicationsRouter.get('/:id', [param('id').isInt({ min: 1 }).toInt()], async (req: Request, res: Response): Promise<void> => {
  if (parseValidationErrors(req, res)) return;

  const app = await db('dfb_beneficiary_applications').where({ application_id: req.params.id as any }).first();
  if (!app) {
    res.status(404).json({ success: false, message: 'Application not found' });
    return;
  }

  const roleName = await getRoleName(req.user!.roleId);
  const isAdmin = roleName === 'Super Admin' || roleName === 'Admin';

  if (isAdmin) {
    res.json({ success: true, data: app });
    return;
  }

  if (roleName === 'Volunteer') {
    const volunteerId = await getVolunteerIdFromUser(req.user!.userId);
    if (volunteerId && Number(app.volunteer_id) === volunteerId) {
      res.json({ success: true, data: app });
      return;
    }
  }

  if (roleName === 'Donor') {
    const donorId = await getDonorIdFromUser(req.user!.userId);
    const allowedForDonor = app.status === 'approved' && (
      (donorId && Number(app.tagged_donor_id || 0) === donorId) ||
      Boolean(app.allow_interested_donors)
    );
    if (allowedForDonor) {
      res.json({ success: true, data: app });
      return;
    }
  }

  res.status(403).json({ success: false, message: 'Access denied' });
});

// POST /api/v1/beneficiary-applications (volunteer-only)
beneficiaryApplicationsRouter.post(
  '/',
  requireRoles('Volunteer', 'Super Admin', 'Admin'),
  [body('fields').isObject()],
  async (req: Request, res: Response): Promise<void> => {
    if (parseValidationErrors(req, res)) return;

    const volunteerId = await getVolunteerIdFromUser(req.user!.userId);
    if (!volunteerId) {
      res.status(403).json({ success: false, message: 'Only volunteers can submit beneficiary applications' });
      return;
    }

    const fields = normalizeFields(req.body.fields);
    const schema = await getActiveSchema();

    const missing = schema
      .filter((field) => Boolean(field.required))
      .filter((field) => isEmptyValue(fields[field.name]))
      .map((field) => field.label || field.name);

    if (missing.length > 0) {
      res.status(422).json({ success: false, message: `Missing required fields: ${missing.join(', ')}` });
      return;
    }

    const fullName = getFirstNonEmpty(fields, ['full_name']);
    if (!fullName) {
      res.status(422).json({ success: false, message: 'Full name is required' });
      return;
    }

    const projectAmountRaw = getFirstNonEmpty(fields, ['project_amount_taka']);
    const projectAmount = projectAmountRaw ? Number(projectAmountRaw) : null;
    if (projectAmount !== null && Number.isNaN(projectAmount)) {
      res.status(422).json({ success: false, message: 'project_amount_taka must be a number' });
      return;
    }

    const [applicationId] = await db('dfb_beneficiary_applications').insert({
      applicant_user_id: req.user!.userId,
      volunteer_id: volunteerId,
      full_name: fullName,
      father_name: getFirstNonEmpty(fields, ['father_name']) || null,
      mother_name: getFirstNonEmpty(fields, ['mother_name']) || null,
      date_of_birth: getFirstNonEmpty(fields, ['date_of_birth']) || null,
      nid_or_birth_certificate_no: getFirstNonEmpty(fields, ['nid_or_birth_certificate_no']) || null,
      mobile_number: getFirstNonEmpty(fields, ['mobile_number']) || null,
      division: getFirstNonEmpty(fields, ['division']) || null,
      district: getFirstNonEmpty(fields, ['district']) || null,
      upazila: getFirstNonEmpty(fields, ['upazila']) || null,
      village: getFirstNonEmpty(fields, ['village']) || null,
      full_address: getFirstNonEmpty(fields, ['full_address']) || null,
      identity_document_url: getFirstNonEmpty(fields, ['identity_document_url']) || null,
      passport_photo_url: getFirstNonEmpty(fields, ['passport_photo_url']) || null,
      nationality_certificate_url: getFirstNonEmpty(fields, ['nationality_certificate_url']) || null,
      additional_document_url: getFirstNonEmpty(fields, ['additional_document_url']) || null,
      project_type: getFirstNonEmpty(fields, ['project_type']) || null,
      project_amount_taka: projectAmount,
      case_description: getFirstNonEmpty(fields, ['case_description']) || null,
      status: 'pending',
      form_payload: JSON.stringify(fields),
      created_at: new Date(),
      updated_at: new Date(),
    });

    await writeAuditLog({
      tableAffected: 'dfb_beneficiary_applications',
      recordId: String(applicationId),
      actionType: 'INSERT',
      newPayload: { full_name: fullName, project_type: getFirstNonEmpty(fields, ['project_type']) },
      actorId: req.user!.userId,
      ipAddress: req.ip,
    });

    res.status(201).json({ success: true, data: { application_id: applicationId }, message: 'Beneficiary application submitted successfully' });
  }
);

// PATCH /api/v1/beneficiary-applications/:id/review (admin-only)
beneficiaryApplicationsRouter.patch(
  '/:id/review',
  requireRoles('Super Admin', 'Admin'),
  [
    param('id').isInt({ min: 1 }).toInt(),
    body('status').isIn(['pending', 'under_review', 'approved', 'rejected', 'needs_changes']),
    body('reviewNotes').optional().isString(),
    body('assignedVolunteerId').optional({ nullable: true }).isInt({ min: 1 }).toInt(),
    body('taggedDonorId').optional({ nullable: true }).isInt({ min: 1 }).toInt(),
    body('allowInterestedDonors').optional().isBoolean(),
    body('linkedProjectId').optional({ nullable: true }).isInt({ min: 1 }).toInt(),
    body('fundraiserRequired').optional().isBoolean(),
    body('createBeneficiaryOnApprove').optional().isBoolean(),
  ],
  async (req: Request, res: Response): Promise<void> => {
    if (parseValidationErrors(req, res)) return;

    const appId = Number(req.params.id);
    const application = await db('dfb_beneficiary_applications').where({ application_id: appId }).first();
    if (!application) {
      res.status(404).json({ success: false, message: 'Application not found' });
      return;
    }

    if (req.body.assignedVolunteerId) {
      const exists = await db('dfb_volunteers').where({ volunteer_id: req.body.assignedVolunteerId }).first('volunteer_id');
      if (!exists) {
        res.status(404).json({ success: false, message: 'Assigned volunteer not found' });
        return;
      }
    }

    if (req.body.taggedDonorId) {
      const exists = await db('dfb_donors').where({ donor_id: req.body.taggedDonorId }).first('donor_id');
      if (!exists) {
        res.status(404).json({ success: false, message: 'Tagged donor not found' });
        return;
      }
    }

    if (req.body.linkedProjectId) {
      const exists = await db('dfb_projects').where({ project_id: req.body.linkedProjectId }).first('project_id');
      if (!exists) {
        res.status(404).json({ success: false, message: 'Linked project not found' });
        return;
      }
    }

    const status = String(req.body.status);

    let createdBeneficiaryId = application.created_beneficiary_id ? Number(application.created_beneficiary_id) : null;

    await db.transaction(async (trx) => {
      await trx('dfb_beneficiary_applications').where({ application_id: appId }).update({
        status,
        review_notes: req.body.reviewNotes ?? application.review_notes,
        reviewed_by: req.user!.userId,
        reviewed_at: new Date(),
        assigned_volunteer_id: req.body.assignedVolunteerId ?? application.assigned_volunteer_id,
        tagged_donor_id: req.body.taggedDonorId ?? application.tagged_donor_id,
        allow_interested_donors: req.body.allowInterestedDonors ?? application.allow_interested_donors,
        linked_project_id: req.body.linkedProjectId ?? application.linked_project_id,
        fundraiser_required: req.body.fundraiserRequired ?? application.fundraiser_required,
        updated_at: new Date(),
      });

      const shouldCreateBeneficiary = status === 'approved' && Boolean(req.body.createBeneficiaryOnApprove) && !createdBeneficiaryId;

      if (shouldCreateBeneficiary) {
        let payloadParsed: unknown = application.form_payload;
        if (typeof application.form_payload === 'string') {
          try {
            payloadParsed = JSON.parse(application.form_payload);
          } catch {
            payloadParsed = {};
          }
        }
        const fields = normalizeFields(payloadParsed);
        const nidNumber = String(application.nid_or_birth_certificate_no || '').trim();
        const nationalIdHash = nidNumber ? createHash('sha256').update(nidNumber).digest('hex') : null;

        const documents = {
          identity_document_url: application.identity_document_url,
          passport_photo_url: application.passport_photo_url,
          nationality_certificate_url: application.nationality_certificate_url,
          additional_document_url: application.additional_document_url,
        };

        const [beneficiaryId] = await trx('dfb_beneficiaries').insert({
          full_name: application.full_name,
          national_id_hash: nationalIdHash,
          phone: application.mobile_number ? encrypt(String(application.mobile_number)) : null,
          address: application.full_address,
          city: application.district,
          welfare_category: mapWelfareCategory(application.project_type),
          status: 'active',
          intake_date: new Date(),
          documents_url: JSON.stringify(documents),
          assigned_volunteer_id: req.body.assignedVolunteerId ?? application.assigned_volunteer_id ?? application.volunteer_id,
          case_notes: application.case_description,
          created_at: new Date(),
          updated_at: new Date(),
        });

        createdBeneficiaryId = Number(beneficiaryId);

        await trx('dfb_beneficiary_applications').where({ application_id: appId }).update({
          created_beneficiary_id: createdBeneficiaryId,
          updated_at: new Date(),
          form_payload: JSON.stringify(fields),
        });
      }
    });

    await writeAuditLog({
      tableAffected: 'dfb_beneficiary_applications',
      recordId: String(appId),
      actionType: 'UPDATE',
      newPayload: {
        status,
        reviewNotes: req.body.reviewNotes,
        assignedVolunteerId: req.body.assignedVolunteerId,
        taggedDonorId: req.body.taggedDonorId,
        allowInterestedDonors: req.body.allowInterestedDonors,
        linkedProjectId: req.body.linkedProjectId,
        fundraiserRequired: req.body.fundraiserRequired,
        createdBeneficiaryId,
      },
      actorId: req.user!.userId,
      ipAddress: req.ip,
    });

    res.json({ success: true, message: `Application ${status}`, data: { created_beneficiary_id: createdBeneficiaryId } });
  }
);
