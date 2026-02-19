import React, { useState, useEffect } from 'react';
import { useExplore } from '../hooks/useExplore';
import { ExploreCard } from './ExploreCard';
import { ExploreMap } from './ExploreMap';

const LOCATION_KEY = 'daily_explore_location';

interface Props {
  getAccessToken: () => Promise<string | null>;
  onClose: () => void;
}

export const ExplorePage: React.FC<Props> = ({ getAccessToken, onClose }) => {
  const [query, setQuery] = useState('');
  const [location, setLocation] = useState(() => localStorage.getItem(LOCATION_KEY) || '');
  const { results, loading, error, searched, fallback, search } = useExplore(getAccessToken);

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
    <div className="max-w-4xl mx-auto px-6 py-12">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold mb-1">Explore</h1>
          <p className="text-sm text-on-surface/40">Find anything, anywhere.</p>
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
            placeholder="Parks, barbers, restaurants, concerts..."
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

      {/* Loading skeletons */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="border border-on-surface/10 rounded-xl overflow-hidden">
              <div className="w-full h-44 bg-on-surface/5 animate-pulse" />
              <div className="p-4 space-y-3">
                <div className="h-4 bg-on-surface/5 rounded animate-pulse w-3/4" />
                <div className="h-3 bg-on-surface/5 rounded animate-pulse w-1/2" />
                <div className="h-3 bg-on-surface/5 rounded animate-pulse w-full" />
                <div className="h-3 bg-on-surface/5 rounded animate-pulse w-2/3" />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="border border-red-500/30 rounded-lg p-6 mb-8 animate-fadeIn">
          <p className="text-red-500 text-sm font-medium mb-1">Search failed</p>
          <p className="text-on-surface/60 text-sm">{error}</p>
        </div>
      )}

      {/* Results */}
      {!loading && results.length > 0 && (
        <>
          <p className="text-xs text-on-surface/30 mb-4">
            {fallback
              ? `No exact matches for "${query}" — here's what's happening today in ${location}`
              : `${results.length} results for "${query}" in ${location}`
            }
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
            {results.map((place, i) => (
              <ExploreCard key={place.id} place={place} index={i} />
            ))}
          </div>
          <ExploreMap results={results} />
        </>
      )}

      {/* Empty state */}
      {!loading && searched && results.length === 0 && !error && (
        <div className="text-center py-16 animate-fadeIn">
          <div className="text-4xl mb-4">~</div>
          <h2 className="text-xl font-semibold mb-2">No results found</h2>
          <p className="text-on-surface/40 text-sm">Try a different search term or location.</p>
        </div>
      )}
    </div>
  );
};
