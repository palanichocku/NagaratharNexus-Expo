// src/features/auth/useSignOut.ts
import { useCallback, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import { supabase } from '@/src/lib/supabase';
import { useDialog } from '@/src/ui/feedback/useDialog';

type UseSignOutOptions = {
  redirectTo?: Href; // default "/login"
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
  const dialog = useDialog();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const inFlightRef = useRef(false);

  const hardNavigate = useCallback(() => {
    try {
      router.replace(redirectTo);
    } catch {}

    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      try {
        window.location.replace(
          typeof redirectTo === 'string' ? redirectTo : String(redirectTo)
        );
      } catch {}
    }
  }, [router, redirectTo]);

  const signOut = useCallback(async () => {
    if (inFlightRef.current || isSigningOut) return;

    inFlightRef.current = true;
    setIsSigningOut(true);

    try {
      if (onBeforeSignOut) await onBeforeSignOut();

      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        window.history.replaceState({}, document.title, window.location.pathname);
      }

      await Promise.race([
        supabase.auth.signOut(),
        new Promise((_, rej) => setTimeout(() => rej(new Error('Sign out timed out')), timeoutMs)),
      ]);

      hardNavigate();
    } catch (e: any) {
      console.error('[useSignOut] failed:', e);
      const msg = e?.message || 'Please try again.';

      if (showErrorAlert) {
        dialog.show({
          title: 'Sign out failed',
          message: msg,
          tone: 'error',
        });
      }

      if (forceNavigateOnError) hardNavigate();
    } finally {
      inFlightRef.current = false;
      setIsSigningOut(false);
    }
  }, [dialog, hardNavigate, isSigningOut, onBeforeSignOut, showErrorAlert, timeoutMs, forceNavigateOnError]);

  return { signOut, isSigningOut };
}