import { useEffect, useRef, useState } from 'preact/hooks';
import { itemKey, itemsOf, mediaKey, MIN_SIZE, type Item, type Layout, type Media } from '../lib/body';
import { imageSrc } from '../lib/images';
import type { Entry } from '../lib/store';
import { Icon } from './icons';
import { PhotoImg } from './Photo';
import { t } from '../lib/i18n';
import { haptic } from '../lib/haptics';

export type Side = 'left' | 'center' | 'right';

/** A size in % of the column, from a width in px: any size in between, no steps. */
const pctOf = (w: number, col: number) => Math.round(Math.min(100, Math.max(MIN_SIZE, (w / col) * 100)));

const itemRatio = (it: Item, draft: Entry) => {
  if (it.kind === 'photo') {
    const p = draft.photos.find((x) => x.id === it.id);
    return p ? p.w / p.h : 0;
  }
  const i = draft.images.find((x) => x.url === it.url);
  return i?.w && i.h ? i.w / i.h : 0;
};
/** How many tiles an album shows; the last one says how many more there are. */
const TILES = 5;
/** An album's shape: two side by side, one big and two stacked, a 2×2 grid, or two over three. */
const ALBUM_RATIO = [0, 0, 3 / 2, 4 / 3, 1, 1];
const ratioOf = (m: Media, draft: Entry) => (m.kind === 'album' ? ALBUM_RATIO[Math.min(TILES, m.items.length)] : itemRatio(m, draft));

