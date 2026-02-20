import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';
import { exploreSearch } from '../backend/dist/services/explore';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  // Auth (soft — allow unauthenticated)
  const authHeader = req.headers.authorization;
  let userId: string | null = null;
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const token = authHeader.slice(7);
      const { data: { user } } = await supabase.auth.getUser(token);
      if (user) userId = user.id;
    } catch {}
  }

  const { query, location } = req.body || {};
  if (!query || typeof query !== 'string' || !query.trim()) {
    return res.status(400).json({ error: 'Query is required' });
  }
  if (!location || typeof location !== 'string' || !location.trim()) {
    return res.status(400).json({ error: 'Location is required' });
  }

  console.log(`[Explore-standalone] user=${userId} query="${query.trim()}" location="${location.trim()}"`);

  try {
    const result = await exploreSearch(query.trim(), location.trim());
    return res.json(result);
  } catch (err: any) {
    console.error('[Explore-standalone] Error:', err);
    return res.status(500).json({ error: err.message || 'Search failed' });
  }
}
