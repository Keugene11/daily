import Dedalus from 'dedalus-labs';
import { tools, executeToolCall } from './tools';
import { PlanRequest, StreamEvent } from '../types';

// Lazy-initialize the client so dotenv has time to load first
let client: Dedalus | null = null;

function getClient(): Dedalus {
  if (!client) {
    const apiKey = process.env.DEDALUS_API_KEY || '';
    console.log('[Dedalus] Initializing with API key:', apiKey ? `${apiKey.substring(0, 15)}...` : 'MISSING');
    client = new Dedalus({ apiKey, timeout: 45000 });
  }
  return client;
}

/** Race a promise against a timeout — rejects if the promise doesn't resolve in time */
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms)
    ),
  ]);
}

function buildSystemPrompt(request: PlanRequest): string {
  const { budget, mood, currentHour, energyLevel, dietary, accessible, dateNight, antiRoutine, pastPlaces, recurring, rightNow, days } = request;

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
      `  - Where to Stay and Soundtrack appear ONCE at the end, not per-day`
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
    const nowTime = new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    const endHour = new Date(Date.now() + 2 * 60 * 60 * 1000).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
    timeSections = `## Right Now (${nowTime} - ${endHour})
[2-3 specific things the user can do RIGHT NOW or within the next 2 hours. Focus on what's immediately available — no "later today" suggestions. Include walk-in-friendly places, things that don't need reservations, and whatever is open/happening at this exact moment.]

## Quick Bite
[One fast, nearby food recommendation that's open right now — could be a restaurant, food truck, café, or street food. Include specific dish to order.]`;
    extras.push(`- **RIGHT NOW MODE**: The user wants to know what they can do IMMEDIATELY — in the next 2 hours. Do NOT plan a full day. Be ultra-specific about timing: "open right now until 8 PM", "starts in 45 minutes", "happy hour ends at 7 PM". Only suggest places that are OPEN and things that are HAPPENING right now or very soon. Keep it short and actionable — this is not a full itinerary, it's a quick "here's what to do right now" guide.`);
  }

  // Multi-day vacation: override timeSections with day-level structure
  if (days && days > 1) {
    const start = new Date();
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

  const now = new Date();
  const dayOfWeek = now.toLocaleDateString('en-US', { weekday: 'long' });
  const fullDate = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return `You are a fun, enthusiastic local concierge who knows the destination the user is asking about intimately — the neighborhoods, the hidden gems, the best food spots, the local culture. If the user gives a country, state, or region instead of a specific city, pick the best city or area within that destination for an amazing day trip and plan around it. Plan their perfect day.

TODAY IS: ${fullDate}
Day of the week: ${dayOfWeek}
This is important! Many events, free museum days, deals, and specials are day-specific. The tools will return ONLY what's available today — highlight day-specific finds prominently (e.g., "Since it's ${dayOfWeek}, MoMA is FREE tonight!" or "Today's ${dayOfWeek} deal: $1 tacos at...").

IMPORTANT RULES:
1. You MUST call tools before writing any itinerary. Call ALL of these in your FIRST response: get_weather, get_local_events, get_restaurant_recommendations, get_playlist_suggestion, get_free_stuff, get_deals_coupons, get_happy_hours, get_accommodations. Also call get_sunrise_sunset, get_pollen_count, and others as relevant. The more tools you call, the richer the plan. NEVER skip the playlist or accommodations tools.
2. Tools give you structured data, but YOU are the expert. If a tool returns generic/placeholder data, REPLACE it with real places you know. Never recommend a restaurant called "Local Favorite Grill" or an event called "Community Art Walk" — use actual real places, real restaurant names, real landmarks, and real neighborhoods that exist in that city.
3. Every recommendation must be a REAL place that actually exists. Use real street names, real neighborhoods, real venue names. You have extensive knowledge of cities worldwide — use it.

Available tools (call all that are relevant):
- get_weather: Always call this. Use the data for practical advice.
- get_local_events: City events and activities — DAY-AWARE, only returns events for today's day of the week. Check the todayHighlights array for day-specific finds!
- get_restaurant_recommendations: Dining options. Supplement with your own knowledge of the city's best food.
- get_playlist_suggestion: City-themed music. Always pass the city name.
- get_trending_news: Current headlines for conversation starters.
- get_random_activity: Fun wildcard suggestion.
- get_free_stuff: Free activities available TODAY — DAY-AWARE, filters to today's day. Highlight the todayHighlights prominently (e.g., "Since it's ${dayOfWeek}, you can get into MoMA for FREE!").
- get_deals_coupons: Deals and discounts — DAY-AWARE, shows only today's deals. Highlight todayDeals prominently (e.g., "It's Taco Tuesday — $1 tacos at...").
- get_sunrise_sunset: Golden hour timing for photo spots and sunset activities.
- get_happy_hours: Bar specials for evening planning.
- get_pollen_count: Allergy warnings for outdoor plans.
- get_wait_times: Queue estimates for popular attractions.
- get_parking: Parking info if driving activities are involved.
- get_gas_prices: Fuel costs for road trip/driving plans.
- get_public_transit_routes: Step-by-step transit directions.
- get_transit_estimates: Travel time estimates between locations.
- get_accommodations: Where to stay — always call this. Returns curated hotels, hostels, boutiques, and apartments with prices and neighborhoods.
- get_tech_meetups: Tech meetups, hackathons, coding events, startup networking, and coworking spaces. DAY-AWARE. Call when user interests include tech, startups, coding, AI, web dev, or similar. Highlight upcoming meetups and hackathons in the itinerary.

Structure the itinerary with these exact sections:

${timeSections}

## Where to Stay
[Include 3-4 accommodation options from get_accommodations tool data. For each: name as a clickable Google Maps link, type (hotel/hostel/boutique/apartment), price per night, neighborhood, and a one-line description highlighting what makes it special. Mix budget levels. Use the "link" field from tool data for the markdown link.]

## Soundtrack
[Include the playlist name and each track as a markdown link: [Track Title - Artist](spotifyUrl). Use the spotifyUrl from the tool data. Include the playlistUrl as an "Open in Spotify" link.]

Writing style:
- Lead each time period with a specific weather note — actual temperature in °C/°F, feels-like, rain/wind/UV warnings with practical advice ("bring an umbrella", "wear sunscreen", "bundle up").
- Name REAL restaurants with their actual cuisine, neighborhood, and a specific dish to order. Never generic names.
- Name REAL landmarks, streets, parks, and venues. Include cross-streets or neighborhoods so someone could actually find them.
- **LINKS**: EVERY venue, restaurant, event, bar, and attraction MUST be a clickable markdown link — NO EXCEPTIONS.
  - For places from tool data: copy the pre-formatted "link" or "markdownLink" field directly.
  - For places from YOUR OWN knowledge: create the link yourself as [Place Name](https://maps.google.com/?q=Place+Name,+City) (use + for spaces).
  - WRONG: https://maps.google.com/?q=Griffith%20Observatory — NEVER write a raw URL
  - WRONG: "Visit Griffith Observatory" — NEVER write a place name without a link
  - RIGHT: "Hike up to [Griffith Observatory](https://maps.google.com/?q=Griffith+Observatory,+Los+Angeles) for panoramic views"
- **EXACT PRICES ARE REQUIRED**: Always cite specific dollar/currency amounts — never say "affordable" or "cheap" without a number. Use the avgCost, dealPrice, price, and mustTry fields from tool data. Examples:
  - "$3.50/slice" not "cheap pizza"
  - "$8 craft cocktails, $5 beers" not "drink specials"
  - "Lunch for ~$12/person" not "budget-friendly"
  - "Save 45% — was $180, now $99" not "big discount"
- Weave in local tips a friend would give: "order the X, skip the Y", "sit at the bar for faster service", "the line looks long but moves fast", "cash only", etc.
- Reference deals, free activities, and golden hour timing when those tools return data. ESPECIALLY highlight day-specific finds — "Since it's [day], [venue] is free today!" or "Today's [day] deal: [deal]". These make the plan feel personalized and timely.
- Mention pollen/allergy warnings if outdoor activities are planned and levels are elevated.
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
  const MASTER_START = Date.now();
  const MASTER_LIMIT = 52000; // 52s — leave 8s buffer for Vercel's 60s limit
  const remaining = () => MASTER_LIMIT - (Date.now() - MASTER_START);

  if (!process.env.DEDALUS_API_KEY || process.env.DEDALUS_API_KEY === 'your_dedalus_api_key_here') {
    yield { type: 'error', error: 'Dedalus API key not configured.' };
    return;
  }

  // Build user message with context
  const isMultiDay = request.days && request.days > 1;
  const userParts: string[] = [
    isMultiDay
      ? `I'm planning a ${request.days}-day vacation in ${request.city}.`
      : `I'm visiting ${request.city}. Plan my day there.`
  ];
  if (request.interests.length > 0) userParts.push(`My interests are: ${request.interests.join(', ')}`);
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
    userParts.push(`Plan all ${request.days} days cohesively. Call ALL relevant tools first — weather, events, restaurants, playlist, accommodations, sunrise/sunset, free stuff, deals, and any others. Then create ${request.days} days of amazing, specific itineraries with real places. Don't repeat places across days.`);
  } else {
    userParts.push(`What should I do today? Call ALL relevant tools first — weather, events, restaurants, playlist, accommodations, sunrise/sunset, free stuff, deals, and any others that fit my interests. Then create an amazing, specific itinerary with real places.`);
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

    for (let step1Attempt = 0; step1Attempt < 3; step1Attempt++) {
      console.log(`[Dedalus] Step 1 (attempt ${step1Attempt + 1}): Requesting tool calls...`);

      const step1Timeout = Math.min(remaining() - 5000, 25000); // max 25s, leave time for later steps
      if (step1Timeout < 5000) {
        yield { type: 'error', error: 'Request timed out. Please try again.' };
        return;
      }
      const firstResponse = await withTimeout(
        dedalus.chat.completions.create({
          model: 'anthropic/claude-sonnet-4-5',
          messages,
          tools,
          tool_choice: 'auto' as any,
          temperature: 0.7,
          max_tokens: 2000
        }),
        step1Timeout,
        'Tool selection API call'
      );

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
          content: 'Please call the tools first — get_weather, get_local_events, get_restaurant_recommendations, get_playlist_suggestion, get_accommodations, get_sunrise_sunset, get_free_stuff, get_deals_coupons, and any others that are relevant. Do not respond with text — only call tools.'
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
      if (!args.city && request.city) args.city = request.city;
      toolCallInfos.push({ toolCall, toolName, args });
      yield { type: 'tool_call_start', tool: toolName, args };
    }

    // Execute ALL tools in parallel (saves 4-7 seconds vs sequential)
    const toolSettled = await Promise.allSettled(
      toolCallInfos.map(async ({ toolCall, toolName, args }) => {
        console.log(`[Dedalus] Executing tool: ${toolName}`, args);
        const result = await executeToolCall(toolName!, args, { rightNow: request.rightNow });
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
    const calledTools = new Set(
      assistantMessage.tool_calls
        .filter((tc: any) => tc.type === 'function')
        .map((tc: any) => tc.function?.name)
    );

    const techKeywords = ['tech', 'coding', 'startups', 'programming', 'hackathon', 'AI', 'web dev', 'software'];
    const hasTechInterest = request.interests?.some(i => techKeywords.some(k => i.toLowerCase().includes(k.toLowerCase())));

    const forceCalls: { name: string; args: Record<string, any> }[] = [];
    if (!calledTools.has('get_playlist_suggestion') && request.city) {
      forceCalls.push({ name: 'get_playlist_suggestion', args: { city: request.city, interests: request.interests || [] } });
    }
    if (!calledTools.has('get_accommodations') && request.city && !request.rightNow) {
      forceCalls.push({ name: 'get_accommodations', args: { city: request.city, budget: request.budget && request.budget !== 'any' ? request.budget : undefined } });
    }
    if (!calledTools.has('get_tech_meetups') && request.city && hasTechInterest) {
      forceCalls.push({ name: 'get_tech_meetups', args: { city: request.city, interests: request.interests || [] } });
    }

    if (forceCalls.length > 0) {
      console.log(`[Dedalus] Force-calling ${forceCalls.length} skipped tools in parallel:`, forceCalls.map(f => f.name));
      for (const fc of forceCalls) {
        yield { type: 'tool_call_start', tool: fc.name, args: fc.args };
      }

      const forceSettled = await Promise.allSettled(
        forceCalls.map(async (fc) => {
          const result = await executeToolCall(fc.name, fc.args, { rightNow: request.rightNow });
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

    yield { type: 'thinking_chunk', thinking: 'Crafting your personalized itinerary...' };

    // ── Step 3: Second API call – model synthesizes tool results into itinerary ──
    const step3Remaining = remaining();
    if (step3Remaining < 8000) {
      // Not enough time left — use non-streaming fallback with strict timeout
      console.log(`[Dedalus] Only ${step3Remaining}ms left, using fast fallback`);
      const fallbackResponse = await withTimeout(
        dedalus.chat.completions.create({
          model: 'anthropic/claude-sonnet-4-5',
          messages,
          temperature: 0.7,
          max_tokens: isMultiDay ? Math.min(request.days! * 4000, 16000) : 4000
        }),
        step3Remaining - 2000,
        'Itinerary generation (time-limited)'
      );
      const fc = fallbackResponse.choices?.[0]?.message?.content;
      if (fc) {
        for (let i = 0; i < fc.length; i += 100) {
          yield { type: 'content_chunk', content: fc.slice(i, i + 100) };
        }
        yield { type: 'done' };
      } else {
        yield { type: 'error', error: 'Failed to generate itinerary. Please try again.' };
      }
      return;
    }

    let contentReceived = false;
    const tokenBudget = isMultiDay ? Math.min(request.days! * 4000, 16000) : 4000;

    // Streaming attempt with timeout protection
    console.log(`[Dedalus] Step 3: Streaming itinerary (${step3Remaining}ms remaining)...`);
    try {
      const streamPromise = dedalus.chat.completions.create({
        model: 'anthropic/claude-sonnet-4-5',
        messages,
        stream: true,
        temperature: 0.7,
        max_tokens: tokenBudget
      });

      const stream = await withTimeout(streamPromise, Math.min(step3Remaining - 3000, 30000), 'Streaming connection');
      const streamDeadline = Date.now() + step3Remaining - 2000;

      for await (const chunk of stream) {
        if (Date.now() > streamDeadline) {
          console.log('[Dedalus] Stream deadline reached, stopping');
          break;
        }

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
    } catch (streamErr) {
      console.error('[Dedalus] Streaming failed:', streamErr);
      // If streaming failed and we have time, try non-streaming fallback
      const fallbackRemaining = remaining();
      if (!contentReceived && fallbackRemaining > 5000) {
        console.log(`[Dedalus] Trying non-streaming fallback (${fallbackRemaining}ms left)...`);
        yield { type: 'thinking_chunk', thinking: 'Generating itinerary (retry)...' };
        try {
          const fallbackResponse = await withTimeout(
            dedalus.chat.completions.create({
              model: 'anthropic/claude-sonnet-4-5',
              messages,
              temperature: 0.7,
              max_tokens: tokenBudget
            }),
            fallbackRemaining - 2000,
            'Itinerary generation (fallback)'
          );
          const fc = fallbackResponse.choices?.[0]?.message?.content;
          if (fc) {
            contentReceived = true;
            for (let i = 0; i < fc.length; i += 100) {
              yield { type: 'content_chunk', content: fc.slice(i, i + 100) };
            }
          }
        } catch (fallbackErr) {
          console.error('[Dedalus] Fallback also failed:', fallbackErr);
        }
      }
    }

    if (!contentReceived) {
      yield { type: 'error', error: 'Failed to generate itinerary. Please try again.' };
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
