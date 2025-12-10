import { PublicRoomSummary } from '../types';

interface PublicRoomsPanelProps {
  rooms: PublicRoomSummary[];
  onSelectRoom: (code: string) => void;
  onClose: () => void;
}

export default function PublicRoomsPanel({ rooms, onSelectRoom, onClose }: PublicRoomsPanelProps) {
  return (
    <aside className="glass-panel rounded-2xl md:rounded-none md:rounded-l-3xl shadow-2xl p-6 md:p-8 w-full h-full flex flex-col border border-white/10">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <span>🌐</span>
            Public Rooms
          </h2>
          <p className="text-xs text-gray-400 mt-1">Join a community room instantly or pick a code to share.</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-white/10 hover:bg-white/20 text-gray-300 transition-all"
        >
          Close
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 pr-1">
        {rooms.length === 0 ? (
          <div className="h-full min-h-[200px] flex flex-col items-center justify-center text-gray-500 text-sm bg-white/5 rounded-2xl border border-white/10">
            <div className="text-4xl mb-2">🕒</div>
            <p className="font-medium text-gray-300">No public rooms right now</p>
            <p className="text-xs text-gray-500 mt-1">Be the first to create one and it will appear here.</p>
          </div>
        ) : (
          rooms.map((room) => (
            <div
              key={room.code}
              className="bg-white/5 hover:bg-white/10 transition-all rounded-2xl border border-white/10 p-4 flex items-center justify-between gap-4"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-sm text-gray-400">
                  <span className="text-xs uppercase tracking-wider text-gray-500">Room</span>
                  <span className="font-mono text-lg text-white tracking-widest">{room.code}</span>
                </div>
                <div className="flex items-center gap-3 mt-2 text-xs text-gray-400">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
                    {room.occupants} online
                  </span>
                  {room.host && (
                    <span className="flex items-center gap-1 text-white/70">
                      <span className="text-yellow-400">👑</span>
                      Host: {room.host}
                    </span>
                  )}
                </div>
              </div>

              <button
                type="button"
                onClick={() => onSelectRoom(room.code)}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white font-semibold text-sm shadow-lg transition-transform hover:-translate-y-0.5"
              >
                Join
              </button>
            </div>
          ))
        )}
      </div>

      <div className="mt-4 text-xs text-gray-500">
        <p>Tip: Enter your name above to quick-join any public room.</p>
      </div>
    </aside>
  );
}
