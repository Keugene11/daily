import React, { useState, useRef } from 'react';

interface Props {
  onResult: (text: string) => void;
  disabled?: boolean;
}

export const VoiceInput: React.FC<Props> = ({ onResult, disabled }) => {
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<any>(null);

  const handleClick = () => {
    if (listening) {
      recognitionRef.current?.stop();
      setListening(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.lang = 'en-US';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      onResult(transcript);
      setListening(false);
    };

    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;
    recognition.start();
    setListening(true);
  };

  // Check if speech recognition is supported
  const supported = typeof window !== 'undefined' && ((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);
  if (!supported) return null;

  return (
    <button
      onClick={handleClick}
      disabled={disabled}
      className={`p-2.5 rounded-full border transition-all disabled:opacity-30 ${
        listening
          ? 'border-red-500/50 bg-red-500/10 text-red-400 animate-pulse'
          : 'border-on-surface/15 text-on-surface/40 hover:text-on-surface/70 hover:border-on-surface/30'
      }`}
      title={listening ? 'Listening...' : 'Speak your plan'}
    >
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
      </svg>
    </button>
  );
};
