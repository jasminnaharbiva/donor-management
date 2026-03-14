import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { createHash } from 'crypto';

import { db } from '../config/database';
import { authenticate, requireRoles } from '../middleware/auth.middleware';
import { writeAuditLog } from '../services/audit.service';
import { decrypt } from '../utils/crypto';

export const privacyRouter = Router();

const REQUEST_TYPES = [
  'access',
  'portability',
  'erasure',
  'rectification',
  'restriction',
  'objection',
  'opt_out_marketing',
  'opt_out_sale',
] as const;

const REQUEST_STATUSES = ['pending', 'in_progress', 'completed', 'rejected'] as const;
const CONSENT_STATUSES = ['granted', 'withdrawn'] as const;
const LAWFUL_BASES = [
  'consent',
  'contract',
  'legal_obligation',
  'vital_interest',
  'public_task',
  'legitimate_interest',
] as const;

const mapValidationErrors = (req: Request, res: Response): boolean => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(422).json({ success: false, errors: errors.array() });
    return true;
  }
  return false;
};

const resolveSubjectType = async (userId: string): Promise<'donor' | 'volunteer' | 'unknown'> => {
  const user = await db('dfb_users').where({ user_id: userId }).first('donor_id', 'volunteer_id');
  if (!user) return 'unknown';
  if (user.donor_id) return 'donor';
  if (user.volunteer_id) return 'volunteer';
  return 'unknown';
};

privacyRouter.use(authenticate);

