/**
 * YouTube video search — scrapes YouTube search results server-side.
 * No API key needed. Extracts video IDs from ytInitialData in the HTML.
 * Picks the best result by scoring on views, duration, title quality,
 * channel signals, and content type — strongly favors popular, high-
 * production travel content from established creators.
 */

interface VideoResult {
  videoId: string;
  title: string;
}

async function fetchWithTimeout(url: string, headers: Record<string, string>, timeoutMs = 5000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal, headers });
  } finally {
    clearTimeout(timer);
  }
}

/** Parse view count text like "1.2M views" or "450K views" into a number */
function parseViewCount(text?: string): number {
  if (!text) return 0;
  const match = text.match(/([\d,.]+)\s*([KMB]?)/i);
  if (!match) return 0;
  const num = parseFloat(match[1].replace(/,/g, ''));
  const suffix = (match[2] || '').toUpperCase();
  if (suffix === 'B') return num * 1_000_000_000;
  if (suffix === 'M') return num * 1_000_000;
  if (suffix === 'K') return num * 1_000;
  return num;
}

/** Parse "X years/months/weeks/days ago" into approximate age in years */
function parseAge(text?: string): number | null {
  if (!text) return null;
  const match = text.match(/(\d+)\s+(second|minute|hour|day|week|month|year)s?\s+ago/i);
  if (!match) return null;
  const num = parseInt(match[1]);
  const unit = match[2].toLowerCase();
  if (unit === 'year') return num;
  if (unit === 'month') return num / 12;
  if (unit === 'week') return num / 52;
  if (unit === 'day') return num / 365;
  return 0; // hours/minutes/seconds = brand new
}

/** Parse duration text like "12:34" into seconds */
function parseDuration(text?: string): number {
  if (!text) return 0;
  const parts = text.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] || 0;
}

// Generic filler words that should NOT count as relevance signals.
// Without this, a query like "cornell things to do" would match any video
// with "things" in the title, even if it has nothing to do with Cornell.
const FILLER_WORDS = new Set([
  'things', 'to', 'do', 'in', 'the', 'a', 'an', 'of', 'for', 'and', 'or',
  'best', 'top', 'most', 'travel', 'guide', 'visit', 'tour', 'vlog',
  'review', 'trip', 'day', 'walk', 'food', 'see', 'go', 'how', 'what',
  'where', 'with', 'from', 'your', 'our', 'my', 'this', 'that', 'are',
  'can', 'will', 'all', 'new', 'city', 'town', 'place', 'places',
]);

// ── Title keyword patterns ──────────────────────────────────────────

// Strong signals of high-production travel/visual content
const QUALITY_KEYWORDS = /\b(4k|8k|uhd|hdr|cinematic|walking tour|walk(?:ing)?\s*through|drone|aerial|timelapse|time.lapse|travel guide|city guide|food tour|food guide|travel vlog|guide to|visit|places to|things to do|things to see|what to do|must.see|must.visit|hidden gem|complete guide|virtual tour|night walk|night life|sunset|sunrise|street food|best restaurants|where to eat|top \d+|best of|review|first time|solo travel|budget travel|luxury|michelin|local guide)\b/i;

// Irrelevant or low-quality content — hard reject
const PENALTY_KEYWORDS = /\b(reaction|reacts?|prank|challenge|mukbang|unbox(?:ing)?|haul|drama|worst|fail|gone wrong|not clickbait|storytime|podcast|interview|debate|ranking every|tier list|live stream|livestream|shorts|tiktok|compilation|meme|funny|cringe|exposed|canceled|cancelled|apology|rant|vent|asmr|gameplay|playthrough|let'?s play|blippi|cocomelon|peppa|paw patrol|sesame street|kids|for children|educational.*kids|nursery rhyme|cartoon|countdown|ball drop|new year'?s eve)\b/i;

// Entertainment/celebrity content — not place-discovery content
const ENTERTAINMENT_KEYWORDS = /\b(conan|colbert|fallon|kimmel|oliver|seth meyers|late night|late show|talk show|tonight show|snl|saturday night|comedy|stand.?up|comedian|movie|trailer|film|tv show|series|episode|season \d|music video|official video|lyric video|full album|concert|performance|awards?|oscars?|grammy|emmy|netflix|hulu|disney|hbo|amazon prime|broadway cast|original cast|musical|soundtrack|karaoke|sing along|lyrics?|remix|cover song|acoustic version)\b/i;

