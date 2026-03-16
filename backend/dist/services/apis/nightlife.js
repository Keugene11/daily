"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.nightlifeService = void 0;
// ── Google Places API integration ───────────────────────────────────────
const GOOGLE_PLACES_URL = 'https://places.googleapis.com/v1/places:searchText';
const VENUE_TYPE_MAP = {
    'bar': 'Bar',
    'night_club': 'Club',
    'cocktail_bar': 'Cocktail Bar',
    'wine_bar': 'Wine Bar',
    'pub': 'Pub',
    'brewery': 'Brewery',
    'lounge': 'Lounge',
    'karaoke': 'Karaoke',
    'live_music_venue': 'Live Music',
    'jazz_club': 'Jazz Club',
    'comedy_club': 'Comedy Club',
    'dance_club': 'Dance Club',
    'beer_hall': 'Beer Hall',
    'beer_garden': 'Beer Garden',
    'sports_bar': 'Sports Bar',
    'hookah_bar': 'Hookah Bar',
    'speakeasy': 'Speakeasy',
};
const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const cache = new Map();
function getCacheKey(city) {
    return `nightlife|${city.toLowerCase().trim()}`;
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
// ── Review highlight extraction ─────────────────────────────────────────
function extractReviewHighlights(reviews) {
    if (!reviews || reviews.length === 0)
        return [];
    const vibeSignals = /\b(vibe|atmosphere|music|DJ|dance|crowd|scene|energy|bartender|bouncer|line|cover|dress|rooftop|patio|outdoor|view|cocktail|drink|beer|wine|shot|happy hour|live|band|comedy|show|karaoke|pool|darts|trivia)\b/i;
    const qualitySignals = /\b(amazing|incredible|best|awesome|fantastic|perfect|loved|favorite|great|recommend|must.visit|hidden gem|go.to|worth)\b/i;
    const highlights = [];
    const seen = new Set();
    for (const review of reviews.slice(0, 5)) {
        const text = review.text?.text || '';
        if (!text || text.length < 20)
            continue;
        const sentences = text.split(/[.!?]+/).map((s) => s.trim()).filter((s) => s.length > 10 && s.length < 150);
        for (const sentence of sentences) {
            if (vibeSignals.test(sentence) && qualitySignals.test(sentence)) {
                const normalized = sentence.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
                if (seen.has(normalized))
                    continue;
                seen.add(normalized);
                const clean = sentence.charAt(0).toUpperCase() + sentence.slice(1);
                highlights.push(clean);
                if (highlights.length >= 3)
                    return highlights;
            }
        }
    }
    return highlights;
}
// ── Map Google Places result to NightlifeVenue ──────────────────────────
function mapPlaceToVenue(place, city) {
    const name = place.displayName?.text || 'Unknown';
    const types = place.types || [];
    let venueType = 'Bar';
    for (const type of types) {
        if (VENUE_TYPE_MAP[type]) {
            venueType = VENUE_TYPE_MAP[type];
            break;
        }
    }
    const ratingNum = place.rating || 0;
    const rating = ratingNum > 0 ? `${ratingNum}/5` : 'N/A';
    const ratingCount = place.userRatingCount || 0;
    let vibe = '';
    if (place.editorialSummary?.text) {
        vibe = place.editorialSummary.text;
    }
    else if (place.reviews?.length > 0) {
        const reviewText = place.reviews[0].text?.text || '';
        vibe = reviewText.length > 120
            ? reviewText.substring(0, 117) + '...'
            : reviewText;
    }
    const reviewHighlights = extractReviewHighlights(place.reviews || []);
    const addressParts = (place.formattedAddress || '').split(',').map((s) => s.trim());
    const neighborhood = addressParts.length >= 3 ? addressParts[1] : (addressParts[0] || '');
    const googleMapsUri = place.googleMapsUri || `https://maps.google.com/?q=${encodeURIComponent(name + ', ' + city)}`;
    const url = place.websiteUri || googleMapsUri;
    return {
        name,
        type: venueType,
        rating,
        ratingCount,
        neighborhood,
        address: place.formattedAddress || '',
        vibe,
        link: `[${name}](${url})`,
        reviewHighlights,
    };
}
// ── Google Places API search ────────────────────────────────────────────
async function searchGooglePlaces(city, query) {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;
    if (!apiKey)
        return [];
    const requestBody = {
        textQuery: query,
        languageCode: 'en',
        maxResultCount: 12,
    };
    const fieldMask = [
        'places.displayName',
        'places.formattedAddress',
        'places.rating',
        'places.userRatingCount',
        'places.types',
        'places.editorialSummary',
        'places.googleMapsUri',
        'places.websiteUri',
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
            console.error(`[Nightlife] Google Places API error ${response.status}: ${errorText}`);
            return [];
        }
        const data = await response.json();
        const places = (data.places || [])
            .filter((p) => {
            const name = p.displayName?.text || 'Unknown';
            const status = p.businessStatus;
            if (status && status !== 'OPERATIONAL') {
                console.log(`[Nightlife] Skipping "${name}" — status: ${status}`);
                return false;
            }
            if (!status && !p.currentOpeningHours) {
                console.log(`[Nightlife] Skipping "${name}" — no status and no opening hours`);
                return false;
            }
            return true;
        });
        return places.map((p) => mapPlaceToVenue(p, city));
    }
    catch (error) {
        if (error?.name === 'AbortError') {
            console.error('[Nightlife] Google Places request timed out');
        }
        else {
            console.error('[Nightlife] Google Places fetch error:', error);
        }
        return [];
    }
    finally {
        clearTimeout(timeoutId);
    }
}
// ── Main export ─────────────────────────────────────────────────────────
exports.nightlifeService = {
    async getNightlife(city) {
        const cacheKey = getCacheKey(city);
        const cached = getFromCache(cacheKey);
        if (cached) {
            console.log(`[Nightlife] Cache hit for "${cacheKey}"`);
            return { success: true, data: cached.slice(0, 10) };
        }
        // Run two queries in parallel for broader coverage
        const [barsResults, clubsResults] = await Promise.all([
            searchGooglePlaces(city, `best nightlife bars clubs in ${city}`),
            searchGooglePlaces(city, `best cocktail bars lounges in ${city}`),
        ]);
        // Merge and deduplicate by name
        const seen = new Set();
        const merged = [];
        for (const v of [...barsResults, ...clubsResults]) {
            const key = v.name.toLowerCase();
            if (!seen.has(key)) {
                seen.add(key);
                merged.push(v);
            }
        }
        if (merged.length > 0) {
            console.log(`[Nightlife] Google Places returned ${barsResults.length} bars + ${clubsResults.length} lounges for ${city}`);
            setCache(cacheKey, merged);
            return { success: true, data: merged.slice(0, 10) };
        }
        console.log(`[Nightlife] No Google Places results for ${city} — returning empty`);
        return { success: true, data: [], note: 'No verified nightlife data available. Use your knowledge of well-known bars, clubs, and nightlife venues in this city.' };
    }
};
