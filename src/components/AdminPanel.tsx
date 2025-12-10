import { useState, useMemo } from 'react';
import { User } from '../types';
import { socketService } from '../services/socket';

interface AdminPanelProps {
  users: User[];
  userId: string;
  isAdmin: boolean;
  roomCode: string;
}

export default function AdminPanel({ users, userId, isAdmin, roomCode }: AdminPanelProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [confirmKick, setConfirmKick] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'users' | 'settings'>('users');

  if (!isAdmin) return null;

  const handleShare = async () => {
    const shareData = {
      title: 'Join my Room',
      text: `Join my room with code: ${roomCode}`,
      url: window.location.href
    };

    try {
      if (navigator.share) {
        await navigator.share(shareData);
      } else {
        await navigator.clipboard.writeText(
          `Join my room! Code: ${roomCode}\nLink: ${window.location.href}`
        );
        showNotification('Room details copied to clipboard!', 'success');
      }
    } catch (err) {
      console.error('Error sharing:', err);
    }
  };

  const handleKickUser = (targetUserId: string, userName: string) => {
    const socket = socketService.getSocket();
    if (!socket) return;

    socket.emit('kick-user', { targetUserId }, (response: any) => {
      if (response.success) {
        setConfirmKick(null);
        // Show success feedback
        showNotification(`${userName} has been removed from the room`, 'success');
      } else {
        showNotification('Failed to kick user: ' + (response.error || 'Unknown error'), 'error');
      }
    });
  };

  const showNotification = (message: string, type: 'success' | 'error') => {
    // Simple notification (you can enhance this with a toast library)
    const notification = document.createElement('div');
    notification.className = `fixed top-4 right-4 z-[100] px-6 py-3 rounded-lg shadow-2xl text-white font-medium ${
      type === 'success' ? 'bg-green-600' : 'bg-red-600'
    } animate-fade-in`;
    notification.textContent = message;
    document.body.appendChild(notification);
    setTimeout(() => {
      notification.remove();
    }, 3000);
  };

  const otherUsers = users.filter(u => u.id !== userId);
  
  const filteredUsers = useMemo(() => {
    return otherUsers.filter(user => 
      user.displayName.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [otherUsers, searchQuery]);

  const stats = useMemo(() => ({
    totalUsers: users.length,
    onlineUsers: users.length, // All users in room are considered online
    adminUser: users.find(u => u.id === userId)
  }), [users, userId]);

  return (
    <>
      {/* Toggle Button */}
      <button
        onClick={() => setIsOpen(true)}
        className="group relative flex items-center gap-2 px-3 py-1.5 md:px-4 md:py-2 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white rounded-lg shadow-lg hover:shadow-red-500/30 transition-all duration-300 border border-white/10"
      >
        <div className="relative">
          <span className="text-base md:text-lg">🛡️</span>
          <span className="absolute -top-1 -right-1 w-2 h-2 md:w-2.5 md:h-2.5 bg-green-400 rounded-full animate-pulse border border-red-600"></span>
        </div>
        <span className="font-bold text-xs md:text-sm tracking-wide hidden sm:inline">ADMIN</span>
      </button>

      {/* Modal Overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div 
            className="absolute inset-0" 
            onClick={() => setIsOpen(false)}
          />
          
          {/* Main Panel */}
          <div className="relative w-full max-w-5xl bg-[#1a1c2c] rounded-2xl shadow-2xl border border-white/10 overflow-hidden flex flex-col md:flex-row h-[65vh] md:h-[80vh] animate-scale-in">
            
            {/* Sidebar */}
            <div className="w-full md:w-64 bg-black/20 border-r border-white/5 p-4 flex flex-col gap-2">
              <div className="mb-6 px-2">
                <h2 className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-rose-400">
                  Admin Panel
                </h2>
                <p className="text-xs text-white/40 mt-1">Room Control Center</p>
              </div>

              <button
                onClick={() => setActiveTab('users')}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                  activeTab === 'users' 
                    ? 'bg-white/10 text-white shadow-lg border border-white/5' 
                    : 'text-white/60 hover:bg-white/5 hover:text-white'
                }`}
              >
                <span>👥</span>
                <span className="font-medium">User Management</span>
              </button>

              <button
                onClick={() => setActiveTab('settings')}
                className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                  activeTab === 'settings' 
                    ? 'bg-white/10 text-white shadow-lg border border-white/5' 
                    : 'text-white/60 hover:bg-white/5 hover:text-white'
                }`}
              >
                <span>⚙️</span>
                <span className="font-medium">Room Settings</span>
              </button>

              <button
                onClick={handleShare}
                className="flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-white/60 hover:bg-white/5 hover:text-white"
              >
                <span>🔗</span>
                <span className="font-medium">Share Room</span>
              </button>

              <div className="mt-auto">
                <div className="p-4 rounded-xl bg-gradient-to-br from-red-500/10 to-rose-500/10 border border-red-500/20">
                  <div className="text-xs text-red-400 font-bold mb-1">ADMIN STATUS</div>
                  <div className="flex items-center gap-2 text-sm text-white/80">
                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
                    Active
                  </div>
                </div>
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 flex flex-col bg-[#0f111a]/50">
              {/* Header */}
              <div className="h-16 border-b border-white/5 flex items-center justify-between px-6 bg-black/20">
                <h3 className="text-lg font-semibold text-white">
                  {activeTab === 'users' ? 'Manage Users' : 'Room Settings'}
                </h3>
                <button 
                  onClick={() => setIsOpen(false)}
                  className="w-8 h-8 rounded-full bg-white/5 hover:bg-red-500/20 hover:text-red-400 flex items-center justify-center transition-colors"
                >
                  ✕
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-6">
                {activeTab === 'users' && (
                  <div className="space-y-6">
                    {/* Stats Row */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                        <div className="text-white/40 text-xs font-bold uppercase tracking-wider mb-1">Total Users</div>
                        <div className="text-2xl font-bold text-white">{stats.totalUsers}</div>
                      </div>
                      <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                        <div className="text-white/40 text-xs font-bold uppercase tracking-wider mb-1">Admins</div>
                        <div className="text-2xl font-bold text-purple-400">
                          {users.filter(u => u.isAdmin).length}
                        </div>
                      </div>
                      <div className="bg-white/5 rounded-xl p-4 border border-white/5">
                        <div className="text-white/40 text-xs font-bold uppercase tracking-wider mb-1">Guests</div>
                        <div className="text-2xl font-bold text-blue-400">
                          {users.filter(u => !u.isAdmin).length}
                        </div>
                      </div>
                    </div>

                    {/* Search */}
                    <div className="relative">
                      <input
                        type="text"
                        placeholder="Search users..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/30 focus:outline-none focus:border-red-500/50 transition-colors"
                      />
                      <span className="absolute right-4 top-3.5 text-white/30">🔍</span>
                    </div>

                    {/* User List */}
                    <div className="space-y-2">
                      {filteredUsers.length === 0 ? (
                        <div className="text-center py-12 text-white/30">
                          No users found matching "{searchQuery}"
                        </div>
                      ) : (
                        <>
                          {/* Admin Card (You) */}
                          <div className="relative overflow-hidden bg-gradient-to-br from-amber-600/30 via-yellow-500/20 to-orange-600/30 border-2 border-yellow-500/50 rounded-2xl p-4 md:p-5 shadow-xl mb-4">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-yellow-500/10 rounded-full blur-3xl"></div>
                            <div className="relative flex items-center gap-4">
                              <div className="w-14 h-14 md:w-16 md:h-16 rounded-2xl bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center text-white font-bold text-xl md:text-2xl shadow-xl border-2 border-white/30">
                                {stats.adminUser?.displayName.charAt(0).toUpperCase()}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-white text-lg truncate">
                                    {stats.adminUser?.displayName}
                                  </span>
                                  <span className="text-xs bg-yellow-500 text-black px-2.5 py-1 rounded-full font-bold shadow-md">
                                    YOU
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 mt-2 flex-wrap">
                                  <span className="text-xs bg-gradient-to-r from-yellow-500 to-orange-500 text-white px-3 py-1 rounded-full font-bold shadow-lg flex items-center gap-1.5">
                                    <span className="text-sm">👑</span> 
                                    <span>Admin</span>
                                  </span>
                                  <span className="text-xs text-gray-300 font-medium">Room Creator & Moderator</span>
                                </div>
                              </div>
                            </div>
                          </div>

                          {filteredUsers
                            .filter(u => u.id !== userId)
                            .map((user) => (
                              <div 
                                key={user.id}
                                className="group flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 rounded-xl border border-white/5 transition-all"
                              >
                                <div className="flex items-center gap-4">
                                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-bold shadow-lg">
                                    {user.displayName.charAt(0).toUpperCase()}
                                  </div>
                                  <div>
                                    <div className="font-medium text-white flex items-center gap-2">
                                      {user.displayName}
                                      {user.isAdmin && <span className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-0.5 rounded-full border border-yellow-500/30">Admin</span>}
                                    </div>
                                    <div className="text-xs text-white/40">ID: {user.id.slice(0, 8)}...</div>
                                  </div>
                                </div>

                                {/* Kick Button */}
                                {confirmKick === user.id ? (
                                  <div className="flex items-center gap-2 shrink-0">
                                    <button
                                      onClick={() => handleKickUser(user.id, user.displayName)}
                                      className="px-3 md:px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm font-bold transition-all shadow-lg hover:shadow-xl transform hover:scale-105 active:scale-95"
                                    >
                                      ✓ Confirm
                                    </button>
                                    <button
                                      onClick={() => setConfirmKick(null)}
                                      className="px-3 md:px-4 py-2 bg-gray-600 hover:bg-gray-500 text-white rounded-lg text-sm font-medium transition-all"
                                    >
                                      Cancel
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => setConfirmKick(user.id)}
                                    className="px-3 md:px-4 py-2 bg-red-600/20 hover:bg-red-600 border border-red-500/50 hover:border-red-500 text-red-400 hover:text-white rounded-lg text-sm font-medium transition-all opacity-0 group-hover:opacity-100 flex items-center gap-2 shrink-0 shadow-lg"
                                    title={`Kick ${user.displayName} from room`}
                                  >
                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                    </svg>
                                    <span className="hidden sm:inline">Kick</span>
                                  </button>
                                )}
                              </div>
                            ))}
                        </>
                      )}
                    </div>
                  </div>
                )}

                {activeTab === 'settings' && (
                  <div className="flex flex-col items-center justify-center h-full text-white/40">
                    <div className="text-4xl mb-4">⚙️</div>
                    <p>Room settings coming soon...</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}