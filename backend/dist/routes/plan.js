"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const dedalus_1 = require("../services/dedalus");
const youtube_1 = require("../services/apis/youtube");
const router = (0, express_1.Router)();
// Feature → required tier mapping for error messages
const FEATURE_TIER = {
    multiDay: 'starter',
    recurring: 'pro',
    antiRoutine: 'pro',
    dateNight: 'pro',
    dietary: 'pro',
    accessible: 'pro',
    mood: 'pro',
    energy: 'pro',
};
/**
 * POST /api/plan
 * Server-Sent Events endpoint for streaming plan generation
 */
router.post('/plan', async (req, res) => {
    const { city, interests, budget, mood, currentHour, energyLevel, dietary, accessible, dateNight, antiRoutine, pastPlaces, recurring, rightNow, days } = req.body;
    // Validate input
    if (!city) {
        return res.status(400).json({ error: 'City is required' });
    }
    if (!Array.isArray(interests)) {
        return res.status(400).json({ error: 'Interests must be an array' });
    }
    if (days !== undefined) {
        const numDays = Number(days);
        if (!Number.isInteger(numDays) || numDays < 1 || numDays > 7) {
            return res.status(400).json({ error: 'Days must be an integer between 1 and 7' });
        }
    }
    // Feature gate checks
    const features = req.features || new Set();
    const gatedChecks = [
        [days && Number(days) > 1, 'multiDay'],
        [recurring, 'recurring'],
        [antiRoutine, 'antiRoutine'],
        [dateNight, 'dateNight'],
        [dietary && dietary.length > 0, 'dietary'],
        [accessible, 'accessible'],
        [mood, 'mood'],
        [energyLevel, 'energy'],
    ];
    for (const [isUsed, feature] of gatedChecks) {
        if (isUsed && !features.has(feature)) {
            return res.status(403).json({
                error: 'feature_locked',
                feature,
                requiredTier: FEATURE_TIER[feature] || 'pro',
            });
        }
    }
    console.log(`[SSE] Starting stream for city: ${city}, interests: ${interests.join(', ')}${days > 1 ? `, days: ${days}` : ''}`);
    // Track client disconnect so we can stop the generator
    // IMPORTANT: Listen on `res` not `req` — req 'close' fires when the POST body
    // is fully consumed, which happens immediately after express.json() parses it.
    // res 'close' fires when the actual TCP connection drops.
    let clientDisconnected = false;
    res.on('close', () => {
        clientDisconnected = true;
        console.log('[SSE] Client disconnected');
    });
    // Set up Server-Sent Events headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.status(200);
    res.flushHeaders();
    // Send initial connection confirmation
    res.write('data: {"type":"connected"}\n\n');
    try {
        const stream = (0, dedalus_1.streamPlanGeneration)({ city, interests, budget, mood, currentHour, energyLevel, dietary, accessible, dateNight, antiRoutine, pastPlaces, recurring, rightNow, days });
        for await (const event of stream) {
            if (clientDisconnected)
                break;
            try {
                const data = JSON.stringify(event);
                res.write(`data: ${data}\n\n`);
            }
            catch (writeErr) {
                console.error('[SSE] Write failed:', writeErr);
                break;
            }
            console.log(`[SSE] Event sent:`, event.type);
            if (event.type === 'error' || event.type === 'done') {
                break;
            }
        }
        res.end();
        console.log('[SSE] Stream ended');
    }
    catch (error) {
        console.error('[SSE] Stream error:', error);
        if (!clientDisconnected) {
            const errorEvent = {
                type: 'error',
                error: error instanceof Error ? error.message : 'Unknown error occurred'
            };
            res.write(`data: ${JSON.stringify(errorEvent)}\n\n`);
            res.end();
        }
    }
});
/**
 * GET /api/youtube-search?q=query
 * Returns { videoId, title } for the top YouTube result, or { videoId: null } on failure.
 */
router.get('/youtube-search', async (req, res) => {
    const q = req.query.q;
    if (!q) {
        return res.status(400).json({ error: 'Query parameter "q" is required' });
    }
    try {
        const result = await (0, youtube_1.searchYouTubeVideo)(q);
        res.json(result || { videoId: null, title: null });
    }
    catch (error) {
        console.error('[YouTube Search] Error:', error);
        res.json({ videoId: null, title: null });
    }
});
exports.default = router;
