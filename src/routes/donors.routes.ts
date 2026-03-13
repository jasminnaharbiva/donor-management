import { Router, Request, Response } from 'express';
import { body, query, param, validationResult } from 'express-validator';
import { db } from '../config/database';
import { authenticate, requireRoles } from '../middleware/auth.middleware';
import { encrypt, decrypt } from '../utils/crypto';

export const donorRouter = Router();

// ---------------------------------------------------------------------------
// GET /api/v1/donors
// ---------------------------------------------------------------------------
donorRouter.get(
  '/',
  authenticate,
  requireRoles('Super Admin', 'Admin', 'Finance'),
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
    query('search').optional().trim().isLength({ max: 100 }),
    query('type').optional().isIn(['Individual', 'Corporate', 'Anonymous']),
  ],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(422).json({ success: false, errors: errors.array() }); return; }

    const page  = Number(req.query.page)  || 1;
    const limit = Number(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    let queryBuilder = db('dfb_donors').whereNull('deleted_at');
    if (req.query.type) queryBuilder = queryBuilder.where('donor_type', req.query.type as string);

    const [{ total }] = await queryBuilder.clone().count('donor_id as total');
    const donors = await queryBuilder
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset)
      .select(
        'donor_id', 'first_name', 'last_name', 'donor_type',
        'lifetime_value', 'last_donation_date', 'engagement_score', 'created_at'
      );

    res.json({
      success: true,
      data:    donors,
      meta:    { page, limit, total: Number(total), totalPages: Math.ceil(Number(total) / limit) },
    });
  }
);

// ---------------------------------------------------------------------------
// GET /api/v1/donors/:id
// ---------------------------------------------------------------------------
donorRouter.get(
  '/:id',
  authenticate,
  requireRoles('Super Admin', 'Admin', 'Finance'),
  param('id').isInt({ min: 1 }).toInt(),
  async (req: Request, res: Response): Promise<void> => {
    const donor = await db('dfb_donors').where({ donor_id: req.params.id }).whereNull('deleted_at').first();
    if (!donor) { res.status(404).json({ success: false, message: 'Donor not found' }); return; }

    // Decrypt PII
    try { donor.email = decrypt(donor.email.toString()); } catch { donor.email = '[encrypted]'; }
    try { if (donor.phone) donor.phone = decrypt(donor.phone.toString()); } catch { donor.phone = '[encrypted]'; }

    res.json({ success: true, data: donor });
  }
);

// ---------------------------------------------------------------------------
// GET /api/v1/donors/:id/transactions
// ---------------------------------------------------------------------------
donorRouter.get(
  '/:id/transactions',
  authenticate,
  requireRoles('Super Admin', 'Admin', 'Finance'),
  param('id').isInt({ min: 1 }).toInt(),
  async (req: Request, res: Response): Promise<void> => {
    const page  = Number(req.query.page)  || 1;
    const limit = Number(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const txns = await db('dfb_transactions')
      .where({ donor_id: req.params.id })
      .orderBy('created_at', 'desc')
      .limit(limit)
      .offset(offset);

    res.json({ success: true, data: txns });
  }
);

// ---------------------------------------------------------------------------
// PATCH /api/v1/donors/:id — update (non-PII fields)
// ---------------------------------------------------------------------------
donorRouter.patch(
  '/:id',
  authenticate,
  requireRoles('Super Admin', 'Admin'),
  param('id').isInt({ min: 1 }).toInt(),
  [
    body('firstName').optional().trim().isLength({ max: 80 }),
    body('lastName').optional().trim().isLength({ max: 80 }),
    body('donorType').optional().isIn(['Individual', 'Corporate', 'Anonymous']),
  ],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(422).json({ success: false, errors: errors.array() }); return; }

    const updates: Record<string, unknown> = { updated_at: new Date() };
    if (req.body.firstName) updates.first_name = req.body.firstName;
    if (req.body.lastName)  updates.last_name  = req.body.lastName;
    if (req.body.donorType) updates.donor_type  = req.body.donorType;

    const affected = await db('dfb_donors')
      .where({ donor_id: req.params.id })
      .whereNull('deleted_at')
      .update(updates);

    if (!affected) { res.status(404).json({ success: false, message: 'Donor not found' }); return; }
    res.json({ success: true, message: 'Donor updated' });
  }
);

// ---------------------------------------------------------------------------
// DELETE /api/v1/donors/:id — GDPR soft delete
// ---------------------------------------------------------------------------
donorRouter.delete(
  '/:id',
  authenticate,
  requireRoles('Super Admin'),
  param('id').isInt({ min: 1 }).toInt(),
  async (req: Request, res: Response): Promise<void> => {
    const { writeAuditLog } = await import('../services/audit.service');

    await db('dfb_donors')
      .where({ donor_id: req.params.id })
      .update({
        first_name: '[deleted]',
        last_name:  '[deleted]',
        email:      Buffer.from('[gdpr_erased]'),
        phone:      null,
        national_id_hash: null,
        deleted_at: new Date(),
        updated_at: new Date(),
      });

    await writeAuditLog({
      tableAffected: 'dfb_donors',
      recordId:      String(req.params.id),
      actionType:    'GDPR_ERASE',
      actorId:       req.user!.userId,
      actorRole:     req.user!.roleName,
      ipAddress:     req.ip,
    });

    res.json({ success: true, message: 'Donor data erased (GDPR)' });
  }
);

