import { useEffect, useRef, useState } from 'preact/hooks';
import { editable } from '../lib/editable';
import { MIN_SIZE, type Layout, type Media } from '../lib/body';
import { imageSrc } from '../lib/images';
import type { Entry } from '../lib/store';
import { Icon } from './icons';
import { PhotoImg } from './Photo';

const SIZES = [100, 75, 50, 33];
/** The next preset down from `size`, back to full width after the smallest. */
const nextSize = (size: number) => SIZES.find((s) => s < size - 1) ?? 100;

export type Side = 'left' | 'center' | 'right';

/** A size in % of the column, from a width in px. Close to full width snaps to it. */
function pctOf(w: number, col: number) {
  const p = Math.round(Math.min(100, Math.max(MIN_SIZE, (w / col) * 100)));
  return p >= 96 ? 100 : p;
}

const ratioOf = (m: Media, draft: Entry) => {
  if (m.kind === 'photo') {
    const p = draft.photos.find((x) => x.id === m.id);
    return p ? p.w / p.h : 0;
  }
  const i = draft.images.find((x) => x.url === m.url);
  return i?.w && i.h ? i.w / i.h : 0;
};

/** Where a picture lands when dropped: its size (a side picture is at most half the column) and side. */
export function dropLayout(m: Media, side: Side): Layout {
  const size = m.size ?? 100;
  return side === 'center' ? { size } : { size: size >= 100 ? 50 : size, align: side };
}

interface Gesture {
  pts: Map<number, { x: number; y: number }>;
  kind: 'press' | 'pinch' | 'done';
  x0: number;
  y0: number;
  last: PointerEvent;
  timer?: ReturnType<typeof setTimeout>;
  d0: number;
  w0: number;
  col: number;
  pct?: number;
}

/**
 * A photo or web image in a note. Smaller than full width, it sits on the left or right with the text wrapping around
 * it, or centred on its own. Tap to select it; then pinch it or pull a corner to resize, and drag it anywhere to move it.
 * On touch, holding a picture that isn't selected picks it up too. Selected, a tap opens it full screen.
 */
