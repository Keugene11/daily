import Dedalus from 'dedalus-labs';
import { searchPlaces, ExplorePlace } from './apis/google_places';
import { eventsService } from './apis/events';
import { meetupService } from './apis/meetups';
import { freeStuffService } from './apis/free_stuff';

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
  resultType?: 'place' | 'event';
  time?: string;
  isFree?: boolean;
  category?: string;
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

/**
 * Score how well an event matches the search query.
 * Returns 0 if no match, higher = better match.
 */
function scoreMatch(query: string, fields: string[]): number {
  const q = query.toLowerCase();
  const terms = q.split(/\s+/).filter(t => t.length > 2);
  let score = 0;

  for (const field of fields) {
    const f = field.toLowerCase();
    // Exact query match in field
    if (f.includes(q)) score += 10;
    // Individual term matches
    for (const term of terms) {
      if (f.includes(term)) score += 3;
    }
  }

  return score;
}

/**
 * Search hardcoded events, meetups, and free stuff for the given query and location.
 */
async function searchLocalEvents(query: string, location: string): Promise<ExploreResult[]> {
  // Fetch all three data sources in parallel
  const [eventsResult, meetupsResult, freeResult] = await Promise.all([
    eventsService.getEvents(location),
    meetupService.getMeetups(location),
    freeStuffService.getFreeStuff(location),
  ]);

  const results: { result: ExploreResult; score: number }[] = [];

  // Score and convert events
  if (eventsResult.success && eventsResult.data?.events) {
    for (const event of eventsResult.data.events) {
      const score = scoreMatch(query, [event.name, event.description, event.location, event.price || '']);
      if (score > 0) {
        results.push({
          score,
          result: {
            id: `event-${event.name.toLowerCase().replace(/\s+/g, '-')}`,
            name: event.name,
            address: event.location,
            lat: 0,
            lng: 0,
            rating: null,
            userRatingCount: 0,
            priceLevel: event.isFree ? 'Free' : (event.price || null),
            photoUrl: null,
            summary: event.description,
            googleMapsUrl: event.url || `https://maps.google.com/?q=${encodeURIComponent(event.name + ', ' + location)}`,
            types: [],
            isOpen: null,
            resultType: 'event',
            time: event.date,
            isFree: event.isFree,
            category: 'Event',
          },
        });
      }
    }
  }

  // Score and convert meetups
  if (meetupsResult.success && meetupsResult.data?.events) {
    for (const meetup of meetupsResult.data.events) {
      const topicStr = (meetup.topics || []).join(' ');
      const score = scoreMatch(query, [meetup.name, meetup.description, meetup.category || '', topicStr, meetup.location]);
      if (score > 0) {
        const categoryLabel = meetup.category
          ? meetup.category.charAt(0).toUpperCase() + meetup.category.slice(1)
          : 'Meetup';
        results.push({
          score,
          result: {
            id: `meetup-${meetup.name.toLowerCase().replace(/\s+/g, '-')}`,
            name: meetup.name,
            address: meetup.location,
            lat: 0,
            lng: 0,
            rating: null,
            userRatingCount: 0,
            priceLevel: meetup.isFree ? 'Free' : (meetup.price || null),
            photoUrl: null,
            summary: meetup.description,
            googleMapsUrl: meetup.url || `https://maps.google.com/?q=${encodeURIComponent(meetup.name + ', ' + location)}`,
            types: meetup.topics || [],
            isOpen: null,
            resultType: 'event',
            time: meetup.date,
            isFree: meetup.isFree,
            category: categoryLabel,
          },
        });
      }
    }
  }

  // Score and convert free stuff
  if (freeResult.success && freeResult.data?.activities) {
    for (const activity of freeResult.data.activities) {
      const typeStr = (activity as any).type || '';
      const score = scoreMatch(query, [activity.name, activity.description, typeStr, activity.location]);
      if (score > 0) {
        results.push({
          score,
          result: {
            id: `free-${activity.name.toLowerCase().replace(/\s+/g, '-')}`,
            name: activity.name,
            address: activity.location,
            lat: 0,
            lng: 0,
            rating: null,
            userRatingCount: 0,
            priceLevel: 'Free',
            photoUrl: null,
            summary: activity.description,
            googleMapsUrl: (activity as any).url || `https://maps.google.com/?q=${encodeURIComponent(activity.name + ', ' + location)}`,
            types: [],
            isOpen: null,
            resultType: 'event',
            time: activity.time,
            isFree: true,
            category: typeStr ? typeStr.charAt(0).toUpperCase() + typeStr.slice(1) : 'Free',
          },
        });
      }
    }
  }

  // Sort by score descending, return top 10
  results.sort((a, b) => b.score - a.score);
  return results.slice(0, 10).map(r => r.result);
}

export async function exploreSearch(query: string, location: string): Promise<ExploreResult[]> {
  const hasPlacesApi = !!process.env.GOOGLE_PLACES_API_KEY;

  // Run local event search always, Google Places only if configured
  const promises: [Promise<ExploreResult[]>, Promise<ExploreResult[]>] = [
    searchLocalEvents(query, location),
    hasPlacesApi
      ? searchPlaces(query, location).then(async (places) => {
          if (places.length === 0) return [];
          const summaries = await generateSummaries(places);
          return places.map((place, i): ExploreResult => ({
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
            resultType: 'place',
          }));
        }).catch((err) => {
          console.error('[Explore] Google Places search failed:', err);
          return [] as ExploreResult[];
        })
      : Promise.resolve([] as ExploreResult[]),
  ];

  const [localEvents, placeResults] = await Promise.all(promises);

  // Merge: interleave events and places
  // Events first (up to 6), then places, capped at 16 total
  const merged: ExploreResult[] = [];
  const eventSlice = localEvents.slice(0, 6);
  const placeSlice = placeResults.slice(0, 10);

  merged.push(...eventSlice, ...placeSlice);

  return merged.slice(0, 16);
}
