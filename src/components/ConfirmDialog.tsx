import { useEffect, useRef, type MouseEvent } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, LogOut, Trash2, X } from 'lucide-react';

export type ConfirmTone = 'neutral' | 'warning' | 'danger';

export interface ConfirmDialogOptions {
  eyebrow?: string;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel: string;
  tone?: ConfirmTone;
}

interface ConfirmDialogProps extends ConfirmDialogOptions {
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  eyebrow = 'Confirmar acción',
  title,
  description,
  confirmLabel,
  cancelLabel,
  tone = 'neutral',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const Icon = tone === 'neutral' ? LogOut : tone === 'danger' ? Trash2 : AlertTriangle;

  useEffect(() => {
    const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    cancelButtonRef.current?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        onCancel();
        return;
      }

      if (event.key !== 'Tab' || !dialogRef.current) return;
      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), [tabindex]:not([tabindex="-1"])',
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus();
    };
  }, [onCancel]);

  function handleBackdropClick(event: MouseEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) onCancel();
  }

  const confirmColor = tone === 'danger'
    ? 'bg-rose-700 hover:bg-rose-800 focus-visible:outline-rose-700'
    : tone === 'warning'
      ? 'bg-[var(--em-dark)] hover:brightness-90 focus-visible:outline-[var(--em-dark)]'
      : 'bg-[var(--em-dark)] hover:brightness-90 focus-visible:outline-[var(--em-dark)]';
  const iconStyle = tone === 'danger'
    ? 'bg-rose-50 text-rose-700'
    : tone === 'warning'
      ? 'bg-amber-50 text-amber-700'
      : 'bg-[var(--em-light)] text-[var(--em-dark)]';

  return createPortal(
    <div
      className="fixed inset-0 z-[100] grid place-items-center bg-slate-950/45 p-4 backdrop-blur-sm animate-fade-in"
      onMouseDown={handleBackdropClick}
    >
      <div
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        aria-describedby="confirm-dialog-description"
        className="w-full max-w-md rounded-[1.6rem] border border-white/70 bg-[var(--surface)] p-6 shadow-[0_24px_80px_rgba(16,24,18,.28)] animate-scale-in sm:p-7"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${iconStyle}`}>
            <Icon className="h-5 w-5" aria-hidden="true" />
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Cerrar diálogo"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-[var(--text-subtle)] transition-colors hover:bg-black/5 hover:text-[var(--text)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--em-dark)]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <p className="mb-2 text-[.68rem] font-bold uppercase tracking-[.18em] text-[var(--em)]">{eyebrow}</p>
        <h2 id="confirm-dialog-title" className="font-display text-2xl font-semibold tracking-tight text-[var(--text-primary)]">
          {title}
        </h2>
        <p id="confirm-dialog-description" className="mt-3 text-sm leading-6 text-[var(--text-muted)]">
          {description}
        </p>

        <div className="mt-7 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            ref={cancelButtonRef}
            type="button"
            onClick={onCancel}
            className="rounded-xl border border-[var(--border2)] bg-white/60 px-4 py-3 text-sm font-semibold text-[var(--text-muted)] transition-colors hover:bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--em-dark)]"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`rounded-xl px-4 py-3 text-sm font-semibold text-white transition-all hover:shadow-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 ${confirmColor}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
