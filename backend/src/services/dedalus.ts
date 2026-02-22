import Dedalus from 'dedalus-labs';
import { tools, executeToolCall } from './tools';
import { PlanRequest, StreamEvent } from '../types';

// ── City name resolution via Nominatim ────────────────────────────────
// When the user types a non-city name (e.g., "Cornell", "Stanford"),
// resolve it to the actual city (e.g., "Ithaca", "Palo Alto") so all
// tool calls and the system prompt use the correct city.
/** Disambiguate a city name by appending state (for US/AU/etc.) to avoid
 *  ambiguity — "Cambridge" alone could be England or Massachusetts. */
function disambiguate(cityName: string, addr: any): string {
  const state = addr.state;
  if (!state) return cityName;
  // Only disambiguate well-known ambiguous names
  const ambiguous = new Set(['cambridge', 'springfield', 'portland', 'richmond', 'columbia',
    'jackson', 'lincoln', 'franklin', 'madison', 'clinton', 'greenville', 'burlington',
    'manchester', 'windsor', 'hamilton', 'georgetown', 'newcastle', 'victoria']);
  if (ambiguous.has(cityName.toLowerCase())) {
    return `${cityName}, ${state}`;
  }
  return cityName;
}

async function resolveCity(city: string): Promise<string> {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city)}&format=json&limit=5&addressdetails=1&email=dailyplanner@app.dev`,
      { signal: AbortSignal.timeout(3000) }
    );
    if (!res.ok) return city;
    const data = await res.json() as any[];
    if (data.length === 0) return city;

    const best = data.reduce((a: any, b: any) =>
      (parseFloat(b.importance) || 0) > (parseFloat(a.importance) || 0) ? b : a
    );
    const importance = parseFloat(best.importance) || 0;
    const addr = best.address || {};
    const rawCity = addr.city || addr.town || addr.village || addr.municipality || addr.hamlet;
    const resolved = rawCity?.replace(/^City of\s+/i, '').trim();

    // If importance is high and we have a resolved city, use it
    if (resolved && resolved.toLowerCase() !== city.toLowerCase()) return disambiguate(resolved, addr);

    // If importance is low and resolved matches input (no disambiguation),
    // try "{input} university" — handles Cornell, Stanford, MIT, etc.
    if (importance < 0.5 && (!resolved || resolved.toLowerCase() === city.toLowerCase())) {
      await new Promise(r => setTimeout(r, 1100)); // Nominatim rate limit
      const res2 = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(`${city} university`)}&format=json&limit=5&addressdetails=1&email=dailyplanner@app.dev`,
        { signal: AbortSignal.timeout(3000) }
      );
      if (res2.ok) {
        const data2 = await res2.json() as any[];
        if (data2.length > 0) {
          const best2 = data2.reduce((a: any, b: any) =>
            (parseFloat(b.importance) || 0) > (parseFloat(a.importance) || 0) ? b : a
          );
          const addr2 = best2.address || {};
          const rawCity2 = addr2.city || addr2.town || addr2.village || addr2.municipality || addr2.hamlet;
          const resolved2 = rawCity2?.replace(/^City of\s+/i, '').trim();
          if (resolved2 && resolved2.toLowerCase() !== city.toLowerCase()) return disambiguate(resolved2, addr2);
        }
      }
    }
  } catch { /* Nominatim failed — use raw city */ }
  return city;
}

// Lazy-initialize the client so dotenv has time to load first
let client: Dedalus | null = null;

function getClient(): Dedalus {
  if (!client) {
    const apiKey = process.env.DEDALUS_API_KEY || '';
    console.log('[Dedalus] Initializing with API key:', apiKey ? `${apiKey.substring(0, 15)}...` : 'MISSING');
    client = new Dedalus({ apiKey, timeout: 55000 });
  }
  return client;
}

