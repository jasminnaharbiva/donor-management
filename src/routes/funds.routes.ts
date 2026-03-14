import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { db } from '../config/database';
import { authenticate, requirePermission } from '../middleware/auth.middleware';
import { writeAuditLog } from '../services/audit.service';
import { v4 as uuidv4 } from 'uuid';

export const fundsRouter = Router();

function normalizeFundCategory(value: string): string {
  const valid = ['Zakat', 'Sadaqah', 'Waqf', 'General', 'Restricted', 'Emergency'];
  if (valid.includes(value)) return value;
  return 'General';
}

const PAYMENT_METHODS = [
  'card', 'paypal', 'bkash', 'sslcommerz', 'nagad', 'rocket',
  'apple_pay', 'google_pay', 'crypto', 'bank_transfer', 'cash', 'check', 'in_kind', 'daf',
];

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
// GET /api/v1/funds/admin-summary — Comprehensive fund balances (admin/finance)
// ---------------------------------------------------------------------------
fundsRouter.get('/admin-summary', authenticate, requirePermission('funds', 'view', ['Super Admin', 'Admin', 'Finance']), async (_req: Request, res: Response): Promise<void> => {
  const funds = await db('dfb_funds').orderBy('fund_name', 'asc').select('*');

  const fundIds = funds.map((fund: any) => fund.fund_id);
  if (!fundIds.length) {
    res.json({ success: true, data: [] });
    return;
  }

  const [allocationRows, approvedExpensesRows, pendingExpensesRows, sourceRows] = await Promise.all([
    db('dfb_allocations')
      .whereIn('fund_id', fundIds)
      .groupBy('fund_id')
      .select('fund_id')
      .sum('allocated_amount as total_allocated')
      .sum(db.raw('CASE WHEN is_spent = 0 AND expense_id IS NULL THEN allocated_amount ELSE 0 END as unspent_allocations')),
    db('dfb_expenses')
      .whereIn('fund_id', fundIds)
      .where({ status: 'Approved' })
      .whereNull('deleted_at')
      .groupBy('fund_id')
      .select('fund_id')
      .sum('amount_spent as approved_spent')
      .count('expense_id as approved_count'),
    db('dfb_expenses')
      .whereIn('fund_id', fundIds)
      .where({ status: 'Pending' })
      .whereNull('deleted_at')
      .groupBy('fund_id')
      .select('fund_id')
      .sum('amount_spent as pending_spent')
      .count('expense_id as pending_count'),
    db('dfb_allocations as a')
      .join('dfb_transactions as t', 'a.transaction_id', 't.transaction_id')
      .whereIn('a.fund_id', fundIds)
      .groupBy('a.fund_id')
      .select('a.fund_id')
      .sum(db.raw("CASE WHEN t.gateway_txn_id LIKE 'manual-entry-%' THEN a.allocated_amount ELSE 0 END as manual_entry_total"))
      .sum(db.raw('CASE WHEN t.gateway_txn_id LIKE ? THEN a.allocated_amount ELSE 0 END as fundraising_total', ['fundraising-%']))
      .sum(db.raw("CASE WHEN t.payment_method IN ('card','paypal','bkash','sslcommerz','nagad','rocket','apple_pay','google_pay') AND (t.gateway_txn_id IS NULL OR (t.gateway_txn_id NOT LIKE 'manual-entry-%' AND t.gateway_txn_id NOT LIKE 'fundraising-%')) THEN a.allocated_amount ELSE 0 END as payment_panel_total"))
      .sum(db.raw("CASE WHEN t.donor_id IS NOT NULL AND (t.gateway_txn_id IS NULL OR (t.gateway_txn_id NOT LIKE 'manual-entry-%' AND t.gateway_txn_id NOT LIKE 'fundraising-%')) AND t.payment_method NOT IN ('card','paypal','bkash','sslcommerz','nagad','rocket','apple_pay','google_pay') THEN a.allocated_amount ELSE 0 END as donor_giving_total")),
  ]);

  const allocationMap = new Map<number, any>();
  const approvedMap = new Map<number, any>();
  const pendingMap = new Map<number, any>();
  const sourceMap = new Map<number, any>();

  allocationRows.forEach((row: any) => allocationMap.set(Number(row.fund_id), row));
  approvedExpensesRows.forEach((row: any) => approvedMap.set(Number(row.fund_id), row));
  pendingExpensesRows.forEach((row: any) => pendingMap.set(Number(row.fund_id), row));
  sourceRows.forEach((row: any) => sourceMap.set(Number(row.fund_id), row));

  const enriched = funds.map((fund: any) => {
    const alloc = allocationMap.get(Number(fund.fund_id));
    const approved = approvedMap.get(Number(fund.fund_id));
    const pending = pendingMap.get(Number(fund.fund_id));
    const source = sourceMap.get(Number(fund.fund_id));
    const verifiedUnspent = Number(alloc?.unspent_allocations || 0);
    const currentBalance = Number(fund.current_balance || 0);

    return {
      ...fund,
      total_allocated: Number(alloc?.total_allocated || 0),
      verified_unspent_allocations: verifiedUnspent,
      approved_spent: Number(approved?.approved_spent || 0),
      pending_spent: Number(pending?.pending_spent || 0),
      approved_expense_count: Number(approved?.approved_count || 0),
      pending_expense_count: Number(pending?.pending_count || 0),
      donor_giving_total: Number(source?.donor_giving_total || 0),
      manual_entry_total: Number(source?.manual_entry_total || 0),
      payment_panel_total: Number(source?.payment_panel_total || 0),
      fundraising_total: Number(source?.fundraising_total || 0),
      discrepancy: currentBalance - verifiedUnspent,
    };
  });

  res.json({ success: true, data: enriched });
});

