import { useState, useEffect } from 'react';
import { Room } from '../types';
import { socketService } from '../services/socket';
import Chat from './Chat';
import MusicQueue from './MusicQueue';
import MoviePlayer from './MoviePlayer';
import GameSelector from './GameSelector';
import UnoGame from './games/UnoGame';
import LudoGame from './games/LudoGame';
import ChessGame from './games/ChessGame';
import BackgroundMusicPlayer from './BackgroundMusicPlayer';
import Sidebar from './Sidebar';
import ScreenMirror from './ScreenMirror';
import AdminPanel from './AdminPanel';

interface RoomViewProps {
  room: Room;
  userId: string;
  roomCode: string;
  onLeave: () => void;
  onRoomUpdate: (room: Room) => void;
}

export default function RoomView({ room, userId, roomCode, onLeave, onRoomUpdate }: RoomViewProps) {
  const [activeTab, setActiveTab] = useState<'chat' | 'music' | 'game' | 'movie' | 'mirror'>('chat');
  const [currentVideoIndex, setCurrentVideoIndex] = useState(room.currentTrackIndex ?? 0);

  useEffect(() => {
    if (typeof room.currentTrackIndex === 'number') {
      setCurrentVideoIndex(room.currentTrackIndex);
    }
  }, [room.currentTrackIndex]);

  const handleMusicIndexChange = (index: number) => {
    setCurrentVideoIndex(index);
    const socket = socketService.getSocket();
    socket?.emit('set-current-track', { roomCode, index });
  };

  const handleLeaveGame = () => {
    if (confirm('Are you sure you want to leave the game? This will end the game for everyone.')) {
      const socket = socketService.getSocket();
      if (!socket) return;
      socket.emit('leave-game', { roomCode, userId });
    }
  };

  return (
    <div className="flex flex-col md:flex-row h-screen w-full overflow-hidden bg-[#0f111a]">
      {/* Sidebar Navigation */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        onLeave={onLeave} 
        roomCode={roomCode}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col h-full relative overflow-hidden order-first md:order-last">
        
        {/* Top Bar (User Info & Room Status) */}
        <div className="h-14 md:h-16 flex items-center justify-between px-3 md:px-6 border-b border-white/5 bg-black/20 backdrop-blur-sm z-30">
          <div className="flex items-center gap-2 md:gap-3">
            <h2 className="text-base md:text-lg font-semibold text-white/90">
              {activeTab === 'chat' && 'Live Chat'}
              {activeTab === 'music' && 'Music Station'}
              {activeTab === 'game' && 'Game Room'}
              {activeTab === 'movie' && 'Movie Theater'}
              {activeTab === 'mirror' && 'Screen Mirror'}
            </h2>
            <span
              className={`hidden md:inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold tracking-wide uppercase border ${
                room.visibility === 'public'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-200'
                  : 'bg-slate-500/10 border-slate-500/30 text-slate-200'
              }`}
            >
              {room.visibility === 'public' ? 'Public Room' : 'Private Room'}
            </span>
            {/* Mobile Room Code Badge */}
            <div className="md:hidden flex items-center gap-1 px-2 py-1 bg-indigo-500/20 rounded-lg text-xs font-mono text-indigo-200 font-bold border border-indigo-500/30 shadow-[0_0_10px_rgba(99,102,241,0.2)]">
              <span className="text-[10px] opacity-70">CODE:</span>
              {roomCode}
            </div>
          </div>

          <div className="flex items-center gap-2 md:gap-4">
            {/* Admin Panel Button */}
            <AdminPanel 
              users={room.users}
              userId={userId}
              isAdmin={room.users.find(u => u.id === userId)?.isAdmin || false}
              roomCode={roomCode}
            />

            <div className="flex -space-x-1.5 md:-space-x-2 overflow-hidden">
              {room.users.map((user) => (
                <div
                  key={user.id}
                  className={`w-7 h-7 md:w-8 md:h-8 rounded-full border-2 border-[#0f111a] flex items-center justify-center text-white font-bold text-xs shadow-lg relative group cursor-help ${
                    user.isAdmin 
                      ? 'bg-gradient-to-br from-yellow-500 to-orange-500' 
                      : 'bg-gradient-to-br from-indigo-500 to-purple-500'
                  }`}
                  title={`${user.displayName}${user.isAdmin ? ' (Admin)' : ''}`}
                >
                  {user.displayName.charAt(0).toUpperCase()}
                  {user.isAdmin && (
                    <div className="absolute -top-1 -right-1 text-xs">👑</div>
                  )}
                  {user.id === userId && (
                    <div className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-[#0f111a] rounded-full"></div>
                  )}
                </div>
              ))}
            </div>
            <div className="hidden md:block h-8 w-px bg-white/10 mx-2"></div>
            <div className="flex items-center gap-1.5 md:gap-2 text-xs md:text-sm text-gray-400">
              <span className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-green-500 animate-pulse"></span>
              <span className="hidden sm:inline">{room.users.length} Online</span>
              <span className="sm:hidden">{room.users.length}</span>
            </div>
          </div>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-hidden relative p-2 md:p-4 lg:p-6">
          <div className="h-full w-full max-w-7xl mx-auto bg-black/20 backdrop-blur-md rounded-2xl md:rounded-3xl border border-white/5 overflow-hidden shadow-2xl">
            {activeTab === 'chat' && (
              <Chat
                messages={room.messages}
                userId={userId}
                roomCode={roomCode}
              />
            )}
            {activeTab === 'music' && (
              <MusicQueue
                queue={room.youtubeQueue}
                userId={userId}
                roomCode={roomCode}
                currentVideoIndex={currentVideoIndex}
                onPlayNow={handleMusicIndexChange}
              />
            )}
            {activeTab === 'movie' && (
              <MoviePlayer
                roomCode={roomCode}
                movieUrl={room.movieUrl}
                movieState={room.movieState}
              />
            )}
            {activeTab === 'mirror' && (
              <ScreenMirror roomCode={roomCode} userId={userId} participants={room.users} />
            )}
            {activeTab === 'game' && (
              <>
                {!room.currentGame ? (
                  <GameSelector roomCode={roomCode} users={room.users} userId={userId} />
                ) : (
                  <div className="flex flex-col h-full">
                    <div className="flex justify-end mb-4 p-4">
                      <button
                        onClick={handleLeaveGame}
                        className="px-4 py-2 bg-red-500/20 text-red-400 border border-red-500/50 rounded-lg hover:bg-red-500 hover:text-white transition-all duration-200 font-medium text-sm flex items-center gap-2"
                      >
                        <span>🚫</span> End Game
                      </button>
                    </div>
                    <div className="flex-1 overflow-hidden px-4 pb-4">
                      {room.currentGame === 'uno' && (
                        <UnoGame gameState={room.gameState} userId={userId} roomCode={roomCode} onUpdate={onRoomUpdate} />
                      )}
                      {room.currentGame === 'ludo' && (
                        <LudoGame gameState={room.gameState} userId={userId} roomCode={roomCode} onUpdate={onRoomUpdate} />
                      )}
                      {room.currentGame === 'chess' && (
                        <ChessGame gameState={room.gameState} userId={userId} roomCode={roomCode} onUpdate={onRoomUpdate} />
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Persistent Background Music Player */}
        <BackgroundMusicPlayer 
          queue={room.youtubeQueue} 
          userId={userId} 
          roomCode={roomCode} 
          isMusicTabActive={activeTab === 'music'}
          currentVideoIndex={currentVideoIndex}
          onIndexChange={handleMusicIndexChange}
        />
      </div>
    </div>
  );
}
