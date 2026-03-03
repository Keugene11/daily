import { ToolResult } from '../../types';
import { resolveLocation } from './location_aliases';

interface NightlifeVenue {
  name: string;
  type: string;
  rating: string;
  ratingCount?: number;
  neighborhood: string;
  address?: string;
  vibe?: string;
  link?: string;
  reviewHighlights?: string[];
}

// ── Google Places API integration ───────────────────────────────────────

const GOOGLE_PLACES_URL = 'https://places.googleapis.com/v1/places:searchText';

const VENUE_TYPE_MAP: Record<string, string> = {
  'bar': 'Bar',
  'night_club': 'Club',
  'cocktail_bar': 'Cocktail Bar',
  'wine_bar': 'Wine Bar',
  'pub': 'Pub',
  'brewery': 'Brewery',
  'lounge': 'Lounge',
  'karaoke': 'Karaoke',
  'live_music_venue': 'Live Music',
  'jazz_club': 'Jazz Club',
  'comedy_club': 'Comedy Club',
  'dance_club': 'Dance Club',
  'beer_hall': 'Beer Hall',
  'beer_garden': 'Beer Garden',
  'sports_bar': 'Sports Bar',
  'hookah_bar': 'Hookah Bar',
  'speakeasy': 'Speakeasy',
};

// ── In-memory cache ─────────────────────────────────────────────────────

interface CacheEntry {
  data: NightlifeVenue[];
  timestamp: number;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const cache = new Map<string, CacheEntry>();

function getCacheKey(city: string): string {
  return `nightlife|${city.toLowerCase().trim()}`;
}

function getFromCache(key: string): NightlifeVenue[] | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key: string, data: NightlifeVenue[]): void {
  if (cache.size > 200) {
    const entries = Array.from(cache.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp);
    for (let i = 0; i < 50; i++) {
      cache.delete(entries[i][0]);
    }
  }
  cache.set(key, { data, timestamp: Date.now() });
}

// ── Review highlight extraction ─────────────────────────────────────────

function extractReviewHighlights(reviews: any[]): string[] {
  if (!reviews || reviews.length === 0) return [];

  const vibeSignals = /\b(vibe|atmosphere|music|DJ|dance|crowd|scene|energy|bartender|bouncer|line|cover|dress|rooftop|patio|outdoor|view|cocktail|drink|beer|wine|shot|happy hour|live|band|comedy|show|karaoke|pool|darts|trivia)\b/i;
  const qualitySignals = /\b(amazing|incredible|best|awesome|fantastic|perfect|loved|favorite|great|recommend|must.visit|hidden gem|go.to|worth)\b/i;

  const highlights: string[] = [];
  const seen = new Set<string>();

  for (const review of reviews.slice(0, 5)) {
    const text: string = review.text?.text || '';
    if (!text || text.length < 20) continue;

    const sentences = text.split(/[.!?]+/).map((s: string) => s.trim()).filter((s: string) => s.length > 10 && s.length < 150);

    for (const sentence of sentences) {
      if (vibeSignals.test(sentence) && qualitySignals.test(sentence)) {
        const normalized = sentence.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
        if (seen.has(normalized)) continue;
        seen.add(normalized);

        const clean = sentence.charAt(0).toUpperCase() + sentence.slice(1);
        highlights.push(clean);

        if (highlights.length >= 3) return highlights;
      }
    }
  }

  return highlights;
}

// ── Map Google Places result to NightlifeVenue ──────────────────────────

