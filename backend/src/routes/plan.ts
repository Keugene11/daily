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
  res.setHeader('X-Accel-Buffering', 'no');
  res.status(200);
  res.flushHeaders();

  // Send initial connection confirmation
  res.write('data: {"type":"connected"}\n\n');

  try {
    const stream = streamPlanGeneration({ city, interests, budget, mood, currentHour, energyLevel, dietary, accessible, dateNight, antiRoutine, pastPlaces, recurring, rightNow, days });

    for await (const event of stream) {
      try {
        const data = JSON.stringify(event);
        res.write(`data: ${data}\n\n`);
      } catch (writeErr) {
        console.error('[SSE] Write failed:', writeErr);
        break;
      }

      if (event.type === 'error' || event.type === 'done') {
        break;
      }
    }

    res.end();
    console.log('[SSE] Stream ended');
  } catch (error) {
    console.error('[SSE] Stream error:', error);
    try {
      const errorEvent = {
        type: 'error',
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
      res.write(`data: ${JSON.stringify(errorEvent)}\n\n`);
    } catch { /* response already closed */ }
    res.end();
  }
});

/**
 * POST /api/test-plan — Run a minimal plan generation via SSE for debugging (POST to match /api/plan)
 */
router.post('/test-plan', async (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.status(200);
  res.flushHeaders();

  const city = req.body?.city || 'New York';
  const interests = req.body?.interests || ['food'];
  res.write(`data: {"n":0,"msg":"starting streamPlanGeneration","city":"${city}"}\n\n`);

  try {
    const stream = streamPlanGeneration({ city, interests });
    let count = 0;
    for await (const event of stream) {
      count++;
      const summary = event.type === 'content_chunk'
        ? { type: event.type, len: (event as any).content?.length || 0 }
        : event;
      res.write(`data: ${JSON.stringify({ n: count, event: summary })}\n\n`);
      if (count > 100 || event.type === 'error' || event.type === 'done') break;
    }
    res.write(`data: {"n":"end","total":${count}}\n\n`);
  } catch (err: any) {
    res.write(`data: {"n":"crash","error":"${err?.message || 'unknown'}"}\n\n`);
  }
  res.end();
});

/**
 * GET /api/test-sse — Verify SSE streaming works on Vercel
 */
router.get('/test-sse', (req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.status(200);
  res.flushHeaders();

  let count = 0;
  const interval = setInterval(() => {
    count++;
    res.write(`data: {"count":${count},"time":"${new Date().toISOString()}"}\n\n`);
    if (count >= 5) {
      clearInterval(interval);
      res.write(`data: {"type":"done"}\n\n`);
      res.end();
    }
  }, 1000);

  req.on('close', () => {
    clearInterval(interval);
  });
});

/**
 * GET /api/test-llm — Step-by-step diagnostic for plan generation
 */
router.get('/test-llm', async (_req: Request, res: Response) => {
  const start = Date.now();
  const steps: { step: string; ms: number; ok: boolean; detail?: string }[] = [];
  const elapsed = () => Date.now() - start;

  try {
    const Dedalus = (await import('dedalus-labs')).default;
    const apiKey = process.env.DEDALUS_API_KEY || '';
    const client = new Dedalus({ apiKey, timeout: 20000 });

    // Step 1: Simple API call (no tools)
    const s1 = Date.now();
    try {
      const r = await Promise.race([
        client.chat.completions.create({
          model: 'anthropic/claude-sonnet-4-5',
          messages: [{ role: 'user', content: 'Say hi' }],
          max_tokens: 10,
        }),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), 15000)),
      ]);
      steps.push({ step: 'simple_call', ms: Date.now() - s1, ok: true, detail: r.choices?.[0]?.message?.content || '' });
    } catch (e: any) {
      steps.push({ step: 'simple_call', ms: Date.now() - s1, ok: false, detail: e.message });
    }

    // Step 2: API call WITH tools (mimics Step 1 of plan generation)
    const { tools: toolDefs } = await import('../services/tools');
    const s2 = Date.now();
    try {
      const r = await Promise.race([
        client.chat.completions.create({
          model: 'anthropic/claude-sonnet-4-5',
          messages: [
            { role: 'system', content: 'You are a helpful assistant. Call tools to gather data.' },
            { role: 'user', content: 'I want to visit New York. Call get_weather for New York.' }
          ],
          tools: toolDefs,
          tool_choice: 'auto' as any,
          max_tokens: 500,
        }),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), 20000)),
      ]);
      const tc = r.choices?.[0]?.message?.tool_calls;
      steps.push({
        step: 'tools_call',
        ms: Date.now() - s2,
        ok: true,
        detail: `finish=${r.choices?.[0]?.finish_reason}, tool_calls=${tc?.length || 0}, names=${tc?.map((t: any) => t.function?.name).join(',') || 'none'}`
      });
    } catch (e: any) {
      steps.push({ step: 'tools_call', ms: Date.now() - s2, ok: false, detail: e.message });
    }

    // Step 3: Streaming API call
    const s3 = Date.now();
    try {
      let chunks = 0;
      let content = '';
      const stream = await Promise.race([
        client.chat.completions.create({
          model: 'anthropic/claude-sonnet-4-5',
          messages: [{ role: 'user', content: 'Write one sentence about NYC.' }],
          stream: true,
          max_tokens: 50,
        }),
        new Promise<never>((_, rej) => setTimeout(() => rej(new Error('timeout')), 15000)),
      ]);
      for await (const chunk of stream as any) {
        chunks++;
        const c = chunk.choices?.[0]?.delta?.content;
        if (c) content += c;
        if (chunks > 50 || Date.now() - s3 > 10000) break;
      }
      steps.push({ step: 'streaming', ms: Date.now() - s3, ok: true, detail: `chunks=${chunks}, content=${content.substring(0, 100)}` });
    } catch (e: any) {
      steps.push({ step: 'streaming', ms: Date.now() - s3, ok: false, detail: e.message });
    }

    res.json({ ok: true, totalMs: elapsed(), keyPrefix: apiKey.substring(0, 10), steps });
  } catch (error) {
    res.json({ ok: false, totalMs: elapsed(), error: error instanceof Error ? error.message : 'Unknown', steps });
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
