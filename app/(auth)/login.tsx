import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Pressable
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { supabase, REDIRECT_URL } from '../../src/lib/supabase';
import { useAppTheme } from '../../src/theme/ThemeProvider';
import { useDialog } from '@/src/ui/feedback/useDialog';
import { useToast } from '@/src/ui/feedback/useToast';
import { mapAuthError } from '@/src/features/auth/authMessageMapper';
import { getSystemConfig } from '../../src/services/systemConfig.service';

const MAX_PASSWORD_ATTEMPTS = 3;

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

type RegistrationStatus = 'loading' | 'open' | 'closed';

export default function LoginScreen() {
  const router = useRouter();
  const { theme } = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const dialog = useDialog();
  const toast = useToast();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [signupCooldown, setSignupCooldown] = useState(0);

  const [failedAttempts, setFailedAttempts] = useState(0);
  const [passwordLocked, setPasswordLocked] = useState(false);

  const [registrationStatus, setRegistrationStatus] =
    useState<RegistrationStatus>('loading');

  const isCheckingRegistration = registrationStatus === 'loading';
  const isRegistrationClosed = registrationStatus === 'closed';
  const canShowSignUp = registrationStatus === 'open' && isSignUp;

  useEffect(() => {
    let mounted = true;

    const loadConfig = async () => {
      const config = await getSystemConfig();
      if (!mounted) return;

      setRegistrationStatus(config.allowRegistration ? 'open' : 'closed');
    };

    void loadConfig();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (signupCooldown <= 0) return;

    const id = setInterval(() => {
      setSignupCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(id);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(id);
  }, [signupCooldown]);

  useEffect(() => {
    setFailedAttempts(0);
    setPasswordLocked(false);
  }, [isSignUp]);

  useEffect(() => {
    if (registrationStatus !== 'open') {
      setIsSignUp(false);
      setFullName('');
    }
  }, [registrationStatus]);

  const resetSignInGuards = () => {
    setFailedAttempts(0);
    setPasswordLocked(false);
  };

  const showRegistrationClosedDialog = () => {
    dialog.show({
      title: 'Registration Closed',
      message:
        'New member registration is temporarily disabled. Existing members can still sign in.',
      tone: 'warning',
      actions: [{ label: 'OK', variant: 'primary' }],
    });
  };

  const handleOpenSignUp = () => {
    if (loading || isCheckingRegistration) return;

    if (isRegistrationClosed) {
      showRegistrationClosedDialog();
      return;
    }

    setIsSignUp(true);
  };

  const handleForgotPassword = async () => {
    if (loading) return;

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail) {
      dialog.show({
        title: 'Email Required',
        message: 'Enter your email first.',
        tone: 'warning',
        actions: [{ label: 'OK', variant: 'primary' }],
      });
      return;
    }

    if (!isValidEmail(cleanEmail)) {
      dialog.show({
        title: 'Invalid Email',
        message: 'Please enter a valid email address.',
        tone: 'warning',
        actions: [{ label: 'OK', variant: 'primary' }],
      });
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
        redirectTo: `${REDIRECT_URL}/reset-password`,
      });

      if (error) throw error;

      resetSignInGuards();

      dialog.show({
        title: 'Check your email',
        message: `If an account exists for ${cleanEmail}, a reset link has been sent.`,
        tone: 'success',
        actions: [{ label: 'OK', variant: 'primary' }],
      });
    } catch (error: any) {
      const ui = mapAuthError(error, 'forgot');
      dialog.show({
        title: ui.title,
        message: ui.message,
        tone: ui.tone,
        actions: [{ label: 'OK', variant: 'primary' }],
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAuth = async () => {
    if (
      loading ||
      isCheckingRegistration ||
      (canShowSignUp && signupCooldown > 0) ||
      (!canShowSignUp && passwordLocked)
    ) {
      return;
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanName = fullName.trim();

    if (!cleanEmail || !password) {
      dialog.show({
        title: 'Missing Details',
        message: canShowSignUp
          ? 'Please enter your full name, email, and password.'
          : 'Please enter your email and password.',
        tone: 'warning',
        actions: [{ label: 'OK', variant: 'primary' }],
      });
      return;
    }

    if (!isValidEmail(cleanEmail)) {
      dialog.show({
        title: 'Invalid Email',
        message: 'Please enter a valid email address.',
        tone: 'warning',
        actions: [{ label: 'OK', variant: 'primary' }],
      });
      return;
    }

    if (canShowSignUp && !cleanName) {
      dialog.show({
        title: 'Full Name Required',
        message: 'Please enter your full name to create your account.',
        tone: 'warning',
        actions: [{ label: 'OK', variant: 'primary' }],
      });
      return;
    }

    setLoading(true);

    try {
      if (canShowSignUp) {
        const config = await getSystemConfig();

        if (!config.allowRegistration) {
          setRegistrationStatus('closed');
          setIsSignUp(false);
          setFullName('');
          showRegistrationClosedDialog();
          return;
        }

        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            data: { full_name: cleanName },
            emailRedirectTo: `${REDIRECT_URL}/Onboarding`,
          },
        });

        if (error) throw error;

        dialog.show({
          title: 'Check your email',
          message: `We sent a verification link to ${cleanEmail}. Please verify your email before continuing.`,
          tone: 'success',
          actions: [
            {
              label: 'Continue',
              variant: 'primary',
              onPress: () =>
                router.push({
                  pathname: '/(auth)/VerifyEmail',
                  params: { email: cleanEmail },
                }),
            },
          ],
        });

        if (!data?.user) {
          toast.show('Please check your email for the verification link.', 'info');
        }
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (error) {
        const raw = String(error?.message || '').toLowerCase();

        if (raw.includes('invalid login credentials')) {
          const nextAttempts = failedAttempts + 1;
          const remaining = MAX_PASSWORD_ATTEMPTS - nextAttempts;

          setFailedAttempts(nextAttempts);

          if (nextAttempts >= MAX_PASSWORD_ATTEMPTS) {
            setPasswordLocked(true);

            dialog.show({
              title: 'Too Many Attempts',
              message:
                'You have reached the maximum number of sign-in attempts. Please reset your password to continue.',
              tone: 'warning',
              actions: [
                {
                  label: 'Reset Password',
                  variant: 'primary',
                  onPress: () => {
                    void handleForgotPassword();
                  },
                },
                {
                  label: 'Cancel',
                  variant: 'secondary',
                },
              ],
            });
            return;
          }

          dialog.show({
            title: 'Incorrect Email or Password',
            message: `The email or password you entered is incorrect. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`,
            tone: 'warning',
            actions: [
              {
                label: 'OK',
                variant: 'primary',
              },
              {
                label: 'Reset Password',
                variant: 'secondary',
                onPress: () => {
                  void handleForgotPassword();
                },
              },
            ],
          });
          return;
        }

        throw error;
      }

      resetSignInGuards();
      toast.show('Welcome back.', 'success');
    } catch (error: any) {
      const ui = mapAuthError(error, canShowSignUp ? 'signUp' : 'signIn');

      if (canShowSignUp && ui.cooldownSeconds) {
        setSignupCooldown(ui.cooldownSeconds);
      }

      dialog.show({
        title: ui.title,
        message: ui.message,
        tone: ui.tone,
        actions: [{ label: 'OK', variant: 'primary' }],
      });
    } finally {
      setLoading(false);
    }
  };

  const isPrimaryDisabled =
    loading ||
    isCheckingRegistration ||
    (canShowSignUp && signupCooldown > 0) ||
    (!canShowSignUp && passwordLocked);

  const primaryLabel =
    isCheckingRegistration
      ? 'Loading...'
      : canShowSignUp && signupCooldown > 0
        ? `Create Account (${signupCooldown}s)`
        : canShowSignUp
          ? 'Create Account'
          : passwordLocked
            ? 'Reset Password Required'
            : 'Sign In';

  const attemptsRemaining = Math.max(0, MAX_PASSWORD_ATTEMPTS - failedAttempts);

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <View style={styles.brandHeader}>
          <View style={styles.logoCircle}>
            <Ionicons name="heart" size={18} color={theme.colors.primary} />
          </View>

          <Text style={styles.title}>Nagarathar Nexus</Text>
          <Text style={styles.subtitle}>
            A respectful matchmaking space for the Nagarathar community
          </Text>

          <View style={styles.trustRow}>
            <Ionicons name="lock-closed-outline" size={16} color={theme.colors.mutedText} />
            <Text style={styles.trustText}>Private • Verified • Community-first</Text>
          </View>
        </View>

        <View style={styles.card}>
    
          {!canShowSignUp && isRegistrationClosed && (
            <Text style={styles.closedNote}>
              New member signups are temporarily unavailable. Existing members can still sign in.
            </Text>
          )}

          {canShowSignUp && (
            <View style={[styles.inputShell, fullName ? styles.inputShellActive : null]}>
              <Ionicons name="person-outline" size={18} color={theme.colors.mutedText} />
              <TextInput
                style={styles.input}
                placeholder="Full Name"
                placeholderTextColor={theme.colors.mutedText}
                value={fullName}
                onChangeText={setFullName}
                editable={!loading}
                returnKeyType="next"
              />
            </View>
          )}

          <View style={[styles.inputShell, email.trim() ? styles.inputShellActive : null]}>
            <Ionicons name="mail-outline" size={18} color={theme.colors.mutedText} />
            <TextInput
              style={styles.input}
              placeholder="Email Address"
              placeholderTextColor={theme.colors.mutedText}
              value={email}
              onChangeText={(text) => {
                setEmail(text);
                if (!canShowSignUp) {
                  resetSignInGuards();
                }
              }}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="emailAddress"
              autoComplete="email"
              editable={!loading}
              returnKeyType="next"
            />
          </View>

          <View style={[styles.inputShell, password ? styles.inputShellActive : null]}>
            <Ionicons name="lock-closed-outline" size={18} color={theme.colors.mutedText} />
            <TextInput
              style={styles.input}
              placeholder="Password"
              placeholderTextColor={theme.colors.mutedText}
              value={password}
              onChangeText={setPassword}
              secureTextEntry={!showPassword}
              editable={!loading && !passwordLocked}
              textContentType={canShowSignUp ? 'newPassword' : 'password'}
              autoComplete={canShowSignUp ? 'password-new' : 'password'}
              returnKeyType="done"
              onSubmitEditing={() => {
                void handleEmailAuth();
              }}
            />
            <Pressable
              onPress={() => setShowPassword((p) => !p)}
              style={styles.eyeBtn}
              disabled={loading}
            >
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={18}
                color={theme.colors.mutedText}
              />
            </Pressable>
          </View>

          {!canShowSignUp && failedAttempts > 0 && !passwordLocked && (
            <Text style={styles.attemptText}>
              {attemptsRemaining} attempt{attemptsRemaining === 1 ? '' : 's'} remaining
            </Text>
          )}

          {!canShowSignUp && passwordLocked && (
            <Text style={styles.lockedText}>
              Too many failed attempts. Please reset your password.
            </Text>
          )}

          <TouchableOpacity
            style={[styles.primaryButton, isPrimaryDisabled && styles.primaryButtonDisabled]}
            onPress={() => {
              void handleEmailAuth();
            }}
            disabled={isPrimaryDisabled}
            activeOpacity={0.85}
          >
            {loading || isCheckingRegistration ? (
              <ActivityIndicator color={theme.colors.primaryText} />
            ) : (
              <>
                <Text style={styles.buttonText}>{primaryLabel}</Text>
                <Ionicons
                  name="arrow-forward"
                  size={18}
                  color={theme.colors.primaryText}
                  style={{ marginLeft: 10 }}
                />
              </>
            )}
          </TouchableOpacity>

          {!canShowSignUp && (
            <TouchableOpacity
              onPress={() => {
                void handleForgotPassword();
              }}
              style={styles.forgotBtn}
              disabled={loading}
            >
              <Text style={styles.forgotText}>Forgot Password?</Text>
            </TouchableOpacity>
          )}

          {canShowSignUp ? (
            <TouchableOpacity
              onPress={() => {
                setIsSignUp(false);
                setFullName('');
              }}
              style={styles.switchBtn}
              disabled={loading}
            >
              <Text style={styles.switchText}>Already have an account? Sign In</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={handleOpenSignUp}
              style={styles.switchBtn}
              disabled={loading || isCheckingRegistration}
            >
              <Text
                style={[
                  styles.switchText,
                  isRegistrationClosed ? styles.switchTextDisabled : null,
                ]}
              >
                {isCheckingRegistration
                  ? 'Checking registration status...'
                  : isRegistrationClosed
                    ? 'New member registration is currently closed'
                    : 'New member? Create an account'}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
}

function makeStyles(theme: any) {
  const r = theme.radius;

  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.bg },

    content: {
      paddingHorizontal: 22,
      paddingTop: 42,
      paddingBottom: 28,
      maxWidth: 420,
      width: '100%',
      alignSelf: 'center',
      flex: 1,
      justifyContent: 'center',
    },

    brandHeader: { alignItems: 'center', marginBottom: 18 },

    logoCircle: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: theme.colors.surface,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginBottom: 10,
    },

    title: {
      fontSize: 30,
      fontWeight: '900',
      textAlign: 'center',
      color: theme.colors.text,
    },

    subtitle: {
      fontSize: 14,
      color: theme.colors.mutedText,
      textAlign: 'center',
      marginTop: 8,
      lineHeight: 20,
      fontWeight: '600',
    },

    trustRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      marginTop: 12,
      backgroundColor: theme.colors.surface2,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: r.chip,
    },

    trustText: {
      color: theme.colors.mutedText,
      fontWeight: '800',
      fontSize: 12,
    },

    card: {
      backgroundColor: theme.colors.surface2,
      borderRadius: r.card,
      padding: 18,
      borderWidth: 1,
      borderColor: theme.colors.border,
      shadowColor: '#000',
      shadowOpacity: Platform.OS === 'web' ? 0 : 0.06,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 10 },
    },

    socialButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 14,
      paddingHorizontal: 14,
      borderRadius: r.button,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface2,
    },

    socialText: {
      fontWeight: '800',
      color: theme.colors.text,
      fontSize: 14,
    },

    disabledButton: {
      opacity: 0.6,
    },

    pressedButton: {
      opacity: 0.85,
    },

    divider: {
      flexDirection: 'row',
      alignItems: 'center',
      marginVertical: 16,
    },

    line: {
      flex: 1,
      height: 1,
      backgroundColor: theme.colors.border,
    },

    or: {
      marginHorizontal: 10,
      color: theme.colors.mutedText,
      fontSize: 12,
      fontWeight: '900',
      letterSpacing: 1,
    },

    closedNote: {
      marginTop: -4,
      marginBottom: 12,
      textAlign: 'center',
      color: theme.colors.mutedText,
      fontWeight: '700',
      fontSize: 12,
      lineHeight: 18,
    },

    inputShell: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: theme.colors.inputBg,
      borderRadius: r.input,
      paddingHorizontal: 12,
      paddingVertical: 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginBottom: 12,
    },

    inputShellActive: {
      backgroundColor: theme.colors.surface2,
      borderColor: theme.colors.border,
    },

    input: {
      flex: 1,
      fontSize: 15,
      color: theme.colors.text,
      paddingVertical: 0,
      fontWeight: '700',
    },

    eyeBtn: {
      paddingHorizontal: 8,
      paddingVertical: 6,
      borderRadius: 10,
    },

    attemptText: {
      marginTop: -4,
      marginBottom: 10,
      color: theme.colors.warning ?? theme.colors.primary,
      fontWeight: '800',
      fontSize: 13,
    },

    lockedText: {
      marginTop: -4,
      marginBottom: 10,
      color: theme.colors.danger,
      fontWeight: '900',
      fontSize: 13,
    },

    primaryButton: {
      backgroundColor: theme.colors.primary,
      paddingVertical: 14,
      borderRadius: r.button,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      marginTop: 6,
    },

    primaryButtonDisabled: {
      opacity: 0.65,
    },

    buttonText: {
      color: theme.colors.primaryText,
      fontWeight: '900',
      fontSize: 15,
    },

    forgotBtn: {
      marginTop: 14,
      alignSelf: 'center',
    },

    forgotText: {
      color: theme.colors.primary,
      fontWeight: '900',
      fontSize: 14,
    },

    switchBtn: {
      marginTop: 16,
      alignItems: 'center',
    },

    switchText: {
      color: theme.colors.text,
      fontWeight: '900',
    },

    switchTextDisabled: {
      color: theme.colors.mutedText,
    },
  });
}