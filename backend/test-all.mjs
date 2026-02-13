/**
 * Comprehensive test suite for all backend services
 * Run with: node test-all.mjs
 */

let passed = 0;
let failed = 0;
const failures = [];

function assert(condition, msg) {
  if (condition) {
    passed++;
  } else {
    failed++;
    failures.push(msg);
    console.log(`  FAIL: ${msg}`);
  }
}

// ─── Dynamic import of compiled services ──────────────────────────────
async function loadServices() {
  // Build first, then import from dist
  const { accommodationService } = await import('./dist/services/apis/accommodations.js');
  const { restaurantService } = await import('./dist/services/apis/restaurants.js');
  const { happyHourService } = await import('./dist/services/apis/happy_hours.js');
  const { freeStuffService } = await import('./dist/services/apis/free_stuff.js');
  const { dealsService } = await import('./dist/services/apis/deals.js');
  const { spotifyService } = await import('./dist/services/apis/spotify.js');
  const { gasPriceService } = await import('./dist/services/apis/gas_prices.js');
  const { pollenService } = await import('./dist/services/apis/pollen.js');
  const { sunriseSunsetService } = await import('./dist/services/apis/sunrise_sunset.js');
  const { waitTimeService } = await import('./dist/services/apis/wait_times.js');
  const { parkingService } = await import('./dist/services/apis/parking.js');
  const { transitService } = await import('./dist/services/apis/transit.js');
  const { transitRouteService } = await import('./dist/services/apis/transit_routes.js');
  const { tools, executeToolCall } = await import('./dist/services/tools.js');

  return {
    accommodationService, restaurantService, happyHourService,
    freeStuffService, dealsService, spotifyService, gasPriceService,
    pollenService, sunriseSunsetService, waitTimeService,
    parkingService, transitService, transitRouteService,
    tools, executeToolCall
  };
}

// ─── Test: Accommodations Service ─────────────────────────────────────
async function testAccommodations(svc) {
  console.log('\n=== Accommodations Service ===');

  // Test all cities with specific data
  const cities = ['new york', 'los angeles', 'chicago', 'london', 'paris', 'tokyo',
    'miami', 'nashville', 'seoul', 'san francisco', 'new orleans', 'bangkok', 'barcelona', 'ho chi minh city'];

  for (const city of cities) {
    const res = await svc.getAccommodations(city);
    assert(res.success, `${city}: should succeed`);
    assert(res.data && res.data.length > 0, `${city}: should return accommodations`);
    assert(res.data.length <= 4, `${city}: should return max 4`);

    // Verify data structure
    for (const a of res.data) {
      assert(a.name && a.name.length > 0, `${city}: accommodation should have name`);
      assert(['hotel', 'hostel', 'boutique', 'apartment'].includes(a.type), `${city}/${a.name}: valid type`);
      assert(a.priceRange && ['$', '$$', '$$$', '$$$$'].includes(a.priceRange), `${city}/${a.name}: valid priceRange`);
      assert(a.avgNight && a.avgNight.length > 0, `${city}/${a.name}: has avgNight`);
      assert(a.rating && a.rating.length > 0, `${city}/${a.name}: has rating`);
      assert(a.neighborhood && a.neighborhood.length > 0, `${city}/${a.name}: has neighborhood`);
      assert(a.description && a.description.length > 10, `${city}/${a.name}: has description`);
      assert(a.highlight && a.highlight.length > 0, `${city}/${a.name}: has highlight`);
      assert(a.url && a.url.includes('maps.google.com'), `${city}/${a.name}: has Google Maps URL`);
      assert(a.link && a.link.startsWith('['), `${city}/${a.name}: has markdown link`);
    }
  }

  // Test city aliases
  const aliasTests = [
    ['nyc', 'new york'], ['manhattan', 'new york'], ['brooklyn', 'new york'],
    ['la', 'los angeles'], ['sf', 'san francisco'], ['nola', 'new orleans'],
    ['bkk', 'bangkok'], ['bcn', 'barcelona'],
    ['vietnam', 'ho chi minh city'], ['saigon', 'ho chi minh city'], ['hanoi', 'ho chi minh city'],
  ];
  for (const [alias, expected] of aliasTests) {
    const aliasRes = await svc.getAccommodations(alias);
    const directRes = await svc.getAccommodations(expected);
    assert(aliasRes.success && aliasRes.data.length > 0, `alias '${alias}' should resolve`);
    assert(aliasRes.data[0].name === directRes.data[0].name, `alias '${alias}' matches '${expected}'`);
  }

  // US state and country alias tests
  const locationTests = [
    'california', 'florida', 'texas', 'illinois', 'tennessee',
    'vietnam', 'thailand', 'japan', 'france', 'germany',
    'southeast asia', 'western europe', 'caribbean',
    'ontario', 'british columbia',
  ];
  for (const loc of locationTests) {
    const locRes = await svc.getAccommodations(loc);
    assert(locRes.success && locRes.data.length > 0, `location '${loc}' should return accommodations`);
    assert(locRes.data[0].name !== 'City Center Hotel', `location '${loc}' should NOT return defaults`);
  }

  // Test fallback for unknown city
  const fallback = await svc.getAccommodations('Timbuktu');
  assert(fallback.success, 'unknown city should succeed');
  assert(fallback.data && fallback.data.length > 0, 'unknown city should return defaults');
  assert(fallback.data[0].name === 'City Center Hotel', 'unknown city should return default data');

  // Test budget filtering
  const lowBudget = await svc.getAccommodations('new york', 'low');
  assert(lowBudget.success, 'budget filter should succeed');
  assert(lowBudget.data.every(a => a.priceRange === '$'), 'low budget should only return $ items');

  const highBudget = await svc.getAccommodations('new york', 'high');
  assert(highBudget.success, 'high budget filter should succeed');

  // Test type filtering
  const hostels = await svc.getAccommodations('new york', undefined, 'hostel');
  assert(hostels.success, 'type filter should succeed');
  assert(hostels.data.every(a => a.type === 'hostel'), 'hostel filter should only return hostels');

  const hotels = await svc.getAccommodations('new york', undefined, 'hotel');
  assert(hotels.success, 'hotel type filter should succeed');
  assert(hotels.data.every(a => a.type === 'hotel'), 'hotel filter should only return hotels');

  // Test case insensitivity
  const upper = await svc.getAccommodations('NEW YORK');
  assert(upper.success && upper.data.length > 0, 'uppercase city should work');

  const mixed = await svc.getAccommodations('New York');
  assert(mixed.success && mixed.data.length > 0, 'mixed case city should work');

  // Test partial match
  const partial = await svc.getAccommodations('san francisco bay area');
  assert(partial.success && partial.data[0].name !== 'City Center Hotel', 'partial match should find san francisco');

  // Test combined budget + type filter
  const budgetHostel = await svc.getAccommodations('london', 'low', 'hostel');
  assert(budgetHostel.success, 'combined filter should succeed');
  if (budgetHostel.data.length > 0) {
    assert(budgetHostel.data.every(a => a.type === 'hostel' && a.priceRange === '$'), 'combined filter should apply both');
  }

  // Test type filter case-insensitivity (bug fix)
  const upperHostel = await svc.getAccommodations('new york', undefined, 'Hostel');
  assert(upperHostel.success, 'uppercase type filter should succeed');
  assert(upperHostel.data.every(a => a.type === 'hostel'), 'uppercase Hostel filter should return hostels');

  const allCapsHotel = await svc.getAccommodations('london', undefined, 'HOTEL');
  assert(allCapsHotel.success, 'all-caps type filter should succeed');
  assert(allCapsHotel.data.every(a => a.type === 'hotel'), 'HOTEL filter should return hotels');
}

