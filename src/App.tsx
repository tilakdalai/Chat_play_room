import { useState, useEffect } from 'react';
import { socketService } from './services/socket';
import Lobby from './components/Lobby';
import RoomView from './components/RoomView';
import LoadingScreen from './components/LoadingScreen';
import { Room, PublicRoomSummary } from './types';

function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [room, setRoom] = useState<Room | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [publicRooms, setPublicRooms] = useState<PublicRoomSummary[]>([]);

  useEffect(() => {
    const socket = socketService.connect();

    const handlePublicRoomsUpdate = (rooms: PublicRoomSummary[]) => {
      setPublicRooms(rooms);
    };

    socket.on('public-rooms-updated', handlePublicRoomsUpdate);
    socket.emit('get-public-rooms', (response: { rooms: PublicRoomSummary[] }) => {
      if (response?.rooms) {
        setPublicRooms(response.rooms);
      }
    });

    // Try to reconnect if user was in a room
    const savedUserId = localStorage.getItem('playroom_userId');
    const savedRoomCode = localStorage.getItem('playroom_roomCode');

    if (savedUserId && savedRoomCode) {
      socket.emit('reconnect-room', { userId: savedUserId }, (response: any) => {
        if (response.success) {
          setRoom(response.room);
          setUserId(savedUserId);
          setRoomCode(response.roomCode);
        } else {
          localStorage.removeItem('playroom_userId');
          localStorage.removeItem('playroom_roomCode');
        }
      });
    }

    // Listen for room updates
    socket.on('user-joined', (data: { userId: string; displayName: string }) => {
      setRoom((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          users: [...prev.users, { id: data.userId, displayName: data.displayName, socketId: '' }]
        };
      });
    });

    socket.on('user-left', (data: { userId: string }) => {
      setRoom((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          users: prev.users.filter((u) => u.id !== data.userId)
        };
      });
    });

    socket.on('new-message', (message: any) => {
      setRoom((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          messages: [...prev.messages, message]
        };
      });
    });

    socket.on('queue-updated', (item: any) => {
      setRoom((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          youtubeQueue: [...prev.youtubeQueue, item]
        };
      });
    });

    socket.on('queue-item-removed', (itemId: string) => {
      setRoom((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          youtubeQueue: prev.youtubeQueue.filter((item) => item.id !== itemId)
        };
      });
    });

    socket.on('game-started', (data: { gameType: string; gameState: any }) => {
      setRoom((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          currentGame: data.gameType as any,
          gameState: data.gameState
        };
      });
    });

    // Game Updates
    socket.on('uno-state-update', (gameState: any) => {
      setRoom((prev) => {
        if (!prev) return prev;
        // Preserve myHand if it exists in previous state
        const myHand = prev.gameState?.myHand;
        return {
          ...prev,
          gameState: { ...gameState, myHand }
        };
      });
    });

    socket.on('uno-hand-update', (hand: any[]) => {
      setRoom((prev) => {
        if (!prev || !prev.gameState) return prev;
        return {
          ...prev,
          gameState: {
              ...prev.gameState,
              myHand: hand
          }
        };
      });
    });

    socket.on('uno-card-played', () => {
       // Animation trigger could go here
    });

    socket.on('uno-card-drawn', () => {
       // Animation trigger could go here
    });

    socket.on('ludo-token-moved', (data: { gameState: any }) => {
      setRoom((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          gameState: data.gameState
        };
      });
    });

    socket.on('ludo-dice-rolled', (data: { gameState: any }) => {
      setRoom((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          gameState: data.gameState
        };
      });
    });

    socket.on('chess-move-made', (data: { gameState: any }) => {
      setRoom((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          gameState: data.gameState
        };
      });
    });

    socket.on('game-ended', (data: { winner: string; gameType: string }) => {
      // You might want to show a winner modal here or just update the state
      // For now, we'll just update the game state if it's included, 
      // but usually game-ended might not send the full state, just the winner.
      // If the server sends the final state in the previous move event, we are good.
      // But we should probably mark the game as over in the UI if not already.
      // The gameState usually has a 'winner' field or 'gameOver' field.
      // Let's assume the previous move event updated the state to show game over.
      // Or we can trigger a refetch or just show a toast.
      console.log('Game ended, winner:', data.winner);
    });

    socket.on('game-left', () => {
      setRoom((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          currentGame: null,
          gameState: null
        };
      });
    });

    socket.on('kicked', () => {
      alert('You have been kicked from the room by the admin.');
      setRoom(null);
      setUserId(null);
      setRoomCode(null);
      localStorage.removeItem('playroom_userId');
      localStorage.removeItem('playroom_roomCode');
    });

    socket.on('room-closed', () => {
      alert('The room has been closed because the admin left.');
      setRoom(null);
      setUserId(null);
      setRoomCode(null);
      localStorage.removeItem('playroom_userId');
      localStorage.removeItem('playroom_roomCode');
    });

    socket.on('movie-url-updated', (url: string) => {
      setRoom((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          movieUrl: url
        };
      });
    });

    socket.on('movie-state-updated', (state: any) => {
      setRoom((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          movieState: state
        };
      });
    });

    socket.on('uploaded-movies-updated', (movies: any[]) => {
      setRoom((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          uploadedMovies: movies
        };
      });
    });

    socket.on('room-updated', (updatedRoom: Room) => {
      setRoom((prev) => {
        const merged: Room = {
          ...(prev || updatedRoom),
          ...updatedRoom,
          gameState: updatedRoom.gameState ?? prev?.gameState ?? null,
        } as Room;

        if (prev?.gameState?.myHand && merged.gameState) {
          merged.gameState = { ...merged.gameState, myHand: prev.gameState.myHand };
        }

        return merged;
      });
    });

    socket.on('music-track-changed', (data: { currentTrackIndex: number }) => {
      setRoom((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          currentTrackIndex: data.currentTrackIndex
        };
      });
    });

    return () => {
      socket.off('public-rooms-updated', handlePublicRoomsUpdate);
      socketService.disconnect();
    };
  }, []);

  const handleJoinRoom = (code: string, displayName: string, newUserId?: string) => {
    const socket = socketService.getSocket();
    if (!socket) return;

    socket.emit('join-room', { roomCode: code, displayName, userId: newUserId }, (response: any) => {
      if (response.success) {
        setRoom(response.room);
        setUserId(response.userId);
        setRoomCode(code);
        localStorage.setItem('playroom_userId', response.userId);
        localStorage.setItem('playroom_roomCode', code);
      }
    });
  };

  const handleCreateRoom = (displayName: string, visibility: 'public' | 'private') => {
    const socket = socketService.getSocket();
    if (!socket) return;

    socket.emit('create-room', { displayName, visibility }, (response: any) => {
      if (response.success) {
        setRoom(response.room);
        setUserId(response.userId);
        setRoomCode(response.roomCode);
        localStorage.setItem('playroom_userId', response.userId);
        localStorage.setItem('playroom_roomCode', response.roomCode);
      }
    });
  };

  const handleLeaveRoom = () => {
    const socket = socketService.getSocket();
    if (!socket || !userId) return;

    socket.emit('leave-room', { userId });
    setRoom(null);
    setUserId(null);
    setRoomCode(null);
    localStorage.removeItem('playroom_userId');
    localStorage.removeItem('playroom_roomCode');
  };

  if (isLoading) {
    return <LoadingScreen onComplete={() => setIsLoading(false)} />;
  }

  return (
    <div className="min-h-screen bg-black text-white font-sans selection:bg-purple-500/30">
      {room && userId && roomCode ? (
        <RoomView 
          room={room} 
          userId={userId} 
          roomCode={roomCode}
          onLeave={handleLeaveRoom}
          onRoomUpdate={setRoom}
        />
      ) : (
        <Lobby 
          onJoinRoom={handleJoinRoom} 
          onCreateRoom={handleCreateRoom} 
          publicRooms={publicRooms}
        />
      )}
    </div>
  );
}

export default App;
