// A small map drawn by hand: OpenStreetMap's tiles under a pin for each entry, in the colour
// of the world it was felt in. Drag to move, pinch or scroll to zoom, double-tap to zoom in, arrow keys and +/− too.
// Pins that would overlap gather into one with a count; tapping it zooms in until they part, then opens them.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { Icon, Sprite } from './icons';
import { MapHeat, type HeatPoint } from './MapHeat';
import '../styles/map.css';

/** weight: how much it counts on the heat map (recency and intensity), 1 by default */
export interface Pin { id: string; lat: number; lon: number; core: string | null; weight?: number }
/** The centre, in world units (0–1 across and down, Web Mercator), and the zoom. */
export interface View { x: number; y: number; z: number }

const TILE = 256;
const MAX_Z = 18;
const CLUSTER = 40; // px: pins closer than this gather into one
const worldPx = (z: number) => TILE * 2 ** z;
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export function project(lat: number, lon: number) {
  const s = Math.sin((clamp(lat, -85, 85) * Math.PI) / 180);
  return { x: (lon + 180) / 360, y: 0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI) };
}

/** The view that shows every point with some room around them, no closer than maxZ. */
function fitView(points: { x: number; y: number }[], w: number, h: number, maxZ = 15): View {
  if (!points.length) return { x: 0.53, y: 0.33, z: 3 };
  let [x0, x1, y0, y1] = [1, 0, 1, 0];
  for (const p of points) [x0, x1, y0, y1] = [Math.min(x0, p.x), Math.max(x1, p.x), Math.min(y0, p.y), Math.max(y1, p.y)];
  const pad = 64;
  const zx = Math.log2(Math.max(1, w - pad * 2) / (Math.max(x1 - x0, 1e-9) * TILE));
  const zy = Math.log2(Math.max(1, h - pad * 2) / (Math.max(y1 - y0, 1e-9) * TILE));
  return { x: (x0 + x1) / 2, y: (y0 + y1) / 2, z: Math.min(maxZ, zx, zy) };
}

/** The world always fills the box: no zooming out past it, no panning off its edges. */
function bounded(v: View, w: number, h: number): View {
  const z = clamp(v.z, Math.max(1, Math.log2(Math.max(w, h) / TILE)), MAX_Z);
  const hx = w / 2 / worldPx(z), hy = h / 2 / worldPx(z);
  return { x: hx >= 0.5 ? 0.5 : clamp(v.x, hx, 1 - hx), y: hy >= 0.5 ? 0.5 : clamp(v.y, hy, 1 - hy), z };
}

/** The view at zoom z that keeps the world point under box point (sx, sy) where it is. */
function zoomAbout(v: View, z: number, sx: number, sy: number, w: number, h: number): View {
  const a = worldPx(v.z), b = worldPx(z);
  const wx = v.x + (sx - w / 2) / a, wy = v.y + (sy - h / 2) / a;
  return { x: wx - (sx - w / 2) / b, y: wy - (sy - h / 2) / b, z };
}

// OpenStreetMap's own tiles, fine for a site's light use when it sends its address and credits them. CSS greys them
// (and turns them dark in the dark theme) to match the app.
const tileUrl = (z: number, x: number, y: number) => `https://tile.openstreetmap.org/${z}/${x}/${y}.png`;

/** Where each remembered map was left, so coming back from a note finds it as it was. */
const remembered = new Map<string, View>();