function buildSystemPrompt(request: PlanRequest): string {
  const { budget, mood, currentHour, timezone, energyLevel, dietary, accessible, dateNight, antiRoutine, pastPlaces, recurring, rightNow, days } = request;

  // Helper to get time in the user's timezone
  const userNow = (tz?: string) => {
    if (tz) {
      try { return new Date(new Date().toLocaleString('en-US', { timeZone: tz })); } catch {}
    }
    return new Date();
  };
  const localNow = userNow(timezone);

  const extras: string[] = [];

  // Budget
  if (budget && budget !== 'any') {
    extras.push(`- Budget: ${budget === 'free' ? 'FREE activities only' : budget === 'low' ? 'affordable options ($)' : budget === 'medium' ? 'mid-range options ($$)' : 'premium experiences ($$$)'}. Factor cost into every suggestion.`);
  }

  // Mood detection
  if (mood) {
    extras.push(`- The user's mood/vibe: "${mood}". Read between the lines — if they sound stressed or exhausted, plan a calming, low-key day. If they sound excited or adventurous, plan bold experiences. If they're sad, plan uplifting comfort activities. Let their emotional state shape the entire tone and activity selection of the plan.`);
  }

  // Time-aware planning
  if (currentHour !== undefined && currentHour !== null) {
    if (currentHour >= 12 && currentHour < 18) {
      extras.push(`- It's currently ${currentHour > 12 ? currentHour - 12 : 12}pm. SKIP the Morning section entirely — start from Afternoon. The user doesn't need morning plans.`);
    } else if (currentHour >= 18) {
      extras.push(`- It's currently ${currentHour > 12 ? currentHour - 12 : 12}pm. SKIP Morning and Afternoon entirely — only plan the Evening section since that's all the time they have left today.`);
    }
  }

  // Energy level
  if (energyLevel) {
    const energyMap = {
      low: '- Energy level: LOW. The user is tired/exhausted. Plan gentle, relaxing activities — cafés, parks, bookstores, scenic walks, spas, casual dining. Avoid anything strenuous, crowded, or requiring lots of walking/standing.',
      medium: '- Energy level: MEDIUM. Balance active and chill activities — mix exploration with downtime.',
      high: '- Energy level: HIGH. The user is wired and energetic! Plan active, exciting activities — walking tours, sports, dancing, nightlife, adventure activities, exploring multiple neighborhoods.'
    };
    extras.push(energyMap[energyLevel]);
  }

  // Dietary restrictions
  if (dietary && dietary.length > 0) {
    extras.push(`- Dietary restrictions: ${dietary.join(', ')}. ALL restaurant recommendations MUST accommodate these restrictions. Mention specific dishes that fit. If suggesting a restaurant, note which menu items are safe.`);
  }

  // Accessibility
  if (accessible) {
    extras.push(`- ACCESSIBILITY REQUIRED: All venues must be wheelchair accessible. Note elevator availability, step-free routes, accessible restrooms. Avoid cobblestone streets, steep hills, or venues with stairs-only access. Mention accessible transit options.`);
  }

  // Date night mode
  if (dateNight) {
    extras.push(`- DATE NIGHT MODE: This is a romantic plan for two. Focus on intimate restaurants (not chains), scenic spots, cocktail bars with ambiance, sunset viewpoints, live music venues. Suggest sharing plates and couple-friendly activities. Include reservation tips ("book ahead", "ask for the corner table"). Skip touristy/crowded spots in favor of hidden gems with atmosphere.`);
  }

  // Anti-routine mode
  if (antiRoutine && pastPlaces && pastPlaces.length > 0) {
    extras.push(`- ANTI-ROUTINE MODE: The user wants to try NEW things. They have previously visited these places: ${pastPlaces.slice(0, 30).join(', ')}. DO NOT recommend any of these. Deliberately suggest places and activities they haven't tried — different neighborhoods, different cuisines, different types of experiences.`);
  }

  // Recurring plans
  if (recurring) {
    extras.push(`- RECURRING PLANS MODE: Generate 4 DIFFERENT Saturday plans for this city over the next month. Each plan should have a unique theme and explore different neighborhoods/cuisines. Label them "## Week 1 — [Theme]", "## Week 2 — [Theme]", etc. Each week should have Morning, Afternoon, and Evening subsections. Ensure variety — don't repeat restaurants, neighborhoods, or activity types across weeks.`);
  }

  // Multi-day vacation
  if (days && days > 1) {
    const start = new Date();
    const dayLabels: string[] = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const label = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
      dayLabels.push(`Day ${i + 1} - ${label}`);
    }
    extras.push(
      `- MULTI-DAY VACATION MODE (${days} days): Plan a cohesive ${days}-day trip.\n` +
      `  - Use these EXACT day headers as H1 headings: ${dayLabels.join(', ')}\n` +
      `  - Each day should have a distinct theme and character:\n` +
      `    - Day 1: Arrival day — settle in, explore the immediate neighborhood, ease into the city\n` +
      `    - Middle days: Deep exploration — different neighborhoods, major attractions, local experiences\n` +
      `    - Final day: Departure day — lighter schedule, revisit favorites, last-minute shopping, relaxed brunch\n` +
      `  - NEVER repeat the same restaurant, bar, or attraction across days\n` +
      `  - Spread neighborhoods logically — don't bounce across the city unnecessarily\n` +
      `  - Reference previous days for continuity ("After yesterday's street food marathon, today is all about fine dining...")\n` +
      `  - Where to Stay appears ONCE at the end, not per-day`
    );
  }

  const extrasBlock = extras.length > 0 ? `\n\nSPECIAL INSTRUCTIONS:\n${extras.join('\n')}` : '';

  // Determine time sections based on current hour
  let timeSections = `## Morning (8am - 12pm)
[Specific recommendation with real venue names, addresses, neighborhoods, and practical details]

## Afternoon (12pm - 6pm)
[Specific recommendation continuing the day's narrative arc]

## Evening (6pm - 11pm)
[Specific recommendation for the night — dinner, nightlife, or relaxation]`;

  if (currentHour !== undefined && currentHour !== null) {
    if (currentHour >= 18) {
      timeSections = `## Evening (now - 11pm)
[Pack the evening with specific recommendations — dinner, activities, nightlife]`;
    } else if (currentHour >= 12) {
      timeSections = `## Afternoon (now - 6pm)
[Specific recommendation starting from now]

## Evening (6pm - 11pm)
[Specific recommendation for the night]`;
    }
  }

  if (recurring) {
    timeSections = `## Week 1 — [Theme Name]
### Morning / Afternoon / Evening plans

## Week 2 — [Theme Name]
### Morning / Afternoon / Evening plans

## Week 3 — [Theme Name]
### Morning / Afternoon / Evening plans

## Week 4 — [Theme Name]
### Morning / Afternoon / Evening plans`;
  }

  if (rightNow) {
    const timeOpts: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit', hour12: true };
    if (timezone) timeOpts.timeZone = timezone;
    const nowTime = new Date().toLocaleTimeString('en-US', timeOpts);
    const endHour = new Date(Date.now() + 2 * 60 * 60 * 1000).toLocaleTimeString('en-US', timeOpts);
    timeSections = `## Right Now (${nowTime} - ${endHour})
[2-3 specific things the user can do RIGHT NOW or within the next 2 hours. Focus on what's immediately available — no "later today" suggestions. Include walk-in-friendly places, things that don't need reservations, and whatever is open/happening at this exact moment.]

## Quick Bite
[One fast, nearby food recommendation that's open right now — could be a restaurant, food truck, café, or street food. Include specific dish to order.]`;
    extras.push(`- **RIGHT NOW MODE**: The user wants to know what they can do IMMEDIATELY — in the next 2 hours. Do NOT plan a full day. Be ultra-specific about timing: "open right now until 8 PM", "starts in 45 minutes", "happy hour ends at 7 PM". Only suggest places that are OPEN and things that are HAPPENING right now or very soon. Keep it short and actionable — this is not a full itinerary, it's a quick "here's what to do right now" guide.`);
  }

  // Multi-day vacation: override timeSections with day-level structure
  if (days && days > 1) {
    const start = localNow;
    const dayBlocks: string[] = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(start);
      d.setDate(d.getDate() + i);
      const label = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
      dayBlocks.push(
        `# Day ${i + 1} - ${label}\n` +
        `## Morning (8am - 12pm)\n[...]\n\n` +
        `## Afternoon (12pm - 6pm)\n[...]\n\n` +
        `## Evening (6pm - 11pm)\n[...]`
      );
    }
    timeSections = dayBlocks.join('\n\n');
  }

  const dateOpts: Intl.DateTimeFormatOptions = { weekday: 'long' };
  if (timezone) dateOpts.timeZone = timezone;
  const dayOfWeek = new Date().toLocaleDateString('en-US', dateOpts);
  const fullDate = localNow.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return `You are a fun, enthusiastic local concierge who knows the destination the user is asking about intimately — the neighborhoods, the hidden gems, the best food spots, the local culture. If the user gives a country, state, or region instead of a specific city, pick the best city or area within that destination for an amazing day trip and plan around it. If the user gives a university, landmark, or institution name instead of a city (e.g., "Cornell", "Stanford", "Yosemite"), identify the actual city/town where it's located (e.g., Ithaca, Palo Alto, Mariposa) and use THAT city for all tool calls and recommendations. Plan their perfect day.

TODAY IS: ${fullDate}
Day of the week: ${dayOfWeek}
This is important! Many events, free museum days, deals, and specials are day-specific. The tools will return ONLY what's available today — highlight day-specific finds prominently (e.g., "Since it's ${dayOfWeek}, MoMA is FREE tonight!" or "Today's ${dayOfWeek} deal: $1 tacos at...").

IMPORTANT RULES:
1. You MUST call tools before writing any itinerary. Call ALL of these in your FIRST response: get_weather, get_local_events, get_restaurant_recommendations, get_free_stuff, get_deals_coupons, get_happy_hours, get_accommodations. Also call get_sunrise_sunset and others as relevant. The more tools you call, the richer the plan. NEVER skip the accommodations tool.
2. Tools give you structured data, but YOU are the expert. If a tool returns generic/placeholder data, REPLACE it with real places you know. Never recommend a restaurant called "Local Favorite Grill" or an event called "Community Art Walk" — use actual real places, real restaurant names, real landmarks, and real neighborhoods that exist in that city.
3. Every recommendation must be a REAL place that actually exists. Use real street names, real neighborhoods, real venue names. You have extensive knowledge of cities worldwide — use it.
4. Include the city's ICONIC experiences and signature attractions — the things the city is famous for that visitors should not miss. For NYC that's Summit One Vanderbilt, Top of the Rock, or the High Line; for Paris it's the Eiffel Tower or Musée d'Orsay; for Tokyo it's Shibuya Crossing or Tsukiji Outer Market. Mix these marquee attractions with hidden gems and local favorites for a balanced itinerary.
5. **GEOGRAPHIC ROUTING**: Plan activities in a geographically logical order so the user isn't zigzagging across the city. The route should start from the accommodation area in the morning and end near it in the evening — the user leaves their hotel, explores the city in a logical loop, and returns. Group nearby places together within each time period. Morning activities should be in one area, then afternoon moves to a nearby neighborhood, then evening to the next. Think about it like an efficient walking/transit route — each stop should be near the previous one. Mention your top accommodation pick by name at the start of Morning (e.g., "Starting from [Hotel Name]...") so the user knows the anchor point. The user will follow this order on Google Maps, so the path needs to make sense on a real map.

Available tools (call all that are relevant):
- get_weather: Always call this. Use the data for practical advice.
- get_local_events: City events and activities — DAY-AWARE, only returns events for today's day of the week. Check the todayHighlights array for day-specific finds!
- get_restaurant_recommendations: Real restaurant data (name, cuisine, price level, rating, review count, neighborhood, Google Maps link). May include a "reviewHighlights" array — these are real snippets from customer reviews mentioning specific dishes they ordered. USE these to recommend specific items (e.g., if a review says "The cacio e pepe was incredible", tell the user to order the cacio e pepe). If no reviewHighlights are present, describe what the restaurant is known for based on its cuisine type but do NOT invent specific named dishes. Approximate a per-person cost from the price level ($=~$10-15, $$=~$20-35, $$$=~$50+).

- get_trending_news: Current headlines for conversation starters.
- get_free_stuff: Free activities available TODAY — DAY-AWARE, filters to today's day. Highlight the todayHighlights prominently (e.g., "Since it's ${dayOfWeek}, you can get into MoMA for FREE!").
- get_deals_coupons: Deals and discounts — DAY-AWARE, shows only today's deals. Highlight todayDeals prominently (e.g., "It's Taco Tuesday — $1 tacos at...").
- get_sunrise_sunset: Golden hour timing for photo spots and sunset activities.
- get_happy_hours: Bar specials for evening planning.
- get_wait_times: Queue estimates for popular attractions.
- get_parking: Parking info if driving activities are involved.
- get_gas_prices: Fuel costs for road trip/driving plans.
- get_public_transit_routes: Step-by-step transit directions.
- get_transit_estimates: Travel time estimates between locations.
- get_accommodations: Where to stay — always call this. Returns curated hotels, hostels, boutiques, and apartments with prices and neighborhoods.

Structure the itinerary with these exact sections:

${timeSections}

## Where to Stay
[REQUIRED — you MUST include this section:
- List 2-4 accommodation options — only include as many as there are genuinely good picks for the destination. Small towns may only have 2; big cities can have 4.
- If the tool returned generic placeholders (e.g., "City Center Hotel", "Backpacker's Hostel"), REPLACE them with real hotels/hostels you know that are actually located IN or very near ${request.city}.
- EVERY accommodation MUST physically be in or immediately adjacent to the destination. If "${request.city}" is a university/landmark/institution (not a city name), use the actual city where it's located (e.g., "Cornell" → Ithaca, "Stanford" → Palo Alto). NEVER suggest a hotel in a different city or region.
- For each: name as a clickable Google Maps link, type (hotel/hostel/boutique/apartment), price per night, neighborhood, and a one-line description
- For tool-provided accommodations, use the "link" field. For your own recommendations, create links as [Hotel Name](https://www.google.com/maps/search/Hotel+Name/@LAT,LNG,17z) with approximate coordinates
- Do NOT skip or truncate this section — it must appear in full before the Pro Tips section]

## Estimated Total
[REQUIRED — add up ALL the costs mentioned in the itinerary above (food, drinks, activities, transport, entry fees) and show a simple breakdown:
- Food & Drinks: ~$XX
- Activities & Entry: ~$XX
- Transport: ~$XX
- **Total: ~$XX per person**
Use the specific prices you cited throughout the plan. If something was free, don't include it. This should be a quick, honest summary — not a sales pitch.]

## Pro Tips
[REQUIRED — include 2-4 general tips about visiting ${request.city} that a tourist wouldn't easily know. These should be city-level insider knowledge, NOT about specific venues in the itinerary above. Examples: "Tap water is safe to drink everywhere — skip the bottled water", "The metro is fastest between 10am-4pm — avoid rush hour sardine cans", "Tipping 18-20% is expected at sit-down restaurants", "Street parking is free on Sundays", "Download the city transit app — it works offline", "Most museums are closed on Mondays". Keep each tip to one line.]

Writing style:
- Lead each time period with a specific weather note — actual temperature in °C/°F, feels-like, rain/wind/UV warnings with practical advice ("bring an umbrella", "wear sunscreen", "bundle up").
- Name REAL restaurants with their actual cuisine, neighborhood, and what they're known for. When reviewHighlights are available, cite specific dishes that real customers mentioned (e.g., "reviewers rave about the cacio e pepe" or "get the spicy margarita — multiple reviewers call it the best"). When no reviewHighlights are present, describe by cuisine type but do NOT invent specific named dishes. Use the price level from the tool to estimate per-person cost. Never generic names.
- Name REAL landmarks, streets, parks, and venues. Include cross-streets or neighborhoods so someone could actually find them.
- **LINKS**: EVERY venue, restaurant, event, bar, and attraction MUST be a clickable markdown link — NO EXCEPTIONS.
  - For places from tool data: copy the pre-formatted "link" or "markdownLink" field directly.
  - For places from YOUR OWN knowledge: create the link yourself as [Place Name](https://www.google.com/maps/search/Place+Name/@LAT,LNG,17z) — include the approximate latitude and longitude so the map can pin the exact location. Use + for spaces in the place name.
  - WRONG: https://maps.google.com/?q=Griffith%20Observatory — NEVER write a raw URL
  - WRONG: "Visit Griffith Observatory" — NEVER write a place name without a link
  - RIGHT: "Hike up to [Griffith Observatory](https://www.google.com/maps/search/Griffith+Observatory/@34.1184,-118.3004,17z) for panoramic views"
  - RIGHT: "Grab a coffee at [Blue Bottle Coffee](https://www.google.com/maps/search/Blue+Bottle+Coffee/@34.0407,-118.2468,17z)"
- **PRICES ARE REQUIRED**: Always cite specific dollar/currency amounts — never say "affordable" or "cheap" without a number. For restaurants, the tool provides price level ($-$$$$) but NOT specific dish prices — use your own knowledge to estimate dish prices with a ~ prefix (e.g., "~$14"). Use dealPrice, price fields from other tool data. Examples:
  - "~$3.50/slice" not "cheap pizza"
  - "$8 craft cocktails, $5 beers" not "drink specials"
  - "Lunch for ~$12/person" not "budget-friendly"
  - "Save 45% — was $180, now $99" not "big discount"
- Reference deals, free activities, and golden hour timing when those tools return data. ESPECIALLY highlight day-specific finds — "Since it's [day], [venue] is free today!" or "Today's [day] deal: [deal]". These make the plan feel personalized and timely.
- Be warm, specific, and enthusiastic — like a local friend who's excited to show someone around.
- If a tool fails or returns generic data, use YOUR OWN knowledge to fill in with real, specific recommendations for that city.${extrasBlock}`;
}

