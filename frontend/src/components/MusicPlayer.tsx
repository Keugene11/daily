import React, { useState, useRef, useEffect, useCallback } from 'react';

interface Track {
  title: string;
  artist: string;
  spotifyUrl: string;
  youtubeUrl: string;
  previewUrl: string;
  reason?: string;
}

interface PlaylistData {
  name: string;
  description: string;
  mood: string;
  playlistUrl: string;
  tracks: Track[];
}

interface Props {
  playlist: PlaylistData;
}

const API_URL = import.meta.env.VITE_API_URL || '';

// Resolve a YouTube video ID via the backend search endpoint
async function resolveYouTubeId(artist: string, title: string): Promise<string | null> {
  try {
    const q = encodeURIComponent(`${artist} - ${title} audio`);
    const res = await fetch(`${API_URL}/api/youtube-search?q=${q}`);
    if (!res.ok) return null;
    const data = await res.json();
    return data.videoId || null;
  } catch {
    return null;
  }
}

// Load the YouTube IFrame API (singleton)
let _ytApiReady: Promise<void> | null = null;
function loadYouTubeApi(): Promise<void> {
  if (_ytApiReady) return _ytApiReady;
  _ytApiReady = new Promise((resolve) => {
    if ((window as any).YT?.Player) { resolve(); return; }
    (window as any).onYouTubeIframeAPIReady = () => resolve();
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    tag.onerror = () => resolve(); // proceed even if fails
    document.head.appendChild(tag);
  });
  return _ytApiReady;
}

