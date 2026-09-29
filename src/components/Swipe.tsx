import { useRef } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import type { Entry } from '../lib/store';
import { removeEntry, togglePin } from './EntryMenu';
import { Icon } from './icons';

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
    if (side && Math.abs(dx) >= COMMIT) r.dataset.ready = '';
    else delete r.dataset.ready;
  };
  const settle = () => {
    const el = face.current;
    if (el) {
      el.style.transition = 'transform 0.35s var(--spring)';
      el.style.transform = '';
    }
    const r = root.current;
    if (r) {
      delete r.dataset.ready;
      setTimeout(() => delete r.dataset.side, 350);
    }
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
          face.current!.style.transition = 'transform 0.2s ease-in';
          face.current!.style.transform = 'translateX(-105%)';
          setTimeout(() => removeEntry(e), 200);
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
        <span class="swipe-act pin"><Icon name={e.pinned ? 'pinned-off' : 'pin'} size={20} /> {e.pinned ? 'Unpin' : 'Pin'}</span>
        <span class="swipe-act del">Delete <Icon name="trash" size={20} /></span>
      </div>
      <div ref={face} class="swipe-face">{children}</div>
    </div>
  );
}
