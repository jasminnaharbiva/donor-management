import { Router, Request, Response } from 'express';
import { body, query, param, validationResult } from 'express-validator';
import { db } from '../config/database';
import { authenticate, requireRoles } from '../middleware/auth.middleware';
import { consumeAllocations } from '../services/fifo.service';
import { createIntegrityHash } from '../services/integrity.service';
import { writeAuditLog } from '../services/audit.service';
import { sendExpenseApproved, sendExpenseRejected } from '../services/email.service';
import { decrypt } from '../utils/crypto';
import { v4 as uuidv4 } from 'uuid';

export const expenseRouter = Router();

// ---------------------------------------------------------------------------
// GET /api/v1/expenses
// ---------------------------------------------------------------------------
expenseRouter.get(
  '/',
  authenticate,
  requireRoles('Super Admin', 'Admin', 'Finance'),
  [
    query('status').optional().isIn(['Pending', 'Approved', 'Rejected', 'Cancelled']),
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 100 }).toInt(),
  ],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(422).json({ success: false, errors: errors.array() }); return; }

    const page  = Number(req.query.page)  || 1;
    const limit = Number(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    let q = db('dfb_expenses as e')
      .join('dfb_funds as f', 'e.fund_id', 'f.fund_id')
      .leftJoin('dfb_projects as p', 'e.project_id', 'p.project_id')
      .leftJoin('dfb_volunteers as v', 'e.submitted_by_volunteer_id', 'v.volunteer_id')
      .whereNull('e.deleted_at');

    if (req.query.status) q = q.where('e.status', req.query.status as string);

    const [{ total }] = await q.clone().count('e.expense_id as total');
    const expenses = await q
      .orderBy('e.created_at', 'desc')
      .limit(limit).offset(offset)
      .select('e.*', 'f.fund_name', 'p.project_name', db.raw("CONCAT(v.first_name, ' ', v.last_name) as volunteer_name"));

    res.json({
      success: true,
      data:    expenses,
      meta:    { page, limit, total: Number(total), totalPages: Math.ceil(Number(total) / limit) },
    });
  }
);

// ---------------------------------------------------------------------------
// POST /api/v1/expenses — Submit an expense (volunteers or admins)
// ---------------------------------------------------------------------------
expenseRouter.post(
  '/',
  authenticate,
  [
    body('fundId').isInt({ min: 1 }).toInt(),
    body('projectId').optional().isInt({ min: 1 }).toInt(),
    body('amountSpent').isDecimal().toFloat(),
    body('purpose').trim().notEmpty().isLength({ max: 500 }),
    body('vendorName').optional().trim().isLength({ max: 120 }),
    body('receiptUrl').optional().isURL(),
    body('spentTimestamp').optional().isISO8601().toDate(),
    body('gpsLat').optional().isDecimal(),
    body('gpsLon').optional().isDecimal(),
  ],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(422).json({ success: false, errors: errors.array() }); return; }

    const {
      fundId, projectId, amountSpent, purpose, vendorName, receiptUrl,
      spentTimestamp, gpsLat, gpsLon,
    } = req.body;

    const [fund, submitterUser] = await Promise.all([
      db('dfb_funds').where({ fund_id: fundId }).first(),
      db('dfb_users').where({ user_id: req.user!.userId }).first('volunteer_id'),
    ]);

    if (!fund) { res.status(404).json({ success: false, message: 'Fund not found' }); return; }

    if (projectId) {
      const project = await db('dfb_projects').where({ project_id: projectId }).first('project_id', 'fund_id');
      if (!project) {
        res.status(404).json({ success: false, message: 'Project not found' });
        return;
      }
      if (Number(project.fund_id) !== Number(fundId)) {
        res.status(422).json({ success: false, message: 'Selected project does not belong to the selected fund' });
        return;
      }
    }

    if (Number(fund.current_balance) < amountSpent) {
      res.status(409).json({
        success: false,
        message: `Insufficient fund balance. Available: ${fund.current_balance}`,
      });
      return;
    }

    const expenseId = uuidv4();

    await db.transaction(async (trx) => {
      await trx('dfb_expenses').insert({
        expense_id:                expenseId,
        fund_id:                   fundId,
        project_id:                projectId || null,
        amount_spent:              amountSpent,
        vendor_name:               vendorName,
        purpose,
        receipt_url:               receiptUrl,
        gps_lat:                   gpsLat || null,
        gps_lon:                   gpsLon || null,
        spent_timestamp:           spentTimestamp || new Date(),
        submitted_by_volunteer_id: submitterUser?.volunteer_id || null,
        status:                    'Pending',
        created_at:                new Date(),
      });
    });

    await writeAuditLog({
      tableAffected: 'dfb_expenses',
      recordId:      expenseId,
      actionType:    'INSERT',
      newPayload:    { fundId, projectId: projectId || null, amountSpent, purpose },
      actorId:       req.user!.userId,
      ipAddress:     req.ip,
    });

    res.status(201).json({ success: true, message: 'Expense submitted for approval', expenseId });
  }
);