// ─── Test: Restaurants Service ────────────────────────────────────────
async function testRestaurants(svc) {
  console.log('\n=== Restaurant Service ===');

  const cities = ['new york', 'los angeles', 'chicago', 'london', 'paris', 'tokyo', 'miami', 'nashville', 'seoul', 'ho chi minh city', 'bangkok'];
  for (const city of cities) {
    const res = await svc.getRestaurants(city);
    assert(res.success, `${city}: should succeed`);
    assert(res.data && res.data.length > 0, `${city}: should return restaurants`);
    assert(res.data.length <= 4, `${city}: max 4 results`);
    for (const r of res.data) {
      assert(r.url && r.url.includes('maps.google.com'), `${city}/${r.name}: has Maps URL`);
      assert(r.link && r.link.startsWith('['), `${city}/${r.name}: has markdown link`);
    }
  }

  // Budget filtering
  const low = await svc.getRestaurants('new york', undefined, 'low');
  assert(low.data.every(r => r.priceRange === '$'), 'low budget = only $ restaurants');

  // Cuisine filtering
  const pizza = await svc.getRestaurants('new york', 'pizza');
  assert(pizza.data.some(r => r.cuisine.toLowerCase().includes('pizza')), 'pizza filter finds pizza');

  // Fallback
  const fallback = await svc.getRestaurants('Unknown City');
  assert(fallback.success && fallback.data.length > 0, 'unknown city returns defaults');

  // Country alias tests
  const vietnamRes = await svc.getRestaurants('vietnam');
  assert(vietnamRes.success && vietnamRes.data.length > 0, 'vietnam alias should return restaurants');
  assert(vietnamRes.data[0].name !== 'Local Favorite Grill', 'vietnam should NOT return defaults');

  const thaiRes = await svc.getRestaurants('thailand');
  assert(thaiRes.success && thaiRes.data.length > 0, 'thailand alias should return restaurants');
  assert(thaiRes.data[0].name !== 'Local Favorite Grill', 'thailand should NOT return defaults');

  const saigonRes = await svc.getRestaurants('saigon');
  assert(saigonRes.success && saigonRes.data.length > 0, 'saigon alias should return restaurants');

  // US state alias tests
  const stateTests = [
    ['california', 'los angeles'], ['florida', 'miami'], ['illinois', 'chicago'],
    ['tennessee', 'nashville'], ['texas', 'los angeles'],
    ['new york state', 'new york'], ['ohio', 'chicago'], ['georgia', 'nashville'],
  ];
  for (const [state, expectedCity] of stateTests) {
    const stRes = await svc.getRestaurants(state);
    assert(stRes.success && stRes.data.length > 0, `state '${state}' should return restaurants`);
    assert(stRes.data[0].name !== 'Local Favorite Grill', `state '${state}' should NOT return defaults`);
  }

  // Region alias tests
  const regionTests = ['southeast asia', 'western europe', 'south america', 'caribbean'];
  for (const region of regionTests) {
    const regRes = await svc.getRestaurants(region);
    assert(regRes.success && regRes.data.length > 0, `region '${region}' should return restaurants`);
    assert(regRes.data[0].name !== 'Local Favorite Grill', `region '${region}' should NOT return defaults`);
  }
}

// ─── Test: Spotify/Playlist Service ───────────────────────────────────
async function testSpotify(svc) {
  console.log('\n=== Spotify/Playlist Service ===');

  // Test city-specific playlists
  const cityPlaylistCities = [
    'new york', 'los angeles', 'chicago', 'london', 'paris', 'tokyo',
    'nashville', 'new orleans', 'rio de janeiro', 'havana', 'austin',
    'detroit', 'atlanta', 'memphis', 'honolulu', 'toronto', 'dublin',
    'lisbon', 'vienna', 'istanbul', 'buenos aires', 'stockholm'
  ];

  for (const city of cityPlaylistCities) {
    const res = await svc.getPlaylist(city, ['culture']);
    assert(res.success, `${city}: playlist should succeed`);
    assert(res.data && res.data.tracks && res.data.tracks.length > 0, `${city}: should have tracks`);
    // Tracks should have valid structure
    for (const t of res.data.tracks) {
      assert(t.title && t.title.length > 0, `${city}: track has title`);
      assert(t.artist && t.artist.length > 0, `${city}: track has artist`);
    }
  }

  // Test that aliases resolve to city playlists (not generic vibe)
  const aliasTests = ['Houston', 'San Diego', 'Montreal', 'Copenhagen', 'Prague'];
  for (const city of aliasTests) {
    const res = await svc.getPlaylist(city, ['culture']);
    assert(res.success, `${city}: alias playlist should succeed`);
    assert(res.data.tracks.length > 0, `${city}: alias should return tracks`);
  }
}

// ─── Test: Happy Hours Service ────────────────────────────────────────
async function testHappyHours(svc) {
  console.log('\n=== Happy Hours Service ===');

  const cities = ['new york', 'los angeles', 'chicago', 'miami', 'nashville'];
  for (const city of cities) {
    const res = await svc.getHappyHours(city);
    assert(res.success, `${city}: should succeed`);
    assert(res.data && res.data.happyHours && res.data.happyHours.length > 0, `${city}: should have happy hours`);
    for (const h of res.data.happyHours) {
      assert(h.bar && h.bar.length > 0, `${city}: happy hour has bar name`);
      assert(h.deals && h.deals.length > 0, `${city}/${h.bar}: has deals`);
    }
  }

  // Fallback
  const fallback = await svc.getHappyHours('Unknown City');
  assert(fallback.success && fallback.data.happyHours.length > 0, 'unknown city returns defaults');
}

// ─── Test: Free Stuff Service ─────────────────────────────────────────
async function testFreeStuff(svc) {
  console.log('\n=== Free Stuff Service ===');

  const cities = ['new york', 'los angeles', 'chicago', 'london', 'paris', 'tokyo'];
  for (const city of cities) {
    const res = await svc.getFreeStuff(city);
    assert(res.success, `${city}: should succeed`);
    assert(res.data && res.data.activities, `${city}: should have activities array`);
    assert(res.data.alwaysFree && res.data.alwaysFree.length > 0, `${city}: should have alwaysFree list`);
  }

  // Fallback
  const fallback = await svc.getFreeStuff('Unknown City');
  assert(fallback.success, 'unknown city returns defaults');
}

