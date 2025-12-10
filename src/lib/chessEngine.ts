// chessEngine.ts
// Minimal but complete chess logic for browser/React.
// Author: ChatGPT (adapt as needed)

export type Color = 'w' | 'b';
export type PieceType = 'p'|'n'|'b'|'r'|'q'|'k';

export interface Piece { type: PieceType; color: Color; }
export type Square = number; // 0..63, 0 = a1, 7 = h1, 56 = a8, 63 = h8

export interface Move {
  from: Square;
  to: Square;
  piece: Piece;
  captured?: Piece | null;
  promotion?: PieceType;
  isEnPassant?: boolean;
  isCastling?: boolean;
}

export interface CastlingRights {
  wks: boolean; wqs: boolean;
  bks: boolean; bqs: boolean;
}

export interface GameState {
  board: (Piece | null)[];
  turn: Color;
  castling: CastlingRights;
  enPassant: Square | null;
  halfmoveClock: number;
  fullmoveNumber: number;
  history: {
    move: Move;
    castling: CastlingRights;
    enPassant: Square | null;
    halfmoveClock: number;
  }[];
}

export const initialFEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export function makeEmptyBoard(): (Piece|null)[] {
  return new Array(64).fill(null);
}

export function fenToGameState(fen: string = initialFEN): GameState {
  const parts = fen.split(' ');
  if (parts.length < 4) throw new Error('Invalid FEN');
  const rows = parts[0].split('/');
  const board = makeEmptyBoard();
  for (let r=0; r<8; r++){
    const row = rows[7 - r];
    let file = 0;
    for (const ch of row) {
      if (/\d/.test(ch)) {
        file += Number(ch);
      } else {
        const color: Color = ch === ch.toUpperCase() ? 'w' : 'b';
        const type: PieceType = ch.toLowerCase() as PieceType;
        board[r*8 + file] = {type, color};
        file++;
      }
    }
  }
  const turn: Color = parts[1] === 'w' ? 'w' : 'b';
  const castling = {wks:false,wqs:false,bks:false,bqs:false};
  if (parts[2].includes('K')) castling.wks = true;
  if (parts[2].includes('Q')) castling.wqs = true;
  if (parts[2].includes('k')) castling.bks = true;
  if (parts[2].includes('q')) castling.bqs = true;
  const enPassant = parts[3] === '-' ? null : algebraicToSquare(parts[3]);
  const halfmoveClock = Number(parts[4] || 0);
  const fullmoveNumber = Number(parts[5] || 1);
  return { board, turn, castling, enPassant, halfmoveClock, fullmoveNumber, history: [] };
}

export function gameStateToFEN(gs: GameState): string {
  const rows: string[] = [];
  for (let r=7; r>=0; r--) {
    let row = '';
    let empty = 0;
    for (let f=0; f<8; f++){
      const p = gs.board[r*8 + f];
      if (!p) empty++;
      else {
        if (empty) { row += empty.toString(); empty = 0; }
        const ch = p.color === 'w' ? p.type.toUpperCase() : p.type.toLowerCase();
        row += ch;
      }
    }
    if (empty) row += empty.toString();
    rows.push(row);
  }
  const boardPart = rows.join('/');
  const turnPart = gs.turn === 'w' ? 'w' : 'b';
  let castlePart = '';
  if (gs.castling.wks) castlePart += 'K';
  if (gs.castling.wqs) castlePart += 'Q';
  if (gs.castling.bks) castlePart += 'k';
  if (gs.castling.bqs) castlePart += 'q';
  if (!castlePart) castlePart = '-';
  const epPart = gs.enPassant === null ? '-' : squareToAlgebraic(gs.enPassant);
  return `${boardPart} ${turnPart} ${castlePart} ${epPart} ${gs.halfmoveClock} ${gs.fullmoveNumber}`;
}

export function squareToAlgebraic(sq: Square): string {
  const file = sq % 8;
  const rank = Math.floor(sq / 8) + 1;
  return 'abcdefgh'[file] + rank.toString();
}
export function algebraicToSquare(s: string): Square {
  const file = 'abcdefgh'.indexOf(s[0]);
  const rank = Number(s[1]) - 1;
  return rank*8 + file;
}

// const directions = {
//   n: 8, s: -8, e: 1, w: -1,
//   ne: 9, nw: 7, se: -7, sw: -9,
//   nne: 17, nnw: 15, sse: -15, ssw: -17,
//   ene: 10, enw: 6, ese: -6, esw: -10
// };

