import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

/**
 * GET /api/sync-subscription
 *
 * Syncs the user's subscription status from Stripe → Supabase.
 * Works even if:
 *  - No subscription row exists yet
 *  - No stripe_customer_id is saved (searches by email)
 *  - The purchase was a one-time payment (not a subscription)
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token' });
  }

  try {
    const token = authHeader.slice(7);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const userId = user.id;
    const userEmail = user.email;
    console.log(`[Sync] userId=${userId}, email=${userEmail}`);

    // 1. Get existing subscription row
    const { data: subRow } = await supabase
      .from('subscriptions')
      .select('plan_type, status, current_period_end, stripe_customer_id')
      .eq('user_id', userId)
      .single();

    let customerId = subRow?.stripe_customer_id || null;
    console.log(`[Sync] DB row: ${JSON.stringify(subRow)}`);

    // 2. If DB already says pro and period is valid, return early
    if (subRow?.plan_type === 'pro' && subRow?.status === 'active' &&
        subRow?.current_period_end && new Date(subRow.current_period_end) > new Date()) {
      console.log(`[Sync] DB already says pro, returning`);
      return res.json({ tier: 'pro', synced: false, userId });
    }

    // 3. If no customer ID in DB, search Stripe by email
    if (!customerId && userEmail) {
      console.log(`[Sync] No customer ID in DB, searching Stripe by email: ${userEmail}`);
      const customers = await stripe.customers.list({ email: userEmail, limit: 1 });
      if (customers.data.length > 0) {
        customerId = customers.data[0].id;
        console.log(`[Sync] Found customer by email: ${customerId}`);

        // Save customer ID to DB immediately
        await supabase
          .from('subscriptions')
          .upsert({
            user_id: userId,
            stripe_customer_id: customerId,
            plan_type: subRow?.plan_type || 'free',
            status: subRow?.status || 'active',
            current_period_end: subRow?.current_period_end || null,
            updated_at: new Date().toISOString(),
          }, { onConflict: 'user_id' });
      } else {
        console.log(`[Sync] No Stripe customer found for email ${userEmail}`);
        return res.json({ tier: 'free', synced: false, userId });
      }
    }

    if (!customerId) {
      console.log(`[Sync] No customer ID available, returning free`);
      return res.json({ tier: 'free', synced: false, userId });
    }

    // 4. Check for active Stripe subscriptions (for recurring plans)
    let tier = 'free';
    let periodEnd: string | null = null;
    let synced = false;

    const subs = await stripe.subscriptions.list({
      customer: customerId,
      status: 'active',
      limit: 1,
    });

    if (subs.data.length > 0) {
      const activeSub = subs.data[0] as any;
      periodEnd = new Date(activeSub.current_period_end * 1000).toISOString();
      tier = 'pro';
      synced = true;
      console.log(`[Sync] Found active subscription, periodEnd=${periodEnd}`);
    }

    // 5. If no active subscription, check for completed one-time payment sessions
    if (tier === 'free') {
      console.log(`[Sync] No active subscription, checking checkout sessions...`);
      const sessions = await stripe.checkout.sessions.list({
        customer: customerId,
        status: 'complete',
        limit: 10,
      });

      for (const session of sessions.data) {
        if (session.mode === 'payment' && session.payment_status === 'paid') {
          // One-time payment — set a 1-year expiry from payment date
          const paidAt = new Date((session.created || 0) * 1000);
          const expiresAt = new Date(paidAt);
          expiresAt.setFullYear(expiresAt.getFullYear() + 1);

          if (expiresAt > new Date()) {
            tier = 'pro';
            periodEnd = expiresAt.toISOString();
            synced = true;
            console.log(`[Sync] Found one-time payment from ${paidAt.toISOString()}, expires ${periodEnd}`);
            break;
          }
        }
      }
    }

    // 6. Update DB with synced tier
    if (synced) {
      const { error: updateError } = await supabase
        .from('subscriptions')
        .upsert({
          user_id: userId,
          stripe_customer_id: customerId,
          plan_type: tier,
          status: 'active',
          current_period_end: periodEnd,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'user_id' });

      if (updateError) {
        console.error(`[Sync] DB update failed:`, updateError);
      } else {
        console.log(`[Sync] DB updated: tier=${tier}, periodEnd=${periodEnd}`);
      }
    }

    console.log(`[Sync] Final: tier=${tier}, synced=${synced}`);
    return res.json({ tier, synced, userId });
  } catch (err: any) {
    console.error('[Sync] Error:', err);
    return res.status(500).json({ error: err.message });
  }
}
