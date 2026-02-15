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

/** Parse duration text like "12:34" into seconds */
function parseDuration(text?: string): number {
  if (!text) return 0;
  const parts = text.split(':').map(Number);
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] || 0;
}

// ── Title keyword patterns ──────────────────────────────────────────

// Strong signals of high-production travel/visual content
const QUALITY_KEYWORDS = /\b(4k|8k|uhd|hdr|cinematic|walking tour|walk(?:ing)?\s*through|drone|aerial|timelapse|time.lapse|travel guide|city guide|food tour|food guide|travel vlog|guide to|visit|places to|things to do|things to see|what to do|must.see|must.visit|hidden gem|complete guide|virtual tour|night walk|night life|sunset|sunrise|street food|best restaurants|where to eat)\b/i;

// Irrelevant or low-quality content — hard reject
const PENALTY_KEYWORDS = /\b(reaction|reacts?|prank|challenge|mukbang|unbox(?:ing)?|haul|drama|worst|fail|gone wrong|not clickbait|storytime|podcast|interview|debate|ranking every|tier list|live stream|livestream|shorts|tiktok|compilation|meme|funny|cringe|exposed|canceled|cancelled|apology|rant|vent|asmr|gameplay|playthrough|let'?s play)\b/i;

// Entertainment/celebrity content — not place-discovery content
const ENTERTAINMENT_KEYWORDS = /\b(conan|colbert|fallon|kimmel|oliver|seth meyers|late night|late show|talk show|tonight show|snl|saturday night|comedy|stand.?up|comedian|movie|trailer|film|tv show|series|episode|season \d|music video|official video|lyric video|full album|concert|performance|awards?|oscars?|grammy|emmy|netflix|hulu|disney|hbo|amazon prime)\b/i;

// News/current-affairs content — not what we want for place discovery
const NEWS_KEYWORDS = /\b(breaking|news|update|report|arrest|crime|accident|protest|election|politic|court|lawsuit|scandal|controversy|investigation)\b/i;

/**
 * Score a video candidate. View count is the dominant signal —
 * popular videos from big creators are almost always better.
 */
function scoreCandidate(
  c: { title: string; views: number; durationSec: number; isVerified: boolean; channel: string },
  position: number,
  poolSize: number
): number {
  let score = 0;

  // ── View count (dominant factor) ──────────────────────────────
  // Tier-based scoring with large gaps so views actually matter.
  // A 5M-view video should almost always beat a 10K-view video.
  if (c.views >= 10_000_000) score += 20;
  else if (c.views >= 1_000_000) score += 16;
  else if (c.views >= 500_000) score += 13;
  else if (c.views >= 100_000) score += 10;
  else if (c.views >= 50_000) score += 7;
  else if (c.views >= 10_000) score += 4;
  else if (c.views >= 1_000) score += 1;
  else score -= 5; // under 1K views — likely low effort or brand new

  // ── Channel quality signals ───────────────────────────────────
  if (c.isVerified) {
    score += 4; // verified badge = established creator
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
    score += 4;
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

  // Penalize all-caps titles (clickbait signal)
  const words = c.title.split(/\s+/).filter(w => w.length > 2);
  if (words.length > 0) {
    const capsRatio = words.filter(w => w === w.toUpperCase()).length / words.length;
    if (capsRatio > 0.5) score -= 5;
  }

  // ── Small position bonus ──────────────────────────────────────
  // YouTube's search ranking is decent, give a small nod to top results
  score += Math.max(0, (poolSize - position)) * 0.1;

  return score;
}

/**
 * Search YouTube by scraping the search results page and extracting
 * video data from the embedded ytInitialData JSON.
 * Evaluates multiple results and picks the best one.
 */
async function scrapeYouTubeSearch(query: string): Promise<VideoResult | null> {
  try {
    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`;
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

    interface Candidate {
      videoId: string;
      title: string;
      views: number;
      durationSec: number;
      isVerified: boolean;
      channel: string;
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

      candidates.push({ videoId, title, views, durationSec, isVerified, channel });
      if (candidates.length >= 15) break; // evaluate more candidates
    }

    if (candidates.length === 0) return null;

    // Filter: skip Shorts (<45s) and full-length movies/docs (>45min)
    const filtered = candidates.filter(c =>
      c.durationSec === 0 ||
      (c.durationSec >= 45 && c.durationSec <= 2700)
    );

    const pool = filtered.length > 0 ? filtered : candidates;

    // Score and rank
    const scored = pool.map((c, i) => ({
      ...c,
      score: scoreCandidate(c, i, pool.length)
    }));

    scored.sort((a, b) => b.score - a.score);

    return { videoId: scored[0].videoId, title: scored[0].title };
  } catch {
    // Scraping failed — return null
  }
  return null;
}

export async function searchYouTubeVideo(query: string): Promise<VideoResult | null> {
  return scrapeYouTubeSearch(query);
}
