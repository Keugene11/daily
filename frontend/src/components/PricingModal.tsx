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

const monthlyFeatures = [
  'Unlimited plans',
  'Unlimited explore searches',
  'Multi-day trips',
];

const yearlyFeatures = [
  'Everything in Monthly',
  'Priority support',
  'Early access to new features',
  'All future features included',
];

export const PricingModal: React.FC<Props> = ({ currentTier, onCheckout, onClose }) => {
  const isPro = currentTier === 'pro';

  const handleCheckout = (priceId: string, envKey: string) => {
    if (!priceId) {
      alert(`Price ID not configured. Check VITE_STRIPE_${envKey}_PRICE_ID env var.`);
      return;
    }
    onCheckout(priceId);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-surface rounded-2xl max-w-2xl w-full p-6 sm:p-8" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-semibold">Upgrade to Pro</h2>
          <button onClick={onClose} className="text-on-surface/40 hover:text-on-surface text-xl leading-none">&times;</button>
        </div>

        {isPro ? (
          <p className="text-on-surface/60 text-center py-8">You're already on the Pro plan!</p>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Monthly */}
              <div className="rounded-xl border border-on-surface/10 p-6 flex flex-col">
                <div className="mb-5">
                  <span className="text-sm text-on-surface/50">Monthly</span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-4xl font-bold">$19</span>
                    <span className="text-sm text-on-surface/40">/month</span>
                  </div>
                </div>

                <ul className="space-y-2.5 mb-6 flex-1">
                  {monthlyFeatures.map(f => (
                    <li key={f} className="text-sm text-on-surface/60 flex items-center gap-2.5">
                      <span className="text-accent">&#10003;</span>
                      {f}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleCheckout(PRICE_IDS.monthly, 'MONTHLY')}
                  className="w-full py-3 border border-on-surface/20 text-on-surface/80 font-medium rounded-full text-sm hover:bg-on-surface/5 transition-all"
                >
                  Get Monthly
                </button>
              </div>

              {/* Yearly */}
              <div className="relative rounded-xl border border-accent/40 bg-accent/5 p-6 flex flex-col">
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-accent text-on-accent text-[10px] font-bold uppercase tracking-wider px-3 py-0.5 rounded-full">
                  Save 57%
                </span>

                <div className="mb-5">
                  <span className="text-sm text-on-surface/50">Yearly</span>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-4xl font-bold">$99</span>
                    <span className="text-sm text-on-surface/40">/year</span>
                  </div>
                  <span className="text-xs text-on-surface/30 mt-1 block">~$8.25/month</span>
                </div>

                <ul className="space-y-2.5 mb-6 flex-1">
                  {yearlyFeatures.map(f => (
                    <li key={f} className="text-sm text-on-surface/60 flex items-center gap-2.5">
                      <span className="text-accent">&#10003;</span>
                      {f}
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => handleCheckout(PRICE_IDS.yearly, 'YEARLY')}
                  className="w-full py-3 bg-accent text-on-accent font-medium rounded-full text-sm hover:bg-accent/90 transition-all"
                >
                  Get Yearly
                </button>
              </div>
            </div>

            <p className="text-[11px] text-on-surface/30 text-center mt-4">Cancel anytime. Instant access.</p>
          </>
        )}
      </div>
    </div>
  );
};
