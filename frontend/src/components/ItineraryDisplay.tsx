import React, { useRef, useState, useEffect } from 'react';
import { InstagramCaption } from './InstagramCaption';
import type { PlaceMediaData } from '../hooks/useMediaEnrichment';

interface Props {
  content: string;
  city?: string;
  days?: number;
  onSpeak?: () => void;
  onShare?: () => void;
  isSpeaking?: boolean;
  mediaData?: Map<string, PlaceMediaData>;
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
    if (host.includes('spotify.com')) return 'Open in Spotify';
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

/** Find which places from the media map appear in this section's text, skipping already-shown ones */
function getSectionPlaces(sectionContent: string, allPlaces: string[], shownSet: Set<string>): string[] {
  const lower = sectionContent.toLowerCase();
  return allPlaces.filter(p => {
    if (shownSet.has(p)) return false;
    if (!lower.includes(p.toLowerCase())) return false;
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

  // Collect media items: max 1 video, 2 total — keep them big rather than cramped
  let videoCount = 0;
  const mediaItems = places.filter(p => {
    const d = mediaData.get(p);
    if (!d || (!d.imageUrl && !d.videoId)) return false;
    if (d.videoId) {
      if (videoCount >= 1) return false;
      videoCount++;
    }
    return true;
  }).slice(0, 2);

  if (mediaItems.length === 0) {
    return <FormattedContent text={text} />;
  }

  return (
    <div className="relative">
      <FormattedContent text={text} />
      {/* Media column — absolutely positioned outside the text area to the right */}
      <div className="absolute top-0 left-full ml-8 w-[480px] flex flex-col gap-4">
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
            const ytThumb = `https://img.youtube.com/vi/${media.videoId}/maxresdefault.jpg`;
            return (
              <button
                key={place}
                onClick={() => setPlayingVideo(place)}
                className="relative w-full aspect-video bg-black cursor-pointer group block rounded-xl overflow-hidden"
              >
                <img
                  src={ytThumb}
                  alt={place}
                  className="w-full h-full object-cover"
                  loading="lazy"
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

          // Image card with caption
          return (
            <div key={place} className="rounded-xl overflow-hidden">
              <div className="relative aspect-[4/3] bg-on-surface/[0.03]">
                <img
                  src={media.imageUrl!}
                  alt={place}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-3 pb-2 pt-8">
                  <p className="text-xs font-medium text-white truncate">{place}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export const ItineraryDisplay: React.FC<Props> = ({ content, city, onSpeak, onShare, isSpeaking, mediaData }) => {
  const ref = useRef<HTMLDivElement>(null);
  // Track places already shown so each video/image only appears once across all sections
  const shownPlacesRef = useRef<Set<string>>(new Set());
  const [selectedDay, setSelectedDay] = useState(0);
  const prevContentRef = useRef(content);

  // Reset selected day when a new plan starts (content goes empty)
  useEffect(() => {
    if (!content && prevContentRef.current) {
      setSelectedDay(0);
    }
    prevContentRef.current = content;
  }, [content]);

  const parseSections = (text: string): TimeSlot[] => {
    const slots: TimeSlot[] = [];
    const sections = text.split(/##\s+/);
    sections.shift(); // discard text before first ##
    sections.forEach(section => {
      const match = section.match(/^([^\n(]+?)\s*(?:\(([^)]+)\))?\s*\n([\s\S]*)/);
      if (match) {
        slots.push({ period: match[1].trim(), time: match[2] || '', content: match[3].trim() });
      }
    });
    return slots;
  };

  const parseItinerary = (text: string): ParsedPlan => {
    const hasMultipleDays = /^# Day \d/m.test(text);

    if (!hasMultipleDays) {
      // Single-day: existing logic
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

    // Multi-day parsing: split on "# " (H1) headers
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
        if (/^(where to stay|soundtrack)$/i.test(slot.period)) {
          globalSections.push(slot);
        } else {
          daySlots.push(slot);
        }
      }

      if (daySlots.length > 0) {
        parsedDays.push({ dayLabel, dayNumber, slots: daySlots });
      }
    }

    // Also catch global sections that appear after all day blocks
    const afterLastDay = text.match(/(?:^|\n)## (Where to Stay|Soundtrack)\s*(?:\(([^)]*)\))?\s*\n([\s\S]*?)(?=\n## |\n# |$)/gi);
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
  };

  // Convert any raw URLs to markdown links before parsing
  const processed = convertRawUrls(content);
  const parsed = parseItinerary(processed);
  const hasDayParsing = parsed.days.length > 0;
  const showDayTabs = parsed.days.length > 1;

  // Reset shown places each render so dedup is fresh for new content
  shownPlacesRef.current.clear();

  // Clamp selectedDay to valid range
  const activeDayIdx = showDayTabs ? Math.min(selectedDay, parsed.days.length - 1) : 0;
  const activeSlots = hasDayParsing ? (parsed.days[activeDayIdx]?.slots || []) : parsed.slots;
  const allSlots = [...activeSlots, ...parsed.globalSections];

  const renderSlots = (slots: TimeSlot[], startIndex = 0) => (
    <div className="space-y-0">
      {slots.map((slot, index) => {
        const isSoundtrack = slot.period.toLowerCase() === 'soundtrack';
        const sectionPlaces = !isSoundtrack && mediaData && mediaData.size > 0
          ? getSectionPlaces(slot.content, [...mediaData.keys()], shownPlacesRef.current)
          : [];

        return (
          <div
            key={`${slot.period}-${startIndex + index}`}
            className="animate-slideInUp"
            style={{ animationDelay: `${(startIndex + index) * 120}ms`, opacity: 0 }}
          >
            {(startIndex + index) > 0 && <div className="border-t border-on-surface/[0.06] my-0" />}
            <div className="grid grid-cols-[120px_1fr] gap-8 py-8">
              <div>
                <p className="text-sm font-medium text-on-surface/90 flex items-center gap-2">
                  {isSoundtrack && (
                    <svg className="h-4 w-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 9l10.5-3m0 6.553v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 11-.99-3.467l2.31-.66a2.25 2.25 0 001.632-2.163zm0 0V2.25L9 5.25v10.303m0 0v3.75a2.25 2.25 0 01-1.632 2.163l-1.32.377a1.803 1.803 0 01-.99-3.467l2.31-.66A2.25 2.25 0 009 15.553z" />
                    </svg>
                  )}
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
                {!isSoundtrack && city && (
                  <InstagramCaption
                    activity={slot.content.slice(0, 200)}
                    city={city}
                    timeOfDay={slot.period.toLowerCase()}
                  />
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
        <div className="flex items-center gap-2">
          {onSpeak && (
            <button
              onClick={onSpeak}
              className={`p-2 rounded-full border border-on-surface/15 hover:bg-on-surface/5 transition-colors ${isSpeaking ? 'bg-on-surface/10' : ''}`}
              title={isSpeaking ? 'Stop speaking' : 'Read aloud'}
            >
              {isSpeaking ? (
                <svg className="h-4 w-4 text-on-surface/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25v13.5m-7.5-13.5v13.5" />
                </svg>
              ) : (
                <svg className="h-4 w-4 text-on-surface/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
                </svg>
              )}
            </button>
          )}
          {onShare && (
            <button
              onClick={onShare}
              className="p-2 rounded-full border border-on-surface/15 hover:bg-on-surface/5 transition-colors"
              title="Copy plan to clipboard"
            >
              <svg className="h-4 w-4 text-on-surface/70" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
              </svg>
            </button>
          )}
        </div>
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

      {/* Global sections (Where to Stay, Soundtrack) — always shown */}
      {parsed.globalSections.length > 0 && renderSlots(parsed.globalSections, activeSlots.length)}
    </div>
  );
};
