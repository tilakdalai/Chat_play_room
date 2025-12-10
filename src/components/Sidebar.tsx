import { useState } from 'react';

interface SidebarProps {
  activeTab: 'chat' | 'music' | 'game' | 'movie' | 'mirror';
  setActiveTab: (tab: 'chat' | 'music' | 'game' | 'movie' | 'mirror') => void;
  onLeave: () => void;
  roomCode: string;
}

export default function Sidebar({ activeTab, setActiveTab, onLeave, roomCode }: SidebarProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const menuItems = [
    { id: 'chat', label: 'Chat', icon: '💬' },
    { id: 'music', label: 'Music', icon: '🎵' },
    { id: 'game', label: 'Games', icon: '🎮' },
    { id: 'movie', label: 'Movies', icon: '🎬' },
    { id: 'mirror', label: 'Screen & Cam', icon: '🖥️' },
  ] as const;

  return (
    <div 
      className={`
        relative z-40 bg-black/40 backdrop-blur-xl border-t md:border-t-0 md:border-r border-white/10 
        transition-all duration-300 ease-in-out flex flex-row md:flex-col justify-between md:justify-start
        w-full md:h-full
        ${isExpanded ? 'md:w-64' : 'md:w-20'}
        h-16 md:h-auto
      `}
      onMouseEnter={() => window.innerWidth >= 768 && setIsExpanded(true)}
      onMouseLeave={() => window.innerWidth >= 768 && setIsExpanded(false)}
    >
      {/* Logo / Room Code - Desktop Only */}
      <div className="hidden md:flex p-6 items-center justify-center border-b border-white/5 h-20">
        <div className={`font-bold text-xl bg-gradient-to-r from-pink-500 to-purple-500 bg-clip-text text-transparent transition-all duration-300 ${isExpanded ? 'opacity-100' : 'opacity-0 w-0 overflow-hidden'}`}>
          PlayRoom
        </div>
        <div className={`absolute transition-all duration-300 ${isExpanded ? 'opacity-0 scale-0' : 'opacity-100 scale-100'}`}>
          🎮
        </div>
      </div>

      {/* Room Code Display (Expanded) - Desktop Only */}
      <div className={`hidden md:block px-6 py-4 transition-all duration-300 ${isExpanded ? 'opacity-100' : 'opacity-0 h-0 overflow-hidden py-0'}`}>
        <div className="text-xs text-gray-400 uppercase tracking-wider mb-1">Room Code</div>
        <div className="font-mono text-xl text-white tracking-widest">{roomCode}</div>
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 flex flex-row md:flex-col gap-1 md:gap-2 px-2 md:px-3 items-center md:items-stretch justify-around md:justify-start py-2 md:py-6">
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            className={`
              flex items-center justify-center md:justify-start gap-4 px-3 md:px-4 py-2 md:py-3 rounded-xl transition-all duration-200 group relative
              ${activeTab === item.id 
                ? 'bg-gradient-to-r from-pink-600/20 to-purple-600/20 text-white shadow-[0_0_20px_rgba(236,72,153,0.15)] border border-pink-500/30' 
                : 'text-gray-400 hover:text-white hover:bg-white/5'
              }
            `}
          >
            <span className="text-xl relative z-10">{item.icon}</span>
            <span className={`hidden md:block font-medium whitespace-nowrap transition-all duration-300 ${isExpanded ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-4 absolute left-14'}`}>
              {item.label}
            </span>
            
            {/* Active Indicator Line - Desktop */}
            {activeTab === item.id && (
              <div className="hidden md:block absolute left-0 top-1/2 -translate-y-1/2 w-1 h-8 bg-pink-500 rounded-r-full shadow-[0_0_10px_#ec4899]" />
            )}
            {/* Active Indicator Dot - Mobile */}
            {activeTab === item.id && (
              <div className="md:hidden absolute -bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 bg-pink-500 rounded-full shadow-[0_0_5px_#ec4899]" />
            )}
          </button>
        ))}
        
        {/* Mobile Leave Button */}
        <button
          onClick={onLeave}
          className="md:hidden flex items-center justify-center px-3 py-2 rounded-xl text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all duration-200"
          title="Leave Room"
        >
          <span className="text-xl">🚪</span>
        </button>
      </nav>

      {/* Bottom Actions - Desktop Only */}
      <div className="hidden md:block p-4 border-t border-white/5">
        <button
          onClick={onLeave}
          className={`
            w-full flex items-center gap-4 px-4 py-3 rounded-xl text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-all duration-200
            ${!isExpanded && 'justify-center'}
          `}
          title="Leave Room"
        >
          <span className="text-xl">🚪</span>
          <span className={`font-medium whitespace-nowrap transition-all duration-300 ${isExpanded ? 'opacity-100 w-auto' : 'opacity-0 w-0 overflow-hidden'}`}>
            Leave Room
          </span>
        </button>
      </div>
    </div>
  );
}
