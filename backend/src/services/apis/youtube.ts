/**
 * YouTube video search — scrapes YouTube search results server-side.
 * No API key needed. Extracts video IDs from ytInitialData in the HTML.
 * Picks the best result by scoring on views, duration, title quality,
 * and position relevance — prefers cinematic/tour/walkthrough content.
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

// Keywords in titles that indicate high-quality visual content
const QUALITY_KEYWORDS = /\b(4k|8k|uhd|hdr|cinematic|walking tour|walk(?:ing)?\s*through|drone|aerial|timelapse|time.lapse|travel guide|city guide|tour|explore|exploring|hidden gem|must.see|top\s*\d+|best of|complete guide|virtual tour|night walk|sunset|sunrise)\b/i;

// Keywords that indicate low-quality or irrelevant content
const PENALTY_KEYWORDS = /\b(reaction|reacts?|prank|challenge|mukbang|unbox|haul|drama|worst|fail|gone wrong|not clickbait|storytime|podcast|interview|debate|ranking every|tier list)\b/i;

// Channels/patterns that indicate listicle/compilation content (less place-specific)
const COMPILATION_KEYWORDS = /\b(top 100|every single|all \d+ |complete ranking|ranked|tier)\b/i;

/**
 * Score a video candidate based on multiple quality signals.
 * Higher score = better video for showcasing a place.
 */
function scoreCandidate(c: { title: string; views: number; durationSec: number }, position: number, poolSize: number): number {
  let score = 0;

  // Base: view count (log scale, diminishing returns)
  score += Math.log10(Math.max(c.views, 1));

  // Position relevance (YouTube ranks results well, so first results get a boost)
  score += (poolSize - position) * 0.2;

  // Duration sweet spot: 2-15 minutes is ideal for place showcase videos
  if (c.durationSec > 0) {
    if (c.durationSec >= 120 && c.durationSec <= 900) {
      score += 3; // sweet spot: 2-15 min
    } else if (c.durationSec >= 60 && c.durationSec <= 1200) {
      score += 1; // acceptable: 1-20 min
    } else {
      score -= 2; // too short or too long
    }
  }

  // Title quality signals
  const titleLower = c.title.toLowerCase();

  if (QUALITY_KEYWORDS.test(c.title)) {
    score += 4; // strong boost for quality content indicators
  }

  if (PENALTY_KEYWORDS.test(c.title)) {
    score -= 8; // strong penalty for irrelevant content
  }

  if (COMPILATION_KEYWORDS.test(c.title)) {
    score -= 2; // mild penalty for compilations
  }

  // Penalize all-caps titles (clickbait signal)
  const words = c.title.split(/\s+/);
  const capsWords = words.filter(w => w.length > 2 && w === w.toUpperCase()).length;
  if (capsWords > words.length * 0.5) {
    score -= 3;
  }

  // Boost videos with the word "walk" — walking tours are great for places
  if (/\bwalk\b/i.test(titleLower)) {
    score += 2;
  }

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

      candidates.push({ videoId, title, views, durationSec });
      if (candidates.length >= 12) break;
    }

    if (candidates.length === 0) return null;

    // Filter: skip very short (<45s, Shorts/ads) and very long (>45min, full movies/docs)
    const filtered = candidates.filter(c =>
      c.durationSec === 0 ||
      (c.durationSec >= 45 && c.durationSec <= 2700)
    );

    const pool = filtered.length > 0 ? filtered : candidates;

    // Score each candidate with multi-factor quality scoring
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
