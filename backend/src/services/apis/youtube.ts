/**
 * YouTube video search — scrapes YouTube search results server-side.
 * No API key needed. Extracts video IDs from ytInitialData in the HTML.
 */

interface VideoResult {
  videoId: string;
  title: string;
}

async function fetchWithTimeout(url: string, headers: Record<string, string>, timeoutMs = 8000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal, headers });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Search YouTube by scraping the search results page and extracting
 * video data from the embedded ytInitialData JSON.
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
    const video = items.find((i: any) => i.videoRenderer);

    if (!video) return null;

    const vr = video.videoRenderer;
    const videoId = vr.videoId;
    const title = vr.title?.runs?.[0]?.text || query;

    if (videoId) return { videoId, title };
  } catch {
    // Scraping failed — return null
  }
  return null;
}

export async function searchYouTubeVideo(query: string): Promise<VideoResult | null> {
  return scrapeYouTubeSearch(query);
}