// ---------------------------------------------------------------------------
// POST /api/v1/funds — Create a fund
// ---------------------------------------------------------------------------
fundsRouter.post('/'
  , authenticate
  , requirePermission('funds', 'create', ['Super Admin', 'Admin'])
  , [
    body('fundName').trim().notEmpty().isLength({ max: 150 }),
    body('fundCategory').optional().isString().isLength({ max: 60 }),
    body('targetGoal').optional().isFloat({ min: 0 }).toFloat(),
    body('isRestricted').optional().isBoolean().toBoolean(),
    body('restrictionNote').optional().isString().isLength({ max: 500 }),
    body('openingBalance').optional().isFloat({ min: 0 }).toFloat(),
  ]
  , async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(422).json({ success: false, errors: errors.array() }); return; }

    const fundName = req.body.fundName;
    const fundCategory = normalizeFundCategory(req.body.fundCategory || 'General');
    const targetGoal = Number(req.body.targetGoal || 0);
    const openingBalance = Number(req.body.openingBalance || 0);

    const [fundId] = await db('dfb_funds').insert({
      fund_name: fundName,
      fund_category: fundCategory,
      target_goal: targetGoal,
      current_balance: openingBalance,
      is_restricted: Boolean(req.body.isRestricted),
      restriction_note: req.body.restrictionNote || null,
      created_at: new Date(),
    });

    if (openingBalance > 0) {
      const transactionId = uuidv4();
      await db('dfb_transactions').insert({
        transaction_id: transactionId,
        donor_id: null,
        amount: openingBalance,
        currency: 'BDT',
        currency_type: 'fiat',
        payment_method: 'bank_transfer',
        net_amount: openingBalance,
        status: 'Completed',
        created_at: new Date(),
      });
      await db('dfb_allocations').insert({
        transaction_id: transactionId,
        fund_id: fundId,
        allocated_amount: openingBalance,
        allocated_at: new Date(),
        is_spent: false,
      });
    }

    await writeAuditLog({
      tableAffected: 'dfb_funds',
      recordId: String(fundId),
      actionType: 'INSERT',
      newPayload: { fundName, fundCategory, targetGoal, openingBalance },
      actorId: req.user!.userId,
      actorRole: req.user!.roleName,
      ipAddress: req.ip,
    });

    res.status(201).json({ success: true, message: 'Fund created', data: { fund_id: fundId } });
  }
);

