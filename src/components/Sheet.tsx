import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { pushBack } from '../lib/router';
import { Icon } from './icons';

interface Props {
  open: boolean;
  onClose: () => void;
  title?: ComponentChildren;
  children: ComponentChildren;
  footer?: ComponentChildren;
  tall?: boolean;
  label?: string;
}

/** Bottom sheet on phones, centred dialog on wide screens. The back button closes it. */
export function Sheet({ open, onClose, title, children, footer, tall, label }: Props) {
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const panel = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setMounted(true);
      setClosing(false);
      const release = pushBack(() => closeRef.current());
      const prev = document.activeElement as HTMLElement | null;
      requestAnimationFrame(() => panel.current?.focus({ preventScroll: true }));
      document.documentElement.classList.add('sheet-open');
      return () => {
        release();
        document.documentElement.classList.remove('sheet-open');
        prev?.focus?.({ preventScroll: true });
      };
    }
    if (mounted) {
      setClosing(true);
      const t = setTimeout(() => setMounted(false), 180);
      return () => clearTimeout(t);
    }
  }, [open]);

  if (!mounted) return null;
  return (
    <div class={`sheet-wrap${closing ? ' closing' : ''}`} onKeyDown={(e) => e.key === 'Escape' && (e.stopPropagation(), onClose())}>
      <div class="sheet-backdrop" onClick={onClose} />
      <div
        ref={panel}
        class={`sheet glass${tall ? ' tall' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={label ?? (typeof title === 'string' ? title : undefined)}
        tabIndex={-1}
      >
        <div class="sheet-grip" aria-hidden="true" />
        {title !== undefined && (
          <header class="sheet-head">
            <h2 class="sheet-title">{title}</h2>
            <button class="icon-btn" onClick={onClose} aria-label="Close">
              <Icon name="x" />
            </button>
          </header>
        )}
        <div class="sheet-body">{children}</div>
        {footer && <footer class="sheet-foot">{footer}</footer>}
      </div>
    </div>
  );
}
