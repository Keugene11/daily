import React from 'react';
import type { TierName } from '../hooks/useSubscription';

// Price IDs — set these after creating products in Stripe Dashboard
const PRICE_IDS = {
  starter: import.meta.env.VITE_STRIPE_STARTER_PRICE_ID || '',
  pro: import.meta.env.VITE_STRIPE_PRO_PRICE_ID || '',
  lifetime: import.meta.env.VITE_STRIPE_LIFETIME_PRICE_ID || '',
};

interface Props {
  currentTier: TierName;
  onCheckout: (priceId: string) => Promise<void>;
  onClose: () => void;
}

const tiers = [
  {
    name: 'Free',
    tier: 'free' as TierName,
    price: '$0',
    period: '',
    features: ['1 plan per day', '1 explore search per day', 'Single-day plans'],
    cta: 'Current plan',
  },
  {
    name: 'Starter',
    tier: 'starter' as TierName,
    price: '$9',
    period: '/month',
    features: ['15 plans per month', '30 explore searches per month', 'Multi-day trips (2-7 days)', 'Cloud sync'],
    cta: 'Upgrade',
    priceId: PRICE_IDS.starter,
  },
  {
    name: 'Pro',
    tier: 'pro' as TierName,
    price: '$39',
    period: '/month',
    features: ['Unlimited plans', 'Unlimited explore searches', 'All Starter features', 'Recurring plans', 'Date night mode', 'Dietary & accessibility filters', 'Mood & energy filters', 'Anti-routine mode'],
    cta: 'Go Pro',
    priceId: PRICE_IDS.pro,
    popular: true,
  },
  {
    name: 'Lifetime',
    tier: 'lifetime' as TierName,
    price: '$99',
    period: ' one-time',
    features: ['Everything in Pro', 'Pay once, keep forever', 'All future features included'],
    cta: 'Get Lifetime',
    priceId: PRICE_IDS.lifetime,
  },
];

export const PricingModal: React.FC<Props> = ({ currentTier, onCheckout, onClose }) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-surface rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto p-6 sm:p-8" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-8">
          <div>
            <h2 className="text-2xl font-semibold">Choose your plan</h2>
            <p className="text-sm text-on-surface/40 mt-1">Unlock more plans, searches, and premium features.</p>
          </div>
          <button onClick={onClose} className="text-on-surface/40 hover:text-on-surface text-xl leading-none">&times;</button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {tiers.map(t => {
            const isCurrent = t.tier === currentTier;
            const isUpgrade = !isCurrent && t.tier !== 'free';

            return (
              <div
                key={t.tier}
                className={`relative rounded-xl border p-5 flex flex-col ${
                  t.popular ? 'border-accent bg-accent/5' : 'border-on-surface/10'
                } ${isCurrent ? 'ring-2 ring-accent' : ''}`}
              >
                {t.popular && (
                  <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-accent text-on-accent text-[10px] font-bold uppercase tracking-wider px-3 py-0.5 rounded-full">
                    Popular
                  </span>
                )}

                <h3 className="font-semibold text-lg">{t.name}</h3>
                <div className="mt-2 mb-4">
                  <span className="text-3xl font-bold">{t.price}</span>
                  <span className="text-sm text-on-surface/40">{t.period}</span>
                </div>

                <ul className="flex-1 space-y-2 mb-6">
                  {t.features.map(f => (
                    <li key={f} className="text-sm text-on-surface/60 flex items-start gap-2">
                      <span className="text-accent mt-0.5">&#10003;</span>
                      {f}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => {
                    if (!isUpgrade) return;
                    if (!t.priceId) {
                      alert(`Price ID not configured for ${t.name}. Check VITE_STRIPE_*_PRICE_ID env vars.`);
                      return;
                    }
                    onCheckout(t.priceId);
                  }}
                  disabled={isCurrent || !isUpgrade}
                  className={`w-full py-2.5 rounded-full text-sm font-medium transition-all ${
                    isCurrent
                      ? 'bg-on-surface/10 text-on-surface/40 cursor-default'
                      : isUpgrade
                      ? 'bg-accent text-on-accent hover:bg-accent/90 cursor-pointer'
                      : 'bg-on-surface/5 text-on-surface/30 cursor-default'
                  }`}
                >
                  {isCurrent ? 'Current plan' : t.cta}
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
