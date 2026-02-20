import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

export type TierName = 'free' | 'pro';

interface TierConfig {
  planLimit: number;
  exploreLimit: number;
  period: 'day' | 'month';
  features: Set<string>;
}

export const TIERS: Record<TierName, TierConfig> = {
  free: {
    planLimit: 1,
    exploreLimit: 1,
    period: 'day',
    features: new Set(),
  },
  pro: {
    planLimit: Infinity,
    exploreLimit: Infinity,
    period: 'month',
    features: new Set(['multiDay', 'cloudSync', 'recurring', 'antiRoutine', 'dateNight', 'dietary', 'accessible', 'mood', 'energy']),
  },
};

// Map Stripe Price IDs to tier names — both monthly and yearly map to 'pro'
export const PRICE_TO_TIER: Record<string, TierName> = {
  [process.env.STRIPE_MONTHLY_PRICE_ID || '']: 'pro',
  [process.env.STRIPE_YEARLY_PRICE_ID || '']: 'pro',
};

export function getTierForPrice(priceId: string): TierName {
  return PRICE_TO_TIER[priceId] || 'free';
}
