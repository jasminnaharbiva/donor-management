import express, { Router, Request, Response } from 'express';
import { logWebhookToQueue, updateWebhookQueueStatus, processSuccessfulPayment } from '../services/payment.service';
import { logger } from '../utils/logger';

export const webhooksRouter = Router();

const jsonParser = express.json();
const urlEncodedParser = express.urlencoded({ extended: true });

// ---------------------------------------------------------------------------
// POST /api/v1/webhooks/stripe
// Stripe webhooks require the raw body to verify signatures. 
// ---------------------------------------------------------------------------
webhooksRouter.post('/stripe', express.raw({ type: 'application/json' }), async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'] as string;
  const rawBodyText = req.body.toString('utf8');
  
  try {
    const queueId = await logWebhookToQueue('stripe', rawBodyText, sig || '');
    
    // In a real implementation: stripe.webhooks.constructEvent(rawBody, sig, STRIPE_SECRET)
    // Here we parse directly assuming verification succeeds:
    const event = JSON.parse(rawBodyText);
    
    if (event.type === 'payment_intent.succeeded') {
      const pi = event.data.object;
      await processSuccessfulPayment({
        amount: pi.amount / 100, // Stripe uses cents
        currency: pi.currency.toUpperCase(),
        paymentMethod: 'card', 
        gatewayTxnId: pi.id,
        gatewayFee: (pi.amount / 100) * 0.029 + 0.30, // Approx stripe fee (usually fetch balance txn)
        donorId: pi.metadata?.donorId ? parseInt(pi.metadata.donorId, 10) : undefined,
        campaignId: pi.metadata?.campaignId ? parseInt(pi.metadata.campaignId, 10) : undefined,
        fundId: pi.metadata?.fundId ? parseInt(pi.metadata.fundId, 10) : undefined,
      });
    }

    await updateWebhookQueueStatus(queueId, 'Processed');
    res.json({ received: true });
  } catch (err: any) {
    logger.error('Stripe webhook error', { error: err.message });
    res.status(400).send(`Webhook Error: ${err.message}`);
  }
});

// ---------------------------------------------------------------------------
// POST /api/v1/webhooks/bkash
// bKash IPN callback (typically application/json)
// ---------------------------------------------------------------------------
webhooksRouter.post('/bkash', jsonParser, async (req: Request, res: Response) => {
  try {
    const queueId = await logWebhookToQueue('bkash', req.body, req.headers['x-signature'] as string || '');
    const { trxID, amount, currency } = req.body;
    
    if (trxID && req.body.transactionStatus === 'Completed') {
      await processSuccessfulPayment({
        amount: parseFloat(amount),
        currency: currency || 'BDT',
        paymentMethod: 'bkash',
        gatewayTxnId: trxID,
        gatewayFee: parseFloat(amount) * 0.015, // Approx 1.5% fee
        // Custom invoice parsing could be added here
      });
    }
    
    await updateWebhookQueueStatus(queueId, 'Processed');
    res.json({ message: 'Success' });
  } catch (err: any) {
    logger.error('bKash webhook error', { error: err.message });
    res.status(400).send(`Webhook Error: ${err.message}`);
  }
});

// ---------------------------------------------------------------------------
// POST /api/v1/webhooks/sslcommerz
// SSLCommerz typically sends URL encoded form data.
// ---------------------------------------------------------------------------
webhooksRouter.post('/sslcommerz', urlEncodedParser, async (req: Request, res: Response) => {
  try {
    const queueId = await logWebhookToQueue('sslcommerz', req.body, '');
    const { val_id, bank_tran_id, amount, currency, status } = req.body;
    
    // In production, you would call SSLCommerz validation API using val_id
    if (val_id && bank_tran_id && status === 'VALID') {
      await processSuccessfulPayment({
        amount: parseFloat(amount),
        currency: currency || 'BDT',
        paymentMethod: 'sslcommerz',
        gatewayTxnId: bank_tran_id,
        gatewayFee: parseFloat(amount) * 0.02, // Approx 2% fee
      });
    }

    await updateWebhookQueueStatus(queueId, 'Processed');
    res.json({ message: 'Success' });
  } catch (err: any) {
    logger.error('SSLCommerz webhook error', { error: err.message });
    res.status(400).send(`Webhook Error: ${err.message}`);
  }
});

// ---------------------------------------------------------------------------
// POST /api/v1/webhooks/paypal
// PayPal sends JSON and custom signature headers
// ---------------------------------------------------------------------------
webhooksRouter.post('/paypal', jsonParser, async (req: Request, res: Response) => {
  try {
    const queueId = await logWebhookToQueue('paypal', req.body, req.headers['paypal-transmission-sig'] as string || '');
    
    if (req.body.event_type === 'PAYMENT.CAPTURE.COMPLETED') {
      const resource = req.body.resource;
      const fee = resource.seller_receivable_breakdown?.paypal_fee?.value ? 
        parseFloat(resource.seller_receivable_breakdown.paypal_fee.value) : 0;

      await processSuccessfulPayment({
        amount: parseFloat(resource.amount.value),
        currency: resource.amount.currency_code,
        paymentMethod: 'paypal',
        gatewayTxnId: resource.id,
        gatewayFee: fee,
        donorId: resource.custom_id ? parseInt(resource.custom_id.split(':')[0], 10) : undefined, 
      });
    }
    
    await updateWebhookQueueStatus(queueId, 'Processed');
    res.json({ message: 'Success' });
  } catch (err: any) {
    logger.error('PayPal webhook error', { error: err.message });
    res.status(400).send(`Webhook Error: ${err.message}`);
  }
});
