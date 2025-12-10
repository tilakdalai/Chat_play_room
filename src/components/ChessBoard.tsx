import React, { useState, useRef, useEffect } from 'react';
import { GameState, Move, Square, squareToAlgebraic } from '../lib/chessEngine';

interface ChessBoardProps {
  gameState: GameState;
  legalMoves: Move[];
  onMove: (move: Move) => void;
  orientation?: 'w' | 'b';
  lastMove?: Move | null;
  checkSquare?: Square | null;
}

const PIECE_SYMBOLS: Record<string, string> = {
  w: '♔♕♖♗♘♙',
  b: '♚♛♜♝♞♟'
};
const PIECE_INDEX: Record<string, number> = {
  k: 0, q: 1, r: 2, b: 3, n: 4, p: 5
};

export const ChessBoard: React.FC<ChessBoardProps> = ({
  gameState, legalMoves, onMove, orientation = 'w', lastMove, checkSquare
}) => {
  const [selected, setSelected] = useState<Square | null>(null);
  const [dragStart, setDragStart] = useState<Square | null>(null);
  const boardRef = useRef<HTMLDivElement>(null);

  const ranks = orientation === 'w' ? [7,6,5,4,3,2,1,0] : [0,1,2,3,4,5,6,7];
  const files = orientation === 'w' ? [0,1,2,3,4,5,6,7] : [7,6,5,4,3,2,1,0];

  const getSquareIndex = (rank: number, file: number) => (rank * 8) + file;

  // Reset selection if board changes externally
  useEffect(() => {
    setSelected(null);
  }, [gameState.turn]);

  const getSquareFromEvent = (e: React.MouseEvent | React.TouchEvent): Square | null => {
    if (!boardRef.current) return null;
    const rect = boardRef.current.getBoundingClientRect();
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY;
    
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const size = rect.width / 8;
    
    const file = Math.floor(x / size);
    const rank = 7 - Math.floor(y / size);
    
    if (file < 0 || file > 7 || rank < 0 || rank > 7) return null;
    
    // Adjust for orientation
    const actualFile = orientation === 'w' ? file : 7 - file;
    const actualRank = orientation === 'w' ? rank : 7 - rank;
    
    return actualRank * 8 + actualFile;
  };

  const handleSquareClick = (sq: Square) => {
    const piece = gameState.board[sq];
    
    // If no piece is selected yet
    if (selected === null) {
      // Select piece of current player's color
      if (piece && piece.color === gameState.turn) {
        setSelected(sq);
      }
    } else {
      // A piece is already selected
      if (sq === selected) {
        // Clicking same square deselects
        setSelected(null);
      } else if (piece && piece.color === gameState.turn) {
        // Clicking another own piece selects it
        setSelected(sq);
      } else {
        // Try to move to this square
        attemptMove(selected, sq);
      }
    }
  };

  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent, sq: Square) => {
    e.preventDefault();
    const piece = gameState.board[sq];
    
    // Only start drag if it's the player's piece
    if (piece && piece.color === gameState.turn) {
      setDragStart(sq);
      setSelected(sq);
    }
  };

  const handleMouseUp = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault();
    
    if (dragStart !== null) {
      const sq = getSquareFromEvent(e);
      
      if (sq !== null && sq !== dragStart) {
        attemptMove(dragStart, sq);
      }
      setDragStart(null);
    }
  };

  const attemptMove = (from: Square, to: Square) => {
    const move = legalMoves.find(m => m.from === from && m.to === to);
    if (move) {
      onMove(move);
      setSelected(null);
    } else {
      // If invalid move, but we clicked on another own piece, select it
      const target = gameState.board[to];
      if (target && target.color === gameState.turn) {
        setSelected(to);
      } else {
        setSelected(null);
      }
    }
  };

  const renderSquare = (rank: number, file: number, rowIndex: number, colIndex: number) => {
    const isDark = (rank + file) % 2 === 1; // Standard chess coloring
    const sq = getSquareIndex(rank, file);
    const piece = gameState.board[sq];
    
    const isSelected = selected === sq;
    const isLastMoveFrom = lastMove?.from === sq;
    const isLastMoveTo = lastMove?.to === sq;
    const isCheck = checkSquare === sq;
    
    const validTarget = selected !== null && legalMoves.some(m => m.from === selected && m.to === sq);

    const pieceName = piece ? `${piece.color === 'w' ? 'White' : 'Black'} ${
      piece.type === 'p' ? 'Pawn' :
      piece.type === 'n' ? 'Knight' :
      piece.type === 'b' ? 'Bishop' :
      piece.type === 'r' ? 'Rook' :
      piece.type === 'q' ? 'Queen' : 'King'
    }` : 'empty';

    return (
      <div
        key={`${rank}-${file}`}
        className={`relative flex items-center justify-center select-none w-full h-full cursor-pointer
          ${isDark ? 'bg-amber-700' : 'bg-amber-200'}
          ${isSelected ? 'ring-inset ring-4 ring-blue-400' : ''}
          ${(isLastMoveFrom || isLastMoveTo) ? 'bg-yellow-400 bg-opacity-60' : ''}
          ${isCheck ? 'bg-red-500 bg-opacity-80' : ''}
        `}
        onClick={() => handleSquareClick(sq)}
        onMouseDown={(e) => handleMouseDown(e, sq)}
        onTouchStart={(e) => handleMouseDown(e, sq)}
        onMouseUp={handleMouseUp}
        onTouchEnd={handleMouseUp}
        aria-label={`${squareToAlgebraic(sq)} ${pieceName}`}
      >
        {/* Rank/File labels */}
        {colIndex === 0 && (
          <span className={`absolute top-0 left-0.5 text-xs font-bold ${isDark ? 'text-amber-200' : 'text-amber-700'}`}>
            {rank + 1}
          </span>
        )}
        {rowIndex === 7 && (
          <span className={`absolute bottom-0 right-0.5 text-xs font-bold ${isDark ? 'text-amber-200' : 'text-amber-700'}`}>
            {String.fromCharCode(97 + file)}
          </span>
        )}

        {/* Valid Move Marker */}
        {validTarget && (
          <div className={`absolute w-4 h-4 rounded-full ${piece ? 'border-4 border-gray-500' : 'bg-gray-500 bg-opacity-50'}`} />
        )}

        {/* Piece */}
        {piece && (
          <span
            className={`text-5xl md:text-6xl cursor-pointer transform transition-transform hover:scale-110 pointer-events-none font-bold
              ${piece.color === 'w' 
                ? 'text-white drop-shadow-[0_0_8px_rgba(0,0,0,0.9)] brightness-110' 
                : 'text-gray-900 drop-shadow-[0_0_8px_rgba(255,255,255,0.8)]'
              }`}
          >
            {PIECE_SYMBOLS[piece.color][PIECE_INDEX[piece.type]]}
          </span>
        )}
      </div>
    );
  };

  return (
    <div 
      ref={boardRef}
      className="relative w-full pt-[100%] shadow-2xl rounded-lg overflow-hidden border-4 border-amber-900 bg-amber-100"
    >
      <div className="absolute inset-0 grid grid-rows-8">
        {ranks.map((rank, rowIndex) => (
          <div key={`row-${rank}`} className="grid grid-cols-8">
            {files.map((file, colIndex) => renderSquare(rank, file, rowIndex, colIndex))}
          </div>
        ))}
      </div>
    </div>
  );
};
