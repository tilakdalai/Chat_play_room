import { useEffect, useMemo, useRef, useState } from 'react';
import { User } from '../types';
import { socketService } from '../services/socket';

interface ScreenMirrorProps {
  roomCode: string;
  userId: string;
  participants: User[];
}

type PeerMap = Record<string, RTCPeerConnection>;
type StreamMap = Record<string, MediaStream>;
type MediaState = Record<string, { camera: boolean; mic: boolean; screen: boolean }>;

const iceConfig: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' }
  ]
};

export default function ScreenMirror({ roomCode, userId, participants }: ScreenMirrorProps) {
  const videoLocalRef = useRef<HTMLVideoElement | null>(null);
  const peersRef = useRef<PeerMap>({});
  const remoteStreamsRef = useRef<StreamMap>({});
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const [remoteStreams, setRemoteStreams] = useState<StreamMap>({});
  const [remoteMediaStates, setRemoteMediaStates] = useState<MediaState>({});
  const [status, setStatus] = useState('Ready to connect');
  const [camOn, setCamOn] = useState(false);
  const [micOn, setMicOn] = useState(false);
  const [screenOn, setScreenOn] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  const socket = useMemo(() => socketService.getSocket() || socketService.connect(), []);

  const combinedTracks = () => [
    ...(localStreamRef.current?.getTracks() || []),
    ...(screenStreamRef.current?.getTracks() || [])
  ];

  const cleanupPeers = () => {
    Object.values(peersRef.current).forEach((pc) => pc.close());
    peersRef.current = {};
    remoteStreamsRef.current = {};
    setRemoteStreams({});
  };

  const stopStream = (stream: MediaStream | null) => {
    stream?.getTracks().forEach((t) => t.stop());
  };

  const checkPermissions = async () => {
    try {
      // Check if permissions are available for better UX
      await Promise.all([
        navigator.permissions?.query({ name: 'camera' as PermissionName }),
        navigator.permissions?.query({ name: 'microphone' as PermissionName })
      ]);
    } catch (err) {
      // Permissions API not supported, will check on actual request
      console.log('Permissions API not available');
    }
  };

  const refreshLocalMedia = async (nextCam: boolean, nextMic: boolean) => {
    try {
      setIsConnecting(true);
      stopStream(localStreamRef.current);
      localStreamRef.current = null;
      
      if (!nextCam && !nextMic) {
        setStatus('Media disabled');
        if (videoLocalRef.current) {
          videoLocalRef.current.srcObject = null;
        }
        setIsConnecting(false);
        return;
      }

      // Check if media devices are available
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error('Media devices not supported on this browser');
      }

      setStatus('Requesting media access...');
      const constraints: MediaStreamConstraints = {
        video: nextCam ? {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user'
        } : false,
        audio: nextMic ? {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } : false
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      localStreamRef.current = stream;
      
      if (videoLocalRef.current) {
        videoLocalRef.current.srcObject = stream;
        videoLocalRef.current.muted = true;
        videoLocalRef.current.play().catch(() => {});
      }
      
      setStatus(nextCam && nextMic ? 'Camera & Mic ready' : nextCam ? 'Camera ready' : 'Mic ready');
    } catch (err: any) {
      console.error('Media access error:', err);
      
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setStatus('⚠️ Permission denied. Please allow access.');
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setStatus('⚠️ No camera/mic found');
      } else if (err.name === 'NotReadableError' || err.name === 'TrackStartError') {
        setStatus('⚠️ Device in use by another app');
      } else {
        setStatus('⚠️ Media error: ' + (err.message || 'Unknown'));
      }
      
      // Reset states on error
      setCamOn(false);
      setMicOn(false);
    } finally {
      setIsConnecting(false);
    }
  };

  const startScreen = async () => {
    try {
      if (!navigator.mediaDevices || !(navigator.mediaDevices as any).getDisplayMedia) {
        throw new Error('Screen sharing not supported on this device');
      }

      setIsConnecting(true);
      setStatus('Requesting screen share...');
      stopStream(screenStreamRef.current);
      
      const stream = await (navigator.mediaDevices as any).getDisplayMedia({ 
        video: {
          cursor: 'always',
          displaySurface: 'monitor'
        },
        audio: true
      });
      
      screenStreamRef.current = stream;
      setScreenOn(true);
      
      // Handle user stopping screen share via browser UI
      stream.getVideoTracks().forEach((t: MediaStreamTrack) => {
        t.onended = () => {
          stopScreen();
          setStatus('Screen sharing stopped');
        };
      });
      
      setStatus('✓ Screen sharing active');
      await restartPeers();
    } catch (err: any) {
      console.error('Screen share error:', err);
      
      if (err.name === 'NotAllowedError') {
        setStatus('⚠️ Screen share permission denied');
      } else if (err.name === 'NotSupportedError') {
        setStatus('⚠️ Screen share not supported on this device');
      } else {
        setStatus('⚠️ Screen share error: ' + (err.message || 'Unknown'));
      }
      
      setScreenOn(false);
    } finally {
      setIsConnecting(false);
    }
  };

  const stopScreen = async () => {
    stopStream(screenStreamRef.current);
    screenStreamRef.current = null;
    setScreenOn(false);
    setStatus('Screen sharing stopped');
    await restartPeers();
  };

  const ensurePeer = (peerId: string) => {
    if (peersRef.current[peerId]) return peersRef.current[peerId];
    const pc = new RTCPeerConnection(iceConfig);

    pc.onicecandidate = (e) => {
      if (e.candidate) {
        socket?.emit('webrtc-ice', {
          roomCode,
          fromUserId: userId,
          candidate: e.candidate
        });
      }
    };

    pc.ontrack = (event) => {
      const stream = event.streams[0];
      if (!stream) return;
      remoteStreamsRef.current[peerId] = stream;
      setRemoteStreams({ ...remoteStreamsRef.current });
    };

    peersRef.current[peerId] = pc;
    return pc;
  };

  const addLocalTracksToPeer = (pc: RTCPeerConnection) => {
    const tracks = combinedTracks();
    tracks.forEach((track) => {
      const sender = pc.getSenders().find((s) => s.track && s.track.id === track.id);
      if (!sender) {
        pc.addTrack(track, track.kind === 'video' && screenStreamRef.current ? screenStreamRef.current! : localStreamRef.current || new MediaStream([track]));
      }
    });
  };

  const restartPeers = async () => {
    cleanupPeers();
    await callEveryone();
  };

  const callEveryone = async () => {
    const targets = participants.filter((u) => u.id !== userId);
    const tracks = combinedTracks();
    
    if (!tracks.length) {
      setStatus('Enable camera/mic/screen to start sharing');
      return;
    }
    
    if (targets.length === 0) {
      setStatus('Waiting for others to join...');
      return;
    }
    
    try {
      setIsConnecting(true);
      setStatus(`Connecting to ${targets.length} participant${targets.length > 1 ? 's' : ''}...`);
      
      for (const target of targets) {
        const pc = ensurePeer(target.id);
        addLocalTracksToPeer(pc);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket?.emit('webrtc-offer', {
          roomCode,
          fromUserId: userId,
          sdp: offer
        });
      }
      
      setStatus(`✓ Connected to ${targets.length} participant${targets.length > 1 ? 's' : ''}`);
    } catch (err) {
      console.error('Connection error:', err);
      setStatus('⚠️ Connection failed');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleOffer = async (payload: any) => {
    if (payload.fromUserId === userId) return;
    const pc = ensurePeer(payload.fromUserId);
    addLocalTracksToPeer(pc);
    await pc.setRemoteDescription(payload.sdp);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socket?.emit('webrtc-answer', {
      roomCode,
      fromUserId: userId,
      sdp: answer
    });
  };

  const handleAnswer = async (payload: any) => {
    if (payload.fromUserId === userId) return;
    const pc = ensurePeer(payload.fromUserId);
    if (!pc.currentRemoteDescription) {
      await pc.setRemoteDescription(payload.sdp);
    }
  };

  const handleIce = async (payload: any) => {
    if (payload.fromUserId === userId) return;
    const pc = ensurePeer(payload.fromUserId);
    try {
      await pc.addIceCandidate(payload.candidate);
    } catch (err) {
      console.warn('ICE add failed', err);
    }
  };

  const toggleCamera = async () => {
    const next = !camOn;
    setCamOn(next);
    await refreshLocalMedia(next, micOn);
    
    if (next || micOn) {
      socket?.emit('webrtc-media-toggle', { roomCode, fromUserId: userId, camera: next, mic: micOn, screen: screenOn });
      await restartPeers();
    }
  };

  const toggleMic = async () => {
    const next = !micOn;
    setMicOn(next);
    await refreshLocalMedia(camOn, next);
    
    if (camOn || next) {
      socket?.emit('webrtc-media-toggle', { roomCode, fromUserId: userId, camera: camOn, mic: next, screen: screenOn });
      await restartPeers();
    }
  };

  useEffect(() => {
    checkPermissions();

    const onOffer = (payload: any) => handleOffer(payload);
    const onAnswer = (payload: any) => handleAnswer(payload);
    const onIce = (payload: any) => handleIce(payload);
    const onMediaToggle = (payload: { fromUserId: string; camera: boolean; mic: boolean; screen: boolean }) => {
      if (payload.fromUserId !== userId) {
        setRemoteMediaStates(prev => ({
          ...prev,
          [payload.fromUserId]: { camera: payload.camera, mic: payload.mic, screen: payload.screen }
        }));
      }
    };

    socket?.on('webrtc-offer', onOffer);
    socket?.on('webrtc-answer', onAnswer);
    socket?.on('webrtc-ice', onIce);
    socket?.on('webrtc-media-toggle', onMediaToggle);

    return () => {
      socket?.off('webrtc-offer', onOffer);
      socket?.off('webrtc-answer', onAnswer);
      socket?.off('webrtc-ice', onIce);
      socket?.off('webrtc-media-toggle', onMediaToggle);
      stopStream(localStreamRef.current);
      stopStream(screenStreamRef.current);
      cleanupPeers();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, userId]);

  const getUserNameById = (id: string) => {
    const user = participants.find(p => p.id === id);
    return user?.displayName || 'User';
  };

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-black/60 to-gray-900/60 text-white">
      {/* Controls Bar */}
      <div className="p-2 md:p-4 flex flex-wrap gap-1.5 md:gap-2 items-center border-b border-white/10 bg-black/30 backdrop-blur-sm">
        <button 
          onClick={toggleCamera} 
          disabled={isConnecting}
          className={`group relative px-3 md:px-4 py-2 md:py-2.5 rounded-xl text-sm md:text-base font-medium transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ${
            camOn 
              ? 'bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white' 
              : 'bg-white/10 hover:bg-white/20 text-gray-300'
          }`}
        >
          <span className="text-lg">📷</span>
          <span className="hidden sm:inline">{camOn ? 'Camera On' : 'Camera Off'}</span>
          <span className="sm:hidden">{camOn ? 'On' : 'Off'}</span>
        </button>
        
        <button 
          onClick={toggleMic} 
          disabled={isConnecting}
          className={`group relative px-3 md:px-4 py-2 md:py-2.5 rounded-xl text-sm md:text-base font-medium transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ${
            micOn 
              ? 'bg-gradient-to-r from-green-600 to-green-500 hover:from-green-500 hover:to-green-400 text-white' 
              : 'bg-white/10 hover:bg-white/20 text-gray-300'
          }`}
        >
          <span className="text-lg">🎤</span>
          <span className="hidden sm:inline">{micOn ? 'Mic On' : 'Mic Off'}</span>
          <span className="sm:hidden">{micOn ? 'On' : 'Off'}</span>
        </button>
        
        <button
          onClick={screenOn ? stopScreen : startScreen}
          disabled={isConnecting}
          className={`group relative px-3 md:px-4 py-2 md:py-2.5 rounded-xl text-sm md:text-base font-medium transition-all shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 ${
            screenOn 
              ? 'bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 text-white' 
              : 'bg-white/10 hover:bg-white/20 text-gray-300'
          }`}
        >
          <span className="text-lg">🖥️</span>
          <span className="hidden sm:inline">{screenOn ? 'Stop Screen' : 'Share Screen'}</span>
          <span className="sm:hidden">{screenOn ? 'Stop' : 'Share'}</span>
        </button>

        <div className="flex-1"></div>
        
        {/* Status Indicator */}
        <div className="flex items-center gap-2 px-3 py-1.5 bg-black/40 rounded-lg border border-white/10">
          {isConnecting && (
            <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
          )}
          <span className="text-xs md:text-sm text-white/80">{status}</span>
        </div>
      </div>

      {/* Video Grid */}
      <div className="p-2 md:p-4 flex-1 overflow-auto">
        {!camOn && !screenOn && Object.keys(remoteStreams).length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-gray-400 space-y-4">
            <div className="text-6xl md:text-8xl">🎥</div>
            <div>
              <h3 className="text-lg md:text-xl font-semibold text-white mb-2">No Active Streams</h3>
              <p className="text-sm md:text-base">Enable your camera, mic, or share your screen to start</p>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2 md:gap-4 auto-rows-max">
            {/* Local Stream */}
            {(camOn || screenOn) && (
              <div className="relative bg-gradient-to-br from-gray-900 to-black border-2 border-green-500/50 rounded-2xl overflow-hidden aspect-video shadow-2xl shadow-green-500/20 group">
                <video ref={videoLocalRef} className="w-full h-full object-cover" autoPlay playsInline muted />
                
                {/* Overlay Info */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                
                <div className="absolute bottom-0 left-0 right-0 p-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-lg">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-sm font-semibold">You</span>
                  </div>
                  
                  <div className="flex gap-1">
                    {camOn && <span className="bg-green-500/80 px-2 py-1 rounded text-xs">📷</span>}
                    {micOn && <span className="bg-green-500/80 px-2 py-1 rounded text-xs">🎤</span>}
                    {screenOn && <span className="bg-blue-500/80 px-2 py-1 rounded text-xs">🖥️</span>}
                  </div>
                </div>
              </div>
            )}
            
            {/* Remote Streams */}
            {Object.entries(remoteStreams).map(([peerId, stream]) => {
              const mediaState = remoteMediaStates[peerId] || { camera: false, mic: false, screen: false };
              return (
                <VideoTile 
                  key={peerId} 
                  stream={stream} 
                  label={getUserNameById(peerId)}
                  mediaState={mediaState}
                />
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function VideoTile({ stream, label, mediaState }: { 
  stream: MediaStream; 
  label: string;
  mediaState?: { camera: boolean; mic: boolean; screen: boolean };
}) {
  const ref = useRef<HTMLVideoElement | null>(null);
  const [isAudioActive, setIsAudioActive] = useState(false);

  useEffect(() => {
    if (ref.current) {
      ref.current.srcObject = stream;
      ref.current.play().catch(() => {});
    }

    // Audio level detection
    if (stream && stream.getAudioTracks().length > 0) {
      try {
        const audioContext = new AudioContext();
        const source = audioContext.createMediaStreamSource(stream);
        const analyzer = audioContext.createAnalyser();
        analyzer.fftSize = 256;
        source.connect(analyzer);
        
        const dataArray = new Uint8Array(analyzer.frequencyBinCount);
        const checkAudio = () => {
          analyzer.getByteFrequencyData(dataArray);
          const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
          setIsAudioActive(average > 10);
          requestAnimationFrame(checkAudio);
        };
        checkAudio();
        
        return () => {
          audioContext.close();
        };
      } catch (err) {
        console.warn('Audio detection not available');
      }
    }
  }, [stream]);

  return (
    <div className={`relative bg-gradient-to-br from-gray-900 to-black border-2 rounded-2xl overflow-hidden aspect-video shadow-xl group transition-all ${
      isAudioActive ? 'border-green-500/70 shadow-green-500/20' : 'border-white/10'
    }`}>
      <video ref={ref} className="w-full h-full object-cover" autoPlay playsInline />
      
      {/* No video placeholder */}
      {stream.getVideoTracks().length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
          <div className="text-center">
            <div className="text-5xl mb-2">👤</div>
            <div className="text-sm text-gray-400">No video</div>
          </div>
        </div>
      )}
      
      {/* Overlay Info */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
      
      <div className="absolute bottom-0 left-0 right-0 p-3 flex items-center justify-between">
        <div className="flex items-center gap-2 bg-black/60 backdrop-blur-sm px-3 py-1.5 rounded-lg">
          {isAudioActive && <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>}
          <span className="text-sm font-semibold">{label}</span>
        </div>
        
        {mediaState && (
          <div className="flex gap-1">
            {mediaState.camera && <span className="bg-white/20 px-2 py-1 rounded text-xs">📷</span>}
            {mediaState.mic && <span className="bg-white/20 px-2 py-1 rounded text-xs">🎤</span>}
            {mediaState.screen && <span className="bg-blue-500/80 px-2 py-1 rounded text-xs">🖥️</span>}
          </div>
        )}
      </div>
    </div>
  );
}
