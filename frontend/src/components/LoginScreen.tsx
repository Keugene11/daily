import React from 'react';

interface LoginScreenProps {
  onSignIn: () => void;
  loading?: boolean;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onSignIn, loading }) => {
  return (
    <div className="min-h-screen bg-surface text-on-surface flex flex-col">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-5 border-b border-on-surface/10">
        <span className="text-lg font-semibold tracking-tight">daily</span>
        <a
          href="https://www.dedaluslabs.ai"
          target="_blank"
          rel="noopener noreferrer"
          className="px-4 py-1.5 border border-on-surface/20 rounded-full text-on-surface/80 hover:bg-on-surface/5 transition-colors text-sm"
        >
          Dedalus SDK
        </a>
      </nav>

      {/* Center */}
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <h1 className="text-5xl md:text-7xl font-semibold tracking-tight text-center leading-[1.1] mb-6">
          A new way to plan<br />your perfect day.
        </h1>
        <p className="text-lg text-on-surface/40 text-center max-w-xl mb-12">
          AI-powered daily planning with real-time tool calling and personalized itineraries.
        </p>

        <button
          onClick={onSignIn}
          disabled={loading}
          className="flex items-center gap-3 px-8 py-3.5 bg-accent text-on-accent font-medium rounded-full text-sm hover:bg-accent/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <svg className="w-5 h-5" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          {loading ? 'Signing in...' : 'Continue with Google'}
        </button>
      </div>

      {/* Footer */}
      <footer className="border-t border-on-surface/10 px-8 py-6 text-center">
        <p className="text-xs text-on-surface/30">
          Powered by{' '}
          <a
            href="https://www.dedaluslabs.ai"
            target="_blank"
            rel="noopener noreferrer"
            className="text-on-surface/50 hover:text-on-surface/70 transition-colors"
          >
            Dedalus
          </a>
          {' '}&middot; Real-time AI tool calling demo
        </p>
      </footer>
    </div>
  );
};
