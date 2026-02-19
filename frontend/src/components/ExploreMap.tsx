import React, { useEffect, useRef } from 'react';
import { ExploreResult } from '../hooks/useExplore';
import { MARKER_COLORS } from '../utils/mapUtils';

interface Props {
  results: ExploreResult[];
}

let _leafletPromise: Promise<void> | null = null;
function loadLeaflet(): Promise<void> {
  if (_leafletPromise) return _leafletPromise;
  _leafletPromise = new Promise((resolve) => {
    if ((window as any).L) { resolve(); return; }
    const CDN = 'https://unpkg.com/leaflet@1.9.4/dist';
    const CDN_FB = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4';

    const cssReady = new Promise<void>((r) => {
      if (document.querySelector('link[href*="leaflet"]')) { r(); return; }
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = `${CDN}/leaflet.css`;
      link.onload = () => r();
      link.onerror = () => { link.href = `${CDN_FB}/leaflet.min.css`; link.onload = () => r(); link.onerror = () => r(); };
      document.head.appendChild(link);
    });

    const jsReady = new Promise<void>((r) => {
      if (document.querySelector('script[src*="leaflet"]')) {
        if ((window as any).L) { r(); return; }
        document.querySelector('script[src*="leaflet"]')!.addEventListener('load', () => r());
        return;
      }
      const script = document.createElement('script');
      script.src = `${CDN}/leaflet.js`;
      script.onload = () => r();
      script.onerror = () => {
        document.head.removeChild(script);
        const fb = document.createElement('script');
        fb.src = `${CDN_FB}/leaflet.min.js`;
        fb.onload = () => r();
        fb.onerror = () => { _leafletPromise = null; r(); };
        document.head.appendChild(fb);
      };
      document.head.appendChild(script);
    });

    Promise.all([cssReady, jsReady]).then(() => resolve());
  });
  return _leafletPromise;
}

export const ExploreMap: React.FC<Props> = ({ results }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);

  useEffect(() => {
    if (results.length === 0) return;

    let cancelled = false;

    loadLeaflet().then(() => {
      if (cancelled || !containerRef.current) return;
      const L = (window as any).L;
      if (!L) return;

      // Clean up previous map
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      // Reset Leaflet's internal reference
      if (containerRef.current && (containerRef.current as any)._leaflet_id) {
        delete (containerRef.current as any)._leaflet_id;
      }

      const isDark = document.documentElement.classList.contains('dark');
      const tileUrl = isDark
        ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png'
        : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

      const map = L.map(containerRef.current, { zoomControl: false });
      mapRef.current = map;

      L.tileLayer(tileUrl, {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 18,
      }).addTo(map);

      L.control.zoom({ position: 'topright' }).addTo(map);

      const bounds: [number, number][] = [];

      results.forEach((place, i) => {
        if (!place.lat || !place.lng) return;

        const color = MARKER_COLORS[i % MARKER_COLORS.length];
        const icon = L.divIcon({
          className: '',
          html: `<div style="width:28px;height:28px;border-radius:50%;background:${color};display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px;font-weight:600;box-shadow:0 2px 6px rgba(0,0,0,0.3);border:2px solid #fff;">${i + 1}</div>`,
          iconSize: [28, 28],
          iconAnchor: [14, 14],
        });

        const marker = L.marker([place.lat, place.lng], { icon }).addTo(map);
        marker.bindPopup(
          `<div style="font-size:13px;font-weight:500;">${place.name}</div>` +
          (place.rating ? `<div style="font-size:11px;color:#888;">${place.rating.toFixed(1)} stars</div>` : '')
        );

        bounds.push([place.lat, place.lng]);
      });

      if (bounds.length > 0) {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
      }
    });

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [results]);

  // Hide map if no results have coordinates (e.g. all events)
  const hasCoords = results.some(r => r.lat !== 0 || r.lng !== 0);
  if (results.length === 0 || !hasCoords) return null;

  return (
    <div className="mt-8 mb-4">
      <h3 className="text-xs uppercase tracking-[0.15em] text-on-surface/40 mb-3">Map</h3>
      <div
        ref={containerRef}
        className="w-full h-80 rounded-xl overflow-hidden border border-on-surface/10"
      />
    </div>
  );
};
