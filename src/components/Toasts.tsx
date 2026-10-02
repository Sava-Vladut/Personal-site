import { useEffect, useRef, useState } from 'preact/hooks';
import { dismissToast, useToasts, type Toast } from '../lib/store';

/** Toasts rise in and, once dismissed, stay a moment longer to fade away. */
export function Toasts() {
  const toasts = useToasts();
  const [leaving, setLeaving] = useState<Toast[]>([]);
  const prev = useRef(toasts);
  useEffect(() => {
    const gone = prev.current.filter((t) => !toasts.some((x) => x.id === t.id));
    prev.current = toasts;
    if (!gone.length) return;
    setLeaving((l) => [...l, ...gone]);
    setTimeout(() => setLeaving((l) => l.filter((t) => !gone.includes(t))), 220);
  }, [toasts]);
  return (
    <div class="toasts" aria-live="polite">
      {leaving.map((t) => (
        <div class="toast glass leaving" key={t.id} aria-hidden="true">
          <span>{t.text}</span>
        </div>
      ))}
      {toasts.map((t) => (
        <div class="toast glass" key={t.id}>
          <span>{t.text}</span>
          {t.action && (
            <button class="toast-action" onClick={() => { t.action!.run(); dismissToast(t.id); }}>{t.action.label}</button>
          )}
        </div>
      ))}
    </div>
  );
}
