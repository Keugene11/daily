import { ToolResult } from '../../types';
import { resolveLocation } from './location_aliases';

interface Restaurant {
  name: string;
  cuisine: string;
  priceRange: string;
  rating: string;
  ratingCount?: number;
  description: string;
  neighborhood: string;
  address?: string;
  url?: string;
  link?: string;
  reviewHighlights?: string[];
}

// ── Google Places API integration ───────────────────────────────────────

const GOOGLE_PLACES_URL = 'https://places.googleapis.com/v1/places:searchText';

const PRICE_LEVEL_MAP: Record<string, string> = {
  'PRICE_LEVEL_FREE': '$',
  'PRICE_LEVEL_INEXPENSIVE': '$',
  'PRICE_LEVEL_MODERATE': '$$',
  'PRICE_LEVEL_EXPENSIVE': '$$$',
  'PRICE_LEVEL_VERY_EXPENSIVE': '$$$$',
};

const CUISINE_TYPE_MAP: Record<string, string> = {
  'italian_restaurant': 'Italian',
  'japanese_restaurant': 'Japanese',
  'chinese_restaurant': 'Chinese',
  'mexican_restaurant': 'Mexican',
  'indian_restaurant': 'Indian',
  'thai_restaurant': 'Thai',
  'french_restaurant': 'French',
  'korean_restaurant': 'Korean',
  'vietnamese_restaurant': 'Vietnamese',
  'mediterranean_restaurant': 'Mediterranean',
  'american_restaurant': 'American',
  'seafood_restaurant': 'Seafood',
  'pizza_restaurant': 'Pizza',
  'sushi_restaurant': 'Sushi',
  'steak_house': 'Steakhouse',
  'barbecue_restaurant': 'BBQ',
  'brunch_restaurant': 'Brunch',
  'hamburger_restaurant': 'Burgers',
  'ramen_restaurant': 'Ramen',
  'sandwich_shop': 'Sandwiches',
  'cafe': 'Cafe',
  'bakery': 'Bakery',
  'ice_cream_shop': 'Ice Cream',
  'vegan_restaurant': 'Vegan',
  'vegetarian_restaurant': 'Vegetarian',
  'spanish_restaurant': 'Spanish',
  'greek_restaurant': 'Greek',
  'turkish_restaurant': 'Turkish',
  'lebanese_restaurant': 'Lebanese',
  'middle_eastern_restaurant': 'Middle Eastern',
  'indonesian_restaurant': 'Indonesian',
  'brazilian_restaurant': 'Brazilian',
  'peruvian_restaurant': 'Peruvian',
};

// ── In-memory cache ─────────────────────────────────────────────────────

interface CacheEntry {
  data: Restaurant[];
  timestamp: number;
}

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 hours
const cache = new Map<string, CacheEntry>();

function getCacheKey(city: string, cuisine?: string, budget?: string): string {
  return `${city.toLowerCase().trim()}|${(cuisine || '').toLowerCase()}|${budget || ''}`;
}

function getFromCache(key: string): Restaurant[] | null {
  const entry = cache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
    cache.delete(key);
    return null;
  }
  return entry.data;
}

function setCache(key: string, data: Restaurant[]): void {
  // Cap at 200 entries to prevent memory bloat in serverless
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

/**
 * Extract short food-related snippets from Google Places reviews.
 * Looks for sentences that mention specific dishes, drinks, or menu items.
 * Returns up to 3 unique, short highlights like:
 *   "The cacio e pepe was incredible"
 *   "Get the spicy margarita — best I've had"
 */
function extractReviewHighlights(reviews: any[]): string[] {
  if (!reviews || reviews.length === 0) return [];

  // Food/dish signal words — if a sentence contains these, it's likely about a specific item
  const foodSignals = /\b(order(?:ed)?|try|tried|got|get|had|must.have|recommend|amazing|incredible|best|delicious|fantastic|perfect|loved|favorite|famous|signature|special)\b/i;
  const dishSignals = /\b(pizza|pasta|burger|steak|tacos?|sushi|ramen|noodles?|soup|salad|sandwich|wings?|ribs?|brisket|fries|chicken|fish|shrimp|lobster|crab|oyster|pho|curry|pad thai|dim sum|dumpling|roll|burrito|quesadilla|ceviche|risotto|gnocchi|lasagna|carbonara|tiramisu|cheesecake|pancake|waffle|croissant|beignet|gelato|ice cream|cocktail|margarita|martini|wine|beer|coffee|latte|espresso|chai|matcha|smoothie|juice|brunch|breakfast|dessert|appetizer|entree|special|menu)\b/i;

  const highlights: string[] = [];
  const seen = new Set<string>();

  for (const review of reviews.slice(0, 5)) {
    const text: string = review.text?.text || '';
    if (!text || text.length < 20) continue;

    // Split into sentences
    const sentences = text.split(/[.!?]+/).map((s: string) => s.trim()).filter((s: string) => s.length > 10 && s.length < 150);

    for (const sentence of sentences) {
      if (foodSignals.test(sentence) && dishSignals.test(sentence)) {
        // Normalize and deduplicate
        const normalized = sentence.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
        if (seen.has(normalized)) continue;
        seen.add(normalized);

        // Clean up — capitalize first letter
        const clean = sentence.charAt(0).toUpperCase() + sentence.slice(1);
        highlights.push(clean);

        if (highlights.length >= 3) return highlights;
      }
    }
  }

  return highlights;
}

function mapPlaceToRestaurant(place: any, city: string): Restaurant {
  const name = place.displayName?.text || 'Unknown';

  // Extract cuisine from types array
  const types: string[] = place.types || [];
  let cuisine = 'Restaurant';
  for (const type of types) {
    if (CUISINE_TYPE_MAP[type]) {
      cuisine = CUISINE_TYPE_MAP[type];
      break;
    }
    if (type.endsWith('_restaurant') && type !== 'restaurant') {
      cuisine = type.replace('_restaurant', '').replace(/_/g, ' ')
        .replace(/\b\w/g, (c: string) => c.toUpperCase());
      break;
    }
  }

  const priceRange = PRICE_LEVEL_MAP[place.priceLevel] || '$$';
  const ratingNum = place.rating || 0;
  const rating = ratingNum > 0 ? `${ratingNum}/5` : 'N/A';
  const ratingCount = place.userRatingCount || 0;

  // Description: prefer editorialSummary, fall back to first review
  let description = '';
  if (place.editorialSummary?.text) {
    description = place.editorialSummary.text;
  } else if (place.reviews?.length > 0) {
    const reviewText = place.reviews[0].text?.text || '';
    description = reviewText.length > 120
      ? reviewText.substring(0, 117) + '...'
      : reviewText;
  }

  // Extract dish/food mentions from reviews — real items that real people ordered
  const reviewHighlights = extractReviewHighlights(place.reviews || []);

  // Neighborhood: parse from address (2nd component is usually the area)
  const addressParts = (place.formattedAddress || '').split(',').map((s: string) => s.trim());
  const neighborhood = addressParts.length >= 3 ? addressParts[1] : (addressParts[0] || '');

  const googleMapsUri = place.googleMapsUri || `https://maps.google.com/?q=${encodeURIComponent(name + ', ' + city)}`;

  return {
    name,
    cuisine,
    priceRange,
    rating,
    ratingCount,
    description,
    neighborhood,
    address: place.formattedAddress || '',
    url: googleMapsUri,
    link: `[${name}](${googleMapsUri})`,
    reviewHighlights,
  };
}

async function searchGooglePlaces(
  city: string,
  cuisine?: string,
  budget?: string,
): Promise<Restaurant[]> {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) return []; // triggers fallback

  let query = `best restaurants in ${city}`;
  if (cuisine) query = `best ${cuisine} restaurants in ${city}`;
  if (budget === 'low') query += ' affordable cheap';
  if (budget === 'high') query += ' upscale fine dining';

  const priceLevels: string[] = [];
  if (budget === 'low') priceLevels.push('PRICE_LEVEL_INEXPENSIVE');
  if (budget === 'medium') {
    priceLevels.push('PRICE_LEVEL_INEXPENSIVE', 'PRICE_LEVEL_MODERATE');
  }

  const requestBody: any = {
    textQuery: query,
    languageCode: 'en',
    maxResultCount: 8,
  };
  if (priceLevels.length > 0) {
    requestBody.priceLevels = priceLevels;
  }

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
      console.error(`[Restaurants] Google Places API error ${response.status}: ${errorText}`);
      return [];
    }

    const data: any = await response.json();
    const places = data.places || [];
    return places.map((p: any) => mapPlaceToRestaurant(p, city));
  } catch (error: any) {
    if (error?.name === 'AbortError') {
      console.error('[Restaurants] Google Places request timed out');
    } else {
      console.error('[Restaurants] Google Places fetch error:', error);
    }
    return [];
  } finally {
    clearTimeout(timeoutId);
  }
}

