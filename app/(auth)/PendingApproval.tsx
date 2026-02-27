import React, { useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Platform, Linking, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../src/lib/supabase';
import { useRouter } from 'expo-router';
import { useAppTheme } from '../../src/theme/ThemeProvider';

export default function PendingApprovalScreen() {
  const router = useRouter();
  const { theme } = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;

      // ✅ Force UI to leave this screen immediately
      router.replace('/(auth)/login');
    } catch (e: any) {
      Alert.alert('Sign out failed', e?.message || 'Please try again.');
    }
  };

  const handleContactSupport = async () => {
    // Change this address if you have one
    const supportEmail = 'support@nagaratharnexus.org';
    const subject = encodeURIComponent('Nagarathar Nexus — Pending Approval');
    const body = encodeURIComponent(
      'Hi Support,\n\nMy profile is pending approval. Can you help?\n\nThanks!',
    );

    const url = `mailto:${supportEmail}?subject=${subject}&body=${body}`;

    try {
      const canOpen = await Linking.canOpenURL(url);
      if (!canOpen) {
        Alert.alert('Contact Support', `Email not available on this device.\n\nPlease email: ${supportEmail}`);
        return;
      }
      await Linking.openURL(url);
    } catch {
      Alert.alert('Contact Support', `Please email: ${supportEmail}`);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.card}>
        <View style={styles.iconCircle}>
          <Ionicons name="time-outline" size={40} color={theme.colors.text} />
        </View>

        <Text style={styles.title}>Profile Under Review</Text>

        <Text style={styles.description}>
          Our community moderators are reviewing your biodata to ensure authenticity.
          You’ll be notified once your profile is active.
        </Text>

        <View style={styles.infoChip}>
          <Ionicons name="shield-checkmark-outline" size={16} color={theme.colors.mutedText} />
          <Text style={styles.infoChipText}>This usually completes within 24–48 hours</Text>
        </View>

        <TouchableOpacity style={styles.secondaryBtn} onPress={handleContactSupport} activeOpacity={0.8}>
          <Ionicons name="mail-outline" size={16} color={theme.colors.text} />
          <Text style={styles.secondaryBtnText}>Contact Support</Text>
        </TouchableOpacity>

        <TouchableOpacity onPress={handleSignOut} activeOpacity={0.7} style={styles.signOutBtn}>
          <Text style={styles.signOutLink}>Sign out</Text>
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
      padding: s.lg,
      alignItems: 'center',
      justifyContent: 'center',
    },

    card: {
      width: '100%',
      maxWidth: 520,
      backgroundColor: theme.colors.surface2,
      borderRadius: r.card,
      borderWidth: 1,
      borderColor: theme.colors.border,
      padding: 22,
      alignItems: 'center',
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
      borderWidth: 1,
      borderColor: theme.colors.border,
      justifyContent: 'center',
      alignItems: 'center',
      marginBottom: 14,
    },

    title: {
      fontSize: 22,
      fontWeight: '900',
      color: theme.colors.text,
      textAlign: 'center',
    },

    description: {
      marginTop: 10,
      fontSize: 14,
      color: theme.colors.mutedText,
      textAlign: 'center',
      lineHeight: 20,
      fontWeight: '600',
    },

    infoChip: {
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

    infoChipText: {
      fontSize: 12,
      fontWeight: '800',
      color: theme.colors.mutedText,
    },

    secondaryBtn: {
      marginTop: 18,
      width: '100%',
      height: 52,
      borderRadius: r.button,
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      flexDirection: 'row',
      gap: 10,
    },

    secondaryBtnText: {
      color: theme.colors.text,
      fontWeight: '900',
      fontSize: 14,
    },

    signOutBtn: {
      marginTop: 18,
      paddingVertical: 6,
      paddingHorizontal: 10,
      borderRadius: r.chip,
    },

    signOutLink: {
      color: theme.colors.danger,
      fontSize: 14,
      fontWeight: '900',
      textAlign: 'center',
    },
  });
}