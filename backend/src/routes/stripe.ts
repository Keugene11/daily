import { Router, Response } from 'express';
import { stripe, TIERS, TierName } from '../lib/stripe';
import { supabaseAdmin } from '../lib/supabase-admin';
import { SubscriptionRequest } from '../middleware/subscription';

const router = Router();

/**
 * POST /api/checkout
 * Creates a Stripe Checkout Session and returns the URL
 */
router.post('/checkout', async (req: SubscriptionRequest, res: Response) => {
  const { priceId } = req.body;

  if (!priceId || !req.userId) {
    return res.status(400).json({ error: 'Missing priceId or not authenticated' });
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
    } else {
      const customer = await stripe.customers.create({
        ...(req.userEmail ? { email: req.userEmail } : {}),
        metadata: { supabase_user_id: req.userId },
      });
      customerId = customer.id;

      // Save customer ID
      await supabaseAdmin
        .from('subscriptions')
        .upsert({
          user_id: req.userId,
          stripe_customer_id: customerId,
          plan_type: 'free',
          status: 'active',
        }, { onConflict: 'user_id' });
    }

    // Determine if this is a one-time (lifetime) or subscription
    const isLifetime = priceId === process.env.STRIPE_LIFETIME_PRICE_ID;

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      mode: isLifetime ? 'payment' : 'subscription',
      success_url: `${req.headers.origin || 'https://daily-three-xi.vercel.app'}?success=1`,
      cancel_url: `${req.headers.origin || 'https://daily-three-xi.vercel.app'}?canceled=1`,
      metadata: { supabase_user_id: req.userId },
    });

    res.json({ url: session.url });
  } catch (err) {
    console.error('[Stripe] Checkout error:', err);
    res.status(500).json({ error: 'Failed to create checkout session' });
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
 * Returns current user's tier, usage, limits, and features
 */
router.get('/subscription', async (req: SubscriptionRequest, res: Response) => {
  const tier = req.tier || 'free';
  const tierConfig = TIERS[tier];

  let usage = { plan_count: 0, explore_count: 0 };

  if (req.userId) {
    const today = new Date().toISOString().split('T')[0];

    if (tierConfig.period === 'day') {
      const { data } = await supabaseAdmin
        .from('usage')
        .select('plan_count, explore_count')
        .eq('user_id', req.userId)
        .eq('date', today)
        .single();
      if (data) usage = data;
    } else {
      const monthStart = `${today.slice(0, 7)}-01`;
      const { data: rows } = await supabaseAdmin
        .from('usage')
        .select('plan_count, explore_count')
        .eq('user_id', req.userId)
        .gte('date', monthStart);

      if (rows) {
        usage = {
          plan_count: rows.reduce((s, r) => s + (r.plan_count ?? 0), 0),
          explore_count: rows.reduce((s, r) => s + (r.explore_count ?? 0), 0),
        };
      }
    }
  }

  res.json({
    tier,
    period: tierConfig.period,
    limits: {
      plans: tierConfig.planLimit === Infinity ? -1 : tierConfig.planLimit,
      explores: tierConfig.exploreLimit === Infinity ? -1 : tierConfig.exploreLimit,
    },
    usage: {
      plans: usage.plan_count,
      explores: usage.explore_count,
    },
    features: Array.from(tierConfig.features),
  });
});

export default router;
