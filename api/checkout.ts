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
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { priceId } = req.body || {};
  if (!priceId) {
    return res.status(400).json({ error: 'Missing priceId' });
  }

  // Auth
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const token = authHeader.slice(7);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const userId = user.id;
    const userEmail = user.email;
    console.log(`[Checkout-standalone] Start — priceId="${priceId}", userId=${userId}, email=${userEmail}`);

    // Find or create Stripe customer
    let customerId: string | undefined;

    // 1. Check DB for existing customer ID
    const { data: sub } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', userId)
      .single();

    if (sub?.stripe_customer_id) {
      customerId = sub.stripe_customer_id;
      console.log(`[Checkout-standalone] Existing customer from DB: ${customerId}`);
    }

    // 2. If no customer ID in DB, search Stripe by email
    if (!customerId && userEmail) {
      const existing = await stripe.customers.list({ email: userEmail, limit: 1 });
      if (existing.data.length > 0) {
        customerId = existing.data[0].id;
        console.log(`[Checkout-standalone] Found customer by email: ${customerId}`);
      }
    }

    // 3. Create new customer if needed
    if (!customerId) {
      const customer = await stripe.customers.create({
        ...(userEmail ? { email: userEmail } : {}),
        metadata: { supabase_user_id: userId },
      });
      customerId = customer.id;
      console.log(`[Checkout-standalone] Created new customer: ${customerId}`);
    }

    // 4. Always upsert subscription row to ensure stripe_customer_id is saved
    const { error: upsertError } = await supabase
      .from('subscriptions')
      .upsert({
        user_id: userId,
        stripe_customer_id: customerId,
        plan_type: 'free',
        status: 'active',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    if (upsertError) {
      console.error(`[Checkout-standalone] Upsert error:`, upsertError);
    } else {
      console.log(`[Checkout-standalone] Saved customer ID to DB`);
    }

    // 5. Determine checkout mode
    const price = await stripe.prices.retrieve(priceId);
    const mode = price.type === 'recurring' ? 'subscription' : 'payment';
    console.log(`[Checkout-standalone] Price type="${price.type}", mode="${mode}"`);

    // 6. Create checkout session
    const origin = (req.headers.origin as string) || (req.headers.referer ? new URL(req.headers.referer as string).origin : 'https://daily-three-xi.vercel.app');

    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      mode,
      success_url: `${origin}?success=1`,
      cancel_url: `${origin}?canceled=1`,
      metadata: { supabase_user_id: userId },
    });

    console.log(`[Checkout-standalone] Session created: ${session.id}, url=${session.url}`);
    return res.json({ url: session.url });
  } catch (err: any) {
    const msg = err?.message || 'Unknown error';
    console.error(`[Checkout-standalone] FAILED:`, msg, err);
    return res.status(500).json({ error: msg });
  }
}
