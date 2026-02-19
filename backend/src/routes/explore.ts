import { Router, Request, Response } from 'express';
import { exploreSearch } from '../services/explore';

const router = Router();

/**
 * POST /api/explore
 * Search for places using Google Places API + AI summaries
 */
router.post('/explore', async (req: Request, res: Response) => {
  const { query, location } = req.body;

  if (!query || typeof query !== 'string' || query.trim().length === 0) {
    return res.status(400).json({ error: 'Query is required' });
  }

  if (!location || typeof location !== 'string' || location.trim().length === 0) {
    return res.status(400).json({ error: 'Location is required' });
  }

  if (!process.env.GOOGLE_PLACES_API_KEY) {
    return res.status(503).json({ error: 'Google Places API not configured' });
  }

  console.log(`[Explore] Searching: "${query.trim()}" in "${location.trim()}"`);

  try {
    const results = await exploreSearch(query.trim(), location.trim());
    console.log(`[Explore] Found ${results.length} results`);
    res.json({ results });
  } catch (err) {
    console.error('[Explore] Error:', err);
    res.status(500).json({
      error: err instanceof Error ? err.message : 'Failed to search places',
    });
  }
});

export default router;
