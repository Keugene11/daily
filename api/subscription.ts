import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

const ALL_FEATURES = ['multiDay', 'cloudSync', 'recurring', 'antiRoutine', 'dateNight', 'dietary', 'accessible', 'mood', 'energy'];

const FREE_PLAN_LIMIT = 3; // plans per month

/** Sum plan_count from usage table for the current calendar month */
async function getMonthlyUsage(userId: string): Promise<number> {
  const monthStart = new Date().toISOString().slice(0, 7) + '-01';
  const { data: rows } = await supabase
    .from('usage')
    .select('plan_count')
    .eq('user_id', userId)
    .gte('date', monthStart);
  return (rows || []).reduce((sum: number, row: any) => sum + (row.plan_count ?? 0), 0);
}

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
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const debug = req.query.debug === '1';
  const steps: string[] = [];

  const freeTierResponse = {
    tier: 'free' as const,
    interval: null,
    period: 'month' as const,
    limits: { plans: FREE_PLAN_LIMIT },
    usage: { plans: 0 },
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
      if (debug) return res.status(401).json({ error: 'auth_failed', _debug: steps });
      return res.status(401).json({ error: 'auth_failed', message: authError?.message || 'Invalid token' });
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

    // If DB already says pro and period is valid, return early (with interval from Stripe)
    if (subRow?.plan_type === 'pro' && subRow?.status === 'active' &&
        subRow?.current_period_end && new Date(subRow.current_period_end) > new Date()) {
      steps.push('DB says pro — getting interval from Stripe');
      let interval: 'monthly' | 'yearly' | null = null;
      if (subRow.stripe_customer_id) {
        try {
          const subs = await stripe.subscriptions.list({
            customer: subRow.stripe_customer_id,
            status: 'active',
            limit: 1,
          });
          if (subs.data.length > 0) {
            const recurringInterval = (subs.data[0] as any).items?.data?.[0]?.price?.recurring?.interval;
            if (recurringInterval === 'year') interval = 'yearly';
            else if (recurringInterval === 'month') interval = 'monthly';
          }
        } catch { /* interval stays null */ }
      }
      steps.push(`Returning pro, interval=${interval}`);
      console.log(`[Subscription] DB says pro, interval=${interval}, returning`);
      const proResponse = {
        tier: 'pro' as const,
        interval,
        period: 'month' as const,
        limits: { plans: -1 },
        usage: { plans: 0 },
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
      const used = await getMonthlyUsage(userId);
      const freeWithUsage = { ...freeTierResponse, usage: { plans: used } };
      if (debug) return res.json({ ...freeWithUsage, _debug: steps });
      return res.json(freeWithUsage);
    }

    // 3. Check Stripe for active subscriptions (recurring plans)
    let tier: 'free' | 'pro' = 'free';
    let periodEnd: string | null = null;
    let interval: 'monthly' | 'yearly' | null = null;

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
      // Determine billing interval from Stripe price
      const recurringInterval = activeSub.items?.data?.[0]?.price?.recurring?.interval;
      if (recurringInterval === 'year') interval = 'yearly';
      else if (recurringInterval === 'month') interval = 'monthly';
      steps.push(`Subscription found! periodEnd=${periodEnd}, interval=${interval}`);
      console.log(`[Subscription] Stripe active subscription, periodEnd=${periodEnd}, interval=${interval}`);
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

    steps.push(`Final tier=${tier}, interval=${interval}`);
    console.log(`[Subscription] Final tier=${tier}, interval=${interval}`);
    const used = tier === 'free' ? await getMonthlyUsage(userId) : 0;
    const response = {
      tier,
      interval,
      period: 'month' as const,
      limits: { plans: tier === 'pro' ? -1 : FREE_PLAN_LIMIT },
      usage: { plans: used },
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
