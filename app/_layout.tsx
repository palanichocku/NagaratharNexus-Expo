import { useEffect, useRef, useState } from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { supabase } from '../src/lib/supabase';
import { View, ActivityIndicator } from 'react-native';
import { ThemeProvider, useAppTheme } from '../src/theme/ThemeProvider';
import { AppDialogProvider } from '@/src/ui/feedback/AppDialogProvider';
import { ToastProvider } from '@/src/ui/feedback/ToastProvider';
import { getSystemConfig } from '../src/services/systemConfig.service';

function RootLayoutInner() {
  const router = useRouter();
  const segments = useSegments();
  const { theme } = useAppTheme();

  const [isInitializing, setIsInitializing] = useState(true);
  const [, setSession] = useState<any>(null);
  const [isRecoveryMode, setIsRecoveryMode] = useState(false);

  const segmentsRef = useRef<string[]>([]);
  useEffect(() => {
    segmentsRef.current = segments;
  }, [segments]);

  const didRouteRef = useRef(false);

  useEffect(() => {
    let mounted = true;

    const resolveAndRoute = async (nextSession: any, authEvent?: string) => {
      if (!mounted) return;

      const config = await getSystemConfig();

      setSession(nextSession);
      didRouteRef.current = false;

      const segs = segmentsRef.current;
      const routeNow = segs.join('/');

      const isPublicAuthPage = segs[0] === '(auth)' || !segs[0];
      const inTabs = segs[0] === '(tabs)';
      const inAdmin = segs[0] === '(admin)';
      const onResetPassword = routeNow.includes('reset-password');
      const onSetPassword = routeNow.includes('SetPassword');
      const onVerifyEmail = routeNow.includes('VerifyEmail');
      const onPendingApproval = routeNow.includes('PendingApproval');
      const onMaintenance = routeNow.includes('maintenance');

      const shouldEnterRecoveryMode =
        authEvent === 'PASSWORD_RECOVERY' || (!!nextSession && onResetPassword);

      if (shouldEnterRecoveryMode) {
        if (!isRecoveryMode) {
          setIsRecoveryMode(true);
        }

        setIsInitializing(false);

        if (!onResetPassword) {
          didRouteRef.current = true;
          router.replace('/reset-password');
        }
        return;
      }

      if (
        authEvent === 'SIGNED_OUT' ||
        authEvent === 'USER_UPDATED' ||
        (authEvent === 'SIGNED_IN' && !onResetPassword)
      ) {
        if (isRecoveryMode) {
          setIsRecoveryMode(false);
        }
      }

      if (isRecoveryMode && onResetPassword) {
        setIsInitializing(false);
        return;
      }

      if (!nextSession) {
        setIsInitializing(false);
        if (!isPublicAuthPage) {
          router.replace('/(auth)/login');
        }
        return;
      }

      if (config.maintenanceMode) {
        let fetchedRoleDuringMaintenance: string | null = null;

        try {
          const { data: roleRow } = await supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', nextSession.user.id)
            .maybeSingle();

          fetchedRoleDuringMaintenance = roleRow?.role ?? null;
        } catch {
          // silent fallback
        }

        const maintenanceRole = (
          fetchedRoleDuringMaintenance ||
          nextSession.user.user_metadata?.role ||
          'USER'
        )
          .toString()
          .toUpperCase();

        const isStaffDuringMaintenance =
          maintenanceRole === 'ADMIN' || maintenanceRole === 'MODERATOR';

        if (!isStaffDuringMaintenance) {
          setIsInitializing(false);

          if (!onMaintenance && !onResetPassword && !onVerifyEmail && !onSetPassword) {
            didRouteRef.current = true;
            router.replace('/(auth)/maintenance');
          }

          return;
        }
      }

      if (onSetPassword) {
        setIsInitializing(false);
        return;
      }

      let profileData: any = null;
      let profileError: any = null;

      try {
        const { data, error } = await supabase
          .from('profiles')
          .select('id, is_approved, is_submitted')
          .eq('id', nextSession.user.id)
          .maybeSingle();

        profileData = data;
        profileError = error;
      } catch (e) {
        console.warn('⚠️ Profile query crashed:', e);
      }

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

      const finalRole = (fetchedRole || nextSession.user.user_metadata?.role || 'USER')
        .toString()
        .toUpperCase();

      if (profileError) {
        console.error('Critical profile fetch failure. Logging out:', profileError?.message);
        await supabase.auth.signOut();
        setIsInitializing(false);
        return;
      }

      const hasProfile = !!profileData?.id;

      const profile = {
        hasProfile,
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

      if (isStaff) {
        if (!inAdmin) {
          didRouteRef.current = true;
          router.replace('/(admin)/AdminDashboard');
        }
        setIsInitializing(false);
        return;
      }

      // Registration gate:
      // if registrations are closed, block any non-staff user who does not yet have a profile.
      // This closes email signup, Google signup, deep links, and onboarding leakage with one rule.
      if (!config.allowRegistration && !profile.hasProfile) {
        try {
          await supabase.auth.signOut();
        } catch {
          // ignore
        }

        setIsInitializing(false);

        if (!routeNow.includes('login')) {
          didRouteRef.current = true;
          router.replace('/(auth)/login');
        }
        return;
      }

      if (!isEmailVerified) {
        if (!onVerifyEmail) {
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

      if (config.requireApproval && !profile.is_approved) {
        if (!onPendingApproval) {
          didRouteRef.current = true;
          router.replace('/(auth)/PendingApproval');
        }
        setIsInitializing(false);
        return;
      }

      if (!inTabs) {
        didRouteRef.current = true;
        router.replace('/(tabs)/search');
      }

      setIsInitializing(false);
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      void resolveAndRoute(session, 'INITIAL_SESSION');
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, nextSession) => {
      void resolveAndRoute(nextSession, event);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [router, isRecoveryMode]);

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