// News/current-affairs/disaster content — not what we want for place discovery
const NEWS_KEYWORDS = /\b(breaking|news|update|report|arrest|crime|accident|protest|election|politic|court|lawsuit|scandal|controversy|investigation|flood(?:ing|ed)?|earthquake|tsunami|hurricane|tornado|cyclone|disaster|devastat|collaps|demolish|destroy|prime minister|president visit|state visit|official visit|inaugurat|summit|parliament|congress)\b/i;

// ── Channel-level signals ───────────────────────────────────────────

// Known high-quality travel/food/review channels — strong bonus
const QUALITY_CHANNELS = new Set([
  // Travel
  'mark wiens', 'kara and nate', 'drew binsky', 'rick steves',
  'lonely planet', 'the bucket list family', 'lost leblanc', 'yes theory',
  'nas daily', 'jacob + katie schwarz', 'the endless adventure',
  'wolters world', 'tangerine travels', 'samuel and audrey',
  'hopscotch the globe', 'Gabriel Traveler', 'vagabrothers',
  'indigo traveller', 'peter santenello', 'bald and bankrupt',
  'kurt caz', 'sailing la vagabonde', 'eva zu beck',
  'mr ben brown', 'fun fun function', 'jason billam',
  'simon wilson', 'karl watson', 'travel beans',
  // Food
  'best ever food review show', 'strictly dumpling', 'mike chen',
  'mikey chen', 'the food ranger', 'davidsbeenhere',
  'pro home cooks', 'joshua weissman', 'babish culinary universe',
  'adam ragusea', 'j. kenji lópez-alt', 'beryl shereshewsky',
  'mark wiens', 'luke martin', 'settime',
  // Walking tours / visual
  'watched walker', '4k urban life', 'wanna walk', 'prowalk tours',
  'actionkid', 'wanderlust travel videos', 'tourister',
  'bucket list traveller', 'turn right',
  // General quality lifestyle / review
  'wendover productions', 'half as interesting', 'geography now',
  'bright sun films', 'tom scott', 'johnny harris',
  'not just bikes', 'city beautiful', 'b1m',
]);

// Known news/media channels — penalty
const NEWS_CHANNELS = new Set([
  'cnn', 'bbc', 'bbc news', 'fox news', 'msnbc', 'nbc news',
  'abc news', 'cbs news', 'sky news', 'al jazeera',
  'the guardian', 'vice news', 'cnbc', 'bloomberg',
  'reuters', 'associated press', 'ap archive',
  'the new york times', 'washington post', 'usa today',
  'new york post', 'daily mail', 'the sun', 'the telegraph',
  'fox business', 'newsmax', 'one america news',
  'inside edition', 'entertainment tonight', 'access hollywood',
  'tmz', 'e! news', 'good morning america', 'today',
  'the view', 'pbs newshour', 'cbc news',
]);

/**
 * Score a video candidate. Relevance (does the title match the query?)
 * is the dominant signal, with view count as a secondary quality indicator.
 * This ensures small-town content beats big-city travel vlogs.
 */
