import React, { useState, useEffect } from 'react';
import { useExplore } from '../hooks/useExplore';
import { ExploreMap } from './ExploreMap';

const LOCATION_KEY = 'daily_explore_location';

interface Props {
  getAccessToken: () => Promise<string | null>;
  onClose: () => void;
}

export const ExplorePage: React.FC<Props> = ({ getAccessToken, onClose }) => {
  const [query, setQuery] = useState('');
  const [location, setLocation] = useState(() => localStorage.getItem(LOCATION_KEY) || '');
  const { results, loading, error, searched, search } = useExplore(getAccessToken);

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

      {/* Loading skeleton — flowing post style */}
      {loading && (
        <div className="animate-fadeIn">
          <div className="h-7 bg-on-surface/5 rounded animate-pulse w-2/3 mb-3" />
          <div className="h-4 bg-on-surface/5 rounded animate-pulse w-1/3 mb-10" />
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i}>
              {i > 0 && <div className="border-t border-on-surface/[0.06]" />}
              <div className="py-8 space-y-3">
                <div className="w-full h-48 bg-on-surface/5 rounded-xl animate-pulse" />
                <div className="h-4 bg-on-surface/5 rounded animate-pulse w-1/2" />
                <div className="h-3 bg-on-surface/5 rounded animate-pulse w-1/4" />
                <div className="h-3 bg-on-surface/5 rounded animate-pulse w-full" />
                <div className="h-3 bg-on-surface/5 rounded animate-pulse w-5/6" />
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

      {/* Results — flowing post layout */}
      {!loading && results.length > 0 && (
        <div className="animate-fadeIn">
          <h2 className="text-2xl font-semibold tracking-tight mb-2">
            {query.charAt(0).toUpperCase() + query.slice(1)} in {location}
          </h2>
          <p className="text-sm text-on-surface/40 mb-10">
            {results.length} places
          </p>

          <div className="space-y-0">
            {results.map((place, i) => (
              <div
                key={place.id}
                className="animate-slideInUp"
                style={{ animationDelay: `${i * 50}ms`, opacity: 0 }}
              >
                {i > 0 && <div className="border-t border-on-surface/[0.06]" />}
                <div className="py-8">
                  {/* Photo */}
                  {place.photoUrl && (
                    <div className="rounded-xl overflow-hidden mb-4">
                      <img
                        src={place.photoUrl}
                        alt={place.name}
                        className="w-full h-52 object-cover"
                        loading="lazy"
                        onError={(e) => { e.currentTarget.parentElement!.style.display = 'none'; }}
                      />
                    </div>
                  )}

                  {/* Name */}
                  <p className="text-sm font-medium text-on-surface/90 mb-1">
                    <strong className="font-semibold text-on-surface/80">{place.name}</strong>
                  </p>

                  {/* Rating + status line */}
                  <div className="flex items-center gap-2 text-xs text-on-surface/40 mb-3">
                    {place.rating && (
                      <span className="flex items-center gap-1">
                        <svg className="w-3 h-3 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        {place.rating.toFixed(1)}
                        {place.userRatingCount > 0 && (
                          <span className="text-on-surface/30">({place.userRatingCount.toLocaleString()})</span>
                        )}
                      </span>
                    )}
                    {place.rating && place.priceLevel && <span className="text-on-surface/20">·</span>}
                    {place.priceLevel && <span>{place.priceLevel}</span>}
                    {(place.rating || place.priceLevel) && place.isOpen !== null && <span className="text-on-surface/20">·</span>}
                    {place.isOpen !== null && (
                      <span className={place.isOpen ? 'text-green-500' : 'text-red-400'}>
                        {place.isOpen ? 'Open now' : 'Closed'}
                      </span>
                    )}
                  </div>

                  {/* Summary */}
                  {place.summary && (
                    <p className="text-[15px] leading-relaxed text-on-surface/60 mb-3">
                      {place.summary}
                    </p>
                  )}

                  {/* Address + Maps link */}
                  <p className="text-[11px] text-on-surface/30">
                    {place.address}
                    {' · '}
                    <a
                      href={place.googleMapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent hover:underline"
                    >
                      View on Maps
                    </a>
                  </p>
                </div>
              </div>
            ))}
          </div>

          <ExploreMap results={results} />
        </div>
      )}

      {/* Empty state */}
      {!loading && searched && results.length === 0 && !error && (
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