// ---------------------------------------------------------------------------
// GET /api/v1/donors/me/impact — "Where did my money go?" donor-facing provenance
// ---------------------------------------------------------------------------
donorRouter.get('/me/impact', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const userRow = await db('dfb_users').where({ user_id: req.user!.userId }).first('donor_id');
    if (!userRow?.donor_id) {
      res.status(403).json({ success: false, message: 'No donor account linked to this user' });
      return;
    }
    const donorId = userRow.donor_id;

    const donations = await db('dfb_transactions as t')
      .leftJoin('dfb_allocations as a', 't.transaction_id', 'a.transaction_id')
      .leftJoin('dfb_funds as f', 'a.fund_id', 'f.fund_id')
      .where({ 't.donor_id': donorId })
      .orderBy('t.created_at', 'desc')
      .groupBy('t.transaction_id', 't.net_amount', 't.amount', 't.currency', 't.created_at', 't.payment_method', 't.status')
      .select(
        't.transaction_id',
        db.raw('COALESCE(t.net_amount, t.amount) as amount'),
        't.currency',
        't.created_at as donated_at',
        't.payment_method',
        db.raw('LOWER(t.status) as status'),
        db.raw('MAX(f.fund_id) as fund_id'),
        db.raw('MAX(f.fund_name) as fund_name'),
        db.raw('MAX(f.fund_category) as fund_type')
      );

    const impact = await Promise.all(donations.map(async (don: any) => {
      const allocations = await db('dfb_allocations as a')
        .leftJoin('dfb_expenses as e', 'a.expense_id', 'e.expense_id')
        .where({ 'a.transaction_id': don.transaction_id })
        .select(
          'a.allocation_id', 'a.allocated_amount', 'a.is_spent', 'a.allocated_at',
          'e.expense_id', 'e.purpose', 'e.amount_spent', 'e.vendor_name',
          'e.spent_timestamp', 'e.receipt_url', 'e.status as expense_status'
        );

      const totalAllocated = allocations.reduce((s: number, a: any) => s + Number(a.allocated_amount), 0);
      const totalSpent = allocations.filter((a: any) => a.is_spent).reduce((s: number, a: any) => s + Number(a.allocated_amount), 0);
      const amount = Number(don.amount || 0);

      return {
        transaction_id: don.transaction_id,
        amount,
        currency: don.currency,
        donated_at: don.donated_at,
        payment_method: don.payment_method,
        status: don.status,
        fund: {
          fund_id: don.fund_id,
          fund_name: don.fund_name,
          fund_type: don.fund_type,
        },
        total_allocated: totalAllocated,
        total_deployed: totalSpent,
        pending_amount: Math.max(0, amount - totalSpent),
        allocations: allocations.map((a: any) => ({
          allocation_id: a.allocation_id,
          allocated_amount: Number(a.allocated_amount),
          is_spent: Boolean(a.is_spent),
          allocated_at: a.allocated_at,
          expense: a.expense_id ? {
            expense_id: a.expense_id,
            purpose: a.purpose,
            amount_spent: Number(a.amount_spent),
            vendor_name: a.vendor_name,
            spent_on: a.spent_timestamp,
            receipt_url: a.receipt_url,
            status: a.expense_status,
          } : null,
        })),
      };
    }));

    const summary = {
      total_donated: donations.reduce((s: number, d: any) => s + Number(d.amount || 0), 0),
      total_deployed: impact.reduce((s: number, i: any) => s + i.total_deployed, 0),
      total_pending: impact.reduce((s: number, i: any) => s + i.pending_amount, 0),
      donations_count: donations.length,
    };

    res.json({ success: true, data: { summary, donations: impact } });
  } catch (error) {
    console.error('[donors/me/impact] Failed to build impact view:', error);
    res.status(500).json({ success: false, message: 'Failed to load impact data' });
  }
});

