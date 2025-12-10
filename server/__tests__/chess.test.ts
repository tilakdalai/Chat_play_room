import { chessGame } from '../games/chess';
import { ChessGameState } from '../types';

describe('ChessGame', () => {
  let gameState: ChessGameState;

  beforeEach(() => {
    gameState = chessGame.initializeGame('white-player', 'black-player');
  });

  test('should initialize correctly', () => {
    expect(gameState.board[0][0]?.type).toBe('rook');
    expect(gameState.board[0][0]?.color).toBe('black');
    expect(gameState.board[7][4]?.type).toBe('king');
    expect(gameState.board[7][4]?.color).toBe('white');
    expect(gameState.sideToMove).toBe('white');
  });

  test('should allow valid pawn move', () => {
    const from = { x: 4, y: 6 }; // e2
    const to = { x: 4, y: 4 };   // e4
    const result = chessGame.makeMove(gameState, 'white-player', from, to);
    
    expect(result.success).toBe(true);
    expect(result.gameState?.board[6][4]).toBeNull();
    expect(result.gameState?.board[4][4]?.type).toBe('pawn');
    expect(result.gameState?.sideToMove).toBe('black');
  });

  test('should reject invalid move', () => {
    const from = { x: 4, y: 6 }; // e2
    const to = { x: 5, y: 5 };   // f3 (diagonal without capture)
    const result = chessGame.makeMove(gameState, 'white-player', from, to);
    
    expect(result.success).toBe(false);
  });

  test('should detect checkmate (Fool\'s Mate)', () => {
    // 1. f3 e5
    let result = chessGame.makeMove(gameState, 'white-player', { x: 5, y: 6 }, { x: 5, y: 5 }); // f3
    if (result.gameState) gameState = result.gameState;
    
    result = chessGame.makeMove(gameState, 'black-player', { x: 4, y: 1 }, { x: 4, y: 3 }); // e5
    if (result.gameState) gameState = result.gameState;
    
    // 2. g4 Qh4#
    result = chessGame.makeMove(gameState, 'white-player', { x: 6, y: 6 }, { x: 6, y: 4 }); // g4
    if (result.gameState) gameState = result.gameState;
    
    result = chessGame.makeMove(gameState, 'black-player', { x: 3, y: 0 }, { x: 7, y: 4 }); // Qh4
    
    expect(result.success).toBe(true);
    expect(result.gameState?.checkmate).toBe(true);
    expect(result.gameState?.gameOver).toBe(true);
    expect(result.gameState?.winner).toBe('black-player');
  });
});
