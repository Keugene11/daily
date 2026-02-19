import { useState, useCallback, useRef } from 'react';

const API_URL = import.meta.env.VITE_API_URL || '';

export interface ExplorePlace {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  rating: number | null;
  userRatingCount: number;
  priceLevel: string | null;
  photoUrl: string | null;
  googleMapsUrl: string;
  types: string[];
  isOpen: boolean | null;
}

interface UseExploreReturn {
  post: string;
  places: ExplorePlace[];
  loading: boolean;
  error: string | null;
  searched: boolean;
  search: (query: string, location: string) => Promise<void>;
  reset: () => void;
}

export function useExplore(getAccessToken: () => Promise<string | null>): UseExploreReturn {
  const [post, setPost] = useState('');
  const [places, setPlaces] = useState<ExplorePlace[]>([]);
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
    setPost('');
    setPlaces([]);

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
      setPost(data.post || '');
      setPlaces(data.places || []);
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
    setPost('');
    setPlaces([]);
    setLoading(false);
    setError(null);
    setSearched(false);
  }, []);

  return { post, places, loading, error, searched, search, reset };
}