function onBoard(sq: number) { return sq >=0 && sq < 64; }
function fileOf(sq: number) { return sq % 8; }
function rankOf(sq: number) { return Math.floor(sq/8); }

export function cloneGameState(gs: GameState): GameState {
  return {
    board: gs.board.slice(),
    turn: gs.turn,
    castling: {...gs.castling},
    enPassant: gs.enPassant,
    halfmoveClock: gs.halfmoveClock,
    fullmoveNumber: gs.fullmoveNumber,
    history: gs.history.slice()
  };
}

export function generatePseudoLegalMoves(gs: GameState): Move[] {
  const moves: Move[] = [];
  const turn = gs.turn;
  for (let sq = 0; sq < 64; sq++){
    const p = gs.board[sq];
    if (!p || p.color !== turn) continue;
    switch (p.type) {
      case 'p': generatePawnMoves(gs, sq, p, moves); break;
      case 'n': generateKnightMoves(gs, sq, p, moves); break;
      case 'b': generateSlidingMoves(gs, sq, p, moves, ['ne','nw','se','sw']); break;
      case 'r': generateSlidingMoves(gs, sq, p, moves, ['n','s','e','w']); break;
      case 'q': generateSlidingMoves(gs, sq, p, moves, ['n','s','e','w','ne','nw','se','sw']); break;
      case 'k': generateKingMoves(gs, sq, p, moves); break;
    }
  }
  return moves;
}

function generatePawnMoves(gs: GameState, sq: Square, p: Piece, moves: Move[]) {
  const dir = p.color === 'w' ? 8 : -8;
  const startRank = p.color === 'w' ? 1 : 6;
  const promotionRank = p.color === 'w' ? 7 : 0;
  const one = sq + dir;
  if (onBoard(one) && !gs.board[one]) {
    if (rankOf(one) === promotionRank) {
      (['q','r','b','n'] as PieceType[]).forEach((pr) => moves.push({from: sq, to: one, piece: p, promotion: pr}));
    } else {
      moves.push({from: sq, to: one, piece: p});
      if (rankOf(sq) === startRank) {
        const two = sq + 2*dir;
        if (onBoard(two) && !gs.board[two]) {
          moves.push({from: sq, to: two, piece: p});
        }
      }
    }
  }
  const caps = p.color === 'w' ? [7,9] : [-7,-9];
  for (const d of caps) {
    const to = sq + d;
    if (!onBoard(to)) continue;
    
    const fileDist = fileOf(to) - fileOf(sq);
    if (Math.abs(fileDist) !== 1) continue;
    
    const target = gs.board[to];
    if (target && target.color !== p.color) {
      if (rankOf(to) === promotionRank) {
        (['q','r','b','n'] as PieceType[]).forEach((pr) => moves.push({from: sq, to, piece: p, captured: target, promotion: pr}));
      } else {
        moves.push({from: sq, to, piece: p, captured: target});
      }
    } else if (gs.enPassant !== null && to === gs.enPassant) {
      const capSq = p.color === 'w' ? to - 8 : to + 8;
      const capPiece = gs.board[capSq];
      if (capPiece && capPiece.type === 'p' && capPiece.color !== p.color) {
        moves.push({from: sq, to, piece: p, captured: capPiece, isEnPassant: true});
      }
    }
  }
}

function generateKnightMoves(gs: GameState, sq: Square, p: Piece, moves: Move[]) {
  const deltas = [17,15,10,6,-6,-10,-15,-17];
  for (const d of deltas) {
    const to = sq + d;
    if (!onBoard(to)) continue;
    if (Math.abs(fileOf(sq) - fileOf(to)) > 2) continue;
    const target = gs.board[to];
    if (!target || target.color !== p.color) moves.push({from: sq, to, piece: p, captured: target || null});
  }
}

function generateSlidingMoves(gs: GameState, sq: Square, p: Piece, moves: Move[], dirs: string[]) {
  const dirVals: Record<string, number> = {n:8,s:-8,e:1,w:-1,ne:9,nw:7,se:-7,sw:-9};
  for (const dir of dirs) {
    const delta = dirVals[dir];
    let to = sq + delta;
    let lastFile = fileOf(sq);
    
    while (onBoard(to)) {
      const currentFile = fileOf(to);
      
      // Check for wrapping on horizontal/diagonal moves
      if (dir === 'e' || dir === 'w') {
        if (Math.abs(currentFile - lastFile) !== 1) break;
      } else if (dir === 'ne' || dir === 'nw' || dir === 'se' || dir === 'sw') {
        if (Math.abs(currentFile - lastFile) !== 1) break;
      }
      
      const target = gs.board[to];
      if (!target) {
        moves.push({from: sq, to, piece: p});
      } else {
        if (target.color !== p.color) moves.push({from: sq, to, piece: p, captured: target});
        break;
      }
      
      lastFile = currentFile;
      to += delta;
    }
  }
}

