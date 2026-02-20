import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

export type TierName = 'free' | 'starter' | 'pro' | 'lifetime';

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
  starter: {
    planLimit: 15,
    exploreLimit: 30,
    period: 'month',
    features: new Set(['multiDay', 'cloudSync']),
  },
  pro: {
    planLimit: Infinity,
    exploreLimit: Infinity,
    period: 'month',
    features: new Set(['multiDay', 'cloudSync', 'recurring', 'antiRoutine', 'dateNight', 'dietary', 'accessible', 'mood', 'energy']),
  },
  lifetime: {
    planLimit: Infinity,
    exploreLimit: Infinity,
    period: 'month',
    features: new Set(['multiDay', 'cloudSync', 'recurring', 'antiRoutine', 'dateNight', 'dietary', 'accessible', 'mood', 'energy']),
  },
};

// Map Stripe Price IDs to tier names — set these after creating products in Stripe Dashboard
export const PRICE_TO_TIER: Record<string, TierName> = {
  [process.env.STRIPE_STARTER_PRICE_ID || '']: 'starter',
  [process.env.STRIPE_PRO_PRICE_ID || '']: 'pro',
  [process.env.STRIPE_LIFETIME_PRICE_ID || '']: 'lifetime',
};

export function getTierForPrice(priceId: string): TierName {
  return PRICE_TO_TIER[priceId] || 'free';
}