export const MusicPlayer: React.FC<Props> = ({ playlist: rawPlaylist }) => {
  // Always cap at 5 tracks regardless of what the backend returns
  const playlist = { ...rawPlaylist, tracks: rawPlaylist.tracks.slice(0, 5) };
  const [currentTrack, setCurrentTrack] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolume] = useState(4); // 0-100 for YT API
  const [loadingTrack, setLoadingTrack] = useState<number | null>(null);
  const [videoIds, setVideoIds] = useState<Record<number, string>>({});

  const playerRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const readyRef = useRef(false);
  const pendingPlayRef = useRef<string | null>(null);

  // Initialize YouTube player
  useEffect(() => {
    let cancelled = false;
    loadYouTubeApi().then(() => {
      if (cancelled || !containerRef.current || !(window as any).YT?.Player) return;
      playerRef.current = new (window as any).YT.Player(containerRef.current, {
        height: '0',
        width: '0',
        playerVars: {
          autoplay: 0,
          controls: 0,
          disablekb: 1,
          fs: 0,
          modestbranding: 1,
          rel: 0,
        },
        events: {
          onReady: () => {
            readyRef.current = true;
            playerRef.current?.setVolume(volume);
            // If a video was queued before player was ready, play it now
            if (pendingPlayRef.current) {
              playerRef.current.loadVideoById(pendingPlayRef.current);
              pendingPlayRef.current = null;
            }
          },
          onStateChange: (e: any) => {
            const YT = (window as any).YT;
            if (e.data === YT.PlayerState.PLAYING) setIsPlaying(true);
            if (e.data === YT.PlayerState.PAUSED) setIsPlaying(false);
            if (e.data === YT.PlayerState.ENDED) handleEnded();
          },
        },
      });
    });
    return () => { cancelled = true; };
  }, []);

  // Sync volume
  useEffect(() => {
    if (readyRef.current && playerRef.current?.setVolume) {
      playerRef.current.setVolume(volume);
    }
  }, [volume]);

  const handleEnded = useCallback(() => {
    setCurrentTrack(prev => {
      const next = (prev + 1) % playlist.tracks.length;
      playTrackByIdx(next);
      return next;
    });
  }, [playlist.tracks.length]);

  // Resolve a video ID and play it
  const playTrackByIdx = async (idx: number) => {
    const track = playlist.tracks[idx];

    let vid = videoIds[idx];
    if (!vid) {
      setLoadingTrack(idx);
      vid = (await resolveYouTubeId(track.artist, track.title)) || '';
      setLoadingTrack(null);
      if (vid) {
        setVideoIds(prev => ({ ...prev, [idx]: vid }));
      }
    }

    if (!vid) {
      // Couldn't find video — skip to next
      const nextIdx = (idx + 1) % playlist.tracks.length;
      if (nextIdx !== idx) playTrackByIdx(nextIdx);
      return;
    }

    if (readyRef.current && playerRef.current?.loadVideoById) {
      playerRef.current.loadVideoById(vid);
    } else {
      pendingPlayRef.current = vid;
    }
  };

  const playTrack = (idx: number) => {
    setCurrentTrack(idx);
    playTrackByIdx(idx);
  };

  const togglePlayPause = () => {
    if (!readyRef.current || !playerRef.current) return;
    const state = playerRef.current.getPlayerState?.();
    const YT = (window as any).YT;
    if (state === YT?.PlayerState?.PLAYING) {
      playerRef.current.pauseVideo();
    } else {
      playerRef.current.playVideo();
    }
  };

  // Pre-resolve the next track's video ID
  useEffect(() => {
    if (!isPlaying) return;
    const nextIdx = (currentTrack + 1) % playlist.tracks.length;
    if (videoIds[nextIdx]) return;
    const track = playlist.tracks[nextIdx];
    resolveYouTubeId(track.artist, track.title).then(vid => {
      if (vid) setVideoIds(prev => ({ ...prev, [nextIdx]: vid }));
    });
  }, [currentTrack, isPlaying]);

  // Auto-play first track on mount
  useEffect(() => {
    const timer = setTimeout(() => playTrack(0), 500);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="border border-on-surface/10 rounded-xl overflow-hidden mb-8 animate-fadeIn">
      {/* Hidden YouTube player */}
      <div style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}>
        <div ref={containerRef} />
      </div>

      {/* Player header */}
      <div className="flex items-center justify-between px-4 py-3 bg-on-surface/[0.03]">
        <div className="flex items-center gap-3">
          <button
            onClick={togglePlayPause}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-green-500 hover:bg-green-400 transition-colors"
            title={isPlaying ? 'Pause' : 'Play'}
          >
            {isPlaying ? (
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4 text-white ml-0.5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            )}
          </button>

          {isPlaying && (
            <div className="flex items-end gap-[2px] h-4">
              <div className="w-[3px] bg-green-500 rounded-full animate-pulse" style={{ height: '60%', animationDelay: '0ms' }} />
              <div className="w-[3px] bg-green-500 rounded-full animate-pulse" style={{ height: '100%', animationDelay: '150ms' }} />
              <div className="w-[3px] bg-green-500 rounded-full animate-pulse" style={{ height: '40%', animationDelay: '300ms' }} />
              <div className="w-[3px] bg-green-500 rounded-full animate-pulse" style={{ height: '80%', animationDelay: '100ms' }} />
            </div>
          )}

          <div>
            <p className="text-xs font-medium text-on-surface/80">{playlist.name}</p>
            <p className="text-[10px] text-on-surface/40">
              {isPlaying
                ? `${playlist.tracks[currentTrack]?.title} — ${playlist.tracks[currentTrack]?.artist}`
                : playlist.mood}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <svg className="w-3 h-3 text-on-surface/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z" />
            </svg>
            <input
              type="range"
              min="0"
              max="100"
              step="5"
              value={volume}
              onChange={(e) => setVolume(parseInt(e.target.value))}
              className="w-16 h-1 accent-green-500 cursor-pointer"
              title={`Volume: ${volume}%`}
            />
          </div>

          <a
            href={playlist.playlistUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[10px] uppercase tracking-wider text-green-500 hover:text-green-400 font-medium"
          >
            Open in Spotify
          </a>
        </div>
      </div>

      {/* Track list */}
      <div className="divide-y divide-on-surface/[0.04]">
        {playlist.tracks.map((track, idx) => (
          <div
            key={idx}
            className={`flex items-center gap-3 px-4 py-2.5 hover:bg-on-surface/[0.03] transition-colors group cursor-pointer ${
              currentTrack === idx ? 'bg-on-surface/[0.05]' : ''
            }`}
            onClick={() => playTrack(idx)}
          >
            {loadingTrack === idx ? (
              <div className="w-5 flex items-center justify-center">
                <svg className="w-3.5 h-3.5 text-on-surface/30 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              </div>
            ) : currentTrack === idx && isPlaying ? (
              <div className="w-5 flex items-end justify-center gap-[1.5px] h-3.5">
                <div className="w-[2px] bg-green-500 rounded-full animate-pulse" style={{ height: '50%', animationDelay: '0ms' }} />
                <div className="w-[2px] bg-green-500 rounded-full animate-pulse" style={{ height: '100%', animationDelay: '150ms' }} />
                <div className="w-[2px] bg-green-500 rounded-full animate-pulse" style={{ height: '70%', animationDelay: '300ms' }} />
              </div>
            ) : (
              <>
                <span className="w-5 text-center text-xs text-on-surface/30 group-hover:hidden">
                  {idx + 1}
                </span>
                <svg
                  className="w-5 h-5 text-on-surface/60 hidden group-hover:block flex-shrink-0"
                  fill="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path d="M8 5v14l11-7z" />
                </svg>
              </>
            )}

            <div className="flex-1 min-w-0">
              <p className={`text-sm truncate ${currentTrack === idx ? 'text-green-500 font-medium' : 'text-on-surface/70'}`}>
                {track.title}
              </p>
              <p className="text-[11px] text-on-surface/35 truncate">{track.artist}</p>
              {track.reason && (
                <p className="text-[10px] text-on-surface/25 truncate italic mt-0.5">{track.reason}</p>
              )}
            </div>

            <div className="flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <a
                href={track.spotifyUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="p-1 rounded-full hover:bg-on-surface/10"
                title="Open in Spotify"
              >
                <svg className="w-3.5 h-3.5 text-green-500" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
                </svg>
              </a>
              <a
                href={track.youtubeUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="p-1 rounded-full hover:bg-on-surface/10"
                title="Search on YouTube"
              >
                <svg className="w-3.5 h-3.5 text-red-500" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
                </svg>
              </a>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
