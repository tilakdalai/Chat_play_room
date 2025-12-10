import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { socketService } from '../services/socket';

const extractYouTubeId = (rawUrl: string): string | null => {
  try {
    const url = new URL(rawUrl);
    const host = url.hostname.replace('www.', '');
    if (host === 'youtu.be') {
      return url.pathname.replace('/', '') || null;
    }
    if (host === 'youtube.com' || host === 'm.youtube.com') {
      const v = url.searchParams.get('v');
      if (v) return v;
      const parts = url.pathname.split('/');
      const embedIndex = parts.indexOf('embed');
      if (embedIndex !== -1 && parts[embedIndex + 1]) {
        return parts[embedIndex + 1];
      }
    }
  } catch (_err) {
    return null;
  }
  return null;
};

const extractGoogleDriveId = (rawUrl: string): string | null => {
  try {
    const url = new URL(rawUrl);
    const host = url.hostname.replace('www.', '');
    if (host === 'drive.google.com') {
      // Handle /file/d/FILE_ID/view format
      const match = url.pathname.match(/\/file\/d\/([^\/]+)/);
      if (match && match[1]) return match[1];
      // Handle /open?id=FILE_ID format
      const id = url.searchParams.get('id');
      if (id) return id;
    }
  } catch (_err) {
    return null;
  }
  return null;
};

const toYouTubeEmbedUrl = (videoId: string) =>
  `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0&modestbranding=1`;

const toGoogleDriveEmbedUrl = (fileId: string) =>
  `https://drive.google.com/file/d/${fileId}/preview`;

interface MoviePlayerProps {
  roomCode: string;
  movieUrl?: string;
  movieState?: {
    isPlaying: boolean;
    currentTime: number;
    lastUpdated: number;
  };
}

