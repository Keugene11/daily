import Dedalus from 'dedalus-labs';
import { searchPlaces, ExplorePlace } from './apis/google_places';
import { searchYouTubeVideos } from './apis/youtube';

export interface ExplorePlace_out {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  rating: number | null;
  userRatingCount: number;
  priceLevel: string | null;
  photoUrl: string | null;
  googleMapsUrl: string;
  types: string[];
  isOpen: boolean | null;
}

export interface ExploreVideo {
  videoId: string;
  title: string;
}

export interface ExploreSearchResult {
  post: string;
  places: ExplorePlace_out[];
  videos: ExploreVideo[];
}

let client: Dedalus | null = null;

function getClient(): Dedalus {
  if (!client) {
    client = new Dedalus({
      apiKey: process.env.DEDALUS_API_KEY || '',
      timeout: 30000,
    });
  }
  return client;
}

async function generateExplorePost(query: string, location: string, places: ExplorePlace[]): Promise<string> {
  const placesWithReviews = places.filter(p => p.reviews.length > 0).slice(0, 5);
  if (placesWithReviews.length === 0) {
    return `No detailed reviews available for ${query} in ${location}.`;
  }

  const placeDescriptions = placesWithReviews.map((p, i) => {
    const reviewBlock = p.reviews.slice(0, 3).map((r, j) => `  Review ${j + 1}: "${r}"`).join('\n');
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
          content: `You write short, punchy local guides. Like a friend texting you their top picks — not a travel blog essay. Rules:

- One short intro sentence, max.
- Each place gets 1-2 sentences MAX. Lead with the most interesting detail from reviews (a specific dish, a standout feature, a vibe). Skip generic praise.
- Include pricing when available (price range, price level, or review mentions). If none, skip it — don't say "prices not listed."
- If there are real complaints, mention them in a few words.
- Bold each place name as a link: **[Name](google maps url)**.
- Keep the TOTAL response under 150 words. Be ruthlessly concise.
- No bullet points, no numbered lists, no markdown headings, no filler phrases.`,
        },
        {
          role: 'user',
          content: `Quick guide to the best "${query}" in ${location}. Here are ${placesWithReviews.length} places with reviews:\n\n${placeDescriptions}`,
        },
      ],
      temperature: 0.7,
      max_tokens: 600,
    });

    return response.choices?.[0]?.message?.content || '';
  } catch (err) {
    console.error('[Explore] Post generation failed:', err);
    // Fallback: construct a basic post from place names
    return placesWithReviews.map(p =>
      `**${p.name}** — ${p.rating ? p.rating.toFixed(1) + ' stars' : ''} ${p.address}`
    ).join('\n\n');
  }
}

export async function exploreSearch(query: string, location: string): Promise<ExploreSearchResult> {
  const hasPlacesApi = !!process.env.GOOGLE_PLACES_API_KEY;

  if (!hasPlacesApi) {
    return { post: `Google Places API is not configured. Add GOOGLE_PLACES_API_KEY to enable Explore.`, places: [], videos: [] };
  }

  try {
    // Fetch places first (needed for AI post generation)
    const rawPlaces = await searchPlaces(query, location);

    if (rawPlaces.length === 0) {
      return { post: '', places: [], videos: [] };
    }

    // Run AI post generation and YouTube search in parallel
    // YouTube has a 8s timeout so it won't block the response
    const videoQuery = `best ${query} in ${location}`;
    const queryLower = query.toLowerCase();
    const locationLower = location.toLowerCase();

    const ytWithTimeout = Promise.race([
      searchYouTubeVideos(videoQuery, 6),
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('yt timeout')), 8000)),
    ]).catch(() => [] as { videoId: string; title: string }[]);

    // Only use places with reviews (same ones the AI writes about)
    const placesForPost = rawPlaces.filter(p => p.reviews.length > 0).slice(0, 5);

    const [post, rawVideos] = await Promise.all([
      generateExplorePost(query, location, rawPlaces),
      ytWithTimeout,
    ]);

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

    const places: ExplorePlace_out[] = placesForPost.map(p => ({
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
  } catch (err) {
    console.error('[Explore] Search failed:', err);
    throw err;
  }
}