// ── Fallback: hardcoded data ────────────────────────────────────────────

interface FallbackRestaurant extends Restaurant {
  mustTry?: string;
  avgCost?: string;
}

const CITY_RESTAURANTS: Record<string, FallbackRestaurant[]> = {
  'new york': [
    { name: 'Joe\'s Pizza', cuisine: 'New York Pizza', priceRange: '$', avgCost: '$5/person', rating: '4.5/5', neighborhood: 'Greenwich Village', description: 'Iconic NYC slice joint since 1975 — thin crust, perfectly charred, folded in half', mustTry: 'Classic cheese slice ($3.50)' },
    { name: 'Xi\'an Famous Foods', cuisine: 'Chinese (Xi\'an)', priceRange: '$', avgCost: '$12/person', rating: '4.6/5', neighborhood: 'Multiple locations', description: 'Hand-pulled noodles and cumin lamb that changed NYC\'s food scene', mustTry: 'Spicy cumin lamb noodles ($11.50)' },
    { name: 'Los Tacos No. 1', cuisine: 'Mexican', priceRange: '$', avgCost: '$10/person', rating: '4.7/5', neighborhood: 'Chelsea Market', description: 'Corn tortillas made fresh on a comal, filled with adobo chicken or carne asada', mustTry: 'Adobada taco ($4.75)' },
    { name: 'Peter Luger Steak House', cuisine: 'Steakhouse', priceRange: '$$$', avgCost: '$120/person', rating: '4.4/5', neighborhood: 'Williamsburg, Brooklyn', description: 'NYC\'s legendary steakhouse since 1887. Cash only. No menu — they know what you want', mustTry: 'Porterhouse for two ($120/person)' },
    { name: 'Di Fara Pizza', cuisine: 'Neapolitan Pizza', priceRange: '$$', avgCost: '$15/person', rating: '4.8/5', neighborhood: 'Midwood, Brooklyn', description: 'Dom DeMarco has made every pizza by hand since 1965. Worth the wait', mustTry: 'Square slice with fresh basil ($6)' },
    { name: 'Russ & Daughters', cuisine: 'Jewish Deli', priceRange: '$$', avgCost: '$18/person', rating: '4.7/5', neighborhood: 'Lower East Side', description: 'Appetizing shop since 1914 — the best smoked fish, bagels, and cream cheese in NYC', mustTry: 'Classic bagel with lox ($16)' },
    { name: 'Prince Street Pizza', cuisine: 'Sicilian Pizza', priceRange: '$', avgCost: '$6/person', rating: '4.5/5', neighborhood: 'Nolita', description: 'Spicy pepperoni square slice with pools of grease — a viral sensation for good reason', mustTry: 'Spicy Spring pepperoni square ($5.50)' },
    { name: 'Halal Guys', cuisine: 'Middle Eastern', priceRange: '$', avgCost: '$10/person', rating: '4.3/5', neighborhood: '53rd & 6th Ave (original cart)', description: 'The famous food cart that spawned a chain. Late-night chicken and gyro over rice', mustTry: 'Combo platter with white AND red sauce ($9)' }
  ],
  'los angeles': [
    { name: 'Howlin\' Ray\'s', cuisine: 'Nashville Hot Chicken', priceRange: '$', avgCost: '$15/person', rating: '4.8/5', neighborhood: 'Chinatown', description: 'LA\'s hottest chicken — literally. Heat levels from "Country" to "Howlin\'"', mustTry: 'Howlin\' level sandwich ($14)' },
    { name: 'Guerrilla Tacos', cuisine: 'Mexican Fusion', priceRange: '$$', avgCost: '$18/person', rating: '4.6/5', neighborhood: 'Arts District', description: 'Chef-driven tacos — sweet potato with feta and corn, tuna tostada with uni', mustTry: 'Sweet potato taco ($6)' },
    { name: 'Bestia', cuisine: 'Italian', priceRange: '$$$', avgCost: '$75/person', rating: '4.7/5', neighborhood: 'Arts District', description: 'Industrial-chic Italian with wood-fired pizza and house-made charcuterie. Book 2 weeks ahead', mustTry: 'Spaghetti Rustichella with Dungeness crab ($32)' },
    { name: 'Langer\'s Delicatessen', cuisine: 'Jewish Deli', priceRange: '$$', avgCost: '$20/person', rating: '4.6/5', neighborhood: 'Westlake', description: 'The #19 pastrami sandwich is better than anything in NYC (controversial but true)', mustTry: '#19 pastrami sandwich ($22)' },
    { name: 'Mariscos Jalisco', cuisine: 'Mexican Seafood', priceRange: '$', avgCost: '$10/person', rating: '4.7/5', neighborhood: 'Boyle Heights (food truck)', description: 'This food truck serves the best shrimp tacos in LA — maybe all of California', mustTry: 'Tacos de camarón ($3.50 each)' },
    { name: 'Petit Trois', cuisine: 'French Bistro', priceRange: '$$', avgCost: '$30/person', rating: '4.5/5', neighborhood: 'Highland Park', description: 'Ludo Lefebvre\'s tiny French bistro — no reservations, 20 seats at the counter', mustTry: 'Omelette ($18)' }
  ],
  'chicago': [
    { name: 'Lou Malnati\'s', cuisine: 'Deep Dish Pizza', priceRange: '$$', avgCost: '$20/person', rating: '4.6/5', neighborhood: 'Multiple locations', description: 'Chicago\'s quintessential deep dish — buttery crust, chunky tomato sauce, layers of mozzarella', mustTry: 'The Malnati Chicago Classic ($16)' },
    { name: 'Portillo\'s', cuisine: 'Chicago Hot Dogs & Italian Beef', priceRange: '$', avgCost: '$12/person', rating: '4.5/5', neighborhood: 'Multiple locations', description: 'Chicago institution for hot dogs (no ketchup!) and Italian beef sandwiches dipped in jus', mustTry: 'Italian beef dipped ($9) + Chicago dog ($4)' },
    { name: 'Alinea', cuisine: 'Molecular Gastronomy', priceRange: '$$$$', avgCost: '$350/person', rating: '4.9/5', neighborhood: 'Lincoln Park', description: 'Three Michelin stars. America\'s most innovative restaurant. Edible balloons and dessert painted on the table', mustTry: 'The full tasting menu ($285-395)' },
    { name: 'Smoque BBQ', cuisine: 'Texas-style BBQ', priceRange: '$$', avgCost: '$20/person', rating: '4.7/5', neighborhood: 'Irving Park', description: 'Best BBQ in Chicago — slow-smoked brisket with a perfect bark. Cash only', mustTry: 'Half slab ribs + brisket combo ($24)' },
    { name: 'Big Star', cuisine: 'Tacos & Whiskey', priceRange: '$', avgCost: '$14/person', rating: '4.4/5', neighborhood: 'Wicker Park', description: 'Hipster taco joint with a massive patio, strong margaritas, and late-night vibes', mustTry: 'Pork belly taco ($5) + margarita ($12)' },
    { name: 'Au Cheval', cuisine: 'Burgers', priceRange: '$$', avgCost: '$25/person', rating: '4.7/5', neighborhood: 'West Loop', description: 'The burger that requires a 2-hour wait. Double cheeseburger with dijonnaise, malt vinegar aioli', mustTry: 'Single cheeseburger with egg ($18)' }
  ],
  'london': [
    { name: 'Dishoom', cuisine: 'Bombay Café', priceRange: '$$', avgCost: '£15/person', rating: '4.7/5', neighborhood: 'Covent Garden / Shoreditch', description: 'Inspired by Bombay\'s Irani cafés — the breakfast naan roll is legendary. Expect a queue', mustTry: 'Bacon naan roll (£8.90) or black daal (£7.50)' },
    { name: 'Bao', cuisine: 'Taiwanese', priceRange: '$$', avgCost: '£12/person', rating: '4.6/5', neighborhood: 'Soho', description: 'Fluffy steamed bao buns with braised pork, fried chicken, or lamb. Tiny space, no reservations', mustTry: 'Classic pork bao (£5)' },
    { name: 'Padella', cuisine: 'Italian Pasta', priceRange: '$$', avgCost: '£10/person', rating: '4.8/5', neighborhood: 'Borough Market', description: 'Fresh handmade pasta for under £10. The queue is always long but moves fast', mustTry: 'Pici cacio e pepe (£7.50)' },
    { name: 'The Wolseley', cuisine: 'European Brasserie', priceRange: '$$$', avgCost: '£40/person', rating: '4.5/5', neighborhood: 'Mayfair', description: 'Grand Viennese-style café for a proper English breakfast or afternoon tea', mustTry: 'Full English breakfast (£21.50)' },
    { name: 'Flat Iron', cuisine: 'Steak', priceRange: '$$', avgCost: '£15/person', rating: '4.5/5', neighborhood: 'Multiple locations', description: 'One cut, one price — £13 flat iron steak with unlimited salad. Absurd value for London', mustTry: 'Flat iron steak (£13) + free ice cream' },
    { name: 'Tayyabs', cuisine: 'Pakistani/Punjabi', priceRange: '$', avgCost: '£12/person', rating: '4.4/5', neighborhood: 'Whitechapel', description: 'BYO Pakistani grill that\'s been packing them in since 1972. Legendary lamb chops', mustTry: 'Lamb chops (£9.50) + dry meat (£11)' }
  ],
  'paris': [
    { name: 'Le Bouillon Chartier', cuisine: 'Traditional French', priceRange: '$', avgCost: '€15/person', rating: '4.4/5', neighborhood: '9th arr.', description: 'Grand 1896 dining hall serving classic French dishes at student prices', mustTry: 'Steak-frites (€12) + crème brûlée (€4)' },
    { name: 'L\'As du Fallafel', cuisine: 'Falafel', priceRange: '$', avgCost: '€8/person', rating: '4.6/5', neighborhood: 'Le Marais, 4th arr.', description: 'The best falafel in Paris — crispy outside, fluffy inside, overflowing with toppings', mustTry: 'Falafel spécial with everything (€8)' },
    { name: 'Le Comptoir du Panthéon', cuisine: 'French Bistro', priceRange: '$$', avgCost: '€22/person', rating: '4.5/5', neighborhood: 'Latin Quarter, 5th arr.', description: 'Perfect people-watching bistro opposite the Panthéon. Classic croque monsieur and vin chaud', mustTry: 'Croque monsieur (€14) + glass of Côtes du Rhône (€7)' },
    { name: 'Breizh Café', cuisine: 'Crêpes & Galettes', priceRange: '$$', avgCost: '€18/person', rating: '4.7/5', neighborhood: 'Le Marais, 3rd arr.', description: 'Brittany-style buckwheat galettes and sweet crêpes with organic ingredients', mustTry: 'Complète galette (€13) + salted caramel crêpe (€9)' },
    { name: 'Chez Janou', cuisine: 'Provençal French', priceRange: '$$', avgCost: '€25/person', rating: '4.5/5', neighborhood: 'Le Marais, 3rd arr.', description: 'Cozy bistro famous for having 80+ pastis varieties and the best chocolate mousse in Paris', mustTry: 'Lunch formule (€18) + chocolate mousse (unlimited!)' },
    { name: 'Pink Mamma', cuisine: 'Italian', priceRange: '$$', avgCost: '€22/person', rating: '4.3/5', neighborhood: '10th arr.', description: '4-story Italian restaurant with rooftop terrace. Neapolitan pizza and truffle pasta', mustTry: 'Truffle burrata pizza (€16) on the rooftop' }
  ],
  'tokyo': [
    { name: 'Ichiran Ramen', cuisine: 'Tonkotsu Ramen', priceRange: '$', avgCost: '¥1,200/person (~$8)', rating: '4.5/5', neighborhood: 'Shibuya / Shinjuku', description: 'Solo dining booths, custom spice levels, perfect tonkotsu broth. The ultimate late-night bowl', mustTry: 'Classic tonkotsu ramen (¥1,180)' },
    { name: 'Tsukiji Sushi Say', cuisine: 'Omakase Sushi', priceRange: '$$$', avgCost: '¥8,000/person (~$55)', rating: '4.8/5', neighborhood: 'Tsukiji', description: 'Counter-only sushi from a master chef using that morning\'s market fish. 12-piece omakase', mustTry: 'Omakase 12-piece (¥6,000-10,000)' },
    { name: 'Fuunji', cuisine: 'Tsukemen (Dipping Ramen)', priceRange: '$', avgCost: '¥1,000/person (~$7)', rating: '4.7/5', neighborhood: 'Shinjuku', description: 'Tokyo\'s best tsukemen — thick noodles dipped in an insanely rich fish and pork broth', mustTry: 'Ajitama tsukemen (¥1,050)' },
    { name: 'Gonpachi', cuisine: 'Izakaya', priceRange: '$$', avgCost: '¥4,000/person (~$27)', rating: '4.4/5', neighborhood: 'Nishi-Azabu', description: 'The "Kill Bill restaurant" — Tarantino\'s inspiration for the crazy 88 fight scene', mustTry: 'Yakitori assortment (¥1,800) + cold soba (¥900)' },
    { name: 'Afuri', cuisine: 'Yuzu Shio Ramen', priceRange: '$', avgCost: '¥1,200/person (~$8)', rating: '4.6/5', neighborhood: 'Ebisu / Harajuku', description: 'Light, fragrant yuzu citrus ramen — refreshingly different from heavy tonkotsu', mustTry: 'Yuzu shio ramen (¥1,130)' },
    { name: '7-Eleven (seriously)', cuisine: 'Konbini Food', priceRange: '$', avgCost: '¥500/person (~$3.50)', rating: '4.5/5', neighborhood: 'Literally everywhere', description: 'Japanese convenience store food is incredible — onigiri, egg sandwiches, fried chicken, and katsu sandwiches', mustTry: 'Tamago sando (¥250) + onigiri (¥150) + Strong Zero (¥200)' }
  ],
  'miami': [
    { name: 'Versailles', cuisine: 'Cuban', priceRange: '$', avgCost: '$15/person', rating: '4.4/5', neighborhood: 'Little Havana', description: 'Miami\'s most iconic Cuban restaurant since 1971. Political power-brokers eat next to tourists', mustTry: 'Cuban sandwich ($12) + cortadito ($3) + guava pastry ($4)' },
    { name: 'Joe\'s Stone Crab', cuisine: 'Seafood', priceRange: '$$$', avgCost: '$80/person', rating: '4.6/5', neighborhood: 'South Beach', description: 'Miami institution since 1913. Stone crab claws are seasonal (Oct-May) and worth every penny', mustTry: 'Medium claws ($45) + key lime pie ($14)' },
    { name: 'Zak the Baker', cuisine: 'Bakery & Deli', priceRange: '$$', avgCost: '$18/person', rating: '4.7/5', neighborhood: 'Wynwood', description: 'James Beard-nominated bakery with incredible sourdough and deli sandwiches', mustTry: 'Everything bagel with smoked fish ($16)' },
    { name: 'La Mar by Gaston Acurio', cuisine: 'Peruvian', priceRange: '$$$', avgCost: '$55/person', rating: '4.5/5', neighborhood: 'Brickell', description: 'Waterfront Peruvian restaurant with stunning ceviche and pisco sours', mustTry: 'Ceviche clásico ($22) + pisco sour ($16)' },
    { name: 'El Rey de las Fritas', cuisine: 'Cuban', priceRange: '$', avgCost: '$8/person', rating: '4.5/5', neighborhood: 'Little Havana', description: 'The "King of Fritas" — Cuban burgers with shoestring fries pressed on top', mustTry: 'Frita cubana ($5) + batido de mamey ($4)' }
  ],
  'nashville': [
    { name: 'Prince\'s Hot Chicken Shack', cuisine: 'Nashville Hot Chicken', priceRange: '$', avgCost: '$12/person', rating: '4.6/5', neighborhood: 'East Nashville', description: 'The original Nashville hot chicken — invented here in the 1930s. Cayenne-crusted fried chicken on white bread', mustTry: 'Hot breast on white bread ($9.50)' },
    { name: 'Hattie B\'s', cuisine: 'Nashville Hot Chicken', priceRange: '$', avgCost: '$15/person', rating: '4.5/5', neighborhood: 'Multiple locations', description: 'The hot chicken spot with the famous queue. More approachable heat levels than Prince\'s', mustTry: 'Breast plate + pimento mac ($16)' },
    { name: 'Biscuit Love', cuisine: 'Southern Brunch', priceRange: '$$', avgCost: '$18/person', rating: '4.6/5', neighborhood: 'The Gulch', description: 'Nashville\'s most beloved brunch — started as a food truck, now a proper restaurant', mustTry: 'The Bonuts ($7) + East Nasty biscuit ($12)' },
    { name: 'Arnold\'s Country Kitchen', cuisine: 'Meat & Three', priceRange: '$', avgCost: '$12/person', rating: '4.7/5', neighborhood: 'South Nashville', description: 'The quintessential Nashville meat-and-three. Pick a meat and three sides. Comfort food perfection', mustTry: 'Meat + 3 sides plate ($11)' },
    { name: 'Martin\'s Bar-B-Que Joint', cuisine: 'BBQ', priceRange: '$', avgCost: '$14/person', rating: '4.5/5', neighborhood: 'Multiple locations', description: 'Whole-hog BBQ over hickory coals. The pulled pork sandwich comes on a cornbread bun', mustTry: 'Redneck Taco ($6) + pulled pork sandwich ($10)' }
  ],
  'seoul': [
    { name: 'Maple Tree House', cuisine: 'Korean BBQ', priceRange: '$$', avgCost: '₩35,000/person (~$26)', rating: '4.6/5', neighborhood: 'Itaewon', description: 'Premium Korean BBQ — marinated galbi and samgyeopsal grilled at your table with banchan', mustTry: 'Galbi set (₩32,000) with doenjang jjigae' },
    { name: 'Tosokchon', cuisine: 'Samgyetang', priceRange: '$$', avgCost: '₩18,000/person (~$13)', rating: '4.5/5', neighborhood: 'Jongno', description: 'Presidential-approved ginseng chicken soup. Always a line but it moves fast', mustTry: 'Samgyetang (₩17,000)' },
    { name: 'Gwangjang Market Stalls', cuisine: 'Korean Street Food', priceRange: '$', avgCost: '₩8,000/person (~$6)', rating: '4.7/5', neighborhood: 'Jongno', description: 'Century-old market — sit at counter stalls and eat bindaetteok, mayak gimbap, and tteokbokki', mustTry: 'Bindaetteok (₩4,000) + knife-cut noodles (₩5,000)' },
    { name: 'Jungsik', cuisine: 'Modern Korean', priceRange: '$$$$', avgCost: '₩200,000/person (~$150)', rating: '4.8/5', neighborhood: 'Gangnam', description: 'Two Michelin stars. Korean fine dining reimagined — bibimbap with truffle, short rib with gochujang glaze', mustTry: 'Tasting menu (₩180,000)' },
    { name: 'Myeongdong Kyoja', cuisine: 'Kalguksu', priceRange: '$', avgCost: '₩10,000/person (~$7)', rating: '4.6/5', neighborhood: 'Myeongdong', description: 'Famous for one thing: knife-cut noodle soup in rich broth. The menu has 4 items. Choose the kalguksu', mustTry: 'Kalguksu (₩10,000) + mandu (₩6,000)' }
  ],
  'san francisco': [
    { name: 'Tartine Bakery', cuisine: 'Bakery & Café', priceRange: '$', avgCost: '$12/person', rating: '4.7/5', neighborhood: 'Mission District', description: 'The bread that made SF famous — morning buns, country loaves, and croque monsieurs with a line out the door', mustTry: 'Morning bun ($5.25) + croque monsieur ($14)' },
    { name: 'Swan Oyster Depot', cuisine: 'Seafood', priceRange: '$$', avgCost: '$35/person', rating: '4.8/5', neighborhood: 'Nob Hill', description: 'Counter-only seafood bar since 1912. Cash only, no reservations, line starts at 10 AM. Worth every minute', mustTry: 'Combination seafood salad ($28) + Anchor Steam ($6)' },
    { name: 'La Taqueria', cuisine: 'Mexican', priceRange: '$', avgCost: '$12/person', rating: '4.6/5', neighborhood: 'Mission District', description: 'James Beard Award winner — no rice in the burritos, just meat, beans, salsa, and perfection', mustTry: 'Super carne asada burrito ($14)' },
    { name: 'Zuni Café', cuisine: 'Californian', priceRange: '$$$', avgCost: '$55/person', rating: '4.6/5', neighborhood: 'Hayes Valley', description: 'SF institution since 1979 — the roast chicken for two takes an hour but changes your life', mustTry: 'Roast chicken for two with bread salad ($72)' },
    { name: 'Hog Island Oyster Co.', cuisine: 'Oyster Bar', priceRange: '$$', avgCost: '$30/person', rating: '4.5/5', neighborhood: 'Ferry Building', description: 'Farm-fresh oysters from Tomales Bay, shucked to order with a view of the Bay Bridge', mustTry: 'Half dozen Sweetwaters ($22) + clam chowder ($12)' },
  ],
  'barcelona': [
    { name: 'Cal Pep', cuisine: 'Catalan Tapas', priceRange: '$$', avgCost: '€30/person', rating: '4.6/5', neighborhood: 'El Born', description: 'Legendary tapas counter — chef Pep cooks in front of you. No menu, just trust him', mustTry: 'Fried baby squid (€14) + clams with jamón (€16)' },
    { name: 'Cervecería Catalana', cuisine: 'Spanish Tapas', priceRange: '$$', avgCost: '€25/person', rating: '4.5/5', neighborhood: 'Eixample', description: 'Always packed, always worth the wait. Some of Barcelona\'s best montaditos and patatas bravas', mustTry: 'Montadito de jamón ibérico (€6) + patatas bravas (€7)' },
    { name: 'La Boqueria Market Stalls', cuisine: 'Market Food', priceRange: '$', avgCost: '€12/person', rating: '4.7/5', neighborhood: 'La Rambla', description: 'Walk-in stalls at the famous market — fresh juices, jamón, seafood cones, and fruit cups', mustTry: 'Mixed seafood cone (€8) + fresh juice (€4)' },
    { name: 'El Xampanyet', cuisine: 'Catalan', priceRange: '$', avgCost: '€15/person', rating: '4.4/5', neighborhood: 'El Born', description: 'Tiny, tiled cava bar since 1929. Anchovies, olives, and house sparkling wine from barrels', mustTry: 'Anchovies (€5) + glass of house cava (€3)' },
    { name: 'Can Paixano (La Xampanyeria)', cuisine: 'Cava Bar', priceRange: '$', avgCost: '€10/person', rating: '4.3/5', neighborhood: 'Barceloneta', description: 'Standing-room cava bar with €1 glasses of sparkling wine and amazing bocadillos. Chaotic and perfect', mustTry: 'Bocadillo de jamón (€4) + cava (€1.20)' },
  ],
  'berlin': [
    { name: 'Mustafa\'s Gemüse Kebap', cuisine: 'Turkish Döner', priceRange: '$', avgCost: '€5/person', rating: '4.6/5', neighborhood: 'Kreuzberg', description: 'Berlin\'s most famous döner kebab — roasted vegetables, secret sauce, 45-minute queue', mustTry: 'Gemüse kebap (€5.50)' },
    { name: 'Curry 36', cuisine: 'Currywurst', priceRange: '$', avgCost: '€4/person', rating: '4.4/5', neighborhood: 'Kreuzberg', description: 'Berlin\'s quintessential late-night currywurst stand since 1981. Open until 5 AM', mustTry: 'Currywurst mit Pommes (€4.50)' },
    { name: 'Markthalle Neun', cuisine: 'Street Food Market', priceRange: '$$', avgCost: '€12/person', rating: '4.5/5', neighborhood: 'Kreuzberg', description: 'Historic market hall with Thursday Street Food events — ramen, tacos, burgers, craft beer', mustTry: 'Browse the stalls — different vendors weekly (€8-15)' },
    { name: 'Cocolo Ramen', cuisine: 'Japanese Ramen', priceRange: '$$', avgCost: '€14/person', rating: '4.6/5', neighborhood: 'Mitte / Kreuzberg', description: 'Berlin\'s best ramen — rich tonkotsu broth in a cozy basement. No reservations', mustTry: 'Cocolo ramen with extra egg (€13)' },
    { name: 'Burgermeister', cuisine: 'Burgers', priceRange: '$', avgCost: '€8/person', rating: '4.5/5', neighborhood: 'Kreuzberg (under the U-Bahn)', description: 'Gourmet burgers served from a converted public toilet under the train tracks. Iconic Berlin', mustTry: 'Meisterburger (€8.50)' },
  ],
  'amsterdam': [
    { name: 'The Pancake Bakery', cuisine: 'Dutch Pancakes', priceRange: '$', avgCost: '€14/person', rating: '4.5/5', neighborhood: 'Jordaan', description: 'A canal house serving over 70 kinds of Dutch pannenkoeken — sweet and savory', mustTry: 'Apple & cinnamon pancake (€13) or bacon & cheese (€14)' },
    { name: 'Foodhallen', cuisine: 'Food Hall', priceRange: '$$', avgCost: '€15/person', rating: '4.4/5', neighborhood: 'Oud-West', description: 'Amsterdam\'s indoor food market — bitterballen, Vietnamese, burgers, poke bowls, and craft beer', mustTry: 'Bitterballen (€7) + whatever smells best' },
    { name: 'Winkel 43', cuisine: 'Dutch Café', priceRange: '$', avgCost: '€8/person', rating: '4.6/5', neighborhood: 'Jordaan', description: 'Famous for having Amsterdam\'s best apple pie. Massive slices with whipped cream', mustTry: 'Apple pie with slagroom (€4.50) + coffee (€3)' },
    { name: 'FEBO', cuisine: 'Dutch Fast Food', priceRange: '$', avgCost: '€5/person', rating: '4.0/5', neighborhood: 'Everywhere', description: 'Automat wall — put in coins, open the little door, grab a hot kroket or frikandel. Peak Dutch culture', mustTry: 'Kroket from the wall (€2.50) — it\'s a rite of passage' },
    { name: 'Rijks', cuisine: 'Modern Dutch', priceRange: '$$$', avgCost: '€50/person', rating: '4.6/5', neighborhood: 'Museumplein', description: 'Michelin-starred restaurant inside the Rijksmuseum. Dutch ingredients, modern technique', mustTry: 'Lunch prix fixe (€42)' },
  ],
  'rome': [
    { name: 'Da Enzo al 29', cuisine: 'Roman Trattoria', priceRange: '$$', avgCost: '€18/person', rating: '4.7/5', neighborhood: 'Trastevere', description: 'Tiny trattoria with a daily queue — the carbonara and cacio e pepe are textbook perfect', mustTry: 'Cacio e pepe (€10) + supplì (€2.50)' },
    { name: 'Pizzeria Da Remo', cuisine: 'Roman Pizza', priceRange: '$', avgCost: '€10/person', rating: '4.5/5', neighborhood: 'Testaccio', description: 'Thin, crispy Roman-style pizza in a no-frills beer hall. Locals only — cash only', mustTry: 'Pizza margherita (€7) + fried supplì (€2)' },
    { name: 'Roscioli', cuisine: 'Italian Deli & Restaurant', priceRange: '$$$', avgCost: '€45/person', rating: '4.7/5', neighborhood: 'Centro Storico', description: 'Part bakery, part salumeria, part restaurant. The carbonara is debated as Rome\'s best', mustTry: 'Carbonara (€16) + selection of Italian cheeses (€18)' },
    { name: 'Trapizzino', cuisine: 'Street Food', priceRange: '$', avgCost: '€8/person', rating: '4.6/5', neighborhood: 'Testaccio / Trastevere', description: 'Triangle-shaped pizza pockets stuffed with Roman classics — tripe, chicken cacciatore, eggplant parm', mustTry: 'Pollo alla cacciatora trapizzino (€3.50)' },
    { name: 'Armando al Pantheon', cuisine: 'Roman', priceRange: '$$', avgCost: '€30/person', rating: '4.5/5', neighborhood: 'Pantheon', description: 'Family-run trattoria steps from the Pantheon since 1961. Classic Roman cuisine, no tourist traps', mustTry: 'Amatriciana (€14) + artichoke alla giudia (€10)' },
  ],
  'new orleans': [
    { name: 'Café Du Monde', cuisine: 'Beignets & Coffee', priceRange: '$', avgCost: '$8/person', rating: '4.5/5', neighborhood: 'French Quarter', description: 'Open 24/7 since 1862. Powdered sugar beignets and chicory coffee on the banks of the Mississippi', mustTry: 'Order of beignets ($4.67) + café au lait ($3.40)' },
    { name: 'Cochon', cuisine: 'Cajun', priceRange: '$$', avgCost: '$30/person', rating: '4.7/5', neighborhood: 'Warehouse District', description: 'Whole-hog Cajun cooking — smoked meats, boudin, and cochon de lait that melts in your mouth', mustTry: 'Cochon with turnips & cracklins ($28)' },
    { name: 'Willie Mae\'s Scotch House', cuisine: 'Southern Fried Chicken', priceRange: '$', avgCost: '$15/person', rating: '4.8/5', neighborhood: 'Tremé', description: 'James Beard Award "America\'s Best Fried Chicken." The batter is perfectly crispy, the meat impossibly juicy', mustTry: 'Fried chicken plate with sides ($14)' },
    { name: 'Commander\'s Palace', cuisine: 'Creole Fine Dining', priceRange: '$$$', avgCost: '$65/person', rating: '4.7/5', neighborhood: 'Garden District', description: 'NOLA\'s grande dame since 1893 — legendary 25-cent martini lunch and turtle soup', mustTry: '25¢ martini lunch (weekdays) + turtle soup ($12)' },
  ],
  'austin': [
    { name: 'Franklin Barbecue', cuisine: 'Texas BBQ', priceRange: '$$', avgCost: '$25/person', rating: '4.9/5', neighborhood: 'East Austin', description: 'The best BBQ in Texas — maybe America. Line starts at 7 AM, sells out by 1 PM. Bring a chair and beer', mustTry: 'Brisket by the pound ($32/lb)' },
    { name: 'Torchy\'s Tacos', cuisine: 'Tex-Mex', priceRange: '$', avgCost: '$12/person', rating: '4.5/5', neighborhood: 'Multiple locations', description: 'Austin\'s beloved taco chain — creative combos with green chile queso and handmade tortillas', mustTry: 'Trailer Park taco "trashy" ($5.50) + green chile queso ($4)' },
    { name: 'Uchi', cuisine: 'Japanese', priceRange: '$$$', avgCost: '$70/person', rating: '4.8/5', neighborhood: 'South Lamar', description: 'James Beard Award-winning Japanese restaurant in a converted bungalow. Inventive omakase', mustTry: 'Hama chili (yellowtail with ponzu, $16) + omakase ($95)' },
    { name: 'Veracruz All Natural', cuisine: 'Mexican', priceRange: '$', avgCost: '$10/person', rating: '4.7/5', neighborhood: 'East Austin (food truck)', description: 'James Beard Award-winning food truck — migas tacos with the crispiest tortillas in Austin', mustTry: 'Migas taco ($4) — get 3' },
    { name: 'Terry Black\'s Barbecue', cuisine: 'Texas BBQ', priceRange: '$$', avgCost: '$22/person', rating: '4.7/5', neighborhood: 'South Congress', description: 'No 4-hour wait like Franklin but the brisket is almost as good. Cafeteria-style, live music outside', mustTry: 'Moist brisket ($28/lb) + jalapeño sausage ($16/lb)' },
  ],
  'sydney': [
    { name: 'Bourke Street Bakery', cuisine: 'Bakery & Café', priceRange: '$', avgCost: 'A$12/person', rating: '4.6/5', neighborhood: 'Surry Hills', description: 'Sydney\'s best sausage rolls and sourdough. The ginger brûlée tart is legendary', mustTry: 'Pork & fennel sausage roll (A$8) + ginger brûlée tart (A$7)' },
    { name: 'Bennelong', cuisine: 'Modern Australian', priceRange: '$$$', avgCost: 'A$90/person', rating: '4.7/5', neighborhood: 'Sydney Opera House', description: 'Fine dining inside the sails of the Opera House — Australian produce, harbour views', mustTry: 'Pre-theatre menu (A$85) with harbour views' },
    { name: 'Mary\'s', cuisine: 'Burgers & Fried Chicken', priceRange: '$', avgCost: 'A$18/person', rating: '4.5/5', neighborhood: 'Newtown', description: 'Dive bar with Sydney\'s best burgers — double cheese, fried chicken, and craft beer', mustTry: 'Mary\'s Burger (A$16) + fried chicken (A$12)' },
    { name: 'Chat Thai', cuisine: 'Thai', priceRange: '$', avgCost: 'A$16/person', rating: '4.5/5', neighborhood: 'Haymarket / CBD', description: 'Legendary Thai restaurant that always has a queue — pad see ew and boat noodles', mustTry: 'Pad see ew (A$15) + boat noodle soup (A$12)' },
    { name: 'Mr. Wong', cuisine: 'Cantonese', priceRange: '$$', avgCost: 'A$40/person', rating: '4.5/5', neighborhood: 'CBD', description: 'Glamorous 240-seat Cantonese restaurant with duck hanging in the window and dim sum carts rolling by', mustTry: 'Crispy skin duck (A$58 whole) + har gow (A$12)' },
  ],
  'ho chi minh city': [
    { name: 'Pho Hoa Pasteur', cuisine: 'Vietnamese Pho', priceRange: '$', avgCost: '₫60,000/person (~$2.50)', rating: '4.6/5', neighborhood: 'District 3', description: 'Saigon\'s most famous pho — rich beef broth simmered for 12+ hours with fresh herbs', mustTry: 'Pho tai nam (rare beef & brisket pho ₫55,000)' },
    { name: 'Banh Mi Huynh Hoa', cuisine: 'Vietnamese Sandwich', priceRange: '$', avgCost: '₫50,000/person (~$2)', rating: '4.7/5', neighborhood: 'District 1', description: 'The best banh mi in Saigon — crusty baguette stuffed with pate, cold cuts, and pickled veggies', mustTry: 'Banh mi dac biet (special combo ₫47,000)' },
    { name: 'Quan Bui', cuisine: 'Modern Vietnamese', priceRange: '$$', avgCost: '₫200,000/person (~$8)', rating: '4.5/5', neighborhood: 'District 1', description: 'Garden restaurant with refined Vietnamese dishes — claypot fish, banana flower salad, spring rolls', mustTry: 'Ca kho to (caramelized fish in clay pot ₫120,000)' },
    { name: 'Bun Thit Nuong Chi Tuyen', cuisine: 'Vietnamese Noodles', priceRange: '$', avgCost: '₫45,000/person (~$1.80)', rating: '4.5/5', neighborhood: 'District 1', description: 'Legendary street-side spot for grilled pork vermicelli with fresh herbs and nuoc cham', mustTry: 'Bun thit nuong (grilled pork noodles ₫40,000)' },
    { name: 'Cuc Gach Quan', cuisine: 'Traditional Vietnamese', priceRange: '$$', avgCost: '₫250,000/person (~$10)', rating: '4.6/5', neighborhood: 'District 1', description: 'Rustic home-style Vietnamese cooking in a beautiful old Saigon house. Brad Pitt ate here', mustTry: 'Vietnamese curry with coconut bread (₫150,000)' },
    { name: 'Com Tam Ba Ghien', cuisine: 'Broken Rice', priceRange: '$', avgCost: '₫50,000/person (~$2)', rating: '4.4/5', neighborhood: 'Binh Thanh', description: 'Saigon\'s beloved broken rice with grilled pork chop, egg cake, and fish sauce', mustTry: 'Com tam suon bi cha (full combo plate ₫45,000)' }
  ],
  'bangkok': [
    { name: 'Jay Fai', cuisine: 'Thai Street Food', priceRange: '$$$', avgCost: '฿1,000/person (~$28)', rating: '4.8/5', neighborhood: 'Old Town', description: 'Michelin-starred street food — 70-year-old chef Jay Fai cooks in ski goggles over charcoal', mustTry: 'Crab omelette (฿1,000) — the dish that won a Michelin star' },
    { name: 'Thip Samai', cuisine: 'Pad Thai', priceRange: '$', avgCost: '฿100/person (~$2.80)', rating: '4.6/5', neighborhood: 'Old Town', description: 'Bangkok\'s most famous pad thai — wrapped in a crispy egg net. Queue starts at 5 PM', mustTry: 'Superb pad thai wrapped in egg (฿80)' },
    { name: 'Som Tam Nua', cuisine: 'Isaan Thai', priceRange: '$', avgCost: '฿200/person (~$5.60)', rating: '4.5/5', neighborhood: 'Siam', description: 'Spicy northeastern Thai — papaya salad, larb, and fried chicken that locals queue for', mustTry: 'Fried chicken wings (฿120) + som tam thai (฿80)' },
    { name: 'Nai Mong Hoi Tod', cuisine: 'Thai Seafood', priceRange: '$', avgCost: '฿150/person (~$4.20)', rating: '4.5/5', neighborhood: 'Chinatown (Yaowarat)', description: 'Legendary Chinatown stall — crispy oyster omelette and mussel pancakes', mustTry: 'Hoi tod (crispy mussel omelette ฿100)' },
    { name: 'Raan Jay Fai', cuisine: 'Thai Curry', priceRange: '$', avgCost: '฿80/person (~$2.25)', rating: '4.4/5', neighborhood: 'Banglamphu', description: 'No-frills curry shop near Khao San — point at what looks good from the daily selection', mustTry: 'Green curry with roti (฿60)' },
    { name: 'Or Tor Kor Market Food Court', cuisine: 'Thai Market Food', priceRange: '$', avgCost: '฿150/person (~$4.20)', rating: '4.6/5', neighborhood: 'Chatuchak', description: 'Bangkok\'s cleanest market with a food court serving regional Thai dishes from all provinces', mustTry: 'Khao man gai (chicken rice ฿60) + mango sticky rice (฿100)' }
  ],
};

