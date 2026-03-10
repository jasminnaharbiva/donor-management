import { Router, Request, Response } from 'express';
import { query, validationResult } from 'express-validator';
import { db } from '../config/database';
import { authenticate, requireRoles } from '../middleware/auth.middleware';
import { decrypt } from '../utils/crypto';
import { writeAuditLog } from '../services/audit.service';

export const reportsRouter = Router();

reportsRouter.use(authenticate, requireRoles('Super Admin', 'Admin'));

// Helper: convert array of objects to CSV
function toCSV(rows: any[]): string {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(','),
    ...rows.map(r => headers.map(h => {
      const val = r[h] == null ? '' : String(r[h]);
      return val.includes(',') || val.includes('"') ? `"${val.replace(/"/g, '""')}"` : val;
    }).join(','))
  ];
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// GET /api/v1/reports/donations — Export donations CSV
// ---------------------------------------------------------------------------
reportsRouter.get('/donations',
  [
    query('from').optional().isISO8601().toDate(),
    query('to').optional().isISO8601().toDate(),
    query('format').optional().isIn(['json', 'csv']),
  ],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(422).json({ success: false, errors: errors.array() }); return; }

    let q = db('dfb_transactions as t')
      .leftJoin('dfb_donors as d', 't.donor_id', 'd.donor_id')
      .select(
        't.transaction_id', 't.amount', 't.currency', 't.payment_method',
        't.gateway_txn_id', 't.gateway_fee', 't.net_amount', 't.status',
        't.ipn_timestamp', 't.settled_at',
        'd.first_name', 'd.last_name', 'd.email'
      )
      .orderBy('t.settled_at', 'desc');

    if (req.query.from) q = q.where('t.settled_at', '>=', req.query.from as any);
    if (req.query.to) q = q.where('t.settled_at', '<=', req.query.to as any);

    const rows = await q.limit(5000);

    rows.forEach((r: any) => {
      if (r.email) { try { r.email = decrypt(r.email); } catch { r.email = '[encrypted]'; } }
    });

    await writeAuditLog({
      tableAffected: 'dfb_transactions',
      recordId: 'EXPORT',
      actionType: 'EXPORT',
      newPayload: { count: rows.length, format: req.query.format || 'json' },
      actorId: req.user!.userId,
      ipAddress: req.ip,
    });

    if (req.query.format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="donations_${Date.now()}.csv"`);
      res.send(toCSV(rows));
      return;
    }

    res.json({ success: true, data: rows, count: rows.length });
  }
);

// ---------------------------------------------------------------------------
// GET /api/v1/reports/donors — Export donors CSV
// ---------------------------------------------------------------------------
reportsRouter.get('/donors',
  [query('format').optional().isIn(['json', 'csv'])],
  async (req: Request, res: Response): Promise<void> => {
    const rows = await db('dfb_donors')
      .whereNull('deleted_at')
      .select(
        'donor_id', 'first_name', 'last_name', 'email', 'phone', 'donor_type',
        'lifetime_value', 'last_donation_date', 'created_at'
      )
      .orderBy('created_at', 'desc')
      .limit(5000);

    rows.forEach((r: any) => {
      if (r.email) { try { r.email = decrypt(r.email); } catch { r.email = '[encrypted]'; } }
      if (r.phone) { try { r.phone = decrypt(r.phone); } catch { r.phone = '[encrypted]'; } }
    });

    await writeAuditLog({
      tableAffected: 'dfb_donors',
      recordId: 'EXPORT',
      actionType: 'EXPORT',
      newPayload: { count: rows.length },
      actorId: req.user!.userId,
      ipAddress: req.ip,
    });

    if (req.query.format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="donors_${Date.now()}.csv"`);
      res.send(toCSV(rows));
      return;
    }

    res.json({ success: true, data: rows, count: rows.length });
  }
);

