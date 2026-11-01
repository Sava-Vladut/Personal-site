import { useRef } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import type { Entry } from '../lib/store';
import { removeEntry, togglePin } from './EntryMenu';
import { Icon } from './icons';
import { t } from '../lib/i18n';
import { haptic } from '../lib/haptics';

const START = 12; // px of sideways movement before a drag counts as a swipe (more than the hold's 10px slop)
const COMMIT = 96; // how far to drag before letting go does something

/**
 * Wraps an entry in the journal: drag it right to pin a note (or unpin it), left to delete.
 * Touch and pen only; a mouse has the right-click menu. Sideways drags are ours, vertical ones still scroll.
 */
export function Swipe({ e, children }: { e: Entry; children: ComponentChildren }) {
  const root = useRef<HTMLDivElement>(null);
  const face = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; x: number; y: number; on: boolean; dx: number } | null>(null);
  const swiped = useRef(false);
  const canPin = e.kind === 'note';

  const show = (dx: number) => {
    const el = face.current!;
    const past = Math.abs(dx) - COMMIT;
    const shown = Math.sign(dx) * (past > 0 ? COMMIT + past * 0.3 : Math.abs(dx));
    el.style.transition = 'none';
    el.style.transform = `translateX(${shown}px)`;
    const side = dx > 0 ? (canPin ? 'pin' : '') : dx < 0 ? 'del' : '';
    const r = root.current!;
    r.dataset.side = side;
    const ready = !!side && Math.abs(dx) >= COMMIT;
    if (ready && !('ready' in r.dataset)) haptic(); // a tick as it passes the point where letting go acts
    if (ready) r.dataset.ready = '';
    else delete r.dataset.ready;
  };
  const settle = () => {
    const el = face.current;
    if (el) {
      el.style.transition = 'transform var(--dur-3) var(--spring)';
      el.style.transform = '';
    }
    const r = root.current;
    if (r) {
      delete r.dataset.ready;
      setTimeout(() => delete r.dataset.side, 450); // once it has settled (--dur-3)
    }
  };

  /** The row's place closes up after it has slid off, so what's below it glides up instead of jumping. */
  const foldAway = () => {
    const r = root.current;
    if (!r?.animate || matchMedia('(prefers-reduced-motion: reduce)').matches) return Promise.resolve();
    const gap = parseFloat(getComputedStyle(r.parentElement!).rowGap) || 0;
    r.style.overflow = 'hidden';
    return r.animate(
      [{ height: `${r.offsetHeight}px`, marginBottom: '0px' }, { height: '0px', marginBottom: `${-gap}px` }],
      { duration: 200, easing: 'cubic-bezier(0.3, 0.7, 0.3, 1)', fill: 'forwards' },
    ).finished.then(() => {}, () => {});
  };

  return (
    <div
      ref={root}
      class="swipe"
      onPointerDown={(ev) => {
        swiped.current = false;
        drag.current = ev.pointerType === 'mouse' || !ev.isPrimary ? null : { id: ev.pointerId, x: ev.clientX, y: ev.clientY, on: false, dx: 0 };
      }}
      onPointerMove={(ev) => {
        const d = drag.current;
        if (!d || ev.pointerId !== d.id) return;
        // held long enough to open the entry's sheet: sliding on from there mustn't pin or delete it behind the sheet
        if (!d.on && document.documentElement.classList.contains('sheet-open')) return void (drag.current = null);
        const dx = ev.clientX - d.x;
        const dy = ev.clientY - d.y;
        if (!d.on) {
          if (Math.abs(dy) > START && Math.abs(dy) > Math.abs(dx)) return void (drag.current = null);
          if (Math.abs(dx) < START || Math.abs(dx) < Math.abs(dy) * 1.5) return;
          d.on = true;
          swiped.current = true;
          root.current!.setPointerCapture(ev.pointerId);
        }
        d.dx = dx - Math.sign(dx) * START;
        if (d.dx > 0 && !canPin) d.dx = 0;
        show(d.dx);
      }}
      onPointerUp={(ev) => {
        const d = drag.current;
        drag.current = null;
        if (!d || ev.pointerId !== d.id || !d.on) return;
        if (d.dx <= -COMMIT) {
          face.current!.style.transition = 'transform var(--dur-1) ease-in';
          face.current!.style.transform = 'translateX(-105%)';
          setTimeout(() => void foldAway().then(() => removeEntry(e)), 150); // once it has slid away (--dur-1)
        } else {
          settle();
          if (d.dx >= COMMIT && canPin) togglePin(e);
        }
      }}
      onPointerCancel={() => {
        if (drag.current?.on) settle();
        drag.current = null;
      }}
      onClickCapture={(ev) => {
        if (!swiped.current) return;
        swiped.current = false;
        ev.preventDefault();
        ev.stopPropagation();
      }}
    >
      <div class="swipe-bg" aria-hidden="true">
        <span class="swipe-act pin"><Icon name={e.pinned ? 'pinned-off' : 'pin'} size={20} /> {e.pinned ? t('Unpin') : t('Pin')}</span>
        <span class="swipe-act del">{t('Delete')} <Icon name="trash" size={20} /></span>
      </div>
      <div ref={face} class="swipe-face">{children}</div>
    </div>
  );
}