// ---------------------------------------------------------------------------
// POST /api/v1/funds/manual-entry — Manual inflow entry by admin/finance
// ---------------------------------------------------------------------------
fundsRouter.post('/manual-entry'
  , authenticate
  , requirePermission('funds', 'create', ['Super Admin', 'Admin', 'Finance'])
  , [
    body('fundId').isInt({ min: 1 }).toInt(),
    body('amount').isFloat({ min: 0.01 }).toFloat(),
    body('paymentMethod').optional().isIn(PAYMENT_METHODS),
    body('donorId').optional().isInt({ min: 1 }).toInt(),
    body('campaignId').optional().isInt({ min: 1 }).toInt(),
    body('reference').optional().isString().isLength({ max: 180 }),
  ]
  , async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(422).json({ success: false, errors: errors.array() }); return; }

    const fundId = Number(req.body.fundId);
    const amount = Number(req.body.amount);
    const donorId = req.body.donorId ? Number(req.body.donorId) : null;
    const campaignId = req.body.campaignId ? Number(req.body.campaignId) : null;
    const paymentMethod = String(req.body.paymentMethod || 'bank_transfer');
    const reference = String(req.body.reference || '').trim() || 'manual-entry';

    const fund = await db('dfb_funds').where({ fund_id: fundId }).first('fund_id', 'fund_name');
    if (!fund) { res.status(404).json({ success: false, message: 'Fund not found' }); return; }

    if (campaignId) {
      const campaign = await db('dfb_campaigns').where({ campaign_id: campaignId }).first('campaign_id');
      if (!campaign) { res.status(404).json({ success: false, message: 'Campaign not found' }); return; }
    }

    const transactionId = uuidv4();
    await db.transaction(async (trx) => {
      await trx('dfb_transactions').insert({
        transaction_id: transactionId,
        donor_id: donorId,
        amount,
        currency: 'BDT',
        currency_type: 'fiat',
        payment_method: paymentMethod,
        gateway_txn_id: `manual-entry-${Date.now()}`,
        net_amount: amount,
        status: 'Completed',
        settled_at: new Date(),
        created_at: new Date(),
      });

      await trx('dfb_allocations').insert({
        transaction_id: transactionId,
        fund_id: fundId,
        allocated_amount: amount,
        allocated_at: new Date(),
        is_spent: false,
      });

      await trx('dfb_funds').where({ fund_id: fundId }).update({
        current_balance: db.raw('current_balance + ?', [amount]),
      });

      if (donorId) {
        await trx('dfb_donors').where({ donor_id: donorId }).update({
          lifetime_value: db.raw('lifetime_value + ?', [amount]),
          last_donation_date: new Date(),
          updated_at: new Date(),
        });
      }

      if (campaignId) {
        await trx('dfb_campaigns').where({ campaign_id: campaignId }).update({
          raised_amount: db.raw('raised_amount + ?', [amount]),
          donor_count: db.raw('donor_count + ?', [1]),
          updated_at: new Date(),
        });
        await trx('dfb_transactions').where({ transaction_id: transactionId }).update({
          gateway_txn_id: `fundraising-${campaignId}-${Date.now()}`,
        });
      }
    });

    await writeAuditLog({
      tableAffected: 'dfb_transactions',
      recordId: transactionId,
      actionType: 'INSERT',
      newPayload: { fundId, amount, donorId, campaignId, paymentMethod, reference },
      actorId: req.user!.userId,
      actorRole: req.user!.roleName,
      ipAddress: req.ip,
    });

    res.status(201).json({
      success: true,
      message: 'Manual fund entry added successfully',
      data: { transaction_id: transactionId, fund_id: fundId, amount },
    });
  }
);

