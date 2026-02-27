// src/app/(auth)/login.tsx
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Platform,
  Pressable,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { supabase } from '../../src/lib/supabase';
import { REDIRECT_URL } from '../../src/lib/supabase';
import { useAppTheme } from '../../src/theme/ThemeProvider';

export default function LoginScreen() {
  const router = useRouter();
  const { theme } = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showInviteModal, setShowInviteModal] = useState(false);

  const handleEmailAuth = async () => {
    if (!email || !password) return;
    setLoading(true);

    try {
      if (isSignUp) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName },
            emailRedirectTo: `${REDIRECT_URL}/Onboarding`,
          },
        });

        if (error) throw error;

        if (data?.user) {
          router.push({
            pathname: '/(auth)/VerifyEmail',
            params: { email },
          });
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) {
          if (error.message.toLowerCase().includes('invalid login credentials')) {
            setShowInviteModal(true);
            return;
          }
          throw error;
        }
        // Layout handles navigation after auth
      }
    } catch (error: any) {
      Alert.alert('Authentication Error', error.message);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    const redirectTo =
      Platform.OS === 'web'
        ? window.location.origin
        : REDIRECT_URL; // ✅ avoids window crash on native

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    });

    if (error) Alert.alert('Google Login Error', error.message);
  };

  const handleForgotPassword = async () => {
    if (!email) return Alert.alert('Email Required', 'Enter your email first.');
    const { error } = await supabase.auth.resetPasswordForEmail(email);
    if (error) Alert.alert('Error', error.message);
    else Alert.alert('Sent', 'Check your email for the reset link.');
  };

  const primaryLabel = isSignUp ? 'Create Account' : 'Sign In';
  const switchLabel = isSignUp
    ? 'Already have an account? Sign In'
    : 'New member? Create an account';

  return (
    <View style={styles.container}>
      {/* --- JOIN COMMUNITY MODAL --- */}
      <Modal
        animationType="fade"
        transparent
        visible={showInviteModal}
        onRequestClose={() => setShowInviteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalIconContainer}>
              <Ionicons name="heart" size={36} color={theme.colors.primary} />
            </View>

            <Text style={styles.modalTitle}>Welcome to the Nagarathar Nexus!</Text>
            <Text style={styles.modalDescription}>
              We couldn’t find an account for{' '}
              <Text style={styles.modalEmailStrong}>{email}</Text>. Would you like to join our
              respectful matchmaking community?
            </Text>

            <TouchableOpacity
              style={styles.modalJoinBtn}
              onPress={() => {
                setShowInviteModal(false);
                setIsSignUp(true);
              }}
            >
              <Text style={styles.modalJoinText}>Yes, Join Now</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.modalCloseBtn}
              onPress={() => setShowInviteModal(false)}
            >
              <Text style={styles.modalCloseText}>Maybe Later</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

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
          <Pressable onPress={handleGoogleLogin} disabled={loading} style={styles.socialButton}>
            <Ionicons name="logo-google" size={20} color={theme.colors.danger} />
            <Text style={styles.socialText}>Continue with Google</Text>
            <View style={{ width: 20 }} />
          </Pressable>

          <View style={styles.divider}>
            <View style={styles.line} />
            <Text style={styles.or}>OR</Text>
            <View style={styles.line} />
          </View>

          {isSignUp && (
            <View style={[styles.inputShell, fullName ? styles.inputShellActive : null]}>
              <Ionicons name="person-outline" size={18} color={theme.colors.mutedText} />
              <TextInput
                style={styles.input}
                placeholder="Full Name"
                placeholderTextColor={theme.colors.mutedText}
                value={fullName}
                onChangeText={setFullName}
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
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
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
            />
            <Pressable onPress={() => setShowPassword((p) => !p)} style={styles.eyeBtn}>
              <Ionicons
                name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                size={18}
                color={theme.colors.mutedText}
              />
            </Pressable>
          </View>

          <TouchableOpacity
            style={[styles.primaryButton, loading && { opacity: 0.65 }]}
            onPress={handleEmailAuth}
            disabled={loading}
          >
            {loading ? (
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

          {!isSignUp && (
            <TouchableOpacity onPress={handleForgotPassword} style={styles.forgotBtn} disabled={loading}>
              <Text style={styles.forgotText}>Forgot Password?</Text>
            </TouchableOpacity>
          )}

          <TouchableOpacity
            onPress={() => setIsSignUp((v) => !v)}
            style={styles.switchBtn}
            disabled={loading}
          >
            <Text style={styles.switchText}>{switchLabel}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

function makeStyles(theme: any) {
  const s = theme.spacing;
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

    title: { fontSize: 30, fontWeight: '900', textAlign: 'center', color: theme.colors.text },

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
    trustText: { color: theme.colors.mutedText, fontWeight: '800', fontSize: 12 },

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
    socialText: { fontWeight: '800', color: theme.colors.text, fontSize: 14 },

    divider: { flexDirection: 'row', alignItems: 'center', marginVertical: 16 },
    line: { flex: 1, height: 1, backgroundColor: theme.colors.border },
    or: {
      marginHorizontal: 10,
      color: theme.colors.mutedText,
      fontSize: 12,
      fontWeight: '900',
      letterSpacing: 1,
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

    eyeBtn: { paddingHorizontal: 8, paddingVertical: 6, borderRadius: 10 },

    primaryButton: {
      backgroundColor: theme.colors.primary,
      paddingVertical: 14,
      borderRadius: r.button,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      marginTop: 6,
    },
    buttonText: { color: theme.colors.primaryText, fontWeight: '900', fontSize: 15 },

    forgotBtn: { marginTop: 14, alignSelf: 'center' },
    forgotText: { color: theme.colors.primary, fontWeight: '900', fontSize: 14 },

    switchBtn: { marginTop: 16, alignItems: 'center' },
    switchText: { color: theme.colors.text, fontWeight: '900' },

    // Modal
    modalOverlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    modalContent: {
      width: '100%',
      maxWidth: 400,
      backgroundColor: theme.colors.surface2,
      borderRadius: r.card,
      padding: 26,
      alignItems: 'center',
      borderWidth: 1,
      borderColor: theme.colors.border,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.1,
      shadowRadius: 20,
      elevation: 5,
    },
    modalIconContainer: {
      width: 76,
      height: 76,
      borderRadius: 38,
      backgroundColor: theme.colors.surface,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 18,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    modalTitle: {
      fontSize: 20,
      fontWeight: '900',
      color: theme.colors.text,
      marginBottom: 10,
      textAlign: 'center',
    },
    modalDescription: {
      fontSize: 14,
      color: theme.colors.mutedText,
      textAlign: 'center',
      lineHeight: 20,
      marginBottom: 18,
      fontWeight: '600',
    },
    modalEmailStrong: {
      color: theme.colors.text,
      fontWeight: '900',
    },
    modalJoinBtn: {
      width: '100%',
      height: 52,
      backgroundColor: theme.colors.primary,
      borderRadius: r.button,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 10,
    },
    modalJoinText: {
      color: theme.colors.primaryText,
      fontSize: 15,
      fontWeight: '900',
    },
    modalCloseBtn: { padding: 10 },
    modalCloseText: {
      color: theme.colors.mutedText,
      fontSize: 14,
      fontWeight: '800',
    },
  });
}