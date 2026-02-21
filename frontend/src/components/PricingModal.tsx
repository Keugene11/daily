import React, { useState } from 'react';
import type { TierName, BillingInterval } from '../hooks/useSubscription';

const PRICE_IDS = {
  monthly: import.meta.env.VITE_STRIPE_MONTHLY_PRICE_ID || '',
  yearly: import.meta.env.VITE_STRIPE_YEARLY_PRICE_ID || '',
};

interface Props {
  currentTier: TierName;
  currentInterval: BillingInterval;
  onCheckout: (priceId: string) => Promise<void>;
  onClose: () => void;
}

const freeFeatures = [
  '1 plan per week',
  'Multi-day trip planning',
  'Real-time weather & events',
  'Restaurant recommendations',
  'Spotify soundtracks',
  'Cloud sync',
];

const monthlyFeatures = [
  'Unlimited plans',
  'Anti-routine mode',
  'Dietary & accessibility filters',
  'Priority support',
];

const yearlyFeatures = [
  'Everything in Monthly',
  'Early access to new features',
  'All future features included',
];

export const PricingModal: React.FC<Props> = ({ currentTier, currentInterval, onCheckout, onClose }) => {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  const isFree = currentTier === 'free';
  const isMonthly = currentTier === 'pro' && currentInterval === 'monthly';
  const isYearly = currentTier === 'pro' && currentInterval === 'yearly';

  const handleCheckout = async (priceId: string, envKey: string) => {
    if (!priceId) {
      alert(`Price ID not configured. Check VITE_STRIPE_${envKey}_PRICE_ID env var.`);
      return;
    }
    setLoadingPlan(envKey);
    await onCheckout(priceId);
    setLoadingPlan(null);
  };

  const getMonthlyButtonLabel = () => {
    if (isMonthly) return 'Current Plan';
    if (isYearly) return 'Included';
    return 'Get Monthly';
  };

  const getYearlyButtonLabel = () => {
    if (isYearly) return 'Current Plan';
    if (isMonthly) return 'Upgrade to Yearly';
    return 'Get Yearly';
  };

  const isMonthlyDisabled = isMonthly || isYearly || !!loadingPlan;
  const isYearlyDisabled = isYearly || !!loadingPlan;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div className="bg-surface rounded-2xl max-w-3xl w-full p-6 sm:p-8" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-semibold">Plans</h2>
          <button onClick={onClose} className="text-on-surface/40 hover:text-on-surface text-xl leading-none">&times;</button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Free */}
          <div className={`relative rounded-xl border p-6 flex flex-col ${isFree ? 'border-accent/40 bg-accent/5' : 'border-on-surface/10'}`}>
            {isFree && (
              <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-accent text-on-accent text-[10px] font-bold uppercase tracking-wider px-3 py-0.5 rounded-full">
                Current
              </span>
            )}
            <div className="mb-5">
              <span className="text-sm text-on-surface/50">Free</span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-4xl font-bold">$0</span>
              </div>
            </div>

            <ul className="space-y-2.5 mb-6 flex-1">
              {freeFeatures.map(f => (
                <li key={f} className="text-sm text-on-surface/60 flex items-center gap-2.5">
                  <span className="text-accent">&#10003;</span>
                  {f}
                </li>
              ))}
            </ul>

            <div className={`w-full py-3 font-medium rounded-full text-sm text-center ${
              isFree ? 'border border-on-surface/10 text-on-surface/30' : 'border border-on-surface/10 text-on-surface/30'
            }`}>
              {isFree ? 'Current Plan' : 'Included'}
            </div>
          </div>

          {/* Monthly */}
          <div className={`relative rounded-xl border p-6 flex flex-col ${isMonthly ? 'border-accent/40 bg-accent/5' : 'border-on-surface/10'}`}>
            {isMonthly && (
              <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-accent text-on-accent text-[10px] font-bold uppercase tracking-wider px-3 py-0.5 rounded-full">
                Current
              </span>
            )}
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
              disabled={isMonthlyDisabled}
              className={`w-full py-3 font-medium rounded-full text-sm transition-all flex items-center justify-center gap-2 ${
                isMonthly || isYearly
                  ? 'border border-on-surface/10 text-on-surface/30 cursor-not-allowed'
                  : 'border border-on-surface/20 text-on-surface/80 hover:bg-on-surface/5 disabled:opacity-50 disabled:cursor-not-allowed'
              }`}
            >
              {loadingPlan === 'MONTHLY' ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
                  Redirecting...
                </>
              ) : getMonthlyButtonLabel()}
            </button>
          </div>

          {/* Yearly */}
          <div className="relative rounded-xl border border-accent/40 bg-accent/5 p-6 flex flex-col">
            <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 bg-accent text-on-accent text-[10px] font-bold uppercase tracking-wider px-3 py-0.5 rounded-full">
              {isYearly ? 'Current' : 'Save 57%'}
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
              disabled={isYearlyDisabled}
              className={`w-full py-3 font-medium rounded-full text-sm transition-all flex items-center justify-center gap-2 ${
                isYearly
                  ? 'border border-on-surface/10 text-on-surface/30 cursor-not-allowed'
                  : 'bg-accent text-on-accent hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed'
              }`}
            >
              {loadingPlan === 'YEARLY' ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" /></svg>
                  Redirecting...
                </>
              ) : getYearlyButtonLabel()}
            </button>
          </div>
        </div>

        <p className="text-[11px] text-on-surface/30 text-center mt-4">Cancel anytime. Instant access.</p>
      </div>
    </div>
  );
};
