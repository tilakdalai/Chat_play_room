import { LudoGameState, LudoToken, LudoColor, LudoPlayer, LudoTokenState } from '../types';
import { v4 as uuidv4 } from 'uuid';

export class LudoGame {
  private readonly BOARD_SIZE = 52;
  private readonly HOME_SIZE = 6;
  private readonly SAFE_INDICES = [0, 8, 13, 21, 26, 34, 39, 47]; // 0-based indices of safe spots (Start squares + Stars)
  // Start indices for each color on the main track (0-51)
  private readonly START_INDICES: Record<LudoColor, number> = {
    red: 0,
    blue: 13,
    green: 26,
    yellow: 39
  };
  // Index where token enters home column
  private readonly HOME_ENTRY_INDICES: Record<LudoColor, number> = {
    red: 50,
    blue: 11,
    green: 24,
    yellow: 37
  };

  initializeGame(playerIds: string[]): LudoGameState {
    const colors: LudoColor[] = ['red', 'blue', 'green', 'yellow'];
    const players: LudoPlayer[] = playerIds.slice(0, 4).map((userId, index) => ({
      userId,
      color: colors[index],
      tokens: this.createTokens(colors[index])
    }));

    return {
      players,
      currentPlayerIndex: 0,
      lastDiceRoll: null,
      canRollAgain: false,
      consecutiveSixes: 0,
      winnerOrder: [],
      boardSize: this.BOARD_SIZE,
      homeSize: this.HOME_SIZE
    };
  }

  private createTokens(color: LudoColor): LudoToken[] {
    return Array.from({ length: 4 }, () => ({
      id: uuidv4(),
      color,
      state: { status: 'yard' }
    }));
  }

  rollDice(): number {
    return Math.floor(Math.random() * 6) + 1;
  }

  handleDiceRoll(gameState: LudoGameState, playerId: string): { 
    success: boolean; 
    error?: string; 
    roll?: number;
    canRollAgain?: boolean;
  } {
    const player = gameState.players[gameState.currentPlayerIndex];
    if (player.userId !== playerId) {
      return { success: false, error: 'Not your turn' };
    }

    if (gameState.lastDiceRoll !== null && !gameState.canRollAgain) {
      return { success: false, error: 'Must move a token first' };
    }

    const roll = this.rollDice();
    gameState.lastDiceRoll = roll;

    // Handle consecutive sixes rule (optional, but good to track)
    if (roll === 6) {
      gameState.consecutiveSixes++;
      if (gameState.consecutiveSixes >= 3) {
        // Three 6s in a row -> turn ends immediately
        this.nextPlayer(gameState);
        return { success: true, roll, canRollAgain: false };
      }
      gameState.canRollAgain = true;
    } else {
      gameState.consecutiveSixes = 0;
      gameState.canRollAgain = false;
    }

    // Check if player can move any token
    const legalMoves = this.getLegalMoves(player, roll);
    
    if (legalMoves.length === 0) {
      if (!gameState.canRollAgain) {
        this.nextPlayer(gameState);
      } else {
        // If rolled 6 but no moves (rare), pass turn to avoid stuck state
        this.nextPlayer(gameState);
        gameState.canRollAgain = false;
      }
    }

    return { success: true, roll, canRollAgain: gameState.canRollAgain };
  }

  moveToken(gameState: LudoGameState, playerId: string, tokenId: string): {
    success: boolean;
    error?: string;
    capturedTokens?: string[];
    winner?: string;
  } {
    const player = gameState.players[gameState.currentPlayerIndex];
    if (player.userId !== playerId) {
      return { success: false, error: 'Not your turn' };
    }

    if (gameState.lastDiceRoll === null) {
      return { success: false, error: 'Roll dice first' };
    }

    const legalMoves = this.getLegalMoves(player, gameState.lastDiceRoll);
    const move = legalMoves.find(m => m.tokenId === tokenId);

    if (!move) {
      return { success: false, error: 'Illegal move' };
    }

    // Apply move
    const capturedTokens = this.applyMove(gameState, move);

    // Check for win condition
    if (player.tokens.every(t => t.state.status === 'finished')) {
      player.finished = true;
      if (!gameState.winnerOrder.includes(player.userId)) {
        gameState.winnerOrder.push(player.userId);
      }
    }

    // Turn flow
    if (gameState.lastDiceRoll === 6 && gameState.consecutiveSixes < 3) {
      // Player rolls again
      gameState.lastDiceRoll = null;
      // canRollAgain remains true until they roll
    } else {
      this.nextPlayer(gameState);
    }

    return { success: true, capturedTokens };
  }

