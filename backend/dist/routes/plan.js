"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const anthropic_1 = require("../services/anthropic");
const usage_1 = require("../middleware/usage");
const router = (0, express_1.Router)();
/**
 * POST /api/plan
 * Server-Sent Events endpoint for streaming plan generation
 */
router.post('/plan', (0, usage_1.checkUsage)('plan'), async (req, res) => {
    const { city, budget, currentHour, nightlife, timezone } = req.body;
    // Validate input
    if (!city) {
        return res.status(400).json({ error: 'City is required' });
    }
    console.log(`[SSE] Starting stream for city: ${city}`);
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
        const stream = (0, anthropic_1.streamPlanGeneration)({ city, budget, currentHour, nightlife, timezone });
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
exports.default = router;
