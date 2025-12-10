# 🎮 Playroom - Real-Time Multiplayer Gaming & Entertainment Platform

A modern, feature-rich real-time multiplayer platform built with React, TypeScript, Socket.IO, and WebRTC. Create rooms, play games, watch movies together, share screens, and chat in real-time!

![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)
![React](https://img.shields.io/badge/React-18.2-blue)
![Socket.IO](https://img.shields.io/badge/Socket.IO-4.6-green)

## ✨ Features

### 🎲 **Multiplayer Games**
- **Chess** - Full chess implementation with:
  - AI opponent (4 difficulty levels: Easy, Medium, Hard, Expert)
  - Complete legal move validation (castling, en passant, promotion)
  - Move history in algebraic notation
  - Check/checkmate/stalemate detection
  - Beautiful UI with drag-and-drop
  - Undo functionality
  
- **Ludo** - Classic board game with:
  - 2-4 players
  - Turn-based gameplay
  - Safe zones and home stretches
  - Win detection
  
- **Uno** - Card game with:
  - 2-10 players
  - Special cards (Skip, Reverse, Draw 2, Wild, Wild Draw 4)
  - UNO call system
  - Score tracking
  - Spectator mode

### 🎬 **Movie Theater**
- **Synchronized Video Playback** - Watch videos together in perfect sync
- **Multiple Video Sources:**
  - YouTube videos (iframe embed)
  - Google Drive videos (preview mode)
  - Direct video URLs (.mp4, .webm, .ogg)
- **Shared Controls** - Play, pause, and seek synchronized across all viewers (direct videos only)
- **Instructions Panel** - Built-in interactive guide
- **Fullscreen Support** - Enhanced viewing experience

### 🎵 **Music Station**
- YouTube video queue
- Synchronized playback across all room members
- Add, remove, and reorder tracks
- Play now functionality
- Current track highlighting
- Responsive grid layout

### 📹 **Screen Mirror & WebRTC**
- **Screen Sharing** - Share your screen with all room participants
- **Camera & Microphone** - Enable video and audio streaming
- **Per-User Controls** - Individual control over camera, mic, and screen
- **Visual Indicators:**
  - Real-time audio level detection
  - Active stream highlighting with green borders
  - Media state badges (camera/mic status)
  - Animated audio activity indicators
- **Permission Management** - Clear permission requests and detailed error handling
- **Device Support** - Comprehensive browser compatibility checks

### 💬 **Real-Time Chat**
- Instant messaging with Socket.IO
- User join/leave notifications
- Message timestamps
- User avatars with unique color coding
- Auto-scroll to latest messages
- Mobile-responsive design with optimized padding

### 👑 **Admin Controls**
- Room creator becomes admin automatically
- **Admin Badge** - Visible crown icon and yellow gradient
- **Kick Users** - Remove disruptive participants
- **Participant List** - View all connected users with status
- **Room Lifecycle** - Room automatically closes when admin leaves or disconnects
- **Beautiful UI** - Dedicated admin panel with modal interface

### 📱 **Mobile Responsive**
- Fully optimized for mobile devices
- Touch-friendly controls
- Adaptive layouts (single column on mobile, multi-column on desktop)
- Bottom navigation bar on mobile
- Responsive text and button sizes
- Icon-only buttons on small screens
- Optimized grid layouts

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation

```bash
# Clone the repository
git clone <your-repo-url>
cd "chatroom-With games"

# Install dependencies
npm install

# Start both client and server
npm run dev
```

The application will be available at:
- **Frontend:** http://localhost:5173
- **Backend:** http://localhost:3001

### Alternative: Run Separately

```bash
# Terminal 1 - Start backend server
npm run server

# Terminal 2 - Start frontend dev server  
npm run client
```

## 📦 Build for Production

```bash
# Build the frontend
npm run build

# The build output will be in the 'dist' folder
# Serve with your preferred static file server
```

## 🛠️ Tech Stack

### Frontend
- **React 18.2** - UI library
- **TypeScript 5.0** - Type safety
- **Vite 4.3** - Build tool and dev server
- **Tailwind CSS 3.3** - Utility-first CSS framework
- **Socket.IO Client 4.6** - Real-time communication
- **HLS.js 1.6** - HTTP Live Streaming
- **WebTorrent 2.8** - P2P video streaming

### Backend
- **Node.js** - Runtime environment
- **Express 4.18** - Web framework
- **Socket.IO 4.6** - Real-time bidirectional communication
- **Multer 2.0** - File upload handling
- **UUID 9.0** - Unique ID generation
- **yt-search** - YouTube search functionality

### Real-Time Features
- **WebRTC** - Peer-to-peer media streaming (screen, camera, mic)
- **Socket.IO** - Signaling and state synchronization
- **Web Workers** - Chess AI runs in background thread

## 📂 Project Structure

```
chatroom-With games/
├── src/                          # Frontend source code
│   ├── components/              # React components
│   │   ├── games/              # Game components
│   │   │   ├── ChessGame.tsx   # Chess with AI
│   │   │   ├── LudoGame.tsx    # Ludo board game
│   │   │   └── UnoGame.tsx     # Uno card game
│   │   ├── AdminPanel.tsx      # Admin controls modal
│   │   ├── Chat.tsx            # Real-time chat
│   │   ├── ChessBoard.tsx      # Chess board UI
│   │   ├── GameSelector.tsx    # Game selection screen
│   │   ├── LoadingScreen.tsx   # Initial loading animation
│   │   ├── Lobby.tsx           # Room creation/join
│   │   ├── MoviePlayer.tsx     # Synchronized video player
│   │   ├── MusicQueue.tsx      # YouTube music queue
│   │   ├── RoomView.tsx        # Main room interface
│   │   ├── ScreenMirror.tsx    # WebRTC screen sharing
│   │   ├── Sidebar.tsx         # Navigation sidebar
│   │   ├── StreamPlayer.tsx    # HLS/Torrent player
│   │   └── BackgroundMusicPlayer.tsx
│   ├── lib/                     # Utility libraries
│   │   ├── chessEngine.ts      # Complete chess engine
│   │   └── __tests__/          # Chess engine tests
│   ├── services/               # API services
│   │   └── socket.ts           # Socket.IO service
│   ├── types/                  # TypeScript definitions
│   │   └── index.ts
│   ├── workers/                # Web Workers
│   │   └── aiWorker.ts         # Chess AI (minimax algorithm)
│   ├── App.tsx                 # Main app component
│   ├── main.tsx                # App entry point
│   └── index.css               # Global styles
│
├── server/                      # Backend source code
│   ├── games/                  # Server-side game logic
│   │   ├── chess.ts            # Chess rules & validation
│   │   ├── ludo.ts             # Ludo game logic
│   │   └── uno.ts              # Uno card game
│   ├── __tests__/              # Server tests
│   │   ├── chess.test.ts
│   │   ├── roomManager.test.ts
│   │   └── uno.test.ts
│   ├── index.ts                # Server entry point
│   ├── roomManager.ts          # Room state management
│   ├── torrentWorker.ts        # Torrent proxy
│   ├── types.ts                # Backend TypeScript types
│   └── uploads/                # Uploaded files directory
│
├── public/                      # Static assets
│   └── assets/
├── dist/                        # Production build output
├── package.json                # Dependencies & scripts
├── tsconfig.json               # TypeScript config (client)
├── tsconfig.server.json        # TypeScript config (server)
├── vite.config.ts              # Vite configuration
├── tailwind.config.js          # Tailwind CSS config
├── postcss.config.js           # PostCSS config
├── jest.config.js              # Jest test config
└── README.md                   # This file
```

## 🎯 How to Use

### Creating a Room
1. Launch the app and wait for the loading screen
2. Enter your display name on the lobby screen
3. Click **"Create Room"**
4. Share the generated room code with friends

### Joining a Room
1. Enter your display name
2. Enter the room code (6 characters)
3. Click **"Join Room"**
4. You'll be connected instantly

### Playing Chess
1. Navigate to the **"Games"** tab in the sidebar
2. Select **"Chess"**
3. Configure settings:
   - Toggle "Play vs AI" on/off
   - Select difficulty (Easy/Medium/Hard/Expert)
   - Choose color (White/Black)
4. Click and drag pieces to move, or click source then destination
5. Pawn promotions show a modal to select piece type
6. Use **"Undo"** to take back moves (undoes 2 moves in AI mode)
7. Use **"Restart"** to start a new game

### Watching Movies Together
1. Go to the **"Movies"** tab
2. Paste a video URL in the input field:
   - YouTube: `https://youtube.com/watch?v=...`
   - Google Drive: Share link to video file
   - Direct: `https://example.com/video.mp4`
3. Click **"Load Movie"** (or ▶️ on mobile)
4. Video plays synchronized across all viewers (direct videos only)
5. Click **info button (ℹ️)** for detailed instructions
6. Use **fullscreen button** for immersive viewing

### Listening to Music
1. Navigate to **"Music"** tab
2. Search for YouTube videos
3. Add to queue
4. Songs play synchronized across the room
5. Anyone can skip, pause, or play

### Screen Sharing
1. Navigate to **"Screen & Cam"** tab
2. Click **"Start Screen"** to share your screen
3. Click **"Start Camera"** to enable webcam
4. Click **"Start Mic"** to enable microphone
5. All participants see your streams in real-time
6. Stop sharing anytime with the same buttons
7. Audio levels are visualized with green pulse animations

### Using Admin Functions
1. Room creator automatically gets admin status
2. Click the **"👑 Admin"** badge in top-right
3. Admin panel opens showing:
   - Your profile (marked as YOU)
   - All other participants
   - Kick button for each user
4. Click **"Kick User"** and confirm to remove someone
5. Click **X** to close the admin panel
6. When admin leaves/disconnects, room closes for everyone

## 🔧 Configuration

### Environment Variables (Optional)

Create a `.env` file in the root directory:

```env
# Server configuration
PORT=3001
NODE_ENV=development

# CORS settings
CORS_ORIGIN=http://localhost:5173

# WebRTC STUN/TURN servers
ICE_SERVERS=stun:stun.l.google.com:19302
```

### Server Configuration

Edit `server/index.ts` to configure:
- Port number (default: 3001)
- CORS origins
- Max file upload size
- Room capacity limits

## 🧪 Testing

```bash
# Run all tests
npm test

# Run specific test file
npm test chess

# Run with coverage
npm test -- --coverage
```

Test files are located in:
- `src/lib/__tests__/` - Frontend tests
- `server/__tests__/` - Backend tests

## 📡 API Endpoints

### REST Endpoints
- `GET /health` - Server health check and room statistics
- `POST /upload` - Upload video files (multipart/form-data)
- `GET /uploads/:filename` - Serve uploaded video files
- `GET /api/streams?id=<movieId>` - Get available video streams
- `GET /api/torrent-play?magnet=<magnetURI>` - Stream torrent via HTTP

### Socket.IO Events

#### Client → Server
- `create-room` - Create a new room
- `join-room` - Join existing room by code
- `reconnect-room` - Reconnect to previous room
- `leave-room` - Leave current room
- `send-message` - Send chat message
- `start-game` - Start a game (chess/ludo/uno)
- `chess-move` - Make a chess move
- `ludo-roll` - Roll dice in Ludo
- `uno-play-card` - Play card in Uno
- `set-movie-url` - Set movie URL for playback
- `update-movie-state` - Update video playback state
- `add-youtube` - Add YouTube video to queue
- `webrtc-offer` - WebRTC session offer
- `webrtc-answer` - WebRTC session answer
- `webrtc-ice` - WebRTC ICE candidate
- `webrtc-media-toggle` - Toggle camera/mic/screen
- `kick-user` - Admin kicks a user

#### Server → Client
- `room-created` - Room successfully created
- `room-joined` - Successfully joined room
- `room-updated` - Room state has updated
- `room-closed` - Room has been closed
- `user-joined` - New user joined the room
- `user-left` - User left the room
- `kicked` - You were kicked by admin
- `new-message` - New chat message received
- `game-started` - Game has been started
- `game-updated` - Game state updated
- `movie-state-updated` - Video state synchronized
- `webrtc-offer` - Received WebRTC offer
- `webrtc-answer` - Received WebRTC answer
- `webrtc-ice` - Received ICE candidate
- `webrtc-user-left` - User left WebRTC session
- `webrtc-media-toggle` - User toggled media

## 🎨 Customization

### Theming
Customize colors in `tailwind.config.js`:

```javascript
module.exports = {
  theme: {
    extend: {
      colors: {
        primary: '#your-color',
        secondary: '#your-color',
      }
    }
  }
}
```

### Game Rules
Modify game logic in `server/games/`:
- `chess.ts` - Chess move validation and rules
- `ludo.ts` - Ludo dice rolls and movement
- `uno.ts` - Card effects and win conditions

### Chess AI Strength
Adjust in `src/components/games/ChessGame.tsx`:
```typescript
const [aiDepth, setAiDepth] = useState(3); // 1-4
```

## 🐛 Troubleshooting

### Common Issues

**1. Server Connection Failed**
```
Solution:
- Verify server is running on port 3001
- Check CORS settings in server/index.ts
- Ensure no firewall blocking connections
- Try: npm run server
```

**2. Video Not Syncing**
```
Solution:
- YouTube/Google Drive videos don't sync (by design)
- Use direct video URLs for synchronization
- Check network latency
- Verify all users are in same room
```

**3. WebRTC Camera/Screen Not Working**
```
Solution:
- Grant browser permissions (camera/microphone/screen)
- Use HTTPS in production (HTTP only works on localhost)
- Check browser console for errors
- Supported browsers: Chrome 90+, Firefox 88+
- Verify STUN server configuration
```

**4. Chess AI Not Responding**
```
Solution:
- Check browser console for worker errors
- Reduce AI depth (Settings → Difficulty)
- Clear browser cache
- Ensure modern browser (supports Web Workers)
```

**5. Mobile Touch Not Working**
```
Solution:
- Update to latest version
- Clear browser cache
- Try different mobile browser
- Check touch event handlers in console
```

### Browser Compatibility
| Browser | Version | Status |
|---------|---------|--------|
| Chrome  | 90+     | ✅ Full Support |
| Firefox | 88+     | ✅ Full Support |
| Safari  | 14+     | ⚠️ Limited WebRTC |
| Edge    | 90+     | ✅ Full Support |
| Mobile Safari | 14+ | ⚠️ WebRTC Issues |
| Mobile Chrome | 90+ | ✅ Full Support |

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch
   ```bash
   git checkout -b feature/AmazingFeature
   ```
3. Commit your changes
   ```bash
   git commit -m 'Add some AmazingFeature'
   ```
4. Push to the branch
   ```bash
   git push origin feature/AmazingFeature
   ```
5. Open a Pull Request

### Development Guidelines
- ✅ Follow TypeScript best practices
- ✅ Maintain consistent code style (ESLint)
- ✅ Add tests for new features
- ✅ Update documentation
- ✅ Use meaningful commit messages
- ✅ Test on multiple browsers
- ✅ Ensure mobile responsiveness

## 📄 License

This project is licensed under the MIT License.

## 🙏 Acknowledgments

- Chess engine inspired by classical chess programming
- WebRTC implementation following modern standards
- UI design inspired by Discord and modern gaming platforms
- Socket.IO team for excellent real-time library
- React and TypeScript communities

## 🗺️ Roadmap

### Upcoming Features
- [ ] User authentication and profiles
- [ ] Room passwords and privacy settings
- [ ] Persistent room history
- [ ] More games (Checkers, Tic-Tac-Toe, Poker)
- [ ] Voice chat channels
- [ ] Screen annotation tools
- [ ] Mobile native app (React Native)
- [ ] Replay saved games
- [ ] Tournament mode
- [ ] Custom room themes
- [ ] Emoji reactions
- [ ] File sharing
- [ ] Drawing board

### Performance Improvements
- [ ] Redis for session storage
- [ ] PostgreSQL for data persistence
- [ ] CDN for static assets
- [ ] Horizontal scaling with load balancer
- [ ] WebSocket compression
- [ ] Video transcoding
- [ ] Image optimization
- [ ] Code splitting
- [ ] Service worker caching

## 💡 Tips & Best Practices

### For Users
1. **Video Sync:** Use direct video URLs (.mp4) for best synchronization
2. **Chess Performance:** Start with Medium difficulty, adjust based on device
3. **WebRTC Quality:** Ensure stable internet connection (5+ Mbps recommended)
4. **Mobile Usage:** Rotate to landscape for better game board visibility
5. **Admin Powers:** Use kick responsibly to maintain room quality

### For Developers
1. **Testing:** Always test WebRTC on HTTPS in production
2. **State Management:** Use immutable updates for React state
3. **Socket Events:** Always acknowledge events with callbacks
4. **Error Handling:** Implement proper error boundaries
5. **Performance:** Use React.memo for expensive components

## 📊 Performance Metrics

- **Room Capacity:** 50 users/room (configurable)
- **Latency:** <100ms for chat and game moves
- **Video Sync Drift:** <1 second
- **Chess AI Response:** 1-5 seconds (depth dependent)
- **WebRTC Streams:** Up to 9 simultaneous (3x3 grid)
- **Memory Usage:** ~50-100MB per active room
- **Bandwidth:** ~2-5 Mbps per WebRTC stream

## 🔒 Security Considerations

### Current Implementation
- ✅ CORS configured
- ✅ Input sanitization
- ✅ File upload size limits
- ✅ Room code validation

### Recommended for Production
- 🔲 Add user authentication (JWT/OAuth)
- 🔲 Implement rate limiting
- 🔲 Enable HTTPS/WSS
- 🔲 Add room passwords
- 🔲 Implement content moderation
- 🔲 Add logging and monitoring
- 🔲 Regular security audits

## 📞 Support & Community

- **Bug Reports:** Open an issue on GitHub
- **Feature Requests:** Use GitHub discussions
- **Questions:** Check existing issues first
- **Contributing:** See CONTRIBUTING.md (if available)

## 🌟 Show Your Support

If you find this project useful:
- ⭐ Star this repository
- 🐛 Report bugs
- 💡 Suggest new features
- 🔀 Submit pull requests
- 📢 Share with others

---

**Built with ❤️ using React, TypeScript, Socket.IO, and WebRTC**

**Made for fun, learning, and bringing people together through games and entertainment!**
# Chat_play_room
