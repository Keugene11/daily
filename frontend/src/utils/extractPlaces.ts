/**
 * Extract place names from plan content (shared by PlanMap and PlaceMedia).
 * Parses Google Maps links, markdown links, and bold text to find venue names.
 */
export function extractPlaces(content: string, city: string, maxResults = 10): string[] {
  // Strip "Where to Stay" section — hotels don't need video thumbnails
  const stayIdx = content.search(/##\s*Where to Stay/i);
  const itineraryContent = stayIdx > -1 ? content.slice(0, stayIdx) : content;

  const cityLower = city.toLowerCase();

  function extractFromText(text: string): string[] {
    const names: string[] = [];

    // From [link text](Google Maps URL) — use the link text as the clean place name.
    // Matches both old format (maps.google.com/?q=...) and new format (google.com/maps/place/...@lat,lng)
    const googleMapsLinkRegex = /\[([^\]]+)\]\(https?:\/\/(?:(?:www\.)?google\.com\/maps|maps\.google\.com)[^)]+\)/g;
    let mapsMatch;
    while ((mapsMatch = googleMapsLinkRegex.exec(text)) !== null) {
      // Replace + with space — some links use + in the display text (e.g., [Place+Name])
      const name = mapsMatch[1].replace(/\+/g, ' ').trim();
      if (name.length > 2) names.push(name);
    }

    // From [link text](url) — link text for non-generic links is a venue name
    const linkMatches = text.match(/\[([^\]]+)\]\(([^)]+)\)/g) || [];
    linkMatches.forEach(m => {
      const parts = m.match(/\[([^\]]+)\]\(([^)]+)\)/);
      if (!parts) return;
      const label = parts[1].trim();
      const url = parts[2];

      // Skip Google Maps links (already handled above)
      if (/google\.com\/maps|maps\.google\.com/i.test(url)) return;

      // Skip generic/non-venue link labels
      if (/^(Open in Spotify|View on Maps|View Events|View Deals|View on Yelp|Go City|TripAdvisor|Reserve on OpenTable|Watch on YouTube|View on Instagram|View on Facebook|Search|here|link|map|Link)/i.test(label)) {
        return;
      }
      // Skip links to non-map sites (Spotify, Yelp review pages, etc.)
      if (/yelp\.com\/biz|tripadvisor\.com|opentable\.com|youtube\.com|instagram\.com|facebook\.com|eventbrite\.com/i.test(url)) {
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

  return filterNames(extractFromText(itineraryContent)).slice(0, maxResults);
}

/**
 * Extract embedded coordinates from Google Maps URLs in the content.
 * Matches the /maps/place/Name/@lat,lng,zoom format the LLM uses.
 * Returns a map of place name → { lat, lng } for direct use without geocoding.
 */
export function extractPlaceCoords(content: string): Map<string, { lat: number; lng: number }> {
  const coords = new Map<string, { lat: number; lng: number }>();

  // Match [Name](url containing @lat,lng)
  const regex = /\[([^\]]+)\]\([^)]*@(-?\d+\.?\d*),(-?\d+\.?\d*)[^)]*\)/g;
  let match;
  while ((match = regex.exec(content)) !== null) {
    const name = match[1].trim();
    const lat = parseFloat(match[2]);
    const lng = parseFloat(match[3]);
    if (name.length > 2 && !isNaN(lat) && !isNaN(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      coords.set(name, { lat, lng });
    }
  }
  return coords;
}
