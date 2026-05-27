import { useEffect, useRef } from 'react';
import { AlertTriangle, X } from 'lucide-react';

export default function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Batal',
  danger,
  onConfirm,
  onCancel,
  loading
}) {
  const confirmBtnRef = useRef(null);

  useEffect(() => {
    if (!open) return undefined;

    const handler = (event) => {
      if (event.key === 'Escape') onCancel?.();
    };

    window.addEventListener('keydown', handler);
    confirmBtnRef.current?.focus();

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      window.removeEventListener('keydown', handler);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onCancel]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-slate-950/70 backdrop-blur-sm p-4 animate-fade-in"
      onClick={onCancel}
      role="presentation"
    >
      <div
        className="relative w-full max-w-md rounded-3xl border border-border bg-card shadow-lift p-6 animate-scale-in"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        aria-describedby="confirm-desc"
      >
        <button
          type="button"
          className="absolute top-3 right-3 btn-icon"
          onClick={onCancel}
          aria-label="Close dialog"
        >
          <X size={16} aria-hidden="true" />
        </button>

        <div
          className={`grid place-items-center w-11 h-11 rounded-2xl mb-3 ${
            danger ? 'bg-red-400/15 text-red-400' : 'bg-blue-400/15 text-blue-400'
          }`}
          aria-hidden="true"
        >
          <AlertTriangle size={22} />
        </div>

        <h3 id="confirm-title" className="text-lg font-semibold mb-1">{title}</h3>
        <p id="confirm-desc" className="text-sm text-ink-muted m-0">{message}</p>

        <div className="flex justify-end gap-2.5 mt-5">
          <button type="button" className="btn-secondary" onClick={onCancel} disabled={loading}>
            {cancelLabel}
          </button>
          <button
            ref={confirmBtnRef}
            type="button"
            className={danger ? 'btn-danger-solid' : 'btn-primary'}
            onClick={onConfirm}
            disabled={loading}
            aria-busy={loading || undefined}
          >
            {loading ? 'Memproses...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
