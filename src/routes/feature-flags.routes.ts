import { Router, Request, Response } from 'express';
import { body, param, validationResult } from 'express-validator';
import { db } from '../config/database';
import { redis } from '../config/redis';
import { authenticate, requireRoles } from '../middleware/auth.middleware';
import { writeAuditLog } from '../services/audit.service';

export const featureFlagsRouter = Router();

// Seed default flags if none exist
async function ensureDefaultFlags() {
  const count = await db('dfb_feature_flags').count('flag_id as c').first();
  if (Number((count as any)?.c) > 0) return;

  const defaults = [
    { flag_name: 'feature.bkash_payments',         is_enabled: 1, description: 'bKash payment gateway' },
    { flag_name: 'feature.sslcommerz_payments',    is_enabled: 1, description: 'SSLCommerz payment gateway' },
    { flag_name: 'feature.crypto_payments',        is_enabled: 0, description: 'Coinbase Commerce crypto donations' },
    { flag_name: 'feature.donor_registration',     is_enabled: 1, description: 'New donor self-registration' },
    { flag_name: 'feature.donor_portal',           is_enabled: 1, description: 'Donor login and impact dashboard' },
    { flag_name: 'feature.volunteer_portal',       is_enabled: 1, description: 'Volunteer dashboard and expense submission' },
    { flag_name: 'feature.peer_to_peer',           is_enabled: 0, description: 'P2P supporter fundraising sub-pages' },
    { flag_name: 'feature.gamification',           is_enabled: 0, description: 'Donor badge system and leaderboards' },
    { flag_name: 'feature.ai_wealth_screening',    is_enabled: 0, description: 'AI donor profiling (opt-in)' },
    { flag_name: 'feature.public_impact_dashboard',is_enabled: 1, description: 'Public /impact transparency page' },
    { flag_name: 'feature.corporate_matching',     is_enabled: 0, description: 'Double the Donation API integration' },
    { flag_name: 'feature.offline_pwa',            is_enabled: 1, description: 'Service worker and offline mode' },
    { flag_name: 'feature.blockchain_verification',is_enabled: 1, description: 'Public SHA-256 hash verification page' },
    { flag_name: 'feature.maintenance_mode',       is_enabled: 0, description: 'Returns HTTP 503 for all donor-facing endpoints' },
    { flag_name: 'feature.qr_vendor_payments',     is_enabled: 0, description: 'QR code direct vendor payment links' },
    { flag_name: 'feature.apple_google_pay',       is_enabled: 1, description: 'Apple Pay / Google Pay buttons' },
  ];
  await db('dfb_feature_flags').insert(defaults);
}
ensureDefaultFlags().catch(() => {});

// GET /api/v1/feature-flags
featureFlagsRouter.get('/', authenticate, async (_req: Request, res: Response): Promise<void> => {
  const flags = await db('dfb_feature_flags').orderBy('flag_name');
  res.json({ success: true, data: flags });
});

// GET /api/v1/feature-flags/public — unauthenticated (only enabled flags)
featureFlagsRouter.get('/public', async (_req: Request, res: Response): Promise<void> => {
  const cacheKey = 'feature_flags:public';
  const cached = await redis.get(cacheKey);
  if (cached) { res.json({ success: true, data: JSON.parse(cached) }); return; }

  const flags = await db('dfb_feature_flags').where({ is_enabled: 1 }).select('flag_name', 'is_enabled');
  const map: Record<string, boolean> = {};
  flags.forEach((f: any) => { map[f.flag_name] = true; });

  await redis.setex(cacheKey, 30, JSON.stringify(map));
  res.json({ success: true, data: map });
});

// PATCH /api/v1/feature-flags/:flagName
featureFlagsRouter.patch('/:flagName',
  authenticate, requireRoles('Super Admin', 'Admin'),
  [body('isEnabled').isBoolean().toBoolean()],
  async (req: Request, res: Response): Promise<void> => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) { res.status(422).json({ success: false, errors: errors.array() }); return; }

    const flagName = String(req.params.flagName);
    const { isEnabled } = req.body;

    await db('dfb_feature_flags')
      .where({ flag_name: flagName })
      .update({ is_enabled: isEnabled ? 1 : 0, updated_by: req.user!.userId, updated_at: new Date() });

    // Invalidate cache
    await redis.del('feature_flags:public');

    await writeAuditLog({ tableAffected: 'dfb_feature_flags', recordId: flagName, actionType: 'UPDATE', newPayload: { flagName, isEnabled }, actorId: req.user!.userId });
    res.json({ success: true, message: `Flag ${flagName} set to ${isEnabled}` });
  }
);