function scoreCandidate(
  c: { title: string; views: number; durationSec: number; isVerified: boolean; channel: string; ageYears: number | null },
  position: number,
  poolSize: number,
  query: string
): number {
  let score = 0;
  const titleLower = c.title.toLowerCase();

  // ── Title relevance (dominant factor) ─────────────────────────
  // The first non-filler term is the primary place name — it's the most
  // important signal. Secondary terms (region, state) help but aren't enough.
  const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2 && !FILLER_WORDS.has(t));
  if (queryTerms.length > 0) {
    // Primary place name must be in title for any relevance points
    if (titleLower.includes(queryTerms[0])) {
      const matched = queryTerms.filter(t => titleLower.includes(t));
      const relevance = matched.length / queryTerms.length;
      score += relevance * 20; // up to 20 points for full match
    }
    // No points if the primary place name isn't in the title at all
  }

  // ── View count (quality signal) ─────────────────────────────
  // Popular videos are generally better, but good niche content
  // (50K-500K views) is common for smaller destinations.
  if (c.views >= 10_000_000) {
    score += 25;                       // 10M+ — viral, top-tier
  } else if (c.views >= 5_000_000) {
    score += 20;                       // 5M+ — extremely popular
  } else if (c.views >= 1_000_000) {
    score += 14;                       // 1M+ — very popular
  } else if (c.views >= 500_000) {
    score += 8;                        // 500K+ — solid
  } else if (c.views >= 100_000) {
    score += 4;                        // 100K+ — decent niche content
  } else if (c.views >= 50_000) {
    score += 1;                        // 50K+ — minimum quality bar
  }

  // ── Channel quality signals ───────────────────────────────────
  const channelLower = c.channel.toLowerCase();

  // Known quality travel/food channels — strong bonus
  if (QUALITY_CHANNELS.has(channelLower)) {
    score += 12;
  }

  // Known news/media channels — hard penalty
  if (NEWS_CHANNELS.has(channelLower)) {
    score -= 20;
  }

  if (c.isVerified) {
    score += 3;
  }

  // ── Duration sweet spot ───────────────────────────────────────
  // 3-20 minutes is the sweet spot for travel/food/guide videos
  if (c.durationSec > 0) {
    if (c.durationSec >= 180 && c.durationSec <= 1200) {
      score += 3; // 3-20 min — ideal
    } else if (c.durationSec >= 60 && c.durationSec <= 1800) {
      score += 1; // 1-30 min — acceptable
    } else {
      score -= 3; // too short or too long
    }
  }

  // ── Title quality signals ─────────────────────────────────────
  if (QUALITY_KEYWORDS.test(c.title)) {
    score += 8;
  }

  if (PENALTY_KEYWORDS.test(c.title)) {
    score -= 12;
  }

  if (NEWS_KEYWORDS.test(c.title)) {
    score -= 8;
  }

  // Entertainment/celebrity content — penalize hard, these dominate on views
  if (ENTERTAINMENT_KEYWORDS.test(c.title) || ENTERTAINMENT_KEYWORDS.test(c.channel)) {
    score -= 15;
  }

  // Channel name contains "news" or "media" (catch channels not in the explicit list)
  if (/\bnews\b/i.test(c.channel) || /\bmedia\b/i.test(c.channel)) {
    score -= 10;
  }

  // Clickbait/sensational titles — not the calm, informative travel content we want
  if (/\b(craziest|insane|extreme|shocking|unbelievable|you won'?t believe|mind.?blow|jaw.?drop|gone wrong|impossible|alive)\b/i.test(c.title)) {
    score -= 6;
  }

  // Penalize all-caps titles (clickbait signal)
  const words = c.title.split(/\s+/).filter(w => w.length > 2);
  if (words.length > 0) {
    const capsRatio = words.filter(w => w === w.toUpperCase()).length / words.length;
    if (capsRatio > 0.5) score -= 5;
  }

  // ── Recency (upload age) ────────────────────────────────────
  // Strongly prefer recent uploads — a 13-year-old tour is stale
  if (c.ageYears !== null) {
    if (c.ageYears < 1) score += 6;        // under 1 year — fresh
    else if (c.ageYears < 2) score += 4;   // 1-2 years
    else if (c.ageYears < 3) score += 2;   // 2-3 years
    else if (c.ageYears < 5) score += 0;   // 3-5 years — neutral
    else if (c.ageYears < 8) score -= 5;   // 5-8 years — stale
    else score -= 15;                       // 8+ years — heavily penalized
  }
  // Fallback: check year in title if upload age not available
  else {
    const currentYear = new Date().getFullYear();
    const yearMatch = c.title.match(/\b(20\d{2})\b/);
    if (yearMatch) {
      const age = currentYear - parseInt(yearMatch[1]);
      if (age === 0) score += 5;
      else if (age === 1) score += 3;
      else if (age <= 3) score += 1;
      else if (age >= 6) score -= 3;
    } else {
      score -= 3; // unknown age, no year in title — mild penalty
    }
  }

  // ── Small position bonus ──────────────────────────────────────
  // YouTube's search ranking is decent, give a small nod to top results
  score += Math.max(0, (poolSize - position)) * 0.1;

  return score;
}

/**
 * Scrape YouTube search results and return scored candidates.
 * @param query - The search query (used for relevance scoring)
 * @param searchSuffix - Optional suffix appended to the YouTube search (e.g. "travel")
 * @param count - Number of top results to return (default 1)
 */
