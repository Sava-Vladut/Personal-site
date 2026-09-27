import { useRef, useState } from 'preact/hooks';
import { MIN_SIZE, type Layout, type Media } from '../lib/body';
import { imageSrc } from '../lib/images';
import type { Entry } from '../lib/store';
import { Icon } from './icons';
import { PhotoImg } from './Photo';

const SIZES = [100, 75, 50, 33];
/** The next preset down from `size`, back to full width after the smallest. */
const nextSize = (size: number) => SIZES.find((s) => s < size - 1) ?? 100;

/** A photo or web image sitting between paragraphs. Tap to select it: then it can be resized, moved, opened or removed. */
export function MediaBlock({ m, draft, selected, dragging, canUp, canDown, onSelect, onOpen, onLayout, onStep, onRemove, onDrag }: {
  m: Media;
  draft: Entry;
  selected: boolean;
  dragging: boolean;
  canUp: boolean;
  canDown: boolean;
  onSelect: () => void;
  onOpen: () => void;
  onLayout: (l: Layout) => void;
  onStep: (dir: -1 | 1) => void;
  onRemove: () => void;
  onDrag: (e: PointerEvent) => void;
}) {
  const frame = useRef<HTMLDivElement>(null);
  const [live, setLive] = useState<number | null>(null); // width while a handle is dragged
  const moved = useRef(false);

  const photo = m.kind === 'photo' ? draft.photos.find((p) => p.id === m.id) : undefined;
  const img = m.kind === 'image' ? draft.images.find((i) => i.url === m.url) : undefined;
  if (!photo && !img) return null;
  const ratio = photo ? photo.w / photo.h : img!.w && img!.h ? img!.w / img!.h : 0;
  const label = photo ? 'Photo' : img!.title ? `Image: ${img!.title}` : 'Image';
  const size = live ?? m.size ?? 100;
  const align = size < 100 ? m.align : undefined;

  // With a mouse, dragging the picture itself moves it. Touch keeps scrolling; the grip in the toolbar moves it there.
  const pressPic = (e: PointerEvent) => {
    moved.current = false;
    if (e.pointerType !== 'mouse' || e.button !== 0) return;
    const x = e.clientX, y = e.clientY;
    const move = (ev: PointerEvent) => {
      if (Math.hypot(ev.clientX - x, ev.clientY - y) < 6) return;
      moved.current = true;
      stop();
      onDrag(ev);
    };
    const stop = () => {
      removeEventListener('pointermove', move);
      removeEventListener('pointerup', stop);
    };
    addEventListener('pointermove', move);
    addEventListener('pointerup', stop);
  };

  // Handles on both sides. A centred picture grows from its middle, so it moves twice as fast.
  const resize = (side: -1 | 1) => (e: PointerEvent) => {
    const el = frame.current;
    const col = el?.parentElement?.clientWidth;
    if (!el || !col) return;
    e.preventDefault();
    e.stopPropagation();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const start = el.getBoundingClientRect().width;
    const x0 = e.clientX;
    const factor = align ? 1 : 2;
    let pct = size;
    const move = (ev: PointerEvent) => {
      const w = start + (ev.clientX - x0) * side * factor;
      pct = Math.round(Math.min(100, Math.max(MIN_SIZE, (w / col) * 100)));
      if (pct >= 96) pct = 100;
      setLive(pct);
    };
    const end = (ev: PointerEvent) => {
      const t = ev.currentTarget as HTMLElement;
      t.removeEventListener('pointermove', move);
      t.removeEventListener('pointerup', end);
      t.removeEventListener('pointercancel', end);
      setLive(null);
      if (ev.type === 'pointerup' && pct !== size) onLayout({ size: pct, align: m.align });
    };
    const t = e.currentTarget as HTMLElement;
    t.addEventListener('pointermove', move);
    t.addEventListener('pointerup', end);
    t.addEventListener('pointercancel', end);
  };

  const place = (a: 'left' | 'center' | 'right') => {
    const side = a === 'center' ? undefined : a;
    onLayout({ size: size === 100 && side ? 50 : size, align: side });
  };

  return (
    <div class={`media${selected ? ' is-selected' : ''}${dragging ? ' is-dragging' : ''}${live !== null ? ' is-resizing' : ''}`}>
      {selected && (
        <div class="media-bar">
          <div class="media-tools glass" role="toolbar" aria-label={`${photo ? 'Photo' : 'Image'} options`}>
            <button class="grip" onPointerDown={(e) => { e.preventDefault(); onDrag(e); }} aria-label="Drag to move" title="Drag to move">
              <Icon name="grip-vertical" size={18} />
            </button>
            <button onClick={() => onStep(-1)} disabled={!canUp} aria-label="Move up" title="Move up">
              <Icon name="arrow-up" size={18} />
            </button>
            <button onClick={() => onStep(1)} disabled={!canDown} aria-label="Move down" title="Move down">
              <Icon name="arrow-down" size={18} />
            </button>
            <span class="sep" />
            <button class="size" onClick={() => onLayout({ size: nextSize(size), align: m.align })} aria-label={`Size: ${size === 100 ? 'full width' : size + '%'}. Change size`} title="Change size">
              {size === 100 ? 'Full' : size + '%'}
            </button>
            <button onClick={() => place('left')} aria-pressed={align === 'left'} aria-label="Left" title="Left">
              <Icon name="float-left" size={18} />
            </button>
            <button onClick={() => place('center')} aria-pressed={!align} aria-label="Centre" title="Centre">
              <Icon name="float-center" size={18} />
            </button>
            <button onClick={() => place('right')} aria-pressed={align === 'right'} aria-label="Right" title="Right">
              <Icon name="float-right" size={18} />
            </button>
            <span class="sep" />
            <button onClick={onOpen} aria-label="View" title="View">
              <Icon name="maximize" size={18} />
            </button>
            <button class="danger" onClick={onRemove} aria-label="Remove" title="Remove">
              <Icon name="trash" size={18} />
            </button>
          </div>
        </div>
      )}
      <div
        ref={frame}
        class="media-frame"
        style={{
          width: `${size}%`,
          maxWidth: ratio ? `calc(70dvh * ${ratio.toFixed(4)})` : undefined,
          marginLeft: align === 'left' ? 0 : 'auto',
          marginRight: align === 'right' ? 0 : 'auto',
        }}
      >
        <button
          class="media-pic"
          onPointerDown={pressPic}
          onClick={() => { if (!moved.current) (selected ? onOpen : onSelect)(); }}
          onKeyDown={(e) => {
            if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); onRemove(); }
            else if (e.altKey && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) { e.preventDefault(); onStep(e.key === 'ArrowUp' ? -1 : 1); }
          }}
          aria-label={selected ? `View ${label.toLowerCase()}` : `Select ${label.toLowerCase()}`}
          aria-pressed={selected}
        >
          {photo ? (
            <PhotoImg photo={photo} alt={label} />
          ) : (
            <img src={imageSrc(img!, 'thumb')} alt={img!.title || 'Image'} loading="lazy" referrerpolicy="no-referrer" style={ratio ? { aspectRatio: `${img!.w} / ${img!.h}` } : undefined} />
          )}
        </button>
        {selected && (
          <>
            <span class="media-handle left" onPointerDown={resize(-1)} aria-hidden="true" />
            <span class="media-handle right" onPointerDown={resize(1)} aria-hidden="true" />
          </>
        )}
        {live !== null && <span class="media-badge glass">{live === 100 ? 'Full width' : live + '%'}</span>}
      </div>
    </div>
  );
}

