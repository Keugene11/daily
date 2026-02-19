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
  const placesWithReviews = places.filter(p => p.reviews.length > 0);
  if (placesWithReviews.length === 0) {
    return `No detailed reviews available for ${query} in ${location}.`;
  }

  const placeDescriptions = placesWithReviews.map((p, i) => {
    const reviewBlock = p.reviews.map((r, j) => `  Review ${j + 1}: "${r}"`).join('\n');
    const status = p.isOpen === true ? 'Open now' : p.isOpen === false ? 'Closed' : '';
    const price = p.priceLevel ? `Price level: ${p.priceLevel}` : '';
    const mapsLink = p.googleMapsUrl;
    return `${i + 1}. "${p.name}" — ${p.rating ?? 'no'} stars, ${p.userRatingCount} reviews${status ? ', ' + status : ''}${price ? ', ' + price : ''}\n   ${p.address}\n   Google Maps: ${mapsLink}\n${reviewBlock}`;
  }).join('\n\n');

  const dedalus = getClient();

  try {
    const response = await dedalus.chat.completions.create({
      model: 'anthropic/claude-sonnet-4-5',
      messages: [
        {
          role: 'system',
          content: `You write honest, helpful local guides. Your tone is casual and knowledgeable — like a friend who actually lives in the area. Be specific: mention standout details from reviews (a particular barber, a signature dish, the vibe of the place). If reviews mention specific prices (e.g. "$30 haircuts", "$15 for a fade", "$45 for cut and beard"), always include those exact prices. If a price level is provided ($, $$, $$$), mention it. If there are complaints, include them honestly. Never use generic filler like "highly recommended" or "a must-visit". Bold each place name as a link: **[Name](google maps url)**. Write 2-3 sentences per place. Start with a short intro paragraph. Use separate paragraphs to group related places or themes — keep it readable and well-spaced. No bullet points, no numbered lists, no markdown headings.`,
        },
        {
          role: 'user',
          content: `Write about the best "${query}" in ${location}. Here are ${placesWithReviews.length} places with their reviews:\n\n${placeDescriptions}`,
        },
      ],
      temperature: 0.7,
      max_tokens: 3000,
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
    // Fetch places and YouTube videos in parallel
    const videoQuery = `best ${query} in ${location}`;
    const [rawPlaces, videos] = await Promise.all([
      searchPlaces(query, location),
      searchYouTubeVideos(videoQuery, 4).catch(() => []),
    ]);

    if (rawPlaces.length === 0) {
      return { post: '', places: [], videos };
    }

    const post = await generateExplorePost(query, location, rawPlaces);

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
