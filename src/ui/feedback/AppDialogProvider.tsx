import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAppTheme } from '@/src/theme/ThemeProvider';

type DialogAction = {
  label: string;
  variant?: 'primary' | 'secondary' | 'danger';
  onPress?: () => void | Promise<void>;
};

export type DialogOptions = {
  title: string;
  message: string;
  tone?: 'info' | 'success' | 'warning' | 'error';
  actions?: DialogAction[];
};

type DialogContextType = {
  show: (options: DialogOptions) => void;
  hide: () => void;
};

const DialogContext = createContext<DialogContextType | null>(null);

// ✅ Bridge for non-hook callers like notify()
let dialogBridge:
  | {
      show: (options: DialogOptions) => void;
      hide: () => void;
    }
  | null = null;

export function showGlobalDialog(options: DialogOptions) {
  if (dialogBridge) {
    dialogBridge.show(options);
    return true;
  }
  return false;
}

export function hideGlobalDialog() {
  if (dialogBridge) {
    dialogBridge.hide();
    return true;
  }
  return false;
}

export function AppDialogProvider({ children }: { children: React.ReactNode }) {
  const { theme } = useAppTheme();
  const styles = useMemo(() => makeStyles(theme), [theme]);

  const [visible, setVisible] = useState(false);
  const [dialog, setDialog] = useState<DialogOptions>({
    title: '',
    message: '',
    tone: 'info',
    actions: [],
  });

  const hide = useCallback(() => setVisible(false), []);

  const show = useCallback((options: DialogOptions) => {
    setDialog({
      title: options.title,
      message: options.message,
      tone: options.tone ?? 'info',
      actions: options.actions?.length
        ? options.actions
        : [{ label: 'OK', variant: 'primary' }],
    });
    setVisible(true);
  }, []);

  useEffect(() => {
    dialogBridge = { show, hide };
    return () => {
      dialogBridge = null;
    };
  }, [show, hide]);

  const iconName =
    dialog.tone === 'success'
      ? 'checkmark-circle'
      : dialog.tone === 'warning'
        ? 'alert-circle'
        : dialog.tone === 'error'
          ? 'close-circle'
          : 'information-circle';

  const value = useMemo(() => ({ show, hide }), [show, hide]);

  return (
    <DialogContext.Provider value={value}>
      {children}

      <Modal visible={visible} transparent animationType="fade" onRequestClose={hide}>
        <View style={styles.overlay}>
          <View style={styles.card}>
            <View style={styles.iconWrap}>
              <Ionicons name={iconName as any} size={28} color={theme.colors.primary} />
            </View>

            <Text style={styles.title}>{dialog.title}</Text>
            <Text style={styles.message}>{dialog.message}</Text>

            <View style={styles.actions}>
              {(dialog.actions || []).map((action, idx) => {
                const variant = action.variant ?? 'primary';
                const isPrimary = variant === 'primary';
                const isDanger = variant === 'danger';

                return (
                  <Pressable
                    key={`${action.label}-${idx}`}
                    style={[
                      styles.actionBtn,
                      isPrimary && styles.primaryBtn,
                      isDanger && styles.dangerBtn,
                      !isPrimary && !isDanger && styles.secondaryBtn,
                    ]}
                    onPress={async () => {
                      hide();
                      await action.onPress?.();
                    }}
                  >
                    <Text
                      style={[
                        styles.actionText,
                        (isPrimary || isDanger) && styles.primaryText,
                      ]}
                    >
                      {action.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>
    </DialogContext.Provider>
  );
}

export function useDialogContext() {
  const ctx = useContext(DialogContext);
  if (!ctx) throw new Error('useDialogContext must be used within AppDialogProvider');
  return ctx;
}

function makeStyles(theme: any) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.45)',
      justifyContent: 'center',
      alignItems: 'center',
      padding: 20,
    },
    card: {
      width: '100%',
      maxWidth: 420,
      backgroundColor: theme.colors.surface2,
      borderRadius: theme.radius.card,
      padding: 22,
      borderWidth: 1,
      borderColor: theme.colors.border,
    },
    iconWrap: {
      alignSelf: 'center',
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: theme.colors.surface,
      borderWidth: 1,
      borderColor: theme.colors.border,
      marginBottom: 12,
    },
    title: {
      fontSize: 20,
      fontWeight: '900',
      color: theme.colors.text,
      textAlign: 'center',
      marginBottom: 10,
    },
    message: {
      fontSize: 14,
      lineHeight: 20,
      color: theme.colors.mutedText,
      textAlign: 'center',
      fontWeight: '600',
      marginBottom: 18,
    },
    actions: {
      gap: 10,
    },
    actionBtn: {
      minHeight: 48,
      borderRadius: theme.radius.button,
      alignItems: 'center',
      justifyContent: 'center',
      borderWidth: 1,
    },
    primaryBtn: {
      backgroundColor: theme.colors.primary,
      borderColor: theme.colors.primary,
    },
    secondaryBtn: {
      backgroundColor: theme.colors.surface,
      borderColor: theme.colors.border,
    },
    dangerBtn: {
      backgroundColor: theme.colors.danger,
      borderColor: theme.colors.danger,
    },
    actionText: {
      fontSize: 14,
      fontWeight: '900',
      color: theme.colors.text,
    },
    primaryText: {
      color: theme.colors.primaryText,
    },
  });
}