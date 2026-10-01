import { useEffect, useRef, useState } from 'preact/hooks';
import { MAX_ZOOM, type Cover, type Crop } from '../lib/store';
import { Icon } from './icons';
import { CoverImg } from './NoteDetails';
import { Sheet } from './Sheet';

const CENTRED: Crop = { x: 0.5, y: 0.5, zoom: 1 };
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

type Size = { w: number; h: number };
type Point = { x: number; y: number };

/**
 * Moves the picture by (dx, dy) pixels and zooms it by `by` around the box point (fx, fy), keeping whatever was under
 * that point under it (as far as the picture's edges allow). `box` is the frame, `pic` the picture's own size.
 */
function adjust(c: Crop, box: Size, pic: Size, dx: number, dy: number, by: number, fx: number, fy: number): Crop {
  const zoom = clamp(c.zoom * by, 1, MAX_ZOOM);
  const fill = Math.max(box.w / pic.w, box.h / pic.h);
  // along one axis: p is the crop's point, len the box, from/to the picture's drawn size before and after
  const axis = (p: number, len: number, from: number, to: number, f: number, d: number) => {
    if (to - len < 0.5) return p; // fits exactly: nowhere to move
    const q = p + (f - p * len) / from; // the picture's point under f
    return clamp((q * to - (f + d)) / (to - len), 0, 1);
  };
  return {
    x: axis(c.x, box.w, pic.w * fill * c.zoom, pic.w * fill * zoom, fx, dx),
    y: axis(c.y, box.h, pic.h * fill * c.zoom, pic.h * fill * zoom, fy, dy),
    zoom,
  };
}

const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
const mid = (a: Point, b: Point) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

/** Drag and pinch (or scroll to zoom) a note's cover to choose the part of it that shows. */
export function CoverCropSheet({ open, onClose, cover, onSave }: {
  open: boolean;
  onClose: () => void;
  cover: Cover | null;
  onSave: (crop: Crop | undefined) => void;
}) {
  const [crop, setCrop] = useState<Crop>(CENTRED);
  const [moving, setMoving] = useState(false);
  const frame = useRef<HTMLDivElement>(null);
  const cur = useRef(crop);
  cur.current = crop;
  const pointers = useRef(new Map<number, Point>());

  useEffect(() => {
    pointers.current.clear();
    setMoving(false);
    if (open) setCrop((cur.current = cover?.crop ?? CENTRED));
  }, [open]);

  /** Applies a move/zoom given in page pixels; ignored until the picture has loaded. */
  const change = (dx: number, dy: number, by: number, at?: Point) => {
    const el = frame.current;
    const img = el?.querySelector('img');
    if (!el || !img?.naturalWidth) return;
    const r = el.getBoundingClientRect();
    const box = { w: r.width, h: r.height };
    const f = at ? { x: at.x - r.left, y: at.y - r.top } : { x: box.w / 2, y: box.h / 2 };
    setCrop((cur.current = adjust(cur.current, box, { w: img.naturalWidth, h: img.naturalHeight }, dx, dy, by, f.x, f.y)));
  };

  const down = (e: PointerEvent) => {
    if (pointers.current.size >= 2) return;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    setMoving(true);
  };
  const move = (e: PointerEvent) => {
    const map = pointers.current;
    const prev = map.get(e.pointerId);
    if (!prev) return;
    const next = { x: e.clientX, y: e.clientY };
    const other = [...map].find(([id]) => id !== e.pointerId)?.[1];
    map.set(e.pointerId, next);
    if (!other) return change(next.x - prev.x, next.y - prev.y, 1, prev);
    // pinching: zoom by how much the fingers spread, around where they were, and follow them as they move
    const from = mid(prev, other), to = mid(next, other);
    change(to.x - from.x, to.y - from.y, dist(next, other) / Math.max(1, dist(prev, other)), from);
  };
  const up = (e: PointerEvent) => {
    pointers.current.delete(e.pointerId);
    if (!pointers.current.size) setMoving(false);
  };
  const wheel = (e: WheelEvent) => {
    e.preventDefault();
    change(0, 0, Math.exp(-e.deltaY * (e.deltaMode ? 0.05 : 0.002)), { x: e.clientX, y: e.clientY });
  };
  const key = (e: KeyboardEvent) => {
    const step = e.shiftKey ? 40 : 12;
    const moves: Record<string, [number, number, number]> = {
      ArrowLeft: [-step, 0, 1], ArrowRight: [step, 0, 1], ArrowUp: [0, -step, 1], ArrowDown: [0, step, 1],
      '+': [0, 0, 1.1], '=': [0, 0, 1.1], '-': [0, 0, 1 / 1.1],
    };
    const m = moves[e.key];
    if (!m) return;
    e.preventDefault();
    change(...m);
  };

  const centred = crop.x === 0.5 && crop.y === 0.5 && crop.zoom === 1;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Adjust cover"
      footer={
        <>
          <button class="btn btn-quiet" onClick={() => setCrop((cur.current = CENTRED))} disabled={centred}>Reset</button>
          <button class="btn btn-primary" onClick={() => { onSave(centred ? undefined : crop); onClose(); }}>Done</button>
        </>
      }
    >
      <p class="details-hint crop-hint">Drag to move it, pinch or scroll to zoom.</p>
      {cover && (
        <div
          ref={frame}
          class={`crop-frame${moving ? ' moving' : ''}`}
          tabIndex={0}
          role="application"
          aria-label="Cover picture. Arrow keys move it, plus and minus zoom."
          data-own-gestures
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerCancel={up}
          onWheel={wheel}
          onKeyDown={key}
        >
          <CoverImg cover={{ ...cover, crop }} />
        </div>
      )}
      <div class="crop-zoom">
        <Icon name="zoom-out" size={18} />
        <input
          type="range"
          min={1}
          max={MAX_ZOOM}
          step={0.01}
          value={crop.zoom}
          aria-label="Zoom"
          onInput={(e) => change(0, 0, +e.currentTarget.value / cur.current.zoom)}
        />
        <Icon name="zoom-in" size={18} />
      </div>
    </Sheet>
  );
}
