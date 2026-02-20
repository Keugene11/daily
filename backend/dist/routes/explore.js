"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const explore_1 = require("../services/explore");
const router = (0, express_1.Router)();
/**
 * POST /api/explore
 * Search local events + Google Places (if configured) with AI summaries
 */
router.post('/explore', async (req, res) => {
    const { query, location } = req.body;
    if (!query || typeof query !== 'string' || query.trim().length === 0) {
        return res.status(400).json({ error: 'Query is required' });
    }
    if (!location || typeof location !== 'string' || location.trim().length === 0) {
        return res.status(400).json({ error: 'Location is required' });
    }
    console.log(`[Explore] Searching: "${query.trim()}" in "${location.trim()}"`);
    try {
        const { post, places, videos } = await (0, explore_1.exploreSearch)(query.trim(), location.trim());
        console.log(`[Explore] Found ${places.length} places, ${videos.length} videos, post length: ${post.length}`);
        res.json({ post, places, videos });
    }
    catch (err) {
        console.error('[Explore] Error:', err);
        res.status(500).json({
            error: err instanceof Error ? err.message : 'Failed to search places',
        });
    }
});
exports.default = router;
