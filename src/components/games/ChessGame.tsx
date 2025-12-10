import { useState, useEffect, useRef, useCallback } from 'react';
import { ChessBoard } from '../ChessBoard';
import {
  GameState, Move, fenToGameState, gameStateToFEN, makeMove, undoMove,
  generateLegalMoves, gameStatus, initialFEN, PieceType, findKingSquare, cloneGameState
} from '../../lib/chessEngine';

// Worker setup
import AiWorker from '../../workers/aiWorker?worker';

interface ChessGameProps {
  // Legacy props from RoomView (multiplayer) - currently ignored for local/AI mode
  gameState?: any;
  userId?: string;
  roomCode?: string;
  onUpdate?: (room: any) => void;
  
  // New props
  initialState?: string;
}

export default function ChessGame({ initialState }: ChessGameProps) {
  const [gameState, setGameState] = useState<GameState>(() => {
    try {
      return fenToGameState(initialState || localStorage.getItem('chess_fen') || initialFEN);
    } catch (e) {
      return fenToGameState(initialFEN);
    }
  });
  const [legalMoves, setLegalMoves] = useState<Move[]>([]);
  const [history, setHistory] = useState<string[]>([]); // For display
  const [status, setStatus] = useState<{check:boolean, checkmate:boolean, stalemate:boolean, draw:boolean}>({check:false, checkmate:false, stalemate:false, draw:false});
  const [promotionPending, setPromotionPending] = useState<{from: number, to: number} | null>(null);
  const [aiDepth, setAiDepth] = useState(3);
  const [playVsAi, setPlayVsAi] = useState(true);
  const [aiColor, setAiColor] = useState<'w'|'b'>('b');
  const [isThinking, setIsThinking] = useState(false);
  
  const workerRef = useRef<Worker | null>(null);

  useEffect(() => {
    workerRef.current = new AiWorker();
    workerRef.current.onmessage = (e) => {
      const { bestMove } = e.data;
      setIsThinking(false);
      if (bestMove) {
        applyMove(bestMove);
      }
    };
    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  // Update legal moves and status whenever game state changes
  useEffect(() => {
    const moves = generateLegalMoves(gameState);
    setLegalMoves(moves);
    const s = gameStatus(gameState);
    setStatus(s);
    
    // Persist
    localStorage.setItem('chess_fen', gameStateToFEN(gameState));

    // AI Turn
    if (playVsAi && !s.checkmate && !s.stalemate && !s.draw && gameState.turn === aiColor && !isThinking) {
      setIsThinking(true);
      workerRef.current?.postMessage({
        fen: gameStateToFEN(gameState),
        depth: aiDepth,
        color: aiColor
      });
    }
  }, [gameState, playVsAi, aiColor, aiDepth]);

  const applyMove = useCallback((move: Move) => {
    // Create a proper copy to avoid mutations
    const newState = cloneGameState(gameState);
    makeMove(newState, move);
    
    setGameState(newState);
    
    // Update history display (simple algebraic)
    const piece = move.piece.type.toUpperCase();
    const capture = move.captured ? 'x' : '';
    const moveString = `${piece !== 'P' ? piece : ''}${capture}${squareToAlgebraic(move.to)}${move.promotion ? '=' + move.promotion.toUpperCase() : ''}`;
    setHistory(prev => [...prev, moveString]);
  }, [gameState]);

  const handleMoveRequest = (move: Move) => {
    const matchingMoves = legalMoves.filter(m => m.from === move.from && m.to === move.to);
    if (matchingMoves.length > 1) {
      // Ambiguous (promotion)
      setPromotionPending({ from: move.from, to: move.to });
    } else {
      applyMove(move);
    }
  };

  const handlePromotionSelect = (type: PieceType) => {
    if (!promotionPending) return;
    const move = legalMoves.find(m => 
      m.from === promotionPending.from && 
      m.to === promotionPending.to && 
      m.promotion === type
    );
    if (move) {
      applyMove(move);
    }
    setPromotionPending(null);
  };

  const handleUndo = () => {
    if (gameState.history.length === 0) return;
    const newState = cloneGameState(gameState);
    undoMove(newState);
    // If vs AI, undo twice to get back to player turn
    if (playVsAi && newState.turn === aiColor && newState.history.length > 0) {
      undoMove(newState);
      setHistory(prev => prev.slice(0, -2));
    } else {
      setHistory(prev => prev.slice(0, -1));
    }
    setGameState(newState);
    setIsThinking(false); // Cancel AI if it was thinking
  };

  const handleRestart = () => {
    setGameState(fenToGameState(initialFEN));
    setHistory([]);
    setIsThinking(false);
  };

  const squareToAlgebraic = (s: number) => {
    const f = s % 8;
    const r = Math.floor(s / 8) + 1;
    return `${String.fromCharCode(97+f)}${r}`;
  };

  const kingSq = findKingSquare(gameState, gameState.turn);

  return (
    <div className="flex flex-col md:flex-row gap-4 p-4 max-w-7xl mx-auto h-full bg-gradient-to-br from-amber-50 via-stone-100 to-amber-100 overflow-hidden">
      {/* Main Board Area */}
      <div className="flex-1 flex flex-col items-center justify-center min-h-0">
        <div className="w-full max-w-[600px] aspect-square">
          <ChessBoard 
            gameState={gameState}
            legalMoves={legalMoves}
            onMove={handleMoveRequest}
            orientation={playVsAi && aiColor === 'w' ? 'b' : 'w'}
            lastMove={gameState.history.length > 0 ? gameState.history[gameState.history.length - 1].move : null}
            checkSquare={status.check ? kingSq : null}
          />
        </div>
        
        {/* Status Bar */}
        <div className="mt-4 p-4 bg-gradient-to-r from-amber-100 to-amber-200 rounded-lg shadow-lg w-full max-w-[600px] text-center border-2 border-amber-800">
          <h2 className="text-xl md:text-2xl font-bold mb-2">
            {status.checkmate ? (
              <span className="text-red-600">♔ Checkmate! {gameState.turn === 'w' ? 'Black' : 'White'} wins! ♔</span>
            ) : status.stalemate ? (
              <span className="text-gray-600">Stalemate - Draw!</span>
            ) : status.draw ? (
              <span className="text-gray-600">Draw!</span>
            ) : status.check ? (
              <span className="text-red-500 animate-pulse">⚠️ Check! ⚠️</span>
            ) : (
              <span className={gameState.turn === 'w' ? 'text-gray-700' : 'text-gray-800'}>
                {gameState.turn === 'w' ? "⚪ White" : "⚫ Black"}'s Turn
              </span>
            )}
          </h2>
          {isThinking && (
            <div className="text-blue-600 font-semibold animate-pulse flex items-center justify-center gap-2">
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
              </svg>
              AI is thinking...
            </div>
          )}
        </div>
      </div>

      {/* Sidebar */}
      <div className="w-full md:w-80 bg-gradient-to-br from-amber-50 to-amber-100 p-4 rounded-lg shadow-xl flex flex-col gap-4 overflow-y-auto h-full border-2 border-amber-800">
        <h1 className="text-3xl font-bold text-amber-900 flex items-center gap-2">
          <span>♔</span> Chess <span>♚</span>
        </h1>
        
        {/* Controls */}
        <div className="flex flex-wrap gap-2">
          <button 
            onClick={handleRestart} 
            className="flex-1 px-4 py-2 bg-gradient-to-r from-red-500 to-red-600 text-white rounded-lg hover:from-red-600 hover:to-red-700 font-semibold shadow-md transition-all hover:shadow-lg"
          >
            ↻ Restart
          </button>
          <button 
            onClick={handleUndo} 
            className="flex-1 px-4 py-2 bg-gradient-to-r from-gray-500 to-gray-600 text-white rounded-lg hover:from-gray-600 hover:to-gray-700 font-semibold shadow-md transition-all hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed" 
            disabled={gameState.history.length === 0}
          >
            ↶ Undo
          </button>
        </div>

        {/* Settings */}
        <div className="border-t-2 border-amber-300 pt-4">
          <h3 className="font-bold mb-3 text-amber-900 text-lg">⚙️ Settings</h3>
          <label className="flex items-center gap-2 mb-3 cursor-pointer hover:bg-amber-200 p-2 rounded transition-colors">
            <input 
              type="checkbox" 
              checked={playVsAi} 
              onChange={e => setPlayVsAi(e.target.checked)} 
              className="w-4 h-4"
            />
            <span className="font-medium">Play vs AI</span>
          </label>
          {playVsAi && (
            <div className="bg-amber-200 bg-opacity-50 p-3 rounded-lg space-y-3">
              <div>
                <label id="ai-depth-label" className="block font-medium mb-1 text-sm">🎯 Difficulty:</label>
                <select
                  aria-labelledby="ai-depth-label"
                  value={aiDepth}
                  onChange={e => setAiDepth(Number(e.target.value))}
                  className="w-full border-2 border-amber-400 rounded-lg p-2 bg-white font-medium"
                >
                  <option value="1">🟢 Easy</option>
                  <option value="2">🟡 Medium</option>
                  <option value="3">🟠 Hard</option>
                  <option value="4">🔴 Expert</option>
                </select>
              </div>
              <div>
                <label className="block font-medium mb-1 text-sm">🎮 Play as:</label>
                <div className="flex gap-2">
                  <button 
                    className={`flex-1 px-3 py-2 rounded-lg font-semibold transition-all ${
                      aiColor === 'b' 
                        ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md' 
                        : 'bg-white border-2 border-amber-300 text-gray-700 hover:bg-amber-100'
                    }`}
                    onClick={() => setAiColor('b')}
                  >⚪ White</button>
                  <button 
                    className={`flex-1 px-3 py-2 rounded-lg font-semibold transition-all ${
                      aiColor === 'w' 
                        ? 'bg-gradient-to-r from-blue-500 to-blue-600 text-white shadow-md' 
                        : 'bg-white border-2 border-amber-300 text-gray-700 hover:bg-amber-100'
                    }`}
                    onClick={() => setAiColor('w')}
                  >⚫ Black</button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Move History */}
        <div className="flex-1 overflow-hidden flex flex-col min-h-[200px]">
          <h3 className="font-bold mb-2 text-amber-900 text-lg">📜 Move History</h3>
          <div className="flex-1 overflow-y-auto bg-white bg-opacity-80 p-3 rounded-lg border-2 border-amber-300 shadow-inner">
            {history.length === 0 ? (
              <div className="text-center text-gray-400 py-8">No moves yet</div>
            ) : (
              <div className="space-y-1">
                {Array.from({ length: Math.ceil(history.length / 2) }, (_, i) => {
                  const whiteMove = history[i * 2];
                  const blackMove = history[i * 2 + 1];
                  return (
                    <div key={i} className="flex items-center gap-2 hover:bg-amber-100 p-1 rounded">
                      <span className="font-bold text-amber-900 w-8 text-right">{i + 1}.</span>
                      <span className="flex-1 font-mono text-sm font-semibold text-gray-700">{whiteMove}</span>
                      {blackMove && (
                        <span className="flex-1 font-mono text-sm font-semibold text-gray-900">{blackMove}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
        
        {/* FEN IO */}
        <div className="border-t pt-4">
           <details>
             <summary className="cursor-pointer text-sm text-gray-500">FEN Import/Export</summary>
             <textarea 
               className="w-full h-20 border p-1 text-xs mt-2" 
               value={gameStateToFEN(gameState)}
               readOnly
               onClick={e => e.currentTarget.select()}
             />
           </details>
        </div>
      </div>

      {/* Promotion Modal */}
      {promotionPending && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-4 rounded shadow-lg">
            <h3 className="text-lg font-bold mb-4">Promote to:</h3>
            <div className="flex gap-4">
              {['q', 'r', 'b', 'n'].map(type => (
                <button
                  key={type}
                  onClick={() => handlePromotionSelect(type as PieceType)}
                  className="text-4xl hover:bg-gray-100 p-2 rounded"
                >
                  {/* Simple mapping for modal */}
                  {type === 'q' ? '♛' : type === 'r' ? '♜' : type === 'b' ? '♝' : '♞'}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
