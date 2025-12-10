import { useState, type FormEvent } from 'react';
import { PublicRoomSummary } from '../types';
import PublicRoomsPanel from './PublicRoomsPanel';

interface LobbyProps {
  onJoinRoom: (code: string, displayName: string) => void;
  onCreateRoom: (displayName: string, visibility: 'public' | 'private') => void;
  publicRooms: PublicRoomSummary[];
}

export default function Lobby({ onJoinRoom, onCreateRoom, publicRooms }: LobbyProps) {
  const [displayName, setDisplayName] = useState('');
  const [roomCode, setRoomCode] = useState('');
  const [mode, setMode] = useState<'join' | 'create'>('join');
  const [roomVisibility, setRoomVisibility] = useState<'public' | 'private'>('private');
  const [showPublicRooms, setShowPublicRooms] = useState(false);

  const handleTogglePublicRooms = () => {
    setShowPublicRooms((prev) => !prev);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmedName = displayName.trim();
    if (!trimmedName) return;

    if (mode === 'create') {
      onCreateRoom(trimmedName, roomVisibility);
    } else if (roomCode.length === 4) {
      onJoinRoom(roomCode, trimmedName);
    }
  };

  const handleSelectPublicRoom = (code: string) => {
    setRoomCode(code);
    const trimmedName = displayName.trim();
    if (trimmedName) {
      onJoinRoom(code, trimmedName);
    }
    setShowPublicRooms(false);
    setMode('join');
  };

  return (
    <div className="relative min-h-screen bg-[#0f111a] p-4 md:p-8 flex items-center justify-center">
      <div className="flex flex-col items-center justify-center gap-6 w-full max-w-5xl md:flex-row md:items-center md:justify-center">
        <div className="glass-panel rounded-2xl shadow-2xl p-6 md:p-8 w-full md:max-w-xl relative overflow-hidden flex flex-col justify-center">
          <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500"></div>

          <div className="text-center mb-8">
            <h1 className="text-5xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-purple-400 mb-2 tracking-tight">
              PlayRoom
            </h1>
            <p className="text-gray-400 font-medium">Play, Chat, Connect</p>
          </div>

          <div className="flex gap-2 mb-8 bg-black/20 p-1 rounded-xl">
            <button
              type="button"
              onClick={() => setMode('join')}
              className={`flex-1 py-2.5 px-4 rounded-lg font-medium transition-all duration-200 ${
                mode === 'join'
                  ? 'bg-indigo-600 text-white shadow-lg'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              Join Room
            </button>
            <button
              type="button"
              onClick={() => setMode('create')}
              className={`flex-1 py-2.5 px-4 rounded-lg font-medium transition-all duration-200 ${
                mode === 'create'
                  ? 'bg-pink-600 text-white shadow-lg'
                  : 'text-gray-400 hover:text-white hover:bg-white/5'
              }`}
            >
              Create Room
            </button>
          </div>

          <button
            type="button"
            onClick={handleTogglePublicRooms}
            className="w-full py-3 mb-4 rounded-xl font-semibold text-sm bg-white/10 hover:bg-white/20 text-gray-200 transition-all border border-white/10"
          >
            {showPublicRooms ? 'Hide Public Rooms' : 'Browse Public Rooms'}
          </button>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2 ml-1">
                Display Name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Enter your name"
                className="w-full px-4 py-3.5 glass-input rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition placeholder-gray-500"
                maxLength={20}
                required
              />
            </div>

            {mode === 'join' && (
              <div className="animate-fadeIn">
                <label className="block text-sm font-medium text-gray-300 mb-2 ml-1">
                  Room Code
                </label>
                <input
                  type="text"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  placeholder="0000"
                  className="w-full px-4 py-3.5 glass-input rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition text-center text-3xl tracking-[0.5em] font-mono placeholder-gray-600"
                  maxLength={4}
                  required
                />
              </div>
            )}

            {mode === 'create' && (
              <div className="animate-fadeIn">
                <label className="block text-sm font-medium text-gray-300 mb-3 ml-1">
                  Room Visibility
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRoomVisibility('private')}
                    className={`px-4 py-3 rounded-xl font-semibold transition-all border ${
                      roomVisibility === 'private'
                        ? 'bg-white/10 border-white/40 text-white shadow-lg shadow-purple-500/20'
                        : 'bg-black/20 border-white/10 text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    Private
                  </button>
                  <button
                    type="button"
                    onClick={() => setRoomVisibility('public')}
                    className={`px-4 py-3 rounded-xl font-semibold transition-all border ${
                      roomVisibility === 'public'
                        ? 'bg-gradient-to-r from-pink-500/30 to-purple-500/30 border-pink-500/40 text-white shadow-lg shadow-pink-500/30'
                        : 'bg-black/20 border-white/10 text-gray-400 hover:text-white hover:bg-white/5'
                    }`}
                  >
                    Public
                  </button>
                </div>
                <p className="text-xs text-gray-400 mt-2 ml-1">
                  Public rooms appear in the lobby list so anyone can join. Private rooms stay hidden and require sharing the code.
                </p>
              </div>
            )}

            <button
              type="submit"
              className={`w-full py-4 rounded-xl font-bold text-lg shadow-lg hover:shadow-xl transition-all transform hover:-translate-y-0.5 ${
                mode === 'create'
                  ? 'bg-gradient-to-r from-pink-600 to-purple-600 hover:from-pink-500 hover:to-purple-500'
                  : 'bg-gradient-to-r from-indigo-600 to-blue-600 hover:from-indigo-500 hover:to-blue-500'
              }`}
            >
              {mode === 'create' ? '🚀 Create Room' : '👋 Join Room'}
            </button>
          </form>

          <div className="mt-8 text-center text-xs text-gray-500">
            <p>No authentication required</p>
            <p className="mt-1">Rooms expire after 10 minutes of inactivity</p>
          </div>
        </div>

      </div>

      {showPublicRooms && (
        <div className="fixed inset-0 z-40 flex items-stretch justify-end">
          <button
            type="button"
            onClick={() => setShowPublicRooms(false)}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            aria-label="Close public rooms"
          ></button>
          <div className="relative z-50 h-full w-full max-w-md animate-fadeIn md:animate-none">
            <PublicRoomsPanel
              rooms={publicRooms}
              onSelectRoom={handleSelectPublicRoom}
              onClose={() => setShowPublicRooms(false)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
