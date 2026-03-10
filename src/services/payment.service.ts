import { createIntegrityHash } from './integrity.service';
import { evaluateUserBadges } from './gamification.service';
import { v4 as uuidv4 } from 'uuid';
import { io } from '../index';
import { logger } from '../utils/logger';

export interface PaymentPayload {
  donorId?: number;
  amount: number;
  currency: string;
  paymentMethod: string;
  gatewayTxnId: string;
  gatewayFee: number;
  campaignId?: number;
  fundId?: number;
  metadata?: any;
}

export async function logWebhookToQueue(gatewaySource: string, payload: any, signature: string): Promise<number> {
  const [queueId] = await db('dfb_donation_queue').insert({
    gateway_source: gatewaySource,
    gateway_payload: typeof payload === 'string' ? payload : JSON.stringify(payload),
    hmac_signature: signature || '',
    status: 'Pending',
    created_at: new Date()
  });
  return queueId;
}

export async function updateWebhookQueueStatus(queueId: number, status: 'Processed' | 'Failed', retryCount = 0) {
  await db('dfb_donation_queue').where({ queue_id: queueId }).update({
    status,
    retry_count: retryCount,
    processed_at: status === 'Processed' || status === 'Failed' ? new Date() : null
  });
}

export async function processSuccessfulPayment(payload: PaymentPayload): Promise<string> {
  const {
    donorId, amount, currency, paymentMethod,
    gatewayTxnId, gatewayFee, campaignId, fundId
  } = payload;

  const netAmount = amount - gatewayFee;
  const txnId = uuidv4();

  let targetFundId = fundId;
  if (!targetFundId && campaignId) {
    const campaign = await db('dfb_campaigns').where({ campaign_id: campaignId }).first('fund_id');
    targetFundId = campaign?.fund_id;
  }
  if (!targetFundId) {
    const defaultFund = await db('dfb_funds').where({ fund_name: 'General Fund' }).first('fund_id');
    targetFundId = defaultFund?.fund_id;
  }

  await db.transaction(async (trx) => {
    // 1. Create integrity hash
    const hashId = await createIntegrityHash({
      recordType: 'transaction',
      recordId: txnId,
      payload: { txnId, donorId, amount, currency, paymentMethod, fundId: targetFundId },
    });

    // 2. Insert transaction
    await trx('dfb_transactions').insert({
      transaction_id: txnId,
      donor_id: donorId || null,
      amount,
      currency,
      currency_type: 'fiat', // Assuming fiat for these gateways
      payment_method: paymentMethod,
      gateway_txn_id: gatewayTxnId,
      gateway_fee: gatewayFee,
      net_amount: netAmount,
      status: 'Completed',
      settled_at: new Date(),
      integrity_hash_id: hashId,
      created_at: new Date(),
    });

    // 3. Allocate to fund (FIFO engine starting point)
    if (targetFundId) {
      await trx('dfb_allocations').insert({
        transaction_id: txnId,
        fund_id: targetFundId,
        allocated_amount: netAmount,
        allocated_at: new Date(),
        is_spent: false,
      });
      // Denormalized fund balance update
      await trx('dfb_funds').where({ fund_id: targetFundId }).increment('current_balance', netAmount);
    }

    // 4. Update donor lifetime value
    if (donorId) {
      await trx('dfb_donors').where({ donor_id: donorId }).increment('lifetime_value', netAmount)
        .update({ last_donation_date: new Date(), updated_at: new Date() });
    }

    // 5. Update campaign totals
    if (campaignId) {
      await trx('dfb_campaigns').where({ campaign_id: campaignId })
        .increment('raised_amount', netAmount)
        .increment('donor_count', 1);
    }
  });

  // 6. Emit WebSocket events for real-time thermometer jump
  if (targetFundId) {
    io.to(`fund:${targetFundId}`).emit('fund_updated', { fundId: targetFundId, amountAdded: netAmount });
  }
  if (campaignId) {
    io.to(`campaign:${campaignId}`).emit('campaign_updated', { campaignId, amountAdded: netAmount });
  }

  // 7. Evaluate Gamification Badges Async
  if (donorId) {
    // Fire and forget so we don't block webhook ack
    evaluateUserBadges(donorId).catch(err => {
      logger.error('Failed to evaluate gamification badges', { error: err });
    });
  }
  
  logger.info(`Processed successful payment from ${paymentMethod}`, { txnId, gatewayTxnId, netAmount });
  return txnId;
}
