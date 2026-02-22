"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.accommodationService = void 0;
// ── Google Places API integration ───────────────────────────────────────
const GOOGLE_PLACES_URL = 'https://places.googleapis.com/v1/places:searchText';
const PRICE_LEVEL_MAP = {
    'PRICE_LEVEL_FREE': '$',
    'PRICE_LEVEL_INEXPENSIVE': '$',
    'PRICE_LEVEL_MODERATE': '$$',
    'PRICE_LEVEL_EXPENSIVE': '$$$',
    'PRICE_LEVEL_VERY_EXPENSIVE': '$$$$',
};
// Map Google Place types to accommodation categories
const ACCOMMODATION_TYPE_MAP = {
    'hotel': 'hotel',
    'motel': 'hotel',
    'resort_hotel': 'hotel',
    'extended_stay_hotel': 'apartment',
    'bed_and_breakfast': 'boutique',
    'guest_house': 'boutique',
    'hostel': 'hostel',
    'lodging': 'hotel',
    'cottage': 'apartment',
    'campground': 'hostel',
    'farm_stay': 'boutique',
};
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const cache = new Map();
function getCacheKey(city, budget, type) {
    return `accommodations|${city.toLowerCase().trim()}|${budget || ''}|${type || ''}`;
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
function mapPlaceToAccommodation(place, city) {
    const name = place.displayName?.text || 'Unknown';
    const types = place.types || [];
    let type = 'hotel';
    for (const t of types) {
        if (ACCOMMODATION_TYPE_MAP[t]) {
            type = ACCOMMODATION_TYPE_MAP[t];
            break;
        }
    }
    const priceRange = PRICE_LEVEL_MAP[place.priceLevel] || '$$';
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
        priceRange,
        rating,
        ratingCount,
        description,
        neighborhood,
        url: googleMapsUri,
        link: `[${name}](${googleMapsUri})`,
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
        'places.currentOpeningHours',
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
            console.error(`[Accommodations] Google Places API error ${response.status}: ${errorText}`);
            return [];
        }
        const data = await response.json();
        const places = (data.places || [])
            .filter((p) => {
            const name = p.displayName?.text || 'Unknown';
            const status = p.businessStatus;
            if (status && status !== 'OPERATIONAL') {
                console.log(`[Accommodations] Skipping "${name}" — status: ${status}`);
                return false;
            }
            if (!status && !p.currentOpeningHours) {
                console.log(`[Accommodations] Skipping "${name}" — no status and no opening hours`);
                return false;
            }
            return true;
        });
        return places.map((p) => mapPlaceToAccommodation(p, city));
    }
    catch (error) {
        if (error?.name === 'AbortError') {
            console.error('[Accommodations] Google Places request timed out');
        }
        else {
            console.error('[Accommodations] Google Places fetch error:', error);
        }
        return [];
    }
    finally {
        clearTimeout(timeoutId);
    }
}
// ── Main export ─────────────────────────────────────────────────────────
exports.accommodationService = {
    async getAccommodations(city, budget, type) {
        const cacheKey = getCacheKey(city, budget, type);
        const cached = getFromCache(cacheKey);
        if (cached) {
            console.log(`[Accommodations] Cache hit for "${cacheKey}"`);
            return { success: true, data: cached };
        }
        // Build query based on budget and type
        let query = `best hotels to stay in ${city}`;
        if (type === 'hostel')
            query = `best hostels in ${city}`;
        else if (type === 'boutique')
            query = `best boutique hotels in ${city}`;
        else if (type === 'apartment')
            query = `best apartment hotels serviced apartments in ${city}`;
        if (budget === 'low')
            query += ' affordable budget';
        if (budget === 'high')
            query += ' luxury upscale';
        const results = await searchGooglePlaces(city, query);
        if (results.length > 0) {
            console.log(`[Accommodations] Google Places returned ${results.length} hotels for ${city}`);
            setCache(cacheKey, results);
            return { success: true, data: results.slice(0, 6) };
        }
        console.log(`[Accommodations] No Google Places results for ${city} — returning empty`);
        return { success: true, data: [], note: 'No verified accommodation data available. Use your knowledge of well-known, established hotels in this city.' };
    }
};
