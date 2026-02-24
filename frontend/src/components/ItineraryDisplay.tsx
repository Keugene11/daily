import React, { useRef, useState, useEffect, useMemo } from 'react';
import type { PlaceMediaData } from '../hooks/useMediaEnrichment';

interface Props {
  content: string;
  city?: string;
  days?: number;
  mediaData?: Map<string, PlaceMediaData>;
  onAddToCalendar?: () => void;
  calendarLoading?: boolean;
}

interface TimeSlot {
  period: string;
  time: string;
  content: string;
}

interface DayPlan {
  dayLabel: string;
  dayNumber: number;
  slots: TimeSlot[];
}

interface ParsedPlan {
  preamble: string;
  days: DayPlan[];
  slots: TimeSlot[];
  globalSections: TimeSlot[];
}

/** Extract a short, readable label from a raw URL */
function urlLabel(url: string): string {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    // Google Maps — extract the place name from ?q=
    if (host.includes('maps.google') || (host.includes('google.com') && u.pathname.includes('/maps'))) {
      const q = decodeURIComponent(u.searchParams.get('q') || '').replace(/\+/g, ' ');
      return q.split(',')[0].trim() || 'View on Maps';
    }

    if (host.includes('eventbrite.com')) return 'View Events';
    if (host.includes('groupon.com')) return 'View Deals';
    if (host.includes('gocity.com')) return 'Go City';
    if (host.includes('yelp.com')) return 'View on Yelp';
    if (host.includes('tripadvisor.com')) return 'TripAdvisor';
    if (host.includes('opentable.com')) return 'Reserve on OpenTable';
    if (host.includes('youtube.com') || host.includes('youtu.be')) return 'Watch on YouTube';
    if (host.includes('instagram.com')) return 'View on Instagram';
    if (host.includes('facebook.com')) return 'View on Facebook';
    if (host.includes('google.com') && u.pathname.includes('/search')) return 'Search';
    return host.replace('www.', '');
  } catch {
    // Never return a raw URL as the label — use a generic fallback
    return 'Link';
  }
}

/**
 * Pre-process content to convert any raw URLs (not already in markdown links)
 * into proper [label](url) markdown links. Uses a match-both approach instead
 * of negative lookbehind for maximum compatibility.
 */
function convertRawUrls(text: string): string {
  // Match markdown links [text](url) OR raw URLs in one pass.
  // Markdown links are consumed first and kept as-is; raw URLs are converted.
  return text.replace(
    /\[([^\]]*)\]\([^)]+\)|https?:\/\/[^\s)>\]]+/g,
    (match, linkText) => {
      // If linkText capture group exists, this matched an existing markdown link — keep it
      if (linkText !== undefined) return match;

      // Otherwise it's a raw URL — convert it to a markdown link
      const trailingMatch = match.match(/[.,;:!?]+$/);
      const cleanUrl = trailingMatch ? match.slice(0, -trailingMatch[0].length) : match;
      const trailing = trailingMatch ? trailingMatch[0] : '';
      // Sanitize label: strip [] so it can't break markdown link syntax
      const label = urlLabel(cleanUrl).replace(/[\[\]]/g, '') || cleanUrl;
      return `[${label}](${cleanUrl})${trailing}`;
    }
  );
}

/**
 * Core inline tokenizer — converts markdown links, raw URLs and optionally
 * bold into React elements. When `insideBold` is true, bold matching is
 * skipped (we're already inside a <strong>).
 */