/** One picture, filling its box. */
function Pic({ it, draft, tile }: { it: Item; draft: Entry; tile?: boolean }) {
  const photo = it.kind === 'photo' ? draft.photos.find((p) => p.id === it.id) : undefined;
  const img = it.kind === 'image' ? draft.images.find((i) => i.url === it.url) : undefined;
  if (photo) return <PhotoImg photo={photo} alt={t('Photo')} fit={!tile} draggable={false} />;
  if (!img) return null;
  return (
    <img src={imageSrc(img, 'thumb')} alt={img.title || t('Image')} loading="lazy" draggable={false} referrerpolicy="no-referrer"
      style={!tile && img.w && img.h ? { aspectRatio: `${img.w} / ${img.h}` } : undefined} />
  );
}

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
export function MediaBlock({ m, draft, editing, selected, dragging, merging, onSelect, onOpen, onResize, onDrag }: {
  m: Media;
  draft: Entry;
  editing: boolean;
  selected: boolean;
  dragging: boolean;
  merging: boolean;   // a picture is being dragged over this one, to make an album with it
  onSelect: () => void;
  onOpen: (el: HTMLElement, item: number) => void;
  onResize: (size: number) => void;
  onDrag: (e: PointerEvent, el: HTMLElement) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [live, setLive] = useState<number | null>(null); // size while pinching or pulling a corner
  const gesture = useRef<Gesture | null>(null);
  const acted = useRef(false); // the press moved, resized or picked up the picture: it isn't a tap
  const cancelGesture = useRef<(() => void) | null>(null);
  const cancelCorner = useRef<(() => void) | null>(null);
  useEffect(() => () => {
    cancelGesture.current?.();
    cancelCorner.current?.();
  }, []);

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

  const items = itemsOf(m);
  const known = (it: Item) => (it.kind === 'photo' ? draft.photos.some((p) => p.id === it.id) : draft.images.some((i) => i.url === it.url));
  if (!items.some(known)) return null;
  const album = m.kind === 'album';
  const ratio = ratioOf(m, draft);
  const img = m.kind === 'image' ? draft.images.find((i) => i.url === m.url) : undefined;
  const label = album ? t('Album of {n}', { n: items.length }) : m.kind === 'photo' ? t('Photo') : img?.title ? t('Image: {title}', { title: img.title }) : t('Image');
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
      const cleanup = () => {
        clearTimeout(cur.timer);
        removeEventListener('pointermove', move);
        removeEventListener('pointerup', up);
        removeEventListener('pointercancel', up);
        gesture.current = null;
        cancelGesture.current = null;
      };
      cancelGesture.current = cleanup;
      const up = (ev: PointerEvent) => {
        if (!cur.pts.delete(ev.pointerId) || cur.pts.size) return;
        cleanup();
        if (cur.kind !== 'pinch') return;
        setLive(null);
        if (ev.type !== 'pointercancel' && cur.pct !== undefined && cur.pct !== (m.size ?? 100)) onResize(cur.pct);
      };
      addEventListener('pointermove', move, { passive: false });
      addEventListener('pointerup', up);
      addEventListener('pointercancel', up);
      // On touch, holding a picture picks it up; a quick swipe still scrolls.
      if (editing && e.pointerType !== 'mouse' && !selected)
        cur.timer = setTimeout(() => {
          if (gesture.current !== cur || cur.kind !== 'press' || cur.pts.size !== 1) return;
          haptic(10);
          pickUp(cur.last);
        }, 300);
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
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    cancelCorner.current?.();
    const el = box.current;
    const col = colWidth();
    if (!el || !col) return;
    e.preventDefault();
    e.stopPropagation();
    const handle = e.currentTarget as HTMLElement;
    handle.setPointerCapture(e.pointerId);
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
    const cleanup = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', end);
      handle.removeEventListener('pointercancel', end);
      cancelCorner.current = null;
    };
    cancelCorner.current = cleanup;
    const end = (ev: PointerEvent) => {
      cleanup();
      setLive(null);
      if (ev.type === 'pointerup' && pct !== size) onResize(pct);
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', end);
    handle.addEventListener('pointercancel', end);
  };
  const corners: [string, -1 | 1, -1 | 1][] = [['tl', -1, -1], ['tr', 1, -1], ['bl', -1, 1], ['br', 1, 1]];

  return (
    <div
      ref={box}
      class={`media${album ? ' is-album' : ''}${align ? ' is-' + align : ''}${selected ? ' is-selected' : ''}${dragging ? ' is-dragging' : ''}${merging ? ' is-merging' : ''}${live !== null ? ' is-resizing' : ''}`}
      data-key={mediaKey(m)}
      style={{ width: `${size}%`, maxWidth: ratio ? `calc(70svh * ${ratio.toFixed(4)})` : undefined }}
      onContextMenu={(e) => editing && e.preventDefault()}
    >
      <button
        class="media-pic"
        onPointerDown={down}
        onClick={(e) => {
          if (acted.current) return void (acted.current = false);
          // in an album, the tile that was tapped opens
          const tile = (e.target as Element).closest<HTMLElement>('.album-tile');
          if (selected || !editing) onOpen(tile ?? e.currentTarget, tile ? +tile.dataset.i! : 0);
          else onSelect();
        }}
        aria-label={selected || !editing ? t('View {what}', { what: label.toLowerCase() }) : t('Select {what}', { what: label.toLowerCase() })}
        aria-pressed={editing ? selected : undefined}
      >
        {album ? (
          <div class={`album n${Math.min(TILES, items.length)}`}>
            {items.slice(0, TILES).map((it, k) => (
              <span key={itemKey(it)} class="album-tile" data-i={k}>
                <Pic it={it} draft={draft} tile />
                {k === TILES - 1 && items.length > TILES && <span class="album-more">+{items.length - TILES + 1}</span>}
              </span>
            ))}
          </div>
        ) : (
          <Pic it={items[0]} draft={draft} />
        )}
      </button>
      {merging && <span class="media-merge glass">{album ? t('Add to album') : t('Make an album')}</span>}
      {selected && !dragging &&
        corners
          // a picture on a side is pulled from its free side, the one the text is on
          .filter(([, sx]) => !align || (align === 'left' ? sx > 0 : sx < 0))
          .map(([c, sx, sy]) => <span key={c} class={`media-corner ${c}`} onPointerDown={corner(sx, sy)} aria-hidden="true" />)}
      {live !== null && <span class="media-badge glass">{live === 100 ? t('Full width') : live + '%'}</span>}
    </div>
  );
}

/**
 * The tools for the selected picture: the ribbon's Picture tab (or the bar's, on a phone). Each group carries its
 * caption, shown under it on a computer as Word does: how the text wraps around it, its size, moving it, and the
 * picture itself (view it, ungroup an album, remove it).
 */
