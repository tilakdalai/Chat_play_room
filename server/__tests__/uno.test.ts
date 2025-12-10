import { unoGame } from '../games/uno';
import { UnoCard } from '../types';

describe('UnoGame', () => {
  test('should create a complete deck', () => {
    const deck = unoGame.createDeck();
    expect(deck).toHaveLength(108); // Standard UNO deck
  });

  test('should initialize game with players', () => {
    // Mock shuffleDeck to ensure deterministic start card (number card)
    // In a fresh deck, the first cards are number cards. We reverse the deck so number cards are at the end (popped first).
    const spy = jest.spyOn(unoGame, 'shuffleDeck').mockImplementation((deck) => {
       return [...deck].reverse();
    });

    const playerIds = ['player1', 'player2', 'player3'];
    const gameState = unoGame.initializeGame(playerIds);
    
    expect(gameState.players).toHaveLength(3);
    expect(gameState.players[0].hand).toHaveLength(7);
    expect(gameState.discardTop).toBeDefined();
    expect(gameState.turnIndex).toBe(0);

    spy.mockRestore();
  });

  test('should allow playing valid card', () => {
    // Mock shuffleDeck to ensure deterministic start card
    const spy = jest.spyOn(unoGame, 'shuffleDeck').mockImplementation((deck) => {
       return [...deck].reverse();
    });

    const playerIds = ['player1', 'player2'];
    const gameState = unoGame.initializeGame(playerIds);
    
    spy.mockRestore();
    
    const topCard = gameState.discardTop!;
    const player = gameState.players[0];
    
    // Add a matching card to player's hand
    const matchingCard: UnoCard = { 
      id: 'test-card', 
      color: topCard.color, 
      type: 'number', 
      value: 5 
    };
    player.hand.push(matchingCard);
    
    const result = unoGame.playCard(gameState, 'player1', 'test-card');
    expect(result.success).toBe(true);
    expect(gameState.discardTop?.id).toBe('test-card');
  });

  test('should draw card when requested', () => {
    const playerIds = ['player1', 'player2'];
    const gameState = unoGame.initializeGame(playerIds);
    
    const initialHandSize = gameState.players[0].hand.length;
    const result = unoGame.drawCard(gameState, 'player1');
    
    expect(result.success).toBe(true);
    expect(gameState.players[0].hand.length).toBe(initialHandSize + 1);
  });

  test('should detect winner', () => {
    const playerIds = ['player1', 'player2'];
    const gameState = unoGame.initializeGame(playerIds);
    
    // Simulate play that empties hand
    const player = gameState.players[0];
    const card: UnoCard = { id: 'last-card', color: 'red', type: 'number', value: 1 };
    player.hand = [card];
    gameState.discardTop = { id: 'top', color: 'red', type: 'number', value: 1 };
    gameState.currentColor = 'red';
    gameState.turnIndex = 0;
    
    const result = unoGame.playCard(gameState, 'player1', 'last-card');
    expect(result.success).toBe(true);
    expect(result.nextAction).toBe('game_over');
    
    const winner = unoGame.checkWinner(gameState);
    expect(winner).toBe('player1');
  });
});
