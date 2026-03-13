import { Router, Request, Response } from 'express';
import { query, validationResult } from 'express-validator';
import { db } from '../config/database';
import { authenticate, requireRoles } from '../middleware/auth.middleware';

export const fundsRouter = Router();

// ---------------------------------------------------------------------------
// GET /api/v1/funds
// ---------------------------------------------------------------------------
fundsRouter.get('/', async (req: Request, res: Response): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    const publicFunds = await db('dfb_funds').orderBy('fund_id', 'asc').select('fund_id', 'fund_name', 'fund_category');
    res.json({ success: true, data: publicFunds });
    return;
  }

  try {
    const token = authHeader.slice(7);
    const jwt = await import('jsonwebtoken');
    const { config } = await import('../config');
    const decoded = jwt.default.verify(token, config.jwt.accessSecret) as { roleId: number };
    const role = await db('dfb_roles').where({ role_id: decoded.roleId }).first('role_name');
    const isAdmin = role?.role_name === 'Super Admin' || role?.role_name === 'Admin' || role?.role_name === 'Finance';

    if (isAdmin) {
      const funds = await db('dfb_funds').orderBy('fund_id', 'asc');
      res.json({ success: true, data: funds });
      return;
    }

    const limitedFunds = await db('dfb_funds').orderBy('fund_id', 'asc').select('fund_id', 'fund_name', 'fund_category');
    res.json({ success: true, data: limitedFunds });
  } catch {
    const publicFunds = await db('dfb_funds').orderBy('fund_id', 'asc').select('fund_id', 'fund_name', 'fund_category');
    res.json({ success: true, data: publicFunds });
  }
});

// ---------------------------------------------------------------------------
// GET /api/v1/funds/:id/balance (real-time balance query)
// ---------------------------------------------------------------------------
fundsRouter.get('/:id/balance', authenticate, async (req: Request, res: Response): Promise<void> => {
  const fund = await db('dfb_funds').where({ fund_id: req.params.id }).first();
  if (!fund) { res.status(404).json({ success: false, message: 'Fund not found' }); return; }

  // Compute real-time balance from allocations (authoritative source)
  const [{ unspent }] = await db('dfb_allocations')
    .where({ fund_id: req.params.id, is_spent: false })
    .sum('allocated_amount as unspent');

  res.json({
    success: true,
    data: {
      fund_id:            fund.fund_id,
      fund_name:          fund.fund_name,
      current_balance:    fund.current_balance,         // Denormalized (fast)
      verified_unspent:   Number(unspent || 0),         // Computed from allocations (authoritative)
      discrepancy:        Number(fund.current_balance) - Number(unspent || 0),
    },
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/funds/:id/transactions
// ---------------------------------------------------------------------------
fundsRouter.get(
  '/:id/transactions',
  authenticate,
  requireRoles('Super Admin', 'Admin', 'Finance'),
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 200 }).toInt(),
  ],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(422).json({ success: false, errors: errors.array() }); return; }

    const page  = Number(req.query.page)  || 1;
    const limit = Number(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const txns = await db('dfb_allocations as a')
      .join('dfb_transactions as t', 'a.transaction_id', 't.transaction_id')
      .leftJoin('dfb_donors as d', 't.donor_id', 'd.donor_id')
      .where({ 'a.fund_id': req.params.id })
      .orderBy('a.allocated_at', 'desc')
      .limit(limit).offset(offset)
      .select(
        'a.allocation_id', 'a.allocated_amount', 'a.allocated_at', 'a.is_spent',
        't.transaction_id', 't.amount', 't.payment_method', 't.status as txn_status',
        'd.first_name', 'd.last_name'
      );

    res.json({ success: true, data: txns });
  }
);
