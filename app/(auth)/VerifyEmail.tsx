import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams } from 'expo-router';

import { REDIRECT_URL, supabase } from '../../src/lib/supabase';
import { useAppTheme } from '../../src/theme/ThemeProvider';
import SignOutButton from '../../src/components/SignOutButton';
import { useDialog } from '@/src/ui/feedback/useDialog';
import { useToast } from '@/src/ui/feedback/useToast';
import { mapAuthError } from '@/src/features/auth/authMessageMapper';
import StatusBanner from '@/src/components/ui/StatusBanner';

export default function VerifyEmailScreen() {
  const { theme } = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const params = useLocalSearchParams<{ email?: string }>();
  const dialog = useDialog();
  const toast = useToast();

  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [userEmail, setUserEmail] = useState<string>(params.email ?? '');
  const [statusMessage, setStatusMessage] = useState('');
  const [statusType, setStatusType] = useState<'idle' | 'success' | 'error'>('idle');

  useEffect(() => {
    let mounted = true;

    const loadBestEmail = async () => {
      try {
        if (params.email && mounted) {
          setUserEmail(String(params.email).trim().toLowerCase());
          return;
        }

        const {
          data: { session },
        } = await supabase.auth.getSession();

        const sessionEmail = session?.user?.email ?? '';
        if (mounted && sessionEmail) {
          setUserEmail(sessionEmail);
        }
      } catch (error: any) {
        if (!mounted) return;
        setStatusType('error');
        setStatusMessage(error?.message || 'Unable to load your account email.');
      }
    };

    void loadBestEmail();

    return () => {
      mounted = false;
    };
  }, [params.email]);

  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;

    if (countdown > 0) {
      timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            if (timer) clearInterval(timer);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [countdown]);

  const setInlineMessage = (type: 'success' | 'error', msg: string) => {
    setStatusType(type);
    setStatusMessage(msg);
  };

  const handleCheckStatus = async () => {
    setLoading(true);
    setStatusMessage('');
    setStatusType('idle');

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.user?.email_confirmed_at) {
        const msg = 'Email verified! Welcome to the community.';
        setInlineMessage('success', msg);
        toast.show(msg, 'success');
        return;
      }

      const msg =
        'Verification not yet detected. Please click the link in your email, then return here and try again.';
      setInlineMessage('error', msg);
    } catch (error: any) {
      const ui = mapAuthError(error, 'signIn');
      setInlineMessage('error', ui.message);
      dialog.show({
        title: ui.title,
        message: ui.message,
        tone: ui.tone,
      });
      console.error('Verification Check Error:', error?.message || error);
    } finally {
      setLoading(false);
    }
  };

  const handleResendEmail = async () => {
    if (resending || countdown > 0) return;

    const cleanEmail = userEmail.trim().toLowerCase();

    if (!cleanEmail) {
      dialog.show({
        title: 'Email not found',
        message:
          'We could not find your email address for this session. Please go back and sign up again.',
        tone: 'error',
      });
      return;
    }

    setResending(true);
    setStatusMessage('');
    setStatusType('idle');

    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: cleanEmail,
        options: {
          emailRedirectTo: `${REDIRECT_URL}/Onboarding`,
        },
      });

      if (error) throw error;

      setCountdown(60);
      const msg = 'A new verification link has been sent to your inbox.';
      setInlineMessage('success', msg);
      toast.show(msg, 'success');
    } catch (error: any) {
      const ui = mapAuthError(error, 'resend');

      if (ui.cooldownSeconds) {
        setCountdown(ui.cooldownSeconds);
      }

      setInlineMessage('error', ui.message);
      dialog.show({
        title: ui.title,
        message: ui.message,
        tone: ui.tone,
      });

      console.error('Resend Verification Error:', error?.message || error);
    } finally {
      setResending(false);
    }
  };

  const resendDisabled = countdown > 0 || resending || !userEmail.trim();

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.iconCircle}>
          <Ionicons name="mail-unread-outline" size={40} color={theme.colors.text} />
        </View>

        <Text style={styles.title}>Confirm Your Email</Text>

        <Text style={styles.subtitle}>
          Check your inbox for a verification link sent to:{'\n'}
          <Text style={styles.boldEmail}>{userEmail || 'your email address'}</Text>
        </Text>

        <View style={styles.infoChip}>
          <Ionicons name="shield-checkmark-outline" size={16} color={theme.colors.mutedText} />
          <Text style={styles.infoChipText}>Verify email before setting up your profile</Text>
        </View>

        {!!statusMessage && (
          <StatusBanner
            theme={theme}
            tone={statusType === 'success' ? 'success' : 'error'}
            text={statusMessage}
          />
        )}

        <TouchableOpacity
          style={[styles.primaryBtn, loading ? styles.dimmed : undefined]}
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
          style={[styles.resendBtn, resendDisabled ? styles.dimmed : undefined]}
          activeOpacity={0.8}
        >
          {resending ? (
            <ActivityIndicator size="small" color={theme.colors.text} />
          ) : (
            <>
              <Ionicons name="refresh" size={16} color={theme.colors.text} />
              <Text style={styles.resendText}>
                {countdown > 0 ? `Resend in ${countdown}s` : "Didn't receive it? Resend Email"}
              </Text>
            </>
          )}
        </TouchableOpacity>

        <SignOutButton variant="row" label="CANCEL & LOGOUT" style={styles.logoutBtn} />
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
      width: '100%',
      marginTop: 18,
    },

    dimmed: {
      opacity: 0.6,
    },
  });
}