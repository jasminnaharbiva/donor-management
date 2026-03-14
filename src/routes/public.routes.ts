import { Router, Request, Response } from 'express';
import { db } from '../config/database';
import { authenticate } from '../middleware/auth.middleware';
import { verifyChain } from '../services/integrity.service';

export const publicRouter = Router();

const DONOR_VISIBILITY_KEYS = [
  'donor_visibility.menu_items',
  'donor_visibility.impact_sections',
  'donor_visibility.update_fields',
];

type PublicVisibilityConfig = {
  impactSections: Array<{ id: string; title?: string; enabled?: boolean }>;
  updateFields: {
    showProjectLocation?: boolean;
    showNarrative?: boolean;
    showDetails?: boolean;
    showPhotos?: boolean;
  };
};

async function loadPublicVisibilityConfig(): Promise<PublicVisibilityConfig> {
  const rows = await db('dfb_system_settings')
    .whereIn('setting_key', DONOR_VISIBILITY_KEYS)
    .select('setting_key', 'setting_value');

  const map = new Map(rows.map((row: any) => [row.setting_key, row.setting_value]));
  const parseJson = <T>(key: string, fallback: T): T => {
    const raw = map.get(key);
    if (!raw) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  };

  return {
    impactSections: parseJson('donor_visibility.impact_sections', []),
    updateFields: parseJson('donor_visibility.update_fields', {
      showProjectLocation: true,
      showNarrative: true,
      showDetails: true,
      showPhotos: true,
    }),
  };
}

function isImpactSectionEnabled(config: PublicVisibilityConfig, id: string): boolean {
  const row = (config.impactSections || []).find((item) => item.id === id);
  if (!row) return true;
  return row.enabled !== false;
}

function parsePublicProof(raw: unknown): { photos: string[]; updateTitle: string | null; updateDetails: string | null } {
  if (!raw) return { photos: [], updateTitle: null, updateDetails: null };

  let parsed: any = raw;
  if (typeof raw === 'string') {
    try { parsed = JSON.parse(raw); } catch { parsed = null; }
  }

  if (!parsed || typeof parsed !== 'object') return { photos: [], updateTitle: null, updateDetails: null };
  const photos = Array.isArray(parsed.photos)
    ? parsed.photos.map((item: unknown) => String(item || '').trim()).filter(Boolean)
    : [];

  return {
    photos,
    updateTitle: parsed.update_title ? String(parsed.update_title) : null,
    updateDetails: parsed.update_details ? String(parsed.update_details) : null,
  };
}

