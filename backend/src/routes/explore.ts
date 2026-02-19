import { Router, Request, Response } from 'express';
import { exploreSearch } from '../services/explore';

const router = Router();

/**
 * POST /api/explore
 * Search local events + Google Places (if configured) with AI summaries
 */
router.post('/explore', async (req: Request, res: Response) => {
  const { query, location } = req.body;

  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    return res.status(400).json({ error: 'Query is required' });
  }

  if (!location || typeof location !== 'string' || location.trim().length === 0) {
    return res.status(400).json({ error: 'Location is required' });
  }

  console.log(`[Explore] Searching: "${query.trim()}" in "${location.trim()}"`);

  try {
    const { post, places, videos } = await exploreSearch(query.trim(), location.trim());
    console.log(`[Explore] Found ${places.length} places, ${videos.length} videos, post length: ${post.length}`);
    res.json({ post, places, videos });
  } catch (err) {
    console.error('[Explore] Error:', err);
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Failed to search places',
    });
  }
});

export default router;
