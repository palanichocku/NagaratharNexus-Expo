// src/features/auth/useSignOut.ts
import { useCallback, useRef, useState } from 'react';
import { Alert, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { supabase } from '@/src/lib/supabase';

type UseSignOutOptions = {
  redirectTo?: string; // default "/login"
  onBeforeSignOut?: () => void | Promise<void>;
  showErrorAlert?: boolean; // default true
  timeoutMs?: number; // default 4000
  forceNavigateOnError?: boolean; // default true
};

export function useSignOut(options: UseSignOutOptions = {}) {
  const {
    redirectTo = '/login',
    onBeforeSignOut,
    showErrorAlert = true,
    timeoutMs = 4000,
    forceNavigateOnError = true,
  } = options;

  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const inFlightRef = useRef(false);

  const hardNavigate = useCallback(() => {
    try {
      router.replace(redirectTo);
    } catch {}

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try {
        window.location.replace(redirectTo);
      } catch {}
    }
  }, [router, redirectTo]);

  const signOut = useCallback(async () => {
    if (inFlightRef.current || isSigningOut) return;

    inFlightRef.current = true;
    setIsSigningOut(true);

    try {
      if (onBeforeSignOut) await onBeforeSignOut();

      // ✅ Clear any magic-link tokens / query params on web
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.history.replaceState({}, document.title, window.location.pathname);
      }

      // ✅ Don’t hang forever
      await Promise.race([
        supabase.auth.signOut(),
        new Promise((_, rej) => setTimeout(() => rej(new Error('Sign out timed out')), timeoutMs)),
      ]);

      hardNavigate();
    } catch (e: any) {
      console.error('[useSignOut] failed:', e);
      const msg = e?.message || 'Please try again.';

      if (showErrorAlert) {
        Platform.OS === 'web'
          ? alert(`Sign out failed: ${msg}`)
          : Alert.alert('Sign out failed', msg);
      }

      if (forceNavigateOnError) hardNavigate();
    } finally {
      inFlightRef.current = false;
      setIsSigningOut(false);
    }
  }, [hardNavigate, isSigningOut, onBeforeSignOut, showErrorAlert, timeoutMs, forceNavigateOnError]);

  return { signOut, isSigningOut };
}