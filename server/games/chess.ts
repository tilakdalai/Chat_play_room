import { 
  ChessGameState, 
  ChessColor, 
  ChessPiece, 
  ChessPieceType, 
  ChessSquare, 
  ChessCoord, 
  ChessMove 
} from '../types';
import { v4 as uuidv4 } from 'uuid';

export class ChessGame {
  
  initializeGame(whitePlayerId: string, blackPlayerId: string): ChessGameState {
    const board = this.createInitialBoard();
    return {
      board,
      sideToMove: 'white',
      castlingRights: {
        whiteKingSide: true,
        whiteQueenSide: true,
        blackKingSide: true,
        blackQueenSide: true
      },
      enPassantSquare: null,
      halfmoveClock: 0,
      fullmoveNumber: 1,
      history: [],
      players: {
        white: whitePlayerId,
        black: blackPlayerId
      },
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      gameOver: false,
      winner: null,
      check: false,
      checkmate: false,
      stalemate: false,
      draw: false
    };
  }

  private createInitialBoard(): ChessSquare[][] {
    const board: ChessSquare[][] = Array(8).fill(null).map(() => Array(8).fill(null));
    
    const setupRow = (row: number, color: ChessColor, pieces: ChessPieceType[]) => {
      pieces.forEach((type, col) => {
        board[row][col] = { id: uuidv4(), type, color, hasMoved: false };
      });
    };

    const backRank: ChessPieceType[] = ['rook', 'knight', 'bishop', 'queen', 'king', 'bishop', 'knight', 'rook'];
    const pawns: ChessPieceType[] = Array(8).fill('pawn');

    setupRow(0, 'black', backRank);
    setupRow(1, 'black', pawns);
    setupRow(6, 'white', pawns);
    setupRow(7, 'white', backRank);

    return board;
  }

  makeMove(gameState: ChessGameState, playerId: string, from: ChessCoord, to: ChessCoord, promotion?: ChessPieceType): { success: boolean; gameState?: ChessGameState; error?: string } {
    // Validate player
    if (gameState.gameOver) return { success: false, error: 'Game is over' };
    
    const isWhite = gameState.players.white === playerId;
    const isBlack = gameState.players.black === playerId;
    
    if (!isWhite && !isBlack) return { success: false, error: 'Not a player' };
    if (isWhite && gameState.sideToMove !== 'white') return { success: false, error: 'Not your turn' };
    if (isBlack && gameState.sideToMove !== 'black') return { success: false, error: 'Not your turn' };

    // Validate move
    const legalMoves = this.getLegalMoves(gameState);
    const move = legalMoves.find(m => 
      m.from.x === from.x && m.from.y === from.y && 
      m.to.x === to.x && m.to.y === to.y &&
      (!m.promotion || m.promotion === promotion)
    );

    if (!move) return { success: false, error: 'Illegal move' };

    // Apply move
    const newState = this.applyMove(gameState, move);
    
    // Check game end conditions
    const nextLegalMoves = this.getLegalMoves(newState);
    const isCheck = this.isKingInCheck(newState, newState.sideToMove);
    
    newState.check = isCheck;
    
    if (nextLegalMoves.length === 0) {
      newState.gameOver = true;
      if (isCheck) {
        newState.checkmate = true;
        newState.winner = gameState.sideToMove === 'white' ? gameState.players.white : gameState.players.black; 
      } else {
        newState.stalemate = true;
        newState.draw = true;
      }
    } else if (this.isInsufficientMaterial(newState) || newState.halfmoveClock >= 100 || this.isThreefoldRepetition(newState)) {
      newState.gameOver = true;
      newState.draw = true;
    }

    newState.fen = this.generateFen(newState);
    newState.history.push(newState.fen);

    return { success: true, gameState: newState };
  }

  getLegalMoves(gameState: ChessGameState): ChessMove[] {
    const pseudoMoves = this.generatePseudoMoves(gameState, gameState.sideToMove);
    return pseudoMoves.filter(move => {
      const testState = this.applyMove(gameState, move, true); // true = test mode (don't flip turn or update history)
      return !this.isKingInCheck(testState, gameState.sideToMove);
    });
  }

