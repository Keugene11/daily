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

  const debug = req.query.debug === '1';
  const steps: string[] = [];

  const freeTierResponse = {
    tier: 'free' as const,
    period: 'day' as const,
    limits: { plans: -1, explores: -1 },
    usage: { plans: 0, explores: 0 },
    features: ALL_FEATURES,
  };

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    steps.push('No auth header');
    if (debug) return res.json({ ...freeTierResponse, _debug: steps });
    return res.json(freeTierResponse);
  }

  try {
    const token = authHeader.slice(7);
    steps.push(`Token: ${token.slice(0, 20)}...`);

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      steps.push(`Auth failed: ${authError?.message || 'no user'}`);
      console.log(`[Subscription] Auth failed: ${authError?.message}`);
      if (debug) return res.json({ ...freeTierResponse, _debug: steps });
      return res.json(freeTierResponse);
    }

    const userId = user.id;
    const userEmail = user.email;
    steps.push(`User: ${userId}, email: ${userEmail}`);
    console.log(`[Subscription] userId=${userId}, email=${userEmail}`);

    // 1. Check DB
    const { data: subRow, error: dbError } = await supabase
      .from('subscriptions')
      .select('plan_type, status, current_period_end, stripe_customer_id')
      .eq('user_id', userId)
      .single();

    steps.push(`DB row: ${JSON.stringify(subRow)}, dbError: ${dbError?.message || 'none'}`);
    console.log(`[Subscription] DB row: ${JSON.stringify(subRow)}`);

    // If DB already says pro and period is valid, return immediately
    if (subRow?.plan_type === 'pro' && subRow?.status === 'active' &&
        subRow?.current_period_end && new Date(subRow.current_period_end) > new Date()) {
      steps.push('DB says pro — returning');
      console.log(`[Subscription] DB says pro, returning`);
      const proResponse = {
        tier: 'pro' as const,
        period: 'month' as const,
        limits: { plans: -1, explores: -1 },
        usage: { plans: 0, explores: 0 },
        features: ALL_FEATURES,
      };
      if (debug) return res.json({ ...proResponse, _debug: steps });
      return res.json(proResponse);
    }

    // 2. Find Stripe customer (from DB or by email search)
    let customerId = subRow?.stripe_customer_id || null;
    steps.push(`Customer ID from DB: ${customerId || 'none'}`);

    if (!customerId && userEmail) {
      steps.push(`Searching Stripe by email: ${userEmail}`);
      console.log(`[Subscription] No customer ID, searching Stripe by email: ${userEmail}`);
      const customers = await stripe.customers.list({ email: userEmail, limit: 1 });
      steps.push(`Stripe email search: ${customers.data.length} results`);
      if (customers.data.length > 0) {
        customerId = customers.data[0].id;
        steps.push(`Found customer: ${customerId}`);
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
      steps.push('No Stripe customer found — returning free');
      console.log(`[Subscription] No Stripe customer found, returning free`);
      if (debug) return res.json({ ...freeTierResponse, _debug: steps });
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
    steps.push(`Active subscriptions: ${subs.data.length}`);

    if (subs.data.length > 0) {
      const activeSub = subs.data[0] as any;
      tier = 'pro';
      if (activeSub.current_period_end) {
        periodEnd = new Date(activeSub.current_period_end * 1000).toISOString();
      }
      steps.push(`Subscription found! periodEnd=${periodEnd}`);
      console.log(`[Subscription] Stripe active subscription, periodEnd=${periodEnd}`);
    }

    // 4. If no subscription, check for one-time payments
    if (tier === 'free') {
      steps.push('No active subscription, checking checkout sessions...');
      console.log(`[Subscription] Checking for one-time payment sessions...`);
      const sessions = await stripe.checkout.sessions.list({
        customer: customerId,
        status: 'complete',
        limit: 10,
      });
      steps.push(`Checkout sessions: ${sessions.data.length}`);

      for (const session of sessions.data) {
        steps.push(`Session ${session.id}: mode=${session.mode}, payment_status=${session.payment_status}`);
        if (session.mode === 'payment' && session.payment_status === 'paid') {
          const paidAt = new Date((session.created || 0) * 1000);
          const expiresAt = new Date(paidAt);
          expiresAt.setFullYear(expiresAt.getFullYear() + 1);

          if (expiresAt > new Date()) {
            tier = 'pro';
            periodEnd = expiresAt.toISOString();
            steps.push(`One-time payment found! expires=${periodEnd}`);
            console.log(`[Subscription] Found one-time payment, expires ${periodEnd}`);
            break;
          }
        }
      }
    }

    // 5. Sync DB if we found pro status
    if (tier === 'pro') {
      const { error: syncError } = await supabase
        .from('subscriptions')
        .upsert({
          user_id: userId,
          stripe_customer_id: customerId,
          plan_type: 'pro',
          status: 'active',
          current_period_end: periodEnd,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });
      steps.push(`DB sync: ${syncError ? `ERROR: ${syncError.message}` : 'OK'}`);
      console.log(`[Subscription] Synced DB to pro`);
    }

    steps.push(`Final tier=${tier}`);
    console.log(`[Subscription] Final tier=${tier}`);
    const response = {
      tier,
      period: tier === 'pro' ? 'month' : 'day',
      limits: { plans: -1, explores: -1 },
      usage: { plans: 0, explores: 0 },
      features: ALL_FEATURES,
    };
    if (debug) return res.json({ ...response, _debug: steps });
    return res.json(response);
  } catch (err: any) {
    steps.push(`EXCEPTION: ${err.message}`);
    console.error('[Subscription] Error:', err);
    if (debug) return res.json({ ...freeTierResponse, _debug: steps, _error: err.message });
    return res.status(500).json({ error: err.message });
  }
}
