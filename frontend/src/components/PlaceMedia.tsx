import React, { useState } from 'react';
import type { PlaceMediaData } from '../hooks/useMediaEnrichment';

interface Props {
  places: string[];
  mediaData: Map<string, PlaceMediaData>;
  city?: string;
}

/**
 * Compact sidebar of place thumbnails (max 3). Video thumbnails show a play
 * button and expand into a full-width embed when clicked. Places without a
 * video get a static map thumbnail as fallback.
 */
export const PlaceMedia: React.FC<Props> = ({ places, mediaData, city }) => {
  const [expandedVideo, setExpandedVideo] = useState<string | null>(null);

  // Show up to 3 places — prefer ones with videos, fill remaining with static maps
  const withVideo = places.filter(p => mediaData.get(p)?.videoId).slice(0, 3);
  const withoutVideo = places.filter(p => !mediaData.get(p)?.videoId && !withVideo.includes(p));
  const items = [...withVideo, ...withoutVideo].slice(0, 3);

  if (items.length === 0) return null;

  // If a video is expanded, show the embed full-width
  const expandedMedia = expandedVideo ? mediaData.get(expandedVideo) : null;

  // Static map fallback — uses OpenStreetMap's static tile service
  const staticMapUrl = (place: string) => {
    const q = city ? `${place}, ${city}` : place;
    return `https://maps.googleapis.com/maps/api/staticmap?center=${encodeURIComponent(q)}&zoom=15&size=320x200&scale=2&maptype=roadmap&key=${import.meta.env.VITE_GOOGLE_MAPS_KEY || ''}`;
  };

  // Check if we have a Google Maps API key for static maps
  const hasGoogleKey = !!import.meta.env.VITE_GOOGLE_MAPS_KEY;

  return (
    <div className="flex flex-col gap-3 animate-fadeIn">
      {/* Thumbnail sidebar */}
      <div className="flex flex-col gap-2">
        {items.map(place => {
          const media = mediaData.get(place);
          const hasVideo = !!media?.videoId;

          if (hasVideo) {
            const thumb = `https://img.youtube.com/vi/${media!.videoId}/mqdefault.jpg`;
            return (
              <div key={place} className="relative rounded-lg overflow-hidden">
                <button
                  onClick={() => setExpandedVideo(expandedVideo === place ? null : place)}
                  className="relative w-full aspect-[16/10] bg-black cursor-pointer group block"
                >
                  <img
                    src={thumb}
                    alt={place}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-8 h-6 bg-red-600 rounded-md flex items-center justify-center opacity-90 group-hover:opacity-100 group-hover:bg-red-500 transition-all">
                      <svg className="w-3 h-3 text-white ml-0.5" viewBox="0 0 24 24" fill="currentColor">
                        <path d="M8 5v14l11-7z" />
                      </svg>
                    </div>
                  </div>
                </button>
              </div>
            );
          }

          // Static fallback — map thumbnail or plain label card
          return (
            <div key={place} className="relative rounded-lg overflow-hidden">
              <div className="relative aspect-[16/10] bg-on-surface/[0.04]">
                {hasGoogleKey ? (
                  <img
                    src={staticMapUrl(place)}
                    alt={place}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-on-surface/20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                      <path d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                      <path d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" />
                    </svg>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Expanded video embed — full width below sidebar */}
      {expandedMedia?.videoId && (
        <div className="rounded-lg overflow-hidden">
          <div className="relative aspect-video bg-black">
            <iframe
              src={`https://www.youtube.com/embed/${expandedMedia.videoId}?autoplay=1&rel=0`}
              className="absolute inset-0 w-full h-full"
              allow="autoplay; encrypted-media"
              allowFullScreen
              title={expandedVideo || ''}
            />
          </div>
        </div>
      )}
    </div>
  );
};
