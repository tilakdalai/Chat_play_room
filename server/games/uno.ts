import { 
  UnoCard, 
  UnoColor, 
  UnoGameState, 
  UnoPlayer, 
  UnoGameConfig 
} from '../types';
import { v4 as uuidv4 } from 'uuid';

export class UnoGame {
  private defaultConfig: UnoGameConfig = {
    initialHandSize: 7,
    allowImmediatePlayAfterDraw: true,
    enforceWildDraw4Restriction: true,
    allowStacking: false,
    maxPlayers: 10,
    unoPenaltyDraws: 2,
    challengeEnabled: true
  };

  createDeck(): UnoCard[] {
    const deck: UnoCard[] = [];
    const colors: UnoColor[] = ['red', 'blue', 'green', 'yellow'];

    // Number cards
    for (const color of colors) {
      deck.push({ id: uuidv4(), color, type: 'number', value: 0 });
      for (let value = 1; value <= 9; value++) {
        deck.push({ id: uuidv4(), color, type: 'number', value });
        deck.push({ id: uuidv4(), color, type: 'number', value });
      }
    }

    // Action cards
    for (const color of colors) {
      for (let i = 0; i < 2; i++) {
        deck.push({ id: uuidv4(), color, type: 'skip' });
        deck.push({ id: uuidv4(), color, type: 'reverse' });
        deck.push({ id: uuidv4(), color, type: 'draw2' });
      }
    }

    // Wild cards
    for (let i = 0; i < 4; i++) {
      deck.push({ id: uuidv4(), color: 'wild', type: 'wild' });
      deck.push({ id: uuidv4(), color: 'wild', type: 'wild_draw4' });
    }

    return this.shuffleDeck(deck);
  }

  shuffleDeck(deck: UnoCard[]): UnoCard[] {
    const shuffled = [...deck];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  }

  initializeGame(playerIds: string[], config: Partial<UnoGameConfig> = {}): UnoGameState {
    const finalConfig = { ...this.defaultConfig, ...config };
    const deck = this.createDeck();
    const players: UnoPlayer[] = playerIds.map(id => ({
      id,
      name: 'Player', // Placeholder
      hand: [],
      connected: true,
      score: 0,
      unoCalled: false
    }));

    // Deal cards
    for (let i = 0; i < finalConfig.initialHandSize; i++) {
      for (const player of players) {
        if (deck.length === 0) break;
        player.hand.push(deck.pop()!);
      }
    }

    // Start discard pile
    let startCard: UnoCard | undefined;
    do {
      startCard = deck.pop();
      if (startCard?.type === 'wild_draw4') {
        deck.unshift(startCard);
        this.shuffleDeck(deck);
        startCard = undefined;
      }
    } while (!startCard);

    const discardPile = [startCard];
    
    let currentColor: UnoColor = startCard.color;
    if (currentColor === 'wild') {
        currentColor = 'red'; // Default start color for Wild
    }

    const gameState: UnoGameState = {
      id: uuidv4(),
      players,
      deck,
      discardPile,
      discardTop: startCard,
      discardCount: 1,
      currentColor,
      turnIndex: 0,
      direction: 1,
      pendingDrawCount: 0,
      winnerOrder: [],
      config: finalConfig,
      lastActionAt: Date.now(),
      turnState: 'playing'
    };

    // Handle initial card effects
    if (startCard.type === 'draw2') {
        this.drawCardsForPlayer(gameState, players[0].id, 2);
        this.advanceTurn(gameState);
    } else if (startCard.type === 'skip') {
        this.advanceTurn(gameState);
    } else if (startCard.type === 'reverse') {
        if (players.length === 2) {
             this.advanceTurn(gameState);
        } else {
            gameState.direction = -1;
            gameState.turnIndex = players.length - 1;
        }
    }

    return gameState;
  }

