export interface ExplorePlace {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  rating: number | null;
  userRatingCount: number;
  priceLevel: string | null;
  priceRange: string | null;
  photoUrl: string | null;
  reviews: string[];
  googleMapsUrl: string;
  types: string[];
  isOpen: boolean | null;
}

const PRICE_MAP: Record<string, string> = {
  PRICE_LEVEL_FREE: 'Free',
  PRICE_LEVEL_INEXPENSIVE: '$',
  PRICE_LEVEL_MODERATE: '$$',
  PRICE_LEVEL_EXPENSIVE: '$$$',
  PRICE_LEVEL_VERY_EXPENSIVE: '$$$$',
};

async function resolvePhotoUrl(photoName: string, apiKey: string): Promise<string | null> {
  try {
    // The media endpoint returns a redirect to the actual image URL
    const url = `https://places.googleapis.com/v1/${photoName}/media?maxHeightPx=400&key=${apiKey}&skipHttpRedirect=true`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data: any = await res.json();
    return data.photoUri || null;
  } catch {
    return null;
  }
}

export async function searchPlaces(query: string, location: string): Promise<ExplorePlace[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    throw new Error('GOOGLE_PLACES_API_KEY not configured');
  }

  const textQuery = `${query} in ${location}`;
  const fieldMask = [
    'places.id',
    'places.displayName',
    'places.formattedAddress',
    'places.location',
    'places.rating',
    'places.userRatingCount',
    'places.priceLevel',
    'places.priceRange',
    'places.photos',
    'places.reviews',
    'places.regularOpeningHours',
    'places.types',
    'places.googleMapsUri',
  ].join(',');

  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': fieldMask,
    },
    body: JSON.stringify({
      textQuery,
      maxResultCount: 10,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error('[Google Places] API error:', res.status, errText);
    throw new Error(`Google Places API error: ${res.status}`);
  }

  const data: any = await res.json();
  const places = data.places || [];

  // Resolve photo URLs in parallel
  const results: ExplorePlace[] = await Promise.all(
    places.map(async (place: any) => {
      let photoUrl: string | null = null;
      if (place.photos?.length > 0) {
        photoUrl = await resolvePhotoUrl(place.photos[0].name, apiKey);
      }

      const reviews = (place.reviews || [])
        .slice(0, 5)
        .map((r: any) => r.text?.text || '')
        .filter((t: string) => t.length > 0);

      // Parse priceRange: { startPrice: { currencyCode, units }, endPrice: { ... } }
      let priceRange: string | null = null;
      if (place.priceRange) {
        const start = place.priceRange.startPrice;
        const end = place.priceRange.endPrice;
        if (start?.units && end?.units) {
          priceRange = `$${start.units}–$${end.units}`;
        } else if (start?.units) {
          priceRange = `from $${start.units}`;
        } else if (end?.units) {
          priceRange = `up to $${end.units}`;
        }
      }

      return {
        id: place.id || '',
        name: place.displayName?.text || 'Unknown',
        address: place.formattedAddress || '',
        lat: place.location?.latitude || 0,
        lng: place.location?.longitude || 0,
        rating: place.rating ?? null,
        userRatingCount: place.userRatingCount || 0,
        priceLevel: PRICE_MAP[place.priceLevel] || null,
        priceRange,
        photoUrl,
        reviews,
        googleMapsUrl: place.googleMapsUri || `https://maps.google.com/?q=${encodeURIComponent(place.displayName?.text || '')}`,
        types: place.types || [],
        isOpen: place.regularOpeningHours?.openNow ?? null,
      };
    })
  );

  return results;
}