function generateKingMoves(gs: GameState, sq: Square, p: Piece, moves: Move[]) {
  const deltas = [1,-1,8,-8,9,7,-7,-9];
  for (const d of deltas) {
    const to = sq + d;
    if (!onBoard(to)) continue;
    if (Math.abs(fileOf(sq) - fileOf(to)) > 1) continue;
    const target = gs.board[to];
    if (!target || target.color !== p.color) moves.push({from: sq, to, piece: p, captured: target || null});
  }
  if (p.color === 'w') {
    if (gs.castling.wks && !gs.board[5] && !gs.board[6]) moves.push({from: sq, to: 6, piece: p, isCastling: true});
    if (gs.castling.wqs && !gs.board[1] && !gs.board[2] && !gs.board[3]) moves.push({from: sq, to: 2, piece: p, isCastling: true});
  } else {
    if (gs.castling.bks && !gs.board[61] && !gs.board[62]) moves.push({from: sq, to: 62, piece: p, isCastling: true});
    if (gs.castling.bqs && !gs.board[57] && !gs.board[58] && !gs.board[59]) moves.push({from: sq, to: 58, piece: p, isCastling: true});
  }
}

export function makeMove(gs: GameState, move: Move) {
  gs.history.push({
    move,
    castling: {...gs.castling},
    enPassant: gs.enPassant,
    halfmoveClock: gs.halfmoveClock
  });

  const {from, to, piece} = move;
  if (move.isEnPassant) {
    const capSq = piece.color === 'w' ? to - 8 : to + 8;
    move.captured = gs.board[capSq];
    gs.board[capSq] = null;
  } else {
    move.captured = gs.board[to];
  }
  gs.board[to] = (move.promotion ? {type: move.promotion, color: piece.color} : piece);
  gs.board[from] = null;

  if (piece.type === 'k') {
    if (piece.color === 'w') { gs.castling.wks = false; gs.castling.wqs = false; }
    else { gs.castling.bks = false; gs.castling.bqs = false; }
    if (move.isCastling) {
      if (to === 6) {
        gs.board[5] = gs.board[7]; gs.board[7] = null;
      } else if (to === 2) {
        gs.board[3] = gs.board[0]; gs.board[0] = null;
      } else if (to === 62) {
        gs.board[61] = gs.board[63]; gs.board[63] = null;
      } else if (to === 58) {
        gs.board[59] = gs.board[56]; gs.board[56] = null;
      }
    }
  }
  if (piece.type === 'r') {
    if (from === 0) gs.castling.wqs = false;
    if (from === 7) gs.castling.wks = false;
    if (from === 56) gs.castling.bqs = false;
    if (from === 63) gs.castling.bks = false;
  }
  if (move.captured && move.captured.type === 'r') {
    const capFrom = move.to;
    if (capFrom === 0) gs.castling.wqs = false;
    if (capFrom === 7) gs.castling.wks = false;
    if (capFrom === 56) gs.castling.bqs = false;
    if (capFrom === 63) gs.castling.bks = false;
  }

  gs.enPassant = null;
  if (piece.type === 'p' && Math.abs(move.to - move.from) === 16) {
    gs.enPassant = (move.from + move.to) / 2;
  }

  if (piece.type === 'p' || move.captured) gs.halfmoveClock = 0; else gs.halfmoveClock++;
  if (gs.turn === 'b') gs.fullmoveNumber++;
  gs.turn = gs.turn === 'w' ? 'b' : 'w';
}

export function undoMove(gs: GameState) {
  const last = gs.history.pop();
  if (!last) return;
  const { move, castling, enPassant, halfmoveClock } = last;
  gs.turn = gs.turn === 'w' ? 'b' : 'w';
  if (gs.turn === 'b') gs.fullmoveNumber--;
  gs.board[move.from] = move.piece;
  if (move.isEnPassant) {
    const capSq = move.piece.color === 'w' ? move.to - 8 : move.to + 8;
    gs.board[capSq] = move.captured || null;
    gs.board[move.to] = null;
  } else {
    gs.board[move.to] = move.captured || null;
  }
  if (move.isCastling) {
    if (move.to === 6) { gs.board[7] = gs.board[5]; gs.board[5] = null; }
    if (move.to === 2) { gs.board[0] = gs.board[3]; gs.board[3] = null; }
    if (move.to === 62) { gs.board[63] = gs.board[61]; gs.board[61] = null; }
    if (move.to === 58) { gs.board[56] = gs.board[59]; gs.board[59] = null; }
  }
  gs.castling = {...castling};
  gs.enPassant = enPassant;
  gs.halfmoveClock = halfmoveClock;
}