privacyRouter.post(
  '/requests',
  [
    body('requestType').isIn(REQUEST_TYPES as unknown as string[]),
    body('details').optional().isObject(),
  ],
  async (req: Request, res: Response): Promise<void> => {
    if (mapValidationErrors(req, res)) return;

    const subjectType = await resolveSubjectType(req.user!.userId);
    const details = req.body.details ? JSON.stringify(req.body.details) : null;

    const [requestId] = await db('dfb_data_subject_requests').insert({
      user_id: req.user!.userId,
      subject_type: subjectType,
      request_type: req.body.requestType,
      status: 'pending',
      details_json: details,
      request_ip: req.ip,
      request_user_agent: req.get('User-Agent') || null,
      created_at: new Date(),
      updated_at: new Date(),
    });

    await writeAuditLog({
      tableAffected: 'dfb_data_subject_requests',
      recordId: String(requestId),
      actionType: 'INSERT',
      newPayload: { requestType: req.body.requestType, subjectType, status: 'pending' },
      actorId: req.user!.userId,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    res.status(201).json({ success: true, data: { request_id: requestId, status: 'pending' } });
  }
);

privacyRouter.get(
  '/requests/me',
  [query('status').optional().isIn(REQUEST_STATUSES as unknown as string[])],
  async (req: Request, res: Response): Promise<void> => {
    if (mapValidationErrors(req, res)) return;

    let q = db('dfb_data_subject_requests')
      .where({ user_id: req.user!.userId })
      .orderBy('created_at', 'desc');

    if (req.query.status) {
      q = q.where({ status: String(req.query.status) });
    }

    const rows = await q;
    res.json({ success: true, data: rows });
  }
);

privacyRouter.get(
  '/requests',
  requireRoles('Super Admin', 'Admin'),
  [
    query('status').optional().isIn(REQUEST_STATUSES as unknown as string[]),
    query('requestType').optional().isIn(REQUEST_TYPES as unknown as string[]),
    query('page').optional().isInt({ min: 1 }).toInt(),
    query('limit').optional().isInt({ min: 1, max: 200 }).toInt(),
  ],
  async (req: Request, res: Response): Promise<void> => {
    if (mapValidationErrors(req, res)) return;

    const page = Number(req.query.page || 1);
    const limit = Number(req.query.limit || 25);
    const offset = (page - 1) * limit;

    let q = db('dfb_data_subject_requests as r')
      .leftJoin('dfb_users as u', 'r.user_id', 'u.user_id')
      .select(
        'r.request_id',
        'r.user_id',
        'r.subject_type',
        'r.request_type',
        'r.status',
        'r.details_json',
        'r.resolution_notes',
        'r.resolved_by',
        'r.resolved_at',
        'r.request_ip',
        'r.request_user_agent',
        'r.created_at',
        'r.updated_at',
        'u.status as user_status'
      );

    if (req.query.status) q = q.where('r.status', String(req.query.status));
    if (req.query.requestType) q = q.where('r.request_type', String(req.query.requestType));

    const [{ total }] = await q.clone().clearSelect().count('r.request_id as total');
    const data = await q.orderBy('r.created_at', 'desc').limit(limit).offset(offset);

    res.json({
      success: true,
      data,
      meta: {
        page,
        limit,
        total: Number(total || 0),
        totalPages: Math.ceil(Number(total || 0) / limit),
      },
    });
  }
);

privacyRouter.patch(
  '/requests/:id/status',
  requireRoles('Super Admin', 'Admin'),
  [
    param('id').isInt({ min: 1 }).toInt(),
    body('status').isIn(REQUEST_STATUSES as unknown as string[]),
    body('resolutionNotes').optional().isString().isLength({ max: 1000 }),
  ],
  async (req: Request, res: Response): Promise<void> => {
    if (mapValidationErrors(req, res)) return;

    const requestId = Number(req.params.id);
    const existing = await db('dfb_data_subject_requests').where({ request_id: requestId }).first();
    if (!existing) {
      res.status(404).json({ success: false, message: 'Request not found' });
      return;
    }

    const status = String(req.body.status);
    const patch: Record<string, unknown> = {
      status,
      resolution_notes: req.body.resolutionNotes || null,
      updated_at: new Date(),
    };

    if (status === 'completed' || status === 'rejected') {
      patch.resolved_at = new Date();
      patch.resolved_by = req.user!.userId;
    }

    await db('dfb_data_subject_requests').where({ request_id: requestId }).update(patch);

    await writeAuditLog({
      tableAffected: 'dfb_data_subject_requests',
      recordId: String(requestId),
      actionType: 'UPDATE',
      oldPayload: { status: existing.status },
      newPayload: { status, resolvedBy: patch.resolved_by || null },
      actorId: req.user!.userId,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    res.json({ success: true, message: 'Data-subject request updated' });
  }
);

privacyRouter.post(
  '/consents',
  [
    body('consentType').trim().notEmpty().isLength({ max: 100 }),
    body('status').isIn(CONSENT_STATUSES as unknown as string[]),
    body('lawfulBasis').optional().isIn(LAWFUL_BASES as unknown as string[]),
    body('channel').optional().isString().isLength({ max: 40 }),
    body('evidence').optional().isObject(),
  ],
  async (req: Request, res: Response): Promise<void> => {
    if (mapValidationErrors(req, res)) return;

    const user = await db('dfb_users').where({ user_id: req.user!.userId }).first('email');
    let emailHash: string | null = null;

    if (user?.email) {
      try {
        const plainEmail = decrypt(String(user.email)).trim().toLowerCase();
        emailHash = createHash('sha256').update(plainEmail).digest('hex');
      } catch {
        emailHash = null;
      }
    }

    const [consentEventId] = await db('dfb_consent_events').insert({
      user_id: req.user!.userId,
      consent_type: req.body.consentType,
      status: req.body.status,
      lawful_basis: req.body.lawfulBasis || 'consent',
      channel: req.body.channel || 'web',
      subject_email_hash: emailHash,
      evidence_json: req.body.evidence ? JSON.stringify(req.body.evidence) : null,
      captured_ip: req.ip,
      captured_user_agent: req.get('User-Agent') || null,
      created_at: new Date(),
    });

    await writeAuditLog({
      tableAffected: 'dfb_consent_events',
      recordId: String(consentEventId),
      actionType: 'INSERT',
      newPayload: { consentType: req.body.consentType, status: req.body.status },
      actorId: req.user!.userId,
      ipAddress: req.ip,
      userAgent: req.get('User-Agent'),
    });

    res.status(201).json({ success: true, data: { consent_event_id: consentEventId } });
  }
);

privacyRouter.get('/consents/me', async (req: Request, res: Response): Promise<void> => {
  const rows = await db('dfb_consent_events')
    .where({ user_id: req.user!.userId })
    .orderBy('created_at', 'desc')
    .limit(500);

  res.json({ success: true, data: rows });
});
