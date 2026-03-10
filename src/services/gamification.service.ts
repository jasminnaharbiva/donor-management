import { db } from '../config/database';
import { logger } from '../utils/logger';

export async function evaluateUserBadges(donorId: number): Promise<void> {
  try {
    const donor = await db('dfb_donors').where({ donor_id: donorId }).first();
    if (!donor) return;

    const [donationCountRow] = await db('dfb_transactions')
      .where({ donor_id: donorId, status: 'Completed' })
      .count('transaction_id as count');
    const donationCount = Number(donationCountRow.count || 0);

    const lifetimeValue = Number(donor.lifetime_value || 0);

    // Fetch active badges the user DOES NOT already have
    const existingBadgesQuery = db('dfb_user_badges').select('badge_id').where({ user_id: donorId });
    const availableBadges = await db('dfb_badges')
      .where({ is_active: true })
      .whereNotIn('badge_id', existingBadgesQuery);

    const newlyAwardedBadges: { user_id: number; badge_id: number; awarded_at: Date }[] = [];

    for (const badge of availableBadges) {
      let awarded = false;
      const threshold = Number(badge.criteria_value || 0);

      switch (badge.criteria_type) {
        case 'donation_count':
          if (donationCount >= threshold) awarded = true;
          break;
        case 'donation_amount_lifetime':
          if (lifetimeValue >= threshold) awarded = true;
          break;
        case 'first_donation':
          if (donationCount >= 1) awarded = true;
          break;
        default:
          break;
      }

      if (awarded) {
        newlyAwardedBadges.push({
          user_id: donorId,
          badge_id: badge.badge_id,
          awarded_at: new Date()
        });
        logger.info(`Badge awarded: ${badge.badge_name} to donor ${donorId}`);
      }
    }

    if (newlyAwardedBadges.length > 0) {
      await db('dfb_user_badges').insert(newlyAwardedBadges);
    }
  } catch (err: any) {
    logger.error('Gamification evaluation failed', { donorId, error: err.message });
  }
}