export function PlaceMap({ pins, focus, onOpen, onTap, still, remember, heat, class: cls }: {
  pins: Pin[];
  /** start close in on this spot, instead of showing every pin */
  focus?: { lat: number; lon: number } | null;
  /** pins tapped that can't be pulled apart any further */
  onOpen?: (ids: string[]) => void;
  /** a still map is a preview: it doesn't move, and a tap anywhere calls this */
  onTap?: () => void;
  still?: boolean;
  remember?: string;
  /** lay a heat map of the pins' feelings over the tiles (components/MapHeat.tsx) */
  heat?: boolean;
  class?: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ w: 0, h: 0 });
  const size = useRef(dims);
  size.current = dims;
  const view = useRef<View | null>(null);
  const [, redraw] = useState(0);
  const frame = useRef(0);
  const anim = useRef(0);
  const draw = () => {
    if (!frame.current) frame.current = requestAnimationFrame(() => { frame.current = 0; redraw((n) => n + 1); });
  };
  const set = (v: View) => {
    view.current = bounded(v, size.current.w, size.current.h);
    if (remember) remembered.set(remember, view.current);
    draw();
  };

  const points = useMemo(() => pins.map((p) => ({ ...p, ...project(p.lat, p.lon) })), [pins]);
  const heatPoints = useMemo<HeatPoint[]>(() => points.map((p) => ({ x: p.x, y: p.y, core: p.core, weight: p.weight ?? 1 })), [points]);

  useLayoutEffect(() => {
    const el = box.current!;
    const measure = () => setDims({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(frame.current);
      cancelAnimationFrame(anim.current);
    };
  }, []);

  // the first view, once the box has a size; later resizes keep the centre
  if (dims.w && dims.h) {
    if (!view.current) {
      const start = focus ? { ...project(focus.lat, focus.lon), z: 15 } : (remember && remembered.get(remember)) || fitView(points, dims.w, dims.h);
      view.current = bounded(start, dims.w, dims.h);
    } else view.current = bounded(view.current, dims.w, dims.h);
  }

  /** Glides to a view; with an anchor, the point under it stays put all the way (zooming about a tap). */
  const fly = (to: View, anchor?: { x: number; y: number }) => {
    cancelAnimationFrame(anim.current);
    const from = view.current!;
    const t0 = performance.now();
    const ms = matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 340;
    const step = (now: number) => {
      const p = ms ? Math.min(1, (now - t0) / ms) : 1;
      const e = 1 - (1 - p) ** 3;
      const z = from.z + (to.z - from.z) * e;
      set(anchor ? zoomAbout(from, z, anchor.x, anchor.y, size.current.w, size.current.h) : { x: from.x + (to.x - from.x) * e, y: from.y + (to.y - from.y) * e, z });
      if (p < 1) anim.current = requestAnimationFrame(step);
    };
    anim.current = requestAnimationFrame(step);
  };
  const zoomBy = (dz: number, at?: { x: number; y: number }) => {
    const v = view.current;
    if (!v) return;
    const a = at ?? { x: size.current.w / 2, y: size.current.h / 2 };
    const z = clamp(v.z + dz, 1, MAX_Z);
    fly(zoomAbout(v, z, a.x, a.y, size.current.w, size.current.h), a);
  };
  const fitAll = () => points.length && fly(bounded(fitView(points, size.current.w, size.current.h), size.current.w, size.current.h));

  /* ---------- gestures ---------- */

  const ptrs = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ moved: boolean; x: number; y: number; pinch?: { d: number; mx: number; my: number; v: View } } | null>(null);
  const dragged = useRef(false);
  const lastTap = useRef({ t: 0, x: 0, y: 0 });
  const rel = (e: PointerEvent) => {
    const r = box.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const startPinch = () => {
    const [a, b] = [...ptrs.current.values()];
    gesture.current = { moved: true, x: 0, y: 0, pinch: { d: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), mx: (a.x + b.x) / 2, my: (a.y + b.y) / 2, v: view.current! } };
    dragged.current = true;
  };

  const down = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    cancelAnimationFrame(anim.current);
    const p = rel(e);
    ptrs.current.set(e.pointerId, p);
    if (ptrs.current.size === 1) {
      gesture.current = { moved: false, x: p.x, y: p.y };
      dragged.current = false;
    } else if (ptrs.current.size === 2) {
      startPinch();
      for (const id of ptrs.current.keys()) box.current!.setPointerCapture?.(id);
    }
  };
  const move = (e: PointerEvent) => {
    const prev = ptrs.current.get(e.pointerId);
    const g = gesture.current;
    const v = view.current;
    if (!prev || !g || !v) return;
    const p = rel(e);
    ptrs.current.set(e.pointerId, p);
    const { w, h } = size.current;
    if (g.pinch && ptrs.current.size >= 2) {
      const [a, b] = [...ptrs.current.values()];
      const d = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y));
      const s = g.pinch;
      const z = clamp(s.v.z + Math.log2(d / s.d), 1, MAX_Z);
      // the world point under the fingers' first midpoint follows the midpoint
      const at = zoomAbout(s.v, z, s.mx, s.my, w, h);
      const k = worldPx(z);
      set({ x: at.x - ((a.x + b.x) / 2 - s.mx) / k, y: at.y - ((a.y + b.y) / 2 - s.my) / k, z });
      return;
    }
    if (!g.moved) {
      if (Math.hypot(p.x - g.x, p.y - g.y) < 6) return;
      g.moved = true;
      dragged.current = true;
      box.current!.setPointerCapture?.(e.pointerId);
    }
    const k = worldPx(v.z);
    set({ ...v, x: v.x - (p.x - prev.x) / k, y: v.y - (p.y - prev.y) / k });
  };
  const up = (e: PointerEvent) => {
    if (!ptrs.current.delete(e.pointerId)) return;
    const g = gesture.current;
    if (g?.pinch && ptrs.current.size === 1) {
      g.pinch = undefined; // one finger stays down: it carries on moving the map
      return;
    }
    if (ptrs.current.size) return;
    gesture.current = null;
    if (e.type !== 'pointerup' || !g || g.moved || (e.target as Element).closest('.map-pin, .map-tools, .map-credit')) return;
    const now = performance.now();
    const p = rel(e);
    if (now - lastTap.current.t < 320 && Math.hypot(p.x - lastTap.current.x, p.y - lastTap.current.y) < 30) {
      lastTap.current.t = 0;
      zoomBy(1, p);
    } else lastTap.current = { t: now, x: p.x, y: p.y };
  };

  useEffect(() => {
    const el = box.current;
    if (still || !el) return;
    const wheel = (e: WheelEvent) => {
      e.preventDefault();
      const v = view.current;
      if (!v) return;
      cancelAnimationFrame(anim.current);
      const r = el.getBoundingClientRect();
      const dz = -e.deltaY * (e.deltaMode === 1 ? 0.05 : e.ctrlKey ? 0.01 : 0.002);
      set(zoomAbout(v, clamp(v.z + dz, 1, MAX_Z), e.clientX - r.left, e.clientY - r.top, size.current.w, size.current.h));
    };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => el.removeEventListener('wheel', wheel);
  }, [still]);

  const key = (e: KeyboardEvent) => {
    const v = view.current;
    if (!v || e.target !== box.current) return;
    const step = 80 / worldPx(v.z);
    const moves: Record<string, [number, number]> = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] };
    if (moves[e.key]) fly({ ...v, x: v.x + moves[e.key][0], y: v.y + moves[e.key][1] });
    else if (e.key === '+' || e.key === '=') zoomBy(1);
    else if (e.key === '-' || e.key === '_') zoomBy(-1);
    else return;
    e.preventDefault();
  };

  /* ---------- drawing ---------- */

  const v = view.current;
  const { w, h } = dims;
  const tiles: preact.JSX.Element[] = [];
  const clusters: { key: string; x: number; y: number; ids: string[]; core: string | null; members: { x: number; y: number }[] }[] = [];
  if (v && w && h) {
    const k = worldPx(v.z);
    const tz = clamp(Math.round(v.z), 0, MAX_Z);
    const n = 2 ** tz;
    const ts = k / n;
    const left = v.x * k - w / 2, top = v.y * k - h / 2;
    for (let ty = Math.max(0, Math.floor(top / ts)); ty <= Math.min(n - 1, Math.floor((top + h) / ts)); ty++)
      for (let tx = Math.max(0, Math.floor(left / ts)); tx <= Math.min(n - 1, Math.floor((left + w) / ts)); tx++) {
        const x0 = Math.round(tx * ts - left), x1 = Math.round((tx + 1) * ts - left);
        const y0 = Math.round(ty * ts - top), y1 = Math.round((ty + 1) * ts - top);
        tiles.push(
          <img
            key={`${tz}/${tx}/${ty}`}
            class="map-tile"
            src={tileUrl(tz, tx, ty)}
            alt=""
            draggable={false}
            referrerpolicy="strict-origin"
            style={{ transform: `translate(${x0}px, ${y0}px)`, width: `${x1 - x0}px`, height: `${y1 - y0}px` }}
            onLoad={(e) => e.currentTarget.classList.add('is-in')}
          />,
        );
      }

    // pins gather by a grid over the whole world, so panning doesn't reshuffle them
    const cells = new Map<string, { sx: number; sy: number; ids: string[]; cores: Map<string, number>; members: { x: number; y: number }[] }>();
    for (const p of points) {
      const sx = p.x * k - left, sy = p.y * k - top;
      if (sx < -CLUSTER || sy < -CLUSTER || sx > w + CLUSTER || sy > h + CLUSTER) continue;
      const cell = `${Math.floor((p.x * k) / CLUSTER)}:${Math.floor((p.y * k) / CLUSTER)}`;
      const c = cells.get(cell) ?? { sx: 0, sy: 0, ids: [], cores: new Map<string, number>(), members: [] };
      c.sx += sx;
      c.sy += sy;
      c.ids.push(p.id);
      c.members.push(p);
      if (p.core) c.cores.set(p.core, (c.cores.get(p.core) ?? 0) + 1);
      cells.set(cell, c);
    }
    for (const [cell, c] of cells)
      clusters.push({ key: cell, x: c.sx / c.ids.length, y: c.sy / c.ids.length, ids: c.ids, members: c.members, core: [...c.cores].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null });
  }

  const open = (c: (typeof clusters)[number]) => {
    if (dragged.current || !view.current) return;
    const to = bounded(fitView(c.members, w, h, MAX_Z - 1), w, h);
    if (c.ids.length === 1 || to.z - view.current.z < 0.5) onOpen?.(c.ids);
    else fly(to);
  };

  return (
    <div
      ref={box}
      class={`map${still ? ' is-still' : ''} ${cls ?? ''}`}
      tabIndex={0}
      role={still ? 'button' : 'application'}
      aria-label={still ? 'Open the map' : 'Map of your entries. Drag or use the arrow keys to move, + and − to zoom.'}
      onClick={still ? onTap : undefined}
      onKeyDown={still ? (e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onTap?.()) : key}
      onPointerDown={still ? undefined : down}
      onPointerMove={still ? undefined : move}
      onPointerUp={still ? undefined : up}
      onPointerCancel={still ? undefined : up}
    >
      <div class="map-tiles" aria-hidden="true">{tiles}</div>
      {heat && <MapHeat points={heatPoints} view={v} w={w} h={h} />}
      {clusters.map((c) => {
        const many = c.ids.length > 1;
        const d = many ? Math.min(44, 28 + Math.log2(c.ids.length) * 4) : 26;
        const style = { transform: `translate(${Math.round(c.x - d / 2)}px, ${Math.round(c.y - d / 2)}px)`, width: `${d}px`, height: `${d}px`, '--c': c.core ? `var(--emo-${c.core})` : 'var(--ink)' };
        const face = many ? <span>{c.ids.length}</span> : c.core ? <Sprite core={c.core} size={12} color="#fff" /> : <Icon name="notebook" size={13} stroke={2} />;
        return still ? (
          <span key={c.key} class={`map-pin${many ? ' many' : ''}`} style={style} aria-hidden="true">{face}</span>
        ) : (
          <button key={c.key} class={`map-pin${many ? ' many' : ''}`} style={style} onClick={() => open(c)} aria-label={many ? `${c.ids.length} entries here` : 'An entry here'}>
            {face}
          </button>
        );
      })}
      {!still && (
        <div class="map-tools">
          <button class="glass glass-btn round" onClick={() => zoomBy(1)} aria-label="Zoom in"><Icon name="plus" size={18} /></button>
          <button class="glass glass-btn round" onClick={() => zoomBy(-1)} aria-label="Zoom out"><Icon name="minus" size={18} /></button>
          {points.length > 0 && <button class="glass glass-btn round" onClick={fitAll} aria-label="Show every place"><Icon name="map-pins" size={18} /></button>}
        </div>
      )}
      <div class="map-credit" onClick={(e) => e.stopPropagation()}>
        © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" tabIndex={still ? -1 : 0}>OpenStreetMap</a> contributors
      </div>
    </div>
  );
}
