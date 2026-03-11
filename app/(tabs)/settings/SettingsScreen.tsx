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
import SignOutButton from '@/src/components/SignOutButton';

type SettingField = 'hide_phone' | 'hide_email' | 'account_status';

export default function SettingsScreen() {
  const { theme, themeName, setThemeName, availableThemes } = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);
  const router = useRouter();

  const [loading, setLoading] = useState(true);
  const [hidePhone, setHidePhone] = useState(true);
  const [hideEmail, setHideEmail] = useState(true);
  const [isProfileActive, setIsProfileActive] = useState(true);
  const [savingKey, setSavingKey] = useState<SettingField | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('profiles')
        .select('hide_phone, hide_email, account_status')
        .eq('id', user.id)
        .single();

      if (error) throw error;

      if (data) {
        setHidePhone(!!data.hide_phone);
        setHideEmail(!!data.hide_email);
        setIsProfileActive((data.account_status ?? 'ACTIVE') === 'ACTIVE');
      }
    } catch (e: any) {
      Alert.alert('Unable to load settings', e?.message ?? 'Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const updateBooleanSetting = async (field: 'hide_phone' | 'hide_email', value: boolean) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

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
      if (field === 'hide_phone') setHidePhone(prev);
      else setHideEmail(prev);

      Alert.alert('Update failed', e?.message ?? 'Please try again.');
    } finally {
      setSavingKey(null);
    }
  };

  const updateAccountStatus = async (nextActive: boolean) => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const nextStatus = nextActive ? 'ACTIVE' : 'INACTIVE';
    const prev = isProfileActive;

    setIsProfileActive(nextActive);
    setSavingKey('account_status');

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ account_status: nextStatus })
        .eq('id', user.id);

      if (error) throw error;
    } catch (e: any) {
      setIsProfileActive(prev);
      Alert.alert('Update failed', e?.message ?? 'Please try again.');
    } finally {
      setSavingKey(null);
    }
  };

  const handleToggleProfileActive = (value: boolean) => {
    const title = value ? 'Make profile active?' : 'Make profile inactive?';
    const message = value
      ? 'Your profile will appear in search and match discovery again.'
      : 'Your profile will be hidden from search and match discovery until you turn it back on.';

    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Confirm',
        onPress: () => updateAccountStatus(value),
      },
    ]);
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
              <Text
                style={[
                  styles.themeChipText,
                  active ? styles.themeChipTextActive : styles.themeChipTextIdle,
                ]}
              >
                {String(t).toUpperCase()}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );

  const SettingsNavRow = ({
    icon,
    title,
    subtitle,
    onPress,
  }: {
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    subtitle: string;
    onPress: () => void;
  }) => (
    <TouchableOpacity style={styles.rowPressable} onPress={onPress} activeOpacity={0.9}>
      <View style={styles.rowLeft}>
        <View style={[styles.iconPill, { backgroundColor: `${tint}18` }]}>
          <Ionicons name={icon} size={16} color={tint} />
        </View>
        <View style={styles.rowText}>
          <Text style={styles.rowTitle}>{title}</Text>
          <Text style={styles.rowSub}>{subtitle}</Text>
        </View>
      </View>

      <Ionicons name="chevron-forward" size={18} color={theme.colors.mutedText} />
    </TouchableOpacity>
  );

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
        <Text style={styles.subtitle}>Privacy, visibility, theme, and account controls</Text>
      </View>

      <ThemePicker />

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Privacy & Visibility</Text>

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
                  updateBooleanSetting('hide_phone', val);
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
                  updateBooleanSetting('hide_email', val);
                }}
              />
            )}
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.row}>
          <View style={styles.rowLeft}>
            <View style={[styles.iconPill, { backgroundColor: `${tint}18` }]}>
              <Ionicons name="eye-outline" size={16} color={tint} />
            </View>
            <View style={styles.rowText}>
              <Text style={styles.rowTitle}>Profile active</Text>
              <Text style={styles.rowSub}>
                When off, your profile is hidden from search and match discovery.
              </Text>
            </View>
          </View>

          <View style={styles.rowRight}>
            {savingKey === 'account_status' ? (
              <ActivityIndicator size="small" color={tint} />
            ) : (
              <Switch
                value={isProfileActive}
                onValueChange={handleToggleProfileActive}
              />
            )}
          </View>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Help & Legal</Text>

        <SettingsNavRow
          icon="information-circle-outline"
          title="About"
          subtitle="Learn more about Nagarathar Nexus."
          onPress={() => router.push('/about')}
        />

        <View style={styles.divider} />

        <SettingsNavRow
          icon="document-text-outline"
          title="Terms & Conditions"
          subtitle="Rules, responsibilities, and membership terms."
          onPress={() => router.push('/legal/terms')}
        />

        <View style={styles.divider} />

        <SettingsNavRow
          icon="shield-checkmark-outline"
          title="Privacy Policy"
          subtitle="How your profile and personal data are handled."
          onPress={() => router.push('/legal/privacy')}
        />
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Account</Text>
        <SignOutButton variant="solid" label="SIGN OUT" />
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

    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },

    rowPressable: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      minHeight: 52,
    },

    rowLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
      gap: 12,
    },

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

    divider: {
      height: 1,
      backgroundColor: theme.colors.border,
      marginVertical: 14,
    },

    themeChipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10 as any,
      marginTop: 12,
    },
    themeChip: {
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderRadius: 999,
      borderWidth: 1,
    },
    themeChipIdle: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.border,
    },
    themeChipActive: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    themeChipText: { fontSize: 12, fontWeight: '900' },
    themeChipTextIdle: { color: theme.colors.text },
    themeChipTextActive: { color: theme.colors.primaryText },

    center: {
      flex: 1,
      justifyContent: 'center',
      alignItems: 'center',
    },
  });
}