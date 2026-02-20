import { useState, useEffect, useCallback } from 'react';

const API_URL = import.meta.env.VITE_API_URL || '';

export type TierName = 'free' | 'pro';

export interface SubscriptionData {
  tier: TierName;
  period: 'day' | 'month';
  limits: { plans: number; explores: number };
  usage: { plans: number; explores: number };
  features: string[];
}

interface UseSubscriptionReturn {
  data: SubscriptionData | null;
  loading: boolean;
  tier: TierName;
  features: Set<string>;
  hasFeature: (feature: string) => boolean;
  isLimitReached: (type: 'plan' | 'explore') => boolean;
  refresh: () => Promise<void>;
  createCheckout: (priceId: string) => Promise<void>;
  openPortal: () => Promise<void>;
}

export function useSubscription(getAccessToken: () => Promise<string | null>): UseSubscriptionReturn {
  const [data, setData] = useState<SubscriptionData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchSubscription = useCallback(async () => {
    try {
      const token = await getAccessToken();
      if (!token) {
        setData(null);
        setLoading(false);
        return;
      }

      const res = await fetch(`${API_URL}/api/subscription`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        setData(await res.json());
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, [getAccessToken]);

  useEffect(() => {
    fetchSubscription();

    // Re-fetch if returning from Stripe checkout
    const params = new URLSearchParams(window.location.search);
    if (params.get('success') === '1') {
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
      // Delay to let webhook process
      setTimeout(fetchSubscription, 2000);
    }
    if (params.get('canceled') === '1') {
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [fetchSubscription]);

  const tier = data?.tier || 'free';
  const features = new Set(data?.features || []);

  const hasFeature = useCallback((feature: string) => features.has(feature), [data?.features]);

  const isLimitReached = useCallback((type: 'plan' | 'explore') => {
    if (!data) return false;
    const limit = type === 'plan' ? data.limits.plans : data.limits.explores;
    const used = type === 'plan' ? data.usage.plans : data.usage.explores;
    if (limit === -1) return false; // unlimited
    return used >= limit;
  }, [data]);

  const createCheckout = useCallback(async (priceId: string) => {
    try {
      const token = await getAccessToken();
      if (!token) {
        alert('Not signed in. Please sign in first.');
        return;
      }

      const res = await fetch(`${API_URL}/api/checkout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ priceId }),
      });

      const text = await res.text();
      let data: any;
      try { data = JSON.parse(text); } catch { data = { error: text }; }

      if (!res.ok) {
        console.error('[Checkout] Error:', res.status, data);
        alert(`Checkout failed (${res.status}): ${data.error || text}`);
        return;
      }
      if (data.url) window.location.href = data.url;
    } catch (err: any) {
      console.error('[Checkout] Error:', err);
      alert(`Checkout error: ${err.message}`);
    }
  }, [getAccessToken]);

  const openPortal = useCallback(async () => {
    try {
      const token = await getAccessToken();
      if (!token) return;

      const res = await fetch(`${API_URL}/api/portal`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });

      const data = await res.json();
      if (!res.ok) {
        console.error('[Portal] Error:', data);
        alert(data.error || 'Failed to open portal');
        return;
      }
      if (data.url) window.location.href = data.url;
    } catch (err) {
      console.error('[Portal] Error:', err);
      alert('Failed to open portal. Check console for details.');
    }
  }, [getAccessToken]);

  return {
    data,
    loading,
    tier,
    features,
    hasFeature,
    isLimitReached,
    refresh: fetchSubscription,
    createCheckout,
    openPortal,
  };
}
