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

// Geocode a single query string using Nominatim
async function geocodeQuery(query: string): Promise<{ lat: number; lng: number } | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&email=dailyplanner@app.dev`,
      { signal: controller.signal }
    );
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.length > 0) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }
  } catch { /* timeout or network error */ }
  return null;
}

// Geocode a place — tries "place, city" then just "place". Checks cache first.
async function geocode(place: string, city: string): Promise<{ lat: number; lng: number } | null> {
  const cached = getCachedGeocode(place, city);
  if (cached) return cached;

  const queries = [`${place}, ${city}`, place];
  for (const q of queries) {
    const coords = await geocodeQuery(q);
    if (coords) {
      cacheGeocode(place, city, coords);
      return coords;
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

    // Try primary CDN, fall back to secondary
    const CDN_PRIMARY = 'https://unpkg.com/leaflet@1.9.4/dist';
    const CDN_FALLBACK = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4';

    const cssReady = new Promise<void>((cssResolve) => {
      if (document.querySelector('link[href*="leaflet"]')) {
        cssResolve();
        return;
      }
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = `${CDN_PRIMARY}/leaflet.css`;
      link.onload = () => cssResolve();
      link.onerror = () => {
        link.href = `${CDN_FALLBACK}/leaflet.min.css`;
        link.onload = () => cssResolve();
        link.onerror = () => cssResolve();
      };
      document.head.appendChild(link);
    });

    const jsReady = new Promise<void>((jsResolve) => {
      const existingScript = document.querySelector('script[src*="leaflet"]');
      if (existingScript) {
        if ((window as any).L) { jsResolve(); return; }
        existingScript.addEventListener('load', () => jsResolve());
        return;
      }
      const script = document.createElement('script');
      script.src = `${CDN_PRIMARY}/leaflet.js`;
      script.onload = () => jsResolve();
      script.onerror = () => {
        document.head.removeChild(script);
        const fallback = document.createElement('script');
        fallback.src = `${CDN_FALLBACK}/leaflet.min.js`;
        fallback.onload = () => jsResolve();
        fallback.onerror = () => {
          console.error('[PlanMap] Failed to load Leaflet from both CDNs');
          _leafletPromise = null; // Reset so next attempt can retry
          jsResolve();
        };
        document.head.appendChild(fallback);
      };
      document.head.appendChild(script);
    });

    Promise.all([cssReady, jsReady]).then(() => resolve());
  });
  return _leafletPromise;
}

// Detect how many days are in the plan content
function detectDayCount(content: string): number {
  const dayHeaders = content.match(/^# Day \d+/gm);
  return dayHeaders ? dayHeaders.length : 1;
}

const MARKER_COLORS = ['#3B82F6', '#8B5CF6', '#F59E0B', '#10B981', '#EF4444', '#EC4899', '#6366F1', '#14B8A6'];

// Order locations into an efficient route using nearest-neighbor from the first point
function optimizeRoute(locs: MapLocation[]): MapLocation[] {
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

// Auto-loading map with all plan locations — renders progressively as markers resolve
export const PlanMap: React.FC<Props> = ({ content, city }) => {
  const [locations, setLocations] = useState<MapLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [resolvedCount, setResolvedCount] = useState(0);
  const [totalPlaces, setTotalPlaces] = useState(0);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const routeLineRef = useRef<any>(null);

  // Destroy existing map instance
  const destroyMap = useCallback(() => {
    if (mapInstanceRef.current) {
      try { mapInstanceRef.current.remove(); } catch { /* already removed */ }
      mapInstanceRef.current = null;
    }
    markersRef.current = [];
    routeLineRef.current = null;
  }, []);

  // Create the map on the always-present container div
  const createMap = useCallback((center: [number, number], zoom = 13) => {
    const L = (window as any).L;
    if (!L || !mapContainerRef.current) return false;

    destroyMap();

    const map = L.map(mapContainerRef.current).setView(center, zoom);
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

    // Force Leaflet to recalculate container size (fixes grey/missing tiles)
    setTimeout(() => { map.invalidateSize(); }, 100);
    setTimeout(() => { map.invalidateSize(); }, 500);
    setTimeout(() => { map.invalidateSize(); }, 1500);

    // Watch for container resize
    if (mapContainerRef.current && typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => { map.invalidateSize(); });
      ro.observe(mapContainerRef.current);
      const origRemove = map.remove.bind(map);
      map.remove = () => { ro.disconnect(); return origRemove(); };
    }

    return true;
  }, [destroyMap]);

  // Update markers and route line on the existing map (no destroy/recreate)
  const updateMarkers = useCallback((locs: MapLocation[]) => {
    const L = (window as any).L;
    const map = mapInstanceRef.current;
    if (!L || !map || locs.length === 0) return;

    // Clear old markers and route line
    markersRef.current.forEach(m => map.removeLayer(m));
    markersRef.current = [];
    if (routeLineRef.current) {
      map.removeLayer(routeLineRef.current);
      routeLineRef.current = null;
    }

    const routed = optimizeRoute(locs);

    // Add markers
    routed.forEach((loc, i) => {
      const icon = L.divIcon({
        className: 'custom-marker',
        html: `<div style="
          width: 28px; height: 28px; border-radius: 50%;
          background: ${MARKER_COLORS[i % MARKER_COLORS.length]};
          color: white; display: flex; align-items: center; justify-content: center;
          font-size: 12px; font-weight: bold; box-shadow: 0 2px 8px rgba(0,0,0,0.3);
          border: 2px solid white;
        ">${i + 1}</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      const marker = L.marker([loc.lat, loc.lng], { icon }).addTo(map)
        .bindPopup(`<strong>${loc.name}</strong>`);
      markersRef.current.push(marker);
    });

    // Draw route line
    if (routed.length > 1) {
      const isDark = document.documentElement.classList.contains('dark');
      const coords = routed.map(l => [l.lat, l.lng] as [number, number]);
      routeLineRef.current = L.polyline(coords, {
        color: isDark ? '#6366F1' : '#3B82F6',
        weight: 2,
        opacity: 0.5,
        dashArray: '8, 8',
      }).addTo(map);

      const bounds = L.latLngBounds(coords);
      map.fitBounds(bounds, { padding: [40, 40] });
    }
  }, []);

  // Load locations and build map when content/city changes
  useEffect(() => {
    let cancelled = false;

    const loadAndBuildMap = async () => {
      setLoading(true);
      setMapReady(false);
      destroyMap();
      setLocations([]);
      setResolvedCount(0);

      // Step 1: Load Leaflet + geocode the CITY to get a map center immediately
      const [, cityCoords] = await Promise.all([
        loadLeaflet(),
        geocodeQuery(city),
      ]);
      if (cancelled) return;

      if (!(window as any).L) {
        console.error('[PlanMap] Leaflet failed to load');
        setLoading(false);
        return;
      }

      // Step 2: Create the map immediately with the city center
      // The map container div is ALWAYS in the DOM, so this always works
      const center: [number, number] = cityCoords
        ? [cityCoords.lat, cityCoords.lng]
        : [40.7128, -74.006]; // fallback to NYC if city geocode fails
      const created = createMap(center, cityCoords ? 12 : 3);
      if (!created) {
        console.error('[PlanMap] Failed to create map — container not ready');
        setLoading(false);
        return;
      }
      setMapReady(true);

      // Step 3: Extract places and geocode them, adding markers progressively
      const dayCount = detectDayCount(content);
      const maxPlaces = Math.min(dayCount * 10, 25);
      const places = extractPlaces(content, city, maxPlaces);
      setTotalPlaces(places.length);
      if (places.length === 0) {
        setLoading(false);
        return;
      }

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

      // Show cached results immediately
      if (cached.length > 0) {
        setLocations(cached);
        setResolvedCount(cached.length);
        updateMarkers(cached);
      }

      // Geocode uncached places, adding markers incrementally
      const allResults = [...cached];

      for (let i = 0; i < uncachedPlaces.length; i++) {
        if (cancelled) return;
        if (i > 0) await new Promise(r => setTimeout(r, 1100));

        const coords = await geocode(uncachedPlaces[i], city);
        if (cancelled) return;

        if (coords) {
          allResults.push({ name: uncachedPlaces[i], ...coords });
          const routed = optimizeRoute([...allResults]);
          setLocations(routed);
          setResolvedCount(allResults.length);
          updateMarkers(routed);
        }
      }

      if (cancelled) return;

      // Final update
      if (allResults.length > 0) {
        const routed = optimizeRoute(allResults);
        setLocations(routed);
        updateMarkers(routed);
      }
      setLoading(false);
    };

    loadAndBuildMap();
    return () => {
      cancelled = true;
      destroyMap();
    };
  }, [content, city, destroyMap, createMap, updateMarkers]);

  return (
    <div className="mb-8 animate-fadeIn">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 text-on-surface/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
          </svg>
          <span className="text-xs font-medium text-on-surface/50">Your Route</span>
          {loading && totalPlaces > 0 && (
            <span className="text-[10px] text-on-surface/25 flex items-center gap-1">
              <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              {resolvedCount}/{totalPlaces} places
            </span>
          )}
        </div>
      </div>

      {/* Map wrapper — container is ALWAYS visible so Leaflet can measure it */}
      <div className="relative border border-on-surface/10 rounded-xl overflow-hidden" style={{ height: '300px' }}>
        {/* Actual map container — always has layout dimensions */}
        <div
          ref={mapContainerRef}
          style={{ width: '100%', height: '100%' }}
        />

        {/* Loading overlay — sits on top until map tiles are ready */}
        {!mapReady && (
          <div className="absolute inset-0 bg-surface flex flex-col items-center justify-center gap-2 z-[1000]">
            <svg className="w-5 h-5 text-on-surface/20 animate-spin" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <p className="text-xs text-on-surface/30">Loading map...</p>
          </div>
        )}
      </div>

      {/* Location legend */}
      {locations.length > 0 && (
        <div className="flex flex-wrap gap-2 mt-3">
          {locations.map((loc, i) => (
            <span key={i} className="flex items-center gap-1.5 text-[10px] text-on-surface/40">
              <span
                className="w-4 h-4 rounded-full text-white text-[8px] flex items-center justify-center font-bold"
                style={{ background: MARKER_COLORS[i % 8] }}
              >
                {i + 1}
              </span>
              {loc.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
