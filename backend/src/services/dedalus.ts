import Dedalus from 'dedalus-labs';
import { executeToolCall } from './tools';
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
      { signal: AbortSignal.timeout(1500) }
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
    if (importance < 0.3 && (!resolved || resolved.toLowerCase() === city.toLowerCase())) {
      await new Promise(r => setTimeout(r, 500)); // Nominatim rate limit
      const res2 = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(`${city} university`)}&format=json&limit=5&addressdetails=1&email=dailyplanner@app.dev`,
        { signal: AbortSignal.timeout(1500) }
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
      `  - Your Hotel appears ONCE at the end, not per-day`
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
1. The user message below includes real-time data from multiple sources. If a source returns generic/placeholder data (e.g., "Local Favorite Grill", "Community Art Walk"), SKIP that entry — do not use it. Use your knowledge only for neighborhood descriptions, transition directions, and general city context — NEVER for venue names.
2. **ALL venue names must come from the VERIFIED data provided.** Restaurants, attractions, and accommodations are verified via Google Places (confirmed currently open). Use ONLY those for specific venue names. Happy hours and events data may be outdated — use them for general context (neighborhoods, timing, deal types) but do NOT trust their specific venue/bar names. The ONLY non-data venues you may mention are public parks and outdoor infrastructure (bridges, plazas, boardwalks) that cannot close. If data has few results, plan fewer stops — do NOT fill gaps from your own knowledge.
3. Build the itinerary around the attractions and restaurants provided. If the destination is known for a specific ACTIVITY (skiing, surfing, hiking, diving, wine tasting), that activity MUST be the centerpiece — but for specific venues, still only use what was provided. Do NOT add attractions, museums, or landmarks from your own knowledge.
4. **GEOGRAPHIC ROUTING — THIS IS CRITICAL**: The user will plug these stops into Google Maps in order. If they zigzag across the city, the plan is useless. Follow this method:
   a) Pick ONE neighborhood/area for Morning, ONE for Afternoon, ONE for Evening. All activities within a time period MUST be walkable from each other (under 15 min walk).
   b) The three neighborhoods must form a logical geographic arc — not bouncing north-south-north. Morning → Afternoon → Evening should flow in one direction across the city (e.g., south → central → north, or east → west).
   c) Start Morning BY NAME at the accommodation — e.g., "Starting from [Hotel Name](link), head to..." End Evening BY NAME back at it — e.g., "...a short walk back to [Hotel Name](link)." This creates a visible loop.
   d) For EACH activity, state which neighborhood it's in parenthetically so the user can verify proximity — e.g., "Head to [Café Name](link) **(SoHo)** for brunch".
   e) Between time periods, briefly note the transition: "**Walk 10 min north to Greenwich Village for the afternoon.**"
   f) NEVER recommend two consecutive places that are more than 20 min apart by walking/transit. If a must-see attraction is far away, rearrange the order or swap it into a different time period where it fits geographically.
5. **EVERY section in the output format is MANDATORY** — you must include ALL of them: the time-of-day sections, Where to Stay, Estimated Total, AND Pro Tips. NEVER skip or truncate any section. The Estimated Total is especially important — the user needs to know how much the day will cost.

DATA NOTES:
- Restaurants may include "reviewHighlights" — real snippets from customer reviews mentioning specific dishes. USE these to recommend specific items. If no reviewHighlights, describe by cuisine type but do NOT invent specific named dishes. Approximate per-person cost from price level ($=~$10-15, $$=~$20-35, $$$=~$50+).
- Events and free stuff are DAY-AWARE — highlight day-specific finds prominently (e.g., "Since it's ${dayOfWeek}, MoMA is FREE tonight!").
- Happy hours data may be outdated — use for timing/deal context only, do NOT trust specific bar names.

Structure the itinerary with these exact sections:

${timeSections}

## Estimated Total
[REQUIRED — add up ALL costs from the itinerary (food, drinks, activities, transport, entry fees):
- Food & Drinks: ~$XX
- Activities & Entry: ~$XX
- Transport: ~$XX
- **Total: ~$XX per person**

**Pro Tips:**
- 2-4 general tips about visiting ${request.city} that a tourist wouldn't easily know (city-level insider knowledge, NOT about specific venues above). One line each.]

## Your Hotel
[REQUIRED — pick ONE accommodation that best fits the user's budget and location. Choose the option closest to the day's activities so the geographic routing makes sense.
- If the tool returned generic placeholders (e.g., "City Center Hotel"), REPLACE it with a real hotel you know in ${request.city}.
- Name as a clickable Google Maps link, type (hotel/hostel/boutique/apartment), price per night, neighborhood.
- Write 2-3 sentences reviewing it — what makes it a good pick, the vibe, standout amenities, any insider tips (e.g., "ask for a room facing the courtyard — it's quieter").
- For tool-provided accommodations, use the "link" field. For your own, create links as [Hotel Name](https://www.google.com/maps/search/Hotel+Name/@LAT,LNG,17z).]

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
 * Deterministically build the list of tools to call based on request type.
 * No LLM needed — we always know which tools are relevant.
 */
function getCoreToolCalls(request: PlanRequest, city: string): { name: string; args: Record<string, any> }[] {
  const budget = request.budget && request.budget !== 'any' ? request.budget : undefined;

  if (request.rightNow) {
    // Right Now mode: only time-sensitive tools
    return [
      { name: 'get_weather', args: { city } },
      { name: 'get_local_events', args: { city } },
      { name: 'get_free_stuff', args: { city } },
      { name: 'get_happy_hours', args: { city } },
      { name: 'get_deals_coupons', args: { city } },
      { name: 'get_restaurant_recommendations', args: { city, budget } },
    ];
  }

  // Regular single-day or multi-day: all 9 core tools
  return [
    { name: 'get_weather', args: { city } },
    { name: 'get_local_events', args: { city } },
    { name: 'get_restaurant_recommendations', args: { city, budget } },
    { name: 'get_attractions', args: { city } },
    { name: 'get_free_stuff', args: { city } },
    { name: 'get_deals_coupons', args: { city } },
    { name: 'get_happy_hours', args: { city } },
    { name: 'get_accommodations', args: { city, budget } },
    { name: 'get_sunrise_sunset', args: { city } },
  ];
}

/**
 * Stream plan generation — optimized pipeline:
 * 1. Resolve city name (Nominatim)
 * 2. Execute ALL tools directly in parallel (no LLM needed to decide)
 * 3. Stream itinerary with tool data embedded in user message (single LLM call)
 */
export async function* streamPlanGeneration(request: PlanRequest): AsyncGenerator<StreamEvent> {
  console.log('[Dedalus] Starting stream for:', request);

  // Track elapsed time to gracefully stop before Vercel's 60s hard limit
  const startTime = Date.now();
  const DEADLINE_MS = 55_000;
  const elapsed = () => Date.now() - startTime;
  const timeRemaining = () => DEADLINE_MS - elapsed();

  if (!process.env.DEDALUS_API_KEY || process.env.DEDALUS_API_KEY === 'your_dedalus_api_key_here') {
    yield { type: 'error', error: 'Dedalus API key not configured.' };
    return;
  }

  // ── Phase 1: Resolve city name ──
  const resolvedCity = await resolveCity(request.city);
  if (resolvedCity !== request.city) {
    console.log(`[Dedalus] Resolved city: "${request.city}" → "${resolvedCity}"`);
  }
  const toolCity = resolvedCity;
  yield { type: 'city_resolved', content: resolvedCity };

  const isMultiDay = request.days && request.days > 1;
  yield { type: 'thinking_chunk', thinking: isMultiDay ? `Planning your ${request.days}-day adventure in ${request.city}...` : `Planning your perfect day in ${request.city}...` };

  // ── Phase 2: Execute ALL tools directly in parallel (no LLM needed) ──
  const coreTools = getCoreToolCalls(request, toolCity);
  console.log(`[Dedalus] Executing ${coreTools.length} tools directly (skipping LLM tool selection)`);

  for (const tc of coreTools) {
    yield { type: 'tool_call_start', tool: tc.name, args: tc.args };
  }

  const toolDeadline = Math.max(timeRemaining() - 30_000, 5_000); // reserve 30s for LLM
  console.log(`[Dedalus] Tool execution budget: ${toolDeadline}ms (elapsed: ${elapsed()}ms)`);

  const toolTimeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('tool_timeout')), toolDeadline)
  );

  const toolSettled = await Promise.allSettled(
    coreTools.map(async (tc) => {
      console.log(`[Dedalus] Executing tool: ${tc.name}`, tc.args);
      const result = await Promise.race([
        executeToolCall(tc.name, tc.args, { rightNow: request.rightNow, currentHour: request.currentHour }),
        toolTimeout.catch(() => ({ success: false, error: 'Timed out' }))
      ]);
      return { name: tc.name, result };
    })
  );

  // Collect results and emit events
  const toolResults: { name: string; result: any }[] = [];
  for (let idx = 0; idx < toolSettled.length; idx++) {
    const settled = toolSettled[idx];
    if (settled.status === 'fulfilled') {
      toolResults.push(settled.value);
      yield { type: 'tool_call_result', tool: settled.value.name, result: settled.value.result };
    } else {
      const failResult = { name: coreTools[idx].name, result: { success: false, error: 'Tool execution failed' } };
      toolResults.push(failResult);
      console.error(`[Dedalus] Tool ${coreTools[idx].name} failed:`, settled.reason);
      yield { type: 'tool_call_result', tool: failResult.name, result: failResult.result };
    }
  }

  yield { type: 'thinking_chunk', thinking: `Gathered data from ${toolResults.filter(t => t.result?.success).length} sources...` };

  console.log(`[Dedalus] Tools done. Elapsed: ${elapsed()}ms, remaining: ${timeRemaining()}ms`);

  if (timeRemaining() < 8_000) {
    console.log('[Dedalus] Not enough time for LLM — aborting');
    yield { type: 'error', error: 'Request took too long gathering data. Please try again.' };
    return;
  }

  // ── Phase 3: Build message with embedded tool data and stream itinerary ──
  yield { type: 'thinking_chunk', thinking: 'Crafting your personalized itinerary...' };

  // Build the user message with all tool data embedded
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

  // Embed tool results as structured data sections
  const TOOL_LABELS: Record<string, string> = {
    'get_weather': 'Weather',
    'get_local_events': 'Local Events (day-specific)',
    'get_restaurant_recommendations': 'Restaurants (verified, currently open via Google Places)',
    'get_attractions': 'Attractions & Activities (verified, currently open via Google Places)',
    'get_free_stuff': 'Free Activities Today',
    'get_deals_coupons': 'Deals & Discounts Today',
    'get_happy_hours': 'Happy Hours (⚠️ unverified — use timing/deal context only, not bar names)',
    'get_accommodations': 'Accommodations (verified, currently open via Google Places)',
    'get_sunrise_sunset': 'Sunrise/Sunset & Golden Hour',
  };

  const dataSections: string[] = [];
  for (const tr of toolResults) {
    if (!tr.result?.success) continue;
    const label = TOOL_LABELS[tr.name] || tr.name;
    dataSections.push(`### ${label}\n${JSON.stringify(tr.result.data || tr.result, null, 0)}`);
  }

  const activityHint = request.city.match(/chamonix|aspen|vail|whistler|zermatt|st\.?\s*moritz|courchevel|verbier|jackson hole|park city|telluride|big sky|mammoth/i)
    ? 'This is a SKI destination — skiing/snowboarding MUST be the centerpiece of the plan. '
    : request.city.match(/pipeline|bali|byron bay|gold coast|bondi|tofino|tamarindo|nosara|rincon|jeffreys bay/i)
    ? 'This is a SURF destination — surfing MUST be the centerpiece of the plan. '
    : request.city.match(/patagonia|annapurna|kilimanjaro|appalachian|camino|dolomites/i)
    ? 'This is a HIKING destination — hiking/trekking MUST be the centerpiece of the plan. '
    : '';

  const fullUserMessage = `${userParts.join('. ')}

Here is today's real-time data for your itinerary:

${dataSections.join('\n\n')}

---

Now write the full itinerary. ${activityHint}MANDATORY CHECKLIST — write these sections IN THIS ORDER:
1. Time-of-day sections (Morning/Afternoon/Evening) with real places and prices
2. ## Estimated Total — cost breakdown + **Pro Tips:** with 2-4 insider tips at the bottom
3. ## Your Hotel — ONE accommodation with price and a 2-3 sentence review
You MUST write all 3. Do NOT stop early.

CRITICAL: For ALL specific venue names — ONLY use data from the Restaurants and Attractions sections above. These are verified open via Google Places. Do NOT use specific bar/venue names from Happy Hours or Events — that data may be outdated. Do NOT add ANY venues from your own knowledge. The ONLY exceptions are public parks and outdoor infrastructure that cannot close.`;

  const messages: any[] = [
    { role: 'system', content: buildSystemPrompt(request) },
    { role: 'user', content: fullUserMessage }
  ];

  const dedalus = getClient();

  try {
    // Single LLM call — stream the itinerary directly
    let contentReceived = false;
    let tokenBudget = isMultiDay ? Math.min(request.days! * 4000, 16000) : 12000;
    if (timeRemaining() < 25_000) {
      tokenBudget = Math.min(tokenBudget, 8000);
      console.log(`[Dedalus] Reduced token budget to ${tokenBudget} due to time pressure`);
    }

    const maxAttempts = timeRemaining() > 35_000 ? 2 : 1;

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const isRetry = attempt > 0;
      if (isRetry) {
        console.log('[Dedalus] Retry: Non-streaming fallback...');
        yield { type: 'thinking_chunk', thinking: 'Generating itinerary (retry)...' };
      } else {
        console.log('[Dedalus] Streaming itinerary (single LLM call)...');
      }

      if (!isRetry) {
        const stream = await dedalus.chat.completions.create({
          model: 'anthropic/claude-sonnet-4-5',
          messages,
          stream: true,
          temperature: 0.7,
          max_tokens: tokenBudget
        });

        let outputTokens = 0;
        for await (const chunk of stream) {
          const delta = chunk.choices?.[0]?.delta;
          const content = delta?.content;

          if (content) {
            contentReceived = true;
            outputTokens += Math.ceil(content.length / 4);
            yield { type: 'content_chunk', content };
          }

          if (chunk.choices?.[0]?.finish_reason) {
            const reason = chunk.choices[0].finish_reason;
            console.log(`[Dedalus] Stream finished: ${reason} | ~${outputTokens} tokens | ${elapsed()}ms total`);
            if (reason === 'length') {
              console.warn(`[Dedalus] OUTPUT TRUNCATED — hit max_tokens (${tokenBudget})`);
            }
            break;
          }
        }
      } else {
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
        }
      }

      if (contentReceived) break;
    }

    if (!contentReceived) {
      yield { type: 'error', error: 'Failed to generate itinerary after retrying. Please try again.' };
      return;
    }

    console.log(`[Dedalus] Total time: ${elapsed()}ms`);
    yield { type: 'done' };
  } catch (error) {
    console.error('[Dedalus] Stream error:', error);
    yield {
      type: 'error',
      error: error instanceof Error ? error.message : 'Failed to generate plan'
    };
  }
}
