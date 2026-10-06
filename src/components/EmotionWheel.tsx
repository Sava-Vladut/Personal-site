import { useEffect, useId, useRef, useState } from 'preact/hooks';
import { CORE, EMOTION, type EmotionDef, type FamilyDef } from '../data/emotions';
import { Icon, Sprite, useSpriteIdle } from './icons';
import { haptic } from '../lib/haptics';
import { trail } from './emotion';
import { count, t } from '../lib/i18n';

/*
 * The emotion wheel: worlds in the middle ring, zones around them. Tapping a world
 * zooms in (a zoomable sunburst) so its zones and feelings fill the whole circle.
 * All geometry is in a 400×400 viewBox; angles are degrees, clockwise from 12 o'clock.
 */

// Pleasant worlds on the right half, unpleasant on the left.
const ORDER = ['love-connection', 'joy', 'calm-safety', 'hope-interest', 'fear', 'sadness', 'anger', 'shame-aversion'];
const C = 200;
const GAP = 3;       // half the gap between neighbouring segments
const MS = 480;
const HOLD_MS = 380;   // how long a press must last to open the tooltip
const SLOP = 10;       // a finger that moves further than this is scrolling, not holding
const LINGER = 1700;   // the tooltip stays a moment after letting go, so it can be read
const TIP_W = 272;
const TIP_H = 176;     // roughly; decides whether the tooltip opens above or below
const PINCH = 0.7;     // fingers closing to this share of where they started zoom back out
const LEVEL = [t('World'), t('Zone'), t('Feeling')];

interface Seg { e: EmotionDef; a0: number; a1: number }
const SEGS: Seg[] = ORDER.flatMap((id, i) => {
  const c = CORE[id];
  const out: Seg[] = [{ e: c, a0: i * 45, a1: (i + 1) * 45 }];
  c.families.forEach((f, j) => {
    const f0 = i * 45 + j * 15;
    out.push({ e: f, a0: f0, a1: f0 + 15 });
    f.feelings.forEach((x, k) => out.push({ e: x, a0: f0 + k * 7.5, a1: f0 + (k + 1) * 7.5 }));
  });
  return out;
});

