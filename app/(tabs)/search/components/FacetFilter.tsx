// ./app/(tabs)/search/components/FacetFilter.tsx
import React, { memo, useMemo, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useAppTheme } from '../../../../src/theme/ThemeProvider';

interface FacetProps {
  label?: string;
  options: string[];
  selectedValues: string[];
  onToggle: (value: string) => void;
  loading?: boolean;
}

const Chip = memo(function Chip({
  value,
  active,
  onToggle,
  styles,
}: {
  value: string;
  active: boolean;
  onToggle: (v: string) => void;
  styles: any;
}) {
  const handlePress = useCallback(() => onToggle(value), [onToggle, value]);

  return (
    <TouchableOpacity onPress={handlePress} style={[styles.chip, active ? styles.chipActive : styles.chipIdle]}>
      <Text style={[styles.chipText, active ? styles.chipTextActive : styles.chipTextIdle]}>{value}</Text>
    </TouchableOpacity>
  );
});

// 🚀 Snappy: memo + Set lookup avoids O(n) selected checks for every option.
export default function FacetFilter({ label, options, selectedValues, onToggle, loading }: FacetProps) {
  const { theme } = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  if (loading) return <Text style={styles.loadingText}>Loading...</Text>;
  if (!options || options.length === 0) return null;

  const selectedSet = useMemo(() => new Set(selectedValues || []), [selectedValues]);

  return (
    <View style={styles.section}>
      {label ? <Text style={styles.sectionLabel}>{label}</Text> : null}

      <View style={styles.chipGrid}>
        {options.map((option) => (
          <Chip key={option} value={option} active={selectedSet.has(option)} onToggle={onToggle} styles={styles} />
        ))}
      </View>
    </View>
  );
}

function makeStyles(theme: any) {
  const c = theme.colors;

  return StyleSheet.create({
    section: { paddingVertical: 5 },
    sectionLabel: {
      fontSize: 11,
      fontWeight: '900',
      color: c.mutedText,
      textTransform: 'uppercase',
      marginBottom: 10,
    },

    chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 as any },

    chip: {
      paddingHorizontal: 12,
      paddingVertical: 9,
      borderRadius: 999,
      borderWidth: 1,
      ...Platform.select({
        android: { minHeight: 36 },
        default: {},
      }),
    },

    chipIdle: {
      borderColor: c.border,
      backgroundColor: c.inputBg ?? c.surface,
    },

    chipActive: {
      borderColor: c.primary,
      backgroundColor: c.primary,
    },

    chipText: { fontSize: 12, fontWeight: '900' },
    chipTextIdle: { color: c.text },
    chipTextActive: { color: c.primaryText ?? '#fff' },

    loadingText: {
      fontSize: 12,
      color: c.mutedText,
      fontStyle: 'italic',
      paddingVertical: 10,
    },
  });
}