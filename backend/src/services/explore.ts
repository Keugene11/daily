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
  const placesWithReviews = places.filter(p => p.reviews.length > 0).slice(0, 6);
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
          content: `You write honest, helpful local guides. Your tone is casual and knowledgeable — like a friend who actually lives in the area. Be specific: mention standout details from reviews (a particular barber, a signature dish, the vibe of the place). IMPORTANT: Always include pricing. If a price range is provided (e.g. "$10–$50"), always mention it. If a price level is provided ($, $$, $$$, $$$$), always mention it. Also scan reviews for any dollar amounts or cost mentions and include them. If no pricing info exists at all, say "prices not listed." If there are complaints, include them honestly. Never use generic filler like "highly recommended" or "a must-visit". Bold each place name as a link: **[Name](google maps url)**. Write 2-3 sentences per place. Start with a short intro paragraph. Use separate paragraphs to group related places or themes — keep it readable and well-spaced. No bullet points, no numbered lists, no markdown headings.`,
        },
        {
          role: 'user',
          content: `Write about the best "${query}" in ${location}. Here are ${placesWithReviews.length} places with their reviews:\n\n${placeDescriptions}`,
        },
      ],
      temperature: 0.7,
      max_tokens: 1500,
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
    const placeNames = rawPlaces.map(p => p.name.toLowerCase());
    const queryLower = query.toLowerCase();
    const locationLower = location.toLowerCase();

    const ytWithTimeout = Promise.race([
      searchYouTubeVideos(videoQuery, 8), // fetch more, filter down
      new Promise<never>((_, reject) => setTimeout(() => reject(new Error('yt timeout')), 8000)),
    ]).catch(() => [] as { videoId: string; title: string }[]);

    const [post, rawVideos] = await Promise.all([
      generateExplorePost(query, location, rawPlaces),
      ytWithTimeout,
    ]);

    // Only keep videos that are clearly relevant:
    // 1. Title mentions a specific place from the results, OR
    // 2. Title contains BOTH the query term AND location
    const videos = rawVideos.filter(v => {
      const titleLower = v.title.toLowerCase();
      const mentionsPlace = placeNames.some(name => {
        // Check if any significant word from the place name appears
        const words = name.split(/\s+/).filter(w => w.length > 3);
        return words.some(w => titleLower.includes(w));
      });
      const mentionsQuery = titleLower.includes(queryLower) ||
        titleLower.includes(queryLower + 's') || // barber -> barbers
        titleLower.includes(queryLower.replace(/s$/, '')); // barbers -> barber
      const mentionsLocation = titleLower.includes(locationLower) ||
        titleLower.includes(locationLower.replace(/\s+/g, ''));
      return mentionsPlace || (mentionsQuery && mentionsLocation);
    }).slice(0, 4);

    const places: ExplorePlace_out[] = rawPlaces.map(p => ({
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
