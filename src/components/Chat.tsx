import { useState, useEffect, useRef } from 'react';
import { Message } from '../types';
import { socketService } from '../services/socket';

interface ChatProps {
  messages: Message[];
  userId: string;
  roomCode: string;
}

export default function Chat({ messages, userId, roomCode }: ChatProps) {
  const [newMessage, setNewMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const socket = socketService.getSocket();
    if (!socket) return;

    socket.emit('send-message', {
      roomCode,
      userId,
      content: newMessage
    }, (response: any) => {
      if (response.success) {
        setNewMessage('');
      }
    });
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto space-y-3 mb-3 p-2 md:p-4 custom-scrollbar">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-400 space-y-2">
            <div className="text-4xl">💬</div>
            <p className="text-sm md:text-base text-center px-4">No messages yet. Start the conversation!</p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.userId === userId ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] md:max-w-[75%] rounded-2xl px-3 py-2 md:px-5 md:py-3 shadow-md backdrop-blur-sm ${
                  message.userId === userId
                    ? 'bg-indigo-600 text-white rounded-tr-none'
                    : 'bg-white/10 text-gray-100 rounded-tl-none border border-white/10'
                }`}
              >
                {message.userId !== userId && (
                  <div className="text-xs font-bold mb-1 text-pink-400">
                    {message.displayName}
                  </div>
                )}
                <div className="break-words leading-relaxed text-sm md:text-base">{message.content}</div>
                <div className={`text-[10px] mt-1 text-right ${message.userId === userId ? 'text-white/60' : 'text-gray-400'}`}>
                  {new Date(message.timestamp).toLocaleTimeString([], { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </div>
              </div>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSend} className="flex gap-1.5 md:gap-2 bg-black/20 p-1.5 md:p-2 rounded-xl border border-white/5">
        <input
          type="text"
          value={newMessage}
          onChange={(e) => setNewMessage(e.target.value)}
          placeholder="Type a message..."
          className="flex-1 px-3 md:px-4 py-2 md:py-2.5 bg-transparent text-sm md:text-base text-white placeholder-gray-500 focus:outline-none"
          maxLength={500}
        />
        <button
          type="submit"
          disabled={!newMessage.trim()}
          className="px-4 md:px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-all text-sm md:text-base font-medium disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
        >
          Send
        </button>
      </form>
    </div>
  );
}
