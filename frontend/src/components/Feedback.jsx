export function Spinner({ label = 'Loading' }) {
  return (
    <span
      className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin"
      role="status"
      aria-label={label}
    />
  );
}

export function ErrorAlert({ error, onRetry }) {
  if (!error) return null;
  const message = typeof error === 'string' ? error : error.message;
  return (
    <div className="alert-error flex items-center justify-between gap-4" role="alert">
      <span>{message}</span>
      {onRetry && (
        <button type="button" className="btn-secondary !py-1.5 !px-3" onClick={onRetry}>
          Coba lagi
        </button>
      )}
    </div>
  );
}

export function EmptyState({ children }) {
  return (
    <tr>
      <td colSpan={99} className="text-center py-7 text-ink-muted">{children}</td>
    </tr>
  );
}
