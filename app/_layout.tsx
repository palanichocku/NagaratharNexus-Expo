// This is the root layout for the entire app. It handles global authentication state and
// redirects users to the appropriate screens based on their status (e.g., onboarding, pending approval, main app).
// It also wraps the app in a ThemeProvider for consistent theming across screens.
// app/_layout.tsx

import { useEffect, useRef, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { supabase } from '../src/lib/supabase';
import { View, ActivityIndicator, Platform } from 'react-native';
import { ThemeProvider, useAppTheme } from '../src/theme/ThemeProvider';
import { AppDialogProvider } from '@/src/ui/feedback/AppDialogProvider';
import { ToastProvider } from '@/src/ui/feedback/ToastProvider';

function RootLayoutInner() {
  const router = useRouter();
  const segments = useSegments();
  const { theme } = useAppTheme();

  const [isInitializing, setIsInitializing] = useState(true);
  const [, setSession] = useState<any>(null);

  const segmentsRef = useRef<string[]>([]);
  useEffect(() => {
    segmentsRef.current = segments;
  }, [segments]);

  const didRouteRef = useRef(false);

  useEffect(() => {
    let mounted = true;

    const resolveAndRoute = async (nextSession: any) => {
      if (!mounted) return;

      setSession(nextSession);
      didRouteRef.current = false;

      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        const url = window.location.href;
        const isFlowUrl =
          url.includes('access_token=') ||
          url.includes('code=') ||
          url.includes('type=recovery') ||
          url.includes('type=signup') ||
          url.includes('SetPassword');

        if (isFlowUrl) {
          console.log('🎯 Flow detected (Recovery/Invite). Cleaning URL tokens.');
          window.history.replaceState({}, document.title, window.location.pathname);
        }
      }

      const segs = segmentsRef.current;
      const routeNow = segs.join('/');

      const isPublicAuthPage = segs[0] === '(auth)' || !segs[0];
      const inTabs = segs[0] === '(tabs)';
      const inAdmin = segs[0] === '(admin)';

      // Not logged in
      if (!nextSession) {
        setIsInitializing(false);
        if (!isPublicAuthPage) {
          router.replace('/(auth)/login');
        }
        return;
      }

      // ---------------------------------------------------
      // 1) Fetch profile state safely
      // ---------------------------------------------------
      let profileData: any = null;
      let profileError: any = null;

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('is_approved, is_submitted')
          .eq('id', nextSession.user.id)
          .maybeSingle();

        profileData = data;
        profileError = error;
      } catch (e) {
        console.warn('⚠️ Profile query crashed:', e);
      }

      // ---------------------------------------------------
      // 2) Fetch role separately and safely
      // ---------------------------------------------------
      let fetchedRole: string | null = null;

      try {
        const { data: roleRow, error: roleError } = await supabase
          .from('user_roles')
          .select('role')
          .eq('user_id', nextSession.user.id)
          .maybeSingle();

        if (roleError) {
          console.warn('⚠️ Role fetch failed. Falling back to metadata/default:', roleError.message);
        } else {
          fetchedRole = roleRow?.role ?? null;
        }
      } catch (e) {
        console.warn('⚠️ Role query crashed. Falling back to metadata/default:', e);
      }

      const finalRole = (
        fetchedRole ||
        nextSession.user.user_metadata?.role ||
        'USER'
      )
        .toString()
        .toUpperCase();

      // ---------------------------------------------------
      // 3) Only profile query failure is critical enough to block
      // ---------------------------------------------------
      if (profileError) {
        console.error('Critical profile fetch failure. Logging out:', profileError?.message);
        await supabase.auth.signOut();
        setIsInitializing(false);
        return;
      }

      const profile = {
        is_approved: !!profileData?.is_approved,
        is_submitted: !!profileData?.is_submitted,
        role: finalRole,
      };

      const isEmailVerified = !!nextSession.user.email_confirmed_at;
      const isStaff = profile.role === 'ADMIN' || profile.role === 'MODERATOR';

      if (didRouteRef.current) {
        setIsInitializing(false);
        return;
      }

      // Staff route
      if (isStaff) {
        if (!inAdmin) {
          didRouteRef.current = true;
          router.replace('/(admin)/AdminDashboard');
        }
        setIsInitializing(false);
        return;
      }

      // Email verification route
      if (!isEmailVerified) {
        if (!routeNow.includes('VerifyEmail')) {
          didRouteRef.current = true;
          router.replace('/(auth)/VerifyEmail');
        }
        setIsInitializing(false);
        return;
      }

      // New verified user with no onboarding submission
      if (!profile.is_submitted) {
        if (!routeNow.includes('Onboarding')) {
          didRouteRef.current = true;
          router.replace('/(auth)/Onboarding');
        }
        setIsInitializing(false);
        return;
      }

      // Submitted but pending moderation/approval
      if (!profile.is_approved) {
        if (!routeNow.includes('PendingApproval')) {
          didRouteRef.current = true;
          router.replace('/(auth)/PendingApproval');
        }
        setIsInitializing(false);
        return;
      }

      // Approved normal user
      if (!inTabs) {
        didRouteRef.current = true;
        router.replace('/(tabs)/search');
      }

      setIsInitializing(false);
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      void resolveAndRoute(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      void resolveAndRoute(nextSession);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [router]);

  if (isInitializing) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: 'center',
          alignItems: 'center',
          backgroundColor: theme.colors.bg,
        }}
      >
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <AppDialogProvider>
        <ToastProvider>
          <RootLayoutInner />
        </ToastProvider>
      </AppDialogProvider>
    </ThemeProvider>
  );
}