donorRouter.get('/me/projects', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const userRow = await db('dfb_users').where({ user_id: req.user!.userId }).first('donor_id');
    if (!userRow?.donor_id) {
      res.status(403).json({ success: false, message: 'No donor account linked to this user' });
      return;
    }

    const donorId = userRow.donor_id;
    const projects = await db('dfb_transactions as t')
      .join('dfb_allocations as a', 't.transaction_id', 'a.transaction_id')
      .join('dfb_expenses as e', 'a.expense_id', 'e.expense_id')
      .join('dfb_projects as p', 'e.project_id', 'p.project_id')
      .leftJoin('dfb_funds as f', 'p.fund_id', 'f.fund_id')
      .where('t.donor_id', donorId)
      .groupBy(
        'p.project_id',
        'p.project_name',
        'p.description',
        'p.status',
        'p.location_country',
        'p.location_city',
        'p.start_date',
        'p.target_completion_date',
        'f.fund_name'
      )
      .select(
        'p.project_id',
        'p.project_name',
        'p.description',
        'p.status',
        'p.location_country',
        'p.location_city',
        'p.start_date',
        'p.target_completion_date',
        'f.fund_name',
        db.raw('SUM(a.allocated_amount) as allocated_amount')
      )
      .orderBy('p.updated_at', 'desc');

    res.json({ success: true, data: projects });
  } catch (error) {
    console.error('[donors/me/projects] Failed to load donor projects:', error);
    res.status(500).json({ success: false, message: 'Failed to load donor projects' });
  }
});

// ---------------------------------------------------------------------------
// GET /api/v1/donors/me/export — GDPR: Download all personal data as JSON
// ---------------------------------------------------------------------------
donorRouter.get('/me/export', authenticate, async (req: Request, res: Response): Promise<void> => {
  const userRow = await db('dfb_users').where({ user_id: req.user!.userId }).first('donor_id', 'email', 'created_at', 'last_login_at', 'status');
  if (!userRow?.donor_id) {
    res.status(403).json({ success: false, message: 'No donor account linked to this user' });
    return;
  }
  const donorId = userRow.donor_id;

  const [donor, donations, pledges, notifications] = await Promise.all([
    db('dfb_donors').where({ donor_id: donorId }).first(),
    db('dfb_transactions').where({ donor_id: donorId }).orderBy('created_at', 'desc'),
    db('dfb_pledges').where({ donor_id: donorId }),
    db('dfb_notifications').where({ user_id: req.user!.userId }).orderBy('sent_at', 'desc').limit(200),
  ]);

  // Decrypt PII for export
  let email = '[encrypted]';
  let donorEmail = '[encrypted]';
  try { email = decrypt(userRow.email); } catch { /* no-op */ }
  if (donor) {
    try { donorEmail = decrypt(donor.email); } catch { /* no-op */ }
    donor.email = donorEmail;
    if (donor.phone) { try { donor.phone = decrypt(donor.phone); } catch { /* no-op */ } }
  }

  const exportData = {
    exported_at: new Date().toISOString(),
    request_type: 'GDPR Article 20 – Right to Data Portability',
    account: {
      user_id:       req.user!.userId,
      email,
      status:        userRow.status,
      member_since:  userRow.created_at,
      last_login_at: userRow.last_login_at,
    },
    personal_info: donor || null,
    donations,
    pledges,
    notification_history: notifications,
  };

  const { writeAuditLog } = await import('../services/audit.service');
  await writeAuditLog({
    tableAffected: 'dfb_donors',
    recordId:      String(donorId),
    actionType:    'GDPR_EXPORT',
    actorId:       req.user!.userId,
    ipAddress:     req.ip,
    userAgent:     req.get('User-Agent'),
  });

  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', `attachment; filename="my-data-${new Date().toISOString().split('T')[0]}.json"`);
  res.send(JSON.stringify(exportData, null, 2));
});

// ---------------------------------------------------------------------------
// DELETE /api/v1/donors/me — GDPR: Right to be forgotten (self-service)
// ---------------------------------------------------------------------------
donorRouter.delete('/me', authenticate, async (req: Request, res: Response): Promise<void> => {
  const userRow = await db('dfb_users').where({ user_id: req.user!.userId }).first('donor_id');
  if (!userRow?.donor_id) {
    res.status(403).json({ success: false, message: 'No donor account linked to this user' });
    return;
  }
  const donorId = userRow.donor_id;

  await db.transaction(async (trx) => {
    await trx('dfb_donors').where({ donor_id: donorId }).update({
      first_name:      '[deleted]',
      last_name:       '[deleted]',
      email:           Buffer.from('[gdpr_erased]'),
      phone:           null,
      national_id_hash: null,
      deleted_at:      new Date(),
      updated_at:      new Date(),
    });
    await trx('dfb_users').where({ user_id: req.user!.userId }).update({
      email:         Buffer.from('[gdpr_erased]'),
      password_hash: '[erased]',
      status:        'suspended',
      deleted_at:    new Date(),
      updated_at:    new Date(),
    });
  });

  const { writeAuditLog } = await import('../services/audit.service');
  await writeAuditLog({
    tableAffected: 'dfb_donors',
    recordId:      String(donorId),
    actionType:    'GDPR_ERASE',
    actorId:       req.user!.userId,
    ipAddress:     req.ip,
    userAgent:     req.get('User-Agent'),
  });

  res.json({ success: true, message: 'Your account and personal data have been anonymised and scheduled for deletion.' });
});
