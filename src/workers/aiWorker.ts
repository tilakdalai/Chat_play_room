import {
  GameState, generateLegalMoves, makeMove, undoMove, gameStatus, Move, fenToGameState
} from '../lib/chessEngine';

// Simple material values
const pieceValues: Record<string, number> = {
  p: 100, n: 320, b: 330, r: 500, q: 900, k: 20000
};

function evaluate(gs: GameState): number {
  let score = 0;
  for (const p of gs.board) {
    if (!p) continue;
    const val = pieceValues[p.type];
    score += p.color === 'w' ? val : -val;
  }
  // Simple mobility bonus could go here
  return score;
}

function minimax(gs: GameState, depth: number, alpha: number, beta: number, isMaximizing: boolean): number {
  const status = gameStatus(gs);
  if (status.checkmate) return isMaximizing ? -Infinity : Infinity;
  if (status.stalemate || status.draw) return 0;
  if (depth === 0) return evaluate(gs);

  const moves = generateLegalMoves(gs);
  // Sort moves for better pruning (captures first)
  moves.sort((a, b) => (b.captured ? 10 : 0) - (a.captured ? 10 : 0));

  if (isMaximizing) {
    let maxEval = -Infinity;
    for (const move of moves) {
      makeMove(gs, move);
      const evalScore = minimax(gs, depth - 1, alpha, beta, false);
      undoMove(gs);
      maxEval = Math.max(maxEval, evalScore);
      alpha = Math.max(alpha, evalScore);
      if (beta <= alpha) break;
    }
    return maxEval;
  } else {
    let minEval = Infinity;
    for (const move of moves) {
      makeMove(gs, move);
      const evalScore = minimax(gs, depth - 1, alpha, beta, true);
      undoMove(gs);
      minEval = Math.min(minEval, evalScore);
      beta = Math.min(beta, evalScore);
      if (beta <= alpha) break;
    }
    return minEval;
  }
}

self.onmessage = (e: MessageEvent) => {
  const { fen, depth, color } = e.data;
  const gs = fenToGameState(fen);
  
  const moves = generateLegalMoves(gs);
  if (moves.length === 0) {
    self.postMessage({ bestMove: null });
    return;
  }

  let bestMove: Move | null = null;
  let bestValue = color === 'w' ? -Infinity : Infinity;
  const isMaximizing = color === 'w';

  // Root search - use cloning to avoid state mutation
  for (const move of moves) {
    const tempState = fenToGameState(fen); // Fresh copy for each evaluation
    makeMove(tempState, move);
    const val = minimax(tempState, depth - 1, -Infinity, Infinity, !isMaximizing);

    if (isMaximizing) {
      if (val > bestValue) {
        bestValue = val;
        bestMove = move;
      }
    } else {
      if (val < bestValue) {
        bestValue = val;
        bestMove = move;
      }
    }
  }

  self.postMessage({ bestMove });
};
