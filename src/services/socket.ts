import { io, Socket } from 'socket.io-client';

class SocketService {
  private socket: Socket | null = null;

  connect(): Socket {
    if (this.socket?.connected) {
      return this.socket;
    }

    // Use the current hostname for Socket.IO connection (works for both localhost and network access)
    const socketUrl = window.location.hostname === 'localhost' 
      ? 'http://localhost:3001'
      : `http://${window.location.hostname}:3001`;

    this.socket = io(socketUrl, {
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5
    });

    this.socket.on('connect', () => {
      console.log('Connected to server');
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from server');
    });

    return this.socket;
  }

  getSocket(): Socket | null {
    return this.socket;
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }
}

export const socketService = new SocketService();
