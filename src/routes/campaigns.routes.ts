import { Router, Request, Response } from 'express';
import { body, param, query, validationResult } from 'express-validator';
import { db } from '../config/database';
import { authenticate, requireRoles } from '../middleware/auth.middleware';
import { writeAuditLog } from '../services/audit.service';

export const campaignsRouter = Router();

// ---------------------------------------------------------------------------
// GET /api/v1/campaigns — Admin list all campaigns (auth required)
// ---------------------------------------------------------------------------
campaignsRouter.get('/', authenticate, async (req: Request, res: Response): Promise<void> => {
  const page = Number(req.query.page || 1);
  const limit = Number(req.query.limit || 20);
  const offset = (page - 1) * limit;
  const status = req.query.status as string;

  let queryBuilder = db('dfb_campaigns as c')
    .leftJoin('dfb_funds as f', 'c.fund_id', 'f.fund_id')
    .leftJoin('dfb_users as u', 'c.created_by', 'u.user_id');

  if (status) queryBuilder = queryBuilder.where('c.status', status);

  const [{ total }] = await queryBuilder.clone().count('c.campaign_id as total');
  const campaigns = await queryBuilder
    .orderBy('c.created_at', 'desc')
    .limit(limit).offset(offset)
    .select(
      'c.campaign_id', 'c.title', 'c.slug', 'c.description', 'c.cover_image_url',
      'c.goal_amount', 'c.raised_amount', 'c.donor_count', 'c.start_date', 'c.end_date',
      'c.status', 'c.is_public', 'c.allow_anonymous', 'c.created_at', 'c.updated_at',
      'f.fund_name', 'c.fund_id',
      'c.meta_title', 'c.meta_description'
    );

  res.json({ success: true, data: campaigns, meta: { page, limit, total: Number(total) } });
});

// GET /api/v1/campaigns/:id — Get single campaign detail
campaignsRouter.get('/:id', authenticate, param('id').isInt().toInt(), async (req: Request, res: Response): Promise<void> => {
  const campaign = await db('dfb_campaigns').where({ campaign_id: req.params.id as any }).first();
  if (!campaign) { res.status(404).json({ success: false, message: 'Campaign not found' }); return; }
  res.json({ success: true, data: campaign });
});

// ---------------------------------------------------------------------------
// POST /api/v1/campaigns — Create campaign (admin only)
// ---------------------------------------------------------------------------
campaignsRouter.post('/',
  authenticate,
  requireRoles('Super Admin', 'Admin'),
  [
    body('title').trim().notEmpty().isLength({ max: 255 }),
    body('slug').trim().notEmpty().matches(/^[a-z0-9-]+$/).isLength({ max: 120 }),
    body('fundId').isInt({ min: 1 }).toInt(),
    body('goalAmount').isFloat({ min: 0 }).toFloat(),
    body('description').optional().isString(),
    body('startDate').optional().isISO8601().toDate(),
    body('endDate').optional().isISO8601().toDate(),
    body('isPublic').optional().isBoolean().toBoolean(),
    body('allowAnonymous').optional().isBoolean().toBoolean(),
    body('defaultAmounts').optional().isArray(),
    body('metaTitle').optional().isString().isLength({ max: 70 }),
    body('metaDescription').optional().isString().isLength({ max: 160 }),
  ],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(422).json({ success: false, errors: errors.array() }); return; }

    const existing = await db('dfb_campaigns').where({ slug: req.body.slug }).first();
    if (existing) { res.status(409).json({ success: false, message: 'Slug already in use' }); return; }

    const [campaignId] = await db('dfb_campaigns').insert({
      title: req.body.title,
      slug: req.body.slug,
      fund_id: req.body.fundId,
      goal_amount: req.body.goalAmount,
      raised_amount: 0,
      donor_count: 0,
      description: req.body.description || null,
      start_date: req.body.startDate || null,
      end_date: req.body.endDate || null,
      status: 'draft',
      is_public: req.body.isPublic ?? false,
      allow_anonymous: req.body.allowAnonymous ?? true,
      default_amounts: req.body.defaultAmounts ? JSON.stringify(req.body.defaultAmounts) : JSON.stringify([500, 1000, 2500, 5000]),
      meta_title: req.body.metaTitle || null,
      meta_description: req.body.metaDescription || null,
      created_by: req.user!.userId,
      created_at: new Date(),
      updated_at: new Date(),
    });

    await writeAuditLog({
      tableAffected: 'dfb_campaigns',
      recordId: String(campaignId),
      actionType: 'INSERT',
      newPayload: { title: req.body.title, fund_id: req.body.fundId },
      actorId: req.user!.userId,
      ipAddress: req.ip,
    });

    res.status(201).json({ success: true, message: 'Campaign created', campaignId });
  }
);

