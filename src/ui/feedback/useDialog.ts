import { useDialogContext } from './AppDialogProvider';

export function useDialog() {
  return useDialogContext();
}