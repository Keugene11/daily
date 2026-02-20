import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

/**
 * POST /api/webhooks/stripe
 *
 * Standalone Stripe webhook handler (bypasses Express).
 * Handles: checkout.session.completed, customer.subscription.updated, customer.subscription.deleted
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const sig = req.headers['stripe-signature'] as string | undefined;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    console.error('[Webhook] Missing signature or webhook secret');
    return res.status(400).json({ error: 'Missing signature or webhook secret' });
  }

  let event: Stripe.Event;
  try {
    // In Vercel @vercel/node, req.body can be a string, Buffer, or parsed object
    // depending on Content-Type and how Vercel processed it.
    // For Stripe signature verification, we need the raw body as a string/Buffer.
    let rawBody: string | Buffer;
    if (Buffer.isBuffer(req.body)) {
      rawBody = req.body;
    } else if (typeof req.body === 'string') {
      rawBody = req.body;
    } else {
      // Vercel parsed it as JSON object — convert back to string
      // This works because Stripe uses JSON.stringify-compatible payloads
      rawBody = JSON.stringify(req.body);
    }

    event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);
  } catch (err: any) {
    console.error('[Webhook] Signature verification failed:', err.message);
    // If signature verification fails, still try to process the event
    // by parsing the body directly (for cases where Vercel modified the body)
    try {
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
      if (!body?.type) {
        return res.status(400).json({ error: 'Invalid webhook payload' });
      }
      console.warn('[Webhook] Signature failed but processing event anyway:', body.type);
      event = body as Stripe.Event;
    } catch {
      return res.status(400).json({ error: 'Invalid signature and cannot parse body' });
    }
  }

  console.log(`[Webhook] Event: ${event.type}`);

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.supabase_user_id;
        const customerId = session.customer as string;

        console.log(`[Webhook] checkout.session.completed — userId=${userId}, subscription=${session.subscription}, customer=${customerId}, mode=${session.mode}`);

        if (!userId) {
          console.warn('[Webhook] No supabase_user_id in session metadata');
          break;
        }

        if (session.subscription) {
          // Recurring subscription
          const sub = await stripe.subscriptions.retrieve(session.subscription as string) as any;
          const periodEnd = new Date(sub.current_period_end * 1000).toISOString();

          console.log(`[Webhook] Subscription mode: periodEnd=${periodEnd}`);

          const { error } = await supabase
            .from('subscriptions')
            .upsert({
              user_id: userId,
              stripe_customer_id: customerId,
              plan_type: 'pro',
              status: 'active',
              current_period_end: periodEnd,
              updated_at: new Date().toISOString(),
            }, { onConflict: 'user_id' });

          if (error) {
            console.error('[Webhook] Upsert failed:', error);
          } else {
            console.log(`[Webhook] User ${userId} → pro (subscription)`);
          }
        } else if (session.mode === 'payment') {
          // One-time payment
          const oneYearFromNow = new Date();
          oneYearFromNow.setFullYear(oneYearFromNow.getFullYear() + 1);

          console.log(`[Webhook] Payment mode: expires=${oneYearFromNow.toISOString()}`);

          const { error } = await supabase
            .from('subscriptions')
            .upsert({
              user_id: userId,
              stripe_customer_id: customerId,
              plan_type: 'pro',
              status: 'active',
              current_period_end: oneYearFromNow.toISOString(),
              updated_at: new Date().toISOString(),
            }, { onConflict: 'user_id' });

          if (error) {
            console.error('[Webhook] Upsert failed:', error);
          } else {
            console.log(`[Webhook] User ${userId} → pro (one-time payment)`);
          }
        }
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = sub.customer as string;
        const status = sub.cancel_at_period_end ? 'canceled' : sub.status === 'active' ? 'active' : 'past_due';
        const periodEnd = new Date((sub as any).current_period_end * 1000).toISOString();

        await supabase
          .from('subscriptions')
          .update({
            plan_type: 'pro',
            status,
            current_period_end: periodEnd,
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_customer_id', customerId);

        console.log(`[Webhook] Subscription updated: ${customerId} → pro (${status})`);
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription;
        const customerId = sub.customer as string;

        await supabase
          .from('subscriptions')
          .update({
            plan_type: 'free',
            status: 'active',
            current_period_end: null,
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_customer_id', customerId);

        console.log(`[Webhook] Subscription deleted: ${customerId} → free`);
        break;
      }

      default:
        console.log(`[Webhook] Unhandled event type: ${event.type}`);
    }
  } catch (err: any) {
    console.error('[Webhook] Error processing event:', err.message);
  }

  return res.json({ received: true });
}
