import { Room, User, Message, YouTubeQueueItem } from './types';
import { v4 as uuidv4 } from 'uuid';

class RoomManager {
  private rooms: Map<string, Room> = new Map();
  private userToRoom: Map<string, string> = new Map();
  private readonly ROOM_EXPIRY_TIME = 10 * 60 * 1000; // 10 minutes

  constructor() {
    // Check for expired rooms every minute
    setInterval(() => this.cleanupExpiredRooms(), 60000);
  }

  generateRoomCode(): string {
    let code: string;
    do {
      code = Math.floor(1000 + Math.random() * 9000).toString();
    } while (this.rooms.has(code));
    return code;
  }

  createRoom(visibility: 'public' | 'private' = 'private'): string {
    const code = this.generateRoomCode();
    const room: Room = {
      code,
      visibility,
      users: new Map(),
      messages: [],
      youtubeQueue: [],
      currentTrackIndex: 0,
      uploadedMovies: [],
      movieUrl: '',
      movieState: {
        isPlaying: false,
        currentTime: 0,
        lastUpdated: Date.now()
      },
      currentGame: null,
      gameState: null,
      createdAt: Date.now(),
      lastActivity: Date.now()
    };
    this.rooms.set(code, room);
    return code;
  }

  private ensureAdmin(room: Room) {
    const hasAdmin = Array.from(room.users.values()).some(u => u.isAdmin);
    if (!hasAdmin) {
      const first = room.users.values().next().value as User | undefined;
      if (first) {
        first.isAdmin = true;
        room.users.set(first.id, first);
      }
    }
  }

  joinRoom(code: string, userId: string, displayName: string, socketId: string): Room | null {
    const room = this.rooms.get(code);
    if (!room) return null;

    const isFirstUser = room.users.size === 0;
    const user: User = { id: userId, displayName, socketId, isAdmin: isFirstUser };
    room.users.set(userId, user);
    room.lastActivity = Date.now();
    this.userToRoom.set(userId, code);
    return room;
  }

  leaveRoom(userId: string): { room: Room; roomCode: string } | null {
    const roomCode = this.userToRoom.get(userId);
    if (!roomCode) return null;

    const room = this.rooms.get(roomCode);
    if (!room) return null;

    room.users.delete(userId);
    this.userToRoom.delete(userId);
    room.lastActivity = Date.now();

    this.ensureAdmin(room);

    // Delete room if empty
    if (room.users.size === 0) {
      this.rooms.delete(roomCode);
      return null;
    }

    return { room, roomCode };
  }

  getRoom(code: string): Room | undefined {
    return this.rooms.get(code);
  }

  getRoomByUserId(userId: string): { room: Room; code: string } | null {
    const code = this.userToRoom.get(userId);
    if (!code) return null;
    const room = this.rooms.get(code);
    if (!room) return null;
    return { room, code };
  }

  updateUserSocket(userId: string, socketId: string): void {
    const roomData = this.getRoomByUserId(userId);
    if (!roomData) return;
    
    const user = roomData.room.users.get(userId);
    if (user) {
      user.socketId = socketId;
      roomData.room.lastActivity = Date.now();
    }
  }

  kickUser(adminId: string, targetUserId: string): { success: boolean; room?: Room; roomCode?: string; targetSocketId?: string } {
    const roomData = this.getRoomByUserId(adminId);
    if (!roomData) return { success: false };
    const { room, code } = roomData;
    const admin = room.users.get(adminId);
    const target = room.users.get(targetUserId);
    if (!admin || !target) return { success: false };
    if (!admin.isAdmin) return { success: false };
    if (target.isAdmin) return { success: false };

    room.users.delete(targetUserId);
    this.userToRoom.delete(targetUserId);
    room.lastActivity = Date.now();
    this.ensureAdmin(room);

    return { success: true, room, roomCode: code, targetSocketId: target.socketId };
  }

  addUploadedMovie(roomCode: string, userId: string, url: string, name: string): any {
    const room = this.rooms.get(roomCode);
    if (!room) return null;

    const user = room.users.get(userId);
    if (!user) return null;

    const movie = {
      id: uuidv4(),
      url,
      name,
      uploadedBy: userId,
      uploadedByName: user.displayName,
      timestamp: Date.now()
    };

    room.uploadedMovies.push(movie);
    room.lastActivity = Date.now();
    return movie;
  }

