import { Router, Request, Response } from 'express';
import { body, validationResult } from 'express-validator';
import { db } from '../config/database';
import { authenticate, requireRoles } from '../middleware/auth.middleware';
import { v4 as uuidv4 } from 'uuid';

export const advancedRouter = Router();

// ---------------------------------------------------------------------------
// 1. P2P Campaigns (dfb_p2p_campaigns)
// ---------------------------------------------------------------------------
advancedRouter.get('/p2p', async (req: Request, res: Response) => {
  const campaigns = await db('dfb_p2p_campaigns')
    .where({ status: 'active' })
    .orderBy('created_at', 'desc')
    .select('p2p_id', 'title', 'slug', 'goal_amount', 'raised_amount', 'end_date', 'cover_image_url');
  res.json({ success: true, data: campaigns });
});

advancedRouter.post('/p2p',
  authenticate,
  [
    body('parentCampaignId').isInt().toInt(),
    body('title').isString().notEmpty().isLength({ max: 120 }),
    body('slug').isString().notEmpty().isLength({ max: 120 }).matches(/^[a-z0-9-]+$/),
    body('personalStory').isString().notEmpty(),
    body('goalAmount').isDecimal().toFloat().custom((v) => v > 0),
    body('endDate').optional().isISO8601().toDate()
  ],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(422).json({ success: false, errors: errors.array() }); return; }

    const { parentCampaignId, title, slug, personalStory, goalAmount, endDate } = req.body;

    // Check slug uniqueness
    const existing = await db('dfb_p2p_campaigns').where({ slug }).first();
    if (existing) {
      res.status(409).json({ success: false, message: 'Slug is already in use' }); return;
    }

    const [p2pId] = await db('dfb_p2p_campaigns').insert({
      parent_campaign_id: parentCampaignId,
      creator_user_id: req.user!.userId,
      title,
      slug,
      personal_story: personalStory,
      goal_amount: goalAmount,
      status: 'draft', 
      end_date: endDate || null,
      created_at: new Date() // Wait for admin approval
    });

    res.status(201).json({ success: true, message: 'P2P Campaign created (Pending Approval)', p2pId });
});

// ---------------------------------------------------------------------------
// 2. Gamification (dfb_user_badges)
// ---------------------------------------------------------------------------
advancedRouter.get('/badges/me',
  authenticate,
  async (req: Request, res: Response): Promise<void> => {
    // Note: Assuming JWT explicitly contains donorId reference if the user is a linked donor.
    const user = await db('dfb_users').where({ user_id: req.user!.userId }).first('donor_id');
    const donorId = user?.donor_id;

    if (!donorId) {
      res.status(404).json({ success: false, message: 'No linked donor profile found for this user.' });
      return;
    }

    const badges = await db('dfb_user_badges as ub')
      .join('dfb_badges as b', 'ub.badge_id', 'b.badge_id')
      .where('ub.user_id', donorId)
      .select('b.badge_name', 'b.description', 'b.icon_url', 'ub.awarded_at')
      .orderBy('ub.awarded_at', 'desc');

    res.json({ success: true, data: badges });
});

// ---------------------------------------------------------------------------
// 3. AI Insights Stub (dfb_donors.wealth_screening_consent)
// ---------------------------------------------------------------------------
advancedRouter.get('/insights/wealth/:donorId',
  authenticate,
  requireRoles('Super Admin', 'Admin'),
  async (req: Request, res: Response): Promise<void> => {
    const donorIdStr = Array.isArray(req.params.donorId) ? req.params.donorId[0] : req.params.donorId;
    const donorId = parseInt(donorIdStr, 10);
    const donor = await db('dfb_donors').where({ donor_id: donorId }).first();

    if (!donor) {
       res.status(404).json({ success: false, message: 'Donor not found' });
       return;
    }

    if (!donor.wealth_screening_consent) {
      res.status(403).json({ 
        success: false, 
        message: 'Consent Denied. Donor has not explicitly opted into wealth profiling.' 
      });
      return;
    }

    // Stub: In reality, call WealthEngine API here
    res.json({
      success: true,
      data: {
        estimated_net_worth: '$1M - $5M',
        propensity_to_give: 'High',
        major_gift_prospect: true,
        last_screened: new Date().toISOString()
      }
    });
});
