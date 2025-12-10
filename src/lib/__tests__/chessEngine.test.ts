import {
  fenToGameState, gameStateToFEN, makeMove, undoMove,
  generateLegalMoves, gameStatus, initialFEN
} from '../chessEngine';

describe('Chess Engine', () => {
  test('FEN round-trip (initial position)', () => {
    const gs = fenToGameState(initialFEN);
    const fen = gameStateToFEN(gs);
    expect(fen).toBe(initialFEN);
  });

  test('Pawn moves & En Passant', () => {
    // Setup a position where white pawn can capture en passant
    // White pawn at e5, Black pawn moves d7 -> d5.
    // FEN: rnbqkbnr/ppp1pppp/8/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 3
    const fen = 'rnbqkbnr/ppp1pppp/8/3pP3/8/8/PPPP1PPP/RNBQKBNR w KQkq d6 0 3';
    const gs = fenToGameState(fen);
    
    const moves = generateLegalMoves(gs);
    // e5 is 36 (4*8 + 4). d6 is 43 (5*8 + 3).
    // e5xd6 (en passant) should be valid.
    const epMove = moves.find(m => m.from === 36 && m.to === 43 && m.isEnPassant);
    expect(epMove).toBeDefined();

    if (epMove) {
      makeMove(gs, epMove);
      expect(gs.board[43]).not.toBeNull(); // Pawn at d6
      expect(gs.board[35]).toBeNull(); // Captured pawn at d5 (35) removed
      
      undoMove(gs);
      expect(gs.board[43]).toBeNull();
      expect(gs.board[35]).not.toBeNull(); // Pawn restored
    }
  });

  test('Castling', () => {
    // White king at e1, Rook at h1. Path clear.
    const fen = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQK2R w KQkq - 0 1';
    const gs = fenToGameState(fen);
    const moves = generateLegalMoves(gs);
    
    // e1=4, g1=6 (Kingside castle)
    const castleMove = moves.find(m => m.from === 4 && m.to === 6 && m.isCastling);
    expect(castleMove).toBeDefined();

    if (castleMove) {
      makeMove(gs, castleMove);
      expect(gs.board[6]?.type).toBe('k');
      expect(gs.board[5]?.type).toBe('r'); // Rook moved f1
      expect(gs.board[7]).toBeNull(); // Old rook pos empty
      
      undoMove(gs);
      expect(gs.board[4]?.type).toBe('k');
      expect(gs.board[7]?.type).toBe('r');
      expect(gs.board[5]).toBeNull();
    }
  });

  test('Promotion', () => {
    // White pawn at a7, about to promote
    const fen = '8/P7/8/8/8/8/8/k6K w - - 0 1';
    const gs = fenToGameState(fen);
    const moves = generateLegalMoves(gs);
    
    // a7=48, a8=56
    const promotions = moves.filter(m => m.from === 48 && m.to === 56 && m.promotion);
    expect(promotions.length).toBe(4); // q, r, b, n

    const qProm = promotions.find(m => m.promotion === 'q');
    if (qProm) {
      makeMove(gs, qProm);
      expect(gs.board[56]?.type).toBe('q');
      undoMove(gs);
      expect(gs.board[56]).toBeNull();
      expect(gs.board[48]?.type).toBe('p');
    }
  });

  test('Checkmate detection', () => {
    // Fool's mate
    const fen = 'rnb1kbnr/pppp1ppp/8/4p3/6Pq/5P2/PPPPP2P/RNBQKBNR w KQkq - 1 3';
    const gs = fenToGameState(fen);
    const status = gameStatus(gs);
    expect(status.checkmate).toBe(true);
    expect(status.check).toBe(true);
  });

  test('Stalemate detection', () => {
    // Simple stalemate: King at a8, Queen at c7.
    const fen = 'k7/2Q5/8/8/8/8/8/7K b - - 0 1';
    const gs = fenToGameState(fen);
    const status = gameStatus(gs);
    expect(status.stalemate).toBe(true);
    expect(status.checkmate).toBe(false);
    expect(status.check).toBe(false);
  });
});