/**
 * Stream plan generation with tool calling
 *
 * This implements the full OpenAI tool-calling loop:
 * 1. Send user message + tools → model responds with tool_calls (retry if it returns text instead)
 * 2. Execute each tool
 * 3. Send tool results back to the model → model generates final content (with fallback)
 */
export async function* streamPlanGeneration(request: PlanRequest): AsyncGenerator<StreamEvent> {
  console.log('[Dedalus] Starting stream for:', request);

  // Track elapsed time to gracefully stop before Vercel's 60s hard limit
  const startTime = Date.now();
  const DEADLINE_MS = 55_000; // stop initiating new phases after 55s
  const elapsed = () => Date.now() - startTime;
  const timeRemaining = () => DEADLINE_MS - elapsed();

  if (!process.env.DEDALUS_API_KEY || process.env.DEDALUS_API_KEY === 'your_dedalus_api_key_here') {
    yield { type: 'error', error: 'Dedalus API key not configured.' };
    return;
  }

  // Resolve the city name — "Cornell" → "Ithaca", "Stanford" → "Palo Alto", etc.
  // Runs before the LLM call so all tool calls use the correct city.
  const resolvedCity = await resolveCity(request.city);
  if (resolvedCity !== request.city) {
    console.log(`[Dedalus] Resolved city: "${request.city}" → "${resolvedCity}"`);
  }
  // Use resolvedCity for tool calls, but keep the original for the user message
  // so the LLM knows what the user actually typed.
  const toolCity = resolvedCity;

  // Tell the frontend the resolved city so it can geocode the map correctly
  // (the user may have typed a misspelling or a landmark name)
  yield { type: 'city_resolved', content: resolvedCity };

  // Build user message with context
  const isMultiDay = request.days && request.days > 1;
  const userParts: string[] = [
    isMultiDay
      ? `I'm planning a ${request.days}-day vacation in ${request.city}${resolvedCity !== request.city ? ` (${resolvedCity})` : ''}.`
      : `I'm visiting ${request.city}${resolvedCity !== request.city ? ` (${resolvedCity})` : ''}. Plan my day there.`
  ];
  if (request.budget && request.budget !== 'any') userParts.push(`Budget: ${request.budget}`);
  if (request.mood) userParts.push(`How I'm feeling: "${request.mood}"`);
  if (request.energyLevel) userParts.push(`Energy level: ${request.energyLevel}`);
  if (request.dietary && request.dietary.length > 0) userParts.push(`Dietary needs: ${request.dietary.join(', ')}`);
  if (request.accessible) userParts.push(`I need wheelchair accessible venues`);
  if (request.dateNight) userParts.push(`This is a date night — make it romantic`);
  if (request.recurring) userParts.push(`Plan my next 4 Saturdays with variety`);
  if (request.rightNow) {
    userParts.push(`What can I do RIGHT NOW? I have about 2 hours. Call the most relevant tools — weather, events, free stuff, happy hours, deals — and tell me what's happening right now or starting very soon. Keep it short and actionable.`);
  } else if (isMultiDay) {
    userParts.push(`Plan all ${request.days} days cohesively. Call ALL relevant tools first — weather, events, restaurants, accommodations, sunrise/sunset, free stuff, deals, and any others. Then create ${request.days} days of amazing, specific itineraries with real places. Don't repeat places across days.`);
  } else {
    userParts.push(`What should I do today? Call ALL relevant tools first — weather, events, restaurants, accommodations, sunrise/sunset, free stuff, deals, and any others that fit. Then create an amazing, specific itinerary with real places.`);
  }

  const messages: any[] = [
    { role: 'system', content: buildSystemPrompt(request) },
    { role: 'user', content: userParts.join('. ') }
  ];

  const dedalus = getClient();

  try {
    // ── Step 1: First API call – model decides which tools to call ──
    // Retry up to 3 times if the model returns content instead of tool calls
    yield { type: 'thinking_chunk', thinking: isMultiDay ? `Planning your ${request.days}-day adventure in ${request.city}...` : `Planning your perfect day in ${request.city}...` };

    let assistantMessage: any = null;

    for (let step1Attempt = 0; step1Attempt < 2; step1Attempt++) {
      console.log(`[Dedalus] Step 1 (attempt ${step1Attempt + 1}): Requesting tool calls...`);

      const firstResponse = await dedalus.chat.completions.create({
        model: 'anthropic/claude-sonnet-4-5',
        messages,
        tools,
        tool_choice: { type: 'auto' } as any,
        temperature: 0.7,
        max_tokens: 2000
      });

      assistantMessage = firstResponse.choices?.[0]?.message;
      if (!assistantMessage) {
        yield { type: 'error', error: 'No response from model' };
        return;
      }

      console.log('[Dedalus] finish_reason:', firstResponse.choices?.[0]?.finish_reason);
      console.log('[Dedalus] Tool calls:', assistantMessage.tool_calls?.length || 0);
      console.log('[Dedalus] Content:', assistantMessage.content ? assistantMessage.content.substring(0, 100) + '...' : 'none');

      // If we got tool calls, break out and proceed
      if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
        break;
      }

      // Model returned content instead of tool calls — retry with a nudge
      console.log(`[Dedalus] Step 1: Model returned content instead of tool calls, retrying...`);

      if (assistantMessage.content) {
        messages.push({ role: 'assistant', content: assistantMessage.content });
        messages.push({
          role: 'user',
          content: 'Please call the tools first — get_weather, get_local_events, get_restaurant_recommendations, get_accommodations, get_sunrise_sunset, get_free_stuff, get_deals_coupons, and any others that are relevant. Do not respond with text — only call tools.'
        });
      }

      assistantMessage = null;
    }

    if (!assistantMessage || !assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
      yield { type: 'error', error: 'Failed to invoke tools. Please try again.' };
      return;
    }

    yield { type: 'thinking_chunk', thinking: `Found ${assistantMessage.tool_calls.length} data sources to check...` };

    // ── Step 2: Execute each tool call ──
    messages.push({
      role: 'assistant',
      tool_calls: assistantMessage.tool_calls
    });

    // Parse all tool calls and emit start events immediately
    const toolCallInfos: { toolCall: any; toolName: string; args: Record<string, any> }[] = [];
    for (const toolCall of assistantMessage.tool_calls) {
      if (toolCall.type !== 'function') continue;
      const fn = (toolCall as any).function;
      const toolName = fn?.name;
      let args: Record<string, any> = {};
      try { args = JSON.parse(fn?.arguments || '{}'); } catch { args = {}; }
      if (!args.city && toolCity) args.city = toolCity;
      toolCallInfos.push({ toolCall, toolName, args });
      yield { type: 'tool_call_start', tool: toolName, args };
    }

    // Execute ALL tools in parallel, but cap at remaining time minus buffer for LLM streaming
    const toolDeadline = Math.max(timeRemaining() - 20_000, 5_000); // reserve 20s for LLM
    console.log(`[Dedalus] Tool execution budget: ${toolDeadline}ms (elapsed: ${elapsed()}ms)`);

    const toolTimeout = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('tool_timeout')), toolDeadline)
    );

    const toolSettled = await Promise.allSettled(
      toolCallInfos.map(async ({ toolCall, toolName, args }) => {
        console.log(`[Dedalus] Executing tool: ${toolName}`, args);
        const result = await Promise.race([
          executeToolCall(toolName!, args, { rightNow: request.rightNow, currentHour: request.currentHour }),
          toolTimeout.catch(() => ({ success: false, error: 'Timed out' }))
        ]);
        return { toolCall, toolName, result };
      })
    );

    for (let idx = 0; idx < toolSettled.length; idx++) {
      const settled = toolSettled[idx];
      if (settled.status === 'fulfilled') {
        const { toolCall, toolName, result } = settled.value;
        yield { type: 'tool_call_result', tool: toolName, result };
        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(result)
        });
      } else {
        // Tool failed — send empty result so the model can still generate
        const { toolCall, toolName } = toolCallInfos[idx];
        console.error(`[Dedalus] Tool ${toolName} failed:`, settled.reason);
        yield { type: 'tool_call_result', tool: toolName, result: { success: false, error: 'Tool execution failed' } };
        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify({ success: false, error: 'Tool execution failed' })
        });
      }
    }

    // ── Step 2b: Force-call any missing critical tools in parallel ──
    // Skip if we're running low on time — better to generate with fewer tools than timeout
    const calledTools = new Set(
      assistantMessage.tool_calls
        .filter((tc: any) => tc.type === 'function')
        .map((tc: any) => tc.function?.name)
    );

    const forceCalls: { name: string; args: Record<string, any> }[] = [];
    // Accommodations uses hardcoded data (instant, no external API),
    // so always force-call it regardless of time pressure
    if (!calledTools.has('get_accommodations') && toolCity && !request.rightNow) {
      forceCalls.push({ name: 'get_accommodations', args: { city: toolCity, budget: request.budget && request.budget !== 'any' ? request.budget : undefined } });
    }

    if (forceCalls.length > 0) {
      console.log(`[Dedalus] Force-calling ${forceCalls.length} skipped tools in parallel:`, forceCalls.map(f => f.name));
      for (const fc of forceCalls) {
        yield { type: 'tool_call_start', tool: fc.name, args: fc.args };
      }

      const forceSettled = await Promise.allSettled(
        forceCalls.map(async (fc) => {
          const result = await executeToolCall(fc.name, fc.args, { rightNow: request.rightNow, currentHour: request.currentHour });
          return { ...fc, result };
        })
      );

      const assistantMsgIdx = messages.findIndex(
        (m: any) => m.role === 'assistant' && m.tool_calls && m.tool_calls.length > 0
      );

      for (let idx = 0; idx < forceSettled.length; idx++) {
        const settled = forceSettled[idx];
        const { name, args, result } = settled.status === 'fulfilled'
          ? settled.value
          : { ...forceCalls[idx], result: { success: false, error: 'Tool execution failed' } };
        yield { type: 'tool_call_result', tool: name, result };
        const syntheticId = `forced_${name}_${Date.now()}`;
        if (assistantMsgIdx !== -1) {
          messages[assistantMsgIdx].tool_calls.push({
            id: syntheticId,
            type: 'function',
            function: { name, arguments: JSON.stringify(args) }
          });
        }
        messages.push({
          role: 'tool',
          tool_call_id: syntheticId,
          content: JSON.stringify(result)
        });
      }
    }

    console.log(`[Dedalus] Pre-Step 3 elapsed: ${elapsed()}ms, remaining: ${timeRemaining()}ms`);

    if (timeRemaining() < 8_000) {
      console.log('[Dedalus] Not enough time for Step 3 — aborting');
      yield { type: 'error', error: 'Request took too long gathering data. Please try again.' };
      return;
    }

    yield { type: 'thinking_chunk', thinking: 'Crafting your personalized itinerary...' };

    // ── Step 3: Second API call – model synthesizes tool results into itinerary ──
    let contentReceived = false;

    // Scale token budget for multi-day trips, but reduce if we're short on time
    let tokenBudget = isMultiDay ? Math.min(request.days! * 4000, 16000) : 8000;
    if (timeRemaining() < 25_000) {
      // Under 25s left — cap output to finish in time
      tokenBudget = Math.min(tokenBudget, 6000);
      console.log(`[Dedalus] Reduced token budget to ${tokenBudget} due to time pressure`);
    }

    // Only retry if we have enough time
    const maxAttempts = timeRemaining() > 35_000 ? 2 : 1;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const isRetry = attempt > 0;
      if (isRetry) {
        console.log('[Dedalus] Step 3 retry: Non-streaming fallback...');
        yield { type: 'thinking_chunk', thinking: 'Generating itinerary (retry)...' };
      } else {
        console.log('[Dedalus] Step 3: Streaming itinerary from tool results...');
      }

      if (!isRetry) {
        // Streaming attempt
        const stream = await dedalus.chat.completions.create({
          model: 'anthropic/claude-sonnet-4-5',
          messages,
          stream: true,
          temperature: 0.7,
          max_tokens: tokenBudget
        });

        for await (const chunk of stream) {
          const delta = chunk.choices?.[0]?.delta;
          const content = delta?.content;

          if (content) {
            contentReceived = true;
            yield { type: 'content_chunk', content };
          }

          if (chunk.choices?.[0]?.finish_reason) {
            console.log('[Dedalus] Stream finished:', chunk.choices[0].finish_reason, '| content received:', contentReceived);
            break;
          }
        }
      } else {
        // Non-streaming fallback
        const fallbackResponse = await dedalus.chat.completions.create({
          model: 'anthropic/claude-sonnet-4-5',
          messages,
          temperature: 0.7,
          max_tokens: tokenBudget
        });

        const fallbackContent = fallbackResponse.choices?.[0]?.message?.content;
        if (fallbackContent) {
          contentReceived = true;
          const chunkSize = 100;
          for (let i = 0; i < fallbackContent.length; i += chunkSize) {
            yield { type: 'content_chunk', content: fallbackContent.slice(i, i + chunkSize) };
          }
          console.log('[Dedalus] Fallback response received, length:', fallbackContent.length);
        } else {
          console.log('[Dedalus] Fallback also returned no content');
        }
      }

      if (contentReceived) break;
    }

    if (!contentReceived) {
      yield { type: 'error', error: 'Failed to generate itinerary after retrying. Please try again.' };
      return;
    }

    yield { type: 'done' };
  } catch (error) {
    console.error('[Dedalus] Stream error:', error);
    yield {
      type: 'error',
      error: error instanceof Error ? error.message : 'Failed to generate plan'
    };
  }
}
