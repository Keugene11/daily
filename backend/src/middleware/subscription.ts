import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth';
import { supabaseAdmin } from '../lib/supabase-admin';
import { stripe, TIERS, TierName, getTierForPrice } from '../lib/stripe';

export interface SubscriptionRequest extends AuthenticatedRequest {
  tier?: TierName;
  features?: Set<string>;
}

export async function checkSubscription(req: SubscriptionRequest, _res: Response, next: NextFunction) {
  if (!req.userId) {
    req.tier = 'free';
    req.features = TIERS.free.features;
    return next();
  }

  try {
    const { data } = await supabaseAdmin
      .from('subscriptions')
      .select('plan_type, status, current_period_end, stripe_customer_id')
      .eq('user_id', req.userId)
      .single();

    let tier: TierName = 'free';

    if (data && data.status === 'active') {
      const planType = data.plan_type as TierName;
      if (planType === 'pro' && data.current_period_end && new Date(data.current_period_end) > new Date()) {
        tier = 'pro';
      }
    }

    // Fallback: if DB says free but user has a Stripe customer, check Stripe directly
    // This handles cases where the webhook was missed or failed
    if (tier === 'free' && data?.stripe_customer_id) {
      try {
        const subs = await stripe.subscriptions.list({
          customer: data.stripe_customer_id,
          status: 'active',
          limit: 1,
        });

        if (subs.data.length > 0) {
          const activeSub = subs.data[0] as any;
          const priceId = activeSub.items.data[0]?.price?.id || '';
          const syncedTier = getTierForPrice(priceId);
          const periodEnd = new Date(activeSub.current_period_end * 1000).toISOString();

          console.log(`[Subscription] Stripe sync: user ${req.userId} has active sub, updating to ${syncedTier}`);

          // Update DB so future requests don't need to hit Stripe
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
        }
      } catch (syncErr) {
        console.warn('[Subscription] Stripe sync failed:', syncErr);
      }
    }

    req.tier = tier;
    req.features = TIERS[tier].features;
  } catch {
    req.tier = 'free';
    req.features = TIERS.free.features;
  }

  next();
}
