/**
 * Map utility functions extracted from PlanMap for testability.
 * Handles route optimization, geocode caching, and day detection.
 */

export interface MapLocation {
  name: string;
  lat: number;
  lng: number;
}

// ── Geocode cache (localStorage, 7-day TTL, versioned) ──────────────
const GEO_CACHE_KEY = 'daily_geocache';
const GEO_CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days
// Bump this to invalidate ALL cached geocode entries (forces re-geocoding with constraints)
const GEO_CACHE_VERSION = 8;

interface GeoCacheEntry {
  lat: number;
  lng: number;
  ts: number;
}

interface GeoCacheStore {
  _v?: number;
  [key: string]: GeoCacheEntry | number | undefined;
}

export function getGeoCache(): Record<string, GeoCacheEntry> {
  try {
    const raw: GeoCacheStore = JSON.parse(localStorage.getItem(GEO_CACHE_KEY) || '{}');
    // If cache version doesn't match, wipe everything — old entries were saved without constraints
    if (raw._v !== GEO_CACHE_VERSION) {
      localStorage.removeItem(GEO_CACHE_KEY);
      return {};
    }
    const { _v, ...entries } = raw;
    return entries as Record<string, GeoCacheEntry>;
  } catch { return {}; }
}

export function setGeoCache(cache: Record<string, GeoCacheEntry>) {
  try {
    localStorage.setItem(GEO_CACHE_KEY, JSON.stringify({ ...cache, _v: GEO_CACHE_VERSION }));
  } catch { /* quota exceeded — ignore */ }
}

export function getCachedGeocode(place: string, city: string): { lat: number; lng: number } | null {
  const cache = getGeoCache();
  const key = `${place}|||${city}`;
  const entry = cache[key];
  if (entry && Date.now() - entry.ts < GEO_CACHE_TTL) {
    return { lat: entry.lat, lng: entry.lng };
  }
  return null;
}

export function cacheGeocode(place: string, city: string, coords: { lat: number; lng: number }) {
  const cache = getGeoCache();
  cache[`${place}|||${city}`] = { lat: coords.lat, lng: coords.lng, ts: Date.now() };
  // Evict old entries if cache gets too large (> 500 entries)
  const keys = Object.keys(cache);
  if (keys.length > 500) {
    const sorted = keys.sort((a, b) => cache[a].ts - cache[b].ts);
    sorted.slice(0, keys.length - 400).forEach(k => delete cache[k]);
  }
  setGeoCache(cache);
}

// Detect how many days are in the plan content
export function detectDayCount(content: string): number {
  const dayHeaders = content.match(/^# Day \d+/gm);
  return dayHeaders ? dayHeaders.length : 1;
}

export const MARKER_COLORS = ['#3B82F6', '#8B5CF6', '#F59E0B', '#10B981', '#EF4444', '#EC4899', '#6366F1', '#14B8A6'];

// Order locations into an efficient route using nearest-neighbor from the first point
export function optimizeRoute(locs: MapLocation[]): MapLocation[] {
  if (locs.length <= 2) return locs;
  const remaining = locs.slice(1);
  const ordered: MapLocation[] = [locs[0]];
  while (remaining.length > 0) {
    const last = ordered[ordered.length - 1];
    let nearest = 0;
    let nearestDist = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const dlat = remaining[i].lat - last.lat;
      const dlng = remaining[i].lng - last.lng;
      const dist = dlat * dlat + dlng * dlng;
      if (dist < nearestDist) {
        nearestDist = dist;
        nearest = i;
      }
    }
    ordered.push(remaining.splice(nearest, 1)[0]);
  }
  return ordered;
}

// Max distance (km) a geocoded place can be from the city center before we discard it
export const MAX_DISTANCE_KM = 80;

/**
 * Remove outlier locations that are far from the main cluster.
 * Uses an iterative approach: remove the worst outlier, recompute
 * centroid and median, repeat. This handles multiple outliers because
 * after removing the first, the centroid and median better represent
 * the true cluster (a single pass fails when 2+ outliers pull the
 * centroid and inflate the median).
 */