  isLegalPlay(player: UnoPlayer, card: UnoCard, gameState: UnoGameState): boolean {
    // If in 'drawn_card' state, can only play the drawn card
    if (gameState.turnState === 'drawn_card' && gameState.drawnCardId) {
      if (card.id !== gameState.drawnCardId) return false;
    } else {
      if (!player.hand.find(c => c.id === card.id)) return false;
    }
    
    const top = gameState.discardTop;
    if (!top) return true;

    // Wild Draw 4 Restriction
    if (card.type === 'wild_draw4' && gameState.config.enforceWildDraw4Restriction) {
      // Can only play if NO card matches current color
      const hasColorMatch = player.hand.some(c => c.id !== card.id && c.color === gameState.currentColor);
      if (hasColorMatch) return false;
    }

    if (card.type === 'wild' || card.type === 'wild_draw4') return true;

    if (card.color === gameState.currentColor) return true;

    if (card.type === top.type && card.type !== 'number') return true;
    if (card.type === 'number' && top.type === 'number' && card.value === top.value) return true;

    return false;
  }

  playCard(gameState: UnoGameState, playerId: string, cardId: string, chosenColor?: UnoColor): { success: boolean; gameState?: UnoGameState; nextAction?: string; error?: string } {
    const player = gameState.players.find(p => p.id === playerId);
    if (!player) return { success: false, error: 'Player not found' };

    if (gameState.players[gameState.turnIndex].id !== playerId) {
      return { success: false, error: 'Not your turn' };
    }

    const cardIndex = player.hand.findIndex(c => c.id === cardId);
    if (cardIndex === -1) return { success: false, error: 'Card not in hand' };
    const card = player.hand[cardIndex];

    if (!this.isLegalPlay(player, card, gameState)) {
      return { success: false, error: 'Illegal move' };
    }

    // Apply play
    player.hand.splice(cardIndex, 1);
    gameState.discardPile.push(card);
    gameState.discardTop = card;
    gameState.discardCount++;
    gameState.lastActionAt = Date.now();
    gameState.turnState = 'playing'; // Reset state
    gameState.drawnCardId = null;

    // Update color
    if (card.type === 'wild' || card.type === 'wild_draw4') {
      if (!chosenColor || chosenColor === 'wild') return { success: false, error: 'Must choose color' };
      gameState.currentColor = chosenColor;
    } else {
      gameState.currentColor = card.color;
    }

    // Reset UNO flag if they have more than 1 card
    if (player.hand.length > 1) {
      player.unoCalled = false;
    }

    // Handle effects
    let nextAction = 'next_turn';

    if (card.type === 'skip') {
      this.advanceTurn(gameState); // Skip next player
      this.advanceTurn(gameState); // Move to player after skipped
    } else if (card.type === 'reverse') {
      if (gameState.players.length === 2) {
        this.advanceTurn(gameState); // Skip next player
        this.advanceTurn(gameState); // Move to player after skipped
      } else {
        gameState.direction *= -1;
        this.advanceTurn(gameState);
      }
    } else if (card.type === 'draw2') {
      this.advanceTurn(gameState); // Move to victim
      const victim = gameState.players[gameState.turnIndex];
      this.drawCardsForPlayer(gameState, victim.id, 2);
      this.advanceTurn(gameState); // Move to next
    } else if (card.type === 'wild_draw4') {
       this.advanceTurn(gameState); // Move to victim
       const victim = gameState.players[gameState.turnIndex];
       this.drawCardsForPlayer(gameState, victim.id, 4);
       this.advanceTurn(gameState); // Move to next
    } else {
        // Number or Wild (no draw)
        this.advanceTurn(gameState);
    }

    // Check winner
    if (player.hand.length === 0) {
      gameState.winnerOrder.push(player.id);
      return { success: true, gameState, nextAction: 'game_over' };
    }

    return { success: true, gameState, nextAction };
  }

