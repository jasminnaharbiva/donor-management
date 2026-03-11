import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { db } from '../config/database';
import { authenticate, requireRoles } from '../middleware/auth.middleware';
import { writeAuditLog } from '../services/audit.service';

export const p2pRouter = Router();

// GET /api/v1/p2p
p2pRouter.get('/', authenticate, async (req: Request, res: Response): Promise<void> => {
  const page   = Number(req.query.page  || 1);
  const limit  = Number(req.query.limit || 20);
  const offset = (page - 1) * limit;
  const status = req.query.status as string | undefined;

  let qb = db('dfb_p2p_campaigns as p')
    .leftJoin('dfb_campaigns as c', 'p.parent_campaign_id', 'c.campaign_id');

  if (status) qb = qb.where('p.status', status);

  const [{ total }] = await qb.clone().count('p.p2p_id as total');
  const campaigns = await qb.orderBy('p.created_at', 'desc').limit(limit).offset(offset)
    .select('p.*', 'c.title as parent_campaign_title');

  res.json({ success: true, data: campaigns, meta: { page, limit, total: Number(total) } });
});

// GET /api/v1/p2p/:id
p2pRouter.get('/:id', authenticate, param('id').isInt().toInt(), async (req: Request, res: Response): Promise<void> => {
  const p2p = await db('dfb_p2p_campaigns').where({ p2p_id: req.params.id as any }).first();
  if (!p2p) { res.status(404).json({ success: false, message: 'P2P campaign not found' }); return; }
  res.json({ success: true, data: p2p });
});

// GET /api/v1/p2p/by-slug/:slug — Public
p2pRouter.get('/by-slug/:slug', async (req: Request, res: Response): Promise<void> => {
  const p2p = await db('dfb_p2p_campaigns as p')
    .leftJoin('dfb_campaigns as c', 'p.parent_campaign_id', 'c.campaign_id')
    .where({ 'p.slug': req.params.slug, 'p.status': 'active' })
    .first('p.*', 'c.title as parent_campaign_title');
  if (!p2p) { res.status(404).json({ success: false, message: 'Campaign not found' }); return; }
  res.json({ success: true, data: p2p });
});

// POST /api/v1/p2p — Donor creates a P2P campaign
p2pRouter.post('/',
  authenticate,
  [
    body('parentCampaignId').isInt({ min: 1 }).toInt(),
    body('title').trim().notEmpty().isLength({ max: 200 }),
    body('slug').trim().notEmpty().matches(/^[a-z0-9-]+$/).isLength({ max: 120 }),
    body('goalAmount').optional().isFloat({ min: 0 }).toFloat(),
    body('personalStory').optional().isString(),
    body('endDate').optional().isISO8601().toDate(),
  ],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(422).json({ success: false, errors: errors.array() }); return; }

    const { parentCampaignId, title, slug, goalAmount, personalStory, endDate, coverImageUrl } = req.body;

    // Unique slug check
    const existing = await db('dfb_p2p_campaigns').where({ slug }).first();
    if (existing) { res.status(409).json({ success: false, message: 'Slug already taken' }); return; }

    const [id] = await db('dfb_p2p_campaigns').insert({
      parent_campaign_id: parentCampaignId,
      creator_user_id:    req.user!.userId,
      title,
      slug,
      goal_amount:        goalAmount || 0,
      personal_story:     personalStory || null,
      end_date:           endDate || null,
      cover_image_url:    coverImageUrl || null,
      status:             'draft',
      created_at:         new Date(),
    });

    res.status(201).json({ success: true, data: { p2p_id: id } });
  }
);

// PATCH /api/v1/p2p/:id/approve — Admin approves/rejects P2P campaign
p2pRouter.patch('/:id/approve',
  authenticate, requireRoles('Super Admin', 'Admin'),
  param('id').isInt().toInt(),
  [body('status').isIn(['active','rejected'])],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(422).json({ success: false, errors: errors.array() }); return; }

    await db('dfb_p2p_campaigns').where({ p2p_id: req.params.id as any }).update({
      status:       req.body.status,
      approved_by:  req.user!.userId,
      approved_at:  new Date(),
    });

    await writeAuditLog({ tableAffected: 'dfb_p2p_campaigns', recordId: String(req.params.id), actionType: 'UPDATE', newPayload: { status: req.body.status }, actorId: req.user!.userId });
    res.json({ success: true, message: `P2P campaign ${req.body.status}` });
  }
);
