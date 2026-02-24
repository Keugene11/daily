import { useState, useEffect, useCallback } from 'react';
import { Session, User } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

const API_URL = import.meta.env.VITE_API_URL || '';

// Skip auth when Supabase isn't configured OR in dev mode
const SKIP_AUTH = !supabase;

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(!SKIP_AUTH);

  useEffect(() => {
    if (!supabase) return;

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);

        // Capture Google provider tokens on sign-in and store server-side
        if (event === 'SIGNED_IN' && session?.provider_token) {
          try {
            await fetch(`${API_URL}/api/google-tokens`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${session.access_token}`,
              },
              body: JSON.stringify({
                provider_token: session.provider_token,
                provider_refresh_token: session.provider_refresh_token || null,
              }),
            });
          } catch (err) {
            console.error('[Auth] Failed to store Google tokens:', err);
          }
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signInWithGoogle = useCallback(async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin,
        scopes: 'https://www.googleapis.com/auth/calendar.events',
        queryParams: {
          access_type: 'offline',
          prompt: 'consent',
        },
      },
    });
    if (error) {
      console.error('Google sign-in error:', error.message);
    }
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error('Sign-out error:', error.message);
    }
  }, []);

  const getAccessToken = useCallback(async (): Promise<string | null> => {
    if (!supabase) return null;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return null;

    // If token expires within 60s, refresh it first
    const expiresAt = session.expires_at ?? 0;
    if (Date.now() / 1000 > expiresAt - 60) {
      const { data: { session: refreshed } } = await supabase.auth.refreshSession();
      return refreshed?.access_token ?? null;
    }

    return session.access_token;
  }, []);

  // Skip auth entirely when Supabase isn't configured
  if (SKIP_AUTH) {
    return {
      session: {} as Session,  // truthy so auth gate passes
      user: null,
      loading: false,
      signInWithGoogle,
      signOut,
      getAccessToken,
    };
  }

  return { session, user, loading, signInWithGoogle, signOut, getAccessToken };
}
