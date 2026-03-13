import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { db } from '../config/database';
import { authenticate, requireRoles } from '../middleware/auth.middleware';
import { writeAuditLog } from '../services/audit.service';

export const pledgesRouter = Router();

pledgesRouter.use(authenticate);

// ---------------------------------------------------------------------------
// GET /api/v1/pledges — My pledges (donor) or all pledges (admin)
// ---------------------------------------------------------------------------
pledgesRouter.get('/', async (req: Request, res: Response) => {
  try {
    const isAdmin = ['Super Admin', 'Admin'].includes(req.user!.roleName || '');
    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 20);
    const offset = (page - 1) * limit;

    let q = db('dfb_pledges as p')
      .leftJoin('dfb_donors as d', 'p.donor_id', 'd.donor_id')
      .leftJoin('dfb_funds as f', 'p.fund_id', 'f.fund_id')
      .leftJoin('dfb_campaigns as c', 'p.campaign_id', 'c.campaign_id')
      .select(
        'p.pledge_id as id',
        'p.pledge_id', 'p.total_pledge_amount', 'p.amount_fulfilled',
        'p.installment_count', 'p.installments_paid', 'p.frequency',
        'p.start_date', 'p.end_date', 'p.status', 'p.created_at',
        'd.first_name', 'd.last_name',
        'f.fund_name', 'c.title as campaign_title'
      );

    if (!isAdmin) {
      const user = await db('dfb_users').where({ user_id: req.user!.userId }).first('donor_id');
      if (!user?.donor_id) { res.json({ success: true, data: [], meta: { total: 0, page, limit } }); return; }
      q = q.where('p.donor_id', user.donor_id);
    }

    const totalRow = await q.clone().clearSelect().clearOrder().countDistinct({ total: 'p.pledge_id' }).first();
    const total = Number(totalRow?.total || 0);
    const pledges = await q.orderBy('p.created_at', 'desc').limit(limit).offset(offset);

    res.json({ success: true, data: pledges, meta: { total, page, limit } });
  } catch (error) {
    console.error('[pledges] Failed to fetch pledges:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch pledges' });
  }
});

// ---------------------------------------------------------------------------
// POST /api/v1/pledges — Create a pledge commitment
// ---------------------------------------------------------------------------
pledgesRouter.post('/',
  [
    body('donorId').optional().isInt().toInt(),
    body('fundId').isInt().toInt(),
    body('campaignId').optional().isInt().toInt(),
    body('totalPledgeAmount').isFloat({ min: 1 }).toFloat(),
    body('installmentCount').isInt({ min: 1 }).toInt(),
    body('frequency').isIn(['one_time', 'monthly', 'quarterly', 'annually']),
    body('startDate').optional().isISO8601().toDate(),
    body('endDate').optional().isISO8601().toDate(),
  ],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(422).json({ success: false, errors: errors.array() }); return; }

    let donorId = req.body.donorId;
    if (!donorId) {
      const user = await db('dfb_users').where({ user_id: req.user!.userId }).first('donor_id');
      donorId = user?.donor_id;
    }
    if (!donorId) { res.status(400).json({ success: false, message: 'No donor profile linked to this account' }); return; }

    const [pledgeId] = await db('dfb_pledges').insert({
      donor_id: donorId,
      fund_id: req.body.fundId,
      campaign_id: req.body.campaignId || null,
      total_pledge_amount: req.body.totalPledgeAmount,
      amount_fulfilled: 0,
      installment_count: req.body.installmentCount,
      installments_paid: 0,
      frequency: req.body.frequency,
      start_date: req.body.startDate || new Date(),
      end_date: req.body.endDate || null,
      status: 'active',
      created_at: new Date(),
    });

    await writeAuditLog({
      tableAffected: 'dfb_pledges',
      recordId: String(pledgeId),
      actionType: 'INSERT',
      newPayload: { donor_id: donorId, total_pledge_amount: req.body.totalPledgeAmount },
      actorId: req.user!.userId,
      ipAddress: req.ip,
    });

    res.status(201).json({ success: true, message: 'Pledge created', pledgeId });
  }
);

// ---------------------------------------------------------------------------
// PATCH /api/v1/pledges/:id/cancel — Cancel a pledge
// ---------------------------------------------------------------------------
pledgesRouter.patch('/:id/cancel',
  param('id').isInt().toInt(),
  async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id as any;
    const pledge = await db('dfb_pledges').where({ pledge_id: id }).first();
    if (!pledge) { res.status(404).json({ success: false, message: 'Pledge not found' }); return; }

    await db('dfb_pledges').where({ pledge_id: id }).update({ status: 'cancelled' });

    await writeAuditLog({
      tableAffected: 'dfb_pledges',
      recordId: String(id),
      actionType: 'UPDATE',
      newPayload: { status: 'cancelled' },
      actorId: req.user!.userId,
      ipAddress: req.ip,
    });

    res.json({ success: true, message: 'Pledge cancelled' });
  }
);
