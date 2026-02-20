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
    planLimit: Infinity,
    exploreLimit: Infinity,
    period: 'day',
    features: new Set(['multiDay', 'cloudSync', 'recurring', 'antiRoutine', 'dateNight', 'dietary', 'accessible', 'mood', 'energy']),
  },
  pro: {
    planLimit: Infinity,
    exploreLimit: Infinity,
    period: 'month',
    features: new Set(['multiDay', 'cloudSync', 'recurring', 'antiRoutine', 'dateNight', 'dietary', 'accessible', 'mood', 'energy']),
  },
};

// Map Stripe Price IDs to tier names — both monthly and yearly map to 'pro'
export function getTierForPrice(priceId: string): TierName {
  const monthlyId = process.env.STRIPE_MONTHLY_PRICE_ID;
  const yearlyId = process.env.STRIPE_YEARLY_PRICE_ID;

  if (monthlyId && priceId === monthlyId) return 'pro';
  if (yearlyId && priceId === yearlyId) return 'pro';

  // Fallback: any non-empty price ID is a paid plan (all paid = pro)
  if (priceId && priceId.startsWith('price_')) {
    console.warn(`[Stripe] Unknown price ID "${priceId}" — defaulting to pro. Check STRIPE_MONTHLY_PRICE_ID / STRIPE_YEARLY_PRICE_ID env vars.`);
    return 'pro';
  }

  return 'free';
}
