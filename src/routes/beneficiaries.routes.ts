import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { db } from '../config/database';
import { authenticate, requireRoles } from '../middleware/auth.middleware';
import { writeAuditLog } from '../services/audit.service';
import { encrypt, decrypt } from '../utils/crypto';

export const beneficiariesRouter = Router();

// All beneficiary endpoints require authentication
beneficiariesRouter.use(authenticate);

// ---------------------------------------------------------------------------
// GET /api/v1/beneficiaries — List beneficiaries (admin/volunteer)
// ---------------------------------------------------------------------------
beneficiariesRouter.get('/', requireRoles('Super Admin', 'Admin', 'Volunteer'), async (req: Request, res: Response) => {
  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 20);
  const offset = (page - 1) * limit;
  const status = req.query.status as string || 'active';

  const [{ total }] = await db('dfb_beneficiaries').where({ status }).count('beneficiary_id as total');
  const rows = await db('dfb_beneficiaries as b')
    .leftJoin('dfb_volunteers as v', 'b.assigned_volunteer_id', 'v.volunteer_id')
    .where('b.status', status)
    .orderBy('b.intake_date', 'desc')
    .limit(limit).offset(offset)
    .select(
      'b.beneficiary_id', 'b.full_name', 'b.address', 'b.city',
      'b.welfare_category', 'b.status', 'b.intake_date', 'b.phone',
      db.raw("CONCAT(v.first_name, ' ', v.last_name) as volunteer_name")
    );

  // Decrypt phone if present
  rows.forEach((r: any) => {
    if (r.phone) { try { r.phone = decrypt(r.phone); } catch { r.phone = '[encrypted]'; } }
  });

  res.json({ success: true, data: rows, meta: { page, limit, total: Number(total) } });
});

// ---------------------------------------------------------------------------
// POST /api/v1/beneficiaries — Create beneficiary intake
// ---------------------------------------------------------------------------
beneficiariesRouter.post('/',
  requireRoles('Super Admin', 'Admin'),
  [
    body('fullName').trim().notEmpty().isLength({ max: 120 }),
    body('phone').optional().trim(),
    body('address').optional().trim(),
    body('city').optional().trim(),
    body('welfareCategory').isIn(['food', 'shelter', 'medical', 'education', 'cash_aid', 'other']),
  ],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(422).json({ success: false, errors: errors.array() }); return; }

    const [id] = await db('dfb_beneficiaries').insert({
      full_name: req.body.fullName,
      phone: req.body.phone ? encrypt(req.body.phone) : null,
      address: req.body.address || null,
      city: req.body.city || null,
      welfare_category: req.body.welfareCategory,
      status: 'active',
      intake_date: new Date(),
      created_at: new Date(),
      updated_at: new Date(),
    });

    await writeAuditLog({
      tableAffected: 'dfb_beneficiaries',
      recordId: String(id),
      actionType: 'INSERT',
      newPayload: { full_name: req.body.fullName, welfare_category: req.body.welfareCategory },
      actorId: req.user!.userId,
      ipAddress: req.ip,
    });

    res.status(201).json({ success: true, message: 'Beneficiary created', beneficiaryId: id });
  }
);

// ---------------------------------------------------------------------------
// PATCH /api/v1/beneficiaries/:id — Update beneficiary status/notes
// ---------------------------------------------------------------------------
beneficiariesRouter.patch('/:id',
  requireRoles('Super Admin', 'Admin'),
  param('id').isInt().toInt(),
  async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id as any;
    const updateData: any = { updated_at: new Date() };
    if (req.body.status) updateData.status = req.body.status;
    if (req.body.caseNotes) updateData.case_notes = req.body.caseNotes;
    if (req.body.assignedVolunteerId) updateData.assigned_volunteer_id = req.body.assignedVolunteerId;

    const updated = await db('dfb_beneficiaries').where({ beneficiary_id: id }).update(updateData);
    if (!updated) { res.status(404).json({ success: false, message: 'Beneficiary not found' }); return; }

    res.json({ success: true, message: 'Beneficiary updated' });
  }
);