export function isSquareAttacked(gs: GameState, sq: Square, byColor: Color): boolean {
  // Pawn attacks
  // White pawns attack from sq-7 and sq-9. Black from sq+7 and sq+9.
  const pawnFrom = byColor === 'w' 
    ? [sq-7, sq-9]
    : [sq+7, sq+9];
    
  for (const from of pawnFrom) {
    if (onBoard(from)) {
      // Must be adjacent file
      if (Math.abs(fileOf(sq) - fileOf(from)) === 1) {
        const p = gs.board[from];
        if (p && p.type === 'p' && p.color === byColor) return true;
      }
    }
  }

  // Knight attacks
  const nd = [17,15,10,6,-6,-10,-15,-17];
  for (const d of nd) {
    const from = sq + d; 
    if (!onBoard(from)) continue;
    if (Math.abs(fileOf(sq) - fileOf(from)) > 2) continue;
    const p = gs.board[from];
    if (p && p.type === 'n' && p.color === byColor) return true;
  }

  // Sliding attacks (Queen, Rook, Bishop)
  const dirs = [
    {d: 8, type: 'r'}, {d: -8, type: 'r'}, {d: 1, type: 'r'}, {d: -1, type: 'r'},
    {d: 9, type: 'b'}, {d: 7, type: 'b'}, {d: -7, type: 'b'}, {d: -9, type: 'b'}
  ];

  for (const {d, type} of dirs) {
    let from = sq + d;
    while (onBoard(from)) {
      // Check for wrapping
      const prev = from - d;
      const fileDiff = Math.abs(fileOf(from) - fileOf(prev));
      const rankDiff = Math.abs(rankOf(from) - rankOf(prev));
      if (fileDiff > 1 || rankDiff > 1) break; // Wrapped around

      const p = gs.board[from];
      if (p) {
        if (p.color === byColor && (p.type === type || p.type === 'q')) return true;
        break; // Blocked
      }
      from += d;
    }
  }
  
  // King attacks (explicit check)
  const kd = [1,-1,8,-8,9,7,-7,-9];
  for (const d of kd) {
    const from = sq + d;
    if (!onBoard(from)) continue;
    if (Math.abs(fileOf(sq) - fileOf(from)) > 1) continue;
    const p = gs.board[from];
    if (p && p.type === 'k' && p.color === byColor) return true;
  }

  return false;
}

export function findKingSquare(gs: GameState, color: Color): Square | null {
  for (let i=0;i<64;i++) {
    const p = gs.board[i];
    if (p && p.type === 'k' && p.color === color) return i;
  }
  return null;
}

export function inCheck(gs: GameState, color: Color): boolean {
  const kingSq = findKingSquare(gs, color);
  if (kingSq === null) return false;
  return isSquareAttacked(gs, kingSq, color === 'w' ? 'b' : 'w');
}

export function generateLegalMoves(gs: GameState): Move[] {
  const pseudo = generatePseudoLegalMoves(gs);
  const legal: Move[] = [];
  const enemy = gs.turn === 'w' ? 'b' : 'w';
  
  for (const mv of pseudo) {
    // Special handling for castling - check path before making move
    if (mv.isCastling) {
      const path = mv.to === 6 ? [4,5,6] : mv.to === 2 ? [4,3,2] : mv.to === 62 ? [60,61,62] : [60,59,58];
      let ok = true;
      for (const sq of path) {
        if (isSquareAttacked(gs, sq, enemy)) { 
          ok = false; break; 
        }
      }
      if (!ok) continue;
    }
    
    // Check if move leaves king in check
    const snapshot = cloneGameState(gs);
    makeMove(snapshot, mv);
    if (!inCheck(snapshot, gs.turn)) legal.push(mv);
  }
  return legal;
}

export function gameStatus(gs: GameState): { check: boolean; checkmate: boolean; stalemate: boolean; draw: boolean } {
  const legal = generateLegalMoves(gs);
  const check = inCheck(gs, gs.turn);
  if (legal.length === 0) {
    if (check) return {check:true, checkmate:true, stalemate:false, draw:false};
    else return {check:false, checkmate:false, stalemate:true, draw:true};
  }
  return {check, checkmate:false, stalemate:false, draw:false};
}
