import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from './auth';
import { supabaseAdmin } from '../lib/supabase-admin';
import { TIERS, TierName } from '../lib/stripe';

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
      .select('plan_type, status, current_period_end')
      .eq('user_id', req.userId)
      .single();

    let tier: TierName = 'free';

    if (data && data.status === 'active') {
      const planType = data.plan_type as TierName;
      if (planType === 'lifetime') {
        tier = 'lifetime';
      } else if (data.current_period_end && new Date(data.current_period_end) > new Date()) {
        tier = planType;
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