export default function MoviePlayer({ roomCode, movieUrl }: MoviePlayerProps) {
  const [url, setUrl] = useState(movieUrl || '');
  const [inputUrl, setInputUrl] = useState('');
  const [showInstructions, setShowInstructions] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastSyncRef = useRef<number>(0);

  const serverOrigin = useMemo(() => {
    if (typeof window === 'undefined') return '';
    const envUrl = ((import.meta as any).env?.VITE_SERVER_URL as string | undefined)?.replace(/\/$/, '');
    if (envUrl) return envUrl;
    if (window.location.port === '3000') {
      return `${window.location.protocol}//${window.location.hostname}:3001`;
    }
    return window.location.origin;
  }, []);

  const resolveMediaUrl = useCallback(
    (rawUrl: string) => {
      if (!rawUrl) return '';
      if (/^https?:\/\//i.test(rawUrl) || rawUrl.startsWith('blob:')) {
        return rawUrl;
      }
      const base = serverOrigin || (typeof window !== 'undefined' ? window.location.origin : '');
      if (!rawUrl.startsWith('/')) {
        return `${base}/${rawUrl}`;
      }
      return `${base}${rawUrl}`;
    },
    [serverOrigin]
  );

  const playbackUrl = useMemo(() => resolveMediaUrl(url), [resolveMediaUrl, url]);
  const youtubeId = useMemo(() => extractYouTubeId(playbackUrl || ''), [playbackUrl]);
  const youtubeEmbedUrl = useMemo(() => (youtubeId ? toYouTubeEmbedUrl(youtubeId) : ''), [youtubeId]);
  const isYouTube = Boolean(youtubeId);
  
  const driveId = useMemo(() => extractGoogleDriveId(playbackUrl || ''), [playbackUrl]);
  const driveEmbedUrl = useMemo(() => (driveId ? toGoogleDriveEmbedUrl(driveId) : ''), [driveId]);
  const isGoogleDrive = Boolean(driveId);

  useEffect(() => {
    setUrl(movieUrl ?? '');
  }, [movieUrl]);

  useEffect(() => {
    const socket = socketService.getSocket();
    if (!socket || isYouTube || isGoogleDrive) return;

    socket.on('movie-state-updated', (state: any) => {
      if (videoRef.current && playbackUrl) {
        const timeDiff = Math.abs(videoRef.current.currentTime - state.currentTime);

        if (timeDiff > 1.0) {
          videoRef.current.currentTime = state.currentTime;
        }

        if (state.isPlaying && videoRef.current.paused) {
          videoRef.current.play().catch(() => {
            console.log('Auto-play blocked by browser');
          });
        } else if (!state.isPlaying && !videoRef.current.paused) {
          videoRef.current.pause();
        }

        lastSyncRef.current = Date.now();
      }
    });

    return () => {
      socket.off('movie-state-updated');
    };
  }, [isYouTube, isGoogleDrive, playbackUrl]);

  const emitMovieState = useCallback(
    (overrides?: Partial<{ isPlaying: boolean; currentTime: number }>, force = false) => {
      const socket = socketService.getSocket();
      const video = videoRef.current;
      if (!socket || !video || isYouTube || isGoogleDrive) return;

      const now = Date.now();
      if (!force && now - lastSyncRef.current < 400) {
        return;
      }

      const payload = {
        isPlaying: overrides?.isPlaying ?? !video.paused,
        currentTime: overrides?.currentTime ?? video.currentTime,
        lastUpdated: now
      };

      lastSyncRef.current = now;
      socket.emit('update-movie-state', {
        roomCode,
        state: payload
      });
    },
    [roomCode, isYouTube, isGoogleDrive]
  );

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputUrl.trim()) return;

    const socket = socketService.getSocket();
    if (!socket) return;

    socket.emit('set-movie-url', {
      roomCode,
      url: inputUrl
    });
    setInputUrl('');
  };



  const handlePlay = () => {
    if (!videoRef.current || isYouTube || isGoogleDrive) return;
    emitMovieState({ isPlaying: true }, true);
  };

  const handlePause = () => {
    if (!videoRef.current || isYouTube || isGoogleDrive) return;
    emitMovieState({ isPlaying: false }, true);
  };

  const handleSeek = () => {
    if (!videoRef.current || isYouTube || isGoogleDrive) return;
    emitMovieState({ currentTime: videoRef.current.currentTime }, true);
  };

  const handleTimeUpdate = () => {
    if (!videoRef.current || videoRef.current.paused || isYouTube || isGoogleDrive) return;
    emitMovieState();
  };

  const toggleFullscreen = () => {
    if (!videoRef.current) return;
    
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      videoRef.current.requestFullscreen();
    }
  };

  return (
    <div className="flex flex-col h-full gap-2 md:gap-4 p-2 md:p-4 relative">
      <div className="flex-1 flex flex-col space-y-2 md:space-y-4">
        <div className="flex flex-col sm:flex-row gap-2 items-stretch sm:items-center">
          <form onSubmit={handleUrlSubmit} className="flex-1 flex gap-2">
            <input
              type="text"
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              placeholder="Paste video URL (YouTube, Google Drive, or direct video link)"
              className="flex-1 bg-white/5 border border-white/10 rounded-xl px-3 md:px-4 py-2 text-sm md:text-base text-white placeholder-white/30 focus:outline-none focus:border-purple-500/50"
            />
            <button
              type="submit"
              className="px-4 md:px-6 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-xl text-sm md:text-base font-medium transition-colors whitespace-nowrap"
            >
              <span className="hidden sm:inline">Load Movie</span>
              <span className="sm:hidden">▶</span>
            </button>
          </form>
          
          <div className="flex items-center gap-1.5 md:gap-2">
            <button
              onClick={() => setShowInstructions(!showInstructions)}
              className={`p-2 rounded-xl transition-colors ${showInstructions ? 'bg-blue-600 text-white' : 'bg-white/10 text-white/70 hover:bg-white/20'}`}
              title="Instructions"
            >
              <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            </button>
            <button
              onClick={toggleFullscreen}
              className="p-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors"
              title="Fullscreen"
            >
              <svg className="w-5 h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
            </button>
          </div>
        </div>

        <div className="flex-1 bg-black rounded-2xl overflow-hidden border border-white/10 relative group">
          {url ? (
            <>
              {isYouTube && youtubeEmbedUrl ? (
                <iframe
                  src={youtubeEmbedUrl}
                  className="w-full h-full"
                  allow="autoplay; encrypted-media; picture-in-picture"
                  allowFullScreen
                  title="YouTube player"
                />
              ) : isGoogleDrive && driveEmbedUrl ? (
                <iframe
                  src={driveEmbedUrl}
                  className="w-full h-full"
                  allow="autoplay; encrypted-media"
                  allowFullScreen
                  title="Google Drive player"
                />
              ) : (
                <video
                  ref={videoRef}
                  src={playbackUrl}
                  className="w-full h-full object-contain"
                  controls
                  playsInline
                  onPlay={handlePlay}
                  onPause={handlePause}
                  onSeeked={handleSeek}
                  onTimeUpdate={handleTimeUpdate}
                />
              )}
              {!isYouTube && !isGoogleDrive && (
                <div className="absolute top-4 right-4 bg-green-500/90 text-white px-3 py-1.5 rounded-full text-sm font-medium flex items-center gap-2 shadow-lg">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  Synced
                </div>
              )}
            </>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-white/30">
              <div className="text-center">
                <div className="text-6xl mb-4">🎬</div>
                <p>Enter a video URL to start watching</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Instructions Modal */}
      {showInstructions && (
        <div className="absolute top-0 left-0 right-0 bottom-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl border border-white/20 shadow-2xl w-full max-w-2xl max-h-[80vh] overflow-hidden flex flex-col">
            <div className="p-4 md:p-6 border-b border-white/10 flex items-center justify-between bg-gradient-to-r from-blue-600/20 to-purple-600/20">
              <div className="flex items-center gap-3">
                <span className="text-3xl md:text-4xl">ℹ️</span>
                <div>
                  <h2 className="text-xl md:text-2xl font-bold text-white">Movie Player Instructions</h2>
                  <p className="text-xs md:text-sm text-gray-400">How to use the movie theater</p>
                </div>
              </div>
              <button
                onClick={() => setShowInstructions(false)}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white"
                title="Close instructions"
                aria-label="Close instructions"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 md:p-6">
              <div className="space-y-4 text-white">
                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
                    <span className="text-2xl">🎬</span>
                    Supported Video Sources
                  </h3>
                  <ul className="space-y-2 text-sm text-gray-300 ml-8">
                    <li>• <strong>YouTube:</strong> Paste any YouTube video URL (youtube.com or youtu.be)</li>
                    <li>• <strong>Google Drive:</strong> Share a video file from Google Drive and paste the link</li>
                    <li>• <strong>Direct Video:</strong> Paste direct links to .mp4, .webm, .ogg files</li>
                  </ul>
                </div>
                
                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
                    <span className="text-2xl">▶️</span>
                    How to Play a Video
                  </h3>
                  <ol className="space-y-2 text-sm text-gray-300 ml-8">
                    <li>1. Copy a video URL from YouTube, Google Drive, or a direct video link</li>
                    <li>2. Paste the URL in the input field at the top</li>
                    <li>3. Click the "Load Movie" button</li>
                    <li>4. The video will play for everyone in the room (synced for direct videos)</li>
                  </ol>
                </div>
                
                <div className="bg-white/5 rounded-xl p-4 border border-white/10">
                  <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
                    <span className="text-2xl">🎮</span>
                    Controls
                  </h3>
                  <ul className="space-y-2 text-sm text-gray-300 ml-8">
                    <li>• <strong>Info Button (ℹ️):</strong> Toggle these instructions</li>
                    <li>• <strong>Fullscreen Button (⛶):</strong> Enter/exit fullscreen mode</li>
                    <li>• <strong>Video Controls:</strong> Use the player controls to play, pause, and seek (synced for direct videos)</li>
                  </ul>
                </div>
                
                <div className="bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-xl p-4 border border-green-500/30">
                  <h3 className="font-bold text-lg mb-2 flex items-center gap-2">
                    <span className="text-2xl">✨</span>
                    Pro Tips
                  </h3>
                  <ul className="space-y-2 text-sm text-gray-300 ml-8">
                    <li>• Direct video files are synchronized across all viewers</li>
                    <li>• YouTube and Google Drive videos are not synced (everyone controls their own playback)</li>
                    <li>• Use fullscreen mode for the best viewing experience</li>
                    <li>• All room members can load and control videos together</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
