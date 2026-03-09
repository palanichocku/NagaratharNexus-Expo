import { Platform, Alert } from 'react-native';
import { showGlobalDialog } from '@/src/ui/feedback/AppDialogProvider';

type Button = {
  text: string;
  onPress?: () => void | Promise<void>;
  style?: 'default' | 'cancel' | 'destructive';
};

export function notify(title: string, message?: string, buttons?: Button[]) {
  // ✅ Preferred path: use the app's premium modal
  const usedAppDialog = showGlobalDialog({
    title,
    message: message ?? '',
    tone: inferTone(title, buttons),
    actions:
      buttons?.length
        ? buttons.map((b) => ({
            label: b.text,
            variant:
              b.style === 'destructive'
                ? 'danger'
                : b.style === 'cancel'
                  ? 'secondary'
                  : 'primary',
            onPress: b.onPress,
          }))
        : [{ label: 'OK', variant: 'primary' }],
  });

  if (usedAppDialog) return;

  // Fallback only if provider is not mounted yet
  if (Platform.OS === 'web') {
    if (!buttons || buttons.length <= 1) {
      window.alert(`${title}\n\n${message ?? ''}`);
      buttons?.[0]?.onPress?.();
      return;
    }

    const destructive = buttons.find((b) => b.style === 'destructive');
    const cancel = buttons.find((b) => b.style === 'cancel');
    const defaultBtn = buttons.find((b) => !b.style || b.style === 'default');

    const confirmed = window.confirm(`${title}\n\n${message ?? ''}`);

    if (confirmed) {
      (destructive ?? defaultBtn)?.onPress?.();
    } else {
      cancel?.onPress?.();
    }

    return;
  }

  Alert.alert(
    title,
    message,
    buttons?.map((b) => ({
      text: b.text,
      style: b.style,
      onPress: () => b.onPress?.(),
    }))
  );
}

function inferTone(
  title: string,
  buttons?: Button[]
): 'info' | 'success' | 'warning' | 'error' {
  const t = title.toLowerCase();

  if (buttons?.some((b) => b.style === 'destructive')) return 'warning';
  if (t.includes('error') || t.includes('failed') || t.includes('denied')) return 'error';
  if (t.includes('success') || t.includes('sent') || t.includes('done')) return 'success';
  return 'info';
}