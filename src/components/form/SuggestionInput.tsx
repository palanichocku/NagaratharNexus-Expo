import React, { useMemo } from 'react';
import { View, TextInput, TouchableOpacity, Text, StyleSheet } from 'react-native';

type SuggestionItem =
  | string
  | {
      label: string;
      value: string;
    };

type Props = {
  value: string;
  onChange: (value: string) => void;
  suggestions?: SuggestionItem[];
  placeholder?: string;
  theme: any;
  maxSuggestions?: number;
  multiline?: boolean;
};

function normalizeSuggestion(item: SuggestionItem) {
  if (typeof item === 'string') {
    return { label: item, value: item };
  }
  return {
    label: String(item?.label ?? item?.value ?? ''),
    value: String(item?.value ?? item?.label ?? ''),
  };
}

export default function SuggestionInput({
  value,
  onChange,
  suggestions = [],
  placeholder,
  theme,
  maxSuggestions = 12,
  multiline = false,
}: Props) {
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const normalized = useMemo(
    () => suggestions.map(normalizeSuggestion).filter((s) => s.value.trim().length > 0),
    [suggestions],
  );

  const filtered = useMemo(() => {
    const q = String(value || '').trim().toLowerCase();

    const items = normalized.filter((item) => {
      if (!q) return true;
      return (
        item.label.toLowerCase().includes(q) ||
        item.value.toLowerCase().includes(q)
      );
    });

    return items.slice(0, maxSuggestions);
  }, [normalized, value, maxSuggestions]);

  return (
    <View>
      <TextInput
        style={[styles.input, multiline && styles.inputMultiline]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={theme.colors.mutedText}
        multiline={multiline}
      />

      {filtered.length > 0 && (
        <View style={styles.pillsWrap}>
          {filtered.map((item) => {
            const selected = String(value || '').trim() === item.value;
            return (
              <TouchableOpacity
                key={item.value}
                onPress={() => onChange(item.value)}
                style={[styles.pill, selected && styles.pillSelected]}
                activeOpacity={0.85}
              >
                <Text style={[styles.pillText, selected && styles.pillTextSelected]}>
                  {item.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      )}
    </View>
  );
}

function makeStyles(theme: any) {
  return StyleSheet.create({
    input: {
      minHeight: 46,
      borderRadius: theme.radius?.input ?? 12,
      borderWidth: 1,
      borderColor: theme.colors.border,
      paddingHorizontal: 12,
      fontSize: 14,
      color: theme.colors.text,
      backgroundColor: theme.colors.inputBg,
      fontWeight: '700',
    },

    inputMultiline: {
      minHeight: 100,
      textAlignVertical: 'top',
      paddingTop: 12,
    },

    pillsWrap: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 6,
      marginTop: 8,
    },

    pill: {
      paddingVertical: 8,
      paddingHorizontal: 12,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.surface,
    },

    pillSelected: {
      borderColor: theme.colors.primary,
    },

    pillText: {
      fontSize: 11,
      fontWeight: '700',
      color: theme.colors.text,
    },

    pillTextSelected: {
      color: theme.colors.text,
    },
  });
}