import { db } from '../config/database';
import { logger } from '../utils/logger';
import { processSuccessfulPayment, updateWebhookQueueStatus } from './payment.service';
import cron from 'node-cron';

// ---------------------------------------------------------------------------
// 1. MySQL Queue Poller (Runs every 15 seconds)
// ---------------------------------------------------------------------------
let isPolling = false;

export async function processDonationQueue() {
  if (isPolling) return;
  isPolling = true;

  try {
    // Find up to 10 pending or retryable jobs
    const jobs = await db('dfb_donation_queue')
      .whereIn('status', ['Pending', 'Failed'])
      .andWhere('retry_count', '<', 3)
      .orderBy('created_at', 'asc')
      .limit(10)
      .select('*');

    if (jobs.length === 0) {
      isPolling = false;
      return;
    }

    for (const job of jobs) {
      // Lock the job to 'Processing' immediately
      const locked = await db('dfb_donation_queue')
        .where({ queue_id: job.queue_id, status: job.status })
        .update({ status: 'Processing', updated_at: new Date() });

      if (!locked) continue; // Another worker grabbed it

      logger.info(`Processing queue job ${job.queue_id} from ${job.gateway_source}`);

      try {
        let payload = job.gateway_payload;
        if (typeof payload === 'string' && job.gateway_source !== 'stripe') {
          payload = JSON.parse(payload);
        } else if (typeof payload === 'string' && job.gateway_source === 'stripe') {
          payload = JSON.parse(payload); // Actually parse the raw body string for processing here
        }

        // Extremely simplified re-routing of gateway logic
        // In reality, this would dynamically call the correct gateway processor
        if (job.gateway_source === 'stripe' && payload.type === 'payment_intent.succeeded') {
          const pi = payload.data.object;
          await processSuccessfulPayment({
            amount: pi.amount / 100,
            currency: pi.currency.toUpperCase(),
            paymentMethod: 'card',
            gatewayTxnId: pi.id,
            gatewayFee: (pi.amount / 100) * 0.029 + 0.30,
            donorId: pi.metadata?.donorId ? parseInt(pi.metadata.donorId, 10) : undefined,
            campaignId: pi.metadata?.campaignId ? parseInt(pi.metadata.campaignId, 10) : undefined,
            fundId: pi.metadata?.fundId ? parseInt(pi.metadata.fundId, 10) : undefined,
          });
        }

        await updateWebhookQueueStatus(job.queue_id, 'Processed', job.retry_count);
        logger.info(`Successfully processed job ${job.queue_id}`);

      } catch (err: any) {
        logger.error(`Failed to process job ${job.queue_id}`, { error: err.message, retryCount: job.retry_count + 1 });
        await updateWebhookQueueStatus(job.queue_id, 'Failed', job.retry_count + 1);
      }
    }
  } catch (err: any) {
    logger.error('Queue poller encountered an error', { error: err.message });
  } finally {
    isPolling = false;
  }
}

// ---------------------------------------------------------------------------
// 2. Cron Jobs (Daily Maintenance)
// ---------------------------------------------------------------------------
export function initCronJobs() {
  // Midnight Daily: Clean up extremely old audit logs (e.g., > 10 years, though simplified here for demo)
  cron.schedule('0 0 * * *', async () => {
    logger.info('Running daily midnight cron job: System Maintenance');
    
    // Example: Clean up pending webhooks that have failed max retries and are > 30 days old
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    
    const deletedCount = await db('dfb_donation_queue')
      .where('status', 'Failed')
      .andWhere('retry_count', '>=', 3)
      .andWhere('created_at', '<', thirtyDaysAgo)
      .delete();
      
    if (deletedCount > 0) {
        logger.info(`Cron: Cleaned up ${deletedCount} dead webhook jobs.`);
    }
  });

  logger.info('Cron jobs initialized successfully');
}
