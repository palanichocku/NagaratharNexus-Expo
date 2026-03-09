// src/components/SignOutButton.tsx
import React, { useMemo } from 'react';
import { Platform, StyleSheet, Text, TouchableOpacity, ViewStyle, StyleProp } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '@/src/theme/ThemeProvider';
import { useSignOut } from '@/src/features/auth/useSignOut';

type Variant = 'header' | 'solid' | 'row';

type Props = {
  variant?: Variant;
  redirectTo?: string;
  onBeforeSignOut?: () => void | Promise<void>;
  label?: string;
  style?: StyleProp<ViewStyle>;
};

export default function SignOutButton({
  variant = 'header',
  redirectTo = '/login',
  onBeforeSignOut,
  label = 'SIGN OUT',
  style,
}: Props) {
  const { theme } = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const { signOut, isSigningOut } = useSignOut({ redirectTo, onBeforeSignOut });

  const surface2 = theme?.colors?.surface2 ?? '#FFFFFF';
  const danger = theme?.colors?.danger ?? '#B42318';

  const iconColor = variant === 'solid' ? surface2 : danger;
  const textColor = variant === 'solid' ? surface2 : danger;

  const buttonStyle =
    variant === 'solid' ? styles.solidBtn : variant === 'row' ? styles.rowBtn : styles.headerBtn;

  const webCursor = Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : undefined;

  return (
    <TouchableOpacity
      onPress={signOut}
      disabled={isSigningOut}
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      style={[
        buttonStyle,
        isSigningOut ? styles.disabled : undefined,
        webCursor,
        style,
      ]}
    >
      {variant !== 'header' && (
        <Ionicons name="log-out-outline" size={18} color={iconColor} style={{ marginRight: 8 }} />
      )}

      <Text style={[styles.textBase, { color: textColor }]}>
        {isSigningOut ? 'SIGNING OUT…' : label}
      </Text>
    </TouchableOpacity>
  );
}

function makeStyles(theme: any) {
  const danger = theme?.colors?.danger ?? '#B42318';
  const primary = theme?.colors?.primary ?? '#7B1E3A';

  return StyleSheet.create({
    textBase: {
      fontWeight: '800',
      fontSize: 12,
      letterSpacing: 0.3,
    },
    disabled: {
      opacity: 0.6,
    },

    headerBtn: {
      paddingHorizontal: 12,
      paddingVertical: 8,
      borderWidth: 1,
      borderColor: danger,
      borderRadius: 10,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
    },

    solidBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: primary,
      paddingVertical: 14,
      paddingHorizontal: 16,
      borderRadius: 14,
    },

    rowBtn: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: 14,
      borderWidth: 1,
      borderColor: danger,
      paddingVertical: 12,
      paddingHorizontal: 14,
      backgroundColor: 'transparent',
    },
  });
}