const DEFAULT_RESTAURANTS: FallbackRestaurant[] = [
  { name: 'Local Favorite Grill', cuisine: 'American', priceRange: '$$', avgCost: '$20/person', rating: '4.4/5', neighborhood: 'Downtown', description: 'Farm-to-table seasonal dishes and craft cocktails', mustTry: 'Chef\'s special of the day ($18)' },
  { name: 'Corner Noodle Shop', cuisine: 'Asian Fusion', priceRange: '$', avgCost: '$12/person', rating: '4.5/5', neighborhood: 'Midtown', description: 'Handmade noodles and dumplings with bold flavors', mustTry: 'Dan dan noodles ($11)' },
  { name: 'The Brick Oven', cuisine: 'Italian', priceRange: '$$', avgCost: '$18/person', rating: '4.3/5', neighborhood: 'Old Town', description: 'Wood-fired pizzas and house-made pasta in a cozy setting', mustTry: 'Margherita pizza ($14)' },
  { name: 'Sunrise Café', cuisine: 'Brunch', priceRange: '$', avgCost: '$14/person', rating: '4.6/5', neighborhood: 'Arts District', description: 'All-day breakfast with locally roasted coffee and fresh pastries', mustTry: 'Eggs Benedict ($13)' }
];

function matchCityFallback(city: string): FallbackRestaurant[] {
  const resolved = resolveLocation(city, Object.keys(CITY_RESTAURANTS), true);
  return resolved ? CITY_RESTAURANTS[resolved] : DEFAULT_RESTAURANTS;
}

