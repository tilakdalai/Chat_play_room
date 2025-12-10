export interface User {
  id: string;
  displayName: string;
  socketId: string;
  isAdmin?: boolean;
}

export interface Message {
  id: string;
  userId: string;
  displayName: string;
  content: string;
  timestamp: number;
}

export interface YouTubeQueueItem {
  id: string;
  videoId: string;
  title: string;
  addedBy: string;
  addedByName: string;
}

export interface UploadedMovie {
  id: string;
  url: string;
  name: string;
  uploadedBy: string;
  uploadedByName: string;
  timestamp: number;
}

export type GameType = 'uno' | 'ludo' | 'chess';

export interface Room {
  code: string;
  visibility: 'public' | 'private';
  users: User[];
  messages: Message[];
  youtubeQueue: YouTubeQueueItem[];
  currentTrackIndex?: number;
  uploadedMovies: UploadedMovie[];
  movieUrl?: string;
  movieState?: {
    isPlaying: boolean;
    currentTime: number;
    lastUpdated: number;
  };
  currentGame: GameType | null;
  gameState: any;
}

export interface PublicRoomSummary {
  code: string;
  occupants: number;
  host: string | null;
  createdAt: number;
  lastActivity: number;
}

// Uno types
export type UnoColor = 'red' | 'green' | 'blue' | 'yellow' | 'wild';
export type UnoCardType = 'number' | 'skip' | 'reverse' | 'draw2' | 'wild' | 'wild_draw4';

export interface UnoCard {
  id: string;
  type: UnoCardType;
  color: UnoColor;
  value?: number;
}

export interface UnoGameConfig {
  initialHandSize: number;
  allowImmediatePlayAfterDraw: boolean;
  enforceWildDraw4Restriction: boolean;
  allowStacking: boolean;
  maxPlayers: number;
  unoPenaltyDraws: number;
  challengeEnabled: boolean;
}

export interface UnoPlayer {
  id: string;
  name: string;
  hand?: UnoCard[];
  handCount?: number;
  connected: boolean;
  isSpectator?: boolean;
  score?: number;
  unoCalled?: boolean;
}

export interface UnoGameState {
  id: string;
  players: UnoPlayer[];
  deck: UnoCard[];
  discardPile: UnoCard[]; // Full discard pile for reshuffling
  discardTop: UnoCard | null;
  discardCount: number;
  currentColor: UnoColor;
  turnIndex: number;
  direction: 1 | -1;
  pendingDrawCount: number;
  pendingDrawType?: 'draw2' | 'draw4' | null;
  awaitingChallengeFrom?: string | null;
  mustCallUNOFor?: string | null;
  winnerOrder: string[];
  config: UnoGameConfig;
  lastActionAt: number;
  myHand?: UnoCard[]; // Client-side only property
  turnState: 'playing' | 'drawn_card';
  drawnCardId?: string | null;
}

// Ludo types
export type LudoColor = 'red' | 'blue' | 'green' | 'yellow';

export type LudoTokenState = 
  | { status: 'yard' } 
  | { status: 'main'; index: number } // 0..51
  | { status: 'home'; index: number } // 0..5
  | { status: 'finished' };

export interface LudoToken {
  id: string;
  color: LudoColor;
  state: LudoTokenState;
}

export interface LudoPlayer {
  userId: string;
  color: LudoColor;
  tokens: LudoToken[];
  finished?: boolean;
  rank?: number;
}

export interface LudoGameState {
  players: LudoPlayer[];
  currentPlayerIndex: number;
  lastDiceRoll: number | null;
  canRollAgain: boolean;
  consecutiveSixes: number;
  winnerOrder: string[];
  boardSize: number;
  homeSize: number;
}

// Chess types
export type ChessColor = 'white' | 'black';
export type ChessPieceType = 'king' | 'queen' | 'rook' | 'bishop' | 'knight' | 'pawn';

export interface ChessPiece {
  id: string;
  type: ChessPieceType;
  color: ChessColor;
  hasMoved?: boolean;
}

export type ChessSquare = ChessPiece | null;

export interface ChessCoord {
  x: number;
  y: number;
}

export interface ChessMove {
  from: ChessCoord;
  to: ChessCoord;
  pieceId: string;
  capture?: ChessPiece | null;
  promotion?: ChessPieceType | null;
  isEnPassant?: boolean;
  isCastle?: 'king' | 'queen' | null;
  san?: string;
}

export interface ChessGameState {
  board: ChessSquare[][];
  sideToMove: ChessColor;
  castlingRights: {
    whiteKingSide: boolean;
    whiteQueenSide: boolean;
    blackKingSide: boolean;
    blackQueenSide: boolean;
  };
  enPassantSquare: ChessCoord | null;
  halfmoveClock: number;
  fullmoveNumber: number;
  history: string[];
  lastMove?: ChessMove;
  players: {
    white: string;
    black: string;
  };
  winner?: string | null;
  gameOver?: boolean;
  check?: boolean;
  checkmate?: boolean;
  stalemate?: boolean;
  draw?: boolean;
  fen: string;
  clocks?: { whiteMs: number; blackMs: number };
}