/** z: 0 = overview, 1 = zoomed into a world. [d0, d1]: the arc of the overview that fills the circle. */
interface View { z: number; d0: number; d1: number }
const viewOf = (focus: string | null): View => {
  const i = focus ? ORDER.indexOf(focus) : -1;
  return i < 0 ? { z: 0, d0: 0, d1: 360 } : { z: 1, d0: i * 45, d1: (i + 1) * 45 };
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const rad = (a: number) => (a * Math.PI) / 180;
const pt = (r: number, a: number) => `${(C + r * Math.sin(rad(a))).toFixed(2)} ${(C - r * Math.cos(rad(a))).toFixed(2)}`;
const xy = (r: number, a: number) => [C + r * Math.sin(rad(a)), C - r * Math.cos(rad(a))];

function radii(depth: number, z: number): [number, number] {
  if (depth === 0) return [lerp(58, 0, z), lerp(120, 58, z)];
  if (depth === 1) return [lerp(126, 64, z), lerp(196, 128, z)];
  return [lerp(196, 134, z), 196];
}

/** Annular sector with a constant-width gap on both sides. */
function sector(r0: number, r1: number, a0: number, a1: number): string | null {
  const span = a1 - a0;
  if (r1 - r0 < 1.5 || span <= 0) return null;
  if (span >= 359.99) {
    const ring = (r: number, dir: number) => `M${C - r} ${C}a${r} ${r} 0 1 ${dir} ${2 * r} 0a${r} ${r} 0 1 ${dir} ${-2 * r} 0z`;
    return r0 < 0.5 ? ring(r1, 1) : ring(r1, 1) + ring(r0, 0);
  }
  const pad = (r: number) => (Math.asin(Math.min(1, GAP / r)) * 180) / Math.PI;
  const o0 = a0 + pad(r1), o1 = a1 - pad(r1);
  if (o1 - o0 < 0.5) return null;
  const big = o1 - o0 > 180 ? 1 : 0;
  let d = `M${pt(r1, o0)}A${r1} ${r1} 0 ${big} 1 ${pt(r1, o1)}`;
  // Where the two offset edges meet; inside that the sector is a wedge.
  const tip = span < 180 ? GAP / Math.sin(rad(span / 2)) : 0;
  if (r0 <= tip) d += `L${pt(tip, (a0 + a1) / 2)}z`;
  else {
    const i0 = a0 + pad(r0), i1 = a1 - pad(r0);
    d += `L${pt(r0, i1)}A${r0} ${r0} 0 ${i1 - i0 > 180 ? 1 : 0} 0 ${pt(r0, i0)}z`;
  }
  return d;
}

/** Arc for curved text; runs right-to-left along the bottom so the words stay upright. */
function labelArc(r: number, a0: number, a1: number) {
  const m = (a0 + a1) / 2;
  const big = a1 - a0 > 180 ? 1 : 0;
  return m > 90 && m < 270
    ? `M${pt(r, a1)}A${r} ${r} 0 ${big} 0 ${pt(r, a0)}`
    : `M${pt(r, a0)}A${r} ${r} 0 ${big} 1 ${pt(r, a1)}`;
}

/** A world's sprite drawn inside the wheel; `idle` plays its idle loop. */
function PixelSprite({ core, x, y, size, idle = false }: { core: string; x: number; y: number; size: number; idle?: boolean }) {
  const d = useSpriteIdle(core, idle);
  return (
    <path
      d={d}
      transform={`translate(${(x - size / 2).toFixed(2)} ${(y - size / 2).toFixed(2)}) scale(${size / 8})`}
      style={{ fill: `var(--emo-${core})` }}
      shape-rendering="crispEdges"
    />
  );
}

interface Tip { id: string; x: number; y: number; live: boolean }

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** The card that opens when an emotion is held: what it is, what it holds, where it sits. */
function HoldTip({ tip, width, zoomed, selected, times }: { tip: Tip; width: number; zoomed: boolean; selected: boolean; times?: number }) {
  const e = EMOTION[tip.id];
  const c = CORE[e.core];
  const fam = e.depth === 1 ? c.families.find((f) => f.id === e.id) : null;
  const near: { id: string; name: string }[] =
    e.depth === 0 ? c.families
    : e.depth === 1 ? (fam as FamilyDef).feelings
    : (c.families.find((f) => f.id === e.parent)?.feelings ?? []).filter((x) => x.id !== e.id);
  const nearLabel = [t('Zones'), t('Feelings'), t('Nearby')][e.depth];
  const w = Math.min(TIP_W, width - 8);
  const px = (tip.x / 400) * width, py = (tip.y / 400) * width;
  const left = clamp(px - w / 2, 0, Math.max(0, width - w));
  const ax = clamp(px - left, 22, w - 22);
  const below = py < TIP_H + 24;
  const hint = zoomed && e.depth === 0 ? t('Tap to go back') : selected ? t('Selected · tap to undo') : e.depth === 0 && !zoomed ? t('Tap to open this world') : t('Tap to choose');

  return (
    <div
      class={`ew-tip${below ? ' below' : ''}${tip.live ? '' : ' out'}`}
      role="tooltip"
      style={{ '--c': `var(--emo-${e.core})`, '--w': `${w}px`, '--l': `${left}px`, '--t': `${py}px`, '--ax': `${ax}px` }}
    >
      <div class="ew-tip-head">
        <span class="ew-tip-sprite"><Sprite core={e.core} size={22} idle /></span>
        <div class="ew-tip-title">
          <div class="ew-tip-name">{e.name}</div>
          <div class="ew-tip-meta">
            <span class="ew-tip-level">{LEVEL[e.depth]}</span>
            <span class="ew-tip-dot" aria-hidden="true" />
            <span>{c.valence === 'pleasant' ? t('Pleasant') : t('Unpleasant')}</span>
          </div>
          {e.depth > 0 && <div class="ew-tip-trail">{trail(e.id)}</div>}
        </div>
      </div>
      <p class="ew-tip-def">{e.def}</p>
      {near.length > 0 && (
        <div class="ew-tip-near">
          <span class="ew-tip-label">{nearLabel}</span>
          {near.map((x) => <span class="ew-tip-chip">{x.name}</span>)}
        </div>
      )}
      <div class="ew-tip-foot">
        {times !== undefined && <span class="ew-tip-count">{times ? t('Felt {count}', { count: count(times, 'time', 'times') }) : t('Not felt yet')}</span>}
        <span class="ew-tip-hint">{hint}</span>
      </div>
    </div>
  );
}

export function EmotionWheel({ focus, onFocus, onPick, selected = [], counts }: {
  focus: string | null;
  onFocus: (core: string | null) => void;
  onPick: (id: string) => void;
  selected?: string[];
  /** How many check-ins and notes touch each emotion, shown in the hold tooltip. */
  counts?: Record<string, number>;
}) {
  const uid = useId();
  const [view, setView] = useState<View>(() => viewOf(focus));
  const [hot, setHot] = useState<string | null>(null);
  const cur = useRef(view);
  cur.current = view;

  // Holding an emotion opens a tooltip; sliding a held finger across the wheel moves it along.
  const [tip, setTip] = useState<Tip | null>(null);
  const stage = useRef<HTMLDivElement>(null);
  const anchors = useRef(new Map<string, [number, number]>());
  const press = useRef<{ id: string; x: number; y: number; held: boolean; touch: boolean } | null>(null);
  const suppress = useRef(false);
  const timers = useRef<{ hold?: number; linger?: number; gone?: number }>({});
  const width = stage.current?.clientWidth ?? 320;

  const clearTimers = () => {
    clearTimeout(timers.current.hold);
    clearTimeout(timers.current.linger);
    clearTimeout(timers.current.gone);
  };
  const showTip = (id: string) => {
    const a = anchors.current.get(id);
    if (a) setTip({ id, x: a[0], y: a[1], live: true });
  };
  const endPress = () => {
    clearTimeout(timers.current.hold);
    const p = press.current;
    press.current = null;
    if (p?.held) {
      // the click that follows a hold is not a choice
      setTimeout(() => (suppress.current = false), 60);
      timers.current.linger = window.setTimeout(() => {
        setTip((t) => t && { ...t, live: false });
        timers.current.gone = window.setTimeout(() => setTip(null), 220);
      }, LINGER);
    }
  };
  const beginPress = (ev: PointerEvent, id: string) => {
    if (ev.button > 0) return;
    clearTimers();
    setTip(null);
    suppress.current = false;
    const p = { id, x: ev.clientX, y: ev.clientY, held: false, touch: ev.pointerType !== 'mouse' };
    press.current = p;
    timers.current.hold = window.setTimeout(() => {
      p.held = true;
      suppress.current = true;
      showTip(p.id);
      if (p.touch) haptic(10);
    }, HOLD_MS);
  };
  const movePress = (ev: PointerEvent) => {
    const p = press.current;
    if (!p) return;
    if (!p.held) {
      if (Math.hypot(ev.clientX - p.x, ev.clientY - p.y) > SLOP) {
        clearTimeout(timers.current.hold);
        press.current = null;
      }
      return;
    }
    const id = document.elementFromPoint(ev.clientX, ev.clientY)?.getAttribute('data-eid');
    if (id && id !== p.id) {
      p.id = id;
      showTip(id);
      // a light tick each time the finger crosses into another emotion
      if (p.touch) haptic(5);
    }
  };

  // Pinching in (or a trackpad pinch) inside a world zooms back out to all worlds.
  const live = useRef({ zoomed: false, onFocus });
  live.current = { zoomed: focus !== null, onFocus };
  const zoomOut = () => {
    if (!live.current.zoomed) return;
    live.current.zoomed = false;
    live.current.onFocus(null);
  };

  useEffect(() => {
    const el = stage.current;
    if (!el) return;
    let pinch0 = 0, wheel = 0;
    const gap = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    const start = (ev: TouchEvent) => {
      if (ev.touches.length !== 2) return;
      // a second finger means a pinch, not a hold
      clearTimeout(timers.current.hold);
      press.current = null;
      pinch0 = gap(ev.touches);
    };
    const move = (ev: TouchEvent) => {
      if (ev.touches.length === 2 && live.current.zoomed) {
        if (ev.cancelable) ev.preventDefault();
        if (pinch0 && gap(ev.touches) < pinch0 * PINCH) {
          pinch0 = 0;
          zoomOut();
        }
        return;
      }
      // once a hold has begun the finger explores the wheel instead of scrolling the page
      if (press.current?.held && ev.cancelable) ev.preventDefault();
    };
    const end = (ev: TouchEvent) => ev.touches.length < 2 && (pinch0 = 0);
    // trackpads: ctrl+wheel in most browsers, gesture events in Safari
    const onWheel = (ev: WheelEvent) => {
      if (!ev.ctrlKey || !live.current.zoomed) return;
      ev.preventDefault();
      wheel = Math.max(0, wheel + ev.deltaY);
      if (wheel > 40) {
        wheel = 0;
        zoomOut();
      }
    };
    const gesture = (ev: Event) => {
      if (!live.current.zoomed) return;
      ev.preventDefault();
      if (ev.type === 'gesturechange' && ((ev as Event & { scale?: number }).scale ?? 1) < PINCH) zoomOut();
    };
    el.addEventListener('touchstart', start, { passive: true });
    el.addEventListener('touchmove', move, { passive: false });
    el.addEventListener('touchend', end);
    el.addEventListener('touchcancel', end);
    el.addEventListener('wheel', onWheel, { passive: false });
    el.addEventListener('gesturestart', gesture);
    el.addEventListener('gesturechange', gesture);
    return () => {
      el.removeEventListener('touchstart', start);
      el.removeEventListener('touchmove', move);
      el.removeEventListener('touchend', end);
      el.removeEventListener('touchcancel', end);
      el.removeEventListener('wheel', onWheel);
      el.removeEventListener('gesturestart', gesture);
      el.removeEventListener('gesturechange', gesture);
    };
  }, []);
  useEffect(() => () => clearTimers(), []);

  // Tween between overview and zoomed views.
  useEffect(() => {
    const from = cur.current, to = viewOf(focus);
    setHot(null);
    clearTimers();
    press.current = null;
    setTip(null);
    if (from.z === to.z && from.d0 === to.d0 && from.d1 === to.d1) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return setView(to);
    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / MS), k = ease(t);
      setView({ z: lerp(from.z, to.z, k), d0: lerp(from.d0, to.d0, k), d1: lerp(from.d1, to.d1, k) });
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [focus]);

  const { z, d0, d1 } = view;
  const map = (a: number) => Math.max(0, Math.min(360, ((a - d0) / (d1 - d0)) * 360));
  const zoomed = focus !== null;
  const settled = z === 0 || z === 1;
  const outer = (1 - z) ** 2; // overview labels
  const inner = z ** 2;       // zoomed labels

  const act = (e: EmotionDef) => (suppress.current ? void 0 : zoomed ? (e.depth === 0 ? onFocus(null) : onPick(e.id)) : onFocus(e.core));
  // Tapping beside the wheel, outside its circle, also goes back to all worlds.
  const outside = (ev: MouseEvent) => {
    const t = ev.target as Element, s = stage.current;
    if (!zoomed || suppress.current || !s || !(t === ev.currentTarget || t === s || t instanceof SVGSVGElement)) return;
    const r = s.getBoundingClientRect();
    if (ev.clientY < r.top || ev.clientY > r.bottom) return;
    const far = Math.hypot(ev.clientX - (r.left + r.width / 2), ev.clientY - (r.top + r.height / 2));
    if (far > (r.width / 2) * (199 / 200)) onFocus(null);
  };
  const key = (ev: KeyboardEvent, e: EmotionDef) => {
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      act(e);
    }
  };

  const shapes = [], labels = [];
  const anchorMap = new Map<string, [number, number]>();
  for (const [n, s] of SEGS.entries()) {
    const { e } = s;
    const a0 = map(s.a0), a1 = map(s.a1);
    const [r0, r1] = radii(e.depth, z);
    const d = sector(r0, r1, a0, a1);
    if (!d) continue;
    anchorMap.set(e.id, xy((r0 + r1) / 2, (a0 + a1) / 2) as [number, number]);
    const isFocus = zoomed && e.depth === 0;
    const tabbable = settled && (zoomed ? e.core === focus : e.depth === 0);
    const cls = `ew-seg d${e.depth}${hot === e.id ? ' hot' : ''}${selected.includes(e.id) ? ' on' : ''}${tip?.id === e.id ? ' held' : ''}${
      selected.some((x) => x.startsWith(e.id + '/')) ? ' has' : ''}`;
    shapes.push(
      <path
        d={d}
        class={cls}
        style={{ '--c': `var(--emo-${e.core})` }}
        data-eid={e.id}
        role="button"
        tabIndex={tabbable ? 0 : -1}
        aria-label={isFocus ? t('Back to all worlds') : e.name}
        aria-pressed={selected.includes(e.id)}
        onClick={() => act(e)}
        onPointerDown={(ev) => beginPress(ev as PointerEvent, e.id)}
        onKeyDown={(ev) => key(ev as KeyboardEvent, e)}
        onPointerEnter={(ev) => ev.pointerType === 'mouse' && setHot(e.id)}
        onPointerLeave={() => setHot((h) => (h === e.id ? null : h))}
        onFocus={() => setHot(e.id)}
        onBlur={() => setHot((h) => (h === e.id ? null : h))}
      />,
    );

    const m = (a0 + a1) / 2, rm = (r0 + r1) / 2;
    if (e.depth === 0 && outer > 0.01 && !isFocus) {
      const [x, y] = xy(rm, m);
      labels.push(
        <g opacity={outer}>
          <PixelSprite core={e.core} x={x} y={y - 9} size={20} />
          <text x={x} y={y + 17} class={`ew-core-label${hot === e.id ? ' hot' : ''}`}>{e.name.split(' / ')[0]}</text>
        </g>,
      );
    } else if (e.depth === 1 && outer > 0.01 && a1 - a0 > 4) {
      const [x, y] = xy(rm, m);
      labels.push(
        <text class="ew-fam-label" opacity={outer} transform={`translate(${x.toFixed(2)} ${y.toFixed(2)}) rotate(${(m < 180 ? m - 90 : m + 90).toFixed(2)})`} dy="0.35em">
          {e.name}
        </text>,
      );
    }
    if (e.depth > 0 && inner > 0.01 && e.core === focus && a1 - a0 > 20) {
      const id = `${uid}-${n}`;
      labels.push(
        <g opacity={inner}>
          <path id={id} d={labelArc(rm, a0, a1)} fill="none" />
          <text class={`ew-arc-label d${e.depth}`} dy="0.35em">
            <textPath href={`#${id}`} startOffset="50%">{e.name}</textPath>
          </text>
        </g>,
      );
    }
  }

  anchors.current = anchorMap;
  const info = hot ? EMOTION[hot] : zoomed ? CORE[focus] : null;
  const core = focus ? CORE[focus] : null;

  return (
    <div class={`ew${tip?.live ? ' holding' : ''}`} onClick={outside} onKeyDown={(ev) => ev.key === 'Escape' && (tip ? setTip(null) : zoomed && onFocus(null))}>
      <div class="ew-stage" ref={stage}>
      <svg
        class="ew-svg" viewBox="0 0 400 400" role="group" aria-label={core ? t('{world}: zones and feelings', { world: core.name }) : t('Emotion wheel')}
        onPointerMove={(ev) => movePress(ev as PointerEvent)}
        onPointerUp={endPress}
        onPointerCancel={endPress}
        onPointerLeave={(ev) => ev.pointerType === 'mouse' && endPress()}
        onContextMenu={(ev) => press.current && ev.preventDefault()}
      >
        {z < 1 && <circle cx={C} cy={C} r={lerp(52, 0, z)} class="ew-hub" />}
        {shapes}
        <g class="ew-labels">
        {labels}
        {z < 1 && !hot && (
          <text x={C} y={C} class="ew-hub-hint" opacity={outer} dy="0.35em">{t('Pick a world')}</text>
        )}
        {z < 1 && hot && EMOTION[hot]?.depth < 2 && (
          <g opacity={outer}>
            <PixelSprite core={EMOTION[hot].core} x={C} y={C - 8} size={22} idle />
            <text x={C} y={C + 18} class="ew-hub-hint">{EMOTION[hot].name.split(' / ')[0]}</text>
          </g>
        )}
        {core && inner > 0.01 && (
          <g opacity={inner}>
            <PixelSprite core={core.id} x={C} y={C - 16} size={24} idle />
            <text x={C} y={C + 13} class="ew-hub-name">{core.name.split(' / ')[0]}</text>
            <text x={C} y={C + 31} class="ew-hub-back">{t('Back')}</text>
          </g>
        )}
        </g>
      </svg>
      {tip && <HoldTip tip={tip} width={width} zoomed={zoomed} selected={selected.includes(tip.id)} times={counts ? counts[tip.id] ?? 0 : undefined} />}
      </div>

      <div class="ew-caption">
        {info ? (
          <>
            <div class="ew-cap-head">
              <Sprite core={info.core} size={16} />
              <span class="ew-cap-name">{info.depth === 0 ? info.name.split(' / ')[0] : info.name}</span>
              {info.depth > 0 && <span class="ew-cap-path">{trail(info.id)}</span>}
            </div>
            <p class="world-def">{info.def}</p>
          </>
        ) : (
          <p class="world-def">{t('Start from the world that feels closest — there are no wrong answers.')}</p>
        )}
      </div>

      {core && (
        <div class="row gap-s ew-actions">
          <button class="btn btn-quiet" onClick={() => onFocus(null)}><Icon name="chevron-left" size={18} /> {t('All worlds')}</button>
          <button class="btn btn-quiet grow" aria-pressed={selected.includes(core.id)} onClick={() => onPick(core.id)}>
            {t('Just “{world}”', { world: core.name.split(' / ')[0] })}
          </button>
        </div>
      )}
    </div>
  );
}