// ---------------------------------------------------------------------------
// POST /api/v1/expenses/:id/approve — Approve and trigger FIFO allocation
// ---------------------------------------------------------------------------
expenseRouter.post(
  '/:id/approve',
  authenticate,
  requireRoles('Super Admin', 'Admin', 'Finance'),
  param('id').isUUID(),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const expense = await db('dfb_expenses').where({ expense_id: req.params.id }).first();

      if (!expense) { res.status(404).json({ success: false, message: 'Expense not found' }); return; }
      if (expense.status !== 'Pending') {
        res.status(409).json({ success: false, message: `Cannot approve expense in status: ${expense.status}` });
        return;
      }

      // FIFO allocation consumption
      await consumeAllocations(expense.fund_id, Number(expense.amount_spent), expense.expense_id);

      // Create integrity hash for this expense
      const hashId = await createIntegrityHash({
        recordType: 'expense',
        recordId:   expense.expense_id,
        payload:    {
          expense_id:   expense.expense_id,
          fund_id:      expense.fund_id,
          amount_spent: expense.amount_spent,
          approved_by:  req.user!.userId,
          approved_at:  new Date().toISOString(),
        },
      });

      await db('dfb_expenses').where({ expense_id: req.params.id }).update({
        status:              'Approved',
        approved_by:         req.user!.userId,
        approved_at:         new Date(),
        integrity_hash_id:   hashId,
      });

      // Update project budget_spent and budget_remaining if linked to a project
      if (expense.project_id) {
        await db('dfb_projects').where({ project_id: expense.project_id }).update({
          budget_spent:     db.raw('budget_spent + ?', [Number(expense.amount_spent)]),
          updated_at:       new Date(),
        });
      }

      await writeAuditLog({
        tableAffected: 'dfb_expenses',
        recordId:      expense.expense_id,
        actionType:    'APPROVE',
        actorId:       req.user!.userId,
        actorRole:     req.user!.roleName,
        ipAddress:     req.ip,
      });

      // Send email notification to the volunteer (non-blocking)
      try {
        const vol = await db('dfb_volunteers as v')
          .join('dfb_users as u', 'v.volunteer_id', 'u.volunteer_id')
          .where('v.volunteer_id', expense.submitted_by_volunteer_id)
          .first('u.email', 'v.first_name');
        if (vol?.email) {
          const email = (() => { try { return decrypt(vol.email); } catch { return null; } })();
          if (email) {
            sendExpenseApproved({
              toEmail: email,
              firstName: vol.first_name || 'Volunteer',
              amount: Number(expense.amount_spent),
              purpose: expense.purpose || 'Expense',
              expenseId: expense.expense_id,
            }).catch(() => {});
          }
        }
      } catch { /* non-critical */ }

      res.json({ success: true, message: 'Expense approved and allocations consumed (FIFO)' });
    } catch (error: any) {
      const message = String(error?.message || 'Failed to approve expense');
      if (message.includes('Insufficient fund balance')) {
        res.status(409).json({ success: false, message });
        return;
      }

      console.error('[expenses/approve] Failed to approve expense:', error);
      res.status(500).json({ success: false, message: 'Failed to approve expense' });
    }
  }
);

// ---------------------------------------------------------------------------
// POST /api/v1/expenses/:id/reject
// ---------------------------------------------------------------------------
expenseRouter.post(
  '/:id/reject',
  authenticate,
  requireRoles('Super Admin', 'Admin', 'Finance'),
  param('id').isUUID(),
  body('reason').trim().notEmpty().isLength({ max: 500 }),
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(422).json({ success: false, errors: errors.array() }); return; }

    const expense = await db('dfb_expenses').where({ expense_id: req.params.id }).first();
    if (!expense) { res.status(404).json({ success: false, message: 'Expense not found' }); return; }
    if (expense.status !== 'Pending') {
      res.status(409).json({ success: false, message: `Cannot reject expense in status: ${expense.status}` });
      return;
    }

    await db('dfb_expenses').where({ expense_id: req.params.id }).update({
      status: 'Rejected',
      approved_by: req.user!.userId,
      approved_at: new Date(),
    });

    await writeAuditLog({
      tableAffected: 'dfb_expenses',
      recordId:      expense.expense_id,
      actionType:    'REJECT',
      newPayload:    { reason: req.body.reason },
      actorId:       req.user!.userId,
      ipAddress:     req.ip,
    });

    // Send rejection email (non-blocking)
    try {
      const vol = await db('dfb_volunteers as v')
        .join('dfb_users as u', 'v.volunteer_id', 'u.volunteer_id')
        .where('v.volunteer_id', expense.submitted_by_volunteer_id)
        .first('u.email', 'v.first_name');
      if (vol?.email) {
        const email = (() => { try { return decrypt(vol.email); } catch { return null; } })();
        if (email) {
          sendExpenseRejected({
            toEmail: email,
            firstName: vol.first_name || 'Volunteer',
            amount: Number(expense.amount_spent),
            purpose: expense.purpose || 'Expense',
            reason: req.body.reason,
            expenseId: expense.expense_id,
          }).catch(() => {});
        }
      }
    } catch { /* non-critical */ }

    res.json({ success: true, message: 'Expense rejected' });
  }
);
