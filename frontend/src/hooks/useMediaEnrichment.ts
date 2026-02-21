import { useState, useEffect, useRef } from 'react';
import { extractPlaces } from '../utils/extractPlaces';
import { geocodeCity } from '../utils/mapUtils';

const API_URL = import.meta.env.VITE_API_URL || '';

export interface PlaceMediaData {
  imageUrl?: string;
  videoId?: string;
}

// ── Media cache (localStorage, 3-day TTL, versioned) ────────────────
const MEDIA_CACHE_KEY = 'daily_mediacache';
const MEDIA_CACHE_TTL = 1 * 24 * 60 * 60 * 1000; // 1 day
// Bump to invalidate all cached media entries (forces re-fetch with new scoring)
const MEDIA_CACHE_VERSION = 11;

interface MediaCacheEntry {
  imageUrl?: string;
  videoId?: string;
  ts: number;
}

interface MediaCacheStore {
  _v?: number;
  [key: string]: MediaCacheEntry | number | undefined;
}

// In-memory cache to avoid repeated localStorage reads
let _mediaCacheInMemory: Record<string, MediaCacheEntry> | null = null;
let _mediaCacheDirty = false;
let _mediaCacheFlushTimer: ReturnType<typeof setTimeout> | null = null;

function getMediaCache(): Record<string, MediaCacheEntry> {
  if (!_mediaCacheInMemory) {
    try {
      const raw: MediaCacheStore = JSON.parse(localStorage.getItem(MEDIA_CACHE_KEY) || '{}');
      if (raw._v !== MEDIA_CACHE_VERSION) {
        localStorage.removeItem(MEDIA_CACHE_KEY);
        _mediaCacheInMemory = {};
      } else {
        const { _v, ...entries } = raw;
        _mediaCacheInMemory = entries as Record<string, MediaCacheEntry>;
      }
    } catch { _mediaCacheInMemory = {}; }
  }
  return _mediaCacheInMemory!;
}

function setMediaCache(cache: Record<string, MediaCacheEntry>) {
  _mediaCacheInMemory = cache;
  _mediaCacheDirty = true;
  // Debounce localStorage writes — flush after 2 seconds of inactivity
  if (_mediaCacheFlushTimer) clearTimeout(_mediaCacheFlushTimer);
  _mediaCacheFlushTimer = setTimeout(() => {
    if (_mediaCacheDirty && _mediaCacheInMemory) {
      try { localStorage.setItem(MEDIA_CACHE_KEY, JSON.stringify({ ..._mediaCacheInMemory, _v: MEDIA_CACHE_VERSION })); } catch {}
      _mediaCacheDirty = false;
    }
  }, 2000);
}

function getCachedMedia(place: string, city: string): PlaceMediaData | null {
  const cache = getMediaCache();
  const key = `${place}|||${city}`;
  const entry = cache[key];
  if (entry && Date.now() - entry.ts < MEDIA_CACHE_TTL) {
    return { imageUrl: entry.imageUrl, videoId: entry.videoId };
  }
  return null;
}

function cacheMedia(place: string, city: string, media: PlaceMediaData) {
  const cache = getMediaCache();
  cache[`${place}|||${city}`] = { imageUrl: media.imageUrl, videoId: media.videoId, ts: Date.now() };
  // Evict old entries if cache gets too large (> 300 entries)
  const keys = Object.keys(cache);
  if (keys.length > 300) {
    const sorted = keys.sort((a, b) => cache[a].ts - cache[b].ts);
    sorted.slice(0, keys.length - 200).forEach(k => delete cache[k]);
  }
  setMediaCache(cache);
}

