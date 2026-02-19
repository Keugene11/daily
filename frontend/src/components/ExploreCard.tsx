import React from 'react';
import { ExploreResult } from '../hooks/useExplore';

interface Props {
  place: ExploreResult;
  index: number;
}

const CATEGORY_COLORS: Record<string, string> = {
  Event: '#8b5cf6',
  Meetup: '#3b82f6',
  Hackathon: '#f59e0b',
  Workshop: '#10b981',
  Networking: '#6366f1',
  Coworking: '#14b8a6',
  Concert: '#ec4899',
  Museum: '#8b5cf6',
  Park: '#22c55e',
  Tour: '#f97316',
  Festival: '#e11d48',
  Library: '#6366f1',
  Class: '#14b8a6',
  Free: '#22c55e',
};

export const ExploreCard: React.FC<Props> = ({ place, index }) => {
  const isEvent = place.resultType === 'event';
  const categoryColor = CATEGORY_COLORS[place.category || ''] || '#6366f1';

  return (
    <div
      className="border border-on-surface/10 rounded-xl overflow-hidden hover:border-on-surface/25 transition-all animate-fadeIn"
      style={{ animationDelay: `${index * 80}ms` }}
    >
      {/* Photo or event header */}
      {place.photoUrl ? (
        <img
          src={place.photoUrl}
          alt={place.name}
          className="w-full h-44 object-cover"
          loading="lazy"
        />
      ) : isEvent ? (
        <div
          className="w-full h-24 flex items-center justify-center"
          style={{ background: `${categoryColor}15` }}
        >
          <span
            className="text-xs font-semibold uppercase tracking-widest"
            style={{ color: categoryColor }}
          >
            {place.category || 'Event'}
          </span>
        </div>
      ) : (
        <div className="w-full h-44 bg-on-surface/5 flex items-center justify-center">
          <svg className="w-8 h-8 text-on-surface/15" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
          </svg>
        </div>
      )}

      {/* Content */}
      <div className="p-4">
        {/* Name + rating or category tag */}
        <div className="flex items-start justify-between gap-2 mb-1.5">
          <h3 className="font-medium text-sm leading-tight">{place.name}</h3>
          {isEvent && place.isFree && (
            <span className="text-[10px] font-semibold uppercase tracking-wider text-green-500 bg-green-500/10 px-2 py-0.5 rounded-full shrink-0">
              Free
            </span>
          )}
          {!isEvent && place.rating && (
            <div className="flex items-center gap-1 shrink-0">
              <span className="text-sm font-medium">{place.rating.toFixed(1)}</span>
              <svg className="w-3.5 h-3.5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              {place.userRatingCount > 0 && (
                <span className="text-[11px] text-on-surface/30">({place.userRatingCount})</span>
              )}
            </div>
          )}
        </div>

        {/* Event: time + price */}
        {isEvent && (
          <div className="flex items-center gap-2 text-xs text-on-surface/40 mb-3">
            {place.time && <span>{place.time}</span>}
            {place.time && place.priceLevel && !place.isFree && <span>·</span>}
            {place.priceLevel && !place.isFree && <span>{place.priceLevel}</span>}
          </div>
        )}

        {/* Place: price + open status */}
        {!isEvent && (
          <div className="flex items-center gap-2 text-xs text-on-surface/40 mb-3">
            {place.priceLevel && <span>{place.priceLevel}</span>}
            {place.priceLevel && place.isOpen !== null && <span>·</span>}
            {place.isOpen !== null && (
              <span className={place.isOpen ? 'text-green-500' : 'text-red-400'}>
                {place.isOpen ? 'Open now' : 'Closed'}
              </span>
            )}
          </div>
        )}

        {/* Summary / description */}
        {place.summary && (
          <p className="text-sm text-on-surface/55 leading-relaxed mb-3">{place.summary}</p>
        )}

        {/* Address + link */}
        <div className="flex items-center justify-between gap-2">
          <p className="text-[11px] text-on-surface/30 truncate flex-1">{place.address}</p>
          <a
            href={place.googleMapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-on-surface/40 hover:text-on-surface/70 transition-colors shrink-0"
          >
            View on Maps
          </a>
        </div>
      </div>
    </div>
  );
};