function renderInline(text: string, insideBold = false, keyGen = { v: 0 }): React.ReactNode[] {
  // When inside bold we only look for links and raw URLs (no nested bold).
  const INNER = /\[([^\]]+)\]\(([^)]+)\)|https?:\/\/[^\s)>\]]+/g;
  // Top-level: also match bold-wrapped-link and plain bold.
  const OUTER = /\*\*\[([^\]]+)\]\(([^)]+)\)\*\*|\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*|https?:\/\/[^\s)>\]]+/g;

  const TOKEN = insideBold ? INNER : OUTER;
  const elements: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;

  while ((match = TOKEN.exec(text)) !== null) {
    if (match.index > lastIndex) {
      elements.push(text.slice(lastIndex, match.index));
    }

    if (!insideBold && match[1] !== undefined && match[2] !== undefined) {
      // Bold-wrapped link: **[text](url)**
      elements.push(
        <a key={keyGen.v++} href={match[2]} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline underline-offset-2">
          <strong className="font-semibold">{match[1].replace(/\*\*/g, '')}</strong>
        </a>
      );
    } else if (
      (!insideBold && match[3] !== undefined && match[4] !== undefined) ||
      (insideBold && match[1] !== undefined && match[2] !== undefined)
    ) {
      // Markdown link — strip ** from label
      const label = insideBold ? match[1] : match[3];
      const href = insideBold ? match[2] : match[4];
      elements.push(
        <a key={keyGen.v++} href={href} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline underline-offset-2">
          {(label || '').replace(/\*\*/g, '')}
        </a>
      );
    } else if (!insideBold && match[5] !== undefined) {
      // Bold: **text** — recursively process inner content for links/URLs
      const inner = match[5];
      elements.push(
        <strong key={keyGen.v++} className="font-semibold text-on-surface/80">
          {renderInline(inner, true, keyGen)}
        </strong>
      );
    } else {
      // Raw URL fallback — render as clickable link with a friendly label
      const rawUrl = match[0].replace(/[.,;:!?]+$/, '');
      const trailing = match[0].slice(rawUrl.length);
      elements.push(
        <a key={keyGen.v++} href={rawUrl} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline underline-offset-2">
          {urlLabel(rawUrl)}
        </a>
      );
      if (trailing) elements.push(trailing);
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    elements.push(text.slice(lastIndex));
  }

  return elements;
}

/** Find which places from the media map appear in this section's text, skipping already-shown ones.
 *  Also deduplicates by videoId — different places can return the same YouTube video. */
export function getSectionPlaces(
  sectionContent: string,
  allPlaces: string[],
  shownSet: Set<string>,
  mediaData?: Map<string, PlaceMediaData>,
  shownVideoIds?: Set<string>,
): string[] {
  const lower = sectionContent.toLowerCase();
  return allPlaces.filter(p => {
    if (shownSet.has(p)) return false;
    if (!lower.includes(p.toLowerCase())) return false;
    // Skip if this place's video was already shown for a different place
    if (mediaData && shownVideoIds) {
      const media = mediaData.get(p);
      if (media?.videoId && shownVideoIds.has(media.videoId)) {
        // Still mark the place as shown so it doesn't appear later
        shownSet.add(p);
        return false;
      }
      if (media?.videoId) shownVideoIds.add(media.videoId);
    }
    shownSet.add(p);
    return true;
  });
}

function RichText({ text }: { text: string }) {
  return <>{renderInline(text)}</>;
}


function FormattedContent({ text }: { text: string }) {
  const lines = text.split('\n');
  return (
    <>
      {lines.map((line, i) => (
        <React.Fragment key={i}>
          {i > 0 && <br />}
          <RichText text={line} />
        </React.Fragment>
      ))}
    </>
  );
}

/**
 * Renders section text at full width with media absolutely positioned to the
 * right, completely outside the text column. Text width is never affected.
 * Videos play inline when clicked. Max 1 video, 2 items total per section.
 */
function ContentWithMedia({ text, places, mediaData }: {
  text: string;
  places: string[];
  mediaData: Map<string, PlaceMediaData>;
}) {
  const [playingVideo, setPlayingVideo] = useState<string | null>(null);

  // Only show places that have a video — no static fallback cards
  const mediaItems = places.filter(p => mediaData.get(p)?.videoId).slice(0, 1);

  if (mediaItems.length === 0) {
    return <FormattedContent text={text} />;
  }

  return (
    <div>
      <FormattedContent text={text} />
      {/* Media rendered inline below text with proper spacing */}
      <div className="mt-5 flex flex-col gap-5">
        {mediaItems.map(place => {
          const media = mediaData.get(place)!;
          const isVideo = !!media.videoId;
          const isPlaying = playingVideo === place;

          if (isVideo && isPlaying) {
            return (
              <div key={place} className="rounded-xl overflow-hidden animate-fadeIn">
                <div className="relative aspect-video bg-black">
                  <iframe
                    src={`https://www.youtube.com/embed/${media.videoId}?autoplay=1&rel=0`}
                    className="absolute inset-0 w-full h-full"
                    allow="autoplay; encrypted-media"
                    allowFullScreen
                    title={place}
                  />
                </div>
              </div>
            );
          }

          if (isVideo) {
            return (
              <button
                key={place}
                onClick={() => setPlayingVideo(place)}
                className="relative w-full aspect-video bg-black cursor-pointer group block rounded-xl overflow-hidden"
              >
                <img
                  src={`https://img.youtube.com/vi/${media.videoId}/maxresdefault.jpg`}
                  alt={place}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  onError={(e) => {
                    // maxresdefault 404s on some videos — fall back to hqdefault
                    const img = e.currentTarget;
                    if (!img.src.includes('hqdefault')) {
                      img.src = `https://img.youtube.com/vi/${media.videoId}/hqdefault.jpg`;
                    }
                  }}
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-16 h-11 bg-red-600 rounded-xl flex items-center justify-center opacity-90 group-hover:opacity-100 group-hover:bg-red-500 transition-all">
                    <svg className="w-6 h-6 text-white ml-0.5" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  </div>
                </div>
              </button>
            );
          }

        })}
      </div>
    </div>
  );
}

