import { useEffect, useRef, useState } from 'preact/hooks';
import { dismissToast, toast, useToasts, type Toast } from '../lib/store';
import { t } from '../lib/i18n';

/** Runs a toast's action (Undo, mostly). One that fails says so, rather than leaving you sure it worked. */
function act(x: Toast) {
  dismissToast(x.id);
  Promise.resolve().then(x.action!.run).catch(() => toast(t('Couldn’t undo that. Try again.')));
}

/** Toasts rise in and, once dismissed, stay a moment longer to fade away. */
export function Toasts() {
  const toasts = useToasts();
  const [leaving, setLeaving] = useState<Toast[]>([]);
  const prev = useRef(toasts);
  useEffect(() => {
    const gone = prev.current.filter((g) => !toasts.some((x) => x.id === g.id));
    prev.current = toasts;
    if (!gone.length) return;
    setLeaving((l) => [...l, ...gone]);
    setTimeout(() => setLeaving((l) => l.filter((g) => !gone.includes(g))), 220);
  }, [toasts]);
  return (
    <div class="toasts" aria-live="polite">
      {leaving.map((x) => (
        <div class="toast glass leaving" key={x.id} aria-hidden="true">
          <span>{x.text}</span>
        </div>
      ))}
      {toasts.map((x) => (
        <div class="toast glass" key={x.id}>
          <span>{x.text}</span>
          {x.action && (
            <button class="toast-action" onClick={() => act(x)}>{x.action.label}</button>
          )}
        </div>
      ))}
    </div>
  );
}