// ---------------------------------------------------------------------------
// PATCH /api/v1/funds/:id — Update fund profile
// ---------------------------------------------------------------------------
fundsRouter.patch('/:id'
  , authenticate
  , requirePermission('funds', 'update', ['Super Admin', 'Admin', 'Finance'])
  , [
    param('id').isInt({ min: 1 }).toInt(),
    body('fundName').optional().trim().notEmpty().isLength({ max: 150 }),
    body('fundCategory').optional().isString().isLength({ max: 60 }),
    body('targetGoal').optional().isFloat({ min: 0 }).toFloat(),
    body('isRestricted').optional().isBoolean().toBoolean(),
    body('restrictionNote').optional().isString().isLength({ max: 500 }),
  ]
  , async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(422).json({ success: false, errors: errors.array() }); return; }

    const updates: Record<string, unknown> = {};
    if (req.body.fundName !== undefined) updates.fund_name = req.body.fundName;
    if (req.body.fundCategory !== undefined) updates.fund_category = normalizeFundCategory(req.body.fundCategory);
    if (req.body.targetGoal !== undefined) updates.target_goal = Number(req.body.targetGoal || 0);
    if (req.body.isRestricted !== undefined) updates.is_restricted = Boolean(req.body.isRestricted);
    if (req.body.restrictionNote !== undefined) updates.restriction_note = req.body.restrictionNote || null;

    if (Object.keys(updates).length === 0) {
      res.status(422).json({ success: false, message: 'No updates provided' });
      return;
    }

    const affected = await db('dfb_funds').where({ fund_id: req.params.id as any }).update(updates);
    if (!affected) { res.status(404).json({ success: false, message: 'Fund not found' }); return; }

    await writeAuditLog({
      tableAffected: 'dfb_funds',
      recordId: String(req.params.id),
      actionType: 'UPDATE',
      newPayload: updates,
      actorId: req.user!.userId,
      actorRole: req.user!.roleName,
      ipAddress: req.ip,
    });

    res.json({ success: true, message: 'Fund updated successfully' });
  }
);

// ---------------------------------------------------------------------------
// POST /api/v1/funds/transfer — Move funds between buckets with full ledger trail
// ---------------------------------------------------------------------------
fundsRouter.post('/transfer'
  , authenticate
  , requirePermission('funds', 'approve', ['Super Admin', 'Admin', 'Finance'])
  , [
    body('sourceFundId').isInt({ min: 1 }).toInt(),
    body('targetFundId').isInt({ min: 1 }).toInt(),
    body('amount').isFloat({ min: 0.01 }).toFloat(),
    body('reason').optional().isString().isLength({ max: 500 }),
  ]
  , async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(422).json({ success: false, errors: errors.array() }); return; }

    const sourceFundId = Number(req.body.sourceFundId);
    const targetFundId = Number(req.body.targetFundId);
    const amount = Number(req.body.amount);
    const reason = req.body.reason || 'Operational fund transfer';

    if (sourceFundId === targetFundId) {
      res.status(422).json({ success: false, message: 'Source and target funds must be different' });
      return;
    }

    const [sourceFund, targetFund] = await Promise.all([
      db('dfb_funds').where({ fund_id: sourceFundId }).first('fund_id', 'fund_name', 'current_balance'),
      db('dfb_funds').where({ fund_id: targetFundId }).first('fund_id', 'fund_name', 'current_balance'),
    ]);

    if (!sourceFund || !targetFund) {
      res.status(404).json({ success: false, message: 'Source or target fund not found' });
      return;
    }

    const sourceBalance = Number(sourceFund.current_balance || 0);
    if (sourceBalance < amount) {
      res.status(409).json({ success: false, message: `Insufficient source fund balance. Available: ${sourceBalance}` });
      return;
    }

    const transferExpenseId = uuidv4();
    const transferTxnId = uuidv4();

    await db.transaction(async (trx) => {
      const available = await trx('dfb_allocations')
        .where({ fund_id: sourceFundId, is_spent: false })
        .whereNull('expense_id')
        .orderBy('allocated_at', 'asc')
        .forUpdate()
        .select('allocation_id', 'transaction_id', 'allocated_amount', 'allocated_at');

      let remaining = amount;
      for (const alloc of available) {
        if (remaining <= 0) break;
        const allocAmount = Number(alloc.allocated_amount || 0);

        if (allocAmount <= remaining) {
          await trx('dfb_allocations').where({ allocation_id: alloc.allocation_id }).update({
            is_spent: true,
            expense_id: transferExpenseId,
          });
          remaining -= allocAmount;
        } else {
          await trx('dfb_allocations').where({ allocation_id: alloc.allocation_id }).update({
            allocated_amount: remaining,
            is_spent: true,
            expense_id: transferExpenseId,
          });

          await trx('dfb_allocations').insert({
            transaction_id: alloc.transaction_id,
            fund_id: sourceFundId,
            allocated_amount: allocAmount - remaining,
            allocated_at: alloc.allocated_at,
            is_spent: false,
            expense_id: null,
          });
          remaining = 0;
        }
      }

      if (remaining > 0) {
        throw new Error(`Insufficient unspent allocation balance. Missing: ${remaining}`);
      }

      await trx('dfb_expenses').insert({
        expense_id: transferExpenseId,
        fund_id: sourceFundId,
        project_id: null,
        amount_spent: amount,
        vendor_name: 'Internal Transfer',
        purpose: `Fund transfer to ${targetFund.fund_name}: ${reason}`,
        receipt_url: null,
        spent_timestamp: new Date(),
        submitted_by_volunteer_id: null,
        approved_by: req.user!.userId,
        approved_at: new Date(),
        status: 'Approved',
        created_at: new Date(),
      });

      await trx('dfb_transactions').insert({
        transaction_id: transferTxnId,
        donor_id: null,
        amount,
        currency: 'BDT',
        currency_type: 'fiat',
        payment_method: 'bank_transfer',
        gateway_txn_id: `fund-transfer-${sourceFundId}-${targetFundId}-${Date.now()}`,
        net_amount: amount,
        status: 'Completed',
        created_at: new Date(),
      });

      await trx('dfb_allocations').insert({
        transaction_id: transferTxnId,
        fund_id: targetFundId,
        allocated_amount: amount,
        allocated_at: new Date(),
        is_spent: false,
      });

      await trx('dfb_funds').where({ fund_id: sourceFundId }).update({
        current_balance: db.raw('GREATEST(0, current_balance - ?)', [amount]),
      });

      await trx('dfb_funds').where({ fund_id: targetFundId }).update({
        current_balance: db.raw('current_balance + ?', [amount]),
      });
    });

    await writeAuditLog({
      tableAffected: 'dfb_funds',
      recordId: `${sourceFundId}->${targetFundId}`,
      actionType: 'UPDATE',
      newPayload: { transferAmount: amount, reason, sourceFundId, targetFundId },
      actorId: req.user!.userId,
      actorRole: req.user!.roleName,
      ipAddress: req.ip,
    });

    res.status(201).json({ success: true, message: 'Fund transfer completed successfully' });
  }
);

