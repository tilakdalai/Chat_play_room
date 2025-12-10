import { useState, useEffect } from 'react';
import { UnoGameState, UnoCard, UnoColor, Room } from '../../types';
import { socketService } from '../../services/socket';

interface UnoGameProps {
  gameState: UnoGameState;
  userId: string;
  roomCode: string;
  onUpdate: (room: Room) => void;
}

export default function UnoGame({ gameState, userId, roomCode }: UnoGameProps) {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);

  const turnIndex = gameState.turnIndex;
  const players = gameState.players;
  const currentPlayer = players[turnIndex];
  const isMyTurn = currentPlayer?.id === userId;
  
  // Use myHand from gameState (injected by App.tsx)
  const myHand = gameState.myHand || [];
  const myPlayer = players.find(p => p.id === userId);
  
  const topCard = gameState.discardTop;
  const winner = gameState.winnerOrder.length > 0 ? players.find(p => p.id === gameState.winnerOrder[0]) : null;

  useEffect(() => {
    const socket = socketService.getSocket();
    if (!socket) return;

    socket.on('uno-card-played', () => {
      setShowColorPicker(false);
      setSelectedCardId(null);
    });

    return () => {
      socket.off('uno-card-played');
    };
  }, []);

  const getCardColor = (card: UnoCard) => {
    const colorMap: Record<string, string> = {
      red: 'bg-red-500',
      blue: 'bg-blue-500',
      green: 'bg-green-500',
      yellow: 'bg-yellow-400',
      wild: 'bg-purple-600' // Wild color
    };
    return card.color ? colorMap[card.color] : 'bg-gray-800';
  };

  const getCardDisplay = (card: UnoCard) => {
    if (card.type === 'number') return card.value;
    if (card.type === 'skip') return '🚫';
    if (card.type === 'reverse') return '🔄';
    if (card.type === 'draw2') return '+2';
    if (card.type === 'wild') return 'W';
    if (card.type === 'wild_draw4') return '+4';
    return '?';
  };

  const isCardPlayable = (card: UnoCard) => {
    if (!isMyTurn) return false;
    
    // If we just drawn a card, we can only play THAT card
    if (gameState.turnState === 'drawn_card' && gameState.drawnCardId) {
      return card.id === gameState.drawnCardId;
    }

    if (!topCard) return true; 
    
    // Wild Draw 4 Restriction (Client side check for visual feedback)
    if (card.type === 'wild_draw4' && gameState.config.enforceWildDraw4Restriction) {
       const hasColorMatch = myHand.some(c => c.id !== card.id && c.color === gameState.currentColor);
       if (hasColorMatch) return false;
    }

    if (card.type === 'wild' || card.type === 'wild_draw4') return true;
    if (card.color === gameState.currentColor) return true;
    if (card.type === topCard.type && card.type !== 'number') return true;
    if (card.type === 'number' && topCard.type === 'number' && card.value === topCard.value) return true;
    
    return false;
  };

  const handlePlayCard = (cardId: string, card: UnoCard) => {
    if (!isMyTurn) return;
    if (!isCardPlayable(card)) return;

    if (card.type === 'wild' || card.type === 'wild_draw4') {
      setSelectedCardId(cardId);
      setShowColorPicker(true);
      return;
    }

    const socket = socketService.getSocket();
    if (!socket) return;

    socket.emit('uno-play-card', {
      roomCode,
      userId,
      cardId
    });
  };

  const handleColorSelect = (color: UnoColor) => {
    if (!selectedCardId) return;

    const socket = socketService.getSocket();
    if (!socket) return;

    socket.emit('uno-play-card', {
      roomCode,
      userId,
      cardId: selectedCardId,
      chosenColor: color
    });
    
    setShowColorPicker(false);
    setSelectedCardId(null);
  };

  const handleDrawCard = () => {
    if (!isMyTurn) return;
    if (gameState.turnState === 'drawn_card') return; // Can't draw again

    const socket = socketService.getSocket();
    if (!socket) return;

    socket.emit('uno-draw-card', {
      roomCode,
      userId
    });
  };

  const handlePassTurn = () => {
    if (!isMyTurn) return;
    if (gameState.turnState !== 'drawn_card') return;

    const socket = socketService.getSocket();
    if (!socket) return;

    socket.emit('uno-pass-turn', {
      roomCode,
      userId
    });
  };

  const handleCallUno = () => {
    const socket = socketService.getSocket();
    if (!socket) return;

    socket.emit('uno-call-uno', {
      roomCode,
      userId
    });
  };

  const handleCatchUnoFailure = (targetId: string) => {
    const socket = socketService.getSocket();
    if (!socket) return;

    socket.emit('uno-catch-failure', {
      roomCode,
      userId,
      targetId
    });
  };

  if (winner) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-gray-900 text-white">
        <h1 className="text-6xl font-bold mb-4 text-yellow-400">Winner!</h1>
        <p className="text-2xl">{winner.name} has won the game!</p>
        <button 
          onClick={() => window.location.reload()} 
          className="mt-8 px-6 py-3 bg-blue-600 rounded-lg hover:bg-blue-700"
        >
          Back to Lobby
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-gray-900 text-white p-4 relative">
      {/* Game Info */}
      <div className="flex justify-between items-center mb-4">
        <div>
          <h2 className="text-xl font-bold">UNO</h2>
          <p className="text-sm text-gray-400 flex items-center gap-2">
            Current Color: <span className={`inline-block w-6 h-6 rounded-full border-2 border-white ${getCardColor({ color: gameState.currentColor } as UnoCard)}`}></span>
          </p>
        </div>
        <div className="text-right">
           <p>Direction: {gameState.direction === 1 ? 'Clockwise ↻' : 'Counter-Clockwise ↺'}</p>
        </div>
      </div>

      {/* Opponents */}
      <div className="flex flex-wrap justify-center gap-4 mb-8">
        {players.map((player) => {
          if (player.id === userId) return null;
          const isCurrent = player.id === currentPlayer?.id;
          return (
            <div key={player.id} className={`relative p-3 rounded-lg border min-w-[100px] text-center ${isCurrent ? 'border-yellow-400 bg-gray-800 shadow-[0_0_10px_rgba(250,204,21,0.5)]' : 'border-gray-700 bg-gray-800/50'}`}>
              <p className="font-bold">{player.name}</p>
              <p className="text-sm">{player.handCount} cards</p>
              {player.unoCalled && (
                <span className="absolute -top-2 -right-2 bg-red-600 text-white text-xs font-bold px-2 py-1 rounded-full animate-bounce">
                  UNO!
                </span>
              )}
              {player.handCount === 1 && !player.unoCalled && (
                <button
                  onClick={() => handleCatchUnoFailure(player.id)}
                  className="absolute -bottom-3 left-1/2 transform -translate-x-1/2 bg-yellow-600 hover:bg-yellow-500 text-white text-xs font-bold px-2 py-1 rounded-full shadow-lg animate-pulse z-20"
                >
                  CATCH!
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* Center Area (Discard Pile & Draw Deck) */}
      <div className="flex-1 flex justify-center items-center gap-8 mb-8">
        {/* Draw Deck */}
        <div className="flex flex-col items-center gap-2">
          <div 
              className={`w-24 h-36 bg-gray-800 rounded-xl border-2 border-white flex items-center justify-center cursor-pointer hover:bg-gray-700 transition-colors ${isMyTurn && gameState.turnState !== 'drawn_card' ? 'ring-4 ring-yellow-400 animate-pulse' : 'opacity-80'}`}
              onClick={handleDrawCard}
          >
            <span className="text-2xl font-bold">UNO</span>
          </div>
          {isMyTurn && gameState.turnState === 'drawn_card' && (
            <button 
              onClick={handlePassTurn}
              className="px-4 py-2 bg-gray-600 rounded hover:bg-gray-500 text-sm"
            >
              Pass
            </button>
          )}
        </div>

        {/* Discard Pile */}
        {topCard && (
          <div className={`w-24 h-36 rounded-xl border-2 border-white flex items-center justify-center ${getCardColor(topCard)} shadow-2xl transform rotate-3`}>
            <span className="text-4xl font-bold text-white drop-shadow-md">
              {getCardDisplay(topCard)}
            </span>
          </div>
        )}
      </div>

      {/* My Hand */}
      <div className="mt-auto relative">
        {/* UNO Button */}
        <div className="absolute -top-16 right-4">
           <button
             onClick={handleCallUno}
             disabled={!myPlayer || (myPlayer.handCount || 0) > 2 || myPlayer.unoCalled}
             className={`
               w-16 h-16 rounded-full font-bold text-white shadow-lg transition-all
               ${(!myPlayer || (myPlayer.handCount || 0) > 2 || myPlayer.unoCalled) 
                 ? 'bg-gray-600 opacity-50 cursor-not-allowed' 
                 : 'bg-red-600 hover:bg-red-500 hover:scale-110 animate-pulse'}
             `}
           >
             UNO!
           </button>
        </div>

        <div className="flex justify-center items-end gap-2 overflow-x-auto pb-4 min-h-[160px] px-4">
          {myHand.map((card, index) => {
            const playable = isCardPlayable(card);
            return (
              <div
                key={card.id}
                onClick={() => handlePlayCard(card.id, card)}
                className={`
                  relative w-24 h-36 rounded-xl border-2 flex-shrink-0 flex items-center justify-center cursor-pointer transition-all duration-200
                  ${getCardColor(card)}
                  ${playable ? 'border-white -translate-y-4 hover:-translate-y-8 hover:shadow-[0_0_15px_rgba(255,255,255,0.5)] z-10' : 'border-transparent opacity-60 hover:opacity-100 mt-4'}
                  ${index !== 0 ? '-ml-10' : ''}
                `}
              >
                <span className="text-4xl font-bold text-white drop-shadow-md">
                  {getCardDisplay(card)}
                </span>
                {/* Small corner values */}
                <span className="absolute top-1 left-2 text-sm font-bold">{getCardDisplay(card)}</span>
                <span className="absolute bottom-1 right-2 text-sm font-bold">{getCardDisplay(card)}</span>
              </div>
            );
          })}
        </div>
        {isMyTurn && (
          <p className="text-center text-yellow-400 font-bold mt-2 animate-bounce">
            {gameState.turnState === 'drawn_card' ? 'Play drawn card or Pass' : 'Your Turn!'}
          </p>
        )}
      </div>

      {/* Color Picker Modal */}
      {showColorPicker && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-xl border border-gray-600 shadow-2xl">
            <h3 className="text-xl font-bold mb-4 text-center text-white">Choose Color</h3>
            <div className="grid grid-cols-2 gap-4">
              {(['red', 'blue', 'green', 'yellow'] as UnoColor[]).map((color) => (
                <button
                  key={color}
                  onClick={() => handleColorSelect(color)}
                  aria-label={`Select ${color}`}
                  title={`Select ${color}`}
                  className={`w-24 h-24 rounded-lg ${getCardColor({ color } as UnoCard)} hover:scale-105 transition-transform shadow-lg`}
                />
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
