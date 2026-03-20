import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { supabase } from '../../src/lib/supabase';
import { useAppTheme } from '../../src/theme/ThemeProvider';
import { useDialog } from '@/src/ui/feedback/useDialog';
import { useToast } from '@/src/ui/feedback/useToast';

const MIN_PASSWORD_LENGTH = 8;

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { theme } = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const dialog = useDialog();
  const toast = useToast();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);

  useEffect(() => {
    let mounted = true;

    const finishSessionCheck = (value: boolean) => {
      if (!mounted) return;
      setHasRecoverySession(value);
      setCheckingSession(false);
    };

    const checkRecoverySession = async () => {
      try {
        for (let i = 0; i < 6; i += 1) {
          const {
            data: { session },
          } = await supabase.auth.getSession();

          if (session) {
            finishSessionCheck(true);
            return;
          }

          await new Promise((resolve) => setTimeout(resolve, 500));
        }

        finishSessionCheck(false);
      } catch {
        finishSessionCheck(false);
      }
    };

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      setTimeout(() => {
        if (!mounted) return;

        if (event === 'PASSWORD_RECOVERY' && session) {
          setHasRecoverySession(true);
          setCheckingSession(false);
          return;
        }

        if (event === 'SIGNED_OUT') {
          setHasRecoverySession(false);
          setCheckingSession(false);
        }
      }, 0);
    });

    void checkRecoverySession();

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const validatePassword = () => {
    if (!password || !confirmPassword) {
      dialog.show({
        title: 'Missing Details',
        message: 'Please enter and confirm your new password.',
        tone: 'warning',
        actions: [{ label: 'OK', variant: 'primary' }],
      });
      return false;
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      dialog.show({
        title: 'Password Too Short',
        message: `Your password must be at least ${MIN_PASSWORD_LENGTH} characters long.`,
        tone: 'warning',
        actions: [{ label: 'OK', variant: 'primary' }],
      });
      return false;
    }

    if (password !== confirmPassword) {
      dialog.show({
        title: 'Passwords Do Not Match',
        message: 'Please make sure both password fields match.',
        tone: 'warning',
        actions: [{ label: 'OK', variant: 'primary' }],
      });
      return false;
    }

    return true;
  };

  const handleUpdatePassword = async () => {
    if (loading) return;

    if (!hasRecoverySession) {
      dialog.show({
        title: 'Recovery Link Needed',
        message: 'Please open the password reset link from your email again.',
        tone: 'warning',
        actions: [{ label: 'OK', variant: 'primary' }],
      });
      return;
    }

    if (!validatePassword()) return;

    setLoading(true);

    try {
      const { data, error } = await supabase.auth.updateUser({
        password,
      });

      if (error) throw error;
      if (!data.user) throw new Error('Unable to update password.');

      toast.show('Your password has been updated.', 'success');

      dialog.show({
        title: 'Password Updated',
        message: 'Your password was updated successfully. Please sign in with your new password.',
        tone: 'success',
        actions: [
          {
            label: 'Go to Sign In',
            variant: 'primary',
            onPress: async () => {
              await supabase.auth.signOut();
              router.replace('/(auth)/login');
            },
          },
        ],
      });
    } catch (error: any) {
      const rawMessage = String(error?.message || '');
      const normalized = rawMessage.toLowerCase();

      const isRecoverablePasswordError =
        normalized.includes('different from the old password') ||
        normalized.includes('same as the old password') ||
        normalized.includes('password should be different') ||
        normalized.includes('password is too weak') ||
        normalized.includes('password does not meet');

      const isExpiredOrInvalidRecoveryError =
        normalized.includes('expired') ||
        normalized.includes('invalid') ||
        normalized.includes('session') ||
        normalized.includes('token') ||
        normalized.includes('jwt');

      if (isRecoverablePasswordError && !isExpiredOrInvalidRecoveryError) {
        setPassword('');
        setConfirmPassword('');

        dialog.show({
          title: 'Choose a Different Password',
          message:
            rawMessage ||
            'Please choose a new password that is different and meets the password rules.',
          tone: 'warning',
          actions: [{ label: 'OK', variant: 'primary' }],
        });
        return;
      }

      setHasRecoverySession(false);

      dialog.show({
        title: 'Could Not Update Password',
        message:
          rawMessage || 'This recovery link may have expired. Please request a new reset email.',
        tone: 'danger',
        actions: [
          {
            label: 'Back to Login',
            variant: 'primary',
            onPress: async () => {
              await supabase.auth.signOut();
              router.replace('/(auth)/login');
            },
          },
        ],
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBackToLogin = async () => {
    await supabase.auth.signOut();
    router.replace('/(auth)/login');
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.card}>
        <View style={styles.iconCircle}>
          <Ionicons name="lock-closed" size={30} color={theme.colors.text} />
        </View>

        <Text style={styles.title}>Reset Your Password</Text>
        <Text style={styles.subtitle}>
          Choose a new password to regain access to your account.
        </Text>

        {checkingSession ? (
          <View style={styles.statusBox}>
            <ActivityIndicator color={theme.colors.primary} />
            <Text style={styles.statusText}>Verifying your reset link…</Text>
          </View>
        ) : !hasRecoverySession ? (
          <View style={styles.statusBox}>
            <Ionicons name="alert-circle-outline" size={18} color={theme.colors.danger} />
            <Text style={styles.errorText}>
              This reset link is missing or has expired. Please request a new one.
            </Text>
          </View>
        ) : (
          <>
            <View style={styles.inputGroup}>
              <Text style={styles.label}>NEW PASSWORD</Text>
              <View style={styles.inputShell}>
                <Ionicons name="key-outline" size={18} color={theme.colors.mutedText} />
                <TextInput
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor={theme.colors.mutedText}
                  secureTextEntry={!showPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={password}
                  onChangeText={setPassword}
                  editable={!loading}
                  textContentType="newPassword"
                  autoComplete="password-new"
                  returnKeyType="next"
                />
                <TouchableOpacity
                  onPress={() => setShowPassword((v) => !v)}
                  style={styles.eyeBtn}
                  disabled={loading}
                >
                  <Ionicons
                    name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={18}
                    color={theme.colors.mutedText}
                  />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>CONFIRM PASSWORD</Text>
              <View style={styles.inputShell}>
                <Ionicons
                  name="checkmark-circle-outline"
                  size={18}
                  color={theme.colors.mutedText}
                />
                <TextInput
                  style={styles.input}
                  placeholder="••••••••"
                  placeholderTextColor={theme.colors.mutedText}
                  secureTextEntry={!showConfirmPassword}
                  autoCapitalize="none"
                  autoCorrect={false}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  editable={!loading}
                  textContentType="newPassword"
                  autoComplete="password-new"
                  returnKeyType="done"
                  onSubmitEditing={() => {
                    void handleUpdatePassword();
                  }}
                />
                <TouchableOpacity
                  onPress={() => setShowConfirmPassword((v) => !v)}
                  style={styles.eyeBtn}
                  disabled={loading}
                >
                  <Ionicons
                    name={showConfirmPassword ? 'eye-off-outline' : 'eye-outline'}
                    size={18}
                    color={theme.colors.mutedText}
                  />
                </TouchableOpacity>
              </View>
            </View>

            <Text style={styles.passwordHint}>
              Use at least {MIN_PASSWORD_LENGTH} characters.
            </Text>

            <TouchableOpacity
              style={[styles.btn, loading && styles.btnDisabled]}
              onPress={() => {
                void handleUpdatePassword();
              }}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color={theme.colors.primaryText} />
              ) : (
                <>
                  <Text style={styles.btnText}>Update Password</Text>
                  <Ionicons
                    name="arrow-forward"
                    size={18}
                    color={theme.colors.primaryText}
                    style={{ marginLeft: 10 }}
                  />
                </>
              )}
            </TouchableOpacity>
          </>
        )}

        <TouchableOpacity
          onPress={() => {
            void handleBackToLogin();
          }}
          style={styles.secondaryBtn}
          disabled={loading}
        >
          <Text style={styles.secondaryBtnText}>Back to Sign In</Text>
        </TouchableOpacity>

        <View style={styles.trustRow}>
          <Ionicons name="shield-checkmark-outline" size={16} color={theme.colors.mutedText} />
          <Text style={styles.trustText}>Secure reset • Password stored by Supabase Auth</Text>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function makeStyles(theme: any) {
  const r = theme.radius;

  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.bg,
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },

    card: {
      width: '100%',
      maxWidth: 420,
      backgroundColor: theme.colors.surface2,
      borderRadius: r.card,
      padding: 26,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: 'center',

      shadowColor: '#000',
      shadowOpacity: Platform.OS === 'web' ? 0 : 0.06,
      shadowRadius: 18,
      shadowOffset: { width: 0, height: 12 },
      elevation: 3,
      ...(Platform.OS === 'web'
        ? ({
            boxShadow:
              '0 20px 25px -5px rgba(0,0,0,0.10), 0 10px 10px -5px rgba(0,0,0,0.04)',
          } as any)
        : null),
    },

    iconCircle: {
      width: 78,
      height: 78,
      borderRadius: 39,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 16,
    },

    title: {
      fontSize: 22,
      fontWeight: '900',
      color: theme.colors.text,
      textAlign: 'center',
      marginBottom: 8,
    },

    subtitle: {
      fontSize: 14,
      color: theme.colors.mutedText,
      textAlign: 'center',
      lineHeight: 20,
      marginBottom: 18,
      fontWeight: '600',
    },

    statusBox: {
      width: '100%',
      minHeight: 72,
      borderRadius: r.input,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      paddingHorizontal: 14,
      paddingVertical: 14,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 10,
      marginBottom: 14,
    },

    statusText: {
      color: theme.colors.text,
      fontWeight: '700',
      fontSize: 14,
    },

    errorText: {
      flex: 1,
      color: theme.colors.danger,
      fontWeight: '800',
      fontSize: 14,
      textAlign: 'left',
      lineHeight: 20,
    },

    inputGroup: {
      width: '100%',
      marginBottom: 14,
    },

    label: {
      fontSize: 11,
      fontWeight: '900',
      color: theme.colors.mutedText,
      marginBottom: 8,
      letterSpacing: 0.8,
    },

    inputShell: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: theme.colors.inputBg,
      borderRadius: r.input,
      paddingHorizontal: 12,
      height: 52,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },

    input: {
      flex: 1,
      fontSize: 15,
      color: theme.colors.text,
      fontWeight: '700',
      paddingVertical: 0,
    },

    eyeBtn: {
      paddingHorizontal: 8,
      paddingVertical: 6,
      borderRadius: 10,
    },

    passwordHint: {
      width: '100%',
      marginTop: -4,
      marginBottom: 10,
      color: theme.colors.mutedText,
      fontWeight: '700',
      fontSize: 12,
    },

    btn: {
      width: '100%',
      height: 52,
      backgroundColor: theme.colors.primary,
      borderRadius: r.button,
      justifyContent: 'center',
      alignItems: 'center',
      marginTop: 8,
      flexDirection: 'row',
    },

    btnDisabled: {
      opacity: 0.6,
    },

    btnText: {
      color: theme.colors.primaryText,
      fontSize: 15,
      fontWeight: '900',
    },

    secondaryBtn: {
      marginTop: 14,
      paddingVertical: 8,
      paddingHorizontal: 10,
    },

    secondaryBtnText: {
      color: theme.colors.text,
      fontWeight: '800',
      fontSize: 14,
    },

    trustRow: {
      marginTop: 14,
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: r.chip,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },

    trustText: {
      color: theme.colors.mutedText,
      fontWeight: '800',
      fontSize: 12,
    },
  });
}