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
  detectDayCount,
  distanceKm,
  MAX_DISTANCE_KM,
  removeOutliers,
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

// Extract the first accommodation name from the "Where to Stay" section
function extractFirstAccommodation(text: string): string | null {
  const stayMatch = text.match(/##\s*Where to Stay\s*\n([\s\S]*?)(?=\n##\s|$)/i);
  if (!stayMatch) return null;
  // Look for the first markdown link in the section — that's the hotel name
  const linkMatch = stayMatch[1].match(/\[([^\]]+)\]\(/);
  if (linkMatch) return linkMatch[1].replace(/\+/g, ' ').trim();
  // Fallback: first bold text
  const boldMatch = stayMatch[1].match(/\*\*([^*]+)\*\*/);
  return boldMatch ? boldMatch[1].trim() : null;
}

// Auto-loading map with all plan locations — renders progressively as markers resolve
export const PlanMap: React.FC<Props> = ({ content, city }) => {
  const [locations, setLocations] = useState<MapLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [resolvedCount, setResolvedCount] = useState(0);
  const [totalPlaces, setTotalPlaces] = useState(0);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  const routeLineRef = useRef<any>(null);
  const mapTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);

  // Destroy existing map instance and clean up Leaflet's internal state
  const destroyMap = useCallback(() => {
    // Clear any pending invalidateSize timers from previous map
    mapTimersRef.current.forEach(t => clearTimeout(t));
    mapTimersRef.current = [];
    // Disconnect ResizeObserver
    if (resizeObserverRef.current) {
      resizeObserverRef.current.disconnect();
      resizeObserverRef.current = null;
    }
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
    // Store timer IDs so destroyMap can cancel them if the map is recreated
    mapTimersRef.current = [
      setTimeout(() => { mapInstanceRef.current?.invalidateSize(); }, 100),
      setTimeout(() => { mapInstanceRef.current?.invalidateSize(); }, 500),
      setTimeout(() => { mapInstanceRef.current?.invalidateSize(); }, 1500),
    ];

    // Watch for container resize — use ref so destroyMap can disconnect
    if (mapContainerRef.current && typeof ResizeObserver !== 'undefined') {
      const ro = new ResizeObserver(() => { mapInstanceRef.current?.invalidateSize(); });
      ro.observe(mapContainerRef.current);
      resizeObserverRef.current = ro;
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

    const isDark = document.documentElement.classList.contains('dark');
    const accentColor = isDark ? '#818CF8' : '#3B82F6';

    // Add markers with permanent labels
    locs.forEach((loc, i) => {
      const icon = L.divIcon({
        className: 'custom-marker',
        html: `<div style="display:flex;align-items:center;gap:6px;white-space:nowrap;">
          <div style="
            width: 26px; height: 26px; border-radius: 50%; flex-shrink: 0;
            background: ${accentColor};
            color: white; display: flex; align-items: center; justify-content: center;
            font-size: 12px; font-weight: 700; box-shadow: 0 2px 6px rgba(0,0,0,0.3);
            border: 2px solid white;
          ">${i + 1}</div>
          <span style="
            font-size: 11px; font-weight: 600; color: ${isDark ? '#e2e8f0' : '#1e293b'};
            background: ${isDark ? 'rgba(15,23,42,0.85)' : 'rgba(255,255,255,0.9)'};
            padding: 2px 8px; border-radius: 4px;
            box-shadow: 0 1px 3px rgba(0,0,0,0.2);
          ">${loc.name}</span>
        </div>`,
        iconSize: [0, 0],
        iconAnchor: [13, 13],
      });

      const marker = L.marker([loc.lat, loc.lng], { icon }).addTo(map);
      markersRef.current.push(marker);
    });

    // Draw route line connecting markers in order
    if (locs.length >= 2) {
      routeLineRef.current = L.polyline(
        locs.map(l => [l.lat, l.lng]),
        { color: accentColor, weight: 3, opacity: 0.5, dashArray: '8, 8' }
      ).addTo(map);
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
        setMapError(null);
        destroyMap();
        setLocations([]);
        setResolvedCount(0);

        // Step 1: Load Leaflet + geocode the CITY to get a map center + country code
        // Retry geocodeCity once if it fails (Nominatim can rate-limit or timeout)
        const [, firstTry] = await Promise.all([
          loadLeaflet(),
          geocodeCity(city),
        ]);
        if (cancelled) return;

        let cityResult = firstTry;
        if (!cityResult) {
          console.warn('[PlanMap] geocodeCity failed, retrying in 2s...');
          await new Promise(r => setTimeout(r, 2000));
          if (cancelled) return;
          cityResult = await geocodeCity(city);
          if (cancelled) return;
        }

        const cityCoords = cityResult ? { lat: cityResult.lat, lng: cityResult.lng } : null;
        const countryCode = cityResult?.countryCode;
        const country = cityResult?.country;
        // Use the resolved city name for geocoding individual places.
        // If the user typed "Cornell", Nominatim resolves to Cornell University
        // and the address has city: "Ithaca". Using "Ithaca" in place queries
        // (e.g., "Ithaca Commons, Ithaca, United States") works much better than
        // "Ithaca Commons, Cornell, United States" which Nominatim can't resolve.
        const geocodeCity_ = cityResult?.resolvedCity || city;

        // Compute effective radius from bounding box (for countries/regions this can be 1000+ km)
        const bboxRadius = cityResult?.boundingBox ? boundingBoxRadiusKm(cityResult.boundingBox) : 0;
        // Scale radius with actual area: small towns get tight radius, countries get wide.
        // bboxRadius * 3 gives reasonable padding; 25km minimum for tiny villages
        // (covers nearby towns the AI might recommend).
        const effectiveRadius = bboxRadius > 0
          ? Math.max(bboxRadius * 3, 25)
          : MAX_DISTANCE_KM;

        if (!(window as any).L) {
          console.error('[PlanMap] Leaflet failed to load');
          setMapError('Map library failed to load');
          setLoading(false);
          return;
        }

        // If city geocode failed after retry, show error instead of permanent spinner
        if (!cityCoords) {
          console.error('[PlanMap] geocodeCity returned null for:', city);
          setMapError('Could not locate this destination');
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
          const cityKey = `|||${geocodeCity_.toLowerCase()}`;
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

        // Separate places into: cached (instant) vs uncached (needs Nominatim API)
        // NOTE: We intentionally do NOT use embedded @lat,lng from LLM-generated URLs here.
        // LLMs hallucinate coordinates, placing pins in wrong locations. The /maps/search/
        // URLs work great for Google Maps links (Google searches by name near the coords),
        // but Nominatim gives accurate pin locations for our Leaflet map.
        const cached: MapLocation[] = [];
        const uncachedPlaces: string[] = [];
        for (const place of places) {
          const coords = getCachedGeocode(place, geocodeCity_);
          if (coords) {
            if (isNearCity(coords)) {
              cached.push({ name: place, ...coords });
            }
          } else {
            uncachedPlaces.push(place);
          }
        }

        // Show cached results immediately (in content order)
        if (cached.length > 0) {
          setLocations(cached);
          setResolvedCount(cached.length);
          updateMarkers(cached);
          fitMapBounds(cached);
        }

        // Geocode uncached places, adding markers incrementally
        const allResults = [...cached];

        for (let i = 0; i < uncachedPlaces.length; i++) {
          if (cancelled) return;
          // Wait 1100ms between Nominatim requests to respect rate limit (1 req/sec).
          // Always delay — even the first call needs spacing after geocodeCity.
          await new Promise(r => setTimeout(r, 1100));

          const coords = await geocode(uncachedPlaces[i], geocodeCity_, cityCoords ?? undefined, countryCode, country, effectiveRadius);
          if (cancelled) return;

          if (coords && isNearCity(coords)) {
            allResults.push({ name: uncachedPlaces[i], ...coords });
            setLocations([...allResults]);
            setResolvedCount(allResults.length);
            updateMarkers([...allResults]);
          }
        }

        if (cancelled) return;

        // Final update — remove outliers (mis-geocoded places far from the cluster),
        // then fit bounds so the map frames the real locations correctly.
        // Keep content order (Morning → Afternoon → Evening → Where to Stay)
        // so markers match the itinerary flow.
        if (allResults.length > 0) {
          const cleaned = removeOutliers(allResults);
          setLocations(cleaned);
          updateMarkers(cleaned);
          fitMapBounds(cleaned);
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
        {locations.length >= 2 && (() => {
          const hotel = extractFirstAccommodation(content);
          const hotelEncoded = hotel ? encodeURIComponent(`${hotel}, ${city}`) : null;
          const stops = locations.map(l => encodeURIComponent(`${l.name}, ${city}`));
          const path = hotelEncoded ? [hotelEncoded, ...stops, hotelEncoded].join('/') : stops.join('/');
          return <a
            href={`https://www.google.com/maps/dir/${path}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-xs text-on-surface/60 hover:text-on-surface transition-colors px-3 py-1.5 rounded-full border border-on-surface/15 hover:border-on-surface/30"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
            </svg>
            Open in Google Maps
          </a>;
        })()}
      </div>

      {/* Map wrapper — container is ALWAYS visible so Leaflet can measure it */}
      <div className="relative border border-on-surface/10 rounded-xl overflow-hidden" style={{ height: '300px' }}>
        {/* Actual map container — always has layout dimensions */}
        <div
          ref={mapContainerRef}
          style={{ width: '100%', height: '100%' }}
        />

        {/* Loading/error overlay — sits on top until map tiles are ready */}
        {!mapReady && (
          <div className="absolute inset-0 bg-surface flex flex-col items-center justify-center gap-2 z-[1000]">
            {mapError ? (
              <p className="text-xs text-on-surface/30">{mapError}</p>
            ) : (
              <>
                <svg className="w-5 h-5 text-on-surface/20 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                <p className="text-xs text-on-surface/30">Loading map...</p>
              </>
            )}
          </div>
        )}
      </div>

      {/* Location legend */}
      {locations.length > 0 && (
        <div className="flex flex-wrap gap-x-4 gap-y-1 mt-3">
          {locations.map((loc, i) => (
            <span key={i} className="text-[11px] text-on-surface/50">
              <span className="text-on-surface/30">{i + 1}.</span> {loc.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
};