// ---------------------------------------------------------------------------
// POST /api/v1/funds/:id/reconcile — Verify and optionally fix current balance
// ---------------------------------------------------------------------------
fundsRouter.post('/:id/reconcile'
  , authenticate
  , requirePermission('funds', 'update', ['Super Admin', 'Admin', 'Finance'])
  , [
    param('id').isInt({ min: 1 }).toInt(),
    body('applyFix').optional().isBoolean().toBoolean(),
  ]
  , async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(422).json({ success: false, errors: errors.array() }); return; }

    const fund = await db('dfb_funds').where({ fund_id: req.params.id as any }).first('fund_id', 'fund_name', 'current_balance');
    if (!fund) { res.status(404).json({ success: false, message: 'Fund not found' }); return; }

    const [{ unspent }] = await db('dfb_allocations')
      .where({ fund_id: req.params.id as any, is_spent: false })
      .whereNull('expense_id')
      .sum('allocated_amount as unspent');

    const verifiedUnspent = Number(unspent || 0);
    const currentBalance = Number(fund.current_balance || 0);
    const discrepancy = currentBalance - verifiedUnspent;
    const applyFix = Boolean(req.body.applyFix);

    if (applyFix) {
      await db('dfb_funds').where({ fund_id: req.params.id as any }).update({ current_balance: verifiedUnspent });

      await writeAuditLog({
        tableAffected: 'dfb_funds',
        recordId: String(req.params.id),
        actionType: 'UPDATE',
        newPayload: { reconcileApplied: true, oldBalance: currentBalance, newBalance: verifiedUnspent, discrepancy },
        actorId: req.user!.userId,
        actorRole: req.user!.roleName,
        ipAddress: req.ip,
      });
    }

    res.json({
      success: true,
      data: {
        fund_id: fund.fund_id,
        fund_name: fund.fund_name,
        current_balance: currentBalance,
        verified_unspent: verifiedUnspent,
        discrepancy,
        fixed: applyFix,
      },
    });
  }
);

