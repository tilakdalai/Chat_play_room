import { useState, useEffect } from 'react';
import { LudoGameState, LudoToken, Room } from '../../types';
import { socketService } from '../../services/socket';

interface LudoGameProps {
  gameState: LudoGameState;
  userId: string;
  roomCode: string;
  onUpdate: (room: Room) => void;
}

// ...existing code...
// Helper to generate path coordinates for all colors based on rotation
const generatePath = (startIndex: number): { x: number; y: number }[] => {
  // Define the generic path loop (52 steps) starting from Green's start (1,6)
  // (row, col)
  const loop: { r: number; c: number }[] = [
    { r: 6, c: 1 }, { r: 6, c: 2 }, { r: 6, c: 3 }, { r: 6, c: 4 }, { r: 6, c: 5 },
    { r: 5, c: 6 }, { r: 4, c: 6 }, { r: 3, c: 6 }, { r: 2, c: 6 }, { r: 1, c: 6 }, { r: 0, c: 6 },
    { r: 0, c: 7 }, { r: 0, c: 8 },
    { r: 1, c: 8 }, { r: 2, c: 8 }, { r: 3, c: 8 }, { r: 4, c: 8 }, { r: 5, c: 8 },
    { r: 6, c: 9 }, { r: 6, c: 10 }, { r: 6, c: 11 }, { r: 6, c: 12 }, { r: 6, c: 13 }, { r: 6, c: 14 },
    { r: 7, c: 14 }, { r: 8, c: 14 },
    { r: 8, c: 13 }, { r: 8, c: 12 }, { r: 8, c: 11 }, { r: 8, c: 10 }, { r: 8, c: 9 },
    { r: 9, c: 8 }, { r: 10, c: 8 }, { r: 11, c: 8 }, { r: 12, c: 8 }, { r: 13, c: 8 }, { r: 14, c: 8 },
    { r: 14, c: 7 }, { r: 14, c: 6 },
    { r: 13, c: 6 }, { r: 12, c: 6 }, { r: 11, c: 6 }, { r: 10, c: 6 }, { r: 9, c: 6 },
    { r: 8, c: 5 }, { r: 8, c: 4 }, { r: 8, c: 3 }, { r: 8, c: 2 }, { r: 8, c: 1 }, { r: 8, c: 0 },
    { r: 7, c: 0 }, { r: 6, c: 0 }
  ];
  
  const path = [];
  for (let i = 0; i < 52; i++) {
    path.push(loop[(startIndex + i) % 52]);
  }
  return path.map(p => ({ x: p.c, y: p.r }));
};

const HOME_RUNS: Record<string, { x: number; y: number }[]> = {
  red: [{ x: 1, y: 7 }, { x: 2, y: 7 }, { x: 3, y: 7 }, { x: 4, y: 7 }, { x: 5, y: 7 }, { x: 6, y: 7 }],
  blue: [{ x: 7, y: 1 }, { x: 7, y: 2 }, { x: 7, y: 3 }, { x: 7, y: 4 }, { x: 7, y: 5 }, { x: 7, y: 6 }],
  green: [{ x: 13, y: 7 }, { x: 12, y: 7 }, { x: 11, y: 7 }, { x: 10, y: 7 }, { x: 9, y: 7 }, { x: 8, y: 7 }],
  yellow: [{ x: 7, y: 13 }, { x: 7, y: 12 }, { x: 7, y: 11 }, { x: 7, y: 10 }, { x: 7, y: 9 }, { x: 7, y: 8 }]
};

const BASE_POSITIONS: Record<string, { x: number; y: number }[]> = {
  red: [{ x: 2, y: 2 }, { x: 3, y: 2 }, { x: 2, y: 3 }, { x: 3, y: 3 }],
  blue: [{ x: 11, y: 2 }, { x: 12, y: 2 }, { x: 11, y: 3 }, { x: 12, y: 3 }],
  green: [{ x: 11, y: 11 }, { x: 12, y: 11 }, { x: 11, y: 12 }, { x: 12, y: 12 }],
  yellow: [{ x: 2, y: 11 }, { x: 3, y: 11 }, { x: 2, y: 12 }, { x: 3, y: 12 }]
};

const GRID_COL_START_CLASSES = [
  'col-start-[1]', 'col-start-[2]', 'col-start-[3]', 'col-start-[4]', 'col-start-[5]',
  'col-start-[6]', 'col-start-[7]', 'col-start-[8]', 'col-start-[9]', 'col-start-[10]',
  'col-start-[11]', 'col-start-[12]', 'col-start-[13]', 'col-start-[14]', 'col-start-[15]'
];

