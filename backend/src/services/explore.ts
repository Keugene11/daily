import Dedalus from 'dedalus-labs';
import { searchPlaces, ExplorePlace } from './apis/google_places';

export interface ExploreResult {
  id: string;
  name: string;
  address: string;
  lat: number;
  lng: number;
  rating: number | null;
  userRatingCount: number;
  priceLevel: string | null;
  photoUrl: string | null;
  summary: string;
  googleMapsUrl: string;
  types: string[];
  isOpen: boolean | null;
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

async function generateSummaries(places: ExplorePlace[]): Promise<string[]> {
  // Only summarize places that have reviews
  const placesWithReviews = places.filter(p => p.reviews.length > 0);
  if (placesWithReviews.length === 0) {
    return places.map(() => '');
  }

  const placeDescriptions = placesWithReviews.map((p, i) => {
    const reviewBlock = p.reviews.map((r, j) => `  Review ${j + 1}: "${r}"`).join('\n');
    return `Place ${i + 1}: "${p.name}" (${p.rating ?? 'no'} stars, ${p.userRatingCount} reviews)\n${reviewBlock}`;
  }).join('\n\n');

  const dedalus = getClient();

  try {
    const response = await dedalus.chat.completions.create({
      model: 'anthropic/claude-sonnet-4-5',
      messages: [
        {
          role: 'system',
          content: `You generate brief, honest summaries of places based on their reviews. For each place, write exactly 2-3 sentences. Be specific — mention a standout detail from the reviews (a particular dish, a specific stylist, the view from the trail). If there are complaints, mention them honestly. Do not use generic phrases like "great place" or "highly recommended". Return ONLY a JSON array of strings, one summary per place, in the same order as the input.`,
        },
        {
          role: 'user',
          content: `Summarize these ${placesWithReviews.length} places based on their reviews:\n\n${placeDescriptions}`,
        },
      ],
      temperature: 0.7,
      max_tokens: 2000,
    });

    const content = response.choices?.[0]?.message?.content || '';

    // Parse JSON array from response (handle markdown code blocks)
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.error('[Explore] Failed to parse summaries JSON:', content.substring(0, 200));
      return places.map(() => '');
    }

    const summaries: string[] = JSON.parse(jsonMatch[0]);

    // Map summaries back: places with reviews get summaries, others get empty string
    let summaryIdx = 0;
    return places.map(p => {
      if (p.reviews.length > 0 && summaryIdx < summaries.length) {
        return summaries[summaryIdx++] || '';
      }
      return '';
    });
  } catch (err) {
    console.error('[Explore] Summary generation failed:', err);
    return places.map(() => '');
  }
}

export async function exploreSearch(query: string, location: string): Promise<ExploreResult[]> {
  const places = await searchPlaces(query, location);

  if (places.length === 0) return [];

  const summaries = await generateSummaries(places);

  return places.map((place, i) => ({
    id: place.id,
    name: place.name,
    address: place.address,
    lat: place.lat,
    lng: place.lng,
    rating: place.rating,
    userRatingCount: place.userRatingCount,
    priceLevel: place.priceLevel,
    photoUrl: place.photoUrl,
    summary: summaries[i] || '',
    googleMapsUrl: place.googleMapsUrl,
    types: place.types,
    isOpen: place.isOpen,
  }));
}
