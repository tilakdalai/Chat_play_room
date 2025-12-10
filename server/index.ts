import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { networkInterfaces } from 'os';
import { roomManager } from './roomManager';
import { unoGame } from './games/uno';
import { ludoGame } from './games/ludo';
import { chessGame } from './games/chess';
import { UnoGameState } from './types';
import { v4 as uuidv4 } from 'uuid';
import ytSearch from 'yt-search';
import multer from 'multer';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { streamTorrent } from './torrentWorker';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

function getPublicUnoState(gameState: UnoGameState) {
  return {
    ...gameState,
    players: gameState.players.map(p => ({
      id: p.id,
      name: p.name,
      handCount: p.hand.length,
      connected: p.connected,
      score: p.score,
      isSpectator: p.isSpectator,
      unoCalled: p.unoCalled
    })),
    deck: gameState.deck.length,
    discardPile: undefined,
  };
}

function serializeRoom(room: any) {
  return {
    code: room.code,
    visibility: room.visibility,
    users: Array.from(room.users.values()),
    messages: room.messages,
    youtubeQueue: room.youtubeQueue,
    currentTrackIndex: room.currentTrackIndex,
    uploadedMovies: room.uploadedMovies,
    movieUrl: room.movieUrl,
    movieState: room.movieState,
    currentGame: room.currentGame,
    gameState: room.gameState
  };
}

const broadcastPublicRooms = () => {
  io.emit('public-rooms-updated', roomManager.getPublicRoomsSummary());
};

app.use(cors({ origin: true, credentials: true }));
app.use(express.json());

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: function (_req, _file, cb) {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: function (_req, file, cb) {
    // Use timestamp + original name to avoid collisions
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage: storage });

// ESM-friendly __dirname replacement
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// File upload endpoint
app.post('/upload', upload.single('movie'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  
  // Construct the URL for the uploaded file
  // Return relative URL so it works with proxies and different hosts
  const fileUrl = `/uploads/${req.file.filename}`;
  
  res.json({ url: fileUrl });
});

// Health check endpoint
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', ...roomManager.getRoomStats() });
});

// Minimal demo: normalized stream list (HLS example)
app.get('/api/streams', (req, res) => {
  const { id } = req.query;
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'missing id' });
  }

  const streams = [
    {
      type: 'hls' as const,
      url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
      quality: '720p',
      provider: 'demo-hls',
      subs: [
        {
          lang: 'en',
          label: 'English',
          url: 'https://bitdash-a.akamaihd.net/content/sintel/subtitles/subtitles_en.vtt'
        }
      ]
    }
    // Add magnets or HTTP streams if available
  ];

  res.json({ id, streams });
});

// Minimal demo: return normalized streams for a given id
app.get('/api/streams', (req, res) => {
  const { id } = req.query;
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'missing id' });
  }

  const streams = [
    {
      type: 'hls' as const,
      url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
      quality: '720p',
      provider: 'demo-hls',
      subs: [
        {
          lang: 'en',
          label: 'English',
          url: 'https://bitdash-a.akamaihd.net/content/sintel/subtitles/subtitles_en.vtt'
        }
      ]
    }
    // Add a magnet example when you have one
    // {
    //   type: 'magnet' as const,
    //   url: 'magnet:?xt=urn:btih:...valid_magnet_here...',
    //   quality: '1080p',
    //   provider: 'demo-torrent',
    //   subs: []
    // }
  ];

  res.json({ id, streams });
});