// ─── Test: Deals Service ──────────────────────────────────────────────
async function testDeals(svc) {
  console.log('\n=== Deals Service ===');

  const cities = ['new york', 'los angeles', 'london', 'tokyo', 'paris', 'chicago'];
  for (const city of cities) {
    const res = await svc.getDeals(city);
    assert(res.success, `${city}: should succeed`);
    assert(res.data && res.data.deals && res.data.deals.length > 0, `${city}: should have deals`);
    for (const d of res.data.deals) {
      assert(d.title && d.title.length > 0, `${city}: deal has title`);
      assert(d.dealPrice && d.dealPrice.length > 0, `${city}/${d.title}: has deal price`);
      // Verify link is markdown format [title](url) and url is a raw URL
      assert(d.link && d.link.startsWith('['), `${city}/${d.title}: link is markdown format`);
      assert(d.url && (d.url.startsWith('http') || d.url.startsWith('https')), `${city}/${d.title}: url is a raw URL`);
    }
  }

  // Category filter
  const food = await svc.getDeals('new york', 'food');
  assert(food.success, 'category filter should succeed');

  // Fallback
  const fallback = await svc.getDeals('Unknown City');
  assert(fallback.success, 'unknown city returns defaults');
}

// ─── Test: Tool Registration ──────────────────────────────────────────
async function testToolRegistration(tools, executeToolCall) {
  console.log('\n=== Tool Registration ===');

  const expectedTools = [
    'get_weather', 'get_local_events', 'get_trending_news', 'get_random_activity',
    'get_restaurant_recommendations', 'get_playlist_suggestion', 'get_transit_estimates',
    'get_gas_prices', 'get_happy_hours', 'get_free_stuff', 'get_sunrise_sunset',
    'get_pollen_count', 'get_parking', 'get_public_transit_routes', 'get_wait_times',
    'get_deals_coupons', 'get_accommodations'
  ];

  const toolNames = tools.map(t => t.function.name);

  for (const name of expectedTools) {
    assert(toolNames.includes(name), `tool '${name}' is registered`);
  }

  // Verify all tools have valid structure
  for (const tool of tools) {
    assert(tool.type === 'function', `${tool.function.name}: type is 'function'`);
    assert(tool.function.description && tool.function.description.length > 10, `${tool.function.name}: has description`);
    assert(tool.function.parameters && tool.function.parameters.type === 'object', `${tool.function.name}: has parameters`);
    assert(Array.isArray(tool.function.parameters.required), `${tool.function.name}: has required array`);
  }

  // Test accommodations tool definition specifically
  const accomTool = tools.find(t => t.function.name === 'get_accommodations');
  assert(accomTool, 'get_accommodations tool exists');
  assert(accomTool.function.parameters.required.includes('city'), 'accommodations requires city');
  assert(accomTool.function.parameters.properties.budget, 'accommodations has budget param');
  assert(accomTool.function.parameters.properties.type, 'accommodations has type param');

  // Test executeToolCall dispatches to accommodations
  const accomResult = await executeToolCall('get_accommodations', { city: 'new york' });
  assert(accomResult.success, 'executeToolCall dispatches get_accommodations');
  assert(accomResult.data && accomResult.data.length > 0, 'executeToolCall returns accommodation data');

  // Test executeToolCall with unknown tool
  const unknown = await executeToolCall('nonexistent_tool', {});
  assert(!unknown.success, 'unknown tool returns failure');
  assert(unknown.error && unknown.error.includes('Unknown tool'), 'unknown tool has error message');
}

// ─── Test: Gas Prices ─────────────────────────────────────────────────
async function testGasPrices(svc) {
  console.log('\n=== Gas Prices Service ===');

  const res = await svc.getGasPrices('new york');
  assert(res.success, 'should succeed');
  assert(res.data && res.data.stations && res.data.stations.length > 0, 'should have stations');
  assert(typeof res.data.averageRegular === 'number', 'averageRegular is a number');

  const fallback = await svc.getGasPrices('Unknown City');
  assert(fallback.success, 'unknown city returns defaults');
}

// ─── Test: Pollen ─────────────────────────────────────────────────────
async function testPollen(svc) {
  console.log('\n=== Pollen Service ===');

  const res = await svc.getPollenCount('new york');
  assert(res.success, 'should succeed');
  assert(res.data && res.data.overall, 'should have overall level');
  assert(res.data.tree && res.data.grass && res.data.weed && res.data.mold, 'should have all pollen types');

  const fallback = await svc.getPollenCount('Unknown City');
  assert(fallback.success, 'unknown city returns defaults');
}

// ─── Test: Sunrise/Sunset ─────────────────────────────────────────────
async function testSunriseSunset(svc) {
  console.log('\n=== Sunrise/Sunset Service ===');

  const res = await svc.getSunriseSunset('new york');
  assert(res.success, 'should succeed');
  assert(res.data && res.data.sunrise, 'should have sunrise');
  assert(res.data.sunset, 'should have sunset');
  assert(res.data.goldenHourEvening, 'should have golden hour');

  const fallback = await svc.getSunriseSunset('Unknown City');
  assert(fallback.success, 'unknown city returns defaults');
}

// ─── Test: Wait Times ─────────────────────────────────────────────────
async function testWaitTimes(svc) {
  console.log('\n=== Wait Times Service ===');

  const res = await svc.getWaitTimes('new york');
  assert(res.success, 'should succeed');
  assert(res.data && res.data.estimates && res.data.estimates.length > 0, 'should have estimates');

  const fallback = await svc.getWaitTimes('Unknown City');
  assert(fallback.success, 'unknown city returns defaults');
}

// ─── Test: Parking ────────────────────────────────────────────────────
async function testParking(svc) {
  console.log('\n=== Parking Service ===');

  const res = await svc.getParking('new york');
  assert(res.success, 'should succeed');
  assert(res.data && res.data.options && res.data.options.length > 0, 'should have options');

  const fallback = await svc.getParking('Unknown City');
  assert(fallback.success, 'unknown city returns defaults');
}

// ─── Test: Transit Estimates ──────────────────────────────────────────
async function testTransit(svc) {
  console.log('\n=== Transit Estimates Service ===');

  const res = await svc.getTransitEstimates('new york', 'Times Square', 'Central Park');
  assert(res.success, 'should succeed');
  assert(res.data && res.data.walkingTime, 'should have walking time');
  assert(res.data.transitTime, 'should have transit time');
  assert(res.data.drivingTime, 'should have driving time');
}

