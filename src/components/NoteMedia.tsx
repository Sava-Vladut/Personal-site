import { useEffect, useRef, useState } from 'preact/hooks';
import { itemKey, itemRatio, itemsOf, mediaKey, MIN_SIZE, rowRatios, type Item, type Layout, type Media } from '../lib/body';
import { imageSrc } from '../lib/images';
import type { Entry } from '../lib/store';
import { Icon } from './icons';
import { Sheet } from './Sheet';
import { PhotoImg } from './Photo';
import { t } from '../lib/i18n';
import { haptic } from '../lib/haptics';

export type Side = 'left' | 'center' | 'right';

/** A size in % of the column, from a width in px: any size in between, no steps. */
const pctOf = (w: number, col: number) => Math.round(Math.min(100, Math.max(MIN_SIZE, (w / col) * 100)));
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

/** One picture, filling its box. Its alt text is the one written for it (`alt`), else what it is. */
function Pic({ it, draft, tile, alt }: { it: Item; draft: Entry; tile?: boolean; alt?: string }) {
  const photo = it.kind === 'photo' ? draft.photos.find((p) => p.id === it.id) : undefined;
  const img = it.kind === 'image' ? draft.images.find((i) => i.url === it.url) : undefined;
  if (photo) return <PhotoImg photo={photo} alt={alt || t('Photo')} fit={!tile} draggable={false} />;
  if (!img) return null;
  return (
    <img src={imageSrc(img, 'thumb')} alt={alt || img.title || t('Image')} loading="lazy" draggable={false} referrerpolicy="no-referrer"
      style={!tile && img.w && img.h ? { aspectRatio: `${img.w} / ${img.h}` } : undefined} />
  );
}

/** Where a picture lands when dropped: its size (a side picture is at most half the column) and side. */
export function dropLayout(m: Layout, side: Side): Layout {
  const size = m.size ?? 100;
  return side === 'center' ? { size } : { size: size >= 100 ? 50 : size, align: side };
}

/** Which of a row's pictures (its tiles in `box`) is under a point across, or -1. */
export function tileAt(box: Element, x: number): number {
  const tiles = [...box.querySelectorAll<HTMLElement>('.row-tile')];
  return tiles.findIndex((el) => {
    const r = el.getBoundingClientRect();
    return x >= r.left - 2 && x <= r.right + 2;
  });
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
  /** pressed on one picture of the selected row: that one is dragged, not the row */
  tile?: { el: HTMLElement; item: Item };
}

/**
 * A photo or web image in a note, or a row of them side by side. Smaller than full width, it sits on the left or right
 * with the text wrapping around it, or centred on its own. Tap to select it: a small bar over it sets its side, its
 * caption or takes it out; pull a corner (or pinch) to resize, and drag it — or its handle in the bar — anywhere to
 * move it. On touch, holding a picture that isn't selected picks it up too. In a selected row, each picture is
 * dragged on its own: to another place in the row, out of it to stand alone, or onto another picture. Selected, a tap
 * opens it full screen.
 */
