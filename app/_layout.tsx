// This is the root layout for the entire app. It handles global authentication state and 
// redirects users to the appropriate screens based on their status (e.g., onboarding, pending approval, main app).
// It also wraps the app in a ThemeProvider for consistent theming across screens.
// app/_layout.tsx

import { useEffect, useMemo, useRef, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { supabase } from '../src/lib/supabase';
import { View, ActivityIndicator, Platform } from 'react-native';
import { ThemeProvider, useAppTheme } from '../src/theme/ThemeProvider';

function RootLayoutInner() {
  const router = useRouter();
  const segments = useSegments();

  const { theme } = useAppTheme();

  const [isInitializing, setIsInitializing] = useState(true);
  const [session, setSession] = useState<any>(null);

  // ✅ Keep latest segments without resubscribing auth listener
  const segmentsRef = useRef<string[]>([]);
  useEffect(() => {
    segmentsRef.current = segments;
  }, [segments]);

  // ✅ Prevent repeated replace() loops
  const didRouteRef = useRef(false);

  // Small helper
  const currentRoute = useMemo(() => segments.join('/'), [segments]);

  useEffect(() => {
    let mounted = true;

    // Initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setSession(session);
      if (!session) setIsInitializing(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      if (!mounted) return;

      setSession(nextSession);
      didRouteRef.current = false; // allow routing on auth change

      // 🛡️ Web: pause redirects during magic-link / recovery / invite flows
      if (Platform.OS === 'web') {
        const url = window.location.href;
        const isFlowUrl =
          url.includes('access_token=') ||
          url.includes('code=') ||
          url.includes('type=recovery') ||
          url.includes('type=signup') ||
          url.includes('SetPassword');

        if (isFlowUrl) {
          console.log('🎯 Flow detected (Recovery/Invite). Cleaning URL tokens.');

          // ✅ strip tokens so future redirects (including sign out) aren’t blocked
          window.history.replaceState({}, document.title, window.location.pathname);

          // do NOT return; let the auth routing proceed
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
        if (!isPublicAuthPage) router.replace('/(auth)/login');
        return;
      }

      // 🔒 Load role + approval/submission state
      let profileData: any = null;
      let profileError: any = null;
      let fetchedRole: string | null = null;

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select(`
            is_approved,
            is_submitted,
            user_roles ( role )
          `)
          .eq('id', nextSession.user.id)
          .maybeSingle();

        profileData = data;
        profileError = error;
        fetchedRole = (data?.user_roles as any)?.role ?? null;
      } catch (e) {
        console.warn('⚠️ Schema Join failed. Falling back to metadata role.');
      }

      const finalRole =
        (fetchedRole || nextSession.user.user_metadata?.role || 'USER').toString().toUpperCase();

      if (profileError && !nextSession.user.user_metadata?.role) {
        console.error('Critical identity failure. Logging out:', profileError?.message);
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

      // ✅ Avoid replace-loop (route only once per auth change)
      if (didRouteRef.current) {
        setIsInitializing(false);
        return;
      }

      if (isStaff) {
        if (!inAdmin) {
          didRouteRef.current = true;
          router.replace('/(admin)/AdminDashboard');
        }
        setIsInitializing(false);
        return;
      }

      if (!isEmailVerified) {
        if (!routeNow.includes('VerifyEmail')) {
          didRouteRef.current = true;
          router.replace('/(auth)/VerifyEmail');
        }
        setIsInitializing(false);
        return;
      }

      if (!profile.is_submitted) {
        if (!routeNow.includes('Onboarding')) {
          didRouteRef.current = true;
          router.replace('/(auth)/Onboarding');
        }
        setIsInitializing(false);
        return;
      }

      if (!profile.is_approved) {
        if (!routeNow.includes('PendingApproval')) {
          didRouteRef.current = true;
          router.replace('/(auth)/PendingApproval');
        }
        setIsInitializing(false);
        return;
      }

      // ✅ Approved normal user: go to Search (consistent landing)
      if (!inTabs) {
        didRouteRef.current = true;
        router.replace('/(tabs)/search');
      }

      setIsInitializing(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [router]);

  if (isInitializing) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: theme.colors.bg }}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <RootLayoutInner />
    </ThemeProvider>
  );
}