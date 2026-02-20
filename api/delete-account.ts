import type { VercelRequest, VercelResponse } from '@vercel/node';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');
const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

/**
 * DELETE /api/delete-account
 *
 * Permanently deletes the user's account:
 * 1. Cancels any active Stripe subscriptions
 * 2. Deletes subscription + usage rows from Supabase
 * 3. Deletes the user from Supabase Auth
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'DELETE, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'DELETE') return res.status(405).json({ error: 'Method not allowed' });

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token' });
  }

  try {
    const token = authHeader.slice(7);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    // If user already deleted from auth, extract ID from JWT to clean up DB rows
    let userId: string;
    let userEmail: string | undefined;

    if (authError || !user) {
      // Try to decode JWT to get user ID for cleanup
      try {
        const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString());
        userId = payload.sub;
        userEmail = payload.email;
        console.log(`[DeleteAccount] Auth user gone, cleaning up from JWT: userId=${userId}`);
      } catch {
        return res.status(401).json({ error: 'Invalid token' });
      }
    } else {
      userId = user.id;
      userEmail = user.email;
    }
    console.log(`[DeleteAccount] Starting for userId=${userId}, email=${userEmail}`);

    // 1. Get Stripe customer ID and cancel active subscriptions
    const { data: subRow } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('user_id', userId)
      .single();

    let customerId = subRow?.stripe_customer_id || null;

    // Also search by email if no customer ID in DB
    if (!customerId && userEmail) {
      const customers = await stripe.customers.list({ email: userEmail, limit: 1 });
      if (customers.data.length > 0) {
        customerId = customers.data[0].id;
      }
    }

    if (customerId) {
      // Cancel all active subscriptions
      const subs = await stripe.subscriptions.list({ customer: customerId, status: 'active' });
      for (const sub of subs.data) {
        await stripe.subscriptions.cancel(sub.id);
        console.log(`[DeleteAccount] Canceled subscription ${sub.id}`);
      }
    }

    // 2. Delete from subscriptions table
    await supabase.from('subscriptions').delete().eq('user_id', userId);
    console.log(`[DeleteAccount] Deleted subscriptions row`);

    // 3. Delete from usage table
    await supabase.from('usage').delete().eq('user_id', userId);
    console.log(`[DeleteAccount] Deleted usage rows`);

    // 4. Delete user from Supabase Auth (skip if already gone)
    const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);
    if (deleteError) {
      console.warn(`[DeleteAccount] Auth delete note:`, deleteError.message);
      // Don't fail — user may already be deleted from a previous attempt
    } else {
      console.log(`[DeleteAccount] Deleted auth user`);
    }

    return res.json({ success: true });
  } catch (err: any) {
    console.error('[DeleteAccount] Error:', err);
    return res.status(500).json({ error: err.message });
  }
}
