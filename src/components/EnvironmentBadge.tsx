import React, { useEffect, useMemo, useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { getAppEnvLabel } from '@/src/lib/appEnv';
import { useAppTheme } from '@/src/theme/ThemeProvider';
import Constants from 'expo-constants'; // Added

function getProjectRef() {
  // Pull URL from Manifest instead of process.env
  const extra = Constants.expoConfig?.extra || {};
  const url = extra.supabaseUrl || '';

  try {
    const host = new URL(url).hostname;
    return host.split('.')[0] || 'unknown-project';
  } catch {
    return 'unknown-project';
  }
}

function formatNow(date: Date) {
  return date.toLocaleString([], {
    month: 'short',
    day: '2-digit',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function EnvironmentBadge() {
  const { theme } = useAppTheme();
  
  // Memoize labels based on the dynamic Manifest
  const label = useMemo(() => getAppEnvLabel(), []);
  const projectRef = useMemo(() => getProjectRef(), []);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => {
      setNow(new Date());
    }, 30_000);
    return () => clearInterval(timer);
  }, []);

  if (Platform.OS !== 'web') return null;

  const muted = theme.colors.mutedText;

  return (
    <View
      pointerEvents="none"
      style={[
        styles.wrap,
        {
          backgroundColor: theme.colors.surface2,
          borderColor: theme.colors.border,
          shadowColor: theme.colors.shadow,
        },
      ]}
    >
      <Text style={[styles.item, { color: theme.colors.text, fontWeight: '800' }]}>
        {label}
      </Text>
      <Text style={[styles.sep, { color: muted }]}>|</Text>
      <Text style={[styles.item, { color: muted }]}>{projectRef}</Text>
      <Text style={[styles.sep, { color: muted }]}>|</Text>
      <Text style={[styles.item, { color: muted }]}>{formatNow(now)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'fixed' as any,
    bottom: 12,
    right: 12,
    zIndex: 99999,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    shadowOpacity: 0.08,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  item: { fontSize: 11, lineHeight: 14 },
  sep: { fontSize: 11, marginHorizontal: 8, lineHeight: 14, fontWeight: '700' },
});