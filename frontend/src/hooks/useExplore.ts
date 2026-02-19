import { useState, useCallback, useRef } from 'react';

const API_URL = import.meta.env.VITE_API_URL || '';

export interface ExploreResult {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  rating: number | null;
  userRatingCount: number;
  priceLevel: string | null;
  photoUrl: string | null;
  summary: string;
  googleMapsUrl: string;
  types: string[];
  isOpen: boolean | null;
}

interface UseExploreReturn {
  results: ExploreResult[];
  loading: boolean;
  error: string | null;
  searched: boolean;
  search: (query: string, location: string) => Promise<void>;
  reset: () => void;
}

export function useExplore(getAccessToken: () => Promise<string | null>): UseExploreReturn {
  const [results, setResults] = useState<ExploreResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searched, setSearched] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const search = useCallback(async (query: string, location: string) => {
    // Cancel any in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError(null);
    setSearched(true);
    setResults([]);

    try {
      const token = await getAccessToken();

      const res = await fetch(`${API_URL}/api/explore`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ query, location }),
        signal: controller.signal,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Search failed (${res.status})`);
      }

      const data = await res.json();
      setResults(data.results || []);
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      setError(err.message || 'Something went wrong');
    } finally {
      if (!controller.signal.aborted) {
        setLoading(false);
      }
    }
  }, [getAccessToken]);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setResults([]);
    setLoading(false);
    setError(null);
    setSearched(false);
  }, []);

  return { results, loading, error, searched, search, reset };
}