export function MediaBlock({ m, draft, editing, selected, dragging, onSelect, onOpen, onResize, onDrag }: {
  m: Media;
  draft: Entry;
  editing: boolean;
  selected: boolean;
  dragging: boolean;
  onSelect: () => void;
  onOpen: (el: HTMLElement) => void;
  onResize: (size: number) => void;
  onDrag: (e: PointerEvent, el: HTMLElement) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [live, setLive] = useState<number | null>(null); // size while pinching or pulling a corner
  const gesture = useRef<Gesture | null>(null);
  const acted = useRef(false); // the press moved, resized or picked up the picture: it isn't a tap

  // A picture held on touch has to stop the page scrolling under the finger. That only works from a listener that
  // was already there when the touch began, and isn't passive.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const block = (e: TouchEvent) => {
      if (document.documentElement.classList.contains('is-moving') || gesture.current?.kind === 'pinch') e.preventDefault();
    };
    el.addEventListener('touchmove', block, { passive: false });
    return () => el.removeEventListener('touchmove', block);
  }, []);

  const photo = m.kind === 'photo' ? draft.photos.find((p) => p.id === m.id) : undefined;
  const img = m.kind === 'image' ? draft.images.find((i) => i.url === m.url) : undefined;
  if (!photo && !img) return null;
  const ratio = ratioOf(m, draft);
  const label = photo ? 'Photo' : img!.title ? `Image: ${img!.title}` : 'Image';
  const size = live ?? m.size ?? 100;
  const align = size < 100 ? m.align : undefined;
  const colWidth = () => box.current?.parentElement?.clientWidth ?? 0;

  const down = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    let g = gesture.current;
    if (!g) {
      acted.current = false;
      const cur: Gesture = (g = gesture.current = { pts: new Map(), kind: 'press', x0: e.clientX, y0: e.clientY, last: e, d0: 0, w0: 0, col: 0 });
      const pickUp = (ev: PointerEvent) => {
        clearTimeout(cur.timer);
        cur.kind = 'done';
        acted.current = true;
        onDrag(ev, box.current!);
      };
      const move = (ev: PointerEvent) => {
        if (!cur.pts.has(ev.pointerId)) return;
        cur.pts.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
        cur.last = ev;
        if (cur.kind === 'pinch') {
          ev.preventDefault();
          if (cur.pts.size < 2) return;
          const [a, b] = [...cur.pts.values()];
          cur.pct = pctOf((cur.w0 * Math.hypot(a.x - b.x, a.y - b.y)) / cur.d0, cur.col);
          setLive(cur.pct);
        } else if (cur.kind === 'press' && Math.hypot(ev.clientX - cur.x0, ev.clientY - cur.y0) > 8) {
          // A mouse, or a finger on the selected picture, drags it. A finger on any other picture scrolls the page.
          if (editing && (ev.pointerType === 'mouse' || selected)) pickUp(ev);
          else {
            clearTimeout(cur.timer);
            cur.kind = 'done';
          }
        }
      };
      const up = (ev: PointerEvent) => {
        if (!cur.pts.delete(ev.pointerId) || cur.pts.size) return;
        clearTimeout(cur.timer);
        removeEventListener('pointermove', move);
        removeEventListener('pointerup', up);
        removeEventListener('pointercancel', up);
        gesture.current = null;
        if (cur.kind !== 'pinch') return;
        setLive(null);
        if (cur.pct !== undefined && cur.pct !== (m.size ?? 100)) onResize(cur.pct);
      };
      addEventListener('pointermove', move, { passive: false });
      addEventListener('pointerup', up);
      addEventListener('pointercancel', up);
      // On touch, holding a picture picks it up; a quick swipe still scrolls.
      if (editing && e.pointerType !== 'mouse' && !selected)
        cur.timer = setTimeout(() => {
          if (gesture.current !== cur || cur.kind !== 'press' || cur.pts.size !== 1) return;
          navigator.vibrate?.(10);
          pickUp(cur.last);
        }, 420);
    }
    g.pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
    // Two fingers on the selected picture resize it.
    if (g.pts.size === 2 && editing && selected && g.kind === 'press') {
      clearTimeout(g.timer);
      const [a, b] = [...g.pts.values()];
      Object.assign(g, { kind: 'pinch', d0: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), w0: box.current!.getBoundingClientRect().width, col: colWidth() });
      acted.current = true;
    }
  };

  // Pulling a corner away from the picture makes it bigger. A centred picture grows on both sides, so twice as fast.
  const corner = (sx: -1 | 1, sy: -1 | 1) => (e: PointerEvent) => {
    const el = box.current;
    const col = colWidth();
    if (!el || !col) return;
    e.preventDefault();
    e.stopPropagation();
    const t = e.currentTarget as HTMLElement;
    t.setPointerCapture(e.pointerId);
    const r = el.getBoundingClientRect();
    const len = Math.hypot(r.width, r.height);
    const factor = align ? 1 : 2;
    const x0 = e.clientX, y0 = e.clientY;
    let pct = size;
    const move = (ev: PointerEvent) => {
      const out = ((ev.clientX - x0) * sx * r.width + (ev.clientY - y0) * sy * r.height) / len; // px along the diagonal
      pct = pctOf(r.width + out * (r.width / len) * factor, col);
      setLive(pct);
    };
    const end = (ev: PointerEvent) => {
      t.removeEventListener('pointermove', move);
      t.removeEventListener('pointerup', end);
      t.removeEventListener('pointercancel', end);
      setLive(null);
      if (ev.type === 'pointerup' && pct !== size) onResize(pct);
    };
    t.addEventListener('pointermove', move);
    t.addEventListener('pointerup', end);
    t.addEventListener('pointercancel', end);
  };
  const corners: [string, -1 | 1, -1 | 1][] = [['tl', -1, -1], ['tr', 1, -1], ['bl', -1, 1], ['br', 1, 1]];

  return (
    <div
      ref={box}
      class={`media${align ? ' is-' + align : ''}${selected ? ' is-selected' : ''}${dragging ? ' is-dragging' : ''}${live !== null ? ' is-resizing' : ''}`}
      style={{ width: `${size}%`, maxWidth: ratio ? `calc(70dvh * ${ratio.toFixed(4)})` : undefined }}
      onContextMenu={(e) => editing && e.preventDefault()}
    >
      <button
        class="media-pic"
        onPointerDown={down}
        onClick={(e) => {
          if (acted.current) return void (acted.current = false);
          if (selected || !editing) onOpen(e.currentTarget);
          else onSelect();
        }}
        aria-label={selected || !editing ? `View ${label.toLowerCase()}` : `Select ${label.toLowerCase()}`}
        aria-pressed={editing ? selected : undefined}
      >
        {photo ? (
          <PhotoImg photo={photo} alt={label} draggable={false} />
        ) : (
          <img src={imageSrc(img!, 'thumb')} alt={img!.title || 'Image'} loading="lazy" draggable={false} referrerpolicy="no-referrer" style={ratio ? { aspectRatio: `${img!.w} / ${img!.h}` } : undefined} />
        )}
      </button>
      {selected && !dragging &&
        corners
          // a picture on a side is pulled from its free side, the one the text is on
          .filter(([, sx]) => !align || (align === 'left' ? sx > 0 : sx < 0))
          .map(([c, sx, sy]) => <span key={c} class={`media-corner ${c}`} onPointerDown={corner(sx, sy)} aria-hidden="true" />)}
      {live !== null && <span class="media-badge glass">{live === 100 ? 'Full width' : live + '%'}</span>}
    </div>
  );
}