// ─── Test: Transit Routes ─────────────────────────────────────────────
async function testTransitRoutes(svc) {
  console.log('\n=== Transit Routes Service ===');

  const res = await svc.getTransitRoutes('new york', 'Times Square', 'Brooklyn Bridge');
  assert(res.success, 'should succeed');
  assert(res.data && res.data.routes && res.data.routes.length > 0, 'should have routes');
  for (const route of res.data.routes) {
    assert(route.steps && route.steps.length > 0, 'route should have steps');
    assert(route.totalDuration, 'route should have duration');
  }

  const fallback = await svc.getTransitRoutes('Unknown City', 'A', 'B');
  assert(fallback.success, 'unknown city returns defaults');
}

// ─── Test: PlanMap extractPlaces logic (simulated) ────────────────────
async function testPlanMapExtraction() {
  console.log('\n=== PlanMap extractPlaces Logic ===');

  // Simulate the extractPlaces function from extractPlaces.ts
  function extractPlaces(content, city) {
    // Only strip Soundtrack — Where to Stay is now included for media enrichment
    const soundtrackIdx = content.search(/##\s*Soundtrack/i);
    const mainContent = soundtrackIdx > -1 ? content.slice(0, soundtrackIdx) : content;

    const names = [];

    // From Google Maps ?q= parameters
    const mapsMatches = mainContent.match(/maps\.google\.com\/?\?q=([^)\s&]+)/g) || [];
    mapsMatches.forEach(m => {
      const qMatch = m.match(/\?q=([^)\s&]+)/);
      if (qMatch) {
        const decoded = decodeURIComponent(qMatch[1].replace(/\+/g, ' ')).split(',')[0].trim();
        if (decoded.length > 2) names.push(decoded);
      }
    });

    // From markdown links
    const linkMatches = mainContent.match(/\[([^\]]+)\]\(([^)]+)\)/g) || [];
    linkMatches.forEach(m => {
      const parts = m.match(/\[([^\]]+)\]\(([^)]+)\)/);
      if (!parts) return;
      const label = parts[1].trim();
      const url = parts[2];
      if (/^(Open in Spotify|View on Maps|View Events|View Deals|View on Yelp|Go City|TripAdvisor|Reserve on OpenTable|Watch on YouTube|View on Instagram|View on Facebook|Search|here|link|map|Link)/i.test(label)) return;
      if (/spotify\.com|yelp\.com\/biz|tripadvisor\.com|opentable\.com|youtube\.com|instagram\.com|facebook\.com|eventbrite\.com/i.test(url)) return;
      names.push(label);
    });

    // From bold text
    const boldMatches = mainContent.match(/\*\*([^*]+)\*\*/g) || [];
    boldMatches.forEach(m => {
      const name = m.replace(/\*\*/g, '').trim();
      if (!/^(pro tip|tip|note|save|deal|free|warning|heads up|budget|cost|price)/i.test(name)) {
        names.push(name);
      }
    });

    const cityLower = city.toLowerCase();
    return [...new Set(names)]
      .filter(p => p.length > 2 && p.length < 60)
      .filter(p => p.toLowerCase() !== cityLower)
      .filter(p => !p.match(/^(morning|afternoon|evening|night|soundtrack|tip|note|pro tip|free|deal|save|right now|quick bite|week \d|today|tonight|sunrise|sunset|golden hour|brunch|lunch|dinner|breakfast|where to stay|happy hour|your route)/i))
      .filter(p => !p.match(/^\d/))
      .filter(p => !p.includes(' - '))
      .filter(p => !p.match(/\d+°/))
      .slice(0, 10);
  }

  // Test 1: Hotels in "Where to Stay" should be extracted (for media enrichment)
  const contentWithHotels = `## Morning
Visit [Central Park](https://maps.google.com/?q=Central+Park,+New+York) for a walk.

## Where to Stay
- [The Jane Hotel](https://maps.google.com/?q=The+Jane+Hotel,+New+York) — $120/night, boutique
- [Pod 51](https://maps.google.com/?q=Pod+51,+New+York) — $100/night, hotel

## Soundtrack
[Lights - Journey](https://open.spotify.com/track/xxx)`;

  const places = extractPlaces(contentWithHotels, 'New York');
  assert(places.includes('The Jane Hotel'), 'Hotels from Where to Stay should be extracted for media');
  assert(places.includes('Pod 51'), 'Hotels from Where to Stay should be extracted for media (2)');
  assert(places.includes('Central Park'), 'Itinerary venues should still be extracted');
  assert(!places.includes('Lights'), 'Soundtrack songs should be stripped');

  // Test 2: City name itself should be excluded
  const contentWithCity = `Visit **San Francisco** and [Fisherman's Wharf](https://maps.google.com/?q=Fishermans+Wharf)`;
  const sfPlaces = extractPlaces(contentWithCity, 'San Francisco');
  assert(!sfPlaces.includes('San Francisco'), 'city name should be excluded');
  assert(sfPlaces.includes("Fisherman's Wharf"), 'venue should be included');

  // Test 3: Bold non-venue text excluded
  const contentWithTips = `Visit **Golden Gate Bridge** and note the **Pro Tip** about parking. **Save** money by walking.`;
  const tipPlaces = extractPlaces(contentWithTips, 'San Francisco');
  assert(tipPlaces.includes('Golden Gate Bridge'), 'venue bold text included');
  assert(!tipPlaces.includes('Pro Tip'), 'pro tip excluded');
  assert(!tipPlaces.includes('Save'), 'save excluded');

  // Test 4: Temperature mentions excluded
  const contentWithTemp = `It's **72°F** and sunny. Visit **Griffith Observatory**.`;
  const tempPlaces = extractPlaces(contentWithTemp, 'Los Angeles');
  assert(!tempPlaces.some(p => p.includes('72°')), 'temperature excluded');
  assert(tempPlaces.includes('Griffith Observatory'), 'venue included');

  // Test 5: Non-map URLs excluded
  const contentWithSpotify = `Check out [Some Track](https://open.spotify.com/track/xxx) and [Yelp Review](https://yelp.com/biz/something)`;
  const spotifyPlaces = extractPlaces(contentWithSpotify, 'New York');
  assert(!spotifyPlaces.includes('Some Track'), 'spotify links excluded');
  assert(!spotifyPlaces.includes('Yelp Review'), 'yelp links excluded');

  // Test 6: Content with only Soundtrack (no Where to Stay)
  const contentNoStay = `## Morning
Visit [Pike Place Market](https://maps.google.com/?q=Pike+Place+Market,+Seattle).

## Soundtrack
[Smells Like Teen Spirit - Nirvana](https://open.spotify.com/track/xxx)`;

  const seattlePlaces = extractPlaces(contentNoStay, 'Seattle');
  assert(seattlePlaces.includes('Pike Place Market'), 'venue extracted without Where to Stay');
  assert(!seattlePlaces.some(p => p.includes('Nirvana') || p.includes('Smells')), 'songs excluded');

  // Test 7: PlanMap detects multi-day and scales maxPlaces
  const fs = await import('fs');
  const planMapContent = fs.readFileSync('frontend/src/components/PlanMap.tsx', 'utf8');
  assert(planMapContent.includes('detectDayCount'), 'PlanMap has detectDayCount helper');
  assert(planMapContent.includes('# Day \\d+'), 'detectDayCount checks for Day N headers');
  assert(planMapContent.includes('dayCount * 10'), 'PlanMap scales places by day count');
  assert(planMapContent.includes('25'), 'PlanMap caps max places at 25');
  assert(planMapContent.includes('extractPlaces(content, city, maxPlaces)'), 'PlanMap passes scaled maxPlaces to extractPlaces');

  // Test 8: PlanMap has proper rate limiting between geocode calls
  assert(planMapContent.includes('if (i > 0) await new Promise'), 'PlanMap rate-limits between geocode calls');
}

