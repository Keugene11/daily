import React, { useState, useEffect, useRef, useCallback } from 'react';
import { extractPlaces } from '../utils/extractPlaces';

interface Props {
  content: string;
  city: string;
}

interface MapLocation {
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

function getGeoCache(): Record<string, GeoCacheEntry> {
  try {
    return JSON.parse(localStorage.getItem(GEO_CACHE_KEY) || '{}');
  } catch { return {}; }
}

function setGeoCache(cache: Record<string, GeoCacheEntry>) {
  try {
    localStorage.setItem(GEO_CACHE_KEY, JSON.stringify(cache));
  } catch { /* quota exceeded — ignore */ }
}

function getCachedGeocode(place: string, city: string): { lat: number; lng: number } | null {
  const cache = getGeoCache();
  const key = `${place}|||${city}`;
  const entry = cache[key];
  if (entry && Date.now() - entry.ts < GEO_CACHE_TTL) {
    return { lat: entry.lat, lng: entry.lng };
  }
  return null;
}

function cacheGeocode(place: string, city: string, coords: { lat: number; lng: number }) {
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

// Geocode a place using Nominatim (free, no API key) — checks cache first
async function geocode(place: string, city: string): Promise<{ lat: number; lng: number } | null> {
  // Check cache first — instant return
  const cached = getCachedGeocode(place, city);
  if (cached) return cached;

  const queries = [
    `${place}, ${city}`,
    place,
  ];

  for (const q of queries) {
    try {
      const query = encodeURIComponent(q);
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`,
        { headers: { 'User-Agent': 'DailyPlannerApp/1.0' } }
      );
      const data = await res.json();
      if (data.length > 0) {
        const coords = { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
        cacheGeocode(place, city, coords);
        return coords;
      }
    } catch {
      // continue to next query
    }
    // Nominatim requires 1 request per second
    await new Promise(r => setTimeout(r, 1100));
  }

  return null;
}

// Ensure Leaflet CSS and JS are loaded (singleton promise prevents duplicate loads)
let _leafletPromise: Promise<void> | null = null;
function loadLeaflet(): Promise<void> {
  if (_leafletPromise) return _leafletPromise;
  _leafletPromise = new Promise((resolve) => {
    if ((window as any).L) {
      resolve();
      return;
    }

    // Load CSS
    if (!document.querySelector('link[href*="leaflet"]')) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
      document.head.appendChild(link);
    }

    // Load JS
    const existingScript = document.querySelector('script[src*="leaflet"]');
    if (existingScript) {
      if ((window as any).L) { resolve(); return; }
      existingScript.addEventListener('load', () => resolve());
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';
    script.onload = () => resolve();
    document.head.appendChild(script);
  });
  return _leafletPromise;
}

// Detect how many days are in the plan content
function detectDayCount(content: string): number {
  const dayHeaders = content.match(/^# Day \d+/gm);
  return dayHeaders ? dayHeaders.length : 1;
}

// Auto-loading map with all plan locations — renders progressively as markers resolve
export const PlanMap: React.FC<Props> = ({ content, city }) => {
  const [locations, setLocations] = useState<MapLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolvedCount, setResolvedCount] = useState(0);
  const [totalPlaces, setTotalPlaces] = useState(0);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);

  // Destroy existing map instance
  const destroyMap = useCallback(() => {
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
      mapInstanceRef.current = null;
    }
  }, []);

  // Order locations into an efficient route using nearest-neighbor from the first point
  const optimizeRoute = useCallback((locs: MapLocation[]): MapLocation[] => {
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
  }, []);

  // Initialize the map with given locations
  const initMap = useCallback((locs: MapLocation[]) => {
    const L = (window as any).L;
    if (!L || !mapContainerRef.current || locs.length === 0) return;

    // Always destroy old map before creating new one
    destroyMap();

    // Reorder for an efficient walking route
    const routed = optimizeRoute(locs);

    const lats = routed.map(l => l.lat);
    const lngs = routed.map(l => l.lng);
    const center: [number, number] = [
      (Math.min(...lats) + Math.max(...lats)) / 2,
      (Math.min(...lngs) + Math.max(...lngs)) / 2
    ];

    const map = L.map(mapContainerRef.current).setView(center, 13);
    mapInstanceRef.current = map;

    const isDark = document.documentElement.classList.contains('dark');
    L.tileLayer(
      isDark
        ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
        : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      {
        attribution: isDark
          ? '&copy; <a href="https://carto.com/">CARTO</a> &copy; <a href="https://www.openstreetmap.org/copyright">OSM</a>'
          : '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
      }
    ).addTo(map);

    // Add markers with numbered labels
    const colors = ['#3B82F6', '#8B5CF6', '#F59E0B', '#10B981', '#EF4444', '#EC4899', '#6366F1', '#14B8A6'];
    routed.forEach((loc, i) => {
      const icon = L.divIcon({
        className: 'custom-marker',
        html: `<div style="
          width: 28px; height: 28px; border-radius: 50%;
          background: ${colors[i % colors.length]};
          color: white; display: flex; align-items: center; justify-content: center;
          font-size: 12px; font-weight: bold; box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          border: 2px solid white;
        ">${i + 1}</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      L.marker([loc.lat, loc.lng], { icon }).addTo(map)
        .bindPopup(`<strong>${loc.name}</strong>`);
    });

    // Draw route line
    if (routed.length > 1) {
      const coords = routed.map(l => [l.lat, l.lng] as [number, number]);
      L.polyline(coords, {
        color: isDark ? '#6366F1' : '#3B82F6',
        weight: 2,
        opacity: 0.5,
        dashArray: '8, 8',
      }).addTo(map);

      const bounds = L.latLngBounds(coords);
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  }, [destroyMap, optimizeRoute]);

  // Load locations and build map when content/city changes
  useEffect(() => {
    let cancelled = false;

    const loadAndBuildMap = async () => {
      setLoading(true);
      destroyMap();
      setLocations([]);
      setResolvedCount(0);

      // Scale place limit based on day count — map needs more places for multi-day trips
      const dayCount = detectDayCount(content);
      const maxPlaces = Math.min(dayCount * 10, 25);
      const places = extractPlaces(content, city, maxPlaces);
      setTotalPlaces(places.length);
      if (places.length === 0) {
        setLoading(false);
        return;
      }

      // Start loading Leaflet in parallel with geocoding
      const leafletReady = loadLeaflet();

      // Separate cached (instant) from uncached (needs API) places
      const cached: MapLocation[] = [];
      const uncachedPlaces: string[] = [];
      for (const place of places) {
        const coords = getCachedGeocode(place, city);
        if (coords) {
          cached.push({ name: place, ...coords });
        } else {
          uncachedPlaces.push(place);
        }
      }

      // If we have cached results, show the map immediately
      if (cached.length > 0 && !cancelled) {
        const routed = optimizeRoute(cached);
        setLocations(routed);
        setResolvedCount(cached.length);
        setLoading(false);
        await leafletReady;
        if (!cancelled) {
          requestAnimationFrame(() => { if (!cancelled) initMap(routed); });
        }
      }

      // Geocode uncached places, updating the map progressively
      const allResults = [...cached];
      for (let i = 0; i < uncachedPlaces.length; i++) {
        if (cancelled) return;
        // Rate-limit between Nominatim calls
        if (i > 0) await new Promise(r => setTimeout(r, 1100));
        const coords = await geocode(uncachedPlaces[i], city);
        if (cancelled) return;
        if (coords) {
          allResults.push({ name: uncachedPlaces[i], ...coords });
          const routed = optimizeRoute([...allResults]);
          setLocations(routed);
          setResolvedCount(allResults.length);

          // Rebuild the map with updated markers
          if (!loading || cached.length > 0) {
            await leafletReady;
            if (!cancelled) {
              requestAnimationFrame(() => { if (!cancelled) initMap(routed); });
            }
          }
        }
      }

      if (cancelled) return;

      // Final state
      if (allResults.length > 0) {
        const routed = optimizeRoute(allResults);
        setLocations(routed);
        setLoading(false);
        await leafletReady;
        if (!cancelled) {
          requestAnimationFrame(() => { if (!cancelled) initMap(routed); });
        }
      } else {
        setLoading(false);
      }
    };

    loadAndBuildMap();
    return () => {
      cancelled = true;
      destroyMap();
    };
  }, [content, city, destroyMap, initMap, optimizeRoute]);

  return (
    <div className="mb-8 animate-fadeIn">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-on-surface/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
          </svg>
          <span className="text-xs font-medium text-on-surface/50">Your Route</span>
          {/* Progress indicator while geocoding */}
          {resolvedCount > 0 && resolvedCount < totalPlaces && (
            <span className="text-[10px] text-on-surface/25">{resolvedCount}/{totalPlaces} places</span>
          )}
        </div>
      </div>

      {loading && locations.length === 0 ? (
        <div className="border border-on-surface/10 rounded-xl h-64 flex flex-col items-center justify-center gap-2 animate-pulse">
          <svg className="w-5 h-5 text-on-surface/20 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-xs text-on-surface/30">Finding locations on the map...</p>
        </div>
      ) : locations.length === 0 ? (
        <div className="border border-on-surface/10 rounded-xl h-32 flex items-center justify-center">
          <p className="text-xs text-on-surface/30">No locations could be mapped</p>
        </div>
      ) : (
        <>
          <div
            ref={mapContainerRef}
            className="border border-on-surface/10 rounded-xl overflow-hidden"
            style={{ height: '300px' }}
          />
          {/* Location legend */}
          <div className="flex flex-wrap gap-2 mt-3">
            {locations.map((loc, i) => (
              <span key={i} className="flex items-center gap-1.5 text-[10px] text-on-surface/40">
                <span
                  className="w-4 h-4 rounded-full text-white text-[8px] flex items-center justify-center font-bold"
                  style={{ background: ['#3B82F6', '#8B5CF6', '#F59E0B', '#10B981', '#EF4444', '#EC4899', '#6366F1', '#14B8A6'][i % 8] }}
                >
                  {i + 1}
                </span>
                {loc.name}
              </span>
            ))}
          </div>
        </>
      )}
    </div>
  );
};
