import { useState, useEffect, useRef } from 'react';
import { extractPlaces } from '../utils/extractPlaces';
import { geocodeCity } from '../utils/mapUtils';

export interface PlaceMediaData {
  imageUrl?: string;
  videoId?: string;
}

/**
 * Extracts places from streaming content and resolves city for media.
 * YouTube video enrichment is currently disabled.
 */
export function useMediaEnrichment(content: string, city: string, maxPlaces = 12, _getAccessToken?: () => Promise<string | null>) {
  const [data, setData] = useState<Map<string, PlaceMediaData>>(new Map());
  const fetchedRef = useRef<Set<string>>(new Set());
  const prevCityRef = useRef(city);
  const [resolvedCity, setResolvedCity] = useState<string | null>(null);

  // Reset everything when the city changes (new plan)
  useEffect(() => {
    if (city !== prevCityRef.current) {
      prevCityRef.current = city;
      fetchedRef.current.clear();
      setResolvedCity(null);
      setData(new Map());
    }
  }, [city]);

  // Resolve city name from Nominatim
  useEffect(() => {
    if (!city) return;
    geocodeCity(city).then(result => {
      setResolvedCity(result?.resolvedCity || '');
    }).catch(() => setResolvedCity(''));
  }, [city]);

  // Debounced extraction for new places
  useEffect(() => {
    if (!content || !city || resolvedCity === null) return;

    let aborted = false;
    const timer = setTimeout(() => {
      if (aborted) return;
      const searchCity = resolvedCity || city;
      const extracted = extractPlaces(content, city, maxPlaces);
      const places = [searchCity, ...extracted.filter(p => p.toLowerCase() !== city.toLowerCase() && p.toLowerCase() !== searchCity.toLowerCase())];
      const newPlaces = places.filter(p => !fetchedRef.current.has(p));

      if (newPlaces.length === 0) return;
      newPlaces.forEach(p => fetchedRef.current.add(p));

      setData(prev => {
        const next = new Map(prev);
        for (const place of newPlaces) {
          next.set(place, {});
        }
        return next;
      });
    }, 400);

    return () => { aborted = true; clearTimeout(timer); };
  }, [content, city, resolvedCity]);

  return { data };
}
