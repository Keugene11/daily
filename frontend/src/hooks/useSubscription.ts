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

  // Sync subscription with Stripe via standalone endpoint (bypasses Express app cache)
  const syncSubscription = useCallback(async () => {
    try {
      const token = await getAccessToken();
      if (!token) {
        console.warn('[Subscription] No token for sync');
        return;
      }

      const res = await fetch(`${API_URL}/api/sync-subscription`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const result = await res.json();
        console.log('[Subscription] Sync result:', result);
      } else {
        const text = await res.text();
        console.error('[Subscription] Sync failed:', res.status, text);
      }
    } catch (err) {
      console.error('[Subscription] Sync error:', err);
    }
  }, [getAccessToken]);

  const fetchSubscription = useCallback(async () => {
    try {
      const token = await getAccessToken();
      if (!token) {
        console.warn('[Subscription] No token, skipping fetch');
        setData(null);
        setLoading(false);
        return;
      }

      // First sync with Stripe (fixes stale DB), then fetch full subscription data
      await syncSubscription();

      const res = await fetch(`${API_URL}/api/subscription?debug=1`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.ok) {
        const result = await res.json();
        console.log('[Subscription] Fetched:', result.tier, result);
        if (result._debug) {
          console.log('[Subscription] Debug steps:', result._debug);
        }
        setData(result);
      } else {
        const text = await res.text();
        console.error('[Subscription] Fetch failed:', res.status, text);
      }
    } catch (err) {
      console.error('[Subscription] Fetch error:', err);
    } finally {
      setLoading(false);
    }
  }, [getAccessToken, syncSubscription]);

  useEffect(() => {
    fetchSubscription();

    // Re-fetch aggressively if returning from Stripe checkout
    const params = new URLSearchParams(window.location.search);
    if (params.get('success') === '1') {
      window.history.replaceState({}, '', window.location.pathname);
      // Retry aggressively — sync endpoint now searches Stripe by email
      setTimeout(fetchSubscription, 500);
      setTimeout(fetchSubscription, 2000);
      setTimeout(fetchSubscription, 5000);
      setTimeout(fetchSubscription, 10000);
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