export interface DropTarget { seg: number; pos: number; y: number }

const COPY = ['fontFamily', 'fontSize', 'fontWeight', 'fontStyle', 'lineHeight', 'letterSpacing', 'wordSpacing', 'textTransform',
  'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'tabSize', 'overflowWrap', 'wordBreak'] as const;

/** Where each line of a text box starts, and where its text ends, in px from its top — measured on a copy, since text wraps. */
function lineTops(el: HTMLTextAreaElement) {
  const cs = getComputedStyle(el);
  const copy = document.createElement('div');
  for (const p of COPY) copy.style[p] = cs[p];
  copy.style.cssText += `;position:absolute;left:-9999px;top:0;visibility:hidden;white-space:pre-wrap;box-sizing:border-box;width:${el.offsetWidth}px`;
  const lines = el.value.split('\n');
  const marks = lines.map((l, k) => {
    const s = document.createElement('span');
    copy.append(s, l + (k < lines.length - 1 ? '\n' : ''));
    return s;
  });
  document.body.append(copy);
  const tops = marks.map((s) => s.offsetTop);
  const end = copy.offsetHeight;
  copy.remove();
  let pos = 0;
  const starts = lines.map((l, k) => {
    const out = { pos, y: tops[k] };
    pos += l.length + 1;
    return out;
  });
  return { starts, end };
}

/** Every place a picture can be dropped: the edges of each text box and the start of each line in it (page coordinates). */
export function dropTargets(areas: (HTMLTextAreaElement | null)[]): DropTarget[] {
  const out: DropTarget[] = [];
  areas.forEach((el, seg) => {
    if (!el) return;
    const r = el.getBoundingClientRect();
    const top = r.top + scrollY;
    out.push({ seg, pos: 0, y: top });
    if (!el.value) return;
    const { starts, end } = lineTops(el); // not the box's height: the last one is kept tall to write in
    for (const l of starts.slice(1)) out.push({ seg, pos: l.pos, y: top + l.y });
    out.push({ seg, pos: el.value.length, y: top + end });
  });
  return out;
}
