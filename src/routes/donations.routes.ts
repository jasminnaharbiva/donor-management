import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { db } from '../config/database';
import { authenticate, requireRoles } from '../middleware/auth.middleware';
import { writeAuditLog } from '../services/audit.service';
import { createIntegrityHash } from '../services/integrity.service';
import { fireNotification } from '../services/notification.engine';
import { decrypt } from '../utils/crypto';
import { v4 as uuidv4 } from 'uuid';

export const donationRouter = Router();

// ---------------------------------------------------------------------------
// POST /api/v1/donations — Create a donation (admin-entry or direct)
// ---------------------------------------------------------------------------
donationRouter.post(
  '/',
  authenticate,
  [
    body('donorId').optional().isInt({ min: 1 }).toInt(),
    body('amount').isDecimal().toFloat().custom(v => v > 0),
    body('currency').optional().isLength({ max: 3 }).toUpperCase(),
    body('paymentMethod').isIn([
      'card','paypal','bkash','sslcommerz','nagad','rocket',
      'apple_pay','google_pay','crypto','bank_transfer','cash','check','in_kind','daf'
    ]),
    body('fundId').optional().isInt({ min: 1 }).toInt(),
    body('campaignId').optional().isInt({ min: 1 }).toInt(),
    body('gatewayTxnId').optional().trim().isLength({ max: 255 }),
    body('notes').optional().trim().isLength({ max: 500 }),
  ],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(422).json({ success: false, errors: errors.array() }); return; }

    const {
      donorId, amount, currency = 'BDT', paymentMethod,
      fundId, campaignId, gatewayTxnId, gatewayFee = 0,
    } = req.body;

    const netAmount  = amount - gatewayFee;
    const txnId      = uuidv4();

    // Determine target fund
    let targetFundId = fundId;
    if (!targetFundId && campaignId) {
      const campaign = await db('dfb_campaigns').where({ campaign_id: campaignId }).first('fund_id');
      targetFundId   = campaign?.fund_id;
    }
    if (!targetFundId) {
      const defaultFund = await db('dfb_funds').where({ fund_name: 'General Fund' }).first('fund_id');
      targetFundId = defaultFund?.fund_id;
    }

    await db.transaction(async (trx) => {
      // Create integrity hash first
      const hashId = await createIntegrityHash({
        recordType: 'transaction',
        recordId:   txnId,
        payload:    { txnId, donorId, amount, currency, paymentMethod, fundId: targetFundId },
      });

      // Insert transaction
      await trx('dfb_transactions').insert({
        transaction_id:   txnId,
        donor_id:         donorId || null,
        amount,
        currency,
        currency_type:    'fiat',
        payment_method:   paymentMethod,
        gateway_txn_id:   gatewayTxnId || null,
        gateway_fee:      gatewayFee,
        net_amount:       netAmount,
        status:           'Completed',
        settled_at:       new Date(),
        integrity_hash_id: hashId,
        created_at:       new Date(),
      });

      // Allocate to fund
      if (targetFundId) {
        const allocId = await trx('dfb_allocations').insert({
          transaction_id:   txnId,
          fund_id:          targetFundId,
          allocated_amount: netAmount,
          allocated_at:     new Date(),
          is_spent:         false,
        });

        // Update fund balance (denormalized counter)
        await trx('dfb_funds').where({ fund_id: targetFundId }).increment('current_balance', netAmount);
      }

      // Update donor lifetime value
      if (donorId) {
        await trx('dfb_donors').where({ donor_id: donorId }).increment('lifetime_value', netAmount)
          .update({ last_donation_date: new Date(), updated_at: new Date() });
      }

      // Update campaign raised amount
      if (campaignId) {
        await trx('dfb_campaigns').where({ campaign_id: campaignId })
          .increment('raised_amount', netAmount)
          .increment('donor_count', 1);
      }
    });

    await writeAuditLog({
      tableAffected: 'dfb_transactions',
      recordId:      txnId,
      actionType:    'INSERT',
      newPayload:    { txnId, amount, currency, paymentMethod, fundId: targetFundId },
      actorId:       req.user!.userId,
      ipAddress:     req.ip,
    });

    // Send email receipt to donor (non-blocking)
    if (donorId) {
      (async () => {
        try {
          const donorRow = await db('dfb_donors as d')
            .join('dfb_users as u', 'u.user_id', 'd.user_id')
            .where('d.donor_id', donorId)
            .first('u.email as email', 'u.user_id as userId', 'd.first_name', 'd.last_name');
          const fundRow = targetFundId
            ? await db('dfb_funds').where({ fund_id: targetFundId }).first('fund_name')
            : null;
          const campaignRow = campaignId
            ? await db('dfb_campaigns').where({ campaign_id: campaignId }).first('title')
            : null;

          if (donorRow?.email) {
            const toEmail = decrypt(donorRow.email);
            await fireNotification('donation_received', {
              userId:  donorRow?.userId,
              toEmail,
              variables: {
                firstName:       donorRow.first_name || 'Donor',
                formattedAmount: new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(netAmount),
                transactionId:   txnId,
                fundName:        fundRow?.fund_name || '',
                campaignName:    campaignRow?.title || '',
                date:            new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
                currency,
                amount:          netAmount,
              },
              actionUrl:     '/donor',
              referenceType: 'transaction',
              referenceId:   txnId,
            });
          }

          // Alert admin for high-value donations (>= 10,000)
          if (netAmount >= 10000) {
            await fireNotification('high_value_donation_alert', {
              variables: {
                donorName:       donorRow ? `${donorRow.first_name} ${donorRow.last_name}` : 'Anonymous',
                formattedAmount: new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(netAmount),
                transactionId:   txnId,
                amount:          netAmount,
                currency,
              },
              actionUrl: '/admin/donations',
            });
          }
        } catch (err) {
          // Non-fatal — log but never crash the request
          console.error('[Email] Donation receipt error:', err);
        }
      })();
    }

    res.status(201).json({ success: true, transactionId: txnId, netAmount });
  }
);

