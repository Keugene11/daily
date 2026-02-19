import React, { useState, useEffect } from 'react';
import { useExplore } from '../hooks/useExplore';
import { ExploreMap } from './ExploreMap';

const LOCATION_KEY = 'daily_explore_location';

interface Props {
  getAccessToken: () => Promise<string | null>;
  onClose: () => void;
}

/** Render markdown-ish text: **bold**, [links](url), and paragraphs */
function RenderPost({ text }: { text: string }) {
  const paragraphs = text.split(/\n{2,}/);

  return (
    <>
      {paragraphs.map((para, pi) => (
        <p key={pi} className="mb-4 last:mb-0">
          {renderInline(para.replace(/\n/g, ' '), pi)}
        </p>
      ))}
    </>
  );
}

function renderInline(text: string, keyBase: number): React.ReactNode[] {
  // Match **bold-link** **[text](url)**, [link](url), or **bold**
  const TOKEN = /\*\*\[([^\]]+)\]\(([^)]+)\)\*\*|\[([^\]]+)\]\(([^)]+)\)|\*\*([^*]+)\*\*/g;
  const elements: React.ReactNode[] = [];
  let lastIndex = 0;
  let match;
  let i = 0;

  while ((match = TOKEN.exec(text)) !== null) {
    if (match.index > lastIndex) {
      elements.push(text.slice(lastIndex, match.index));
    }

    if (match[1] !== undefined) {
      // Bold link: **[text](url)**
      elements.push(
        <a key={`${keyBase}-${i++}`} href={match[2]} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
          <strong className="font-semibold text-on-surface/80">{match[1]}</strong>
        </a>
      );
    } else if (match[3] !== undefined) {
      // Link: [text](url)
      elements.push(
        <a key={`${keyBase}-${i++}`} href={match[4]} target="_blank" rel="noopener noreferrer" className="text-accent hover:underline">
          {match[3]}
        </a>
      );
    } else if (match[5] !== undefined) {
      // Bold: **text**
      elements.push(
        <strong key={`${keyBase}-${i++}`} className="font-semibold text-on-surface/80">{match[5]}</strong>
      );
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    elements.push(text.slice(lastIndex));
  }

  return elements;
}

export const ExplorePage: React.FC<Props> = ({ getAccessToken, onClose }) => {
  const [query, setQuery] = useState('');
  const [location, setLocation] = useState(() => localStorage.getItem(LOCATION_KEY) || '');
  const { post, places, loading, error, searched, search } = useExplore(getAccessToken);

  // Save location to localStorage when it changes
  useEffect(() => {
    if (location.trim()) {
      localStorage.setItem(LOCATION_KEY, location.trim());
    }
  }, [location]);

  const handleSearch = () => {
    if (!query.trim() || !location.trim()) return;
    search(query.trim(), location.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSearch();
  };

  return (
    <div className="max-w-3xl mx-auto px-6 py-12">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold mb-1">Explore</h1>
          <p className="text-sm text-on-surface/40">Search any place, business, or activity.</p>
        </div>
        <button onClick={onClose} className="text-sm text-on-surface/50 hover:text-on-surface transition-colors">Back</button>
      </div>

      {/* Search inputs */}
      <div className="flex flex-col sm:flex-row gap-3 mb-8">
        <div className="flex-1">
          <label className="block text-[11px] uppercase tracking-[0.15em] text-on-surface/40 mb-2">What</label>
          <input
            type="text"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Barbers, restaurants, parks, museums..."
            className="w-full bg-transparent border-b border-on-surface/20 focus:border-on-surface/50 outline-none py-2 text-on-surface placeholder-on-surface/20 transition-colors"
            autoFocus
          />
        </div>
        <div className="w-full sm:w-48">
          <label className="block text-[11px] uppercase tracking-[0.15em] text-on-surface/40 mb-2">Where</label>
          <input
            type="text"
            value={location}
            onChange={e => setLocation(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="City or neighborhood"
            className="w-full bg-transparent border-b border-on-surface/20 focus:border-on-surface/50 outline-none py-2 text-on-surface placeholder-on-surface/20 transition-colors"
          />
        </div>
        <div className="flex items-end">
          <button
            onClick={handleSearch}
            disabled={loading || !query.trim() || !location.trim()}
            className="px-6 py-2.5 bg-accent text-on-accent rounded-full text-sm font-medium hover:bg-accent/90 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
          >
            {loading ? (
              <span className="flex items-center gap-2">
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                </svg>
                Searching...
              </span>
            ) : (
              'Search'
            )}
          </button>
        </div>
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="animate-fadeIn space-y-3">
          <div className="h-7 bg-on-surface/5 rounded animate-pulse w-2/3 mb-6" />
          <div className="h-4 bg-on-surface/5 rounded animate-pulse w-full" />
          <div className="h-4 bg-on-surface/5 rounded animate-pulse w-full" />
          <div className="h-4 bg-on-surface/5 rounded animate-pulse w-5/6" />
          <div className="h-4 bg-on-surface/5 rounded animate-pulse w-0 mb-2" />
          <div className="h-4 bg-on-surface/5 rounded animate-pulse w-full" />
          <div className="h-4 bg-on-surface/5 rounded animate-pulse w-full" />
          <div className="h-4 bg-on-surface/5 rounded animate-pulse w-3/4" />
          <div className="h-4 bg-on-surface/5 rounded animate-pulse w-0 mb-2" />
          <div className="h-4 bg-on-surface/5 rounded animate-pulse w-full" />
          <div className="h-4 bg-on-surface/5 rounded animate-pulse w-full" />
          <div className="h-4 bg-on-surface/5 rounded animate-pulse w-2/3" />
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="border border-red-500/30 rounded-lg p-6 mb-8 animate-fadeIn">
          <p className="text-red-500 text-sm font-medium mb-1">Search failed</p>
          <p className="text-on-surface/60 text-sm">{error}</p>
        </div>
      )}

      {/* Results — single flowing text block */}
      {!loading && post && (
        <div className="animate-fadeIn">
          <h2 className="text-2xl font-semibold tracking-tight mb-8">
            {query.charAt(0).toUpperCase() + query.slice(1)} in {location}
          </h2>

          <div className="text-[15px] leading-relaxed text-on-surface/60">
            <RenderPost text={post} />
          </div>

          <ExploreMap results={places} />
        </div>
      )}

      {/* Empty state */}
      {!loading && searched && !post && !error && (
        <div className="text-center py-16 animate-fadeIn">
          <div className="text-4xl mb-4">~</div>
          <h2 className="text-xl font-semibold mb-2">No results found</h2>
          <p className="text-on-surface/40 text-sm mb-4">Try a different search term or location.</p>
          <a
            href={`https://www.google.com/maps/search/${encodeURIComponent(query + ' in ' + location)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-accent hover:underline"
          >
            Search "{query}" on Google Maps instead
          </a>
        </div>
      )}
    </div>
  );
};
