import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '');

export type TierName = 'free' | 'pro';

interface TierConfig {
  planLimit: number;
  period: 'day' | 'week' | 'month';
  features: Set<string>;
}

export const TIERS: Record<TierName, TierConfig> = {
  free: {
    planLimit: 3,
    period: 'month',
    features: new Set(['multiDay', 'cloudSync', 'recurring', 'antiRoutine', 'dateNight', 'dietary', 'accessible', 'mood', 'energy']),
  },
  pro: {
    planLimit: Infinity,
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

  // Unknown price ID — log a warning but do NOT default to pro.
  // Only explicitly configured price IDs should grant pro access.
  if (priceId) {
    console.warn(`[Stripe] Unknown price ID "${priceId}" — returning free. Check STRIPE_MONTHLY_PRICE_ID / STRIPE_YEARLY_PRICE_ID env vars.`);
  }

  return 'free';
}