export function removeOutliers(locs: MapLocation[]): MapLocation[] {
  let current = [...locs];
  while (current.length > 3) {
    const n = current.length;
    const cLat = current.reduce((s, l) => s + l.lat, 0) / n;
    const cLng = current.reduce((s, l) => s + l.lng, 0) / n;
    const dists = current.map(l => distanceKm(cLat, cLng, l.lat, l.lng));
    const sorted = [...dists].sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)];
    const threshold = Math.max(median * 3, 5);
    // Find the farthest point
    let maxDist = 0;
    let maxIdx = -1;
    for (let i = 0; i < dists.length; i++) {
      if (dists[i] > maxDist) { maxDist = dists[i]; maxIdx = i; }
    }
    // If the farthest point is within threshold, we're done
    if (maxDist <= threshold) break;
    // Remove the worst outlier and repeat
    current.splice(maxIdx, 1);
  }
  return current;
}

// Haversine distance in km between two lat/lng points
export function distanceKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// Convert center + radius to Nominatim viewbox string (lon1,lat1,lon2,lat2)
function toViewbox(lat: number, lng: number, radiusKm: number): string {
  const latDeg = radiusKm / 111;
  const lngDeg = radiusKm / (111 * Math.cos((lat * Math.PI) / 180));
  return `${lng - lngDeg},${lat + latDeg},${lng + lngDeg},${lat - latDeg}`;
}

// Geocode a single query string using Nominatim
export async function geocodeQuery(
  query: string,
  options?: { viewbox?: string; countrycodes?: string }
): Promise<{ lat: number; lng: number } | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    let url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&email=dailyplanner@app.dev`;
    if (options?.viewbox) url += `&viewbox=${options.viewbox}&bounded=1`;
    if (options?.countrycodes) url += `&countrycodes=${options.countrycodes}`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.length > 0) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }
  } catch { /* timeout or network error */ }
  return null;
}

// Geocode a city and return its coordinates + country info for constraining place queries
export interface CityGeoResult {
  lat: number;
  lng: number;
  countryCode?: string;
  country?: string;
  /** State/province/region from Nominatim addressdetails */
  state?: string;
  /** Actual city/town name from Nominatim address — may differ from user input
   *  (e.g., user types "Cornell" → resolvedCity is "Ithaca") */
  resolvedCity?: string;
  /** Nominatim bounding box [south, north, west, east] */
  boundingBox?: [number, number, number, number];
}

/** Compute the radius (km) of a Nominatim bounding box from its center */
export function boundingBoxRadiusKm(bbox: [number, number, number, number]): number {
  const [south, north, west, east] = bbox;
  return distanceKm(south, west, north, east) / 2;
}

/** Normalize Nominatim city names — strips "City of" prefix (e.g., "City of Ithaca" → "Ithaca") */
function normalizeCity(name: string | undefined): string | undefined {
  if (!name) return undefined;
  return name.replace(/^City of\s+/i, '').trim() || undefined;
}

/** Parse a single Nominatim result into a CityGeoResult */
function parseNominatimResult(best: any): CityGeoResult {
  const bbox = best.boundingbox;
  const addr = best.address || {};
  const rawCity = addr.city || addr.town || addr.village || addr.municipality || addr.hamlet || undefined;
  return {
    lat: parseFloat(best.lat),
    lng: parseFloat(best.lon),
    countryCode: addr.country_code || undefined,
    country: addr.country || undefined,
    state: addr.state || undefined,
    resolvedCity: normalizeCity(rawCity),
    boundingBox: bbox ? [parseFloat(bbox[0]), parseFloat(bbox[1]), parseFloat(bbox[2]), parseFloat(bbox[3])] : undefined,
  };
}

/** Query Nominatim and return the highest-importance result with its importance score */
async function queryNominatim(query: string): Promise<{ result: CityGeoResult; importance: number } | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=1&email=dailyplanner@app.dev`,
      { signal: controller.signal }
    );
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.length > 0) {
      const best = data.reduce((a: any, b: any) =>
        (parseFloat(b.importance) || 0) > (parseFloat(a.importance) || 0) ? b : a
      );
      return { result: parseNominatimResult(best), importance: parseFloat(best.importance) || 0 };
    }
  } catch { /* timeout or network error */ }
  return null;
}