// ---------------------------------------------------------------------------
// PUT /api/v1/campaigns/:id — Update campaign
// ---------------------------------------------------------------------------
campaignsRouter.put('/:id',
  authenticate,
  requireRoles('Super Admin', 'Admin'),
  param('id').isInt().toInt(),
  [
    body('title').optional().trim().notEmpty().isLength({ max: 255 }),
    body('status').optional().isIn(['draft', 'active', 'paused', 'completed', 'archived']),
    body('goalAmount').optional().isFloat({ min: 0 }).toFloat(),
    body('isPublic').optional().isBoolean().toBoolean(),
    body('description').optional().isString(),
    body('endDate').optional().isISO8601().toDate(),
  ],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(422).json({ success: false, errors: errors.array() }); return; }

    const id = req.params.id as any;
    const existing = await db('dfb_campaigns').where({ campaign_id: id }).first();
    if (!existing) { res.status(404).json({ success: false, message: 'Campaign not found' }); return; }

    const updateData: any = { updated_at: new Date() };
    if (req.body.title !== undefined) updateData.title = req.body.title;
    if (req.body.status !== undefined) updateData.status = req.body.status;
    if (req.body.goalAmount !== undefined) updateData.goal_amount = req.body.goalAmount;
    if (req.body.isPublic !== undefined) updateData.is_public = req.body.isPublic;
    if (req.body.description !== undefined) updateData.description = req.body.description;
    if (req.body.endDate !== undefined) updateData.end_date = req.body.endDate;
    if (req.body.coverImageUrl !== undefined) updateData.cover_image_url = req.body.coverImageUrl;
    if (req.body.metaTitle !== undefined) updateData.meta_title = req.body.metaTitle;
    if (req.body.metaDescription !== undefined) updateData.meta_description = req.body.metaDescription;

    await db('dfb_campaigns').where({ campaign_id: id }).update(updateData);

    await writeAuditLog({
      tableAffected: 'dfb_campaigns',
      recordId: String(id),
      actionType: 'UPDATE',
      oldPayload: existing,
      newPayload: updateData,
      actorId: req.user!.userId,
      ipAddress: req.ip,
    });

    res.json({ success: true, message: 'Campaign updated' });
  }
);

// ---------------------------------------------------------------------------
// DELETE /api/v1/campaigns/:id — Archive campaign (soft delete)
// ---------------------------------------------------------------------------
campaignsRouter.delete('/:id',
  authenticate,
  requireRoles('Super Admin'),
  param('id').isInt().toInt(),
  async (req: Request, res: Response): Promise<void> => {
    const id = req.params.id as any;
    const campaign = await db('dfb_campaigns').where({ campaign_id: id }).first();
    if (!campaign) { res.status(404).json({ success: false, message: 'Campaign not found' }); return; }

    await db('dfb_campaigns').where({ campaign_id: id }).update({ status: 'archived', updated_at: new Date() });

    await writeAuditLog({
      tableAffected: 'dfb_campaigns',
      recordId: String(id),
      actionType: 'DELETE',
      oldPayload: { title: campaign.title },
      actorId: req.user!.userId,
      ipAddress: req.ip,
    });

    res.json({ success: true, message: 'Campaign archived' });
  }
);
