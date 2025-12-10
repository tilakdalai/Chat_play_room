import { useEffect, useMemo, useRef, useState } from 'react';
import Hls from 'hls.js';
import WebTorrent from 'webtorrent';

export type NormalizedStream = {
  type: 'hls' | 'http' | 'magnet';
  url: string;
  quality?: string;
  provider?: string;
  subs?: Array<{ lang?: string; label?: string; url: string; default?: boolean }>;
};

interface StreamPlayerProps {
  movieId: string;
  onClose?: () => void;
}

// Utility to resolve backend base once
const useBackendBase = () =>
  useMemo(() => {
    const env = (import.meta as any).env?.VITE_SERVER_URL as string | undefined;
    if (env) return env.replace(/\/$/, '');
    if (typeof window !== 'undefined' && window.location.port === '3000') {
      return `${window.location.protocol}//${window.location.hostname}:3001`;
    }
    return '';
  }, []);

export default function StreamPlayer({ movieId, onClose }: StreamPlayerProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const hlsRef = useRef<Hls | null>(null);
  const clientRef = useRef<WebTorrent.Instance | null>(null);
  const [status, setStatus] = useState('idle');
  const [streams, setStreams] = useState<NormalizedStream[]>([]);
  const backendBase = useBackendBase();

  useEffect(() => {
    let mounted = true;
    const fetchStreams = async () => {
      setStatus('fetching streams...');
      try {
        const url = `${backendBase}/api/streams?id=${encodeURIComponent(movieId)}`.replace('//api', '/api');
        const res = await fetch(url);
        const data = await res.json();
        if (!mounted) return;
        const list = (data.streams || []) as NormalizedStream[];
        setStreams(list);
        if (!list.length) {
          setStatus('no streams');
          return;
        }
        const best =
          list.find((s) => s.type === 'hls') ||
          list.find((s) => s.type === 'http') ||
          list.find((s) => s.type === 'magnet');
        if (best) {
          await playStream(best);
        } else {
          setStatus('no playable stream');
        }
      } catch (err) {
        console.error(err);
        if (mounted) setStatus('error fetching streams');
      }
    };

    fetchStreams();

    return () => {
      mounted = false;
      cleanupPlayback();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [movieId, backendBase]);

  const cleanupPlayback = () => {
    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }
    if (clientRef.current) {
      try {
        clientRef.current.destroy();
      } catch (err) {
        console.warn('webtorrent destroy error', err);
      }
      clientRef.current = null;
    }
    if (videoRef.current) {
      try {
        videoRef.current.pause();
        videoRef.current.removeAttribute('src');
        videoRef.current.load();
      } catch (err) {
        // ignore
      }
    }
  };

  const attachSubtitles = (stream: NormalizedStream) => {
    const video = videoRef.current;
    if (!video) return;
    [...video.querySelectorAll('track')].forEach((t) => t.remove());
    stream.subs?.forEach((sub) => {
      const track = document.createElement('track');
      track.kind = 'subtitles';
      track.srclang = sub.lang || 'en';
      track.label = sub.label || sub.lang || 'sub';
      track.src = sub.url;
      track.default = Boolean(sub.default);
      video.appendChild(track);
    });
  };

  const playStream = async (stream: NormalizedStream) => {
    const video = videoRef.current;
    if (!video) {
      setStatus('no video element');
      return;
    }

    cleanupPlayback();

    if (stream.type === 'hls') {
      setStatus('playing HLS...');
      if (stream.url.endsWith('.m3u8') && Hls.isSupported()) {
        const hls = new Hls();
        hlsRef.current = hls;
        hls.loadSource(stream.url);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          video.play().catch(() => {});
        });
      } else {
        video.src = stream.url;
        video.play().catch(() => {});
      }
    } else if (stream.type === 'http') {
      setStatus('playing HTTP...');
      video.src = stream.url;
      video.play().catch(() => {});
    } else if (stream.type === 'magnet') {
      setStatus('starting WebTorrent...');
      const client = new (WebTorrent as any)() as WebTorrent.Instance;
      clientRef.current = client;
      client.add(stream.url, (torrent: any) => {
        const file = (torrent.files || []).find((f: any) => /\.(mp4|webm|mkv)$/i.test(f.name)) || torrent.files[0];
        if (!file) {
          setStatus('no playable file in torrent');
          return;
        }
        // renderTo is available in the browser build of webtorrent
        file.renderTo(video, { autoplay: true }, (err: any) => {
          if (err) {
            console.error('render error', err);
            setStatus('render error');
          } else {
            setStatus('playing torrent');
          }
        });
      });
    }

    attachSubtitles(stream);
  };

  return (
    <div className="p-4 bg-black text-white space-y-3 rounded-xl border border-white/10">
      <div className="flex items-center gap-3 justify-between">
        <div className="text-sm text-white/70">{status}</div>
        {onClose && (
          <button onClick={onClose} className="px-3 py-1 rounded bg-white/10 hover:bg-white/20 text-sm">
            Close
          </button>
        )}
      </div>
      <video ref={videoRef} controls className="w-full max-h-[70vh] bg-black rounded" />
      <div className="space-y-1">
        {streams.map((s, i) => (
          <button
            key={`${s.type}-${i}`}
            onClick={() => playStream(s)}
            className="w-full text-left px-3 py-2 rounded bg-white/5 hover:bg-white/10 border border-white/10"
          >
            {s.type.toUpperCase()} • {s.quality || 'auto'} {s.provider ? `• ${s.provider}` : ''}
          </button>
        ))}
        {streams.length === 0 && <div className="text-sm text-white/50">No streams loaded</div>}
      </div>
    </div>
  );
}