const GRID_ROW_START_CLASSES = [
  'row-start-[1]', 'row-start-[2]', 'row-start-[3]', 'row-start-[4]', 'row-start-[5]',
  'row-start-[6]', 'row-start-[7]', 'row-start-[8]', 'row-start-[9]', 'row-start-[10]',
  'row-start-[11]', 'row-start-[12]', 'row-start-[13]', 'row-start-[14]', 'row-start-[15]'
];

// Star Icon Component
const StarIcon = () => (
  <svg viewBox="0 0 24 24" fill="currentColor" className="w-full h-full text-black/20">
    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
  </svg>
);

export default function LudoGame({ gameState, userId, roomCode }: LudoGameProps) {
  const [diceRolling, setDiceRolling] = useState(false);
  const [diceValue, setDiceValue] = useState<number | null>(null);

  const currentPlayer = gameState.players[gameState.currentPlayerIndex];
  const isMyTurn = currentPlayer.userId === userId;
  const myPlayer = gameState.players.find((p) => p.userId === userId);

  useEffect(() => {
    const socket = socketService.getSocket();
    if (!socket) return;

    socket.on('ludo-dice-rolled', (data: { roll: number }) => {
      setDiceRolling(true);
      // Simulate rolling animation
      let rolls = 0;
      const interval = setInterval(() => {
        setDiceValue(Math.floor(Math.random() * 6) + 1);
        rolls++;
        if (rolls > 10) {
          clearInterval(interval);
          setDiceRolling(false);
          if (data.roll) {
            setDiceValue(data.roll);
          }
        }
      }, 50);
    });

    return () => {
      socket.off('ludo-dice-rolled');
    };
  }, []);

  // Update local dice value when game state changes
  useEffect(() => {
    if (gameState.lastDiceRoll) {
      setDiceValue(gameState.lastDiceRoll);
    }
  }, [gameState.lastDiceRoll]);

  const handleRollDice = () => {
    if (!isMyTurn || diceRolling) return;

    setDiceRolling(true);
    const socket = socketService.getSocket();
    if (!socket) return;

    socket.emit('ludo-roll-dice', {
      roomCode,
      userId
    });
  };

  const handleMoveToken = (tokenId: string) => {
    if (!isMyTurn || !gameState.lastDiceRoll) return;

    const socket = socketService.getSocket();
    if (!socket) return;

    socket.emit('ludo-move-token', {
      roomCode,
      userId,
      tokenId
    });
  };

  const getTokenPosition = (token: LudoToken, color: string): { x: number; y: number } => {
    if (token.state.status === 'yard') {
      // Base position
      const index = gameState.players.find(p => p.color === color)?.tokens.findIndex(t => t.id === token.id) || 0;
      return BASE_POSITIONS[color][index % 4];
    }

    if (token.state.status === 'finished') {
      return { x: 7, y: 7 }; // Center
    }

    if (token.state.status === 'home') {
      // Home run
      const homeIndex = token.state.index;
      return HOME_RUNS[color][homeIndex];
    }

    // Main path
    const path = generatePath(0);
    // The server uses 0-51 indices. 
    // Our path array is 0-51 starting from Red's start (6,1).
    // So we can directly use token.state.index if it matches.
    // Server: Red start = 0. Frontend path[0] = (6,1) = Red start.
    // Matches!
    return path[token.state.index];
  };

  const getColorClass = (color: string) => {
    const colorMap: Record<string, string> = {
      red: 'bg-gradient-to-br from-red-500 to-red-700 shadow-red-900/50',
      blue: 'bg-gradient-to-br from-blue-500 to-blue-700 shadow-blue-900/50',
      green: 'bg-gradient-to-br from-green-500 to-green-700 shadow-green-900/50',
      yellow: 'bg-gradient-to-br from-yellow-400 to-yellow-600 shadow-yellow-900/50'
    };
    return colorMap[color] || 'bg-gray-500';
  };

  const getBaseColorClass = (color: string) => {
    const colorMap: Record<string, string> = {
      red: 'bg-red-600',
      blue: 'bg-blue-600',
      green: 'bg-green-600',
      yellow: 'bg-yellow-400'
    };
    return colorMap[color] || 'bg-gray-500';
  };

  return (
    <div className="space-y-4 h-full flex flex-col items-center">
      {/* Player Info Header */}
      <div className="w-full max-w-[500px] flex justify-between items-center px-2">
        {gameState.players.map((player, idx) => (
          <div 
            key={player.userId} 
            className={`flex flex-col items-center transition-all duration-300 ${
              gameState.currentPlayerIndex === idx ? 'scale-110 opacity-100' : 'opacity-60 scale-90'
            }`}
          >
            <div className={`w-12 h-12 rounded-full border-4 ${getBaseColorClass(player.color)} border-white shadow-lg overflow-hidden bg-gray-800 flex items-center justify-center`}>
              <span className="text-white font-bold text-lg">{player.userId.charAt(0).toUpperCase()}</span>
            </div>
            {gameState.currentPlayerIndex === idx && (
              <div className="mt-1 w-2 h-2 rounded-full bg-white animate-pulse"></div>
            )}
          </div>
        ))}
      </div>

      {/* Board Area */}
      <div 
        className="relative w-full max-w-[500px] aspect-square shadow-2xl rounded-xl overflow-hidden select-none bg-[url('/assets/ludo-board.svg')] bg-cover bg-center"
      >
        <div className="absolute inset-0 grid grid-cols-15 grid-rows-15 w-full h-full">
          {Array.from({ length: 225 }).map((_, i) => {
            const row = Math.floor(i / 15);
            const col = i % 15;
            
            // Determine cell content (Stars/Arrows) - Backgrounds are now handled by the image
            let content = null;
            let cellClass = 'flex items-center justify-center relative'; // Transparent cells

            // Start Squares (Safe) - Arrows might be on the image, but we can keep ours or remove them.
            // The Wikimedia board has arrows. Let's keep ours as an overlay if needed, or remove if it looks cluttered.
            // Let's keep the Stars as they are not on the standard board usually.
            
            // Other Safe Squares (Stars)
            if (row === 8 && col === 2) { content = <StarIcon />; } // Red path star
            if (row === 6 && col === 12) { content = <StarIcon />; } // Green path star
            if (row === 2 && col === 6) { content = <StarIcon />; } // Blue path star
            if (row === 12 && col === 8) { content = <StarIcon />; } // Yellow path star

            return (
              <div key={i} className={cellClass}>
                {content && <div className="w-[80%] h-[80%] opacity-70 text-gray-600">{content}</div>}
              </div>
            );
          })}

          {gameState.players.map((player) =>
            player.tokens.map((token) => {
              const pos = getTokenPosition(token, player.color);
              const colClass = GRID_COL_START_CLASSES[pos.x] || GRID_COL_START_CLASSES[0];
              const rowClass = GRID_ROW_START_CLASSES[pos.y] || GRID_ROW_START_CLASSES[0];
              
              return (
                <button
                  key={token.id}
                  aria-label={`Move token ${token.id}`}
                  title={`Move token ${token.id}`}
                  onClick={() => handleMoveToken(token.id)}
                  disabled={!isMyTurn || player.userId !== userId || !gameState.lastDiceRoll}
                  className={`relative ${colClass} ${rowClass} place-self-center w-3/5 h-3/5 rounded-full border-2 border-white shadow-lg transition-all duration-500 z-20 flex items-center justify-center ${getColorClass(player.color)} ${
                    isMyTurn && player.userId === userId && gameState.lastDiceRoll ? 'animate-bounce cursor-pointer hover:scale-125 ring-2 ring-white' : ''
                  }`}
                >
                  <div className="w-[60%] h-[60%] rounded-full bg-gradient-to-br from-white/40 to-transparent"></div>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Dice Control Bar */}
      <div className="w-full max-w-[500px] bg-gray-900/80 backdrop-blur-md p-4 rounded-2xl border border-white/10 flex items-center justify-between shadow-xl">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-full ${getBaseColorClass(myPlayer?.color || 'red')} flex items-center justify-center text-white font-bold border-2 border-white shadow-lg`}>
            {userId.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-white font-bold text-sm">You</p>
            <p className="text-xs text-gray-400 capitalize">{myPlayer?.color}</p>
          </div>
        </div>

        <div className="relative">
          {isMyTurn && (
            <button
              onClick={handleRollDice}
              disabled={diceRolling || (gameState.lastDiceRoll !== null && !gameState.canRollAgain)}
              className={`w-16 h-16 rounded-xl flex items-center justify-center text-3xl font-bold shadow-lg transition-all transform hover:scale-105 active:scale-95 ${
                diceRolling ? 'animate-spin bg-gray-700' : 'bg-gradient-to-br from-white to-gray-200 text-black'
              } ${!isMyTurn ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer ring-4 ring-pink-500/50'}`}
            >
              {diceValue || '?'}
            </button>
          )}
          {!isMyTurn && (
            <div className="w-16 h-16 bg-gray-800 rounded-xl flex items-center justify-center text-gray-500 border border-gray-700">
              Wait
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
