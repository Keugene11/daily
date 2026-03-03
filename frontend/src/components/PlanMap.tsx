import React, { useState, useEffect, useRef, useCallback } from 'react';
import { extractPlaces, extractPlaceCoords } from '../utils/extractPlaces';
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

const DARK_MAP_STYLES: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry', stylers: [{ color: '#212121' }] },
  { elementType: 'labels.icon', stylers: [{ visibility: 'off' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#212121' }] },
  { featureType: 'administrative', elementType: 'geometry', stylers: [{ color: '#757575' }] },
  { featureType: 'administrative.country', elementType: 'labels.text.fill', stylers: [{ color: '#9e9e9e' }] },
  { featureType: 'administrative.locality', elementType: 'labels.text.fill', stylers: [{ color: '#bdbdbd' }] },
  { featureType: 'poi', elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
  { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#181818' }] },
  { featureType: 'poi.park', elementType: 'labels.text.fill', stylers: [{ color: '#616161' }] },
  { featureType: 'road', elementType: 'geometry.fill', stylers: [{ color: '#2c2c2c' }] },
  { featureType: 'road', elementType: 'labels.text.fill', stylers: [{ color: '#8a8a8a' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#373737' }] },
  { featureType: 'road.highway', elementType: 'geometry', stylers: [{ color: '#3c3c3c' }] },
  { featureType: 'road.highway.controlled_access', elementType: 'geometry', stylers: [{ color: '#4e4e4e' }] },
  { featureType: 'road.local', elementType: 'labels.text.fill', stylers: [{ color: '#616161' }] },
  { featureType: 'transit', elementType: 'labels.text.fill', stylers: [{ color: '#757575' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#000000' }] },
  { featureType: 'water', elementType: 'labels.text.fill', stylers: [{ color: '#3d3d3d' }] },
];

// Singleton promise to load Google Maps JS API
let _gmapsPromise: Promise<void> | null = null;
function loadGoogleMaps(): Promise<void> {
  if (_gmapsPromise) return _gmapsPromise;
  _gmapsPromise = new Promise((resolve, reject) => {
    if (window.google?.maps?.Map) {
      resolve();
      return;
    }

    const existingScript = document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]');
    if (existingScript) {
      if (window.google?.maps?.Map) { resolve(); return; }
      existingScript.addEventListener('load', () => resolve());
      existingScript.addEventListener('error', () => {
        _gmapsPromise = null;
        reject(new Error('Google Maps script failed to load'));
      });
      return;
    }

    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_KEY || '';
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => {
      _gmapsPromise = null;
      reject(new Error('Google Maps script failed to load'));
    };
    document.head.appendChild(script);
  });
  return _gmapsPromise;
}

// Extract the first accommodation name + coordinates from the "Where to Stay" section.
// Pulls coords directly from the Google Maps @lat,lng URL so we don't need Nominatim.
function extractFirstAccommodation(text: string): { name: string; lat?: number; lng?: number } | null {
  const stayMatch = text.match(/##\s*(?:Where to Stay|Your Hotel)\s*\n([\s\S]*?)(?=\n##\s|$)/i);
  if (!stayMatch) return null;
  const section = stayMatch[1];

  // Try to find a Google Maps link with embedded @lat,lng coordinates
  const mapsLinkRegex = /\[([^\]]+)\]\((https?:\/\/(?:(?:www\.)?google\.com\/maps|maps\.google\.com)[^)]*@(-?\d+\.?\d*),(-?\d+\.?\d*)[^)]*)\)/;
  const mapsMatch = section.match(mapsLinkRegex);
  if (mapsMatch) {
    const name = mapsMatch[1].replace(/\+/g, ' ').trim();
    const lat = parseFloat(mapsMatch[3]);
    const lng = parseFloat(mapsMatch[4]);
    if (name.length > 2 && !isNaN(lat) && !isNaN(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      return { name, lat, lng };
    }
    return name.length > 2 ? { name } : null;
  }

  // Fallback: first markdown link (no coords available)
  const linkMatch = section.match(/\[([^\]]+)\]\(/);
  if (linkMatch) {
    const name = linkMatch[1].replace(/\+/g, ' ').trim();
    return name.length > 2 ? { name } : null;
  }
  // Fallback: first bold text
  const boldMatch = section.match(/\*\*([^*]+)\*\*/);
  return boldMatch && boldMatch[1].trim().length > 2 ? { name: boldMatch[1].trim() } : null;
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
  const mapInstanceRef = useRef<google.maps.Map | null>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  const overlaysRef = useRef<google.maps.OverlayView[]>([]);
  const routeLineRef = useRef<google.maps.Polyline | null>(null);

  // Destroy existing map instance
  const destroyMap = useCallback(() => {
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];
    overlaysRef.current.forEach(o => o.setMap(null));
    overlaysRef.current = [];
    if (routeLineRef.current) {
      routeLineRef.current.setMap(null);
      routeLineRef.current = null;
    }
    mapInstanceRef.current = null;
    if (mapContainerRef.current) {
      mapContainerRef.current.innerHTML = '';
    }
  }, []);

  // Create the map on the always-present container div
  const createMap = useCallback((center: { lat: number; lng: number }, zoom = 13) => {
    if (!window.google?.maps?.Map || !mapContainerRef.current) return false;

    destroyMap();

    const isDark = document.documentElement.classList.contains('dark');

    try {
      const map = new google.maps.Map(mapContainerRef.current, {
        center,
        zoom,
        disableDefaultUI: true,
        zoomControl: true,
        styles: isDark ? DARK_MAP_STYLES : undefined,
      });
      mapInstanceRef.current = map;
      return true;
    } catch (err) {
      console.error('[PlanMap] google.maps.Map() failed:', err);
      return false;
    }
  }, [destroyMap]);

  // Update markers and route line on the existing map
  const updateMarkers = useCallback((locs: MapLocation[]) => {
    const map = mapInstanceRef.current;
    if (!map || locs.length === 0) return;

    // Clear old markers and route line
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];
    overlaysRef.current.forEach(o => o.setMap(null));
    overlaysRef.current = [];
    if (routeLineRef.current) {
      routeLineRef.current.setMap(null);
      routeLineRef.current = null;
    }

    const isDark = document.documentElement.classList.contains('dark');
    const accentColor = isDark ? '#818CF8' : '#3B82F6';

    // Add numbered circle markers with label overlays
    locs.forEach((loc, i) => {
      // SVG circle with number as marker icon
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28">
        <circle cx="14" cy="14" r="12" fill="${accentColor}" stroke="white" stroke-width="2"/>
        <text x="14" y="18" text-anchor="middle" fill="white" font-size="12" font-weight="700" font-family="sans-serif">${i + 1}</text>
      </svg>`;

      const marker = new google.maps.Marker({
        map,
        position: { lat: loc.lat, lng: loc.lng },
        icon: {
          url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(svg),
          scaledSize: new google.maps.Size(28, 28),
          anchor: new google.maps.Point(14, 14),
        },
      });
      markersRef.current.push(marker);

      // Custom overlay for the name label
      class LabelOverlay extends google.maps.OverlayView {
        private div: HTMLDivElement | null = null;
        private position: google.maps.LatLng;
        private text: string;
        constructor(position: google.maps.LatLng, text: string) {
          super();
          this.position = position;
          this.text = text;
        }
        onAdd() {
          this.div = document.createElement('div');
          this.div.style.cssText = `position:absolute;white-space:nowrap;font-size:11px;font-weight:600;color:${isDark ? '#e2e8f0' : '#1e293b'};background:${isDark ? 'rgba(15,23,42,0.85)' : 'rgba(255,255,255,0.9)'};padding:2px 8px;border-radius:4px;box-shadow:0 1px 3px rgba(0,0,0,0.2);pointer-events:none;`;
          this.div.textContent = this.text;
          this.getPanes()!.overlayLayer.appendChild(this.div);
        }
        draw() {
          if (!this.div) return;
          const point = this.getProjection().fromLatLngToDivPixel(this.position);
          if (point) {
            this.div.style.left = (point.x + 18) + 'px';
            this.div.style.top = (point.y - 10) + 'px';
          }
        }
        onRemove() {
          this.div?.remove();
          this.div = null;
        }
      }

      const overlay = new LabelOverlay(new google.maps.LatLng(loc.lat, loc.lng), loc.name);
      overlay.setMap(map);
      overlaysRef.current.push(overlay);
    });

    // Draw dashed route line connecting markers in order
    if (locs.length >= 2) {
      routeLineRef.current = new google.maps.Polyline({
        path: locs.map(l => ({ lat: l.lat, lng: l.lng })),
        strokeColor: accentColor,
        strokeOpacity: 0,
        strokeWeight: 3,
        icons: [{
          icon: {
            path: 'M 0,-1 0,1',
            strokeOpacity: 0.5,
            strokeWeight: 3,
            scale: 4,
          },
          offset: '0',
          repeat: '16px',
        }],
        map,
      });
    }
  }, []);

  // Fit map bounds to show all current markers
  const fitMapBounds = useCallback((locs: MapLocation[]) => {
    const map = mapInstanceRef.current;
    if (!map || locs.length === 0) return;

    if (locs.length > 1) {
      const bounds = new google.maps.LatLngBounds();
      locs.forEach(l => bounds.extend({ lat: l.lat, lng: l.lng }));
      map.fitBounds(bounds, 40);
    } else {
      map.setCenter({ lat: locs[0].lat, lng: locs[0].lng });
      map.setZoom(15);
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

        // Step 1: Load Google Maps + geocode the CITY to get a map center + country code
        const [, firstTry] = await Promise.all([
          loadGoogleMaps(),
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
        const geocodeCity_ = cityResult?.resolvedCity || city;

        const bboxRadius = cityResult?.boundingBox ? boundingBoxRadiusKm(cityResult.boundingBox) : 0;
        const effectiveRadius = bboxRadius > 0
          ? Math.max(bboxRadius * 3, 25)
          : MAX_DISTANCE_KM;

        if (!window.google?.maps?.Map) {
          console.error('[PlanMap] Google Maps failed to load');
          setMapError('Map library failed to load');
          setLoading(false);
          return;
        }

        if (!cityCoords) {
          console.error('[PlanMap] geocodeCity returned null for:', city);
          setMapError('Could not locate this destination');
          setLoading(false);
          return;
        }

        // Step 2: Create the map
        const center = { lat: cityCoords.lat, lng: cityCoords.lng };
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

        const hotel = extractFirstAccommodation(content);
        const hotelName = hotel?.name ?? null;
        const hotelHasCoords = hotel && hotel.lat != null && hotel.lng != null;
        if (hotelName && !hotelHasCoords && !places.includes(hotelName)) {
          places.unshift(hotelName);
        }

        setTotalPlaces(places.length + (hotelHasCoords ? 1 : 0));
        if (places.length === 0 && !hotelHasCoords) {
          setLoading(false);
          return;
        }

        const isNearCity = (coords: { lat: number; lng: number }) =>
          !!cityCoords && distanceKm(cityCoords.lat, cityCoords.lng, coords.lat, coords.lng) <= effectiveRadius;

        const embeddedCoords = extractPlaceCoords(content);
        const resolved = new Map<string, MapLocation>();

        if (hotelHasCoords && hotel) {
          resolved.set(hotel.name, { name: hotel.name, lat: hotel.lat!, lng: hotel.lng! });
        }

        const uncachedPlaces: string[] = [];
        for (const place of places) {
          const coords = getCachedGeocode(place, geocodeCity_);
          if (coords) {
            if (isNearCity(coords)) {
              resolved.set(place, { name: place, ...coords });
            }
          } else {
            uncachedPlaces.push(place);
          }
        }

        const orderedSnapshot = () => {
          const ordered: MapLocation[] = [];
          if (hotelHasCoords && hotel && resolved.has(hotel.name)) {
            ordered.push(resolved.get(hotel.name)!);
          }
          for (const place of places) {
            if (resolved.has(place)) ordered.push(resolved.get(place)!);
          }
          return ordered;
        };

        if (resolved.size > 0) {
          const snap = orderedSnapshot();
          setLocations(snap);
          setResolvedCount(snap.length);
          updateMarkers(snap);
          fitMapBounds(snap);
        }

        for (let i = 0; i < uncachedPlaces.length; i++) {
          if (cancelled) return;
          await new Promise(r => setTimeout(r, 1100));

          const place = uncachedPlaces[i];
          const coords = await geocode(place, geocodeCity_, cityCoords ?? undefined, countryCode, country, effectiveRadius);
          if (cancelled) return;

          if (coords && isNearCity(coords)) {
            resolved.set(place, { name: place, ...coords });
          } else {
            const embedded = embeddedCoords.get(place);
            if (embedded && isNearCity(embedded)) {
              resolved.set(place, { name: place, ...embedded });
            }
          }

          const snap = orderedSnapshot();
          setLocations(snap);
          setResolvedCount(snap.length);
          updateMarkers(snap);
        }

        const allResults = orderedSnapshot();

        if (cancelled) return;

        if (allResults.length > 0) {
          const hotelLoc = hotelName ? allResults.find(l => l.name === hotelName) : null;
          const toClean = hotelLoc ? allResults.filter(l => l.name !== hotelName) : allResults;
          const cleaned = removeOutliers(toClean);

          if (hotelLoc) {
            cleaned.unshift(hotelLoc);
            cleaned.push({ ...hotelLoc, name: `${hotelName} (return)` });
          }
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
          const hotelInfo = extractFirstAccommodation(content);
          const hotelEncoded = hotelInfo ? encodeURIComponent(`${hotelInfo.name}, ${city}`) : null;
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

      {/* Map container */}
      <div className="relative border border-on-surface/10 rounded-xl overflow-hidden" style={{ height: '300px' }}>
        <div
          ref={mapContainerRef}
          style={{ width: '100%', height: '100%' }}
        />

        {/* Loading/error overlay */}
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
