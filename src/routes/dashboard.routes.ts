import { Router, Request, Response } from 'express';
import { db } from '../config/database';
import { authenticate, requireRoles } from '../middleware/auth.middleware';
import { redis } from '../config/redis';

export const dashboardRouter = Router();

const CACHE_TTL = 30; // seconds

// ---------------------------------------------------------------------------
// GET /api/v1/dashboard/stats — Super-fast dashboard KPIs
// ---------------------------------------------------------------------------
dashboardRouter.get('/stats', authenticate, async (req: Request, res: Response): Promise<void> => {
  const cacheKey = 'dashboard:stats:v1';
  const cached   = await redis.get(cacheKey);
  if (cached) {
    res.json({ success: true, data: JSON.parse(cached), cached: true });
    return;
  }

  const [
    totalDonationsRow,
    totalDonorsRow,
    activeCampaignsRow,
    pendingExpensesRow,
    fundsRow,
    monthlyRow,
  ] = await Promise.all([
    db('dfb_transactions').where({ status: 'Completed' }).sum('net_amount as total'),
    db('dfb_donors').whereNull('deleted_at').count('donor_id as total'),
    db('dfb_campaigns').where({ status: 'active', is_public: true }).count('campaign_id as total'),
    db('dfb_expenses').where({ status: 'Pending' }).count('expense_id as total'),
    db('dfb_funds').orderBy('fund_id').select('fund_name', 'fund_category', 'current_balance', 'target_goal'),
    db('dfb_transactions')
      .where({ status: 'Completed' })
      .whereRaw('created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)')
      .sum('net_amount as this_month').count('transaction_id as txn_count'),
  ]);

  const stats = {
    total_raised:       Number(totalDonationsRow[0].total   || 0),
    total_donors:       Number(totalDonorsRow[0].total      || 0),
    active_campaigns:   Number(activeCampaignsRow[0].total  || 0),
    pending_expenses:   Number(pendingExpensesRow[0].total  || 0),
    this_month_raised:  Number(monthlyRow[0].this_month     || 0),
    this_month_count:   Number(monthlyRow[0].txn_count      || 0),
    funds:              fundsRow,
    generated_at:       new Date().toISOString(),
  };

  await redis.set(cacheKey, JSON.stringify(stats), 'EX', CACHE_TTL);

  res.json({ success: true, data: stats, cached: false });
});

// ---------------------------------------------------------------------------
// GET /api/v1/dashboard/live-feed — Recent 20 transactions (SSE-compatible)
// ---------------------------------------------------------------------------
dashboardRouter.get('/live-feed', authenticate, async (_req: Request, res: Response): Promise<void> => {
  const recent = await db('dfb_transactions as t')
    .leftJoin('dfb_donors as d', 't.donor_id', 'd.donor_id')
    .where('t.status', 'Completed')
    .orderBy('t.created_at', 'desc')
    .limit(20)
    .select(
      't.transaction_id', 't.amount', 't.currency', 't.payment_method',
      't.net_amount', 't.created_at',
      'd.first_name', 'd.last_name', 'd.donor_type'
    );

  // Anonymize for public feed display
  const feed = recent.map(row => ({
    ...row,
    first_name: row.donor_type === 'Anonymous' ? 'Anonymous' : row.first_name,
    last_name:  row.donor_type === 'Anonymous' ? 'Donor'     : row.last_name?.slice(0, 1) + '.',
  }));

  res.json({ success: true, data: feed });
});

// ---------------------------------------------------------------------------
// GET /api/v1/dashboard/integrity-status — Chain verification status
// ---------------------------------------------------------------------------
dashboardRouter.get(
  '/integrity-status',
  authenticate,
  requireRoles('Super Admin', 'Admin'),
  async (_req: Request, res: Response): Promise<void> => {
    const { verifyChain } = await import('../services/integrity.service');
    const [txnOk, allocOk, expOk] = await Promise.all([
      verifyChain('transaction'),
      verifyChain('allocation'),
      verifyChain('expense'),
    ]);

    res.json({
      success: true,
      data: {
        transaction_chain: txnOk  ? 'VALID' : 'TAMPERED',
        allocation_chain:  allocOk ? 'VALID' : 'TAMPERED',
        expense_chain:     expOk  ? 'VALID' : 'TAMPERED',
        all_ok:            txnOk && allocOk && expOk,
        checked_at:        new Date().toISOString(),
      },
    });
  }
);

// ---------------------------------------------------------------------------
// GET /api/v1/dashboard/sse — Server-Sent Events for real-time updates
// ---------------------------------------------------------------------------
dashboardRouter.get('/sse', authenticate, async (req: Request, res: Response): Promise<void> => {
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
  res.flushHeaders();

  const sendStats = async () => {
    try {
      const [statsRow] = await db('dfb_transactions')
        .where({ status: 'Completed' })
        .sum('net_amount as total').count('transaction_id as count');

      const data = {
        total_raised: Number(statsRow.total || 0),
        txn_count:    Number(statsRow.count || 0),
        ts:           Date.now(),
      };
      res.write(`event: stats\ndata: ${JSON.stringify(data)}\n\n`);
    } catch { /* connection closed */ }
  };

  await sendStats();
  const interval = setInterval(sendStats, 5000);

  req.on('close', () => {
    clearInterval(interval);
    res.end();
  });
});