  private getLegalMoves(player: LudoPlayer, diceValue: number): { tokenId: string, from: LudoTokenState, to: LudoTokenState }[] {
    const legalMoves: { tokenId: string, from: LudoTokenState, to: LudoTokenState }[] = [];

    for (const token of player.tokens) {
      if (token.state.status === 'yard') {
        if (diceValue === 6) {
          const targetIndex = this.START_INDICES[player.color];
          legalMoves.push({
            tokenId: token.id,
            from: token.state,
            to: { status: 'main', index: targetIndex }
          });
        }
      } else if (token.state.status === 'main') {
        const currentIdx = token.state.index;
        const stepsToHome = this.stepsToHomeEntry(currentIdx, player.color);
        
        if (diceValue > stepsToHome) {
          // Entering home column
          const stepsIntoHome = diceValue - stepsToHome - 1;
          if (stepsIntoHome < this.HOME_SIZE) {
            legalMoves.push({
              tokenId: token.id,
              from: token.state,
              to: { status: 'home', index: stepsIntoHome }
            });
          } else if (stepsIntoHome === this.HOME_SIZE) {
            legalMoves.push({
              tokenId: token.id,
              from: token.state,
              to: { status: 'finished' }
            });
          }
        } else {
          // Moving on main track
          const targetIndex = (currentIdx + diceValue) % this.BOARD_SIZE;
          legalMoves.push({
            tokenId: token.id,
            from: token.state,
            to: { status: 'main', index: targetIndex }
          });
        }
      } else if (token.state.status === 'home') {
        const currentIdx = token.state.index;
        const newIdx = currentIdx + diceValue;
        if (newIdx < this.HOME_SIZE) {
          legalMoves.push({
            tokenId: token.id,
            from: token.state,
            to: { status: 'home', index: newIdx }
          });
        } else if (newIdx === this.HOME_SIZE) {
          legalMoves.push({
            tokenId: token.id,
            from: token.state,
            to: { status: 'finished' }
          });
        }
      }
    }

    return legalMoves;
  }

  private applyMove(gameState: LudoGameState, move: { tokenId: string, from: LudoTokenState, to: LudoTokenState }): string[] {
    const player = gameState.players[gameState.currentPlayerIndex];
    const token = player.tokens.find(t => t.id === move.tokenId)!;
    const capturedTokens: string[] = [];

    // Update token state
    token.state = move.to;

    // Check captures if landed on main track
    if (move.to.status === 'main') {
      const targetIndex = move.to.index;
      
      // Check if safe square
      if (!this.SAFE_INDICES.includes(targetIndex)) {
        // Check for opponent tokens
        for (const otherPlayer of gameState.players) {
          if (otherPlayer.userId === player.userId) continue;

          for (const otherToken of otherPlayer.tokens) {
            if (otherToken.state.status === 'main' && otherToken.state.index === targetIndex) {
              // Capture!
              otherToken.state = { status: 'yard' };
              capturedTokens.push(otherToken.id);
            }
          }
        }
      }
    }

    return capturedTokens;
  }

  private stepsToHomeEntry(currentIndex: number, color: LudoColor): number {
    const entryIndex = this.HOME_ENTRY_INDICES[color];
    if (entryIndex >= currentIndex) {
      return entryIndex - currentIndex;
    } else {
      return (this.BOARD_SIZE - currentIndex) + entryIndex;
    }
  }

  private nextPlayer(gameState: LudoGameState) {
    gameState.lastDiceRoll = null;
    gameState.canRollAgain = false;
    gameState.consecutiveSixes = 0;
    
    let nextIndex = (gameState.currentPlayerIndex + 1) % gameState.players.length;
    let attempts = 0;
    while (gameState.players[nextIndex].finished && attempts < 4) {
      nextIndex = (nextIndex + 1) % gameState.players.length;
      attempts++;
    }
    gameState.currentPlayerIndex = nextIndex;
  }
}

export const ludoGame = new LudoGame();