  private generatePseudoMoves(state: ChessGameState, color: ChessColor): ChessMove[] {
    const moves: ChessMove[] = [];
    const board = state.board;

    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const piece = board[y][x];
        if (piece && piece.color === color) {
          const from = { x, y };
          
          if (piece.type === 'pawn') {
            this.generatePawnMoves(state, from, piece, moves);
          } else if (piece.type === 'knight') {
            this.generateKnightMoves(state, from, piece, moves);
          } else if (piece.type === 'bishop' || piece.type === 'rook' || piece.type === 'queen') {
            this.generateSlidingMoves(state, from, piece, moves);
          } else if (piece.type === 'king') {
            this.generateKingMoves(state, from, piece, moves);
          }
        }
      }
    }
    
    return moves;
  }

  private generatePawnMoves(state: ChessGameState, from: ChessCoord, piece: ChessPiece, moves: ChessMove[]) {
    const direction = piece.color === 'white' ? -1 : 1; // White moves up (y decreases), Black moves down (y increases)
    const startRank = piece.color === 'white' ? 6 : 1;
    const promotionRank = piece.color === 'white' ? 0 : 7;

    // Forward 1
    const to1 = { x: from.x, y: from.y + direction };
    if (this.isValidPos(to1) && !state.board[to1.y][to1.x]) {
      if (to1.y === promotionRank) {
        this.addPromotionMoves(from, to1, piece, moves);
      } else {
        moves.push({ from, to: to1, pieceId: piece.id });
        // Forward 2
        if (from.y === startRank) {
          const to2 = { x: from.x, y: from.y + direction * 2 };
          if (!state.board[to2.y][to2.x]) {
            moves.push({ from, to: to2, pieceId: piece.id });
          }
        }
      }
    }

    // Captures
    const captureOffsets = [-1, 1];
    for (const offset of captureOffsets) {
      const to = { x: from.x + offset, y: from.y + direction };
      if (this.isValidPos(to)) {
        const target = state.board[to.y][to.x];
        if (target && target.color !== piece.color) {
          if (to.y === promotionRank) {
            this.addPromotionMoves(from, to, piece, moves, target);
          } else {
            moves.push({ from, to, pieceId: piece.id, capture: target });
          }
        } else if (state.enPassantSquare && to.x === state.enPassantSquare.x && to.y === state.enPassantSquare.y) {
          // En Passant
          // The captured pawn is at {x: to.x, y: from.y}
          const capturedPawn = state.board[from.y][to.x];
          if (capturedPawn && capturedPawn.color !== piece.color) {
             moves.push({ from, to, pieceId: piece.id, capture: capturedPawn, isEnPassant: true });
          }
        }
      }
    }
  }

  private addPromotionMoves(from: ChessCoord, to: ChessCoord, piece: ChessPiece, moves: ChessMove[], capture?: ChessPiece | null) {
    const types: ChessPieceType[] = ['queen', 'rook', 'bishop', 'knight'];
    types.forEach(type => {
      moves.push({ from, to, pieceId: piece.id, capture, promotion: type });
    });
  }

  private generateKnightMoves(state: ChessGameState, from: ChessCoord, piece: ChessPiece, moves: ChessMove[]) {
    const offsets = [
      { x: 1, y: 2 }, { x: 1, y: -2 }, { x: -1, y: 2 }, { x: -1, y: -2 },
      { x: 2, y: 1 }, { x: 2, y: -1 }, { x: -2, y: 1 }, { x: -2, y: -1 }
    ];
    this.generateStepMoves(state, from, piece, moves, offsets);
  }

  private generateKingMoves(state: ChessGameState, from: ChessCoord, piece: ChessPiece, moves: ChessMove[]) {
    const offsets = [
      { x: 0, y: 1 }, { x: 0, y: -1 }, { x: 1, y: 0 }, { x: -1, y: 0 },
      { x: 1, y: 1 }, { x: 1, y: -1 }, { x: -1, y: 1 }, { x: -1, y: -1 }
    ];
    this.generateStepMoves(state, from, piece, moves, offsets);

    // Castling
    if (!piece.hasMoved && !this.isKingInCheck(state, piece.color)) {
      const y = piece.color === 'white' ? 7 : 0;
      const rights = state.castlingRights;
      
      // King Side
      if ((piece.color === 'white' ? rights.whiteKingSide : rights.blackKingSide)) {
        if (!state.board[y][5] && !state.board[y][6]) {
           // Check if squares are attacked
           if (!this.isSquareAttacked(state, { x: 5, y }, this.getOpponentColor(piece.color)) &&
               !this.isSquareAttacked(state, { x: 6, y }, this.getOpponentColor(piece.color))) {
             moves.push({ from, to: { x: 6, y }, pieceId: piece.id, isCastle: 'king' });
           }
        }
      }

      // Queen Side
      if ((piece.color === 'white' ? rights.whiteQueenSide : rights.blackQueenSide)) {
        if (!state.board[y][1] && !state.board[y][2] && !state.board[y][3]) {
           if (!this.isSquareAttacked(state, { x: 3, y }, this.getOpponentColor(piece.color)) && // d1/d8
               !this.isSquareAttacked(state, { x: 2, y }, this.getOpponentColor(piece.color))) { // c1/c8
             moves.push({ from, to: { x: 2, y }, pieceId: piece.id, isCastle: 'queen' });
           }
        }
      }
    }
  }

  private generateSlidingMoves(state: ChessGameState, from: ChessCoord, piece: ChessPiece, moves: ChessMove[]) {
    const directions = [];
    if (piece.type === 'bishop' || piece.type === 'queen') {
      directions.push({ x: 1, y: 1 }, { x: 1, y: -1 }, { x: -1, y: 1 }, { x: -1, y: -1 });
    }
    if (piece.type === 'rook' || piece.type === 'queen') {
      directions.push({ x: 0, y: 1 }, { x: 0, y: -1 }, { x: 1, y: 0 }, { x: -1, y: 0 });
    }

    for (const dir of directions) {
      for (let i = 1; i < 8; i++) {
        const to = { x: from.x + dir.x * i, y: from.y + dir.y * i };
        if (!this.isValidPos(to)) break;
        
        const target = state.board[to.y][to.x];
        if (target) {
          if (target.color !== piece.color) {
            moves.push({ from, to, pieceId: piece.id, capture: target });
          }
          break; // Blocked
        }
        moves.push({ from, to, pieceId: piece.id });
      }
    }
  }

  private generateStepMoves(state: ChessGameState, from: ChessCoord, piece: ChessPiece, moves: ChessMove[], offsets: ChessCoord[]) {
    for (const offset of offsets) {
      const to = { x: from.x + offset.x, y: from.y + offset.y };
      if (this.isValidPos(to)) {
        const target = state.board[to.y][to.x];
        if (!target || target.color !== piece.color) {
          moves.push({ from, to, pieceId: piece.id, capture: target });
        }
      }
    }
  }

  private applyMove(state: ChessGameState, move: ChessMove, testMode: boolean = false): ChessGameState {
    // Deep copy state
    const newState: ChessGameState = JSON.parse(JSON.stringify(state));
    const board = newState.board;
    const piece = board[move.from.y][move.from.x]!;
    
    // Move piece
    board[move.to.y][move.to.x] = piece;
    board[move.from.y][move.from.x] = null;
    piece.hasMoved = true;

    // Handle Capture
    if (move.capture) {
        // If en passant, remove the captured pawn
        if (move.isEnPassant) {
            const captureY = move.from.y; // Same rank as start
            const captureX = move.to.x;
            board[captureY][captureX] = null;
        }
    }

    // Handle Castling
    if (move.isCastle) {
        const row = move.from.y;
        if (move.isCastle === 'king') {
            // Move Rook from h to f
            const rook = board[row][7]!;
            board[row][5] = rook;
            board[row][7] = null;
            rook.hasMoved = true;
        } else {
            // Move Rook from a to d
            const rook = board[row][0]!;
            board[row][3] = rook;
            board[row][0] = null;
            rook.hasMoved = true;
        }
    }

    // Handle Promotion
    if (move.promotion) {
        piece.type = move.promotion;
    }

    // Update En Passant Square
    newState.enPassantSquare = null;
    if (piece.type === 'pawn' && Math.abs(move.to.y - move.from.y) === 2) {
        newState.enPassantSquare = {
            x: move.from.x,
            y: (move.from.y + move.to.y) / 2
        };
    }

    // Update Castling Rights
    if (piece.type === 'king') {
        if (piece.color === 'white') {
            newState.castlingRights.whiteKingSide = false;
            newState.castlingRights.whiteQueenSide = false;
        } else {
            newState.castlingRights.blackKingSide = false;
            newState.castlingRights.blackQueenSide = false;
        }
    }
    if (piece.type === 'rook') {
        if (move.from.x === 0 && move.from.y === 7) newState.castlingRights.whiteQueenSide = false;
        if (move.from.x === 7 && move.from.y === 7) newState.castlingRights.whiteKingSide = false;
        if (move.from.x === 0 && move.from.y === 0) newState.castlingRights.blackQueenSide = false;
        if (move.from.x === 7 && move.from.y === 0) newState.castlingRights.blackKingSide = false;
    }
    // If rook is captured
    if (move.capture && move.capture.type === 'rook') {
         // Logic to remove castling rights if opponent's rook is captured
         // (Simplified: checking coordinates of capture)
         if (move.to.x === 0 && move.to.y === 7) newState.castlingRights.whiteQueenSide = false;
         if (move.to.x === 7 && move.to.y === 7) newState.castlingRights.whiteKingSide = false;
         if (move.to.x === 0 && move.to.y === 0) newState.castlingRights.blackQueenSide = false;
         if (move.to.x === 7 && move.to.y === 0) newState.castlingRights.blackKingSide = false;
    }

    if (!testMode) {
        newState.sideToMove = state.sideToMove === 'white' ? 'black' : 'white';
        newState.lastMove = move;
        
        if (piece.type === 'pawn' || move.capture) {
            newState.halfmoveClock = 0;
        } else {
            newState.halfmoveClock++;
        }
        
        if (state.sideToMove === 'black') {
            newState.fullmoveNumber++;
        }
    }

    return newState;
  }

  private isKingInCheck(state: ChessGameState, color: ChessColor): boolean {
    const kingPos = this.findKing(state, color);
    if (!kingPos) return true; // Should not happen unless king captured (illegal)
    return this.isSquareAttacked(state, kingPos, this.getOpponentColor(color));
  }

  private isSquareAttacked(state: ChessGameState, pos: ChessCoord, attackerColor: ChessColor): boolean {
    // Generate all pseudo moves for attacker and see if any hit pos
    // Optimization: Check from pos outwards for attackers
    
    // Check Pawn attacks
    const pawnDir = attackerColor === 'white' ? -1 : 1;
    // Attackers come from opposite direction of their movement
    // White pawns attack from (y+1, x±1) to (y, x)
    // Black pawns attack from (y-1, x±1) to (y, x)
    // So we look for pawns at pos.y - pawnDir
    const pawnRow = pos.y - pawnDir;
    if (pawnRow >= 0 && pawnRow < 8) {
        if (pos.x > 0) {
            const p = state.board[pawnRow][pos.x - 1];
            if (p && p.color === attackerColor && p.type === 'pawn') return true;
        }
        if (pos.x < 7) {
            const p = state.board[pawnRow][pos.x + 1];
            if (p && p.color === attackerColor && p.type === 'pawn') return true;
        }
    }

    // Check Knight attacks
    const knightOffsets = [
      { x: 1, y: 2 }, { x: 1, y: -2 }, { x: -1, y: 2 }, { x: -1, y: -2 },
      { x: 2, y: 1 }, { x: 2, y: -1 }, { x: -2, y: 1 }, { x: -2, y: -1 }
    ];
    for (const off of knightOffsets) {
        const t = { x: pos.x + off.x, y: pos.y + off.y };
        if (this.isValidPos(t)) {
            const p = state.board[t.y][t.x];
            if (p && p.color === attackerColor && p.type === 'knight') return true;
        }
    }

    // Check Sliding attacks (Queen, Rook, Bishop)
    const dirs = [
        { x: 0, y: 1 }, { x: 0, y: -1 }, { x: 1, y: 0 }, { x: -1, y: 0 }, // Rook
        { x: 1, y: 1 }, { x: 1, y: -1 }, { x: -1, y: 1 }, { x: -1, y: -1 } // Bishop
    ];
    for (const dir of dirs) {
        for (let i = 1; i < 8; i++) {
            const t = { x: pos.x + dir.x * i, y: pos.y + dir.y * i };
            if (!this.isValidPos(t)) break;
            const p = state.board[t.y][t.x];
            if (p) {
                if (p.color === attackerColor) {
                    const isDiagonal = dir.x !== 0 && dir.y !== 0;
                    if (p.type === 'queen') return true;
                    if (isDiagonal && p.type === 'bishop') return true;
                    if (!isDiagonal && p.type === 'rook') return true;
                }
                break; // Blocked
            }
        }
    }

    // Check King attacks
    const kingOffsets = [
      { x: 0, y: 1 }, { x: 0, y: -1 }, { x: 1, y: 0 }, { x: -1, y: 0 },
      { x: 1, y: 1 }, { x: 1, y: -1 }, { x: -1, y: 1 }, { x: -1, y: -1 }
    ];
    for (const off of kingOffsets) {
        const t = { x: pos.x + off.x, y: pos.y + off.y };
        if (this.isValidPos(t)) {
            const p = state.board[t.y][t.x];
            if (p && p.color === attackerColor && p.type === 'king') return true;
        }
    }

    return false;
  }

  private findKing(state: ChessGameState, color: ChessColor): ChessCoord | null {
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const p = state.board[y][x];
        if (p && p.type === 'king' && p.color === color) {
          return { x, y };
        }
      }
    }
    return null;
  }

  private isValidPos(pos: ChessCoord): boolean {
    return pos.x >= 0 && pos.x < 8 && pos.y >= 0 && pos.y < 8;
  }

  private getOpponentColor(color: ChessColor): ChessColor {
    return color === 'white' ? 'black' : 'white';
  }

  private isInsufficientMaterial(state: ChessGameState): boolean {
    // Simplified check
    const pieces = state.board.flat().filter(p => p !== null) as ChessPiece[];
    if (pieces.length === 2) return true; // K vs K
    if (pieces.length === 3) {
        const minor = pieces.find(p => p.type === 'bishop' || p.type === 'knight');
        if (minor) return true; // K+B vs K or K+N vs K
    }
    return false;
  }

  private isThreefoldRepetition(state: ChessGameState): boolean {
    const currentFen = this.generateFen(state);
    // Full FEN includes castling rights and en passant, which is correct.
    // But halfmove clock should be ignored for repetition? No, usually exact FEN match.
    // Actually, FEN includes halfmove clock and fullmove number. Those should be ignored for repetition.
    // Let's strip the counters.
    const getPosition = (fen: string) => fen.split(' ').slice(0, 4).join(' ');
    const currentPos = getPosition(currentFen);
    const occurrences = state.history.map(getPosition).filter(p => p === currentPos).length;
    return occurrences >= 2; // Current state is the 3rd occurrence (history has previous ones)
  }

  private generateFen(state: ChessGameState): string {
    let fen = '';
    for (let y = 0; y < 8; y++) {
        let empty = 0;
        for (let x = 0; x < 8; x++) {
            const p = state.board[y][x];
            if (!p) {
                empty++;
            } else {
                if (empty > 0) {
                    fen += empty;
                    empty = 0;
                }
                const char = p.type === 'knight' ? 'n' : p.type[0];
                fen += p.color === 'white' ? char.toUpperCase() : char.toLowerCase();
            }
        }
        if (empty > 0) fen += empty;
        if (y < 7) fen += '/';
    }

    fen += ` ${state.sideToMove === 'white' ? 'w' : 'b'}`;
    
    let castling = '';
    if (state.castlingRights.whiteKingSide) castling += 'K';
    if (state.castlingRights.whiteQueenSide) castling += 'Q';
    if (state.castlingRights.blackKingSide) castling += 'k';
    if (state.castlingRights.blackQueenSide) castling += 'q';
    if (castling === '') castling = '-';
    fen += ` ${castling}`;

    if (state.enPassantSquare) {
        const file = String.fromCharCode('a'.charCodeAt(0) + state.enPassantSquare.x);
        const rank = 8 - state.enPassantSquare.y;
        fen += ` ${file}${rank}`;
    } else {
        fen += ' -';
    }

    fen += ` ${state.halfmoveClock} ${state.fullmoveNumber}`;
    return fen;
  }

  resignGame(gameState: ChessGameState, playerId: string): { success: boolean; winner?: string; error?: string } {
    if (gameState.gameOver) return { success: false, error: 'Game is already over' };
    
    const isWhite = gameState.players.white === playerId;
    const isBlack = gameState.players.black === playerId;
    
    if (!isWhite && !isBlack) return { success: false, error: 'Not a player' };

    gameState.gameOver = true;
    gameState.winner = isWhite ? gameState.players.black : gameState.players.white;
    gameState.draw = false;
    
    return { success: true, winner: gameState.winner };
  }

  fromAlgebraic(square: string): ChessCoord {
    const file = square.charCodeAt(0) - 'a'.charCodeAt(0);
    const rank = 8 - parseInt(square[1]);
    return { x: file, y: rank };
  }

  toAlgebraic(coord: ChessCoord): string {
    const file = String.fromCharCode('a'.charCodeAt(0) + coord.x);
    const rank = 8 - coord.y;
    return `${file}${rank}`;
  }
}

export const chessGame = new ChessGame();
