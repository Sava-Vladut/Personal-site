import { useEffect, useId, useRef, useState } from 'preact/hooks';
import { CORE, EMOTION, type EmotionDef } from '../data/emotions';
import { Icon, Sprite, spritePath } from './icons';
import { trail } from './emotion';

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

function PixelSprite({ core, x, y, size }: { core: string; x: number; y: number; size: number }) {
  return (
    <path
      d={spritePath(core)}
      transform={`translate(${(x - size / 2).toFixed(2)} ${(y - size / 2).toFixed(2)}) scale(${size / 8})`}
      style={{ fill: `var(--emo-${core})` }}
      shape-rendering="crispEdges"
    />
  );
}

export function EmotionWheel({ focus, onFocus, onPick, selected = [] }: {
  focus: string | null;
  onFocus: (core: string | null) => void;
  onPick: (id: string) => void;
  selected?: string[];
}) {
  const uid = useId();
  const [view, setView] = useState<View>(() => viewOf(focus));
  const [hot, setHot] = useState<string | null>(null);
  const cur = useRef(view);
  cur.current = view;

  // Tween between overview and zoomed views.
  useEffect(() => {
    const from = cur.current, to = viewOf(focus);
    setHot(null);
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

  const act = (e: EmotionDef) => (zoomed ? (e.depth === 0 ? onFocus(null) : onPick(e.id)) : onFocus(e.core));
  const key = (ev: KeyboardEvent, e: EmotionDef) => {
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      act(e);
    }
  };

  const shapes = [], labels = [];
  for (const [n, s] of SEGS.entries()) {
    const { e } = s;
    const a0 = map(s.a0), a1 = map(s.a1);
    const [r0, r1] = radii(e.depth, z);
    const d = sector(r0, r1, a0, a1);
    if (!d) continue;
    const isFocus = zoomed && e.depth === 0;
    const tabbable = settled && (zoomed ? e.core === focus : e.depth === 0);
    const cls = `ew-seg d${e.depth}${hot === e.id ? ' hot' : ''}${selected.includes(e.id) ? ' on' : ''}${
      selected.some((x) => x.startsWith(e.id + '/')) ? ' has' : ''}`;
    shapes.push(
      <path
        d={d}
        class={cls}
        style={{ '--c': `var(--emo-${e.core})` }}
        role="button"
        tabIndex={tabbable ? 0 : -1}
        aria-label={isFocus ? 'Back to all worlds' : e.name}
        aria-pressed={selected.includes(e.id)}
        onClick={() => act(e)}
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

  const info = hot ? EMOTION[hot] : zoomed ? CORE[focus] : null;
  const core = focus ? CORE[focus] : null;

  return (
    <div class="ew" onKeyDown={(ev) => ev.key === 'Escape' && zoomed && onFocus(null)}>
      <svg class="ew-svg" viewBox="0 0 400 400" role="group" aria-label={core ? `${core.name}: zones and feelings` : 'Emotion wheel'}>
        {z < 1 && <circle cx={C} cy={C} r={lerp(52, 0, z)} class="ew-hub" />}
        {shapes}
        <g class="ew-labels">
        {labels}
        {z < 1 && !hot && (
          <text x={C} y={C} class="ew-hub-hint" opacity={outer} dy="0.35em">Pick a world</text>
        )}
        {z < 1 && hot && EMOTION[hot]?.depth < 2 && (
          <g opacity={outer}>
            <PixelSprite core={EMOTION[hot].core} x={C} y={C - 8} size={22} />
            <text x={C} y={C + 18} class="ew-hub-hint">{EMOTION[hot].name.split(' / ')[0]}</text>
          </g>
        )}
        {core && inner > 0.01 && (
          <g opacity={inner}>
            <PixelSprite core={core.id} x={C} y={C - 16} size={24} />
            <text x={C} y={C + 13} class="ew-hub-name">{core.name.split(' / ')[0]}</text>
            <text x={C} y={C + 31} class="ew-hub-back">Back</text>
          </g>
        )}
        </g>
      </svg>

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
          <p class="world-def">Start from the world that feels closest — there are no wrong answers.</p>
        )}
      </div>

      {core && (
        <div class="row gap-s ew-actions">
          <button class="btn btn-quiet" onClick={() => onFocus(null)}><Icon name="chevron-left" size={18} /> All worlds</button>
          <button class="btn btn-quiet grow" aria-pressed={selected.includes(core.id)} onClick={() => onPick(core.id)}>
            Just “{core.name.split(' / ')[0]}”
          </button>
        </div>
      )}
    </div>
  );
}
