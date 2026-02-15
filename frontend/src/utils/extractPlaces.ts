/**
 * Extract place names from plan content (shared by PlanMap and PlaceMedia).
 * Parses Google Maps links, markdown links, and bold text to find venue names.
 */
export function extractPlaces(content: string, city: string, maxResults = 10): string[] {
  // Strip everything after ## Soundtrack to avoid extracting song titles as places
  const soundtrackIdx = content.search(/##\s*Soundtrack/i);
  const mainContent = soundtrackIdx > -1 ? content.slice(0, soundtrackIdx) : content;

  // Split out "Where to Stay" section so we can guarantee accommodation places are included
  const stayIdx = mainContent.search(/##\s*Where to Stay/i);
  const itineraryContent = stayIdx > -1 ? mainContent.slice(0, stayIdx) : mainContent;
  const stayContent = stayIdx > -1 ? mainContent.slice(stayIdx) : '';

  const cityLower = city.toLowerCase();

  function extractFromText(text: string): string[] {
    const names: string[] = [];

    // From Google Maps ?q= parameters — highest quality source, extract first
    const mapsMatches = text.match(/maps\.google\.com\/?\?q=([^)\s&]+)/g) || [];
    mapsMatches.forEach(m => {
      const qMatch = m.match(/\?q=([^)\s&]+)/);
      if (qMatch) {
        const decoded = decodeURIComponent(qMatch[1].replace(/\+/g, ' ')).split(',')[0].trim();
        if (decoded.length > 2) names.push(decoded);
      }
    });

    // From [link text](url) — link text for non-generic links is a venue name
    const linkMatches = text.match(/\[([^\]]+)\]\(([^)]+)\)/g) || [];
    linkMatches.forEach(m => {
      const parts = m.match(/\[([^\]]+)\]\(([^)]+)\)/);
      if (!parts) return;
      const label = parts[1].trim();
      const url = parts[2];

      // Skip generic/non-venue link labels
      if (/^(Open in Spotify|View on Maps|View Events|View Deals|View on Yelp|Go City|TripAdvisor|Reserve on OpenTable|Watch on YouTube|View on Instagram|View on Facebook|Search|here|link|map|Link)/i.test(label)) {
        return;
      }
      // Skip links to non-map sites (Spotify, Yelp review pages, etc.)
      if (/spotify\.com|yelp\.com\/biz|tripadvisor\.com|opentable\.com|youtube\.com|instagram\.com|facebook\.com|eventbrite\.com/i.test(url)) {
        return;
      }
      names.push(label);
    });

    // From **bold** text — only if it looks like a venue name (strict filtering)
    const boldMatches = text.match(/\*\*([^*]+)\*\*/g) || [];
    boldMatches.forEach(m => {
      const name = m.replace(/\*\*/g, '').trim();
      // Skip bold text that's clearly not a venue
      if (/^(pro tip|tip|note|save|deal|free|warning|heads up|budget|cost|price)/i.test(name)) return;
      // Skip food/drink items (dish names, cuisine types)
      if (/^(the |a |an |order |try |get |grab |skip )/i.test(name)) return;
      // Skip prices and percentages
      if (/^\$|^\d|\d+%/.test(name)) return;
      // Skip time-related, transport, and generic action phrases
      if (/^(open|closed|hours|daily|cash only|reserv|book|uber|lyft|taxi|subway|walk|since it|today|tonight)/i.test(name)) return;
      // Skip if too short (likely abbreviations or noise)
      if (name.length <= 3) return;
      names.push(name);
    });

    return names;
  }

  function filterNames(names: string[]): string[] {
    return [...new Set(names)]
      .filter(p => p.length > 2 && p.length < 60)
      // Skip the city name itself — it geocodes to wrong locations
      .filter(p => p.toLowerCase() !== cityLower)
      // Skip section headings and non-venue text
      .filter(p => !p.match(/^(morning|afternoon|evening|night|soundtrack|tip|note|pro tip|free|deal|save|right now|quick bite|week \d|today|tonight|sunrise|sunset|golden hour|brunch|lunch|dinner|breakfast|where to stay|happy hour|your route)/i))
      // Skip entries starting with a digit (times like "8:00 AM")
      .filter(p => !p.match(/^\d/))
      // Skip song/artist names — they tend to have " - " in them
      .filter(p => !p.includes(' - '))
      // Skip temperature/weather mentions
      .filter(p => !p.match(/\d+°/));
  }

  // Extract accommodation places separately so they're never cut off by the limit
  const stayPlaces = filterNames(extractFromText(stayContent));
  const itineraryPlaces = filterNames(extractFromText(itineraryContent));

  // Reserve up to 4 slots for accommodations, rest for itinerary places
  const stayReserve = Math.min(stayPlaces.length, 4);
  const itineraryLimit = maxResults - stayReserve;

  // Merge: itinerary places first (capped), then accommodation places
  const merged = itineraryPlaces.slice(0, itineraryLimit);
  for (const p of stayPlaces) {
    if (!merged.includes(p)) merged.push(p);
  }

  return merged.slice(0, maxResults + stayReserve);
}