// ---------------------------------------------------------------------------
// GET /api/v1/public/impact — Public impact stats (no auth required)
// ---------------------------------------------------------------------------
publicRouter.get('/impact', async (_req: Request, res: Response): Promise<void> => {
  const [
    totalRow, donorRow, campaignsRow, fundsRow,
  ] = await Promise.all([
    db('dfb_transactions').where({ status: 'Completed' }).sum('net_amount as total'),
    db('dfb_donors').whereNull('deleted_at').count('donor_id as total'),
    db('dfb_campaigns').where({ status: 'active', is_public: true })
      .orderBy('raised_amount', 'desc').limit(6)
      .select('campaign_id','title','slug','goal_amount','raised_amount','donor_count','cover_image_url'),
    db('dfb_funds').select('fund_name','fund_category','current_balance','target_goal'),
  ]);

  res.json({
    success: true,
    data: {
      total_raised:    Number(totalRow[0].total || 0),
      total_donors:    Number(donorRow[0].total || 0),
      top_campaigns:   campaignsRow,
      funds:           fundsRow,
      last_updated:    new Date().toISOString(),
    },
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/public/verify/:hash — Hash verification (public integrity check)
// ---------------------------------------------------------------------------
publicRouter.get('/verify/:hash', async (req: Request, res: Response): Promise<void> => {
  const hash = String(req.params.hash);

  if (!/^[a-f0-9]{64}$/i.test(hash)) {
    res.status(400).json({ success: false, message: 'Invalid hash format (must be 64-char SHA-256 hex)' });
    return;
  }

  const record = await db('dfb_integrity_hashes').where({ sha256_hash: hash }).first();

  if (!record) {
    res.json({
      success: true,
      found:   false,
      message: 'No record found for this hash. It may not exist or the data has not been recorded yet.',
    });
    return;
  }

  res.json({
    success: true,
    found:   true,
    data: {
      hash_id:        record.hash_id,
      record_type:    record.record_type,
      record_id:      record.record_id,
      sha256_hash:    record.sha256_hash,
      previous_hash:  record.previous_hash_id ? '(linked)' : '(genesis)',
      created_at:     record.created_at,
    },
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/public/campaigns — Public campaign listing
// ---------------------------------------------------------------------------
publicRouter.get('/campaigns', async (req: Request, res: Response): Promise<void> => {
  const page  = Number(req.query.page  || 1);
  const limit = Number(req.query.limit || 9);
  const offset = (page - 1) * limit;

  const [{ total }] = await db('dfb_campaigns').where({ status: 'active', is_public: true }).count('campaign_id as total');
  const campaigns   = await db('dfb_campaigns')
    .where({ status: 'active', is_public: true })
    .orderBy('created_at', 'desc')
    .limit(limit).offset(offset)
    .select(
      'campaign_id','title','slug','description','cover_image_url',
      'goal_amount','raised_amount','donor_count','start_date','end_date','video_url'
    );

  res.json({
    success: true,
    data:    campaigns,
    meta:    { page, limit, total: Number(total), totalPages: Math.ceil(Number(total) / limit) },
  });
});

// ---------------------------------------------------------------------------
// GET /api/v1/public/campaigns/:slug
// ---------------------------------------------------------------------------
publicRouter.get('/campaigns/:slug', async (req: Request, res: Response): Promise<void> => {
  const campaign = await db('dfb_campaigns as c')
    .leftJoin('dfb_funds as f', 'c.fund_id', 'f.fund_id')
    .where({ 'c.slug': req.params.slug, 'c.is_public': true })
    .first(
      'c.campaign_id', 'c.title', 'c.slug', 'c.description', 'c.cover_image_url',
      'c.goal_amount', 'c.raised_amount', 'c.donor_count', 'c.fund_id',
      'c.start_date', 'c.end_date', 'c.status',
      'c.meta_title', 'c.meta_description',
      'f.fund_name'
    );

  if (!campaign) { res.status(404).json({ success: false, message: 'Campaign not found' }); return; }

  // Recent donations for this campaign (anonymized)
  const recentDonors = await db('dfb_allocations as a')
    .join('dfb_transactions as t', 'a.transaction_id', 't.transaction_id')
    .leftJoin('dfb_donors as d', 't.donor_id', 'd.donor_id')
    .where('a.fund_id', campaign.fund_id)
    .orderBy('a.allocated_at', 'desc')
    .limit(10)
    .select('t.amount', 't.currency', 'a.allocated_at', 'd.first_name', 'd.donor_type');

  const donors = recentDonors.map((r: { amount: unknown; currency: unknown; allocated_at: unknown; first_name: string; donor_type: string }) => ({
    amount:       r.amount,
    currency:     r.currency,
    allocated_at: r.allocated_at,
    name: r.donor_type === 'Anonymous' ? 'Anonymous' : (r.first_name || 'Friend'),
  }));

  res.json({ success: true, data: { ...campaign, recent_donors: donors } });
});

// ---------------------------------------------------------------------------
// GET /api/v1/public/settings — Public system settings
// ---------------------------------------------------------------------------
publicRouter.get('/settings', async (_req: Request, res: Response): Promise<void> => {
  const settings = await db('dfb_system_settings')
    .where({ is_public: true })
    .select('setting_key', 'setting_value', 'value_type');

  const flat: Record<string, unknown> = {};
  for (const s of settings) {
    if      (s.value_type === 'integer') flat[s.setting_key] = Number(s.setting_value);
    else if (s.value_type === 'boolean') flat[s.setting_key] = s.setting_value === 'true';
    else if (s.value_type === 'json')    flat[s.setting_key] = JSON.parse(s.setting_value);
    else                                 flat[s.setting_key] = s.setting_value;
  }

  const features = await db('dfb_feature_flags').select('flag_name', 'is_enabled');
  flat['_features'] = Object.fromEntries(features.map(f => [f.flag_name, Boolean(f.is_enabled)]));

  res.json({ success: true, data: flat });
});

// ---------------------------------------------------------------------------
// GET /api/v1/public/volunteers/verify/:badgeNumber — Public volunteer verification
// ---------------------------------------------------------------------------
publicRouter.get('/volunteers/verify/:badgeNumber', async (req: Request, res: Response): Promise<void> => {
  const volunteer = await db('dfb_volunteers')
    .where({ badge_number: req.params.badgeNumber })
    .first('volunteer_id', 'first_name', 'last_name', 'badge_number', 'status', 'skills', 'city', 'country', 'created_at');
  if (!volunteer || volunteer.status !== 'active') {
    res.status(404).json({ success: false, message: 'Volunteer not found or inactive' });
    return;
  }
  res.json({ success: true, data: volunteer });
});

// ---------------------------------------------------------------------------
// GET /api/v1/public/project-updates — Public-approved project updates
// Shows update narrative + photos only (no voucher/cash memo/expense details)
// ---------------------------------------------------------------------------
publicRouter.get('/project-updates', async (req: Request, res: Response): Promise<void> => {
  const limit = Math.min(50, Math.max(1, Number(req.query.limit || 12)));
  const visibility = await loadPublicVisibilityConfig();

  if (!isImpactSectionEnabled(visibility, 'approved_updates')) {
    res.json({ success: true, data: [], visibility });
    return;
  }

  const rows = await db('dfb_expenses as e')
    .join('dfb_projects as p', 'e.project_id', 'p.project_id')
    .where('e.status', 'Approved')
    .whereNotNull('e.project_id')
    .whereNull('e.deleted_at')
    .orderBy('e.approved_at', 'desc')
    .limit(limit)
    .select(
      'e.expense_id',
      'e.purpose',
      'e.spent_timestamp',
      'e.approved_at',
      'e.proof_of_execution_urls',
      'p.project_id',
      'p.project_name',
      'p.location_city',
      'p.location_country'
    );

  const updates = rows
    .map((row: any) => {
      const proof = parsePublicProof(row.proof_of_execution_urls);
      const showLocation = visibility.updateFields.showProjectLocation !== false;
      const showNarrative = visibility.updateFields.showNarrative !== false;
      const showDetails = visibility.updateFields.showDetails !== false;
      const showPhotos = visibility.updateFields.showPhotos !== false;
      return {
        update_id: row.expense_id,
        project_id: row.project_id,
        project_name: row.project_name,
        location_city: showLocation ? row.location_city : null,
        location_country: showLocation ? row.location_country : null,
        update_title: proof.updateTitle || row.purpose,
        update_details: showDetails ? proof.updateDetails : null,
        narrative: showNarrative ? row.purpose : null,
        photo_urls: showPhotos ? proof.photos : [],
        happened_at: row.spent_timestamp,
        approved_at: row.approved_at,
      };
    })
    .filter((row: any) => row.photo_urls.length > 0 || row.narrative);

  res.json({ success: true, data: updates, visibility });
});
