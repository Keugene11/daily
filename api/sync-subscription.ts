import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token' });
  }

  try {
    // Verify user via Supabase
    const token = authHeader.slice(7);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Get subscription row
    const { data: subRow } = await supabase
      .from('subscriptions')
      .select('plan_type, status, current_period_end, stripe_customer_id')
      .eq('user_id', user.id)
      .single();

    let tier = 'free';
    let synced = false;

    // Check if DB already says pro
    if (subRow?.plan_type === 'pro' && subRow?.status === 'active' &&
        subRow?.current_period_end && new Date(subRow.current_period_end) > new Date()) {
      tier = 'pro';
    }

    // If still free but has a Stripe customer, check Stripe directly
    if (tier === 'free' && subRow?.stripe_customer_id) {
      const subs = await stripe.subscriptions.list({
        customer: subRow.stripe_customer_id,
        status: 'active',
        limit: 1,
      });

      if (subs.data.length > 0) {
        const activeSub = subs.data[0] as any;
        const periodEnd = new Date(activeSub.current_period_end * 1000).toISOString();

        await supabase
          .from('subscriptions')
          .update({
            plan_type: 'pro',
            status: 'active',
            current_period_end: periodEnd,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', user.id);

        tier = 'pro';
        synced = true;
      }
    }

    return res.json({ tier, synced, userId: user.id });
  } catch (err: any) {
    console.error('[sync-subscription] Error:', err);
    return res.status(500).json({ error: err.message });
  }
}
