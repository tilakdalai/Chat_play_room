import { roomManager } from '../roomManager';

describe('RoomManager', () => {
  beforeEach(() => {
    // Reset room manager state
  });

  test('should create a room with 4-digit code', () => {
    const code = roomManager.createRoom();
    expect(code).toHaveLength(4);
    expect(parseInt(code)).toBeGreaterThanOrEqual(1000);
    expect(parseInt(code)).toBeLessThanOrEqual(9999);
  });

  test('should allow user to join room', () => {
    const code = roomManager.createRoom();
    const room = roomManager.joinRoom(code, 'user1', 'John', 'socket1');
    
    expect(room).toBeTruthy();
    expect(room?.users.size).toBe(1);
    expect(room?.users.get('user1')?.displayName).toBe('John');
  });

  test('should not allow joining non-existent room', () => {
    const room = roomManager.joinRoom('9999', 'user1', 'John', 'socket1');
    expect(room).toBeNull();
  });

  test('should add message to room', () => {
    const code = roomManager.createRoom();
    roomManager.joinRoom(code, 'user1', 'John', 'socket1');
    
    const message = roomManager.addMessage(code, 'user1', 'Hello!');
    expect(message).toBeTruthy();
    expect(message?.content).toBe('Hello!');
    expect(message?.displayName).toBe('John');
  });

  test('should remove user when leaving room', () => {
    const code = roomManager.createRoom();
    roomManager.joinRoom(code, 'user1', 'John', 'socket1');
    
    const result = roomManager.leaveRoom('user1');
    expect(result).toBeNull(); // Room deleted when last user leaves
  });

  test('should keep room when not all users leave', () => {
    const code = roomManager.createRoom();
    roomManager.joinRoom(code, 'user1', 'John', 'socket1');
    roomManager.joinRoom(code, 'user2', 'Jane', 'socket2');
    
    const result = roomManager.leaveRoom('user1');
    expect(result).toBeTruthy();
    expect(result?.room.users.size).toBe(1);
  });
});