// ---------------------------------------------------------------------------
// GET /api/v1/donations — list with filters
// ---------------------------------------------------------------------------
donationRouter.get(
  '/',
  authenticate,
  requireRoles('Super Admin', 'Admin', 'Finance'),
  [
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 200 }).toInt(),
    query('status').optional().isIn(['Pending','Completed','Failed','Refunded','Chargeback','Flagged']),
    query('method').optional().trim(),
    query('from').optional().isISO8601(),
    query('to').optional().isISO8601(),
  ],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(422).json({ success: false, errors: errors.array() }); return; }

    const page  = Number(req.query.page)  || 1;
    const limit = Number(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    let q = db('dfb_transactions as t')
      .leftJoin('dfb_donors as d', 't.donor_id', 'd.donor_id');

    if (req.query.status) q = q.where('t.status', req.query.status as string);
    if (req.query.method) q = q.where('t.payment_method', req.query.method as string);
    if (req.query.from)   q = q.where('t.created_at', '>=', req.query.from as string);
    if (req.query.to)     q = q.where('t.created_at', '<=', req.query.to as string);

    const [{ total }] = await q.clone().count('t.transaction_id as total');
    const txns = await q
      .orderBy('t.created_at', 'desc')
      .limit(limit).offset(offset)
      .select(
        't.*',
        'd.first_name', 'd.last_name'
      );

    res.json({
      success: true,
      data:    txns,
      meta: {
        page, limit, total: Number(total),
        totalPages: Math.ceil(Number(total) / limit),
      },
    });
  }
);

// ---------------------------------------------------------------------------
// POST /api/v1/donations/:id/refund
// ---------------------------------------------------------------------------
donationRouter.post(
  '/:id/refund',
  authenticate,
  requireRoles('Super Admin', 'Finance'),
  param('id').isUUID(),
  body('reason').trim().notEmpty().isLength({ max: 500 }),
  async (req: Request, res: Response): Promise<void> => {
    const txn = await db('dfb_transactions').where({ transaction_id: req.params.id }).first();
    if (!txn) { res.status(404).json({ success: false, message: 'Transaction not found' }); return; }
    if (txn.status !== 'Completed') {
      res.status(409).json({ success: false, message: `Cannot refund transaction in status: ${txn.status}` });
      return;
    }

    await db.transaction(async (trx) => {
      await trx('dfb_transactions').where({ transaction_id: req.params.id }).update({ status: 'Refunded' });

      // Reverse fund balance
      const alloc = await trx('dfb_allocations').where({ transaction_id: req.params.id, is_spent: false }).first();
      if (alloc) {
        await trx('dfb_funds').where({ fund_id: alloc.fund_id }).decrement('current_balance', alloc.allocated_amount);
        await trx('dfb_allocations').where({ allocation_id: alloc.allocation_id }).delete();
      }

      if (txn.donor_id) {
        await trx('dfb_donors').where({ donor_id: txn.donor_id }).decrement('lifetime_value', txn.net_amount);
      }
    });

    await writeAuditLog({
      tableAffected: 'dfb_transactions',
      recordId:      String(req.params.id),
      actionType:    'REFUND',
      newPayload:    { reason: req.body.reason },
      actorId:       req.user!.userId,
      ipAddress:     req.ip,
    });

    res.json({ success: true, message: 'Refund processed' });
  }
);

// ---------------------------------------------------------------------------
// GET /api/v1/donations/my — donor's own donation history
// ---------------------------------------------------------------------------
donationRouter.get(
  '/my',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    const user = await db('dfb_users').where({ user_id: req.user!.userId }).first('donor_id');
    if (!user?.donor_id) {
      res.json({ success: true, data: [] });
      return;
    }
    const page  = Number(req.query.page)  || 1;
    const limit = Number(req.query.limit) || 50;
    const offset = (page - 1) * limit;
    const rows = await db('dfb_transactions as t')
      .leftJoin('dfb_funds as f', 't.fund_id', 'f.fund_id')
      .leftJoin('dfb_campaigns as c', 't.campaign_id', 'c.campaign_id')
      .where({ 't.donor_id': user.donor_id })
      .orderBy('t.created_at', 'desc')
      .limit(limit)
      .offset(offset)
      .select(
        't.transaction_id as id', 't.net_amount as amount', 't.payment_method',
        't.status', 't.created_at', 'f.fund_name', 'c.title as campaign_title'
      );
    res.json({ success: true, data: rows });
  }
);