// ── Main export ─────────────────────────────────────────────────────────

export const restaurantService = {
  async getRestaurants(city: string, cuisine?: string, budget?: string): Promise<ToolResult<Restaurant[]>> {
    // Check cache first
    const cacheKey = getCacheKey(city, cuisine, budget);
    const cached = getFromCache(cacheKey);
    if (cached) {
      console.log(`[Restaurants] Cache hit for "${cacheKey}"`);
      return { success: true, data: cached.slice(0, 8) };
    }

    // Try Google Places API
    const googleResults = await searchGooglePlaces(city, cuisine, budget);

    if (googleResults.length > 0) {
      console.log(`[Restaurants] Google Places returned ${googleResults.length} results for ${city}`);
      setCache(cacheKey, googleResults);
      return { success: true, data: googleResults.slice(0, 8) };
    }

    // Fallback: hardcoded data
    console.log(`[Restaurants] Falling back to hardcoded data for ${city}`);
    let restaurants = [...matchCityFallback(city)];

    if (budget) {
      const budgetMap: Record<string, string[]> = {
        'free': ['$'],
        'low': ['$'],
        'medium': ['$', '$$'],
        'high': ['$', '$$', '$$$', '$$$$'],
      };
      const allowed = budgetMap[budget] || ['$', '$$', '$$$', '$$$$'];
      const filtered = restaurants.filter(r => allowed.includes(r.priceRange));
      if (filtered.length > 0) restaurants = filtered;
    }

    if (cuisine) {
      const match = restaurants.filter(r =>
        r.cuisine.toLowerCase().includes(cuisine.toLowerCase()) ||
        r.description.toLowerCase().includes(cuisine.toLowerCase())
      );
      if (match.length > 0) restaurants = match;
    }

    const withUrls = restaurants.map(r => {
      const url = `https://maps.google.com/?q=${encodeURIComponent(r.name + ', ' + city)}`;
      return { ...r, url, link: `[${r.name}](${url})` };
    });

    return { success: true, data: withUrls.slice(0, 8) };
  }
};