export async function geocodeCity(city: string): Promise<CityGeoResult | null> {
  const primary = await queryNominatim(city);
  if (!primary) return null;

  // If the result has low importance and resolvedCity matches the input (no resolution),
  // the input might be a university/institution name. E.g., "Cornell" returns Cornell, IL
  // (importance 0.46, resolvedCity "Cornell") instead of Cornell University in Ithaca.
  // Try "{input} university" as a fallback to find the actual city.
  if (primary.importance < 0.5) {
    const resolvedSame = !primary.result.resolvedCity ||
      primary.result.resolvedCity.toLowerCase() === city.toLowerCase();
    if (resolvedSame) {
      // Respect Nominatim rate limit (1 req/sec)
      await new Promise(r => setTimeout(r, 1100));
      const fallback = await queryNominatim(`${city} university`);
      if (fallback?.result.resolvedCity &&
          fallback.result.resolvedCity.toLowerCase() !== city.toLowerCase()) {
        return fallback.result;
      }
    }
  }

  return primary.result;
}

// Check if coords are within a given range of a reference point
function isWithinRange(coords: { lat: number; lng: number }, ref: { lat: number; lng: number }, maxKm = MAX_DISTANCE_KM): boolean {
  return distanceKm(ref.lat, ref.lng, coords.lat, coords.lng) <= maxKm;
}

// Geocode a place within a city. Uses viewbox + country code to constrain results
// to the correct geographic area. Validates distance before caching.
// maxDistKm overrides the default 80km threshold (useful for country-level queries).
export async function geocode(
  place: string,
  city: string,
  cityCoords?: { lat: number; lng: number },
  countryCode?: string,
  country?: string,
  maxDistKm = MAX_DISTANCE_KM
): Promise<{ lat: number; lng: number } | null> {
  const cached = getCachedGeocode(place, city);
  if (cached) {
    // Validate cached results against city coords — reject stale bad entries
    if (cityCoords && !isWithinRange(cached, cityCoords, maxDistKm)) return null;
    return cached;
  }

  const options: { viewbox?: string; countrycodes?: string } = {};
  if (cityCoords) {
    options.viewbox = toViewbox(cityCoords.lat, cityCoords.lng, maxDistKm);
  }
  if (countryCode) {
    options.countrycodes = countryCode;
  }

  // For city-level queries, append country for specificity: "Eiffel Tower, Paris, France"
  // For country-level queries (user typed a country name), skip appending the country —
  // Nominatim fails when mixing scripts (e.g. "Shrine, Japan, 日本" returns nothing).
  // The countrycodes parameter already constrains to the correct country.
  const isWideArea = maxDistKm > MAX_DISTANCE_KM;
  const query = (!isWideArea && country) ? `${place}, ${city}, ${country}` : `${place}, ${city}`;

  // For wide areas (countries/regions), don't use bounded=1 — it's too restrictive.
  // Just use countrycodes to keep results in the right country.
  const useViewbox = maxDistKm <= MAX_DISTANCE_KM;
  const queryOptions: { viewbox?: string; countrycodes?: string } = {};
  if (useViewbox && options.viewbox) queryOptions.viewbox = options.viewbox;
  if (options.countrycodes) queryOptions.countrycodes = options.countrycodes;

  const coords = await geocodeQuery(
    query,
    Object.keys(queryOptions).length > 0 ? queryOptions : undefined
  );
  if (coords) {
    if (!cityCoords || isWithinRange(coords, cityCoords, maxDistKm)) {
      cacheGeocode(place, city, coords);
      return coords;
    }
    // Result was out of range — fall through to fallback
  }

  // Fallback: query with just the place name + viewbox/countrycodes.
  // Helps when the city name isn't a recognized city (e.g. "Yosemite" is a park,
  // so "Half Dome, Yosemite, United States" returns wrong results, but
  // "Half Dome" with the viewbox constraint returns the correct one).
  if (options.viewbox || options.countrycodes) {
    const fallbackOptions: { viewbox?: string; countrycodes?: string } = {};
    if (options.viewbox) fallbackOptions.viewbox = options.viewbox;
    if (options.countrycodes) fallbackOptions.countrycodes = options.countrycodes;
    const fallback = await geocodeQuery(place, fallbackOptions);
    if (fallback) {
      if (!cityCoords || isWithinRange(fallback, cityCoords, maxDistKm)) {
        cacheGeocode(place, city, fallback);
        return fallback;
      }
    }
  }

  return null;
}
