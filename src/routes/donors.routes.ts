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
