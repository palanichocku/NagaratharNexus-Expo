import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function StatusBanner({
  theme,
  tone = 'info',
  text,
}: {
  theme: any;
  tone?: 'info' | 'success' | 'error' | 'warning';
  text: string;
}) {
  const styles = makeStyles(theme, tone);

  return (
    <View style={styles.box}>
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

function makeStyles(theme: any, tone: string) {
  const borderColor =
    tone === 'success'
      ? theme.colors.success ?? theme.colors.primary
      : tone === 'error'
        ? theme.colors.danger
        : tone === 'warning'
          ? theme.colors.primary
          : theme.colors.border;

  return StyleSheet.create({
    box: {
      width: '100%',
      backgroundColor: theme.colors.surface,
      borderColor,
      borderWidth: 1,
      borderRadius: theme.radius.button,
      paddingHorizontal: 12,
      paddingVertical: 10,
      marginBottom: 12,
    },
    text: {
      textAlign: 'center',
      color: theme.colors.text,
      fontWeight: '800',
      fontSize: 12,
    },
  });
}