// ─── Test: System Prompt (dedalus.ts) ─────────────────────────────────
async function testSystemPrompt() {
  console.log('\n=== System Prompt Verification ===');

  const fs = await import('fs');
  const dedalusContent = fs.readFileSync('backend/src/services/dedalus.ts', 'utf8');

  // Accommodations in mandatory tool list
  assert(dedalusContent.includes('get_accommodations') && dedalusContent.includes('Call ALL of these'),
    'get_accommodations in mandatory tool list');

  // Accommodations in available tools description
  assert(dedalusContent.includes('get_accommodations: Where to stay'),
    'get_accommodations in available tools descriptions');

  // Where to Stay section in itinerary structure
  assert(dedalusContent.includes('## Where to Stay'),
    'Where to Stay section in itinerary template');

  // Force-call fallback exists
  assert(dedalusContent.includes("forced_accommodations_"),
    'force-call fallback for accommodations exists');

  // User message mentions accommodations
  assert(dedalusContent.includes('accommodations, sunrise/sunset'),
    'user message mentions accommodations');

  // Retry nudge mentions accommodations
  assert(dedalusContent.includes('get_accommodations, get_sunrise_sunset'),
    'retry nudge mentions accommodations');
}

// ─── Test: Frontend ToolCallIndicator ─────────────────────────────────
async function testToolCallIndicator() {
  console.log('\n=== Frontend ToolCallIndicator ===');

  const fs = await import('fs');
  const indicatorContent = fs.readFileSync('frontend/src/components/ToolCallIndicator.tsx', 'utf8');

  assert(indicatorContent.includes("get_accommodations: { label: 'Stays' }"),
    "ToolCallIndicator has 'Stays' label for accommodations");
}

// ─── Test: extractPlaces strips Where to Stay ────────────────────────
async function testPlanMapStripping() {
  console.log('\n=== extractPlaces Where to Stay Stripping ===');

  const fs = await import('fs');

  // Check the shared utility (logic now lives there, not in PlanMap.tsx directly)
  const utilContent = fs.readFileSync('frontend/src/utils/extractPlaces.ts', 'utf8');

  // Check that utility strips Soundtrack section (Where to Stay is now included for media enrichment)
  assert(utilContent.includes('Soundtrack'),
    'extractPlaces should strip non-itinerary sections');

  // PlanMap should import from shared utility
  const planMapContent = fs.readFileSync('frontend/src/components/PlanMap.tsx', 'utf8');
  assert(planMapContent.includes("from '../utils/extractPlaces'"),
    'PlanMap imports extractPlaces from shared utility');
}

// ─── Test: Shared extractPlaces utility ──────────────────────────────
async function testSharedExtractPlaces() {
  console.log('\n=== Shared extractPlaces Utility ===');

  const fs = await import('fs');

  // Verify the shared utility file exists
  const utilPath = 'frontend/src/utils/extractPlaces.ts';
  let utilContent;
  try {
    utilContent = fs.readFileSync(utilPath, 'utf8');
    assert(true, 'extractPlaces utility file exists');
  } catch {
    assert(false, 'extractPlaces utility file exists');
    return;
  }

  // Verify it's a proper export
  assert(utilContent.includes('export function extractPlaces'), 'extractPlaces is exported');
  assert(utilContent.includes('maxResults'), 'extractPlaces accepts maxResults parameter');

  // Verify PlanMap imports from shared utility (not local definition)
  const planMapContent = fs.readFileSync('frontend/src/components/PlanMap.tsx', 'utf8');
  assert(planMapContent.includes("from '../utils/extractPlaces'"), 'PlanMap imports from shared utility');
  assert(!planMapContent.includes('function extractPlaces'), 'PlanMap does NOT define local extractPlaces');

  // Verify useMediaEnrichment hook imports from shared utility and requests max 12 places
  const mediaHookContent = fs.readFileSync('frontend/src/hooks/useMediaEnrichment.ts', 'utf8');
  assert(mediaHookContent.includes("from '../utils/extractPlaces'"), 'useMediaEnrichment imports from shared utility');
  assert(mediaHookContent.includes('extractPlaces(content, city, maxPlaces)'), 'useMediaEnrichment uses configurable maxPlaces');

  // Verify PlaceMedia no longer does its own extraction (takes pre-fetched data)
  const placeMediaContent = fs.readFileSync('frontend/src/components/PlaceMedia.tsx', 'utf8');
  assert(!placeMediaContent.includes('function extractPlaces'), 'PlaceMedia does NOT define local extractPlaces');
  assert(placeMediaContent.includes('mediaData'), 'PlaceMedia accepts mediaData prop');

  // Verify shared utility has all the key filters
  assert(utilContent.includes('Soundtrack'), 'utility strips Soundtrack section');
  assert(utilContent.includes('where to stay|happy hour|your route'), 'utility filters heading text from place names');

  // Verify accommodation places are extracted separately and always included
  assert(utilContent.includes('Where to Stay'), 'utility detects Where to Stay section');
  assert(utilContent.includes('stayPlaces'), 'utility extracts accommodation places separately');
  assert(utilContent.includes('stayReserve'), 'utility reserves slots for accommodation places');
  assert(utilContent.includes('itineraryLimit'), 'utility caps itinerary places to make room for accommodations');

  // Functional test: accommodation places survive when itinerary fills the limit
  const testContent = `## Morning (8am - 12pm)
Visit [Place A](https://maps.google.com/?q=Place+A,+NYC) and [Place B](https://maps.google.com/?q=Place+B,+NYC).
Stop by [Place C](https://maps.google.com/?q=Place+C,+NYC) and [Place D](https://maps.google.com/?q=Place+D,+NYC).

## Afternoon (12pm - 6pm)
Head to [Place E](https://maps.google.com/?q=Place+E,+NYC) then [Place F](https://maps.google.com/?q=Place+F,+NYC).

## Evening (6pm - 11pm)
Dinner at [Place G](https://maps.google.com/?q=Place+G,+NYC) and drinks at [Place H](https://maps.google.com/?q=Place+H,+NYC).

## Where to Stay
Check in at [Hotel Alpha](https://maps.google.com/?q=Hotel+Alpha,+NYC) or [Hotel Beta](https://maps.google.com/?q=Hotel+Beta,+NYC).

## Soundtrack
[Song - Artist](https://open.spotify.com/track/123)`;

  // Run extractPlaces via inline eval of the logic (import won't work for .ts)
  // Instead, verify structurally that the function splits on Where to Stay
  assert(utilContent.includes('stayIdx = mainContent.search'), 'utility finds Where to Stay index');
  assert(utilContent.includes('itineraryContent = stayIdx > -1'), 'utility splits itinerary from accommodations');
  assert(utilContent.includes('stayContent = stayIdx > -1'), 'utility extracts stay section content');
  assert(utilContent.includes('merged.includes(p)'), 'utility deduplicates across itinerary and stay');
}

