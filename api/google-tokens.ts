import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const token = authHeader.slice(7);
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const { provider_token, provider_refresh_token } = req.body || {};
    if (!provider_token) {
      return res.status(400).json({ error: 'Missing provider_token' });
    }

    // Google access tokens expire in 1 hour
    const expiresAt = new Date(Date.now() + 3600 * 1000).toISOString();

    await supabase.from('google_tokens').upsert({
      user_id: user.id,
      access_token: provider_token,
      refresh_token: provider_refresh_token || null,
      expires_at: expiresAt,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id' });

    return res.json({ success: true });
  } catch (err: any) {
    console.error('[GoogleTokens] Error:', err);
    return res.status(500).json({ error: err.message });
  }
}
