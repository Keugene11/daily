import React from 'react';
import type { TierName } from '../hooks/useSubscription';

const PRICE_IDS = {
  monthly: import.meta.env.VITE_STRIPE_MONTHLY_PRICE_ID || '',
  yearly: import.meta.env.VITE_STRIPE_YEARLY_PRICE_ID || '',
};

interface Props {
  currentTier: TierName;
  onCheckout: (priceId: string) => Promise<void>;
  onClose: () => void;
}

const features = [
  'Unlimited plans',
  'Unlimited explore searches',
  'Multi-day trips',
  'All future features',
];

const plans = [
  {
    name: 'Monthly',
    price: '$19',
    period: '/month',
    priceId: PRICE_IDS.monthly,
    envKey: 'MONTHLY',
  },
  {
    name: 'Yearly',
    price: '$99',
    period: '/year',
    priceId: PRICE_IDS.yearly,
    envKey: 'YEARLY',
    badge: 'Save 57%',
  },
];

export const PricingModal: React.FC<Props> = ({ currentTier, onCheckout, onClose }) => {
  const isPro = currentTier === 'pro';

  const handleCheckout = (plan: typeof plans[0]) => {
    if (!plan.priceId) {
      alert(`Price ID not configured. Check VITE_STRIPE_${plan.envKey}_PRICE_ID env var.`);
      return;
    }
    onCheckout(plan.priceId);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-surface rounded-2xl max-w-lg w-full p-6 sm:p-8" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-semibold">Upgrade to Pro</h2>
          <button onClick={onClose} className="text-on-surface/40 hover:text-on-surface text-xl leading-none">&times;</button>
        </div>

        {isPro ? (
          <p className="text-on-surface/60 text-center py-8">You're already on the Pro plan!</p>
        ) : (
          <>
            {/* Features */}
            <ul className="space-y-2 mb-6">
              {features.map(f => (
                <li key={f} className="text-sm text-on-surface/60 flex items-center gap-2.5">
                  <span className="text-accent">&#10003;</span>
                  {f}
                </li>
              ))}
            </ul>

            {/* Plan cards */}
            <div className="grid grid-cols-2 gap-3 mb-4">
              {plans.map(plan => (
                <button
                  key={plan.name}
                  onClick={() => handleCheckout(plan)}
                  className="relative rounded-xl border border-on-surface/10 p-5 flex flex-col items-center hover:border-accent/50 hover:bg-accent/5 transition-all"
                >
                  {plan.badge && (
                    <span className="absolute -top-2.5 bg-accent text-on-accent text-[10px] font-bold uppercase tracking-wider px-3 py-0.5 rounded-full">
                      {plan.badge}
                    </span>
                  )}
                  <span className="text-sm text-on-surface/50 mb-1">{plan.name}</span>
                  <span className="text-3xl font-bold">{plan.price}</span>
                  <span className="text-xs text-on-surface/40">{plan.period}</span>
                </button>
              ))}
            </div>

            <p className="text-[11px] text-on-surface/30 text-center">Cancel anytime. Instant access.</p>
          </>
        )}
      </div>
    </div>
  );
};
