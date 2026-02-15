/**
 * Map utility functions extracted from PlanMap for testability.
 * Handles route optimization, geocode caching, and day detection.
 */

export interface MapLocation {
  name: string;
  lat: number;
  lng: number;
}

// ── Geocode cache (localStorage, 7-day TTL) ──────────────────────────
const GEO_CACHE_KEY = 'daily_geocache';
const GEO_CACHE_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days

interface GeoCacheEntry {
  lat: number;
  lng: number;
  ts: number;
}

export function getGeoCache(): Record<string, GeoCacheEntry> {
  try {
    return JSON.parse(localStorage.getItem(GEO_CACHE_KEY) || '{}');
  } catch { return {}; }
}

export function setGeoCache(cache: Record<string, GeoCacheEntry>) {
  try {
    localStorage.setItem(GEO_CACHE_KEY, JSON.stringify(cache));
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
    if (options?.viewbox) url += `&viewbox=${options.viewbox}&bounded=0`;
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

// Geocode a city and return its coordinates + country code for constraining place queries
export interface CityGeoResult {
  lat: number;
  lng: number;
  countryCode?: string;
}

export async function geocodeCity(city: string): Promise<CityGeoResult | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city)}&format=json&limit=1&addressdetails=1&email=dailyplanner@app.dev`,
      { signal: controller.signal }
    );
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.length > 0) {
      return {
        lat: parseFloat(data[0].lat),
        lng: parseFloat(data[0].lon),
        countryCode: data[0].address?.country_code || undefined,
      };
    }
  } catch { /* timeout or network error */ }
  return null;
}

// Geocode a place within a city. Uses viewbox + country code to constrain results
// to the correct geographic area.
export async function geocode(
  place: string,
  city: string,
  cityCoords?: { lat: number; lng: number },
  countryCode?: string
): Promise<{ lat: number; lng: number } | null> {
  const cached = getCachedGeocode(place, city);
  if (cached) return cached;

  const options: { viewbox?: string; countrycodes?: string } = {};
  if (cityCoords) {
    options.viewbox = toViewbox(cityCoords.lat, cityCoords.lng, MAX_DISTANCE_KM);
  }
  if (countryCode) {
    options.countrycodes = countryCode;
  }

  const coords = await geocodeQuery(
    `${place}, ${city}`,
    Object.keys(options).length > 0 ? options : undefined
  );
  if (coords) {
    cacheGeocode(place, city, coords);
    return coords;
  }
  return null;
}
