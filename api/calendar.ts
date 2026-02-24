import type { VercelRequest, VercelResponse } from '@vercel/node';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

// ── Google token refresh ────────────────────────────────────────────────

async function getValidGoogleToken(userId: string): Promise<string> {
  const { data: row, error } = await supabase
    .from('google_tokens')
    .select('access_token, refresh_token, expires_at')
    .eq('user_id', userId)
    .single();

  if (error || !row) throw new Error('no_google_tokens');

  // Still valid (with 60s buffer)
  if (new Date(row.expires_at) > new Date(Date.now() + 60_000)) {
    return row.access_token;
  }

  // Need to refresh
  if (!row.refresh_token) throw new Error('no_refresh_token');

  const resp = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID || '',
      client_secret: process.env.GOOGLE_CLIENT_SECRET || '',
      refresh_token: row.refresh_token,
      grant_type: 'refresh_token',
    }),
  });

  if (!resp.ok) {
    const errBody = await resp.text();
    console.error('[Calendar] Token refresh failed:', errBody);
    throw new Error('token_refresh_failed');
  }

  const tokens = await resp.json();
  const newExpiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  await supabase.from('google_tokens').update({
    access_token: tokens.access_token,
    expires_at: newExpiresAt,
    updated_at: new Date().toISOString(),
  }).eq('user_id', userId);

  return tokens.access_token;
}

// ── Parse structured CALENDAR_EVENTS from markdown ──────────────────────

interface CalendarEvent {
  title: string;
  start: string;   // "09:00" (24h)
  end: string;      // "10:00" (24h)
  location: string;
  description: string;
  day?: number;     // for multi-day plans
}

function parseCalendarEvents(content: string): CalendarEvent[] | null {
  const match = content.match(/<!--\s*CALENDAR_EVENTS\s*\n([\s\S]*?)\n\s*-->/);
  if (!match) return null;

  try {
    const events = JSON.parse(match[1]);
    if (!Array.isArray(events) || events.length === 0) return null;
    return events;
  } catch (err) {
    console.error('[Calendar] Failed to parse CALENDAR_EVENTS JSON:', err);
    return null;
  }
}

// ── Create Google Calendar event ────────────────────────────────────────

async function createCalendarEvent(
  accessToken: string,
  summary: string,
  description: string,
  date: string,
  startTime: string,
  endTime: string,
  location: string,
  timezone: string,
): Promise<{ id: string; htmlLink: string }> {
  const startDT = `${date}T${startTime}:00`;
  const endDT = `${date}T${endTime}:00`;

  const event = {
    summary,
    description,
    location,
    start: { dateTime: startDT, timeZone: timezone },
    end: { dateTime: endDT, timeZone: timezone },
  };

  const resp = await fetch(
    'https://www.googleapis.com/calendar/v3/calendars/primary/events',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(event),
    }
  );

  if (!resp.ok) {
    const errBody = await resp.text();
    console.error('[Calendar] Event creation failed:', errBody);
    throw new Error(`calendar_api_error: ${resp.status}`);
  }

  const result = await resp.json();
  return { id: result.id, htmlLink: result.htmlLink };
}

// ── Fetch existing events for a date range ──────────────────────────────

async function getExistingEvents(
  accessToken: string,
  timeMin: string,
  timeMax: string,
  timezone: string,
): Promise<{ summary: string; startDateTime: string }[]> {
  const params = new URLSearchParams({
    timeMin,
    timeMax,
    timeZone: timezone,
    singleEvents: 'true',
    maxResults: '100',
  });

  const resp = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!resp.ok) return []; // fail open — worst case we create duplicates

  const data: any = await resp.json();
  return (data.items || []).map((e: any) => ({
    summary: e.summary || '',
    startDateTime: e.start?.dateTime || '',
  }));
}

// ── Main handler ────────────────────────────────────────────────────────

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

    const { content, city, startDate, timezone } = req.body || {};
    if (!content || !city || !startDate || !timezone) {
      return res.status(400).json({ error: 'Missing required fields: content, city, startDate, timezone' });
    }

    // Get valid Google access token
    let googleToken: string;
    try {
      googleToken = await getValidGoogleToken(user.id);
    } catch (err: any) {
      if (['no_google_tokens', 'no_refresh_token', 'token_refresh_failed'].includes(err.message)) {
        return res.status(403).json({ error: 'google_reauth_required' });
      }
      throw err;
    }

    // Parse structured calendar events from the hidden JSON block
    const events = parseCalendarEvents(content);
    if (!events || events.length === 0) {
      return res.status(400).json({ error: 'No calendar event data found in the itinerary. Try generating a new plan.' });
    }

    // Figure out the date range spanned by all events
    let maxDay = 1;
    for (const evt of events) {
      if (evt.day && evt.day > maxDay) maxDay = evt.day;
    }
    const rangeStart = new Date(startDate + 'T00:00:00');
    const rangeEnd = new Date(startDate + 'T00:00:00');
    rangeEnd.setDate(rangeEnd.getDate() + maxDay); // day after last event day

    // Fetch existing calendar events in that range to avoid duplicates
    const existing = await getExistingEvents(
      googleToken,
      rangeStart.toISOString(),
      rangeEnd.toISOString(),
      timezone,
    );

    const createdEvents: { title: string; id: string; htmlLink: string }[] = [];
    let skippedCount = 0;

    for (const evt of events) {
      // Calculate the date for this event
      const dayOffset = (evt.day || 1) - 1;
      const eventDate = new Date(startDate + 'T00:00:00');
      eventDate.setDate(eventDate.getDate() + dayOffset);
      const dateStr = eventDate.toISOString().split('T')[0];
      const startDT = `${dateStr}T${evt.start}:00`;

      // Skip if an event with the same title and start time already exists
      const isDuplicate = existing.some(e =>
        e.summary === evt.title && e.startDateTime.startsWith(startDT)
      );
      if (isDuplicate) {
        skippedCount++;
        continue;
      }

      const created = await createCalendarEvent(
        googleToken,
        evt.title,
        evt.description || '',
        dateStr,
        evt.start,
        evt.end,
        evt.location || city,
        timezone,
      );
      createdEvents.push({ title: evt.title, ...created });
    }

    if (createdEvents.length === 0 && skippedCount > 0) {
      return res.json({
        success: true,
        eventsCreated: 0,
        skipped: skippedCount,
        events: [],
        message: 'All events already exist in your calendar',
      });
    }

    return res.json({
      success: true,
      eventsCreated: createdEvents.length,
      skipped: skippedCount,
      events: createdEvents,
    });
  } catch (err: any) {
    console.error('[Calendar] Error:', err);
    if (err.message?.includes('calendar_api_error')) {
      return res.status(502).json({ error: 'Google Calendar API error' });
    }
    return res.status(500).json({ error: err.message });
  }
}
