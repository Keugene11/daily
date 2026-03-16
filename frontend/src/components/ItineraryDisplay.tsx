import React, { useRef, useMemo } from 'react';
interface Props {
  content: string;
  city?: string;
  onAddToCalendar?: () => void;
  calendarLoading?: boolean;
}

interface TimeSlot {
  period: string;
  time: string;
  content: string;
}

interface ParsedPlan {
  preamble: string;
  slots: TimeSlot[];
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
        <a key={keyGen.v++} href={match[2]} target="_blank" rel="noopener noreferrer" className="text-accent underline decoration-accent/30 hover:decoration-accent/60 underline-offset-2">
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
        <a key={keyGen.v++} href={href} target="_blank" rel="noopener noreferrer" className="text-accent underline decoration-accent/30 hover:decoration-accent/60 underline-offset-2">
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
        <a key={keyGen.v++} href={rawUrl} target="_blank" rel="noopener noreferrer" className="text-accent underline decoration-accent/30 hover:decoration-accent/60 underline-offset-2">
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

function RichText({ text }: { text: string }) {
  return <>{renderInline(text)}</>;
}

function FormattedContent({ text }: { text: string }) {
  // Split on double newlines into paragraphs, then render lines within each
  const paragraphs = text.split(/\n\s*\n/).filter(p => p.trim());
  if (paragraphs.length <= 1) {
    const lines = text.split('\n');
    return (
      <div className="space-y-3">
        {lines.map((line, i) => (
          <p key={i}><RichText text={line} /></p>
        ))}
      </div>
    );
  }
  return (
    <div className="space-y-6">
      {paragraphs.map((para, i) => {
        const lines = para.split('\n');
        return (
          <div key={i} className="space-y-3">
            {lines.map((line, j) => (
              <p key={j}><RichText text={line} /></p>
            ))}
          </div>
        );
      })}
    </div>
  );
}



function parseItinerary(text: string): ParsedPlan {
  const sections = text.split(/##\s+/);
  const preamble = (sections.shift() || '').trim();
  const slots: TimeSlot[] = [];
  sections.forEach(section => {
    const match = section.match(/^([^\n(]+?)\s*(?:\(([^)]+)\))?\s*\n([\s\S]*)/);
    if (match) {
      slots.push({ period: match[1].trim(), time: match[2] || '', content: match[3].trim() });
    }
  });
  return { preamble, slots };
}

export const ItineraryDisplay: React.FC<Props> = ({ content, onAddToCalendar, calendarLoading }) => {
  const ref = useRef<HTMLDivElement>(null);

  // Memoize content parsing — only re-parse when content changes, not on every re-render
  const { processed, parsed } = useMemo(() => {
    // Strip hidden CALENDAR_EVENTS JSON block before parsing/display
    // Also strip incomplete block still streaming (no closing --> yet)
    const stripped = content
      .replace(/<!--\s*CALENDAR_EVENTS\s*\n[\s\S]*?\n\s*-->/g, '')
      .replace(/<!--\s*CALENDAR_EVENTS[\s\S]*$/g, '')
      .trim();
    const p = convertRawUrls(stripped);
    return { processed: p, parsed: parseItinerary(p) };
  }, [content]);

  const allSlots = parsed.slots.filter(s => s.content.trim().length > 0);

  const renderSlots = (slots: TimeSlot[], startIndex = 0) => (
    <div className="space-y-2">
      {slots.map((slot, index) => (
          <div
            key={`${slot.period}-${startIndex + index}`}
            className="animate-slideInUp"
            style={{ animationDelay: `${(startIndex + index) * 50}ms`, opacity: 0 }}
          >
            {(startIndex + index) > 0 && <div className="border-t border-on-surface/[0.06] my-0" />}
            <div className="flex flex-col sm:grid sm:grid-cols-[120px_1fr] sm:gap-8 py-6 sm:py-8">
              <div className="flex items-center gap-2 sm:block mb-2 sm:mb-0">
                <p className="text-sm font-medium text-on-surface/90">
                  {slot.period}
                </p>
                {slot.time && <p className="text-xs text-on-surface/30 sm:mt-0.5">{slot.time}</p>}
              </div>
              <div className="text-[15px] leading-[1.8] text-on-surface/60">
                <FormattedContent text={slot.content} />
              </div>
            </div>
          </div>
        ))}
    </div>
  );

  if (allSlots.length === 0 && content) {
    return (
      <div className="animate-fadeIn">
        <h2 className="text-2xl font-semibold tracking-tight mb-8">Your day</h2>
        <div className="text-[15px] leading-relaxed text-on-surface/70">
          <FormattedContent text={processed} />
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fadeIn" ref={ref}>
      <div className="flex items-center justify-between mb-10">
        <h2 className="text-2xl font-semibold tracking-tight">Your day</h2>
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

      {/* Time slots */}
      {renderSlots(allSlots)}
    </div>
  );
};