// Torrent to HTTP streaming endpoint (minimal demo; adds range support)
app.get('/api/torrent-play', async (req, res) => {
  try {
    const { magnet } = req.query;
    if (!magnet || typeof magnet !== 'string') {
      return res.status(400).json({ error: 'Missing magnet parameter' });
    }
    await streamTorrent(magnet, req as any, res as any);
  } catch (error: any) {
    if (!res.headersSent) {
      res.status(500).json({ error: 'Failed to stream torrent' });
    }
  }
});

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Create room
  socket.on('create-room', (data: { displayName: string; visibility?: 'public' | 'private' }, callback) => {
    try {
      const userId = uuidv4();
      const visibility = data.visibility === 'public' ? 'public' : 'private';
      const roomCode = roomManager.createRoom(visibility);
      const room = roomManager.joinRoom(roomCode, userId, data.displayName, socket.id);
      
      if (room) {
        socket.join(roomCode);
        (socket as any).userId = userId;
        callback({ success: true, roomCode, userId, room: serializeRoom(room) });
        broadcastPublicRooms();
      } else {
        callback({ success: false, error: 'Failed to create room' });
      }
    } catch (error) {
      callback({ success: false, error: 'Server error' });
    }
  });

  socket.on('get-public-rooms', (payload: any, callback?: (response: { rooms: ReturnType<typeof roomManager.getPublicRoomsSummary> }) => void) => {
    const response = { rooms: roomManager.getPublicRoomsSummary() };
    if (typeof payload === 'function' && !callback) {
      (payload as (response: { rooms: ReturnType<typeof roomManager.getPublicRoomsSummary> }) => void)(response);
    } else if (typeof callback === 'function') {
      callback(response);
    } else {
      socket.emit('public-rooms-updated', response.rooms);
    }
  });

  // Join room
  socket.on('join-room', (data: { roomCode: string; displayName: string; userId?: string }, callback) => {
    try {
      const userId = data.userId || uuidv4();
      const room = roomManager.joinRoom(data.roomCode, userId, data.displayName, socket.id);
      
      if (room) {
        socket.join(data.roomCode);
        (socket as any).userId = userId;
        
        // Notify others
        socket.to(data.roomCode).emit('user-joined', {
          userId,
          displayName: data.displayName
        });
        
        callback({ success: true, userId, room: serializeRoom(room) });
        broadcastPublicRooms();
      } else {
        callback({ success: false, error: 'Room not found' });
      }
    } catch (error) {
      callback({ success: false, error: 'Server error' });
    }
  });

  // WebRTC signaling relay for screen/camera/voice
  socket.on('webrtc-offer', (payload: { roomCode: string; fromUserId: string; sdp: any }) => {
    socket.to(payload.roomCode).emit('webrtc-offer', { ...payload, fromSocketId: socket.id });
  });

  socket.on('webrtc-answer', (payload: { roomCode: string; fromUserId: string; sdp: any }) => {
    socket.to(payload.roomCode).emit('webrtc-answer', { ...payload, fromSocketId: socket.id });
  });

  socket.on('webrtc-ice', (payload: { roomCode: string; fromUserId: string; candidate: any }) => {
    socket.to(payload.roomCode).emit('webrtc-ice', { ...payload, fromSocketId: socket.id });
  });

  socket.on('webrtc-media-toggle', (payload: { roomCode: string; fromUserId: string; camera: boolean; mic: boolean; screen: boolean }) => {
    socket.to(payload.roomCode).emit('webrtc-media-toggle', payload);
  });

  // Reconnect to room
  socket.on('reconnect-room', (data: { userId: string }, callback) => {
    try {
      roomManager.updateUserSocket(data.userId, socket.id);
      const roomData = roomManager.getRoomByUserId(data.userId);
      
      if (roomData) {
        socket.join(roomData.code);
        (socket as any).userId = data.userId;
        callback({ success: true, room: serializeRoom(roomData.room), roomCode: roomData.code });
      } else {
        callback({ success: false, error: 'Room not found' });
      }
    } catch (error) {
      callback({ success: false, error: 'Server error' });
    }
  });

  socket.on('kick-user', (data: { targetUserId: string }, callback) => {
    try {
      const adminUserId = (socket as any).userId as string | undefined;
      if (!adminUserId) {
        return callback?.({ success: false, error: 'Not authenticated' });
      }
      const result = roomManager.kickUser(adminUserId, data.targetUserId);
      if (!result.success || !result.room || !result.roomCode) {
        return callback?.({ success: false, error: 'Kick failed' });
      }

      if (result.targetSocketId) {
        io.to(result.targetSocketId).emit('kicked', { roomCode: result.roomCode });
        io.sockets.sockets.get(result.targetSocketId)?.leave(result.roomCode);
      }
      io.to(result.roomCode).emit('room-updated', serializeRoom(result.room));
      broadcastPublicRooms();
      callback?.({ success: true });
    } catch (error) {
      callback?.({ success: false, error: 'Server error' });
    }
  });

  // Movie events
  socket.on('set-movie-url', (data: { roomCode: string; url: string }) => {
    const room = roomManager.getRoom(data.roomCode);
    if (room) {
      room.movieUrl = data.url;
      room.movieState = {
        isPlaying: false,
        currentTime: 0,
        lastUpdated: Date.now()
      };
      io.to(data.roomCode).emit('movie-url-updated', data.url);
      io.to(data.roomCode).emit('movie-state-updated', room.movieState);
    }
  });

  socket.on('update-movie-state', (data: { roomCode: string; state: any }) => {
    const room = roomManager.getRoom(data.roomCode);
    if (room) {
      room.movieState = data.state;
      // Broadcast to everyone in the room so all clients (including sender) have the latest state
      io.to(data.roomCode).emit('movie-state-updated', data.state);
    }
  });

  socket.on('add-uploaded-movie', (data: { roomCode: string; userId: string; url: string; name: string }) => {
    const movie = roomManager.addUploadedMovie(data.roomCode, data.userId, data.url, data.name);
    if (movie) {
      const room = roomManager.getRoom(data.roomCode);
      if (room) {
        io.to(data.roomCode).emit('uploaded-movies-updated', room.uploadedMovies);
        io.to(data.roomCode).emit('room-updated', serializeRoom(room));
      }
    }
  });

  socket.on('remove-uploaded-movie', (data: { roomCode: string; movieId: string }) => {
    const result = roomManager.removeUploadedMovie(data.roomCode, data.movieId);
    if (result.success) {
      const room = roomManager.getRoom(data.roomCode);
      if (room) {
        io.to(data.roomCode).emit('uploaded-movies-updated', room.uploadedMovies);
        io.to(data.roomCode).emit('room-updated', serializeRoom(room));
        
        // Optionally delete the file from disk
        if (result.movieUrl && result.movieUrl.startsWith('/uploads/')) {
          const filename = path.basename(result.movieUrl);
          const filePath = path.join(__dirname, 'uploads', filename);
          fs.unlink(filePath, (err) => {
            if (err) console.error('Error deleting file:', err);
          });
        }
      }
    }
  });

  // Send message
  socket.on('send-message', (data: { roomCode: string; userId: string; content: string }, callback) => {
    try {
      const message = roomManager.addMessage(data.roomCode, data.userId, data.content);
      
      if (message) {
        io.to(data.roomCode).emit('new-message', message);
        callback({ success: true, message });
      } else {
        callback({ success: false, error: 'Failed to send message' });
      }
    } catch (error) {
      callback({ success: false, error: 'Server error' });
    }
  });

  // YouTube queue management
  socket.on('add-to-queue', (data: { roomCode: string; userId: string; videoId: string; title: string; index?: number }, callback) => {
    try {
      const item = roomManager.addToYouTubeQueue(data.roomCode, data.userId, data.videoId, data.title, data.index);
      
      if (item) {
        const room = roomManager.getRoom(data.roomCode);
        if (room) {
          io.to(data.roomCode).emit('room-updated', serializeRoom(room));
          io.to(data.roomCode).emit('music-track-changed', {
            currentTrackIndex: room.currentTrackIndex
          });
        }
        io.to(data.roomCode).emit('queue-updated', item);
        
        if (callback) callback({ success: true, item });
      } else {
        if (callback) callback({ success: false, error: 'Failed to add to queue' });
      }
    } catch (error) {
      if (callback) callback({ success: false, error: 'Server error' });
    }
  });

  socket.on('remove-from-queue', (data: { roomCode: string; itemId: string }, callback) => {
    try {
      const success = roomManager.removeFromYouTubeQueue(data.roomCode, data.itemId);
      
      if (success) {
        io.to(data.roomCode).emit('queue-item-removed', data.itemId);
        const room = roomManager.getRoom(data.roomCode);
        if (room) {
          io.to(data.roomCode).emit('room-updated', serializeRoom(room));
          io.to(data.roomCode).emit('music-track-changed', {
            currentTrackIndex: room.currentTrackIndex
          });
        }
        if (callback) callback({ success: true });
      } else {
        if (callback) callback({ success: false, error: 'Failed to remove from queue' });
      }
    } catch (error) {
      if (callback) callback({ success: false, error: 'Server error' });
    }
  });

  socket.on('set-current-track', (data: { roomCode: string; index: number }) => {
    const updated = roomManager.setCurrentTrackIndex(data.roomCode, data.index);
    if (!updated) return;

    const room = roomManager.getRoom(data.roomCode);
    if (room) {
      io.to(data.roomCode).emit('music-track-changed', {
        currentTrackIndex: room.currentTrackIndex
      });
      io.to(data.roomCode).emit('room-updated', serializeRoom(room));
    }
  });

  socket.on('update-music-state', (data: { roomCode: string; state: { isPlaying: boolean; trackIndex: number } }) => {
    const room = roomManager.getRoom(data.roomCode);
    if (room) {
      // Update track index if changed
      if (data.state.trackIndex !== room.currentTrackIndex) {
        roomManager.setCurrentTrackIndex(data.roomCode, data.state.trackIndex);
      }
      // Broadcast music state to all clients in the room
      io.to(data.roomCode).emit('music-state-updated', data.state);
    }
  });

  socket.on('search-youtube', async (query: string, callback) => {
    try {
      const r = await ytSearch(query);
      
      const results = r.videos.slice(0, 10).map((video) => ({
        videoId: video.videoId,
        title: video.title,
        thumbnail: video.thumbnail,
        channel: video.author.name,
        duration: video.seconds
      }));

      callback?.({ success: true, results });
    } catch (error) {
      console.error('YouTube search error:', error);
      callback?.({ success: false, error: 'Failed to search videos' });
    }
  });

  // Game invitation system
  socket.on('send-game-invitation', (data: { roomCode: string; gameType: 'uno' | 'ludo' | 'chess'; playerIds: string[]; inviterName: string }) => {
    try {
      const room = roomManager.getRoom(data.roomCode);
      if (!room) return;

       const inviterUser = Array.from(room.users.values()).find(u => u.socketId === socket.id);
       const inviterUserId = inviterUser?.id || '';

      // Send invitation to all invited players
      data.playerIds.forEach(playerId => {
        const userSocket = Array.from(room.users.values()).find(u => u.id === playerId);
        if (userSocket && userSocket.socketId !== socket.id) {
          io.to(userSocket.socketId).emit('game-invitation', {
            inviter: socket.id,
            inviterUserId,
            inviterName: data.inviterName,
            gameType: data.gameType,
            playerIds: data.playerIds
          });
        }
      });
    } catch (error) {
      console.error('Error sending game invitation:', error);
    }
  });

  socket.on('accept-game-invitation', (data: { roomCode: string; gameType: 'uno' | 'ludo' | 'chess'; playerIds: string[] }) => {
    try {
      const room = roomManager.getRoom(data.roomCode);
      if (!room) return;

      // Start the game immediately when accepted
      room.currentGame = data.gameType;

      if (data.gameType === 'uno') {
        room.gameState = unoGame.initializeGame(data.playerIds);
        
        // Send initial state
        const publicState = getPublicUnoState(room.gameState);
        io.to(data.roomCode).emit('uno-state-update', publicState);
        
        room.gameState.players.forEach((p: any) => {
            const userSocket = Array.from(room.users.values()).find(u => u.id === p.id);
            if (userSocket) {
                io.to(userSocket.socketId).emit('uno-hand-update', p.hand);
            }
        });
      } else if (data.gameType === 'ludo') {
        room.gameState = ludoGame.initializeGame(data.playerIds);
      } else if (data.gameType === 'chess') {
        room.gameState = chessGame.initializeGame(data.playerIds[0], data.playerIds[1]);
      }

      io.to(data.roomCode).emit('game-started', {
        gameType: data.gameType,
        gameState: data.gameType === 'uno' ? getPublicUnoState(room.gameState) : room.gameState
      });
    } catch (error) {
      console.error('Error accepting game invitation:', error);
    }
  });

  socket.on('decline-game-invitation', (data: { roomCode: string; inviter: string }) => {
    try {
      // Notify the inviter that the invitation was declined
      io.to(data.inviter).emit('invitation-declined');
    } catch (error) {
      console.error('Error declining game invitation:', error);
    }
  });

  // Start game (legacy, kept for compatibility)
  socket.on('start-game', (data: { roomCode: string; gameType: 'uno' | 'ludo' | 'chess'; playerIds: string[] }, callback) => {
    try {
      const room = roomManager.getRoom(data.roomCode);
      if (!room) {
        callback({ success: false, error: 'Room not found' });
        return;
      }

      room.currentGame = data.gameType;

      if (data.gameType === 'uno') {
        room.gameState = unoGame.initializeGame(data.playerIds);
        
        // Send initial state
        const publicState = getPublicUnoState(room.gameState);
        io.to(data.roomCode).emit('uno-state-update', publicState);
        
        room.gameState.players.forEach((p: any) => {
            const userSocket = Array.from(room.users.values()).find(u => u.id === p.id);
            if (userSocket) {
                io.to(userSocket.socketId).emit('uno-hand-update', p.hand);
            }
        });
      } else if (data.gameType === 'ludo') {
        room.gameState = ludoGame.initializeGame(data.playerIds);
      } else if (data.gameType === 'chess') {
        if (data.playerIds.length !== 2) {
          callback({ success: false, error: 'Chess requires exactly 2 players' });
          return;
        }
        room.gameState = chessGame.initializeGame(data.playerIds[0], data.playerIds[1]);
      }

      io.to(data.roomCode).emit('game-started', {
        gameType: data.gameType,
        gameState: data.gameType === 'uno' ? getPublicUnoState(room.gameState) : room.gameState
      });

      callback({ success: true, gameState: data.gameType === 'uno' ? getPublicUnoState(room.gameState) : room.gameState });
    } catch (error) {
      callback({ success: false, error: 'Server error' });
    }
  });

  // Uno game actions
  socket.on('uno-play-card', (data: { roomCode: string; userId: string; cardId: string; chosenColor?: any }, callback) => {
    try {
      const room = roomManager.getRoom(data.roomCode);
      if (!room || room.currentGame !== 'uno') {
        callback({ success: false, error: 'Invalid game state' });
        return;
      }

      const result = unoGame.playCard(room.gameState, data.userId, data.cardId, data.chosenColor);
      
      if (result.success) {
        // Broadcast public state
        const publicState = getPublicUnoState(result.gameState!);
        io.to(data.roomCode).emit('uno-state-update', publicState);

        // Send private hands
        result.gameState!.players.forEach((p: any) => {
            const userSocket = Array.from(room.users.values()).find(u => u.id === p.id);
            if (userSocket) {
                io.to(userSocket.socketId).emit('uno-hand-update', p.hand);
            }
        });

        io.to(data.roomCode).emit('uno-card-played', {
          userId: data.userId,
          nextAction: result.nextAction
        });

        const winner = unoGame.checkWinner(result.gameState!);
        if (winner) {
          io.to(data.roomCode).emit('game-ended', { winner, gameType: 'uno' });
          const winnerPlayer = result.gameState!.players.find(p => p.id === winner);
          if (winnerPlayer) {
             io.to(data.roomCode).emit('game-message', {
                text: `${winnerPlayer.name} has won the game!`,
                type: 'system'
            });
          }
        }
      }

      if (callback) callback(result);
    } catch (error) {
      if (callback) callback({ success: false, error: 'Server error' });
    }
  });

  socket.on('uno-draw-card', (data: { roomCode: string; userId: string }, callback) => {
    try {
      const room = roomManager.getRoom(data.roomCode);
      if (!room || room.currentGame !== 'uno') {
        callback({ success: false, error: 'Invalid game state' });
        return;
      }

      const result = unoGame.drawCard(room.gameState, data.userId);
      
      if (result.success) {
        // Broadcast public state
        const publicState = getPublicUnoState(room.gameState);
        io.to(data.roomCode).emit('uno-state-update', publicState);

        // Send private hands
        room.gameState.players.forEach((p: any) => {
            const userSocket = Array.from(room.users.values()).find(u => u.id === p.id);
            if (userSocket) {
                io.to(userSocket.socketId).emit('uno-hand-update', p.hand);
            }
        });

        io.to(data.roomCode).emit('uno-card-drawn', {
          userId: data.userId
        });
      }

      if (callback) callback(result);
    } catch (error) {
      if (callback) callback({ success: false, error: 'Server error' });
    }
  });

  // Ludo game actions
  socket.on('ludo-roll-dice', (data: { roomCode: string; userId: string }, callback) => {
    try {
      const room = roomManager.getRoom(data.roomCode);
      if (!room || room.currentGame !== 'ludo') {
        callback({ success: false, error: 'Invalid game state' });
        return;
      }

      const result = ludoGame.handleDiceRoll(room.gameState, data.userId);
      
      if (result.success) {
        io.to(data.roomCode).emit('ludo-dice-rolled', {
          userId: data.userId,
          roll: result.roll,
          gameState: room.gameState
        });
      }

      if (callback) callback(result);
    } catch (error) {
      if (callback) callback({ success: false, error: 'Server error' });
    }
  });

  socket.on('ludo-move-token', (data: { roomCode: string; userId: string; tokenId: string }, callback) => {
    try {
      const room = roomManager.getRoom(data.roomCode);
      if (!room || room.currentGame !== 'ludo') {
        callback({ success: false, error: 'Invalid game state' });
        return;
      }

      const result = ludoGame.moveToken(room.gameState, data.userId, data.tokenId);
      
      if (result.success) {
        io.to(data.roomCode).emit('ludo-token-moved', {
          userId: data.userId,
          tokenId: data.tokenId,
          gameState: room.gameState,
          capturedTokens: result.capturedTokens
        });

        if (result.winner) {
          io.to(data.roomCode).emit('game-ended', { winner: result.winner, gameType: 'ludo' });
        }
      }

      if (callback) callback(result);
    } catch (error) {
      if (callback) callback({ success: false, error: 'Server error' });
    }
  });

  // Chess game actions
  socket.on('chess-move', (data: { roomCode: string; userId: string; from: string; to: string; promotion?: string }, callback) => {
    try {
      const room = roomManager.getRoom(data.roomCode);
      if (!room || room.currentGame !== 'chess') {
        callback({ success: false, error: 'Invalid game state' });
        return;
      }

      const fromCoord = chessGame.fromAlgebraic(data.from);
      const toCoord = chessGame.fromAlgebraic(data.to);
      // Cast promotion string to ChessPieceType if present
      const result = chessGame.makeMove(room.gameState, data.userId, fromCoord, toCoord, data.promotion as any);
      
      if (result.success) {
        io.to(data.roomCode).emit('chess-move-made', {
          userId: data.userId,
          from: data.from,
          to: data.to,
          gameState: result.gameState
        });

        if (result.gameState?.gameOver) {
          io.to(data.roomCode).emit('game-ended', { 
            winner: result.gameState.winner, 
            gameType: 'chess' 
          });
        }
      }

      if (callback) callback(result);
    } catch (error) {
      if (callback) callback({ success: false, error: 'Server error' });
    }
  });

  socket.on('chess-resign', (data: { roomCode: string; userId: string }, callback) => {
    try {
      const room = roomManager.getRoom(data.roomCode);
      if (!room || room.currentGame !== 'chess') {
        callback({ success: false, error: 'Invalid game state' });
        return;
      }

      const result = chessGame.resignGame(room.gameState, data.userId);
      
      if (result.success) {
        io.to(data.roomCode).emit('game-ended', { 
          winner: result.winner, 
          gameType: 'chess',
          reason: 'resignation'
        });
      }

      if (callback) callback(result);
    } catch (error) {
      if (callback) callback({ success: false, error: 'Server error' });
    }
  });

  // Leave room
  socket.on('leave-room', async (data: { userId: string }) => {
    try {
      const roomData = roomManager.getRoomByUserId(data.userId);
      if (!roomData) return;

      const { room } = roomData;
      const leavingUser = room.users.get(data.userId);
      const wasAdmin = leavingUser?.isAdmin || false;

      const result = roomManager.leaveRoom(data.userId);
      
      if (result) {
        // If admin left, close the room for everyone
        if (wasAdmin) {
          io.to(result.roomCode).emit('room-closed');
          // Force disconnect all users from the room
          const sockets = await io.in(result.roomCode).fetchSockets();
          sockets.forEach(s => {
            s.leave(result.roomCode);
          });
        } else {
          // Normal user left
          socket.to(result.roomCode).emit('user-left', { userId: data.userId });
          socket.leave(result.roomCode);
          
          // Broadcast updated room to remaining users
          io.to(result.roomCode).emit('room-updated', serializeRoom(result.room));
        }
      }
      broadcastPublicRooms();
    } catch (error) {
      console.error('Error leaving room:', error);
    }
  });

  // Leave/End game
  socket.on('leave-game', (data: { roomCode: string; userId: string }) => {
    try {
      const room = roomManager.getRoom(data.roomCode);
      if (!room) return;

      // Reset game state for the room
      room.currentGame = null;
      room.gameState = null;

      io.to(data.roomCode).emit('game-left', {
        userId: data.userId
      });
      
      // Also emit room update to ensure clients sync
      io.to(data.roomCode).emit('room-updated', serializeRoom(room));

    } catch (error) {
      console.error('Error leaving game:', error);
    }
  });

  socket.on('disconnect', async () => {
    console.log('User disconnected:', socket.id);
    
    try {
      const userId = (socket as any).userId as string | undefined;
      if (!userId) return;

      const roomData = roomManager.getRoomByUserId(userId);
      if (!roomData) return;

      const { room } = roomData;
      const disconnectingUser = room.users.get(userId);
      const wasAdmin = disconnectingUser?.isAdmin || false;

      const result = roomManager.leaveRoom(userId);
      
      if (result) {
        // If admin disconnected, close the room for everyone
        if (wasAdmin) {
          io.to(result.roomCode).emit('room-closed');
          const sockets = await io.in(result.roomCode).fetchSockets();
          sockets.forEach(s => {
            s.leave(result.roomCode);
          });
        } else {
          // Normal user disconnected
          socket.to(result.roomCode).emit('user-left', { userId });
          io.to(result.roomCode).emit('room-updated', serializeRoom(result.room));
        }
      }
      broadcastPublicRooms();
    } catch (error) {
      console.error('Error handling disconnect:', error);
    }
  });

  // Catch UNO failure
  socket.on('uno-catch-failure', (data: { roomCode: string; userId: string; targetId: string }, callback) => {
    try {
      const room = roomManager.getRoom(data.roomCode);
      if (!room || room.currentGame !== 'uno') {
        if (callback) callback({ success: false, error: 'Invalid game state' });
        return;
      }

      const result = unoGame.catchUnoFailure(room.gameState, data.userId, data.targetId);
      
      if (result.success) {
        const publicState = getPublicUnoState(room.gameState);
        io.to(data.roomCode).emit('uno-state-update', publicState);
        
        const unoState = room.gameState as UnoGameState;
        const accuser = unoState.players.find(p => p.id === data.userId);
        const target = unoState.players.find(p => p.id === data.targetId);
        
        if (accuser && target) {
             io.to(data.roomCode).emit('game-message', {
                text: `${accuser.name} caught ${target.name} not saying UNO!`,
                type: 'system'
            });
        }
      }

      if (callback) callback(result);
    } catch (error) {
      if (callback) callback({ success: false, error: 'Server error' });
    }
  });
});

const PORT = process.env.PORT || 3001;

httpServer.listen(Number(PORT), '0.0.0.0', () => {
  console.log(`\n🚀 Server running on port ${PORT}`);
  console.log(`   Local:   http://localhost:${PORT}`);
  
  // Show network addresses
  const nets = networkInterfaces();
  const addresses: string[] = [];
  for (const name of Object.keys(nets)) {
    const net = nets[name];
    if (net) {
      for (const netInterface of net) {
        if (netInterface.family === 'IPv4' && !netInterface.internal) {
          addresses.push(netInterface.address);
        }
      }
    }
  }
  if (addresses.length > 0) {
    addresses.forEach(addr => {
      console.log(`   Network: http://${addr}:${PORT}`);
    });
  }
  console.log('');
});

// (search handler is registered in the main connection handler above)