// Pure parsing functions — defined outside component to avoid recreation on every render
function parseSections(text: string): TimeSlot[] {
  const slots: TimeSlot[] = [];
  const sections = text.split(/##\s+/);
  sections.shift();
  sections.forEach(section => {
    const match = section.match(/^([^\n(]+?)\s*(?:\(([^)]+)\))?\s*\n([\s\S]*)/);
    if (match) {
      slots.push({ period: match[1].trim(), time: match[2] || '', content: match[3].trim() });
    }
  });
  return slots;
}

function parseItinerary(text: string): ParsedPlan {
  const hasMultipleDays = /^# Day \d/m.test(text);

  if (!hasMultipleDays) {
    const sections = text.split(/##\s+/);
    const preamble = (sections.shift() || '').trim();
    const slots: TimeSlot[] = [];
    sections.forEach(section => {
      const match = section.match(/^([^\n(]+?)\s*(?:\(([^)]+)\))?\s*\n([\s\S]*)/);
      if (match) {
        slots.push({ period: match[1].trim(), time: match[2] || '', content: match[3].trim() });
      }
    });
    return { preamble, days: [], slots, globalSections: [] };
  }

  const dayChunks = text.split(/^# /m);
  const preamble = (dayChunks.shift() || '').trim();
  const parsedDays: DayPlan[] = [];
  const globalSections: TimeSlot[] = [];

  for (const chunk of dayChunks) {
    const headerMatch = chunk.match(/^(Day \d+[^\n]*)\n([\s\S]*)/);
    if (!headerMatch) continue;

    const dayLabel = headerMatch[1].trim();
    const dayNumberMatch = dayLabel.match(/Day (\d+)/);
    const dayNumber = dayNumberMatch ? parseInt(dayNumberMatch[1]) : 0;
    const dayContent = headerMatch[2];

    const allSlots = parseSections(dayContent);
    const daySlots: TimeSlot[] = [];

    for (const slot of allSlots) {
      if (/^(where to stay|your hotel|estimated total)$/i.test(slot.period)) {
        globalSections.push(slot);
      } else {
        daySlots.push(slot);
      }
    }

    if (daySlots.length > 0) {
      parsedDays.push({ dayLabel, dayNumber, slots: daySlots });
    }
  }

  const afterLastDay = text.match(/(?:^|\n)## (Where to Stay|Your Hotel|Estimated Total)\s*(?:\(([^)]*)\))?\s*\n([\s\S]*?)(?=\n## |\n# |$)/gi);
  if (afterLastDay) {
    for (const match of afterLastDay) {
      const m = match.match(/## ([^\n(]+?)(?:\s*\(([^)]*)\))?\s*\n([\s\S]*)/);
      if (m) {
        const period = m[1].trim();
        if (!globalSections.some(s => s.period.toLowerCase() === period.toLowerCase())) {
          globalSections.push({ period, time: m[2] || '', content: m[3].trim() });
        }
      }
    }
  }

  return { preamble, days: parsedDays, slots: [], globalSections };
}

export const ItineraryDisplay: React.FC<Props> = ({ content, mediaData, onAddToCalendar, calendarLoading }) => {
  const ref = useRef<HTMLDivElement>(null);
  // Track places and videoIds already shown so each appears only once across all sections
  const shownPlacesRef = useRef<Set<string>>(new Set());
  const shownVideoIdsRef = useRef<Set<string>>(new Set());
  const [selectedDay, setSelectedDay] = useState(0);
  const prevContentRef = useRef(content);

  // Reset selected day when a new plan starts (content goes empty)
  useEffect(() => {
    if (!content && prevContentRef.current) {
      setSelectedDay(0);
    }
    prevContentRef.current = content;
  }, [content]);

  // Memoize content parsing — only re-parse when content changes, not on every re-render
  const { processed, parsed } = useMemo(() => {
    // Strip hidden CALENDAR_EVENTS JSON block before parsing/display
    const stripped = content.replace(/<!--\s*CALENDAR_EVENTS\s*\n[\s\S]*?\n\s*-->/g, '').trim();
    const p = convertRawUrls(stripped);
    return { processed: p, parsed: parseItinerary(p) };
  }, [content]);

  const hasDayParsing = parsed.days.length > 0;
  const showDayTabs = parsed.days.length > 1;

  // Reset shown places/videos each render so dedup is fresh for new content
  shownPlacesRef.current.clear();
  shownVideoIdsRef.current.clear();

  // Clamp selectedDay to valid range
  const activeDayIdx = showDayTabs ? Math.min(selectedDay, parsed.days.length - 1) : 0;
  const activeSlots = (hasDayParsing ? (parsed.days[activeDayIdx]?.slots || []) : parsed.slots)
    .filter(s => s.content.trim().length > 0);
  const allSlots = [...activeSlots, ...parsed.globalSections.filter(s => s.content.trim().length > 0)];

  const renderSlots = (slots: TimeSlot[], startIndex = 0) => (
    <div className="space-y-0">
      {slots.map((slot, index) => {
        const sectionPlaces = mediaData && mediaData.size > 0
          ? getSectionPlaces(slot.content, [...mediaData.keys()], shownPlacesRef.current, mediaData, shownVideoIdsRef.current)
          : [];

        return (
          <div
            key={`${slot.period}-${startIndex + index}`}
            className="animate-slideInUp"
            style={{ animationDelay: `${(startIndex + index) * 50}ms`, opacity: 0 }}
          >
            {(startIndex + index) > 0 && <div className="border-t border-on-surface/[0.06] my-0" />}
            <div className="grid grid-cols-[120px_1fr] gap-8 py-8">
              <div>
                <p className="text-sm font-medium text-on-surface/90 flex items-center gap-2">
                  {slot.period}
                </p>
                {slot.time && <p className="text-xs text-on-surface/30 mt-0.5">{slot.time}</p>}
              </div>
              <div className="text-[15px] leading-relaxed text-on-surface/60">
                {sectionPlaces.length > 0 && mediaData ? (
                  <ContentWithMedia
                    text={slot.content}
                    places={sectionPlaces}
                    mediaData={mediaData}
                  />
                ) : (
                  <FormattedContent text={slot.content} />
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );

  if (allSlots.length === 0 && content) {
    return (
      <div className="animate-fadeIn">
        <h2 className="text-2xl font-semibold tracking-tight mb-8">{hasDayParsing ? 'Your trip' : 'Your day'}</h2>
        <div className="text-[15px] leading-relaxed text-on-surface/70">
          <FormattedContent text={processed} />
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fadeIn" ref={ref}>
      <div className="flex items-center justify-between mb-10">
        <h2 className="text-2xl font-semibold tracking-tight">{hasDayParsing ? 'Your trip' : 'Your day'}</h2>
        {onAddToCalendar && (
          <button
            onClick={onAddToCalendar}
            disabled={calendarLoading}
            className="flex items-center gap-2 px-4 py-2 text-sm border border-on-surface/15 rounded-full text-on-surface/70 hover:bg-on-surface/5 hover:text-on-surface transition-colors disabled:opacity-30"
            title="Add to Google Calendar"
          >
            {calendarLoading ? (
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
              </svg>
            ) : (
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5" />
              </svg>
            )}
            Add to Calendar
            <svg className="h-3 w-3 opacity-50" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 003 8.25v10.5A2.25 2.25 0 005.25 21h10.5A2.25 2.25 0 0018 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
            </svg>
          </button>
        )}
      </div>

      {/* Preamble text (weather intro / overview before ## sections) */}
      {parsed.preamble && (
        <div className="text-[15px] leading-relaxed text-on-surface/60 mb-8">
          <FormattedContent text={parsed.preamble} />
        </div>
      )}

      {/* Day tabs for multi-day trips */}
      {showDayTabs && (
        <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
          {parsed.days.map((day, i) => (
            <button
              key={i}
              onClick={() => setSelectedDay(i)}
              className={`px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all ${
                activeDayIdx === i
                  ? 'bg-accent text-on-accent'
                  : 'border border-on-surface/15 text-on-surface/50 hover:border-on-surface/30'
              }`}
            >
              Day {day.dayNumber}
            </button>
          ))}
        </div>
      )}

      {/* Day label for multi-day */}
      {hasDayParsing && parsed.days[activeDayIdx] && (
        <p className="text-sm text-on-surface/40 mb-6">{parsed.days[activeDayIdx].dayLabel}</p>
      )}

      {/* Time slots for selected day */}
      {renderSlots(activeSlots)}

      {/* Global sections (Where to Stay, Estimated Total) — always shown */}
      {parsed.globalSections.length > 0 && renderSlots(parsed.globalSections, activeSlots.length)}
    </div>
  );
};
