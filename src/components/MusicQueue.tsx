import { useState } from 'react';
import { YouTubeQueueItem } from '../types';
import { socketService } from '../services/socket';

interface MusicQueueProps {
  queue: YouTubeQueueItem[];
  userId: string;
  roomCode: string;
  currentVideoIndex: number;
  onPlayNow: (index: number) => void;
}

interface SearchResult {
  videoId: string;
  title: string;
  thumbnail: string;
  channel: string;
  duration: number;
}

export default function MusicQueue({ queue, userId, roomCode, currentVideoIndex, onPlayNow }: MusicQueueProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    const socket = socketService.getSocket();
    if (!socket) return;

    socket.emit('search-youtube', searchQuery, (response: any) => {
      setIsSearching(false);
      if (response.success) {
        setSearchResults(response.results);
      } else {
        alert('Search failed: ' + response.error);
      }
    });
  };

  const handleAdd = (video: SearchResult) => {
    const socket = socketService.getSocket();
    if (!socket) return;

    socket.emit('add-to-queue', {
      roomCode,
      userId,
      videoId: video.videoId,
      title: video.title
    }, (response: any) => {
      if (response.success) {
        // Optional: Clear search or show success toast
      }
    });
  };

  const handlePlayNext = (video: SearchResult) => {
    const socket = socketService.getSocket();
    if (!socket) return;

    socket.emit('add-to-queue', {
      roomCode,
      userId,
      videoId: video.videoId,
      title: video.title,
      index: currentVideoIndex + 1
    }, (response: any) => {
      if (response.success) {
        // Toast?
      }
    });
  };

  const handlePlayNow = (video: SearchResult) => {
    const socket = socketService.getSocket();
    if (!socket) return;

    socket.emit('add-to-queue', {
      roomCode,
      userId,
      videoId: video.videoId,
      title: video.title,
      index: currentVideoIndex + 1
    }, (response: any) => {
      if (response.success) {
        onPlayNow(currentVideoIndex + 1);
      }
    });
  };

  const handleRemove = (itemId: string) => {
    const socket = socketService.getSocket();
    if (!socket) return;

    socket.emit('remove-from-queue', {
      roomCode,
      itemId
    });
  };

  return (
    <div className="h-full flex flex-col lg:flex-row gap-6 overflow-hidden">
      {/* Left Column: Search */}
      <div className="flex-1 flex flex-col min-w-0 h-full">
        <div className="bg-white/5 backdrop-blur-sm p-6 rounded-3xl border border-white/10 shadow-xl mb-6">
          <h3 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-purple-400 mb-4">
            Discover Music
          </h3>
          <form onSubmit={handleSearch} className="relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <span className="text-gray-400 group-focus-within:text-pink-500 transition-colors">🔍</span>
            </div>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search for songs, artists, or albums..."
              className="w-full pl-9 md:pl-11 pr-3 md:pr-4 py-3 md:py-4 bg-black/40 border border-white/10 rounded-2xl text-sm md:text-base text-white placeholder-gray-500 focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500/50 outline-none transition-all shadow-inner"
            />
            <button
              type="submit"
              disabled={isSearching}
              className="absolute right-2 top-2 bottom-2 px-4 md:px-6 bg-gradient-to-r from-pink-600 to-purple-600 text-white rounded-xl hover:from-pink-500 hover:to-purple-500 transition-all text-sm md:text-base font-medium shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSearching ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : 'Search'}
            </button>
          </form>
        </div>

        {/* Search Results */}
        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
          {searchResults.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-500 space-y-4">
              <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center">
                <span className="text-5xl">🎵</span>
              </div>
              <p className="text-lg font-medium">Search for your favorite tracks</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-3 md:gap-4">
              {searchResults.map((video) => (
                <div key={video.videoId} className="group bg-white/5 hover:bg-white/10 border border-white/5 hover:border-pink-500/30 rounded-2xl p-3 transition-all duration-300 hover:-translate-y-1 hover:shadow-xl hover:shadow-pink-500/10 flex flex-col">
                  <div className="aspect-video bg-black rounded-xl overflow-hidden relative mb-3 shadow-lg">
                    <img src={video.thumbnail} alt={video.title} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-between p-3">
                       <span className="text-xs font-mono bg-black/60 px-2 py-1 rounded text-white backdrop-blur-sm">
                        {Math.floor(video.duration / 60)}:{String(video.duration % 60).padStart(2, '0')}
                      </span>
                    </div>
                    
                    {/* Hover Play Overlay */}
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 bg-black/40 backdrop-blur-[2px]">
                      <button
                        onClick={() => handlePlayNow(video)}
                        className="w-12 h-12 rounded-full bg-pink-600 text-white flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
                        title="Play Now"
                      >
                        ▶
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex-1 min-w-0 mb-3">
                    <h4 className="text-white font-semibold text-sm line-clamp-2 mb-1 group-hover:text-pink-400 transition-colors" title={video.title}>{video.title}</h4>
                    <p className="text-gray-400 text-xs truncate flex items-center gap-1">
                      <span>👤</span> {video.channel}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-auto">
                    <button
                      onClick={() => handlePlayNext(video)}
                      className="px-3 py-2 bg-white/5 hover:bg-purple-600/20 text-gray-300 hover:text-purple-300 border border-white/10 hover:border-purple-500/50 rounded-lg transition-all text-xs font-medium flex items-center justify-center gap-1"
                    >
                      <span>⏭</span> Play Next
                    </button>
                    <button
                      onClick={() => handleAdd(video)}
                      className="px-3 py-2 bg-white/5 hover:bg-blue-600/20 text-gray-300 hover:text-blue-300 border border-white/10 hover:border-blue-500/50 rounded-lg transition-all text-xs font-medium flex items-center justify-center gap-1"
                    >
                      <span>➕</span> Queue
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Right Column: Queue List */}
      <div className="w-full lg:w-96 flex flex-col h-full bg-black/20 backdrop-blur-xl border-t lg:border-t-0 lg:border-l border-white/5 -mr-0 lg:-mr-6 p-3 md:p-6">
        <h3 className="text-lg md:text-xl font-bold text-white mb-4 md:mb-6 flex items-center gap-2 md:gap-3">
          <span className="w-1 md:w-1.5 h-5 md:h-6 bg-gradient-to-b from-pink-500 to-purple-500 rounded-full"></span>
          Up Next
          <span className="text-xs font-normal text-gray-500 bg-white/5 px-2 py-1 rounded-full border border-white/5">
            {queue.length} tracks
          </span>
        </h3>
        
        <div className="flex-1 overflow-y-auto custom-scrollbar -mx-2 px-2 space-y-2">
          {queue.length === 0 ? (
            <div className="h-40 flex flex-col items-center justify-center text-gray-500 border-2 border-dashed border-white/5 rounded-2xl">
              <p>Queue is empty</p>
              <p className="text-sm opacity-50">Add some tunes! 🎸</p>
            </div>
          ) : (
            queue.map((item, index) => {
              const isPlaying = index === currentVideoIndex;
              return (
                <div
                  key={item.id}
                  className={`
                    relative flex items-center gap-3 p-3 rounded-xl transition-all duration-300 group
                    ${isPlaying 
                      ? 'bg-gradient-to-r from-pink-600/20 to-purple-600/20 border border-pink-500/30 shadow-[0_0_15px_rgba(236,72,153,0.1)]' 
                      : 'bg-white/5 border border-transparent hover:bg-white/10 hover:border-white/10'
                    }
                  `}
                >
                  {/* Playing Indicator / Number */}
                  <div className={`
                    w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 transition-colors
                    ${isPlaying ? 'bg-pink-500 text-white' : 'bg-black/30 text-gray-500 group-hover:text-white'}
                  `}>
                    {isPlaying ? (
                      <div className="flex gap-0.5 items-end h-3">
                        <div className="w-0.5 bg-white animate-[music-bar_0.5s_ease-in-out_infinite] h-2"></div>
                        <div className="w-0.5 bg-white animate-[music-bar_0.5s_ease-in-out_0.1s_infinite] h-3"></div>
                        <div className="w-0.5 bg-white animate-[music-bar_0.5s_ease-in-out_0.2s_infinite] h-1"></div>
                      </div>
                    ) : (
                      index + 1
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className={`font-medium truncate text-sm ${isPlaying ? 'text-pink-200' : 'text-gray-300 group-hover:text-white'}`}>
                      {item.title || `Video ${item.videoId}`}
                    </div>
                    <div className="text-xs text-gray-500 flex items-center gap-1">
                      <span className="w-3 h-3 rounded-full bg-white/10 flex items-center justify-center text-[8px]">👤</span>
                      {item.addedBy === userId ? 'You' : item.addedByName || 'User'}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={() => onPlayNow(index)}
                      className="p-1.5 text-gray-400 hover:text-white hover:bg-white/10 rounded-lg transition-colors mr-1"
                      title="Play This"
                    >
                      ▶
                    </button>
                    <button
                      onClick={() => handleRemove(item.id)}
                      className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                      title="Remove"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
