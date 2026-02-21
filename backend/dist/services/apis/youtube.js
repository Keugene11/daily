"use strict";
/**
 * YouTube video search — scrapes YouTube search results server-side.
 * No API key needed. Extracts video IDs from ytInitialData in the HTML.
 * Picks the best result by scoring on views, duration, title quality,
 * channel signals, and content type — strongly favors popular, high-
 * production travel content from established creators.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.searchYouTubeVideo = searchYouTubeVideo;
exports.searchYouTubeVideos = searchYouTubeVideos;
async function fetchWithTimeout(url, headers, timeoutMs = 5000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { signal: controller.signal, headers });
    }
    finally {
        clearTimeout(timer);
    }
}
/** Parse view count text like "1.2M views" or "450K views" into a number */
function parseViewCount(text) {
    if (!text)
        return 0;
    const match = text.match(/([\d,.]+)\s*([KMB]?)/i);
    if (!match)
        return 0;
    const num = parseFloat(match[1].replace(/,/g, ''));
    const suffix = (match[2] || '').toUpperCase();
    if (suffix === 'B')
        return num * 1_000_000_000;
    if (suffix === 'M')
        return num * 1_000_000;
    if (suffix === 'K')
        return num * 1_000;
    return num;
}
/** Parse duration text like "12:34" into seconds */
function parseDuration(text) {
    if (!text)
        return 0;
    const parts = text.split(':').map(Number);
    if (parts.length === 3)
        return parts[0] * 3600 + parts[1] * 60 + parts[2];
    if (parts.length === 2)
        return parts[0] * 60 + parts[1];
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
function scoreCandidate(c, position, poolSize, query) {
    let score = 0;
    const titleLower = c.title.toLowerCase();
    // ── Title relevance (dominant factor) ─────────────────────────
    // Check how many meaningful (non-filler) query terms appear in the title.
    // A video about "Ardsley" should beat a generic "travel" video.
    const queryTerms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2 && !FILLER_WORDS.has(t));
    if (queryTerms.length > 0) {
        const matched = queryTerms.filter(t => titleLower.includes(t));
        const relevance = matched.length / queryTerms.length;
        score += relevance * 20; // up to 20 points for full match — must beat views
    }
    // ── View count (dominant quality signal) ──────────────────────
    // Popular videos are almost always better for travel content.
    // View count is the strongest signal after relevance filtering.
    if (c.views >= 10_000_000) {
        score += 25; // 10M+ — viral, top-tier
    }
    else if (c.views >= 5_000_000) {
        score += 22; // 5M+ — extremely popular
    }
    else if (c.views >= 1_000_000) {
        score += 18; // 1M+ — very popular
    }
    else if (c.views >= 500_000) {
        score += 14; // 500K+ — solid
    }
    else if (c.views >= 100_000) {
        score += 8; // 100K+ — decent
    }
    else if (c.views >= 50_000) {
        score += 3; // 50K+ — marginal
    }
    else if (c.views >= 10_000) {
        score -= 3; // under 50K: penalize
    }
    else if (c.views >= 1_000) {
        score -= 8; // under 10K: heavy penalty
    }
    else {
        score -= 15; // under 1K: near-disqualifying
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
        }
        else if (c.durationSec >= 60 && c.durationSec <= 1800) {
            score += 1; // 1-30 min — acceptable
        }
        else {
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
        if (capsRatio > 0.5)
            score -= 5;
    }
    // ── Recency bonus ───────────────────────────────────────────
    // Prefer recent content — videos mentioning recent years get a boost
    const currentYear = new Date().getFullYear();
    const yearMatch = c.title.match(/\b(20\d{2})\b/);
    if (yearMatch) {
        const videoYear = parseInt(yearMatch[1]);
        const age = currentYear - videoYear;
        if (age === 0)
            score += 5; // this year
        else if (age === 1)
            score += 3; // last year
        else if (age <= 3)
            score += 1; // recent
        else if (age >= 6)
            score -= 3; // old
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
async function scrapeYouTubeSearch(query, searchSuffix = '', count = 1) {
    try {
        const searchQuery = searchSuffix ? `${query} ${searchSuffix}` : query;
        const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(searchQuery)}`;
        const res = await fetchWithTimeout(url, {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept-Language': 'en-US,en;q=0.9',
        });
        if (!res.ok)
            return [];
        const html = await res.text();
        const match = html.match(/var ytInitialData = (.+?);<\/script>/);
        if (!match)
            return [];
        const data = JSON.parse(match[1]);
        const contents = data?.contents?.twoColumnSearchResultsRenderer
            ?.primaryContents?.sectionListRenderer?.contents;
        if (!contents)
            return [];
        const items = contents[0]?.itemSectionRenderer?.contents || [];
        const candidates = [];
        for (const item of items) {
            if (!item.videoRenderer)
                continue;
            const vr = item.videoRenderer;
            const videoId = vr.videoId;
            const title = vr.title?.runs?.[0]?.text || '';
            if (!videoId)
                continue;
            const viewText = vr.viewCountText?.simpleText || vr.viewCountText?.runs?.[0]?.text || '';
            const views = parseViewCount(viewText);
            const durationText = vr.lengthText?.simpleText || '';
            const durationSec = parseDuration(durationText);
            // Extract channel name and verified status
            const channel = vr.ownerText?.runs?.[0]?.text || '';
            const badges = vr.ownerBadges || [];
            const isVerified = badges.some((b) => b.metadataBadgeRenderer?.style === 'BADGE_STYLE_TYPE_VERIFIED' ||
                b.metadataBadgeRenderer?.style === 'BADGE_STYLE_TYPE_VERIFIED_ARTIST');
            candidates.push({ videoId, title, views, durationSec, isVerified, channel });
            if (candidates.length >= 20)
                break;
        }
        if (candidates.length === 0)
            return [];
        // Filter: skip Shorts (<45s) and full-length movies/docs (>45min)
        const filtered = candidates.filter(c => c.durationSec === 0 ||
            (c.durationSec >= 45 && c.durationSec <= 2700));
        const pool = filtered.length > 0 ? filtered : candidates;
        // Score and rank
        const scored = pool.map((c, i) => ({
            ...c,
            score: scoreCandidate(c, i, pool.length, query)
        }));
        scored.sort((a, b) => b.score - a.score);
        // Filter: require at least one meaningful (non-filler) query term in the title.
        // Without this, "cornell things to do" would match any video with "things" in it.
        const terms = query.toLowerCase().split(/\s+/).filter(t => t.length > 2 && !FILLER_WORDS.has(t));
        const relevant = terms.length > 0
            ? scored.filter(c => {
                const titleLower = c.title.toLowerCase();
                return terms.some(t => titleLower.includes(t));
            })
            : scored; // if ALL terms are filler (unlikely), fall back to full list
        return relevant.slice(0, count).map(c => ({ videoId: c.videoId, title: c.title }));
    }
    catch {
        // Scraping failed
    }
    return [];
}
/** Single best travel-biased video (used by itinerary planner) */
async function searchYouTubeVideo(query) {
    // Try "travel guide" first for higher-quality results, fall back to "travel"
    const results = await scrapeYouTubeSearch(query, 'travel guide', 1);
    if (results.length > 0)
        return results[0];
    const fallback = await scrapeYouTubeSearch(query, 'travel vlog', 1);
    return fallback[0] || null;
}
/** Check if a video allows embedding via oEmbed */
async function isEmbeddable(videoId) {
    try {
        const res = await fetchWithTimeout(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`, {}, 3000);
        return res.ok;
    }
    catch {
        return true; // assume embeddable if check fails
    }
}
/** Multiple relevant videos for a topic+location */
async function searchYouTubeVideos(query, count = 3) {
    // Fetch extra candidates to account for non-embeddable ones
    const candidates = await scrapeYouTubeSearch(query, '', count * 2);
    // Check embeddability in parallel
    const checks = await Promise.all(candidates.map(async (v) => ({ ...v, embeddable: await isEmbeddable(v.videoId) })));
    return checks.filter(v => v.embeddable).slice(0, count).map(v => ({ videoId: v.videoId, title: v.title }));
}
