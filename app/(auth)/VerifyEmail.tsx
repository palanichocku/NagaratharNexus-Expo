// /app/(auth)/VerifyEmail.tsx
import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { REDIRECT_URL, supabase } from '../../src/lib/supabase';
import { useAppTheme } from '../../src/theme/ThemeProvider';

export default function VerifyEmailScreen() {
  const { theme } = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [userEmail, setUserEmail] = useState<string | undefined>('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setUserEmail(data.user?.email);
    });
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;

    if (countdown > 0) {
      timer = setInterval(() => setCountdown((prev) => prev - 1), 1000);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [countdown]);

  const handleCheckStatus = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error) throw error;

      if (data.user?.email_confirmed_at) {
        const msg = 'Email verified! Welcome to the community.';
        Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Success', msg);
        // Note: app/_layout.tsx will see the verified status and redirect automatically
      } else {
        const msg = 'Verification not yet detected. Please click the link in your email.';
        Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Still Pending', msg);
      }
    } catch (error: any) {
      // eslint-disable-next-line no-console
      console.error('Verification Check Error:', error?.message || error);
    } finally {
      setLoading(false);
    }
  };

  const handleResendEmail = async () => {
    if (!userEmail || countdown > 0) return;

    setResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: userEmail,
        options: {
          emailRedirectTo: `${REDIRECT_URL}/Onboarding`,
        },
      });

      if (error) throw error;

      const msg = 'A new link has been sent to your inbox.';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Sent', msg);

      setCountdown(60);
    } catch (error: any) {
      Alert.alert('Error', error.message);
    } finally {
      setResending(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
  };

  const resendDisabled = countdown > 0 || resending;

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.iconCircle}>
          <Ionicons name="mail-unread-outline" size={40} color={theme.colors.text} />
        </View>

        <Text style={styles.title}>Confirm Your Email</Text>

        <Text style={styles.subtitle}>
          Check your inbox for a verification link sent to:{'\n'}
          <Text style={styles.boldEmail}>{userEmail || '—'}</Text>
        </Text>

        <View style={styles.infoChip}>
          <Ionicons name="shield-checkmark-outline" size={16} color={theme.colors.mutedText} />
          <Text style={styles.infoChipText}>Verify email before setting up your profile</Text>
        </View>

        <TouchableOpacity
          style={[styles.primaryBtn, loading && { opacity: 0.65 }]}
          onPress={handleCheckStatus}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color={theme.colors.primaryText} />
          ) : (
            <>
              <Text style={styles.btnText}>I&apos;ve Verified My Email</Text>
              <Ionicons
                name="arrow-forward"
                size={18}
                color={theme.colors.primaryText}
                style={{ marginLeft: 10 }}
              />
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={handleResendEmail}
          disabled={resendDisabled}
          style={[styles.resendBtn, resendDisabled && { opacity: 0.55 }]}
          activeOpacity={0.8}
        >
          <Ionicons name="refresh" size={16} color={theme.colors.text} />
          <Text style={styles.resendText}>
            {countdown > 0 ? `Resend in ${countdown}s` : "Didn't receive it? Resend Email"}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn} activeOpacity={0.7}>
          <Text style={styles.logoutText}>Cancel & Logout</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function makeStyles(theme: any) {
  const s = theme.spacing;
  const r = theme.radius;

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.bg,
      justifyContent: 'center',
      padding: s.lg,
      alignItems: 'center',
    },

    card: {
      width: '100%',
      maxWidth: 520,
      backgroundColor: theme.colors.surface2,
      padding: 22,
      borderRadius: r.card,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.colors.border,
      shadowColor: '#000',
      shadowOpacity: Platform.OS === 'web' ? 0 : 0.06,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 12 },
      elevation: 3,
    },

    iconCircle: {
      width: 86,
      height: 86,
      borderRadius: 43,
      backgroundColor: theme.colors.surface,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 14,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },

    title: {
      fontSize: 22,
      fontWeight: '900',
      marginBottom: 8,
      color: theme.colors.text,
      textAlign: 'center',
    },

    subtitle: {
      textAlign: 'center',
      color: theme.colors.mutedText,
      fontSize: 14,
      marginBottom: 12,
      lineHeight: 20,
      fontWeight: '600',
    },

    boldEmail: {
      color: theme.colors.text,
      fontWeight: '900',
    },

    infoChip: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: r.chip,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginBottom: 16,
    },

    infoChipText: {
      fontSize: 12,
      fontWeight: '800',
      color: theme.colors.mutedText,
    },

    primaryBtn: {
      backgroundColor: theme.colors.primary,
      width: '100%',
      paddingVertical: 14,
      borderRadius: r.button,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      marginBottom: 10,
    },

    btnText: {
      color: theme.colors.primaryText,
      fontWeight: '900',
      fontSize: 15,
    },

    resendBtn: {
      width: '100%',
      height: 48,
      borderRadius: r.button,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 10,
      marginTop: 6,
    },

    resendText: {
      color: theme.colors.text,
      fontWeight: '900',
      fontSize: 13,
    },

    logoutBtn: {
      marginTop: 18,
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: r.chip,
    },

    logoutText: {
      color: theme.colors.danger,
      fontWeight: '900',
      fontSize: 13,
    },
  });
}