// ---------------------------------------------------------------------------
// DELETE /api/v1/funds/:id — Delete a fund (when safe)
// ---------------------------------------------------------------------------
fundsRouter.delete('/:id'
  , authenticate
  , requirePermission('funds', 'delete', ['Super Admin', 'Admin'])
  , param('id').isInt({ min: 1 }).toInt()
  , async (req: Request, res: Response): Promise<void> => {
    const fundId = Number(req.params.id);
    const fund = await db('dfb_funds').where({ fund_id: fundId }).first('fund_id', 'fund_name', 'current_balance');
    if (!fund) { res.status(404).json({ success: false, message: 'Fund not found' }); return; }

    const [allocCount, expenseCount, campaignCount, projectCount] = await Promise.all([
      db('dfb_allocations').where({ fund_id: fundId }).count('allocation_id as total').first(),
      db('dfb_expenses').where({ fund_id: fundId }).whereNull('deleted_at').count('expense_id as total').first(),
      db('dfb_campaigns').where({ fund_id: fundId }).count('campaign_id as total').first(),
      db('dfb_projects').where({ fund_id: fundId }).count('project_id as total').first(),
    ]);

    const hasReferences = Number((allocCount as any)?.total || 0) > 0
      || Number((expenseCount as any)?.total || 0) > 0
      || Number((campaignCount as any)?.total || 0) > 0
      || Number((projectCount as any)?.total || 0) > 0;

    if (hasReferences || Number(fund.current_balance || 0) > 0) {
      res.status(409).json({
        success: false,
        message: 'Fund cannot be deleted because it has linked records or non-zero balance. Transfer/reconcile funds first.',
      });
      return;
    }

    await db('dfb_funds').where({ fund_id: fundId }).delete();

    await writeAuditLog({
      tableAffected: 'dfb_funds',
      recordId: String(fundId),
      actionType: 'DELETE',
      oldPayload: { fundName: fund.fund_name },
      actorId: req.user!.userId,
      actorRole: req.user!.roleName,
      ipAddress: req.ip,
    });

    res.json({ success: true, message: 'Fund deleted successfully' });
  }
);

// ---------------------------------------------------------------------------
// GET /api/v1/funds/:id/ledger — Incoming allocations + outgoing approved expenses
// ---------------------------------------------------------------------------
fundsRouter.get('/:id/ledger'
  , authenticate
  , requirePermission('funds', 'view', ['Super Admin', 'Admin', 'Finance'])
  , param('id').isInt({ min: 1 }).toInt()
  , async (req: Request, res: Response): Promise<void> => {
    const fundId = req.params.id as any;
    const fund = await db('dfb_funds').where({ fund_id: fundId }).first('fund_id', 'fund_name');
    if (!fund) { res.status(404).json({ success: false, message: 'Fund not found' }); return; }

    const [incoming, outgoing] = await Promise.all([
      db('dfb_allocations as a')
        .join('dfb_transactions as t', 'a.transaction_id', 't.transaction_id')
        .where({ 'a.fund_id': fundId })
        .orderBy('a.allocated_at', 'desc')
        .limit(200)
        .select('a.allocation_id', 'a.allocated_amount', 'a.allocated_at', 'a.is_spent', 't.transaction_id', 't.payment_method', 't.status as transaction_status'),
      db('dfb_expenses as e')
        .where({ fund_id: fundId, status: 'Approved' })
        .whereNull('deleted_at')
        .orderBy('approved_at', 'desc')
        .limit(200)
        .select('expense_id', 'amount_spent', 'vendor_name', 'purpose', 'project_id', 'spent_timestamp', 'approved_at'),
    ]);

    res.json({ success: true, data: { fund, incoming_allocations: incoming, approved_expenses: outgoing } });
  }
);

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
  requirePermission('funds', 'view', ['Super Admin', 'Admin', 'Finance']),
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