// ---------------------------------------------------------------------------
// GET /api/v1/reports/expenses — Export expenses CSV
// ---------------------------------------------------------------------------
reportsRouter.get('/expenses',
  [
    query('from').optional().isISO8601().toDate(),
    query('to').optional().isISO8601().toDate(),
    query('format').optional().isIn(['json', 'csv']),
  ],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(422).json({ success: false, errors: errors.array() }); return; }

    let q = db('dfb_expenses as e')
      .leftJoin('dfb_funds as f', 'e.fund_id', 'f.fund_id')
      .leftJoin('dfb_volunteers as v', 'e.submitted_by_volunteer_id', 'v.volunteer_id')
      .select(
        'e.expense_id', 'e.amount_spent', 'e.vendor_name', 'e.purpose',
        'e.status', 'e.spent_timestamp', 'e.approved_at',
        'f.fund_name',
        db.raw("CONCAT(v.first_name, ' ', v.last_name) as volunteer_name")
      )
      .orderBy('e.spent_timestamp', 'desc');

    if (req.query.from) q = q.where('e.spent_timestamp', '>=', req.query.from as any);
    if (req.query.to) q = q.where('e.spent_timestamp', '<=', req.query.to as any);

    const rows = await q.limit(5000);

    await writeAuditLog({
      tableAffected: 'dfb_expenses',
      recordId: 'EXPORT',
      actionType: 'EXPORT',
      newPayload: { count: rows.length },
      actorId: req.user!.userId,
      ipAddress: req.ip,
    });

    if (req.query.format === 'csv') {
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="expenses_${Date.now()}.csv"`);
      res.send(toCSV(rows));
      return;
    }

    res.json({ success: true, data: rows, count: rows.length });
  }
);

// ---------------------------------------------------------------------------
// GET /api/v1/reports/ledger — General ledger (income vs expenses)
// ---------------------------------------------------------------------------
reportsRouter.get('/ledger', async (req: Request, res: Response) => {
  const [incomeRow] = await db('dfb_transactions').where({ status: 'Completed' }).sum('net_amount as total');
  const [expenseRow] = await db('dfb_expenses').where({ status: 'approved' }).sum('amount_spent as total');
  const [pendingRow] = await db('dfb_expenses').where({ status: 'pending' }).sum('amount_spent as total');

  const totalIncome = Number(incomeRow.total || 0);
  const totalExpenses = Number(expenseRow.total || 0);
  const pendingExpenses = Number(pendingRow.total || 0);
  const netBalance = totalIncome - totalExpenses;

  // Fund breakdown
  const fundBreakdown = await db('dfb_funds')
    .select('fund_id', 'fund_name', 'fund_category', 'current_balance', 'target_goal');

  // Monthly income trend (last 12 months)
  const monthlyIncome = await db('dfb_transactions')
    .where({ status: 'Completed' })
    .where('settled_at', '>=', db.raw("DATE_SUB(NOW(), INTERVAL 12 MONTH)"))
    .groupByRaw("DATE_FORMAT(settled_at, '%Y-%m')")
    .select(db.raw("DATE_FORMAT(settled_at, '%Y-%m') as month"), db.raw('SUM(net_amount) as total'))
    .orderBy('month', 'asc');

  res.json({
    success: true,
    data: {
      summary: { totalIncome, totalExpenses, pendingExpenses, netBalance },
      fundBreakdown,
      monthlyIncome,
    }
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/reports/volunteers — Volunteer hours summary
// ---------------------------------------------------------------------------
reportsRouter.get('/volunteers', async (req: Request, res: Response) => {
  const rows = await db('dfb_timesheets as t')
    .join('dfb_volunteers as v', 't.volunteer_id', 'v.volunteer_id')
    .where('t.status', 'approved')
    .groupBy('t.volunteer_id')
    .select(
      'v.volunteer_id',
      db.raw("CONCAT(v.first_name, ' ', v.last_name) as name"),
      db.raw('SUM(t.duration_minutes) as total_minutes'),
      db.raw('COUNT(t.timesheet_id) as timesheet_count')
    )
    .orderBy('total_minutes', 'desc');

  rows.forEach((r: any) => {
    r.total_hours = Math.round((r.total_minutes || 0) / 60 * 10) / 10;
  });

  res.json({ success: true, data: rows });
});
