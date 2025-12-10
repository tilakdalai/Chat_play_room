import { useState, useEffect, useRef } from 'react';
import { YouTubeQueueItem } from '../types';
import { socketService } from '../services/socket';

interface BackgroundMusicPlayerProps {
  queue: YouTubeQueueItem[];
  userId: string;
  roomCode: string;
  isMusicTabActive: boolean;
  currentVideoIndex: number;
  onIndexChange: (index: number) => void;
}

export default function BackgroundMusicPlayer({ 
  queue, 
  roomCode,
  isMusicTabActive,
  currentVideoIndex,
  onIndexChange
}: BackgroundMusicPlayerProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const isLocalAction = useRef(false);

  const currentVideo = queue[currentVideoIndex];

  // Auto-expand when entering music tab, collapse when leaving (optional, but good UX)
  useEffect(() => {
    if (isMusicTabActive) {
      setIsExpanded(true);
    } else {
      setIsExpanded(false);
    }
  }, [isMusicTabActive]);

  // Listen for music state updates from server
  useEffect(() => {
    const socket = socketService.getSocket();
    if (!socket) return;

    socket.on('music-state-updated', (data: { isPlaying: boolean; trackIndex: number }) => {
      if (isLocalAction.current) {
        isLocalAction.current = false;
        return;
      }

      // Sync track index
      if (data.trackIndex !== currentVideoIndex) {
        onIndexChange(data.trackIndex);
      }

      // Sync play/pause state
      if (data.isPlaying !== isPlaying) {
        setIsPlaying(data.isPlaying);
        if (iframeRef.current?.contentWindow) {
          const action = data.isPlaying ? 'playVideo' : 'pauseVideo';
          iframeRef.current.contentWindow.postMessage(JSON.stringify({
            event: 'command',
            func: action,
            args: []
          }), '*');
        }
      }
    });

    return () => {
      socket.off('music-state-updated');
    };
  }, [currentVideoIndex, isPlaying, onIndexChange]);

  // Reset playing state when video changes
  useEffect(() => {
    setIsPlaying(true);
    // Broadcast music state when track changes
    emitMusicState(true, currentVideoIndex);
  }, [currentVideoIndex]);

  const emitMusicState = (playing: boolean, trackIndex: number) => {
    const socket = socketService.getSocket();
    if (!socket) return;

    isLocalAction.current = true;
    socket.emit('update-music-state', {
      roomCode,
      state: {
        isPlaying: playing,
        trackIndex: trackIndex
      }
    });
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentVideoIndex < queue.length - 1) {
      const newIndex = currentVideoIndex + 1;
      onIndexChange(newIndex);
      emitMusicState(true, newIndex);
    }
  };

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentVideoIndex > 0) {
      const newIndex = currentVideoIndex - 1;
      onIndexChange(newIndex);
      emitMusicState(true, newIndex);
    }
  };

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!iframeRef.current?.contentWindow) return;

    const newPlayingState = !isPlaying;
    const action = isPlaying ? 'pauseVideo' : 'playVideo';
    iframeRef.current.contentWindow.postMessage(JSON.stringify({
      event: 'command',
      func: action,
      args: []
    }), '*');
    
    setIsPlaying(newPlayingState);
    emitMusicState(newPlayingState, currentVideoIndex);
  };

  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };

  if (queue.length === 0) return null;

  return (
    <div 
      className={`
        fixed z-50 transition-all duration-500 ease-in-out shadow-2xl overflow-hidden backdrop-blur-xl border border-white/10
        ${isExpanded 
          ? 'bottom-24 right-6 w-[90vw] md:w-96 rounded-3xl bg-black/80' // Expanded: Floating card
          : 'bottom-0 left-0 right-0 h-20 bg-[#0f111a]/90 border-t' // Collapsed: Bottom bar
        }
      `}
    >
      <div className={`flex h-full ${isExpanded ? 'flex-col' : 'flex-row items-center px-4 md:px-8 gap-6'}`}>
        
        {/* Video Container */}
        <div 
          className={`
            relative bg-black transition-all duration-500 ease-in-out group overflow-hidden
            ${isExpanded ? 'w-full aspect-video rounded-t-3xl' : 'w-16 h-10 md:w-24 md:h-14 rounded-lg shadow-lg shrink-0'}
          `}
        >
          {currentVideo ? (
            <iframe
              ref={iframeRef}
              width="100%"
              height="100%"
              src={`https://www.youtube.com/embed/${currentVideo.videoId}?autoplay=1&enablejsapi=1&playsinline=1`}
              title="YouTube video player"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
              className="absolute inset-0 w-full h-full"
            ></iframe>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center text-gray-500 text-xs">
              No Video
            </div>
          )}
          
          {/* Expand/Collapse Overlay */}
          <div 
            className={`absolute inset-0 bg-black/0 hover:bg-black/20 transition-colors cursor-pointer z-10 flex items-center justify-center group-hover:opacity-100 opacity-0`}
            onClick={toggleExpand}
          >
            <span className="text-white drop-shadow-md transform scale-0 group-hover:scale-100 transition-transform duration-300">
              {isExpanded ? '↙' : '↗'}
            </span>
          </div>
        </div>

        {/* Controls & Info */}
        <div 
          className={`flex-1 flex ${isExpanded ? 'flex-col p-6 gap-4' : 'flex-row items-center justify-between'}`}
        >
          {/* Info */}
          <div className={`flex flex-col min-w-0 ${isExpanded ? 'text-center' : ''}`}>
            <div className="flex items-center gap-2 justify-center">
              <p className={`text-white font-bold truncate ${isExpanded ? 'text-lg mb-1' : 'text-sm'}`}>
                {currentVideo?.title || 'No video playing'}
              </p>
              <span className="text-xs text-green-400 flex items-center gap-1" title="Synchronized playback">
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </span>
            </div>
            <p className={`text-gray-400 truncate ${isExpanded ? 'text-sm' : 'text-xs'}`}>
              {currentVideo?.addedByName ? `Added by ${currentVideo.addedByName}` : 'Queue empty'}
            </p>
          </div>

          {/* Playback Controls */}
          <div className={`flex items-center ${isExpanded ? 'justify-center gap-8 mt-2' : 'gap-4'}`}>
            <button 
              onClick={handlePrev}
              disabled={currentVideoIndex === 0}
              className="text-gray-400 hover:text-white disabled:opacity-30 transition-colors p-2 hover:bg-white/5 rounded-full"
              title="Previous"
            >
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>
            </button>

            <button 
              className={`
                flex items-center justify-center rounded-full bg-white text-black hover:scale-105 transition-transform shadow-lg shadow-white/20
                ${isExpanded ? 'w-14 h-14' : 'w-10 h-10'}
              `}
              onClick={togglePlay}
              title={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>
              ) : (
                <svg className="w-5 h-5 ml-0.5" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
              )}
            </button>

            <button 
              onClick={handleNext}
              disabled={currentVideoIndex >= queue.length - 1}
              className="text-gray-400 hover:text-white disabled:opacity-30 transition-colors p-2 hover:bg-white/5 rounded-full"
              title="Next"
            >
              <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
            </button>
          </div>

          {/* Extra Controls (Volume/Expand) - Desktop Only */}
          {!isExpanded && (
            <div className="hidden md:flex items-center gap-4 ml-4 border-l border-white/10 pl-4">
              <button 
                onClick={toggleExpand}
                className="text-gray-400 hover:text-white transition-colors p-2 hover:bg-white/5 rounded-lg"
                title="Expand Player"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" /></svg>
              </button>
            </div>
          )}
        </div>
      </div>
      
      {/* Progress Bar (Visual Only for now) */}
      {isExpanded && (
        <div className="px-6 pb-6">
          <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
            <div className="h-full bg-white/30 w-1/3 rounded-full"></div>
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-2">
            <span>1:23</span>
            <span>3:45</span>
          </div>
        </div>
      )}
    </div>
  );
}