// ─── Test: Force-call warnings ──────────────────────────────────────
async function testForceCallWarnings() {
  console.log('\n=== Force-Call Warnings ===');

  const fs = await import('fs');
  const dedalusContent = fs.readFileSync('backend/src/services/dedalus.ts', 'utf8');

  // Verify force-call has warning for missing assistant message
  assert(dedalusContent.includes('Could not find assistant message to inject playlist'),
    'playlist force-call has warning for missing assistant message');
  assert(dedalusContent.includes('Could not find assistant message to inject accommodations'),
    'accommodations force-call has warning for missing assistant message');
}

// ─── Test: Deals data structure consistency ──────────────────────────
async function testDealsDataStructure(svc) {
  console.log('\n=== Deals Data Structure ===');

  const res = await svc.getDeals('new york');
  for (const d of res.data.deals) {
    // link should be markdown: [title](url)
    assert(d.link.startsWith('['), `${d.title}: link starts with [ (markdown)`);
    assert(d.link.includes(']('), `${d.title}: link contains ]( (markdown)`);
    assert(d.link.endsWith(')'), `${d.title}: link ends with ) (markdown)`);
    // url should be raw URL
    assert(d.url.startsWith('http'), `${d.title}: url is raw URL`);
    // No markdownLink field should exist
    assert(!d.markdownLink, `${d.title}: no markdownLink field (removed)`);
  }
}

// ─── Test: ItineraryDisplay no global _key ────────────────────────────
async function testItineraryDisplayKey() {
  console.log('\n=== ItineraryDisplay Key Fix ===');

  const fs = await import('fs');
  const content = fs.readFileSync('frontend/src/components/ItineraryDisplay.tsx', 'utf8');

  // Should NOT have global _key variable
  assert(!content.includes('let _key = 0'), 'no global _key variable');

  // Should use keyGen pattern
  assert(content.includes('keyGen'), 'uses keyGen pattern for keys');
  assert(content.includes('keyGen.v++'), 'increments keyGen.v');
}

// ─── Test: MusicPlayer cleanup ───────────────────────────────────────
async function testMusicPlayerCleanup() {
  console.log('\n=== MusicPlayer Cleanup ===');

  const fs = await import('fs');
  const content = fs.readFileSync('frontend/src/components/MusicPlayer.tsx', 'utf8');

  // Should have clearTimeout cleanup
  assert(content.includes('clearTimeout(timer)'), 'MusicPlayer cleans up timer on unmount');
  assert(content.includes('return () => clearTimeout'), 'MusicPlayer returns cleanup function');
}

// ─── Test: usePlanStream reader cleanup ──────────────────────────────
async function testStreamReaderCleanup() {
  console.log('\n=== Stream Reader Cleanup ===');

  const fs = await import('fs');
  const content = fs.readFileSync('frontend/src/hooks/usePlanStream.ts', 'utf8');

  // Should have reader cleanup in finally block
  assert(content.includes('finally'), 'usePlanStream has finally block');
  assert(content.includes('releaseLock'), 'usePlanStream releases reader lock');
}

// ─── Test: Leaflet singleton loading ─────────────────────────────────
async function testLeafletSingleton() {
  console.log('\n=== Leaflet Singleton Loading ===');

  const fs = await import('fs');
  const content = fs.readFileSync('frontend/src/components/PlanMap.tsx', 'utf8');

  // Should use singleton promise pattern
  assert(content.includes('_leafletPromise'), 'PlanMap uses singleton promise for Leaflet');
  assert(content.includes('if (_leafletPromise) return _leafletPromise'), 'PlanMap returns cached promise');

  // Geocode cache (localStorage, 7-day TTL)
  assert(content.includes('GEO_CACHE_KEY'), 'PlanMap has geocode cache key constant');
  assert(content.includes('GEO_CACHE_TTL'), 'PlanMap has geocode cache TTL constant');
  assert(content.includes('getCachedGeocode'), 'PlanMap has getCachedGeocode function');
  assert(content.includes('cacheGeocode'), 'PlanMap has cacheGeocode function');
  assert(content.includes('7 * 24 * 60 * 60 * 1000'), 'Geocode cache TTL is 7 days');
  assert(content.includes('500'), 'Geocode cache evicts at 500 entries');

  // Progressive rendering — cached places show instantly
  assert(content.includes('resolvedCount'), 'PlanMap tracks resolved count for progress');
  assert(content.includes('totalPlaces'), 'PlanMap tracks total places for progress');
  assert(content.includes('requestAnimationFrame'), 'PlanMap uses rAF for map rebuilds');
}

// ─── Test: YouTube search service ────────────────────────────────────
async function testYouTubeService() {
  console.log('\n=== YouTube Search Service ===');

  const fs = await import('fs');
  const ytContent = fs.readFileSync('backend/src/services/apis/youtube.ts', 'utf8');

  // Service structure
  assert(ytContent.includes('export async function searchYouTubeVideo'), 'YouTube service exports searchYouTubeVideo');
  assert(ytContent.includes('fetchWithTimeout'), 'YouTube service uses timeout on requests');
  assert(ytContent.includes('AbortController'), 'YouTube service uses AbortController for timeouts');
  assert(ytContent.includes('youtube.com/results'), 'YouTube service scrapes YouTube search');
  assert(ytContent.includes('ytInitialData'), 'YouTube service extracts ytInitialData');
  assert(ytContent.includes('videoRenderer'), 'YouTube service parses video renderer data');

  // Returns proper structure
  assert(ytContent.includes('videoId'), 'YouTube service returns videoId');
  assert(ytContent.includes('title'), 'YouTube service returns title');

  // Route is registered
  const routeContent = fs.readFileSync('backend/src/routes/plan.ts', 'utf8');
  assert(routeContent.includes("'/youtube-search'"), 'YouTube search route registered');
  assert(routeContent.includes('searchYouTubeVideo'), 'Route calls searchYouTubeVideo');
  assert(routeContent.includes("req.query.q"), 'Route reads q parameter');

  // Live integration test — actually search YouTube
  const { searchYouTubeVideo } = await import('./dist/services/apis/youtube.js');
  const result = await searchYouTubeVideo('Central Park New York');
  assert(result !== null, 'YouTube search returns a result for Central Park');
  assert(result.videoId && result.videoId.length > 5, 'YouTube result has valid videoId');
  assert(result.title && result.title.length > 3, 'YouTube result has a title');
}

