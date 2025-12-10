import { useState, useEffect } from 'react';
import { User, GameType } from '../types';
import { socketService } from '../services/socket';

interface GameSelectorProps {
  roomCode: string;
  users: User[];
  userId: string;
}

interface GameInvitation {
  inviter: string;
  inviterUserId?: string;
  inviterName: string;
  gameType: GameType;
  playerIds: string[];
}

export default function GameSelector({ roomCode, users, userId }: GameSelectorProps) {
  const [selectedGame, setSelectedGame] = useState<GameType>('uno');
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([userId]);
  const [pendingInvitation, setPendingInvitation] = useState<GameInvitation | null>(null);

  useEffect(() => {
    const socket = socketService.getSocket();
    if (!socket) return;

    socket.on('game-invitation', (data: GameInvitation) => {
      const inviterUserId = data.inviterUserId || data.inviter;
      if (data.playerIds.includes(userId) && inviterUserId !== userId) {
        setPendingInvitation(data);
      }
    });

    socket.on('invitation-declined', () => {
      setPendingInvitation(null);
    });

    return () => {
      socket.off('game-invitation');
      socket.off('invitation-declined');
    };
  }, [userId]);

  const handlePlayerToggle = (playerId: string) => {
    setSelectedPlayers((prev) =>
      prev.includes(playerId)
        ? prev.filter((id) => id !== playerId)
        : [...prev, playerId]
    );
  };

  const handleSendInvitation = () => {
    if (selectedGame === 'chess' && selectedPlayers.length !== 2) {
      alert('Chess requires exactly 2 players');
      return;
    }

    if (selectedPlayers.length < 2) {
      alert('Please select at least 2 players');
      return;
    }

    const socket = socketService.getSocket();
    if (!socket) return;

    const currentUser = users.find(u => u.id === userId);

    socket.emit('send-game-invitation', {
      roomCode,
      gameType: selectedGame,
      playerIds: selectedPlayers,
      inviterName: currentUser?.displayName || 'Player'
    });
  };

  const handleAcceptInvitation = () => {
    if (!pendingInvitation) return;

    const socket = socketService.getSocket();
    if (!socket) return;

    socket.emit('accept-game-invitation', {
      roomCode,
      gameType: pendingInvitation.gameType,
      playerIds: pendingInvitation.playerIds
    });

    setPendingInvitation(null);
  };

  const handleDeclineInvitation = () => {
    if (!pendingInvitation) return;

    const socket = socketService.getSocket();
    if (!socket) return;

    socket.emit('decline-game-invitation', {
      roomCode,
      inviter: pendingInvitation.inviter
    });

    setPendingInvitation(null);
  };

  // Show invitation modal if there's a pending invitation
  if (pendingInvitation) {
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-3 md:p-4">
        <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-6 md:p-8 max-w-md w-full border border-white/10 shadow-2xl">
          <div className="text-center mb-4 md:mb-6">
            <div className="text-5xl md:text-6xl mb-3 md:mb-4">🎮</div>
            <h3 className="text-xl md:text-2xl font-bold text-white mb-2">Game Invitation</h3>
            <p className="text-gray-300">
              <span className="text-indigo-400 font-bold">{pendingInvitation.inviterName}</span> invited you to play
            </p>
            <div className="mt-4 inline-block">
              <span className={`text-3xl font-bold px-4 py-2 rounded-xl ${
                pendingInvitation.gameType === 'uno' ? 'bg-red-500/20 text-red-400' :
                pendingInvitation.gameType === 'ludo' ? 'bg-yellow-500/20 text-yellow-400' :
                'bg-blue-500/20 text-blue-400'
              }`}>
                {pendingInvitation.gameType === 'uno' ? '🎴 UNO' :
                 pendingInvitation.gameType === 'ludo' ? '🎲 Ludo' :
                 '♟️ Chess'}
              </span>
            </div>
          </div>
          <div className="flex gap-4">
            <button
              onClick={handleAcceptInvitation}
              className="flex-1 py-3 bg-green-600 hover:bg-green-500 text-white rounded-xl font-bold transition-all shadow-lg"
            >
              ✓ Accept
            </button>
            <button
              onClick={handleDeclineInvitation}
              className="flex-1 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl font-bold transition-all shadow-lg"
            >
              ✕ Decline
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 md:space-y-8 h-full flex flex-col justify-center max-w-4xl mx-auto px-2 md:px-0">
      <div className="text-center">
        <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">Choose a Game</h2>
        <p className="text-sm md:text-base text-gray-400">Select a game and invite players to start</p>
      </div>

      {/* Game Selection */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 md:gap-6">
        <button
          onClick={() => setSelectedGame('uno')}
          className={`group relative p-4 md:p-6 rounded-2xl border transition-all duration-300 overflow-hidden ${
            selectedGame === 'uno'
              ? 'border-red-500 bg-red-500/10 shadow-[0_0_30px_rgba(239,68,68,0.3)]'
              : 'border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20'
          }`}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-red-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <div className="relative z-10">
            <div className="text-6xl mb-4 transform group-hover:scale-110 transition-transform duration-300">🎴</div>
            <div className="font-bold text-xl text-white mb-1">UNO</div>
            <div className="text-sm text-gray-400">2-4 players</div>
          </div>
        </button>

        <button
          onClick={() => setSelectedGame('ludo')}
          className={`group relative p-6 rounded-2xl border transition-all duration-300 overflow-hidden ${
            selectedGame === 'ludo'
              ? 'border-yellow-500 bg-yellow-500/10 shadow-[0_0_30px_rgba(234,179,8,0.3)]'
              : 'border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20'
          }`}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <div className="relative z-10">
            <div className="text-6xl mb-4 transform group-hover:scale-110 transition-transform duration-300">🎲</div>
            <div className="font-bold text-xl text-white mb-1">Ludo</div>
            <div className="text-sm text-gray-400">2-4 players</div>
          </div>
        </button>

        <button
          onClick={() => setSelectedGame('chess')}
          className={`group relative p-6 rounded-2xl border transition-all duration-300 overflow-hidden ${
            selectedGame === 'chess'
              ? 'border-blue-500 bg-blue-500/10 shadow-[0_0_30px_rgba(59,130,246,0.3)]'
              : 'border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20'
          }`}
        >
          <div className="absolute inset-0 bg-gradient-to-br from-blue-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
          <div className="relative z-10">
            <div className="text-6xl mb-4 transform group-hover:scale-110 transition-transform duration-300">♟️</div>
            <div className="font-bold text-xl text-white mb-1">Chess</div>
            <div className="text-sm text-gray-400">2 players</div>
          </div>
        </button>
      </div>

      {/* Player Selection */}
      <div className="bg-black/20 rounded-2xl p-4 md:p-6 border border-white/5">
        <h3 className="text-sm md:text-base font-semibold text-gray-300 mb-3 md:mb-4 flex items-center gap-2">
          <span className="w-1 h-5 md:h-6 bg-indigo-500 rounded-full"></span>
          Select Players
        </h3>
        <div className="grid grid-cols-1 gap-2 md:gap-3">
          {users.map((user) => (
            <label
              key={user.id}
              className={`flex items-center p-3 rounded-xl cursor-pointer transition-all border ${
                selectedPlayers.includes(user.id)
                  ? 'bg-indigo-600/20 border-indigo-500/50'
                  : 'bg-white/5 border-transparent hover:bg-white/10'
              }`}
            >
              <input
                type="checkbox"
                checked={selectedPlayers.includes(user.id)}
                onChange={() => handlePlayerToggle(user.id)}
                className="w-5 h-5 rounded border-gray-500 text-indigo-600 focus:ring-indigo-500 bg-transparent"
              />
              <span className={`ml-3 font-medium ${selectedPlayers.includes(user.id) ? 'text-white' : 'text-gray-400'}`}>
                {user.displayName} {user.id === userId && '(You)'}
              </span>
            </label>
          ))}
        </div>
      </div>

      {/* Start Button */}
      <button
        onClick={handleSendInvitation}
        disabled={selectedPlayers.length < 2}
        className="w-full py-3 md:py-4 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl font-bold text-base md:text-lg shadow-lg hover:shadow-xl hover:from-indigo-500 hover:to-purple-500 transition-all transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Send Game Invitation
      </button>
    </div>
  );
}
