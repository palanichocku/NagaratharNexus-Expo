// app/(tabs)/settings/SettingsScreen.tsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Switch,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
  ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '@/src/lib/supabase';
import { useRouter } from 'expo-router';
import { useAppTheme } from '@/src/theme/ThemeProvider';

export default function SettingsScreen() {
  const { theme, themeName, setThemeName, availableThemes } = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [hidePhone, setHidePhone] = useState(true);
  const [hideEmail, setHideEmail] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from('profiles')
      .select('hide_phone, hide_email')
      .eq('id', user.id)
      .single();

    if (data) {
      setHidePhone(!!data.hide_phone);
      setHideEmail(!!data.hide_email);
    }

    setLoading(false);
  };

  const updateSetting = async (field: 'hide_phone' | 'hide_email', value: boolean) => {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  setSavingKey(field);

  const prev = field === 'hide_phone' ? hidePhone : hideEmail;

  try {
    const { error } = await supabase
      .from('profiles')
      .update({ [field]: value })
      .eq('id', user.id);

    if (error) throw error;
  } catch (e: any) {
    // rollback UI
    if (field === 'hide_phone') setHidePhone(prev);
    else setHideEmail(prev);

    Alert.alert('Update failed', e?.message ?? 'Please try again.');
  } finally {
    setSavingKey(null);
  }
};

  const handleLogout = async () => {
    await supabase.auth.signOut();
    router.replace('/(auth)/login');
  };

  const handleDeactivate = async () => {
    Alert.alert(
      'Make Account Inactive',
      'Your profile will no longer appear in search. Continue?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          style: 'destructive',
          onPress: async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            await supabase
              .from('profiles')
              .update({ account_status: 'INACTIVE' })
              .eq('id', user.id);

            await supabase.auth.signOut();
            router.replace('/(auth)/login');
          },
        },
      ],
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  const tint = (theme.colors as any).tint ?? theme.colors.primary;

  const ThemePicker = () => (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>Appearance</Text>

      <View style={styles.row}>
        <View style={styles.rowLeft}>
          <View style={[styles.iconPill, { backgroundColor: `${tint}18` }]}>
            <Ionicons name="color-palette-outline" size={16} color={tint} />
          </View>
          <View style={styles.rowText}>
            <Text style={styles.rowTitle}>Theme</Text>
            <Text style={styles.rowSub}>
              Choose Warm or Cool. Your choice overrides the global default on this device.
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.themeChipRow}>
        {availableThemes.map((t) => {
          const active = t === themeName;
          return (
            <TouchableOpacity
              key={t}
              accessibilityRole="button"
              onPress={() => setThemeName(t)}
              activeOpacity={0.9}
              style={[styles.themeChip, active ? styles.themeChipActive : styles.themeChipIdle]}
            >
              <Text style={[styles.themeChipText, active ? styles.themeChipTextActive : styles.themeChipTextIdle]}>
                {String(t).toUpperCase()}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.subtitle}>Privacy, theme, and account controls</Text>
      </View>

      {/* ✅ NEW: Theme override for user */}
      <ThemePicker />

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Privacy</Text>

        <View style={styles.row}>
          <View style={styles.rowLeft}>
            <View style={[styles.iconPill, { backgroundColor: `${tint}18` }]}>
              <Ionicons name="call-outline" size={16} color={tint} />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>Hide phone number</Text>
              <Text style={styles.rowSub}>Show phone only if you choose to share later.</Text>
            </View>
          </View>

          <View style={styles.rowRight}>
            {savingKey === 'hide_phone' ? (
              <ActivityIndicator size="small" color={tint} />
            ) : (
              <Switch
                value={hidePhone}
                onValueChange={(val) => {
                  setHidePhone(val);
                  updateSetting('hide_phone', val);
                }}
              />
            )}
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.row}>
          <View style={styles.rowLeft}>
            <View style={[styles.iconPill, { backgroundColor: `${tint}18` }]}>
              <Ionicons name="mail-outline" size={16} color={tint} />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>Hide email address</Text>
              <Text style={styles.rowSub}>Keep your email private to other members.</Text>
            </View>
          </View>

          <View style={styles.rowRight}>
            {savingKey === 'hide_email' ? (
              <ActivityIndicator size="small" color={tint} />
            ) : (
              <Switch
                value={hideEmail}
                onValueChange={(val) => {
                  setHideEmail(val);
                  updateSetting('hide_email', val);
                }}
              />
            )}
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Account</Text>

        <TouchableOpacity style={styles.actionBtn} onPress={handleLogout} activeOpacity={0.9}>
          <Ionicons name="log-out-outline" size={18} color={theme.colors.text} />
          <Text style={styles.actionText}>Log out</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.actionBtn, styles.dangerBtn]}
          onPress={handleDeactivate}
          activeOpacity={0.9}
        >
          <Ionicons name="pause-circle-outline" size={18} color={theme.colors.danger} />
          <Text style={[styles.actionText, { color: theme.colors.danger }]}>Make account inactive</Text>
        </TouchableOpacity>

        <Text style={styles.helper}>
          Inactive accounts are hidden from search. You can re-enable later (we’ll add this soon).
        </Text>
      </View>

      {Platform.OS === 'web' ? <View style={{ height: 24 }} /> : null}
    </ScrollView>
  );
}

function makeStyles(theme: any) {
  const r = theme.radius;
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: theme.colors.bg },
    content: { padding: 22, paddingBottom: 34 },

    header: { marginBottom: 16 },
    title: { fontSize: 28, fontWeight: '900', color: theme.colors.text },
    subtitle: { marginTop: 6, fontSize: 14, fontWeight: '600', color: theme.colors.mutedText },

    card: {
      backgroundColor: theme.colors.surface2,
      borderWidth: 1,
      borderColor: theme.colors.border,
      borderRadius: r?.card ?? 18,
      padding: 16,
      marginTop: 14,
    },

    cardTitle: {
      fontSize: 12,
      fontWeight: '900',
      color: theme.colors.mutedText,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
      marginBottom: 10,
    },

    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    rowLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 },
    rowText: { flex: 1 },
    rowTitle: { fontSize: 15, fontWeight: '800', color: theme.colors.text },
    rowSub: { marginTop: 2, fontSize: 12, fontWeight: '600', color: theme.colors.mutedText },
    rowRight: { marginLeft: 12 },

    iconPill: {
      width: 34,
      height: 34,
      borderRadius: 12,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },

    divider: { height: 1, backgroundColor: theme.colors.border, marginVertical: 14 },

    // ✅ Theme chips
    themeChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 as any, marginTop: 12 },
    themeChip: { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 999, borderWidth: 1 },
    themeChipIdle: { backgroundColor: theme.colors.surface, borderColor: theme.colors.border },
    themeChipActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
    themeChipText: { fontSize: 12, fontWeight: '900' },
    themeChipTextIdle: { color: theme.colors.text },
    themeChipTextActive: { color: theme.colors.primaryText },

    actionBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 12,
      paddingHorizontal: 12,
      borderRadius: r?.button ?? 14,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
      marginTop: 10,
    },
    dangerBtn: {
      backgroundColor: theme.colors.bg,
      borderColor: theme.colors.border,
    },
    actionText: { fontSize: 15, fontWeight: '800', color: theme.colors.text },

    helper: {
      marginTop: 12,
      fontSize: 12,
      fontWeight: '600',
      color: theme.colors.mutedText,
      lineHeight: 18,
    },

    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  });
}