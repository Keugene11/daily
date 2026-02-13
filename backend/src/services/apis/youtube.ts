/**
 * YouTube video search — scrapes YouTube search results server-side.
 * No API key needed. Extracts video IDs from ytInitialData in the HTML.
 * Picks the best result by filtering out shorts and preferring higher view counts.
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

    // Evaluate up to 8 video results and pick the best one
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

      // Extract view count and duration for quality scoring
      const viewText = vr.viewCountText?.simpleText || vr.viewCountText?.runs?.[0]?.text || '';
      const views = parseViewCount(viewText);
      const durationText = vr.lengthText?.simpleText || '';
      const durationSec = parseDuration(durationText);

      candidates.push({ videoId, title, views, durationSec });
      if (candidates.length >= 8) break;
    }

    if (candidates.length === 0) return null;

    // Filter: skip very short videos (<60s, likely Shorts/ads) and very long ones (>30min, likely full movies)
    const filtered = candidates.filter(c =>
      c.durationSec === 0 || // unknown duration is OK
      (c.durationSec >= 60 && c.durationSec <= 1800)
    );

    const pool = filtered.length > 0 ? filtered : candidates;

    // Score: prefer videos with more views (indicates quality/relevance)
    // but also give a small boost to earlier search results (position relevance)
    const scored = pool.map((c, i) => ({
      ...c,
      score: Math.log10(Math.max(c.views, 1)) + (pool.length - i) * 0.3
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
