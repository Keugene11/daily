import React, { useState } from 'react';
import type { PlaceMediaData } from '../hooks/useMediaEnrichment';

interface Props {
  places: string[];
  mediaData: Map<string, PlaceMediaData>;
}

/**
 * Compact sidebar of place thumbnails (max 3). Video thumbnails show a play
 * button and expand into a full-width embed when clicked.
 */
export const PlaceMedia: React.FC<Props> = ({ places, mediaData }) => {
  const [expandedVideo, setExpandedVideo] = useState<string | null>(null);

  const items = places.filter(p => {
    const d = mediaData.get(p);
    return d && (d.imageUrl || d.videoId);
  }).slice(0, 3);

  if (items.length === 0) return null;

  // If a video is expanded, show the embed full-width
  const expandedMedia = expandedVideo ? mediaData.get(expandedVideo) : null;

  return (
    <div className="flex flex-col gap-3 animate-fadeIn">
      {/* Thumbnail sidebar */}
      <div className="flex flex-col gap-2">
        {items.map(place => {
          const media = mediaData.get(place)!;
          const hasVideo = !!media.videoId;
          const thumb = hasVideo
            ? `https://img.youtube.com/vi/${media.videoId}/mqdefault.jpg`
            : media.imageUrl!;

          return (
            <div key={place} className="relative rounded-lg overflow-hidden">
              {hasVideo ? (
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
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-2 pb-1.5 pt-4">
                    <p className="text-[11px] font-medium text-white text-left truncate">{place}</p>
                  </div>
                </button>
              ) : (
                <div className="relative aspect-[4/3] bg-on-surface/[0.03]">
                  <img
                    src={media.imageUrl!}
                    alt={place}
                    className="w-full h-full object-cover"
                    loading="lazy"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/60 to-transparent px-2 pb-1.5 pt-4">
                    <p className="text-[11px] font-medium text-white truncate">{place}</p>
                  </div>
                </div>
              )}
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
