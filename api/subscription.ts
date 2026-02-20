import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

const ALL_FEATURES = ['multiDay', 'cloudSync', 'recurring', 'antiRoutine', 'dateNight', 'dietary', 'accessible', 'mood', 'energy'];

/**
 * GET /api/subscription
 *
 * Returns the user's current subscription tier, limits, features.
 * If unauthenticated, returns free tier with all features unlocked.
 *
 * Checks (in order):
 *  1. DB subscription row
 *  2. Stripe subscriptions (by customer ID or email lookup)
 *  3. Stripe checkout sessions (for one-time payments)
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const freeTierResponse = {
    tier: 'free' as const,
    period: 'day' as const,
    limits: { plans: -1, explores: -1 },
    usage: { plans: 0, explores: 0 },
    features: ALL_FEATURES,
  };

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.json(freeTierResponse);
  }

  try {
    const token = authHeader.slice(7);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      console.log(`[Subscription] Auth failed: ${authError?.message}`);
      return res.json(freeTierResponse);
    }

    const userId = user.id;
    const userEmail = user.email;
    console.log(`[Subscription] userId=${userId}, email=${userEmail}`);

    // 1. Check DB
    const { data: subRow } = await supabase
      .from('subscriptions')
      .select('plan_type, status, current_period_end, stripe_customer_id')
      .eq('user_id', userId)
      .single();

    console.log(`[Subscription] DB row: ${JSON.stringify(subRow)}`);

    // If DB already says pro and period is valid, return immediately
    if (subRow?.plan_type === 'pro' && subRow?.status === 'active' &&
        subRow?.current_period_end && new Date(subRow.current_period_end) > new Date()) {
      console.log(`[Subscription] DB says pro, returning`);
      return res.json({
        tier: 'pro',
        period: 'month',
        limits: { plans: -1, explores: -1 },
        usage: { plans: 0, explores: 0 },
        features: ALL_FEATURES,
      });
    }

    // 2. Find Stripe customer (from DB or by email search)
    let customerId = subRow?.stripe_customer_id || null;

    if (!customerId && userEmail) {
      console.log(`[Subscription] No customer ID, searching Stripe by email: ${userEmail}`);
      const customers = await stripe.customers.list({ email: userEmail, limit: 1 });
      if (customers.data.length > 0) {
        customerId = customers.data[0].id;
        console.log(`[Subscription] Found customer by email: ${customerId}`);

        // Save customer ID for future lookups
        await supabase
          .from('subscriptions')
          .upsert({
            user_id: userId,
            stripe_customer_id: customerId,
            plan_type: 'free',
            status: 'active',
            updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id' });
      }
    }

    if (!customerId) {
      console.log(`[Subscription] No Stripe customer found, returning free`);
      return res.json(freeTierResponse);
    }

    // 3. Check Stripe for active subscriptions (recurring plans)
    let tier: 'free' | 'pro' = 'free';
    let periodEnd: string | null = null;

    const subs = await stripe.subscriptions.list({
      customer: customerId,
      status: 'active',
      limit: 1,
    });

    if (subs.data.length > 0) {
      const activeSub = subs.data[0] as any;
      periodEnd = new Date(activeSub.current_period_end * 1000).toISOString();
      tier = 'pro';
      console.log(`[Subscription] Stripe active subscription, periodEnd=${periodEnd}`);
    }

    // 4. If no subscription, check for one-time payments
    if (tier === 'free') {
      console.log(`[Subscription] Checking for one-time payment sessions...`);
      const sessions = await stripe.checkout.sessions.list({
        customer: customerId,
        status: 'complete',
        limit: 10,
      });

      for (const session of sessions.data) {
        if (session.mode === 'payment' && session.payment_status === 'paid') {
          const paidAt = new Date((session.created || 0) * 1000);
          const expiresAt = new Date(paidAt);
          expiresAt.setFullYear(expiresAt.getFullYear() + 1);

          if (expiresAt > new Date()) {
            tier = 'pro';
            periodEnd = expiresAt.toISOString();
            console.log(`[Subscription] Found one-time payment, expires ${periodEnd}`);
            break;
          }
        }
      }
    }

    // 5. Sync DB if we found pro status
    if (tier === 'pro' && periodEnd) {
      await supabase
        .from('subscriptions')
        .upsert({
          user_id: userId,
          stripe_customer_id: customerId,
          plan_type: 'pro',
          status: 'active',
          current_period_end: periodEnd,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });
      console.log(`[Subscription] Synced DB to pro`);
    }

    console.log(`[Subscription] Final tier=${tier}`);
    return res.json({
      tier,
      period: tier === 'pro' ? 'month' : 'day',
      limits: { plans: -1, explores: -1 },
      usage: { plans: 0, explores: 0 },
      features: ALL_FEATURES,
    });
  } catch (err: any) {
    console.error('[Subscription] Error:', err);
    return res.status(500).json({ error: err.message });
  }
}
