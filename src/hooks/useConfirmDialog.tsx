import { useCallback, useRef, useState } from 'react';
import ConfirmDialog, { type ConfirmDialogOptions } from '@/components/ConfirmDialog';

export function useConfirmDialog() {
  const [options, setOptions] = useState<ConfirmDialogOptions | null>(null);
  const resolveRef = useRef<((confirmed: boolean) => void) | null>(null);

  const confirm = useCallback((nextOptions: ConfirmDialogOptions) => new Promise<boolean>((resolve) => {
    resolveRef.current = resolve;
    setOptions(nextOptions);
  }), []);

  const close = useCallback((confirmed: boolean) => {
    resolveRef.current?.(confirmed);
    resolveRef.current = null;
    setOptions(null);
  }, []);

  const dialog = options ? (
    <ConfirmDialog
      {...options}
      onConfirm={() => close(true)}
      onCancel={() => close(false)}
    />
  ) : null;

  return { confirm, dialog };
}