async function scrapeYouTubeSearch(query: string, searchSuffix = '', count = 1): Promise<VideoResult[]> {
  try {
    const searchQuery = searchSuffix ? `${query} ${searchSuffix}` : query;
    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(searchQuery)}`;
    const res = await fetchWithTimeout(url, {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
    });

    if (!res.ok) return [];

    const html = await res.text();
    const match = html.match(/var ytInitialData = (.+?);<\/script>/);
    if (!match) return [];

    const data = JSON.parse(match[1]);
    const contents = data?.contents?.twoColumnSearchResultsRenderer
      ?.primaryContents?.sectionListRenderer?.contents;

    if (!contents) return [];

    const items = contents[0]?.itemSectionRenderer?.contents || [];

    interface Candidate {
      videoId: string;
      title: string;
      views: number;
      durationSec: number;
      isVerified: boolean;
      channel: string;
      ageYears: number | null;
    }

    const candidates: Candidate[] = [];

    for (const item of items) {
      if (!item.videoRenderer) continue;
      const vr = item.videoRenderer;
      const videoId = vr.videoId;
      const title = vr.title?.runs?.[0]?.text || '';
      if (!videoId) continue;

      const viewText = vr.viewCountText?.simpleText || vr.viewCountText?.runs?.[0]?.text || '';
      const views = parseViewCount(viewText);
      const durationText = vr.lengthText?.simpleText || '';
      const durationSec = parseDuration(durationText);

      // Extract channel name and verified status
      const channel = vr.ownerText?.runs?.[0]?.text || '';
      const badges = vr.ownerBadges || [];
      const isVerified = badges.some((b: any) =>
        b.metadataBadgeRenderer?.style === 'BADGE_STYLE_TYPE_VERIFIED' ||
        b.metadataBadgeRenderer?.style === 'BADGE_STYLE_TYPE_VERIFIED_ARTIST'
      );

      // Extract upload age (e.g., "13 years ago")
      const publishedText = vr.publishedTimeText?.simpleText || '';
      const ageYears = parseAge(publishedText);

      candidates.push({ videoId, title, views, durationSec, isVerified, channel, ageYears });
      if (candidates.length >= 20) break;
    }

    if (candidates.length === 0) return [];

    // Filter: skip Shorts (<45s), full-length movies/docs (>45min),
    // videos under 10K views, and videos older than 8 years.
    const filtered = candidates.filter(c => {
      if (c.durationSec > 0 && (c.durationSec < 45 || c.durationSec > 2700)) return false;
      if (c.ageYears !== null && c.ageYears >= 8) return false;
      if (c.views < 10_000) return false;
      return true;
    });

    // No relaxed fallback — if nothing passes filters, return nothing.
    // A missing video is better than a bad video.
    if (filtered.length === 0) return [];

    // Score and rank
    const scored = filtered.map((c, i) => ({
      ...c,
      score: scoreCandidate(c, i, filtered.length, query)
    }));

    scored.sort((a, b) => b.score - a.score);

    // Filter: require the PRIMARY place name to appear in the title.
    // The first non-filler term is always the place name (e.g., "cornell" from
    // "Cornell Illinois things to do"). Region/state terms help YouTube's search
    // algorithm but should NOT substitute for actual place-name matching.
    // Without this, "Cornell Illinois" would match any video about Illinois.
    const terms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2 && !FILLER_WORDS.has(t));
    const relevant = terms.length > 0
      ? scored.filter(c => {
          const titleLower = c.title.toLowerCase();
          // Primary place name (first non-filler term) MUST be in the title
          return titleLower.includes(terms[0]);
        })
      : scored; // if ALL terms are filler (unlikely), fall back to full list

    // Minimum quality bar — if the best video still scores poorly, return nothing.
    const quality = relevant.filter(c => c.score >= 5);
    if (quality.length === 0) return [];

    return quality.slice(0, count).map(c => ({ videoId: c.videoId, title: c.title }));
  } catch {
    // Scraping failed
  }
  return [];
}

/** Music-specific search — finds the actual song, not travel content or tutorials */
export async function searchYouTubeMusic(query: string): Promise<VideoResult | null> {
  try {
    // Search without any suffix — the query is already "Artist - Song audio"
    const searchQuery = query;
    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(searchQuery)}`;
    const res = await fetchWithTimeout(url, {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
    });
    if (!res.ok) return null;

    const html = await res.text();
    const match = html.match(/var ytInitialData = (.+?);<\/script>/);
    if (!match) return null;

    const data = JSON.parse(match[1]);
    const contents = data?.contents?.twoColumnSearchResultsRenderer
      ?.primaryContents?.sectionListRenderer?.contents;
    if (!contents) return null;

    const items = contents[0]?.itemSectionRenderer?.contents || [];

    // Reject covers, tutorials, karaoke, reaction videos
    const MUSIC_REJECT = /\b(tutorial|lesson|how to play|piano cover|cover|karaoke|instrumental|minus one|backing track|drum cover|guitar cover|bass cover|reaction|react|reacts|live at|concert|remix|slowed|reverb|sped up|nightcore|8d audio|lofi|lo-fi|mashup|parody)\b/i;

    for (const item of items) {
      if (!item.videoRenderer) continue;
      const vr = item.videoRenderer;
      const videoId = vr.videoId;
      const title = vr.title?.runs?.[0]?.text || '';
      if (!videoId || !title) continue;

      // Skip non-music content
      if (MUSIC_REJECT.test(title)) continue;

      // Duration: songs are 1.5-10 min
      const durationSec = parseDuration(vr.lengthText?.simpleText || '');
      if (durationSec > 0 && (durationSec < 90 || durationSec > 600)) continue;

      // Basic view floor — 10K minimum
      const viewText = vr.viewCountText?.simpleText || vr.viewCountText?.runs?.[0]?.text || '';
      const views = parseViewCount(viewText);
      if (views < 10_000) continue;

      // Check embeddability
      if (await isEmbeddable(videoId)) {
        return { videoId, title };
      }
    }
  } catch { /* search failed */ }
  return null;
}

