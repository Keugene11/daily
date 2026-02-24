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

// ── Markdown parsing ────────────────────────────────────────────────────

interface TimeSlot {
  period: string;
  time: string;
  content: string;
}

interface DayPlan {
  dayNumber: number;
  slots: TimeSlot[];
}

function parseSections(text: string): TimeSlot[] {
  const slots: TimeSlot[] = [];
  const sections = text.split(/^##\s+/m);
  sections.shift(); // before first ##

  for (const section of sections) {
    const match = section.match(/^([^\n(]+?)\s*(?:\(([^)]+)\))?\s*\n([\s\S]*)/);
    if (match) {
      const period = match[1].trim();
      // Skip non-time sections
      if (/^(estimated total|pro tips|your hotel|where to stay)/i.test(period)) continue;
      slots.push({ period, time: match[2] || '', content: match[3].trim() });
    }
  }
  return slots;
}

function parseItinerary(text: string): { days: DayPlan[]; slots: TimeSlot[] } {
  const hasMultipleDays = /^# Day \d/m.test(text);

  if (!hasMultipleDays) {
    return { days: [], slots: parseSections(text) };
  }

  const dayChunks = text.split(/^# /m);
  dayChunks.shift();
  const days: DayPlan[] = [];

  for (const chunk of dayChunks) {
    const headerMatch = chunk.match(/^(Day (\d+)[^\n]*)\n([\s\S]*)/);
    if (!headerMatch) continue;
    const dayNumber = parseInt(headerMatch[2]);
    const daySlots = parseSections(headerMatch[3]);
    if (daySlots.length > 0) {
      days.push({ dayNumber, slots: daySlots });
    }
  }

  return { days, slots: [] };
}

// ── Time range mapping ──────────────────────────────────────────────────

function getTimeRange(period: string, timeHint: string): { startHour: number; endHour: number } {
  // Try parsing explicit time like "8am - 12pm"
  const rangeMatch = timeHint.match(/(\d{1,2})\s*(am|pm)\s*-\s*(\d{1,2})\s*(am|pm)/i);
  if (rangeMatch) {
    let startH = parseInt(rangeMatch[1]);
    let endH = parseInt(rangeMatch[3]);
    if (rangeMatch[2].toLowerCase() === 'pm' && startH !== 12) startH += 12;
    if (rangeMatch[2].toLowerCase() === 'am' && startH === 12) startH = 0;
    if (rangeMatch[4].toLowerCase() === 'pm' && endH !== 12) endH += 12;
    if (rangeMatch[4].toLowerCase() === 'am' && endH === 12) endH = 0;
    return { startHour: startH, endHour: endH };
  }

  // Fallback by period name
  const lower = period.toLowerCase();
  if (lower.includes('morning')) return { startHour: 8, endHour: 12 };
  if (lower.includes('afternoon') || lower.includes('lunch')) return { startHour: 12, endHour: 18 };
  if (lower.includes('evening') || lower.includes('night')) return { startHour: 18, endHour: 23 };
  return { startHour: 9, endHour: 12 };
}

// ── Strip markdown for calendar description ─────────────────────────────

function stripMarkdown(text: string): string {
  return text
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/^#+\s*/gm, '')
    .replace(/^[-*]\s+/gm, '- ')
    .trim();
}

// ── Create Google Calendar event ────────────────────────────────────────

async function createCalendarEvent(
  accessToken: string,
  summary: string,
  description: string,
  date: string,
  startHour: number,
  endHour: number,
  city: string,
  timezone: string,
): Promise<{ id: string; htmlLink: string }> {
  const startDT = `${date}T${String(startHour).padStart(2, '0')}:00:00`;
  const endDT = `${date}T${String(endHour).padStart(2, '0')}:00:00`;

  const event = {
    summary,
    description: description.slice(0, 8000),
    location: city,
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

    // Parse the markdown
    const parsed = parseItinerary(content);
    const createdEvents: { day: number; period: string; id: string; htmlLink: string }[] = [];

    if (parsed.days.length > 0) {
      // Multi-day plan
      for (const day of parsed.days) {
        const date = new Date(startDate + 'T00:00:00');
        date.setDate(date.getDate() + day.dayNumber - 1);
        const dateStr = date.toISOString().split('T')[0];

        for (const slot of day.slots) {
          const { startHour, endHour } = getTimeRange(slot.period, slot.time);
          const summary = `${city} — ${slot.period}`;
          const description = stripMarkdown(slot.content);
          const event = await createCalendarEvent(
            googleToken, summary, description, dateStr, startHour, endHour, city, timezone
          );
          createdEvents.push({ day: day.dayNumber, period: slot.period, ...event });
        }
      }
    } else {
      // Single-day plan
      for (const slot of parsed.slots) {
        const { startHour, endHour } = getTimeRange(slot.period, slot.time);
        const summary = `${city} — ${slot.period}`;
        const description = stripMarkdown(slot.content);
        const event = await createCalendarEvent(
          googleToken, summary, description, startDate, startHour, endHour, city, timezone
        );
        createdEvents.push({ day: 1, period: slot.period, ...event });
      }
    }

    return res.json({
      success: true,
      eventsCreated: createdEvents.length,
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