function mapPlaceToVenue(place: any, city: string): NightlifeVenue {
  const name = place.displayName?.text || 'Unknown';

  const types: string[] = place.types || [];
  let venueType = 'Bar';
  for (const type of types) {
    if (VENUE_TYPE_MAP[type]) {
      venueType = VENUE_TYPE_MAP[type];
      break;
    }
  }

  const ratingNum = place.rating || 0;
  const rating = ratingNum > 0 ? `${ratingNum}/5` : 'N/A';
  const ratingCount = place.userRatingCount || 0;

  let vibe = '';
  if (place.editorialSummary?.text) {
    vibe = place.editorialSummary.text;
  } else if (place.reviews?.length > 0) {
    const reviewText = place.reviews[0].text?.text || '';
    vibe = reviewText.length > 120
      ? reviewText.substring(0, 117) + '...'
      : reviewText;
  }

  const reviewHighlights = extractReviewHighlights(place.reviews || []);

  const addressParts = (place.formattedAddress || '').split(',').map((s: string) => s.trim());
  const neighborhood = addressParts.length >= 3 ? addressParts[1] : (addressParts[0] || '');

  const googleMapsUri = place.googleMapsUri || `https://maps.google.com/?q=${encodeURIComponent(name + ', ' + city)}`;

  return {
    name,
    type: venueType,
    rating,
    ratingCount,
    neighborhood,
    address: place.formattedAddress || '',
    vibe,
    link: `[${name}](${googleMapsUri})`,
    reviewHighlights,
  };
}

// ── Google Places API search ────────────────────────────────────────────

async function searchGooglePlaces(city: string, query: string): Promise<NightlifeVenue[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return [];

  const requestBody: any = {
    textQuery: query,
    languageCode: 'en',
    maxResultCount: 12,
  };

  const fieldMask = [
    'places.displayName',
    'places.formattedAddress',
    'places.rating',
    'places.userRatingCount',
    'places.types',
    'places.editorialSummary',
    'places.googleMapsUri',
    'places.reviews',
    'places.businessStatus',
    'places.currentOpeningHours',
  ].join(',');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 6000);

  try {
    const response = await fetch(GOOGLE_PLACES_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': fieldMask,
      },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error(`[Nightlife] Google Places API error ${response.status}: ${errorText}`);
      return [];
    }

    const data: any = await response.json();
    const places = (data.places || [])
      .filter((p: any) => {
        const name = p.displayName?.text || 'Unknown';
        const status = p.businessStatus;
        if (status && status !== 'OPERATIONAL') {
          console.log(`[Nightlife] Skipping "${name}" — status: ${status}`);
          return false;
        }
        if (!status && !p.currentOpeningHours) {
          console.log(`[Nightlife] Skipping "${name}" — no status and no opening hours`);
          return false;
        }
        return true;
      });
    return places.map((p: any) => mapPlaceToVenue(p, city));
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      console.error('[Nightlife] Google Places request timed out');
    } else {
      console.error('[Nightlife] Google Places fetch error:', error);
    }
    return [];
  } finally {
    clearTimeout(timeoutId);
  }
}

// ── Main export ─────────────────────────────────────────────────────────

export const nightlifeService = {
  async getNightlife(city: string): Promise<ToolResult<NightlifeVenue[]>> {
    const cacheKey = getCacheKey(city);
    const cached = getFromCache(cacheKey);
    if (cached) {
      console.log(`[Nightlife] Cache hit for "${cacheKey}"`);
      return { success: true, data: cached.slice(0, 10) };
    }

    // Run two queries in parallel for broader coverage
    const [barsResults, clubsResults] = await Promise.all([
      searchGooglePlaces(city, `best nightlife bars clubs in ${city}`),
      searchGooglePlaces(city, `best cocktail bars lounges in ${city}`),
    ]);

    // Merge and deduplicate by name
    const seen = new Set<string>();
    const merged: NightlifeVenue[] = [];
    for (const v of [...barsResults, ...clubsResults]) {
      const key = v.name.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        merged.push(v);
      }
    }

    if (merged.length > 0) {
      console.log(`[Nightlife] Google Places returned ${barsResults.length} bars + ${clubsResults.length} lounges for ${city}`);
      setCache(cacheKey, merged);
      return { success: true, data: merged.slice(0, 10) };
    }

    console.log(`[Nightlife] No Google Places results for ${city} — returning empty`);
    return { success: true, data: [], note: 'No verified nightlife data available. Use your knowledge of well-known bars, clubs, and nightlife venues in this city.' };
  }
};