  drawCard(gameState: UnoGameState, playerId: string): { success: boolean; gameState?: UnoGameState; error?: string } {
    const player = gameState.players.find(p => p.id === playerId);
    if (!player) return { success: false, error: 'Player not found' };

    if (gameState.players[gameState.turnIndex].id !== playerId) {
      return { success: false, error: 'Not your turn' };
    }

    if (gameState.turnState === 'drawn_card') {
       return { success: false, error: 'Already drawn a card' };
    }

    this.drawCardsForPlayer(gameState, playerId, 1);
    const drawnCard = player.hand[player.hand.length - 1];
    
    // Check if playable
    if (this.isLegalPlay(player, drawnCard, gameState)) {
      gameState.turnState = 'drawn_card';
      gameState.drawnCardId = drawnCard.id;
      // Do not advance turn yet
    } else {
      this.advanceTurn(gameState);
    }

    return { success: true, gameState };
  }

  passTurn(gameState: UnoGameState, playerId: string): { success: boolean; gameState?: UnoGameState; error?: string } {
    const player = gameState.players.find(p => p.id === playerId);
    if (!player) return { success: false, error: 'Player not found' };

    if (gameState.players[gameState.turnIndex].id !== playerId) {
      return { success: false, error: 'Not your turn' };
    }

    if (gameState.turnState !== 'drawn_card') {
      return { success: false, error: 'Cannot pass without drawing' };
    }

    gameState.turnState = 'playing';
    gameState.drawnCardId = null;
    this.advanceTurn(gameState);
    return { success: true, gameState };
  }

  callUno(gameState: UnoGameState, playerId: string): { success: boolean; gameState?: UnoGameState; error?: string } {
    const player = gameState.players.find(p => p.id === playerId);
    if (!player) return { success: false, error: 'Player not found' };

    if (player.hand.length > 2) {
       return { success: false, error: 'Too many cards to call UNO' };
    }
    
    player.unoCalled = true;
    return { success: true, gameState };
  }

  catchUnoFailure(gameState: UnoGameState, accuserPlayerId: string, targetPlayerId: string): { success: boolean; gameState?: UnoGameState; error?: string } {
    const accuser = gameState.players.find(p => p.id === accuserPlayerId);
    if (!accuser) return { success: false, error: 'Accuser not found' };

    const target = gameState.players.find(p => p.id === targetPlayerId);
    if (!target) return { success: false, error: 'Target player not found' };

    if (target.hand.length === 1 && !target.unoCalled) {
      // Penalty!
      this.drawCardsForPlayer(gameState, target.id, gameState.config.unoPenaltyDraws);
      return { success: true, gameState };
    }

    return { success: false, error: 'Player is safe' };
  }

  checkWinner(gameState: UnoGameState): string | null {
      if (gameState.winnerOrder.length > 0) return gameState.winnerOrder[0];
      return null;
  }

  private advanceTurn(gameState: UnoGameState) {
    const numPlayers = gameState.players.length;
    gameState.turnIndex = (gameState.turnIndex + gameState.direction + numPlayers) % numPlayers;
    gameState.turnState = 'playing';
    gameState.drawnCardId = null;
    
    const currentPlayer = gameState.players[gameState.turnIndex];
    if (currentPlayer.hand.length > 1) {
      currentPlayer.unoCalled = false;
    }
  }

  private drawCardsForPlayer(gameState: UnoGameState, playerId: string, count: number) {
    const player = gameState.players.find(p => p.id === playerId);
    if (!player) return;
    
    for (let i = 0; i < count; i++) {
        if (gameState.deck.length === 0) {
            this.reshuffleDiscardIntoDeck(gameState);
            if (gameState.deck.length === 0) break;
        }
        player.hand.push(gameState.deck.pop()!);
    }
    if (player.hand.length > 1) {
      player.unoCalled = false;
    }
  }

  private reshuffleDiscardIntoDeck(gameState: UnoGameState) {
    if (gameState.discardPile.length <= 1) return;
    
    const top = gameState.discardPile.pop()!;
    const newDeck = gameState.discardPile;
    gameState.discardPile = [top];
    gameState.discardTop = top;
    gameState.discardCount = 1;
    
    this.shuffleDeck(newDeck);
    gameState.deck = newDeck;
  }
}

export const unoGame = new UnoGame();
