import { useAppTheme } from '@/src/theme/ThemeProvider';
import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { Animated, StyleSheet, Text } from 'react-native';

type ToastTone = 'success' | 'info' | 'error';

type ToastContextType = {
  show: (message: string, tone?: ToastTone) => void;
};

const ToastContext = createContext<ToastContextType | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const { theme } = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const [message, setMessage] = useState('');
  const [visible, setVisible] = useState(false);
  const [tone, setTone] = useState<ToastTone>('info');
  const opacity = useRef(new Animated.Value(0)).current;

  const show = useCallback((msg: string, nextTone: ToastTone = 'info') => {
    setMessage(msg);
    setTone(nextTone);
    setVisible(true);

    Animated.sequence([
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.delay(2200),
      Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(() => {
      setVisible(false);
      setMessage('');
    });
  }, [opacity]);

  const value = useMemo(() => ({ show }), [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      {visible && (
        <Animated.View
          pointerEvents="none"
          style={[
            styles.wrap,
            tone === 'success' ? styles.success : tone === 'error' ? styles.error : styles.info,
            { opacity },
          ]}
        >
          <Text style={styles.text}>{message}</Text>
        </Animated.View>
      )}
    </ToastContext.Provider>
  );
}

export function useToastContext() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToastContext must be used within ToastProvider');
  return ctx;
}

function makeStyles(theme: any) {
  return StyleSheet.create({
    wrap: {
      position: 'absolute',
      bottom: 24,
      alignSelf: 'center',
      maxWidth: 420,
      marginHorizontal: 16,
      paddingHorizontal: 16,
      paddingVertical: 12,
      borderRadius: theme.radius.button,
      borderWidth: 1,
    },
    success: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.success ?? theme.colors.primary,
    },
    error: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.danger,
    },
    info: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.border,
    },
    text: {
      color: theme.colors.text,
      fontWeight: '800',
      textAlign: 'center',
    },
  });
}