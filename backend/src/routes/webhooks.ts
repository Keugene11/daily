import { Router, Request, Response } from 'express';
import { stripe, getTierForPrice } from '../lib/stripe';
import { supabaseAdmin } from '../lib/supabase-admin';

const router = Router();

/**
 * POST /api/webhooks/stripe
 * Handles Stripe webhook events. Must receive raw body for signature verification.
 */
router.post('/webhooks/stripe', async (req: Request, res: Response) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!sig || !webhookSecret) {
    return res.status(400).json({ error: 'Missing signature or webhook secret' });
  }

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (err) {
    console.error('[Webhook] Signature verification failed:', err);
    return res.status(400).json({ error: 'Invalid signature' });
  }

  console.log(`[Webhook] ${event.type}`);

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.metadata?.supabase_user_id;
        if (!userId) break;

        if (session.mode === 'subscription' && session.subscription) {
          // Recurring subscription — fetch subscription details
          const sub = await stripe.subscriptions.retrieve(session.subscription as string) as any;
          const priceId = sub.items.data[0]?.price?.id || '';
          const tier = getTierForPrice(priceId);

          await supabaseAdmin
            .from('subscriptions')
            .upsert({
              user_id: userId,
              stripe_customer_id: session.customer as string,
              plan_type: tier,
              status: 'active',
              current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
              updated_at: new Date().toISOString(),
            }, { onConflict: 'user_id' });

          console.log(`[Webhook] User ${userId} subscribed to ${tier}`);
        } else if (session.mode === 'payment') {
          // One-time payment (lifetime)
          await supabaseAdmin
            .from('subscriptions')
            .upsert({
              user_id: userId,
              stripe_customer_id: session.customer as string,
              plan_type: 'lifetime',
              status: 'active',
              current_period_end: null,
              updated_at: new Date().toISOString(),
            }, { onConflict: 'user_id' });

          console.log(`[Webhook] User ${userId} purchased lifetime`);
        }
        break;
      }

      case 'customer.subscription.updated': {
        const sub = event.data.object as any;
        const customerId = sub.customer as string;
        const priceId = sub.items.data[0]?.price?.id || '';
        const tier = getTierForPrice(priceId);

        const status = sub.cancel_at_period_end ? 'canceled' : sub.status === 'active' ? 'active' : 'past_due';

        await supabaseAdmin
          .from('subscriptions')
          .update({
            plan_type: tier,
            status,
            current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_customer_id', customerId);

        console.log(`[Webhook] Subscription updated: ${customerId} → ${tier} (${status})`);
        break;
      }

      case 'customer.subscription.deleted': {
        const sub = event.data.object;
        const customerId = sub.customer as string;

        await supabaseAdmin
          .from('subscriptions')
          .update({
            plan_type: 'free',
            status: 'active',
            current_period_end: null,
            updated_at: new Date().toISOString(),
          })
          .eq('stripe_customer_id', customerId);

        console.log(`[Webhook] Subscription canceled: ${customerId} → free`);
        break;
      }
    }
  } catch (err) {
    console.error('[Webhook] Error processing event:', err);
  }

  res.json({ received: true });
});

export default router;
