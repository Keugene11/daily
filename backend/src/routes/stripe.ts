import { Router, Response } from 'express';
import { stripe, TIERS, TierName, getTierForPrice } from '../lib/stripe';
import { supabaseAdmin } from '../lib/supabase-admin';
import { SubscriptionRequest } from '../middleware/subscription';

const router = Router();

/**
 * POST /api/checkout
 * Creates a Stripe Checkout Session and returns the URL
 */
router.post('/checkout', async (req: SubscriptionRequest, res: Response) => {
  const { priceId } = req.body;

  console.log(`[Checkout] Start — priceId="${priceId}", userId=${req.userId}`);

  if (!priceId) {
    return res.status(400).json({ error: 'Missing priceId' });
  }
  if (!req.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    // Find or create Stripe customer
    let customerId: string | undefined;

    const { data: sub } = await supabaseAdmin
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', req.userId)
      .single();

    if (sub?.stripe_customer_id) {
      customerId = sub.stripe_customer_id;
      console.log(`[Checkout] Existing customer: ${customerId}`);
    } else {
      const customer = await stripe.customers.create({
        ...(req.userEmail ? { email: req.userEmail } : {}),
        metadata: { supabase_user_id: req.userId },
      });
      customerId = customer.id;
      console.log(`[Checkout] Created customer: ${customerId}`);

      await supabaseAdmin
        .from('subscriptions')
        .upsert({
          user_id: req.userId,
          stripe_customer_id: customerId,
          plan_type: 'free',
          status: 'active',
        }, { onConflict: 'user_id' });
    }

    // Fetch the price to determine if it's recurring or one-time
    const price = await stripe.prices.retrieve(priceId);
    const mode = price.type === 'recurring' ? 'subscription' : 'payment';
    console.log(`[Checkout] Price type="${price.type}", mode="${mode}"`);

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      mode,
      success_url: `${req.headers.origin || 'https://daily-three-xi.vercel.app'}?success=1`,
      cancel_url: `${req.headers.origin || 'https://daily-three-xi.vercel.app'}?canceled=1`,
      metadata: { supabase_user_id: req.userId },
    });

    console.log(`[Checkout] Session created: ${session.id}`);
    res.json({ url: session.url });
  } catch (err: any) {
    const msg = err?.message || 'Unknown error';
    const code = err?.code || err?.type || '';
    console.error(`[Checkout] FAILED — ${code}: ${msg}`, err);
    res.status(500).json({ error: `${msg}${code ? ` (${code})` : ''}` });
  }
});

/**
 * POST /api/portal
 * Creates a Stripe Customer Portal session
 */
router.post('/portal', async (req: SubscriptionRequest, res: Response) => {
  if (!req.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const { data: sub } = await supabaseAdmin
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', req.userId)
      .single();

    if (!sub?.stripe_customer_id) {
      return res.status(400).json({ error: 'No subscription found' });
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripe_customer_id,
      return_url: req.headers.origin || 'https://daily-three-xi.vercel.app',
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('[Stripe] Portal error:', err);
    res.status(500).json({ error: 'Failed to create portal session' });
  }
});

/**
 * GET /api/subscription
 * Returns current user's tier, usage, limits, and features.
 * Directly queries DB + Stripe (does NOT rely on middleware req.tier).
 */
router.get('/subscription', async (req: SubscriptionRequest, res: Response) => {
  let tier: TierName = 'free';

  if (req.userId) {
    try {
      // 1. Check DB
      const { data: subRow } = await supabaseAdmin
        .from('subscriptions')
        .select('plan_type, status, current_period_end, stripe_customer_id')
        .eq('user_id', req.userId)
        .single();

      console.log(`[Subscription GET] userId=${req.userId}, dbRow=${JSON.stringify(subRow)}`);

      if (subRow?.plan_type === 'pro' && subRow?.status === 'active' &&
          subRow?.current_period_end && new Date(subRow.current_period_end) > new Date()) {
        tier = 'pro';
        console.log(`[Subscription GET] DB says pro, periodEnd=${subRow.current_period_end}`);
      }

      // 2. If still free but has Stripe customer, check Stripe directly
      if (tier === 'free' && subRow?.stripe_customer_id) {
        console.log(`[Subscription GET] Checking Stripe for customer ${subRow.stripe_customer_id}...`);
        const subs = await stripe.subscriptions.list({
          customer: subRow.stripe_customer_id,
          status: 'active',
          limit: 1,
        });

        if (subs.data.length > 0) {
          const activeSub = subs.data[0] as any;
          const priceId = activeSub.items.data[0]?.price?.id || '';
          const syncedTier = getTierForPrice(priceId);
          const periodEnd = new Date(activeSub.current_period_end * 1000).toISOString();

          console.log(`[Subscription GET] Stripe has active sub: tier=${syncedTier}, periodEnd=${periodEnd}`);

          // Sync DB
          await supabaseAdmin
            .from('subscriptions')
            .update({
              plan_type: syncedTier,
              status: 'active',
              current_period_end: periodEnd,
              updated_at: new Date().toISOString(),
            })
            .eq('user_id', req.userId);

          tier = syncedTier;
        } else {
          console.log(`[Subscription GET] No active Stripe subscriptions`);
        }
      }
    } catch (err: any) {
      console.error(`[Subscription GET] Error:`, err?.message || err);
    }
  }

  const tierConfig = TIERS[tier];
  console.log(`[Subscription GET] Final tier=${tier}`);

  res.json({
    tier,
    period: tierConfig.period,
    limits: {
      plans: tierConfig.planLimit === Infinity ? -1 : tierConfig.planLimit,
      explores: tierConfig.exploreLimit === Infinity ? -1 : tierConfig.exploreLimit,
    },
    usage: { plans: 0, explores: 0 },
    features: Array.from(tierConfig.features),
  });
});

export default router;
