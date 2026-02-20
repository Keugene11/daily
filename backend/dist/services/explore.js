"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.exploreSearch = exploreSearch;
const dedalus_labs_1 = __importDefault(require("dedalus-labs"));
const google_places_1 = require("./apis/google_places");
const youtube_1 = require("./apis/youtube");
let client = null;
function getClient() {
    if (!client) {
        client = new dedalus_labs_1.default({
            apiKey: process.env.DEDALUS_API_KEY || '',
            timeout: 30000,
        });
    }
    return client;
}
const WEATHER_CODES = {
    0: 'clear sky', 1: 'mostly clear', 2: 'partly cloudy', 3: 'overcast',
    45: 'foggy', 48: 'foggy', 51: 'light drizzle', 53: 'drizzle', 55: 'heavy drizzle',
    61: 'light rain', 63: 'rain', 65: 'heavy rain', 71: 'light snow', 73: 'snow',
    75: 'heavy snow', 80: 'rain showers', 81: 'rain showers', 82: 'heavy rain showers',
    95: 'thunderstorm', 96: 'thunderstorm with hail', 99: 'thunderstorm with hail',
};
async function fetchWeather(lat, lng) {
    try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,weather_code&temperature_unit=fahrenheit&timezone=auto`;
        const res = await fetch(url);
        if (!res.ok)
            return null;
        const data = await res.json();
        const temp = Math.round(data.current?.temperature_2m ?? 0);
        const code = data.current?.weather_code ?? -1;
        const condition = WEATHER_CODES[code] || '';
        return `${temp}°F${condition ? ', ' + condition : ''}`;
    }
    catch {
        return null;
    }
}
async function generateExplorePost(query, location, places, weather) {
    const placesWithReviews = places.filter(p => p.reviews.length > 0).slice(0, 5);
    if (placesWithReviews.length === 0) {
        return `No detailed reviews available for ${query} in ${location}.`;
    }
    const placeDescriptions = placesWithReviews.map((p, i) => {
        const reviewBlock = p.reviews.slice(0, 5).map((r, j) => `  Review ${j + 1}: "${r}"`).join('\n');
        const status = p.isOpen === true ? 'Open now' : p.isOpen === false ? 'Closed' : '';
        const price = p.priceLevel ? `Price level: ${p.priceLevel}` : '';
        const range = p.priceRange ? `Price range: ${p.priceRange}` : '';
        const mapsLink = p.googleMapsUrl;
        return `${i + 1}. "${p.name}" — ${p.rating ?? 'no'} stars, ${p.userRatingCount} reviews${status ? ', ' + status : ''}${price ? ', ' + price : ''}${range ? ', ' + range : ''}\n   ${p.address}\n   Google Maps: ${mapsLink}\n${reviewBlock}`;
    }).join('\n\n');
    const dedalus = getClient();
    try {
        const response = await dedalus.chat.completions.create({
            model: 'anthropic/claude-haiku-4-5',
            messages: [
                {
                    role: 'system',
                    content: `You write local guides that feel like advice from a friend who actually lives there. Honest, specific, and useful — not a travel blog.

For each place, write a short paragraph (2-4 sentences) covering:
- What makes it worth going (a specific dish, signature item, unique feature — pull from reviews)
- The vibe/atmosphere (cozy, loud, trendy, no-frills, etc.)
- Practical info: pricing if available, any heads up (long waits, cash only, parking, etc.)
- Honest downsides if reviews mention them — don't sugarcoat

Format rules:
- Open with one sentence that naturally sets the scene — weave in the current weather/day if provided (e.g. "A warm Thursday evening is perfect for..." or "Rain today? These cozy spots have you covered."). Don't force it if it doesn't fit.
- Bold each place name as a link: **[Name](google maps url)**
- If a place is currently open or closed, mention it naturally (e.g. "open now" or "heads up — they're closed right now")
- Separate each place with a blank line
- Write naturally — no bullet points, no numbered lists, no markdown headings
- Total length: 200-300 words`,
                },
                {
                    role: 'user',
                    content: `Guide to the best "${query}" in ${location}.\n\nToday: ${new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}${weather ? ` | Current weather: ${weather}` : ''}\n\nHere are ${placesWithReviews.length} places with reviews:\n\n${placeDescriptions}`,
                },
            ],
            temperature: 0.7,
            max_tokens: 1000,
        });
        return response.choices?.[0]?.message?.content || '';
    }
    catch (err) {
        console.error('[Explore] Post generation failed:', err);
        // Fallback: construct a basic post from place names
        return placesWithReviews.map(p => `**${p.name}** — ${p.rating ? p.rating.toFixed(1) + ' stars' : ''} ${p.address}`).join('\n\n');
    }
}
async function exploreSearch(query, location) {
    const hasPlacesApi = !!process.env.GOOGLE_PLACES_API_KEY;
    if (!hasPlacesApi) {
        return { post: `Google Places API is not configured. Add GOOGLE_PLACES_API_KEY to enable Explore.`, places: [], videos: [] };
    }
    try {
        // Fetch places first (needed for AI post generation)
        const rawPlaces = await (0, google_places_1.searchPlaces)(query, location);
        if (rawPlaces.length === 0) {
            return { post: '', places: [], videos: [] };
        }
        // Run AI post generation and YouTube search in parallel
        // YouTube has a 8s timeout so it won't block the response
        const videoQuery = `best ${query} in ${location}`;
        const queryLower = query.toLowerCase();
        const locationLower = location.toLowerCase();
        const ytWithTimeout = Promise.race([
            (0, youtube_1.searchYouTubeVideos)(videoQuery, 6),
            new Promise((_, reject) => setTimeout(() => reject(new Error('yt timeout')), 8000)),
        ]).catch(() => []);
        // Only use places with reviews (same ones the AI writes about)
        const placesForPost = rawPlaces.filter(p => p.reviews.length > 0).slice(0, 5);
        // Fetch weather using first place's coordinates
        const firstPlace = rawPlaces[0];
        const weatherPromise = (firstPlace?.lat && firstPlace?.lng)
            ? fetchWeather(firstPlace.lat, firstPlace.lng).catch(() => null)
            : Promise.resolve(null);
        const [weather, rawVideos] = await Promise.all([
            weatherPromise,
            ytWithTimeout,
        ]);
        const post = await generateExplorePost(query, location, rawPlaces, weather);
        // Only keep videos whose title mentions BOTH the query AND location
        // Single-word place name matches are too noisy (e.g. "park" matches everything)
        const videos = rawVideos.filter(v => {
            const titleLower = v.title.toLowerCase();
            const mentionsQuery = titleLower.includes(queryLower) ||
                titleLower.includes(queryLower + 's') ||
                titleLower.includes(queryLower.replace(/s$/, ''));
            const mentionsLocation = locationLower.split(/[\s,]+/).filter(w => w.length > 2).some(w => titleLower.includes(w));
            return mentionsQuery && mentionsLocation;
        }).slice(0, 3);
        const places = placesForPost.map(p => ({
            id: p.id,
            name: p.name,
            address: p.address,
            lat: p.lat,
            lng: p.lng,
            rating: p.rating,
            userRatingCount: p.userRatingCount,
            priceLevel: p.priceLevel,
            photoUrl: p.photoUrl,
            googleMapsUrl: p.googleMapsUrl,
            types: p.types,
            isOpen: p.isOpen,
        }));
        return { post, places, videos };
    }
    catch (err) {
        console.error('[Explore] Search failed:', err);
        throw err;
    }
}
