import React, { useState, useEffect, useRef, useCallback } from 'react';
import { extractPlaces } from '../utils/extractPlaces';
import {
  MapLocation,
  getCachedGeocode,
  geocode,
  geocodeCity,
  boundingBoxRadiusKm,
  getGeoCache,
  setGeoCache,
  optimizeRoute,
  detectDayCount,
  distanceKm,
  MAX_DISTANCE_KM,
  MARKER_COLORS,
} from '../utils/mapUtils';

interface Props {
  content: string;
  city: string;
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

  // Destroy existing map instance and clean up Leaflet's internal state
  const destroyMap = useCallback(() => {
    if (mapInstanceRef.current) {
      try { mapInstanceRef.current.remove(); } catch { /* already removed */ }
      mapInstanceRef.current = null;
    }
    // Leaflet stamps _leaflet_id on the container. If map.remove() fails,
    // this persists and L.map() throws "Map container is already initialized."
    // Always clean it so the container can be safely reused.
    if (mapContainerRef.current) {
      delete (mapContainerRef.current as any)._leaflet_id;
    }
    markersRef.current = [];
    routeLineRef.current = null;
  }, []);

  // Create the map on the always-present container div
  const createMap = useCallback((center: [number, number], zoom = 13) => {
    const L = (window as any).L;
    if (!L || !mapContainerRef.current) return false;

    destroyMap();

    let map: any;
    try {
      map = L.map(mapContainerRef.current).setView(center, zoom);
    } catch (err) {
      console.error('[PlanMap] L.map() failed:', err);
      // Last resort: clear container innerHTML and _leaflet_id, retry once
      try {
        delete (mapContainerRef.current as any)._leaflet_id;
        mapContainerRef.current.innerHTML = '';
        map = L.map(mapContainerRef.current).setView(center, zoom);
      } catch {
        return false;
      }
    }
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

  // Update markers and route line on the existing map (no destroy/recreate).
  // Expects locs to be already in display order. Does NOT fit bounds — caller decides.
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

    // Add markers
    locs.forEach((loc, i) => {
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
    if (locs.length > 1) {
      const isDark = document.documentElement.classList.contains('dark');
      const coords = locs.map(l => [l.lat, l.lng] as [number, number]);
      routeLineRef.current = L.polyline(coords, {
        color: isDark ? '#6366F1' : '#3B82F6',
        weight: 2,
        opacity: 0.5,
        dashArray: '8, 8',
      }).addTo(map);
    }
  }, []);

  // Fit map bounds to show all current markers
  const fitMapBounds = useCallback((locs: MapLocation[]) => {
    const L = (window as any).L;
    const map = mapInstanceRef.current;
    if (!L || !map || locs.length === 0) return;

    if (locs.length > 1) {
      const bounds = L.latLngBounds(locs.map(l => [l.lat, l.lng]));
      map.fitBounds(bounds, { padding: [40, 40] });
    } else {
      map.setView([locs[0].lat, locs[0].lng], 15);
    }
  }, []);

  // Load locations and build map when content/city changes
  useEffect(() => {
    let cancelled = false;

    const loadAndBuildMap = async () => {
      try {
        setLoading(true);
        setMapReady(false);
        destroyMap();
        setLocations([]);
        setResolvedCount(0);

        // Step 1: Load Leaflet + geocode the CITY to get a map center + country code
        const [, cityResult] = await Promise.all([
          loadLeaflet(),
          geocodeCity(city),
        ]);
        if (cancelled) return;

        const cityCoords = cityResult ? { lat: cityResult.lat, lng: cityResult.lng } : null;
        const countryCode = cityResult?.countryCode;
        const country = cityResult?.country;

        // Compute effective radius from bounding box (for countries/regions this can be 1000+ km)
        const bboxRadius = cityResult?.boundingBox ? boundingBoxRadiusKm(cityResult.boundingBox) : 0;
        const effectiveRadius = Math.max(bboxRadius, MAX_DISTANCE_KM);

        if (!(window as any).L) {
          console.error('[PlanMap] Leaflet failed to load');
          setLoading(false);
          return;
        }

        // If city geocode failed, don't show a map at all — avoids showing wrong location
        if (!cityCoords) {
          setLoading(false);
          return;
        }

        // Step 2: Create the map — use bounding box for countries, fixed zoom for cities
        const center: [number, number] = [cityCoords.lat, cityCoords.lng];
        const zoom = bboxRadius > 200 ? 5 : bboxRadius > 50 ? 8 : 12;
        const created = createMap(center, zoom);
        if (!created) {
          console.error('[PlanMap] Failed to create map — container not ready');
          setLoading(false);
          return;
        }
        setMapReady(true);

        // Purge cached geocodes that are far from this city/country
        if (cityCoords) {
          const cache = getGeoCache();
          const cityKey = `|||${city.toLowerCase()}`;
          let purged = false;
          for (const key of Object.keys(cache)) {
            if (key.toLowerCase().endsWith(cityKey)) {
              const entry = cache[key];
              if (distanceKm(cityCoords.lat, cityCoords.lng, entry.lat, entry.lng) > effectiveRadius) {
                delete cache[key];
                purged = true;
              }
            }
          }
          if (purged) setGeoCache(cache);
        }

        // Step 3: Extract places and geocode them, adding markers progressively
        const dayCount = detectDayCount(content);
        const maxPlaces = Math.min(dayCount * 10, 25);
        const places = extractPlaces(content, city, maxPlaces);
        setTotalPlaces(places.length);
        if (places.length === 0) {
          setLoading(false);
          return;
        }

        // Helper: check if coords are within range of city/country center.
        // If city geocode failed, reject ALL results — we can't verify they're correct.
        const isNearCity = (coords: { lat: number; lng: number }) =>
          !!cityCoords && distanceKm(cityCoords.lat, cityCoords.lng, coords.lat, coords.lng) <= effectiveRadius;

        // Separate cached (instant) from uncached (needs API) places
        const cached: MapLocation[] = [];
        const uncachedPlaces: string[] = [];
        for (const place of places) {
          const coords = getCachedGeocode(place, city);
          if (coords) {
            if (isNearCity(coords)) {
              cached.push({ name: place, ...coords });
            }
          } else {
            uncachedPlaces.push(place);
          }
        }

        // Show cached results immediately
        if (cached.length > 0) {
          const routed = optimizeRoute(cached);
          setLocations(routed);
          setResolvedCount(cached.length);
          updateMarkers(routed);
          fitMapBounds(routed);
        }

        // Geocode uncached places, adding markers incrementally
        const allResults = [...cached];

        for (let i = 0; i < uncachedPlaces.length; i++) {
          if (cancelled) return;
          if (i > 0) await new Promise(r => setTimeout(r, 1100));

          const coords = await geocode(uncachedPlaces[i], city, cityCoords ?? undefined, countryCode, country, effectiveRadius);
          if (cancelled) return;

          if (coords && isNearCity(coords)) {
            allResults.push({ name: uncachedPlaces[i], ...coords });
            const routed = optimizeRoute([...allResults]);
            setLocations(routed);
            setResolvedCount(allResults.length);
            updateMarkers(routed);
          }
        }

        if (cancelled) return;

        // Final update — fit bounds once at the end so map doesn't jump during loading
        if (allResults.length > 0) {
          const routed = optimizeRoute(allResults);
          setLocations(routed);
          updateMarkers(routed);
          fitMapBounds(routed);
        }
        setLoading(false);
      } catch (err) {
        console.error('[PlanMap] loadAndBuildMap failed:', err);
        setLoading(false);
      }
    };

    loadAndBuildMap();
    return () => {
      cancelled = true;
      destroyMap();
    };
  }, [content, city, destroyMap, createMap, updateMarkers, fitMapBounds]);

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