async function fetchYouTubeVideoId(place: string, city: string, region: string, token?: string | null): Promise<string | null> {
  try {
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    // When place IS the city, search for a general overview video instead of
    // duplicating ("NYC NYC"). Backend appends "travel guide" suffix automatically.
    // Always include region for disambiguation (e.g., "Cornell New York" not just "Cornell").
    const isCity = place.toLowerCase() === city.toLowerCase();
    const query = isCity
      ? (region ? `${city} ${region} things to do` : `${city} things to do`)
      : region ? `${place} ${city} ${region}` : `${place} ${city}`;
    const res = await fetch(
      `${API_URL}/api/youtube-search?q=${encodeURIComponent(query)}`,
      { headers }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.videoId || null;
  } catch {
    return null;
  }
}

/**
 * Progressively fetches images + YouTube videos for places as they appear
 * in streaming content. Does NOT wait for streaming to finish — extracts
 * places on a debounce and fetches media for any new ones it hasn't seen yet.
 * Cached results (localStorage, 3-day TTL) are returned instantly.
 */
export function useMediaEnrichment(content: string, city: string, maxPlaces = 12, getAccessToken?: () => Promise<string | null>) {
  const [data, setData] = useState<Map<string, PlaceMediaData>>(new Map());
  const fetchedRef = useRef<Set<string>>(new Set());
  const prevCityRef = useRef(city);
  // Resolved state/region for geographic disambiguation in YouTube queries
  // e.g., "New York" for Ardsley — prevents returning Savannah, GA results
  const regionRef = useRef<string>('');
  // Resolved city name from Nominatim — when the user types a non-city name
  // (e.g., "Cornell" → resolvedCity is "Ithaca"), use the real city for searches.
  // Uses state (not ref) so the content effect re-runs when geocode resolves.
  // null = not yet resolved, '' = resolved but no different city found
  const [resolvedCity, setResolvedCity] = useState<string | null>(null);

  // Reset everything when the city changes (new plan)
  useEffect(() => {
    if (city !== prevCityRef.current) {
      prevCityRef.current = city;
      fetchedRef.current.clear();
      regionRef.current = '';
      setResolvedCity(null);
      setData(new Map());
    }
  }, [city]);

  // Resolve state + city name from Nominatim for geographic disambiguation.
  // Only use state (e.g. "New York" for Ardsley), NOT country — appending
  // "India" to "Akshardham Temple Delhi" dilutes into generic travel vlogs.
  // Must resolve BEFORE media fetching starts (resolvedCity is state, not ref).
  useEffect(() => {
    if (!city) return;
    geocodeCity(city).then(result => {
      if (result?.state) regionRef.current = result.state;
      setResolvedCity(result?.resolvedCity || '');
    }).catch(() => setResolvedCity(''));
  }, [city]);

  // Debounced extraction + fetch for new places
  useEffect(() => {
    // Wait for geocode to resolve before fetching — prevents race condition
    // where media fetches fire with the raw city name before resolvedCity is available
    if (!content || !city || resolvedCity === null) return;

    // Wait 400ms after last content change before extracting places.
    // During streaming this means we batch up new text rather than
    // running extraction on every single token.
    const timer = setTimeout(async () => {
      // Use the resolved city name for searches — e.g., "Cornell" → "Ithaca"
      // so Wikipedia/YouTube return results for the actual city, not the university
      const searchCity = resolvedCity || city;
      const extracted = extractPlaces(content, city, maxPlaces);
      // Always include the search city as the first "place" so we get a general
      // city overview/travel guide video (e.g., "Best things to do in Ithaca")
      const places = [searchCity, ...extracted.filter(p => p.toLowerCase() !== city.toLowerCase() && p.toLowerCase() !== searchCity.toLowerCase())];
      const newPlaces = places.filter(p => !fetchedRef.current.has(p));

      if (newPlaces.length === 0) return;

      // Mark them as in-flight so we never fetch twice
      newPlaces.forEach(p => fetchedRef.current.add(p));

      // Get token once for this batch
      const token = getAccessToken ? await getAccessToken() : null;

      // Separate cached (instant) from uncached (needs API) places
      const uncached: string[] = [];
      for (const place of newPlaces) {
        const cached = getCachedMedia(place, searchCity);
        if (cached) {
          // Instant — set from cache without any network call
          setData(prev => {
            const next = new Map(prev);
            next.set(place, cached);
            return next;
          });
        } else {
          uncached.push(place);
        }
      }

      // Fetch media for each uncached place (staggered to be polite to APIs)
      uncached.forEach(async (place, i) => {
        await new Promise(r => setTimeout(r, i * 50));

        const videoId = await fetchYouTubeVideoId(place, searchCity, regionRef.current, token);

        const media: PlaceMediaData = {
          videoId: videoId || undefined,
        };

        // Only cache successful results — failed lookups (YouTube blocked,
        // timeout, no match) should retry next time instead of being stuck
        // with no thumbnail for the full cache TTL.
        if (media.videoId) {
          cacheMedia(place, searchCity, media);
        }

        setData(prev => {
          const next = new Map(prev);
          next.set(place, media);
          return next;
        });
      });
    }, 400);

    return () => clearTimeout(timer);
  }, [content, city, resolvedCity]);

  return { data };
}