/** The toolbar for the selected picture, in place of the formatting buttons. */
export function MediaTools({ m, canUp, canDown, onLayout, onStep, onOpen, onRemove }: {
  m: Media;
  canUp: boolean;
  canDown: boolean;
  onLayout: (l: Layout) => void;
  onStep: (dir: -1 | 1) => void;
  onOpen: () => void;
  onRemove: () => void;
}) {
  const size = m.size ?? 100;
  const align = size < 100 ? m.align : undefined;
  const side = (s: Side) => onLayout(s === 'center' ? { size } : dropLayout(m, s));
  return (
    <>
      <button class="format-btn" onClick={() => side('left')} aria-pressed={align === 'left'} aria-label="Left, text wraps around it" title="Left, text wraps around it">
        <Icon name="float-left" size={19} />
      </button>
      <button class="format-btn" onClick={() => side('center')} aria-pressed={!align} aria-label="Centre, on its own line" title="Centre, on its own line">
        <Icon name="float-center" size={19} />
      </button>
      <button class="format-btn" onClick={() => side('right')} aria-pressed={align === 'right'} aria-label="Right, text wraps around it" title="Right, text wraps around it">
        <Icon name="float-right" size={19} />
      </button>
      <span class="format-sep" />
      <button class="format-btn media-size" onClick={() => onLayout({ size: nextSize(size), align: m.align })} aria-label={`Size: ${size === 100 ? 'full width' : size + '%'}. Change size`} title="Change size">
        {size === 100 ? 'Full' : size + '%'}
      </button>
      <span class="format-sep" />
      <button class="format-btn" onClick={() => onStep(-1)} disabled={!canUp} aria-label="Move up" title="Move up">
        <Icon name="arrow-up" size={19} />
      </button>
      <button class="format-btn" onClick={() => onStep(1)} disabled={!canDown} aria-label="Move down" title="Move down">
        <Icon name="arrow-down" size={19} />
      </button>
      <span class="format-sep" />
      <button class="format-btn" onClick={onOpen} aria-label="View" title="View">
        <Icon name="maximize" size={19} />
      </button>
      <button class="format-btn danger" onClick={onRemove} aria-label="Remove" title="Remove">
        <Icon name="trash" size={19} />
      </button>
    </>
  );
}

export interface DropTarget { seg: number; pos: number; y: number }

/**
 * Every place a picture can be dropped (page coordinates): the start of each text block, the start of each line
 * (paragraph) in it, and the end of its text.
 */
export function dropTargets(areas: (HTMLElement | null)[]): DropTarget[] {
  const out: DropTarget[] = [];
  areas.forEach((el, seg) => {
    if (!el) return;
    const top = el.getBoundingClientRect().top + scrollY;
    out.push({ seg, pos: 0, y: top });
    const box = editable(el);
    const v = box.value;
    if (!v) return;
    const lh = parseFloat(getComputedStyle(el).lineHeight) || 28;
    let pos = 0;
    let bottom = top;
    v.split('\n').forEach((line, k) => {
      let y = bottom; // a blank line sits just below the one before
      const rects = line ? [...box.range(pos, pos + line.length).getClientRects()].filter((r) => r.height) : [];
      if (rects.length) {
        y = rects[0].top + scrollY;
        bottom = rects[rects.length - 1].bottom + scrollY;
      } else bottom += lh;
      if (k > 0) out.push({ seg, pos, y });
      pos += line.length + 1;
    });
    out.push({ seg, pos: v.length, y: bottom });
  });
  return out;
}

/** Which side of the column a point is over: its left or right third, or the middle. */
export function sideAt(x: number, col: DOMRect): Side {
  const f = (x - col.left) / col.width;
  return f < 0.34 ? 'left' : f > 0.66 ? 'right' : 'center';
}