export function MediaBlock({ m, draft, editing, selected, dragging, merging = null, lifted = null, onSelect, onOpen, onResize, onDrag, onSide, onCaption, onRemove, onSplit }: {
  m: Media;
  draft: Entry;
  editing: boolean;
  selected: boolean;
  dragging: boolean;
  /** a picture is being dragged over this one, to stand beside it: where among its pictures it would go */
  merging?: { at: number; own: boolean } | null;
  /** which of the row's pictures is being dragged out of it (its itemKey) */
  lifted?: string | null;
  onSelect: () => void;
  onOpen: (el: HTMLElement, item: number) => void;
  onResize: (size: number) => void;
  /** picked up: the whole picture or row (`el` its box), or one picture of a row (`el` its tile) */
  onDrag: (e: PointerEvent, el: HTMLElement, item?: Item) => void;
  onSide?: (side: Side) => void;
  onCaption?: () => void;
  onRemove?: () => void;
  onSplit?: () => void;
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

  const known = (it: Item) => (it.kind === 'photo' ? draft.photos.some((p) => p.id === it.id) : draft.images.some((i) => i.url === it.url));
  const items = itemsOf(m).filter(known);
  if (!items.length) return null;
  const row = m.kind === 'album' && items.length > 1;
  const ratios = row ? rowRatios(items, draft) : [];
  const ratio = row ? sum(ratios) : itemRatio(items[0], draft);
  const img = m.kind === 'image' ? draft.images.find((i) => i.url === m.url) : undefined;
  const label = row ? t('{n} pictures side by side', { n: items.length }) : m.kind === 'photo' ? t('Photo') : img?.title ? t('Image: {title}', { title: img.title }) : t('Image');
  const size = live ?? m.size ?? 100;
  const align = size < 100 ? m.align : undefined;
  const side: Side = align ?? 'center';
  const colWidth = () => box.current?.parentElement?.clientWidth ?? 0;
  // where the line marking a drop beside this picture goes, across it: before picture `at` of the row (or after the last)
  const insertAt = merging && (row ? (sum(ratios.slice(0, merging.at)) / ratio) * 100 : merging.at > 0 ? 100 : 0);

  const down = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    let g = gesture.current;
    if (!g) {
      acted.current = false;
      const cur: Gesture = (g = gesture.current = { pts: new Map(), kind: 'press', x0: e.clientX, y0: e.clientY, last: e, d0: 0, w0: 0, col: 0 });
      // in the selected row, the picture pressed is the one that moves
      if (row && selected && editing) {
        const k = tileAt(box.current!, e.clientX);
        const el = k >= 0 ? box.current!.querySelectorAll<HTMLElement>('.row-tile')[k] : null;
        if (el) cur.tile = { el, item: items[k] };
      }
      const pickUp = (ev: PointerEvent) => {
        clearTimeout(cur.timer);
        cur.kind = 'done';
        acted.current = true;
        if (cur.tile) onDrag(ev, cur.tile.el, cur.tile.item);
        else onDrag(ev, box.current!);
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

  // The bar's handle picks the whole picture (or row) up at once, with a mouse or a finger: no holding first.
  const grip = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();
    if (e.pointerType !== 'mouse') haptic(10);
    onDrag(e, box.current!);
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
    // (the picture's own box: a caption under it isn't pulled)
    const r = (el.querySelector('.media-pic') ?? el).getBoundingClientRect();
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
  // (kept while it's dragged, only hidden: the finger that pressed its handle is still on it)
  const tools = editing && selected && live === null && !!onSide;
  const sides: [Side, 'float-left' | 'float-center' | 'float-right', string][] = [
    ['left', 'float-left', t('Left, text wraps around it')],
    ['center', 'float-center', t('Centre, on its own line')],
    ['right', 'float-right', t('Right, text wraps around it')],
  ];

  return (
    <div
      ref={box}
      class={`media${row ? ' is-row' : ''}${align ? ' is-' + align : ''}${selected ? ' is-selected' : ''}${dragging ? ' is-dragging' : ''}${merging ? ' is-merging' : ''}${live !== null ? ' is-resizing' : ''}`}
      data-key={mediaKey(m)}
      style={{ width: `${size}%`, maxWidth: ratio ? `calc(70svh * ${ratio.toFixed(4)})` : undefined }}
      onContextMenu={(e) => editing && e.preventDefault()}
    >
      {/* the picture and its handles; its caption, when it has one, under it */}
      <div class="media-frame">
        <button
          class="media-pic"
          onPointerDown={down}
          onClick={(e) => {
            if (acted.current) return void (acted.current = false);
            // in a row, the picture that was tapped opens
            const k = row ? Math.max(0, tileAt(e.currentTarget, e.clientX)) : 0;
            const tile = row ? e.currentTarget.querySelectorAll<HTMLElement>('.row-tile')[k] : undefined;
            if (selected || !editing) onOpen(tile ?? e.currentTarget, k);
            else onSelect();
          }}
          aria-label={selected || !editing ? t('View {what}', { what: (m.alt || label.toLowerCase()) }) : t('Select {what}', { what: (m.alt || label.toLowerCase()) })}
          aria-pressed={editing ? selected : undefined}
        >
          {row ? (
            <div class="pic-row" style={{ aspectRatio: ratio.toFixed(4) }}>
              {items.map((it, k) => (
                <span key={itemKey(it)} class={`row-tile${lifted === itemKey(it) ? ' is-lifted' : ''}`} data-i={k} style={{ flexGrow: ratios[k].toFixed(4) }}>
                  <Pic it={it} draft={draft} tile alt={m.alt} />
                </span>
              ))}
            </div>
          ) : (
            <Pic it={items[0]} draft={draft} alt={m.alt} />
          )}
        </button>
        {merging && <span class="media-insert" style={{ left: `${insertAt}%` }} aria-hidden="true" />}
        {merging && !merging.own && <span class="media-merge glass">{row ? t('Add to the row') : t('Side by side')}</span>}
        {selected && !dragging &&
          corners
            // a picture on a side is pulled from its free side, the one the text is on
            .filter(([, sx]) => !align || (align === 'left' ? sx > 0 : sx < 0))
            .map(([c, sx, sy]) => <span key={c} class={`media-corner ${c}`} onPointerDown={corner(sx, sy)} aria-hidden="true" />)}
        {live !== null && <span class="media-badge glass">{live === 100 ? t('Full width') : live + '%'}</span>}
        {tools && (
          // the few things done most to a picture, right over it: the rest are in the ribbon's Picture tab
          <div class="media-quick glass" role="toolbar" aria-label={t('Picture')}>
            <span class="media-grip" onPointerDown={grip} title={t('Drag to move')} aria-hidden="true">
              <Icon name="grip-vertical" size={18} />
            </span>
            {sides.map(([s, icon, name]) => (
              <button key={s} class="media-quick-btn" onClick={() => onSide!(s)} aria-pressed={side === s} aria-label={name} title={name}>
                <Icon name={icon} size={18} />
              </button>
            ))}
            <span class="media-quick-sep" aria-hidden="true" />
            <button class="media-quick-btn" onClick={onCaption} aria-pressed={!!m.caption} aria-label={t('Caption')} title={t('Caption')}>
              <Icon name="text-caption" size={18} />
            </button>
            {row && onSplit && (
              <button class="media-quick-btn" onClick={onSplit} aria-label={t('Split the row')} title={t('Split the row')}>
                <Icon name="layout-grid-remove" size={18} />
              </button>
            )}
            <button class="media-quick-btn danger" onClick={onRemove} aria-label={row ? t('Remove the pictures') : t('Remove')} title={row ? t('Remove the pictures') : t('Remove')}>
              <Icon name="trash" size={18} />
            </button>
          </div>
        )}
      </div>
      {m.caption && <p class="media-caption">{m.caption}</p>}
    </div>
  );
}

/**
 * The tools for the selected picture: the ribbon's Picture tab (or the bar's, on a phone). Each group carries its
 * caption, shown under it on a computer as Word does: how the text wraps around it, its size, moving it, and the
 * picture itself (view it, put another in its place, split a row, remove it).
 */
export function MediaTools({ m, canUp, canDown, onLayout, onStep, onOpen, onRemove, onUngroup, onReplace, onWrite, onText }: {
  m: Media;
  /** Alt Text or Caption: the sheet to write it in */
  onText: (kind: 'alt' | 'caption') => void;
  canUp: boolean;
  canDown: boolean;
  onUngroup: () => void;
  /** a photo from the device in its place (a picture on its own) */
  onReplace?: () => void;
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
          <Icon name="float-left" size={18} />
        </button>
        <button class="format-btn" onClick={() => side('center')} aria-pressed={!align} aria-label={t('Centre, on its own line')} title={t('Centre, on its own line')}>
          <Icon name="float-center" size={18} />
        </button>
        <button class="format-btn" onClick={() => side('right')} aria-pressed={align === 'right'} aria-label={t('Right, text wraps around it')} title={t('Right, text wraps around it')}>
          <Icon name="float-right" size={18} />
        </button>
        <button class="format-btn" onClick={onWrite} aria-label={t('Write next to it')} title={t('Write next to it')}>
          <Icon name="cursor-text" size={18} />
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
      <div class="format-group" role="group" aria-label={t('Describe')} data-caption={t('Describe')}>
        <button class="format-btn" onClick={() => onText('alt')} aria-pressed={!!m.alt} aria-label={t('Alt text')} title={m.alt ? `${t('Alt text')}: ${m.alt}` : t('Alt text')}>
          <Icon name="accessible" size={18} />
        </button>
        <button class="format-btn" onClick={() => onText('caption')} aria-pressed={!!m.caption} aria-label={t('Caption')} title={m.caption ? `${t('Caption')}: ${m.caption}` : t('Caption')}>
          <Icon name="text-caption" size={18} />
        </button>
      </div>
      <div class="format-group" role="group" aria-label={t('Arrange')} data-caption={t('Arrange')}>
        <button class="format-btn" onClick={() => onStep(-1)} disabled={!canUp} aria-label={t('Move up')} title={t('Move up')}>
          <Icon name="arrow-up" size={18} />
        </button>
        <button class="format-btn" onClick={() => onStep(1)} disabled={!canDown} aria-label={t('Move down')} title={t('Move down')}>
          <Icon name="arrow-down" size={18} />
        </button>
      </div>
      <div class="format-group" role="group" aria-label={t('Picture')} data-caption={t('Picture')}>
        <button class="format-btn" onClick={onOpen} aria-label={t('View')} title={t('View')}>
          <Icon name="maximize" size={18} />
        </button>
        {m.kind !== 'album' && onReplace && (
          <button class="format-btn" onClick={onReplace} aria-label={t('Replace the picture')} title={t('Replace the picture')}>
            <Icon name="photo-edit" size={18} />
          </button>
        )}
        {m.kind === 'album' && (
          <button class="format-btn" onClick={onUngroup} aria-label={t('Split the row')} title={t('Split the row')}>
            <Icon name="layout-grid-remove" size={18} />
          </button>
        )}
        <button class="format-btn danger" onClick={onRemove} aria-label={m.kind === 'album' ? t('Remove the pictures') : t('Remove')} title={m.kind === 'album' ? t('Remove the pictures') : t('Remove')}>
          <Icon name="trash" size={18} />
        </button>
      </div>
    </>
  );
}

/**
 * Word's Alt Text and Insert Caption for the selected picture: a sheet to write it in. The words are kept on one line;
 * none (or Remove) takes it off.
 */
export function PictureTextSheet({ kind, m, onClose, onDone }: {
  kind: 'alt' | 'caption' | null;
  m: Media | null;
  onClose: () => void;
  onDone: (kind: 'alt' | 'caption', text: string) => void;
}) {
  const [text, setText] = useState('');
  const was = (kind && m?.[kind]) || '';
  useEffect(() => {
    if (kind) setText(was);
  }, [kind]);
  const save = () => kind && onDone(kind, text);
  return (
    <Sheet
      open={!!kind}
      onClose={onClose}
      title={kind === 'alt' ? t('Alt text') : t('Caption')}
      footer={
        <div class="row gap-s">
          {was && <button class="btn btn-quiet" onClick={() => kind && onDone(kind, '')}><Icon name="trash" size={18} /> {t('Remove')}</button>}
          <button class="btn btn-primary grow" onClick={save} disabled={!text.trim() && !was}>{t('Done')}</button>
        </div>
      }
    >
      <div class="link-form">
        <label class="field-label" for="picture-text">{kind === 'alt' ? t('Describe the picture for someone who can’t see it') : t('Words shown under the picture')}</label>
        <textarea
          id="picture-text"
          class="input"
          rows={kind === 'alt' ? 3 : 2}
          maxLength={500}
          value={text}
          placeholder={kind === 'alt' ? t('A boat on a calm lake at sunset') : t('Our first morning by the lake')}
          onInput={(e) => setText(e.currentTarget.value)}
          // Enter is Done: the words stay on one line
          onKeyDown={(e) => e.key === 'Enter' && !e.isComposing && (e.preventDefault(), save())}
          autoFocus
        />
      </div>
    </Sheet>
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