/** Single best travel-biased video (used by itinerary planner) */
export async function searchYouTubeVideo(query: string): Promise<VideoResult | null> {
  // Fetch a few candidates so we can skip non-embeddable ones
  const results = await scrapeYouTubeSearch(query, 'travel guide', 3);
  for (const r of results) {
    if (await isEmbeddable(r.videoId)) return r;
  }
  const fallback = await scrapeYouTubeSearch(query, 'travel vlog', 3);
  for (const r of fallback) {
    if (await isEmbeddable(r.videoId)) return r;
  }
  return null;
}

/**
 * Check if a video allows embedding by fetching the embed page itself.
 * Non-embeddable videos return a page containing "Video unavailable" or
 * the "playabilityStatus" with an error. oEmbed alone is unreliable —
 * many videos pass oEmbed but still block iframe playback.
 */
async function isEmbeddable(videoId: string): Promise<boolean> {
  try {
    const res = await fetchWithTimeout(
      `https://www.youtube.com/embed/${videoId}`,
      { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' },
      3000
    );
    if (!res.ok) return false;
    const html = await res.text();
    // Check for blocked playback statuses — match both escaped (\"status\")
    // and unescaped ("status") variants since YouTube's embed page uses both
    const blocked = /\\?"status\\?"\s*:\s*\\?"(ERROR|UNPLAYABLE|LOGIN_REQUIRED|CONTENT_CHECK_REQUIRED)\\?"/;
    if (blocked.test(html)) return false;
    if (html.includes('Video unavailable')) return false;
    if (/\\?"embeddable\\?"\s*:\s*false/.test(html)) return false;
    return true;
  } catch {
    return true; // assume embeddable if check fails — a missing thumbnail is worse than a rare playback error
  }
}

/** Multiple relevant videos for a topic+location */
export async function searchYouTubeVideos(query: string, count = 3): Promise<VideoResult[]> {
  // Fetch extra candidates to account for non-embeddable ones
  const candidates = await scrapeYouTubeSearch(query, '', count * 2);

  // Check embeddability in parallel
  const checks = await Promise.all(
    candidates.map(async (v) => ({ ...v, embeddable: await isEmbeddable(v.videoId) }))
  );

  return checks.filter(v => v.embeddable).slice(0, count).map(v => ({ videoId: v.videoId, title: v.title }));
}