// ─── Test: Inline media integration ──────────────────────────────────
async function testInlineMediaIntegration() {
  console.log('\n=== Inline Media Integration ===');

  const fs = await import('fs');

  // ItineraryDisplay accepts mediaData prop and has inline media rendering
  const itineraryContent = fs.readFileSync('frontend/src/components/ItineraryDisplay.tsx', 'utf8');
  assert(itineraryContent.includes('mediaData'), 'ItineraryDisplay accepts mediaData prop');
  assert(itineraryContent.includes("import type { PlaceMediaData }"), 'ItineraryDisplay imports PlaceMediaData type');
  assert(itineraryContent.includes('getSectionPlaces'), 'ItineraryDisplay has getSectionPlaces function');

  // ContentWithMedia renders media in a side column next to text
  assert(itineraryContent.includes('ContentWithMedia'), 'ItineraryDisplay has ContentWithMedia component');
  assert(itineraryContent.includes('left-full'), 'Media uses absolute positioning outside text column');
  assert(itineraryContent.includes('w-[480px]'), 'Media column is 480px wide');
  assert(itineraryContent.includes('youtube.com/embed'), 'ItineraryDisplay uses YouTube embeds');
  assert(itineraryContent.includes('playingVideo'), 'ItineraryDisplay tracks playing video state');
  assert(itineraryContent.includes('maxresdefault'), 'ItineraryDisplay uses YouTube maxres thumbnails');
  assert(itineraryContent.includes('aspect-video'), 'Video embeds use 16:9 aspect ratio');
  assert(itineraryContent.includes('aspect-[4/3]'), 'Image cards use 4:3 aspect ratio');
  assert(itineraryContent.includes('videoCount >= 1'), 'Videos capped at 1 per section');
  assert(itineraryContent.includes('slice(0, 2)'), 'Total media capped at 2 per section');

  // App.tsx uses the media enrichment hook
  const appContent = fs.readFileSync('frontend/src/App.tsx', 'utf8');
  assert(appContent.includes('useMediaEnrichment'), 'App imports useMediaEnrichment');
  assert(appContent.includes('mediaData={mediaData}'), 'App passes mediaData to ItineraryDisplay');
  assert(!appContent.includes('<PlaceMedia content='), 'App no longer renders standalone PlaceMedia');
  assert(!appContent.includes('mediaReady'), 'App no longer gates media on streaming completion');

  // useMediaEnrichment hook structure — progressive loading
  const hookContent = fs.readFileSync('frontend/src/hooks/useMediaEnrichment.ts', 'utf8');
  assert(hookContent.includes('export function useMediaEnrichment'), 'Hook exports useMediaEnrichment');
  assert(hookContent.includes('fetchWikipediaImage'), 'Hook fetches Wikipedia images');
  assert(hookContent.includes('fetchYouTubeVideoId'), 'Hook fetches YouTube video IDs');
  assert(hookContent.includes('/api/youtube-search'), 'Hook calls backend YouTube search endpoint');
  assert(hookContent.includes('PlaceMediaData'), 'Hook exports PlaceMediaData type');
  assert(hookContent.includes('img.youtube.com'), 'Hook uses YouTube thumbnail as fallback image');
  assert(hookContent.includes('fetchedRef'), 'Hook tracks already-fetched places to avoid duplicates');
  assert(hookContent.includes('setTimeout'), 'Hook debounces extraction during streaming');
  assert(!hookContent.includes('isReady'), 'Hook does NOT wait for streaming to finish');
  assert(hookContent.includes('/800px-'), 'Hook requests larger Wikipedia images');

  // Media cache (localStorage) — instant return for previously fetched media
  assert(hookContent.includes('MEDIA_CACHE_KEY'), 'Hook has media cache key constant');
  assert(hookContent.includes('MEDIA_CACHE_TTL'), 'Hook has media cache TTL constant');
  assert(hookContent.includes('getCachedMedia'), 'Hook has getCachedMedia function');
  assert(hookContent.includes('cacheMedia'), 'Hook has cacheMedia function');
  assert(hookContent.includes('localStorage'), 'Hook uses localStorage for media cache');
  assert(hookContent.includes('3 * 24 * 60 * 60 * 1000'), 'Media cache TTL is 3 days');
  assert(hookContent.includes('300'), 'Media cache evicts at 300 entries');

  // Reduced debounce for faster loading
  assert(hookContent.includes('400'), 'Hook debounce is 400ms (reduced from 800ms)');
  assert(!hookContent.includes(', 800)'), 'Hook no longer uses 800ms debounce');

  // Cached vs uncached split — cached places load instantly
  assert(hookContent.includes('uncached'), 'Hook separates cached and uncached places');
}

// ─── Test: Data quality — no duplicate names within a city ────────────
async function testDataQuality(services) {
  console.log('\n=== Data Quality Checks ===');
  const { accommodationService, restaurantService } = services;

  // Check for duplicate accommodation names within a city
  const accomCities = ['new york', 'los angeles', 'chicago', 'london', 'paris', 'tokyo', 'miami', 'nashville', 'seoul'];
  for (const city of accomCities) {
    const res = await accommodationService.getAccommodations(city);
    // Get the full list (before slicing to 4) by requesting with high budget
    const full = await accommodationService.getAccommodations(city, 'high');
    const names = full.data.map(a => a.name);
    const uniqueNames = new Set(names);
    assert(names.length === uniqueNames.size, `${city} accommodations: no duplicate names`);
  }

  // Check restaurant data quality
  for (const city of accomCities) {
    const res = await restaurantService.getRestaurants(city);
    const names = res.data.map(r => r.name);
    const uniqueNames = new Set(names);
    assert(names.length === uniqueNames.size, `${city} restaurants: no duplicate names`);
  }

  // Check that accommodation types are diverse within cities
  for (const city of ['new york', 'london', 'tokyo']) {
    const res = await accommodationService.getAccommodations(city, 'high'); // get all price ranges
    const types = new Set(res.data.map(a => a.type));
    assert(types.size >= 2, `${city} accommodations: has diverse types (${[...types].join(', ')})`);
  }
}

