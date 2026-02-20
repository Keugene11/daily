import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

function getTierForPrice(priceId: string): 'free' | 'pro' {
  const monthlyId = process.env.STRIPE_MONTHLY_PRICE_ID;
  const yearlyId = process.env.STRIPE_YEARLY_PRICE_ID;
  if (monthlyId && priceId === monthlyId) return 'pro';
  if (yearlyId && priceId === yearlyId) return 'pro';
  if (priceId && priceId.startsWith('price_')) return 'pro';
  return 'free';
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.json({
      tier: 'free',
      period: 'day',
      limits: { plans: -1, explores: -1 },
      usage: { plans: 0, explores: 0 },
      features: ['multiDay', 'cloudSync', 'recurring', 'antiRoutine', 'dateNight', 'dietary', 'accessible', 'mood', 'energy'],
    });
  }

  try {
    const token = authHeader.slice(7);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      console.log(`[Subscription-standalone] Auth failed: ${authError?.message}`);
      return res.json({
        tier: 'free',
        period: 'day',
        limits: { plans: -1, explores: -1 },
        usage: { plans: 0, explores: 0 },
        features: ['multiDay', 'cloudSync', 'recurring', 'antiRoutine', 'dateNight', 'dietary', 'accessible', 'mood', 'energy'],
      });
    }

    let tier: 'free' | 'pro' = 'free';

    // 1. Check DB
    const { data: subRow } = await supabase
      .from('subscriptions')
      .select('plan_type, status, current_period_end, stripe_customer_id')
      .eq('user_id', user.id)
      .single();

    console.log(`[Subscription-standalone] userId=${user.id}, dbRow=${JSON.stringify(subRow)}`);

    if (subRow?.plan_type === 'pro' && subRow?.status === 'active' &&
        subRow?.current_period_end && new Date(subRow.current_period_end) > new Date()) {
      tier = 'pro';
      console.log(`[Subscription-standalone] DB says pro`);
    }

    // 2. If still free but has Stripe customer, check Stripe directly
    if (tier === 'free' && subRow?.stripe_customer_id) {
      console.log(`[Subscription-standalone] Checking Stripe for ${subRow.stripe_customer_id}...`);
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

        console.log(`[Subscription-standalone] Stripe active: tier=${syncedTier}, periodEnd=${periodEnd}`);

        await supabase
          .from('subscriptions')
          .update({
            plan_type: syncedTier,
            status: 'active',
            current_period_end: periodEnd,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user.id);

        tier = syncedTier;
      } else {
        console.log(`[Subscription-standalone] No active Stripe subs`);
      }
    }

    console.log(`[Subscription-standalone] Final tier=${tier}`);

    return res.json({
      tier,
      period: tier === 'pro' ? 'month' : 'day',
      limits: { plans: -1, explores: -1 },
      usage: { plans: 0, explores: 0 },
      features: ['multiDay', 'cloudSync', 'recurring', 'antiRoutine', 'dateNight', 'dietary', 'accessible', 'mood', 'energy'],
    });
  } catch (err: any) {
    console.error('[Subscription-standalone] Error:', err);
    return res.status(500).json({ error: err.message });
  }
}
