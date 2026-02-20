import React, { useState } from 'react';
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

export const PricingModal: React.FC<Props> = ({ currentTier, onCheckout, onClose }) => {
  const [billing, setBilling] = useState<'monthly' | 'yearly'>('yearly');
  const isPro = currentTier === 'pro';

  const handleCheckout = () => {
    const priceId = billing === 'monthly' ? PRICE_IDS.monthly : PRICE_IDS.yearly;
    if (!priceId) {
      alert(`Price ID not configured. Check VITE_STRIPE_${billing.toUpperCase()}_PRICE_ID env var.`);
      return;
    }
    onCheckout(priceId);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-surface rounded-2xl max-w-md w-full p-6 sm:p-8" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-semibold">Upgrade to Pro</h2>
          <button onClick={onClose} className="text-on-surface/40 hover:text-on-surface text-xl leading-none">&times;</button>
        </div>

        {isPro ? (
          <p className="text-on-surface/60 text-center py-8">You're already on the Pro plan!</p>
        ) : (
          <>
            {/* Billing toggle */}
            <div className="flex items-center justify-center gap-2 mb-6">
              <button
                onClick={() => setBilling('monthly')}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                  billing === 'monthly' ? 'bg-accent text-on-accent' : 'text-on-surface/50 hover:text-on-surface'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setBilling('yearly')}
                className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all ${
                  billing === 'yearly' ? 'bg-accent text-on-accent' : 'text-on-surface/50 hover:text-on-surface'
                }`}
              >
                Yearly
              </button>
            </div>

            {/* Price */}
            <div className="text-center mb-6">
              <span className="text-4xl font-bold">{billing === 'monthly' ? '$19' : '$99'}</span>
              <span className="text-on-surface/40 text-sm">{billing === 'monthly' ? '/month' : '/year'}</span>
              {billing === 'yearly' && (
                <p className="text-accent text-xs mt-1 font-medium">Save 57% vs monthly</p>
              )}
            </div>

            {/* Features */}
            <ul className="space-y-2.5 mb-8">
              {[
                'Unlimited plans',
                'Unlimited explore searches',
                'Multi-day trips',
                'Date night mode',
                'Dietary & accessibility filters',
                'Mood & energy filters',
                'Anti-routine mode',
                'All future features',
              ].map(f => (
                <li key={f} className="text-sm text-on-surface/60 flex items-center gap-2.5">
                  <span className="text-accent">&#10003;</span>
                  {f}
                </li>
              ))}
            </ul>

            <button
              onClick={handleCheckout}
              className="w-full py-3 rounded-full bg-accent text-on-accent font-medium hover:bg-accent/90 transition-all"
            >
              Get Pro
            </button>

            <p className="text-[11px] text-on-surface/30 text-center mt-3">Cancel anytime. Instant access.</p>
          </>
        )}
      </div>
    </div>
  );
};
