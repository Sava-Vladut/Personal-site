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
  const backdrop = useRef<HTMLDivElement>(null);
  const exitMs = useRef(180);

  useEffect(() => {
    if (open) {
      setMounted(true);
      setClosing(false);
      // reopened before a swipe-dismissed sheet had gone: drop what the swipe left behind
      for (const el of [panel.current, backdrop.current]) {
        el?.getAnimations().forEach((a) => a instanceof CSSAnimation || a.cancel());
        el?.style.removeProperty('transform');
        el?.style.removeProperty('opacity');
      }
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
      const t = setTimeout(() => setMounted(false), exitMs.current);
      exitMs.current = 180;
      return () => clearTimeout(t);
    }
  }, [open]);

  useEffect(() => {
    const el = panel.current;
    if (!mounted || !el) return;
    return dragToDismiss(el, backdrop.current!, (ms) => {
      exitMs.current = ms;
      closeRef.current();
    });
  }, [mounted]);

  if (!mounted) return null;
  return (
    <div class={`sheet-wrap${closing ? ' closing' : ''}`} onKeyDown={(e) => e.key === 'Escape' && (e.stopPropagation(), onClose())}>
      <div ref={backdrop} class="sheet-backdrop" onClick={onClose} />
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

/* ---------- swipe down to dismiss (phones) ----------
   Pull the sheet down from anywhere that isn't mid-scroll. It follows the finger, and on release
   either keeps going (pulled far enough, or flicked) or springs back into place. */

const SPRING_BACK = CSS.supports('animation-timing-function', 'linear(0, 1)')
  ? 'linear(0, 0.028 2.5%, 0.099 5%, 0.197 7.5%, 0.307 10%, 0.421 12.5%, 0.53 15%, 0.632 17.5%, 0.722 20%, 0.799 22.5%, 0.863 25%, 0.915 27.5%, 0.956 30%, 0.987 32.5%, 1.009 35%, 1.024 37.5%, 1.033 40%, 1.037 42.5%, 1.015 60%, 1.004 80%, 1)'
  : 'cubic-bezier(0.2, 0.8, 0.2, 1)';

function dragToDismiss(el: HTMLElement, backdrop: HTMLElement, dismiss: (ms: number) => void) {
  let start: { x: number; y: number; dragging: boolean } | null = null;
  let dy = 0, v = 0, lastY = 0, lastT = 0;

  const scrolled = (t: Element | null) => {
    for (; t && t !== el; t = t.parentElement) if (t.scrollTop > 0) return true;
    return false;
  };
  const set = (y: number) => {
    el.style.transform = y ? `translateY(${y}px)` : '';
    backdrop.style.opacity = y > 0 ? String(Math.max(0, 1 - y / el.offsetHeight)) : '';
  };

  const onStart = (e: TouchEvent) => {
    start = null;
    if (e.touches.length !== 1 || matchMedia('(min-width: 720px)').matches) return;
    const t = e.target as Element;
    if (t.closest('input, textarea, select, [contenteditable]') || scrolled(t)) return;
    const { clientX: x, clientY: y } = e.touches[0];
    start = { x, y, dragging: false };
  };
  const onMove = (e: TouchEvent) => {
    if (!start) return;
    const { clientX: x, clientY: y } = e.touches[0];
    if (!start.dragging) {
      const ddx = Math.abs(x - start.x), ddy = y - start.y;
      if (ddy < 0 || ddx > ddy) return void (start = null); // scrolling up, or sideways (chips)
      if (e.cancelable) e.preventDefault(); // claim the gesture before iOS starts its overscroll bounce
      if (ddy < 6) return;
      start.dragging = true;
      start.y = y;
      lastY = y;
      lastT = e.timeStamp;
      el.getAnimations().forEach((a) => a.finish()); // don't fight the opening slide
      backdrop.getAnimations().forEach((a) => a.finish());
    }
    if (e.cancelable) e.preventDefault();
    const raw = y - start.y;
    dy = raw < 0 ? -Math.sqrt(-raw) * 2 : raw; // resist pulling up
    if (e.timeStamp > lastT) v = 0.6 * v + 0.4 * ((y - lastY) / (e.timeStamp - lastT));
    lastY = y;
    lastT = e.timeStamp;
    set(dy);
  };
  const onEnd = (e: TouchEvent) => {
    if (!start?.dragging) return void (start = null);
    start = null;
    if (e.timeStamp - lastT > 80) v = 0; // held still before letting go: not a flick
    const h = el.offsetHeight;
    const from = `translateY(${dy}px)`;
    if (dy > Math.min(160, h * 0.3) || (v > 0.5 && dy > 10)) {
      // carry on at the flick's speed, gently slowing down
      const ms = Math.round(Math.min(280, Math.max(140, (h - dy) / Math.max(v, 1.6))));
      const ease = 'cubic-bezier(0.25, 0.8, 0.4, 1)';
      el.animate([{ transform: from }, { transform: `translateY(${h + 32}px)` }], { duration: ms, easing: ease, fill: 'forwards' });
      backdrop.animate([{ opacity: backdrop.style.opacity || 1 }, { opacity: 0 }], { duration: ms, easing: ease, fill: 'forwards' });
      dismiss(ms + 20);
    } else {
      const opacity = backdrop.style.opacity || '1';
      set(0);
      el.animate([{ transform: from }, { transform: 'none' }], { duration: 520, easing: SPRING_BACK });
      backdrop.animate([{ opacity }, { opacity: 1 }], { duration: 260, easing: 'ease-out' });
    }
    dy = v = 0;
  };

  el.addEventListener('touchstart', onStart, { passive: true });
  el.addEventListener('touchmove', onMove, { passive: false });
  el.addEventListener('touchend', onEnd);
  el.addEventListener('touchcancel', onEnd);
  return () => {
    el.removeEventListener('touchstart', onStart);
    el.removeEventListener('touchmove', onMove);
    el.removeEventListener('touchend', onEnd);
    el.removeEventListener('touchcancel', onEnd);
  };
}