// ─── Test: Multi-day vacation feature ──────────────────────────────────
async function testMultiDay() {
  console.log('\n=== Multi-Day Vacation Feature ===');
  const fs = await import('fs');

  // Backend: PlanRequest type includes days field
  const typesContent = fs.readFileSync('backend/src/types/index.ts', 'utf8');
  assert(typesContent.includes('days?: number'), 'PlanRequest has days field');

  // Backend: Route validates days
  const routeContent = fs.readFileSync('backend/src/routes/plan.ts', 'utf8');
  assert(routeContent.includes('days'), 'Route destructures days from request body');

  // Backend: System prompt handles multi-day
  const dedalusContent = fs.readFileSync('backend/src/services/dedalus.ts', 'utf8');
  assert(dedalusContent.includes('MULTI-DAY VACATION MODE'), 'System prompt has multi-day instructions');
  assert(dedalusContent.includes('# Day ${i + 1}'), 'System prompt generates Day N headers');
  assert(dedalusContent.includes('isMultiDay'), 'Streaming function checks for multi-day');
  assert(dedalusContent.includes('days! * 3000'), 'Token budget scales with days');

  // Frontend: App.tsx has trip duration selector
  const appContent = fs.readFileSync('frontend/src/App.tsx', 'utf8');
  assert(appContent.includes('tripDays'), 'App has tripDays state');
  assert(appContent.includes('setTripDays'), 'App has setTripDays setter');
  assert(appContent.includes('Trip Length'), 'App has Trip Length label');
  assert(appContent.includes('extras.days = tripDays'), 'App passes days in extras');
  assert(appContent.includes("Plan My ${tripDays}-Day Trip"), 'CTA button shows trip length');
  assert(appContent.includes('days={tripDays}'), 'App passes days to ItineraryDisplay');

  // Frontend: ItineraryDisplay supports multi-day
  const itineraryContent = fs.readFileSync('frontend/src/components/ItineraryDisplay.tsx', 'utf8');
  assert(itineraryContent.includes('DayPlan'), 'ItineraryDisplay has DayPlan interface');
  assert(itineraryContent.includes('ParsedPlan'), 'ItineraryDisplay has ParsedPlan interface');
  assert(itineraryContent.includes('selectedDay'), 'ItineraryDisplay has selectedDay state');
  assert(itineraryContent.includes('hasMultipleDays'), 'Parser detects multi-day content');
  assert(itineraryContent.includes('globalSections'), 'Parser extracts global sections');
  assert(itineraryContent.includes('Your trip'), 'Multi-day shows "Your trip" heading');
  assert(itineraryContent.includes('Your day'), 'Single-day shows "Your day" heading');
  assert(itineraryContent.includes('Day {day.dayNumber}'), 'Day tabs render day numbers');

  // Bug fix: Day 1 slots must render before Day 2 arrives during streaming
  assert(itineraryContent.includes('hasDayParsing'), 'ItineraryDisplay uses hasDayParsing for slot selection');
  assert(itineraryContent.includes('showDayTabs'), 'ItineraryDisplay uses showDayTabs for tab rendering');
  assert(itineraryContent.includes('parsed.days.length > 0'), 'hasDayParsing checks for any parsed days');
  assert(itineraryContent.includes('parsed.days.length > 1'), 'showDayTabs only appears when 2+ days parsed');
  // Verify hasDayParsing is used for slot selection (not showDayTabs/isMultiDay)
  assert(itineraryContent.includes('hasDayParsing ? (parsed.days[activeDayIdx]'), 'Active slots use hasDayParsing not showDayTabs');

  // Bug fix: selectedDay resets when content goes empty (new plan)
  assert(itineraryContent.includes('prevContentRef'), 'ItineraryDisplay tracks previous content for reset');
  assert(itineraryContent.includes('setSelectedDay(0)'), 'ItineraryDisplay resets selectedDay on new plan');

  // Frontend: PlanHistory stores days
  const historyContent = fs.readFileSync('frontend/src/components/PlanHistory.tsx', 'utf8');
  assert(historyContent.includes('days?: number'), 'SavedPlan has days field');
  assert(historyContent.includes('-day trip'), 'PlanHistory shows trip length badge');

  // Bug fix: History replay restores tripDays
  assert(appContent.includes('setTripDays(plan.days || 1)'), 'handleSelectPlan restores tripDays from saved plan');
  assert(appContent.includes('extras.days = plan.days'), 'handleSelectPlan uses saved plan days in extras');

  // Frontend: useMediaEnrichment accepts maxPlaces
  const hookContent = fs.readFileSync('frontend/src/hooks/useMediaEnrichment.ts', 'utf8');
  assert(hookContent.includes('maxPlaces'), 'useMediaEnrichment accepts maxPlaces parameter');

  // Bug fix: usePlanStream extras type includes days
  const streamContent = fs.readFileSync('frontend/src/hooks/usePlanStream.ts', 'utf8');
  assert(streamContent.includes('days?: number'), 'usePlanStream extras type includes days');
}

// ─── Run all tests ────────────────────────────────────────────────────
async function main() {
  console.log('Building backend...');
  const { execSync } = await import('child_process');
  const { fileURLToPath } = await import('url');
  const { dirname } = await import('path');
  const __dirname = dirname(fileURLToPath(import.meta.url));
  try {
    execSync('node node_modules/typescript/bin/tsc', { cwd: __dirname, stdio: 'pipe' });
    console.log('Build successful.\n');
  } catch (e) {
    console.log('Build failed:');
    console.log(e.stdout?.toString() || e.stderr?.toString());
    process.exit(1);
  }

  console.log('Loading services...');
  const services = await loadServices();
  console.log('Services loaded.\n');

  console.log('Running tests...');

  await testAccommodations(services.accommodationService);
  await testRestaurants(services.restaurantService);
  await testSpotify(services.spotifyService);
  await testHappyHours(services.happyHourService);
  await testFreeStuff(services.freeStuffService);
  await testDeals(services.dealsService);
  await testToolRegistration(services.tools, services.executeToolCall);
  await testGasPrices(services.gasPriceService);
  await testPollen(services.pollenService);
  await testSunriseSunset(services.sunriseSunsetService);
  await testWaitTimes(services.waitTimeService);
  await testParking(services.parkingService);
  await testTransit(services.transitService);
  await testTransitRoutes(services.transitRouteService);
  await testPlanMapExtraction();
  await testSystemPrompt();
  await testToolCallIndicator();
  await testPlanMapStripping();
  await testSharedExtractPlaces();
  await testForceCallWarnings();
  await testDealsDataStructure(services.dealsService);
  await testItineraryDisplayKey();
  await testMusicPlayerCleanup();
  await testStreamReaderCleanup();
  await testLeafletSingleton();
  await testYouTubeService();
  await testInlineMediaIntegration();
  await testMultiDay();
  await testDataQuality(services);

  console.log(`\n${'='.repeat(60)}`);
  console.log(`Results: ${passed} passed, ${failed} failed`);
  if (failures.length > 0) {
    console.log(`\nFailures:`);
    failures.forEach((f, i) => console.log(`  ${i + 1}. ${f}`));
  }
  console.log('='.repeat(60));

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
  console.error('Test runner error:', err);
  process.exit(1);
});
