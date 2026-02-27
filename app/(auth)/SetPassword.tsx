// app/(auth)/SetPassword.tsx
import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { supabase } from '../../src/lib/supabase';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '../../src/theme/ThemeProvider';

export default function SetPasswordScreen() {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const { theme } = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const handleUpdatePassword = async () => {
    if (!password || password !== confirmPassword) {
      const msg = 'Passwords do not match!';
      Platform.OS === 'web' ? alert(msg) : Alert.alert('Error', msg);
      return;
    }

    setLoading(true);

    // 🚀 1. SESSION RECOVERY: Ensure the deep-link session is active
    let {
      data: { session },
    } = await supabase.auth.getSession();

    if (!session) {
      // eslint-disable-next-line no-console
      console.log('Waiting for session to hydrate...');
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const retry = await supabase.auth.getSession();
      session = retry.data.session;

      if (!session) {
        const msg = 'Auth session missing! Please click the link in your email again.';
        Platform.OS === 'web' ? alert(msg) : Alert.alert('Session Error', msg);
        setLoading(false);
        return;
      }
    }

    // 🚀 2. PASSWORD UPDATE
    const { data, error: authError } = await supabase.auth.updateUser({
      password: password,
    });

    if (authError || !data.user) {
      const msg = authError?.message || 'Link expired.';
      Platform.OS === 'web' ? alert(msg) : Alert.alert('Error', msg);
      setLoading(false);
      return;
    }

    const user = data.user;

    // 🚀 3. PROFILE SYNC (New Architecture)
    // We only update display info here. The 'user_roles' table was
    // already populated by the DB trigger upon user creation.
    const { error: dbError } = await supabase.from('profiles').upsert({
      id: user.id,
      email: user.email,
      full_name: user.user_metadata.full_name || 'Staff Member',
      is_approved: true, // Staff are auto-approved
      is_submitted: true,
      updated_at: new Date().toISOString(),
    });

    if (dbError) {
      // eslint-disable-next-line no-console
      console.error('Profile sync failed:', dbError.message);
      // We don't block progress here because the password IS set
    }

    const successMsg = 'Success! Your account is ready.';
    Platform.OS === 'web' ? alert(successMsg) : Alert.alert('Ready', successMsg);

    // 🎯 Use the clean path fixed in RootLayout
    router.replace('/AdminDashboard');
    setLoading(false);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.container}
    >
      <View style={styles.card}>
        <View style={styles.iconCircle}>
          <Ionicons name="lock-closed" size={32} color={theme.colors.text} />
        </View>

        <Text style={styles.title}>Set Your Password</Text>
        <Text style={styles.subtitle}>
          Create a permanent password to access your Admin Workspace.
        </Text>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>NEW PASSWORD</Text>
          <View style={styles.inputShell}>
            <Ionicons name="key-outline" size={18} color={theme.colors.mutedText} />
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor={theme.colors.mutedText}
              secureTextEntry
              autoCapitalize="none"
              value={password}
              onChangeText={setPassword}
            />
          </View>
        </View>

        <View style={styles.inputGroup}>
          <Text style={styles.label}>CONFIRM PASSWORD</Text>
          <View style={styles.inputShell}>
            <Ionicons name="checkmark-circle-outline" size={18} color={theme.colors.mutedText} />
            <TextInput
              style={styles.input}
              placeholder="••••••••"
              placeholderTextColor={theme.colors.mutedText}
              secureTextEntry
              autoCapitalize="none"
              value={confirmPassword}
              onChangeText={setConfirmPassword}
            />
          </View>
        </View>

        <TouchableOpacity
          style={[styles.btn, loading && styles.btnDisabled]}
          onPress={handleUpdatePassword}
          disabled={loading}
          activeOpacity={0.85}
        >
          {loading ? (
            <ActivityIndicator color={theme.colors.primaryText} />
          ) : (
            <>
              <Text style={styles.btnText}>Finish Setup</Text>
              <Ionicons
                name="arrow-forward"
                size={18}
                color={theme.colors.primaryText}
                style={{ marginLeft: 10 }}
              />
            </>
          )}
        </TouchableOpacity>

        <View style={styles.trustRow}>
          <Ionicons name="shield-checkmark-outline" size={16} color={theme.colors.mutedText} />
          <Text style={styles.trustText}>Secure setup • Password stored by Supabase Auth</Text>
        </View>
      </View>
    </KeyboardAvoidingView>
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
        ? ({ boxShadow: '0 20px 25px -5px rgba(0,0,0,0.10), 0 10px 10px -5px rgba(0,0,0,0.04)' } as any)
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