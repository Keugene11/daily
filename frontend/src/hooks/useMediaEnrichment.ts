import { useState, useEffect, useRef } from 'react';
import { extractPlaces } from '../utils/extractPlaces';

const API_URL = import.meta.env.VITE_API_URL || '';

export interface PlaceMediaData {
  imageUrl?: string;
  videoId?: string;
}

// ── Media cache (localStorage, 3-day TTL) ──────────────────────────
const MEDIA_CACHE_KEY = 'daily_mediacache';
const MEDIA_CACHE_TTL = 3 * 24 * 60 * 60 * 1000; // 3 days

interface MediaCacheEntry {
  imageUrl?: string;
  videoId?: string;
  ts: number;
}

function getMediaCache(): Record<string, MediaCacheEntry> {
  try {
    return JSON.parse(localStorage.getItem(MEDIA_CACHE_KEY) || '{}');
  } catch { return {}; }
}

function setMediaCache(cache: Record<string, MediaCacheEntry>) {
  try {
    localStorage.setItem(MEDIA_CACHE_KEY, JSON.stringify(cache));
  } catch { /* quota exceeded — ignore */ }
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

async function fetchWikipediaImage(place: string, city: string): Promise<string | null> {
  const queries = [`${place}, ${city}`, place];
  for (const q of queries) {
    try {
      const res = await fetch(
        `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(q)}`,
        { headers: { 'User-Agent': 'DailyPlannerApp/1.0' } }
      );
      if (!res.ok) continue;
      const data = await res.json();
      if (data.thumbnail?.source) {
        // Request a larger image for better quality in big cards
        return data.thumbnail.source.replace(/\/\d+px-/, '/800px-');
      }
    } catch {
      continue;
    }
  }
  return null;
}

async function fetchYouTubeVideoId(place: string, city: string, token?: string | null): Promise<string | null> {
  try {
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(
      `${API_URL}/api/youtube-search?q=${encodeURIComponent(place + ' ' + city + ' travel guide')}`,
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

  // Reset everything when the city changes (new plan)
  useEffect(() => {
    if (city !== prevCityRef.current) {
      prevCityRef.current = city;
      fetchedRef.current.clear();
      setData(new Map());
    }
  }, [city]);

  // Debounced extraction + fetch for new places
  useEffect(() => {
    if (!content || !city) return;

    // Wait 400ms after last content change before extracting places.
    // During streaming this means we batch up new text rather than
    // running extraction on every single token.
    const timer = setTimeout(async () => {
      const places = extractPlaces(content, city, maxPlaces);
      const newPlaces = places.filter(p => !fetchedRef.current.has(p));

      if (newPlaces.length === 0) return;

      // Mark them as in-flight so we never fetch twice
      newPlaces.forEach(p => fetchedRef.current.add(p));

      // Get token once for this batch
      const token = getAccessToken ? await getAccessToken() : null;

      // Separate cached (instant) from uncached (needs API) places
      const uncached: string[] = [];
      for (const place of newPlaces) {
        const cached = getCachedMedia(place, city);
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
        await new Promise(r => setTimeout(r, i * 150));

        const [imageUrl, videoId] = await Promise.all([
          fetchWikipediaImage(place, city),
          fetchYouTubeVideoId(place, city, token),
        ]);

        // YouTube thumbnail as fallback when Wikipedia has no image
        const finalImage = imageUrl ||
          (videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : undefined);

        const media: PlaceMediaData = {
          imageUrl: finalImage,
          videoId: videoId || undefined,
        };

        // Cache result for next time
        cacheMedia(place, city, media);

        setData(prev => {
          const next = new Map(prev);
          next.set(place, media);
          return next;
        });
      });
    }, 400);

    return () => clearTimeout(timer);
  }, [content, city]);

  return { data };
}