  removeUploadedMovie(roomCode: string, movieId: string): { success: boolean; movieUrl?: string } {
    const room = this.rooms.get(roomCode);
    if (!room) return { success: false };

    const movieIndex = room.uploadedMovies.findIndex(m => m.id === movieId);
    if (movieIndex === -1) return { success: false };

    const movie = room.uploadedMovies[movieIndex];
    room.uploadedMovies.splice(movieIndex, 1);
    room.lastActivity = Date.now();

    return { success: true, movieUrl: movie.url };
  }

  setCurrentTrackIndex(roomCode: string, index: number): boolean {
    const room = this.rooms.get(roomCode);
    if (!room) return false;

    if (index < 0 || index >= room.youtubeQueue.length) {
      return false;
    }

    room.currentTrackIndex = index;
    room.lastActivity = Date.now();
    return true;
  }

  addMessage(roomCode: string, userId: string, content: string): Message | null {
    const room = this.rooms.get(roomCode);
    if (!room) return null;

    const user = room.users.get(userId);
    if (!user) return null;

    const message: Message = {
      id: uuidv4(),
      userId,
      displayName: user.displayName,
      content,
      timestamp: Date.now()
    };

    room.messages.push(message);
    room.lastActivity = Date.now();
    return message;
  }

  addToYouTubeQueue(roomCode: string, userId: string, videoId: string, title: string, index?: number): YouTubeQueueItem | null {
    const room = this.rooms.get(roomCode);
    if (!room) return null;

    const user = room.users.get(userId);
    if (!user) return null;

    const item: YouTubeQueueItem = {
      id: uuidv4(),
      videoId,
      title,
      addedBy: userId,
      addedByName: user.displayName
    };

    const wasEmpty = room.youtubeQueue.length === 0;
    const currentIndex = room.currentTrackIndex;
    const insertIndex = typeof index === 'number' && index >= 0 && index <= room.youtubeQueue.length
      ? index
      : room.youtubeQueue.length;

    room.youtubeQueue.splice(insertIndex, 0, item);

    if (wasEmpty) {
      room.currentTrackIndex = 0;
    } else if (insertIndex <= currentIndex) {
      room.currentTrackIndex = currentIndex + 1;
    }
    
    room.lastActivity = Date.now();
    return item;
  }

  setRoomVisibility(roomCode: string, visibility: 'public' | 'private'): boolean {
    const room = this.rooms.get(roomCode);
    if (!room) return false;
    room.visibility = visibility;
    room.lastActivity = Date.now();
    return true;
  }

  getPublicRoomsSummary() {
    return Array.from(this.rooms.values())
      .filter(room => room.visibility === 'public' && room.users.size > 0)
      .map(room => {
        const admin = Array.from(room.users.values()).find(user => user.isAdmin);
        return {
          code: room.code,
          occupants: room.users.size,
          host: admin?.displayName || null,
          createdAt: room.createdAt,
          lastActivity: room.lastActivity
        };
      })
      .sort((a, b) => {
        if (b.occupants !== a.occupants) {
          return b.occupants - a.occupants;
        }
        return b.lastActivity - a.lastActivity;
      });
  }

  removeFromYouTubeQueue(roomCode: string, itemId: string): boolean {
    const room = this.rooms.get(roomCode);
    if (!room) return false;

    const index = room.youtubeQueue.findIndex(item => item.id === itemId);
    if (index === -1) return false;

    room.youtubeQueue.splice(index, 1);

    const newLength = room.youtubeQueue.length;
    if (newLength === 0) {
      room.currentTrackIndex = 0;
    } else if (index < room.currentTrackIndex) {
      room.currentTrackIndex -= 1;
    } else if (index === room.currentTrackIndex) {
      room.currentTrackIndex = Math.min(room.currentTrackIndex, newLength - 1);
    } else if (room.currentTrackIndex >= newLength) {
      room.currentTrackIndex = newLength - 1;
    }

    room.lastActivity = Date.now();
    return true;
  }

  private cleanupExpiredRooms(): void {
    const now = Date.now();
    for (const [code, room] of this.rooms.entries()) {
      if (now - room.lastActivity > this.ROOM_EXPIRY_TIME) {
        // Remove all users from userToRoom map
        for (const userId of room.users.keys()) {
          this.userToRoom.delete(userId);
        }
        this.rooms.delete(code);
        console.log(`Room ${code} expired and removed`);
      }
    }
  }

  getRoomStats() {
    return {
      totalRooms: this.rooms.size,
      totalUsers: this.userToRoom.size
    };
  }
}

export const roomManager = new RoomManager();
