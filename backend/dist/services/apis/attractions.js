"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.attractionService = void 0;
// ── Google Places API integration ───────────────────────────────────────
const GOOGLE_PLACES_URL = 'https://places.googleapis.com/v1/places:searchText';
const PRICE_LEVEL_MAP = {
    'PRICE_LEVEL_FREE': 'Free',
    'PRICE_LEVEL_INEXPENSIVE': '$',
    'PRICE_LEVEL_MODERATE': '$$',
    'PRICE_LEVEL_EXPENSIVE': '$$$',
    'PRICE_LEVEL_VERY_EXPENSIVE': '$$$$',
};
// Map Google Place types to human-readable categories
const ATTRACTION_TYPE_MAP = {
    'tourist_attraction': 'Attraction',
    'amusement_park': 'Amusement Park',
    'aquarium': 'Aquarium',
    'art_gallery': 'Art Gallery',
    'botanical_garden': 'Botanical Garden',
    'casino': 'Casino',
    'cultural_landmark': 'Landmark',
    'historical_landmark': 'Historic Site',
    'marina': 'Marina',
    'movie_theater': 'Cinema',
    'museum': 'Museum',
    'national_park': 'National Park',
    'night_club': 'Nightclub',
    'park': 'Park',
    'performing_arts_theater': 'Theater',
    'plaza': 'Plaza',
    'ski_resort': 'Ski Resort',
    'spa': 'Spa',
    'stadium': 'Stadium',
    'visitor_center': 'Visitor Center',
    'zoo': 'Zoo',
};
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const cache = new Map();
function getCacheKey(city, category) {
    return `attractions|${city.toLowerCase().trim()}|${(category || '').toLowerCase()}`;
}
function getFromCache(key) {
    const entry = cache.get(key);
    if (!entry)
        return null;
    if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
        cache.delete(key);
        return null;
    }
    return entry.data;
}
function setCache(key, data) {
    if (cache.size > 200) {
        const entries = Array.from(cache.entries())
            .sort((a, b) => a[1].timestamp - b[1].timestamp);
        for (let i = 0; i < 50; i++) {
            cache.delete(entries[i][0]);
        }
    }
    cache.set(key, { data, timestamp: Date.now() });
}
// ── Google Places API search ────────────────────────────────────────────
function mapPlaceToAttraction(place, city) {
    const name = place.displayName?.text || 'Unknown';
    // Extract type from types array
    const types = place.types || [];
    let type = 'Attraction';
    for (const t of types) {
        if (ATTRACTION_TYPE_MAP[t]) {
            type = ATTRACTION_TYPE_MAP[t];
            break;
        }
    }
    const priceLevel = PRICE_LEVEL_MAP[place.priceLevel] || undefined;
    const ratingNum = place.rating || 0;
    const rating = ratingNum > 0 ? `${ratingNum}/5` : 'N/A';
    const ratingCount = place.userRatingCount || 0;
    let description = '';
    if (place.editorialSummary?.text) {
        description = place.editorialSummary.text;
    }
    else if (place.reviews?.length > 0) {
        const reviewText = place.reviews[0].text?.text || '';
        description = reviewText.length > 120
            ? reviewText.substring(0, 117) + '...'
            : reviewText;
    }
    const addressParts = (place.formattedAddress || '').split(',').map((s) => s.trim());
    const neighborhood = addressParts.length >= 3 ? addressParts[1] : (addressParts[0] || '');
    const googleMapsUri = place.googleMapsUri || `https://maps.google.com/?q=${encodeURIComponent(name + ', ' + city)}`;
    return {
        name,
        type,
        rating,
        ratingCount,
        description,
        neighborhood,
        address: place.formattedAddress || '',
        url: googleMapsUri,
        link: `[${name}](${googleMapsUri})`,
        priceLevel,
    };
}
async function searchGooglePlaces(city, query) {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey)
        return [];
    const requestBody = {
        textQuery: query,
        languageCode: 'en',
        maxResultCount: 10,
    };
    const fieldMask = [
        'places.displayName',
        'places.formattedAddress',
        'places.rating',
        'places.userRatingCount',
        'places.priceLevel',
        'places.types',
        'places.editorialSummary',
        'places.googleMapsUri',
        'places.reviews',
        'places.businessStatus',
    ].join(',');
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    try {
        const response = await fetch(GOOGLE_PLACES_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': apiKey,
                'X-Goog-FieldMask': fieldMask,
            },
            body: JSON.stringify(requestBody),
            signal: controller.signal,
        });
        if (!response.ok) {
            const errorText = await response.text().catch(() => '');
            console.error(`[Attractions] Google Places API error ${response.status}: ${errorText}`);
            return [];
        }
        const data = await response.json();
        const places = (data.places || [])
            .filter((p) => {
            const status = p.businessStatus;
            if (status && status !== 'OPERATIONAL') {
                console.log(`[Attractions] Skipping "${p.displayName?.text}" — status: ${status}`);
                return false;
            }
            return true;
        });
        return places.map((p) => mapPlaceToAttraction(p, city));
    }
    catch (error) {
        if (error?.name === 'AbortError') {
            console.error('[Attractions] Google Places request timed out');
        }
        else {
            console.error('[Attractions] Google Places fetch error:', error);
        }
        return [];
    }
    finally {
        clearTimeout(timeoutId);
    }
}
// ── Main export ─────────────────────────────────────────────────────────
exports.attractionService = {
    async getAttractions(city, category) {
        const cacheKey = getCacheKey(city, category);
        const cached = getFromCache(cacheKey);
        if (cached) {
            console.log(`[Attractions] Cache hit for "${cacheKey}"`);
            return { success: true, data: cached };
        }
        // Search two categories in parallel for broader coverage
        const queries = category
            ? [`best ${category} in ${city}`]
            : [
                `top attractions things to do in ${city}`,
                `unique experiences tours activities in ${city}`,
            ];
        const results = await Promise.all(queries.map(q => searchGooglePlaces(city, q)));
        // Merge and deduplicate
        const seen = new Set();
        const merged = [];
        for (const batch of results) {
            for (const a of batch) {
                const key = a.name.toLowerCase();
                if (!seen.has(key)) {
                    seen.add(key);
                    merged.push(a);
                }
            }
        }
        if (merged.length > 0) {
            console.log(`[Attractions] Google Places returned ${merged.length} attractions for ${city}`);
            setCache(cacheKey, merged);
            return { success: true, data: merged.slice(0, 15) };
        }
        console.log(`[Attractions] No results for ${city}`);
        return { success: true, data: [] };
    }
};
