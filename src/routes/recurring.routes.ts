import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { db } from '../config/database';
import { authenticate, requireRoles } from '../middleware/auth.middleware';
import { writeAuditLog } from '../services/audit.service';

export const recurringRouter = Router();

recurringRouter.use(authenticate);

// ---------------------------------------------------------------------------
// GET /api/v1/recurring — My subscriptions or all (admin)
// ---------------------------------------------------------------------------
recurringRouter.get('/', async (req: Request, res: Response) => {
  const isAdmin = ['Super Admin', 'Admin'].includes(req.user!.roleName || '');

  let q = db('dfb_recurring_subscriptions as rs')
    .leftJoin('dfb_donors as d', 'rs.donor_id', 'd.donor_id')
    .leftJoin('dfb_funds as f', 'rs.fund_id', 'f.fund_id')
    .select(
      'rs.subscription_id', 'rs.amount', 'rs.currency', 'rs.frequency',
      'rs.gateway', 'rs.gateway_subscription_id', 'rs.status',
      'rs.next_billing_date', 'rs.failure_count', 'rs.created_at',
      'd.first_name', 'd.last_name', 'f.fund_name'
    );

  if (!isAdmin) {
    const user = await db('dfb_users').where({ user_id: req.user!.userId }).first('donor_id');
    if (!user?.donor_id) { res.json({ success: true, data: [] }); return; }
    q = q.where('rs.donor_id', user.donor_id);
  }

  const subs = await q.orderBy('rs.created_at', 'desc');
  res.json({ success: true, data: subs });
});

// ---------------------------------------------------------------------------
// POST /api/v1/recurring — Create subscription record
// ---------------------------------------------------------------------------
recurringRouter.post('/',
  [
    body('donorId').optional().isInt().toInt(),
    body('fundId').isInt().toInt(),
    body('amount').isFloat({ min: 1 }).toFloat(),
    body('currency').isString().isLength({ min: 3, max: 3 }),
    body('frequency').isIn(['weekly', 'monthly', 'quarterly', 'annually']),
    body('gateway').isIn(['stripe', 'paypal']),
    body('gatewaySubscriptionId').isString().notEmpty(),
    body('nextBillingDate').isISO8601().toDate(),
  ],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(422).json({ success: false, errors: errors.array() }); return; }

    let donorId = req.body.donorId;
    if (!donorId) {
      const user = await db('dfb_users').where({ user_id: req.user!.userId }).first('donor_id');
      donorId = user?.donor_id;
    }
    if (!donorId) { res.status(400).json({ success: false, message: 'No donor profile' }); return; }

    const [subId] = await db('dfb_recurring_subscriptions').insert({
      donor_id: donorId,
      fund_id: req.body.fundId,
      campaign_id: req.body.campaignId || null,
      amount: req.body.amount,
      currency: req.body.currency,
      frequency: req.body.frequency,
      gateway: req.body.gateway,
      gateway_subscription_id: req.body.gatewaySubscriptionId,
      status: 'active',
      next_billing_date: req.body.nextBillingDate,
      failure_count: 0,
      created_at: new Date(),
    });

    res.status(201).json({ success: true, message: 'Subscription created', subscriptionId: subId });
  }
);

// ---------------------------------------------------------------------------
// PATCH /api/v1/recurring/:id/cancel — Cancel subscription
// ---------------------------------------------------------------------------
recurringRouter.patch('/:id/cancel',
  requireRoles('Super Admin', 'Admin', 'Donor'),
  param('id').isInt().toInt(),
  async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id as any;
    const updated = await db('dfb_recurring_subscriptions').where({ subscription_id: id }).update({
      status: 'cancelled',
      cancelled_at: new Date()
    });
    if (!updated) { res.status(404).json({ success: false, message: 'Subscription not found' }); return; }

    await writeAuditLog({
      tableAffected: 'dfb_recurring_subscriptions',
      recordId: String(id),
      actionType: 'UPDATE',
      newPayload: { status: 'cancelled' },
      actorId: req.user!.userId,
      ipAddress: req.ip,
    });

    res.json({ success: true, message: 'Subscription cancelled' });
  }
);
