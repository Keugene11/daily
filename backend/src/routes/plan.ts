import { Router, Request, Response } from 'express';
import { streamPlanGeneration } from '../services/dedalus';
import { searchYouTubeVideo } from '../services/apis/youtube';

const router = Router();

/**
 * POST /api/plan
 * Server-Sent Events endpoint for streaming plan generation
 */
router.post('/plan', async (req: Request, res: Response) => {
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

  console.log(`[SSE] Starting stream for city: ${city}, interests: ${interests.join(', ')}${days > 1 ? `, days: ${days}` : ''}`);

  // Set up Server-Sent Events headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable buffering in nginx/Vercel
  res.status(200);
  res.flushHeaders(); // Critical for Vercel serverless — starts the stream

  // Send initial connection confirmation
  res.write('data: {"type":"connected"}\n\n');

  try {
    const stream = streamPlanGeneration({ city, interests, budget, mood, currentHour, energyLevel, dietary, accessible, dateNight, antiRoutine, pastPlaces, recurring, rightNow, days });

    for await (const event of stream) {
      // Send SSE formatted data
      const data = JSON.stringify(event);
      res.write(`data: ${data}\n\n`);

      // Flush immediately for real-time updates
      if ((res as any).flush) {
        (res as any).flush();
      }

      console.log(`[SSE] Event sent:`, event.type);

      // If error or done, end the stream
      if (event.type === 'error' || event.type === 'done') {
        break;
      }
    }

    res.end();
    console.log('[SSE] Stream ended');
  } catch (error) {
    console.error('[SSE] Stream error:', error);
    const errorEvent = {
      type: 'error',
      error: error instanceof Error ? error.message : 'Unknown error occurred'
    };
    res.write(`data: ${JSON.stringify(errorEvent)}\n\n`);
    res.end();
  }
});

/**
 * GET /api/youtube-search?q=query
 * Returns { videoId, title } for the top YouTube result, or { videoId: null } on failure.
 */
router.get('/youtube-search', async (req: Request, res: Response) => {
  const q = req.query.q as string;
  if (!q) {
    return res.status(400).json({ error: 'Query parameter "q" is required' });
  }

  try {
    const result = await searchYouTubeVideo(q);
    res.json(result || { videoId: null, title: null });
  } catch (error) {
    console.error('[YouTube Search] Error:', error);
    res.json({ videoId: null, title: null });
  }
});

export default router;
