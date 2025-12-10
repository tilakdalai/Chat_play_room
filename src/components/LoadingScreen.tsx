import { useState, useEffect } from 'react';

const translations = [
  "MADE BY TILAK", // English
  "HECHO POR TILAK", // Spanish
  "FAIT PAR TILAK", // French
  "GEMACHT VON TILAK", // German
  "FATTO DA TILAK", // Italian
  "FEITO POR TILAK", // Portuguese
  "СДЕЛАНО ТИЛАКОМ", // Russian
  "TILAK TARAFINDAN YAPILDI", // Turkish
  "TILAK이 만듦", // Korean
  "由 TILAK 制作", // Chinese
  "TILAKによって作られた", // Japanese
  "तिलक द्वारा बनाया गया" // Hindi
];

interface LoadingScreenProps {
  onComplete: () => void;
}

export default function LoadingScreen({ onComplete }: LoadingScreenProps) {
  const [progress, setProgress] = useState(0);
  const [textIndex, setTextIndex] = useState(0);
  const [showText, setShowText] = useState(true);

  useEffect(() => {
    // Progress bar animation
    const progressInterval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          setTimeout(onComplete, 500); // Small delay before unmounting
          return 100;
        }
        return prev + 1;
      });
    }, 30); // 3 seconds total roughly

    // Text blinking and changing animation
    const textInterval = setInterval(() => {
      setShowText(false);
      setTimeout(() => {
        setTextIndex(prev => (prev + 1) % translations.length);
        setShowText(true);
      }, 100);
    }, 400); // Change every 400ms

    return () => {
      clearInterval(progressInterval);
      clearInterval(textInterval);
    };
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col items-center justify-center text-white overflow-hidden">
      {/* Background effects */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-purple-900/20 via-black to-black"></div>
      
      <div className="relative z-10 flex flex-col items-center gap-12 w-full max-w-md px-8">
        {/* Constant Welcome Text */}
        <h1 className="text-6xl md:text-8xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white to-white/50 drop-shadow-[0_0_30px_rgba(255,255,255,0.5)]">
          WELCOME
        </h1>

        {/* Blinking Made By Text */}
        <div className="h-12 flex items-center justify-center">
          <p 
            className={`text-xl md:text-2xl font-bold tracking-widest text-purple-400 transition-opacity duration-100 drop-shadow-[0_0_20px_rgba(168,85,247,0.5)] ${showText ? 'opacity-100' : 'opacity-0'}`}
          >
            {translations[textIndex]}
          </p>
        </div>

        {/* Progress Bar */}
        <div className="w-full space-y-4">
          <progress className="loading-progress" max={100} value={progress} aria-label="Loading progress" />
          <div className="flex justify-between text-xs font-mono text-white/40">
            <span>LOADING RESOURCES</span>
            <span>{progress}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