export function MediaTools({ m, canUp, canDown, onLayout, onStep, onOpen, onRemove, onUngroup, onWrite }: {
  m: Media;
  canUp: boolean;
  canDown: boolean;
  onUngroup: () => void;
  onLayout: (l: Layout) => void;
  onStep: (dir: -1 | 1) => void;
  onOpen: () => void;
  onRemove: () => void;
  onWrite: () => void;
}) {
  const size = m.size ?? 100;
  const align = size < 100 ? m.align : undefined;
  const side = (s: Side) => onLayout(s === 'center' ? { size } : dropLayout(m, s));
  const [live, setLive] = useState<number | null>(null); // the size while the slider moves
  const shown = live ?? size;
  // The slider resizes the picture as it moves (straight on the page, without a round trip through the note),
  // and the note keeps the size it's let go at.
  const pic = () => document.querySelector<HTMLElement>(`.note-body .media[data-key="${CSS.escape(mediaKey(m))}"]`);
  const slide = (v: number) => {
    setLive(v);
    const el = pic();
    if (el) {
      el.classList.add('is-resizing');
      el.style.width = v + '%';
    }
  };
  const commit = (v: number) => {
    setLive(null);
    pic()?.classList.remove('is-resizing');
    if (v !== size) onLayout({ size: v, align: m.align });
  };
  return (
    <>
      <div class="format-group" role="group" aria-label={t('Wrap text')} data-caption={t('Wrap text')}>
        <button class="format-btn" onClick={() => side('left')} aria-pressed={align === 'left'} aria-label={t('Left, text wraps around it')} title={t('Left, text wraps around it')}>
          <Icon name="float-left" size={19} />
        </button>
        <button class="format-btn" onClick={() => side('center')} aria-pressed={!align} aria-label={t('Centre, on its own line')} title={t('Centre, on its own line')}>
          <Icon name="float-center" size={19} />
        </button>
        <button class="format-btn" onClick={() => side('right')} aria-pressed={align === 'right'} aria-label={t('Right, text wraps around it')} title={t('Right, text wraps around it')}>
          <Icon name="float-right" size={19} />
        </button>
        <button class="format-btn" onClick={onWrite} aria-label={t('Write next to it')} title={t('Write next to it')}>
          <Icon name="cursor-text" size={19} />
        </button>
      </div>
      <label class="format-group media-size" title={t('Size')} data-caption={t('Size')}>
        <input
          type="range"
          min={MIN_SIZE}
          max={100}
          step={1}
          value={shown}
          aria-label={t('Size')}
          aria-valuetext={shown === 100 ? t('Full width') : shown + '%'}
          style={{ '--v': ((shown - MIN_SIZE) / (100 - MIN_SIZE)) * 100 + '%' }}
          onInput={(e) => slide(+e.currentTarget.value)}
          onChange={(e) => commit(+e.currentTarget.value)}
        />
        <span class="media-size-value" aria-hidden="true">{shown === 100 ? t('Full') : shown + '%'}</span>
      </label>
      <div class="format-group" role="group" aria-label={t('Arrange')} data-caption={t('Arrange')}>
        <button class="format-btn" onClick={() => onStep(-1)} disabled={!canUp} aria-label={t('Move up')} title={t('Move up')}>
          <Icon name="arrow-up" size={19} />
        </button>
        <button class="format-btn" onClick={() => onStep(1)} disabled={!canDown} aria-label={t('Move down')} title={t('Move down')}>
          <Icon name="arrow-down" size={19} />
        </button>
      </div>
      <div class="format-group" role="group" aria-label={t('Picture')} data-caption={t('Picture')}>
        <button class="format-btn" onClick={onOpen} aria-label={t('View')} title={t('View')}>
          <Icon name="maximize" size={19} />
        </button>
        {m.kind === 'album' && (
          <button class="format-btn" onClick={onUngroup} aria-label={t('Ungroup the album')} title={t('Ungroup the album')}>
            <Icon name="layout-grid-remove" size={19} />
          </button>
        )}
        <button class="format-btn danger" onClick={onRemove} aria-label={m.kind === 'album' ? t('Remove the album') : t('Remove')} title={m.kind === 'album' ? t('Remove the album') : t('Remove')}>
          <Icon name="trash" size={19} />
        </button>
      </div>
    </>
  );
}

/**
 * Which side of the column a point is over: its left or right third, or the middle. Given the side it was over, it
 * stays there until the point is well into another, so a picture held near a border doesn't flicker between them.
 */
export function sideAt(x: number, col: DOMRect, was?: Side): Side {
  const f = (x - col.left) / col.width;
  const give = 0.06;
  const left = 0.34 + (was === 'left' ? give : was ? -give : 0);
  const right = 0.66 - (was === 'right' ? give : was ? -give : 0);
  return f < left ? 'left' : f > right ? 'right' : 'center';
}
