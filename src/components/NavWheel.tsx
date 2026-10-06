import { createPortal } from 'preact/compat';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { WHEEL, type WheelNode } from '../data/wheel';
import { navigateAfterSheet, pushBack } from '../lib/router';
import { haptic } from '../lib/haptics';
import { LOCALE, t } from '../lib/i18n';
import { compact, usePoints } from '../lib/twitch';
import { Icon } from './icons';
import { RAMPS, Sky } from './Sky';
import '../styles/wheel.css';

/*
 * The wheel everything else lives on: a button that opens a sky of its own with a wheel in it.
 * Only one ring shows at a time, so it never crowds: the categories first, and tapping one zooms
 * in (like the emotion wheel) so what's inside takes the ring and the category becomes the middle,
 * which takes you back out. It sways a little while it waits, and a ring of letters drifts around it.
 * All geometry is in a 400×400 viewBox; angles are degrees, clockwise from 12 o'clock.
 */

const C = 200;
const GAP = 3;
const MS = 480;
const CLOSE_MS = 340;
const OUT = 196;
// The rings, by how many levels below the one in view: gone, the middle, the ring, and everything deeper (hidden at the rim)
const STOPS: [number, number][] = [[0, 0], [0, 58], [64, OUT], [OUT, OUT]];

interface Seg { n: WheelNode; depth: number; a0: number; a1: number; hue: string; parent: Seg | null; leaf: boolean; k: number }

/** Every node with its arc of the full wheel; a node's children share its arc equally. */
function layout(tree: WheelNode[]): Seg[] {
  const out: Seg[] = [];
  let k = 0;
  const lay = (list: WheelNode[], depth: number, a0: number, a1: number, parent: Seg | null) => {
    const span = (a1 - a0) / list.length;
    let a = a0;
    for (const n of list) {
      const s: Seg = { n, depth, a0: a, a1: a + span, hue: n.hue ?? parent?.hue ?? 'sadness', parent, leaf: !n.kids?.length, k: parent ? parent.k : k++ };
      out.push(s);
      if (n.kids?.length) lay(n.kids, depth + 1, a, a + span, s);
      a += span;
    }
  };
  lay(tree, 0, 0, 360, null);
  return out;
}

/** The tree without the actions this page doesn't offer, and without categories left empty. */
function prune(list: WheelNode[], runs: Record<string, unknown>): WheelNode[] {
  return list.flatMap((n) => {
    if (n.run && !runs[n.run]) return [];
    if (!n.kids) return [n];
    const kids = prune(n.kids, runs);
    return kids.length ? [{ ...n, kids }] : [];
  });
}

/** z: how many levels in. [d0, d1]: the arc of the full wheel that fills the circle. */
interface View { z: number; d0: number; d1: number }
const viewOf = (s: Seg | null): View => (s ? { z: s.depth + 1, d0: s.a0, d1: s.a1 } : { z: 0, d0: 0, d1: 360 });

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
const rad = (a: number) => (a * Math.PI) / 180;
const pt = (r: number, a: number) => `${(C + r * Math.sin(rad(a))).toFixed(2)} ${(C - r * Math.cos(rad(a))).toFixed(2)}`;
const xy = (r: number, a: number) => [C + r * Math.sin(rad(a)), C - r * Math.cos(rad(a))];

function ring(rel: number): [number, number] {
  const x = Math.min(3, Math.max(0, rel + 2));
  const i = Math.min(2, Math.floor(x)), f = x - i;
  return [lerp(STOPS[i][0], STOPS[i + 1][0], f), lerp(STOPS[i][1], STOPS[i + 1][1], f)];
}

/** Annular sector with a constant-width gap on both sides. */
function sector(r0: number, r1: number, a0: number, a1: number): string | null {
  const span = a1 - a0;
  if (r1 - r0 < 1.5 || span <= 0) return null;
  if (span >= 359.99) {
    const loop = (r: number, dir: number) => `M${C - r} ${C}a${r} ${r} 0 1 ${dir} ${2 * r} 0a${r} ${r} 0 1 ${dir} ${-2 * r} 0z`;
    return r0 < 0.5 ? loop(r1, 1) : loop(r1, 1) + loop(r0, 0);
  }
  const pad = (r: number) => (Math.asin(Math.min(1, GAP / r)) * 180) / Math.PI;
  const o0 = a0 + pad(r1), o1 = a1 - pad(r1);
  if (o1 - o0 < 0.5) return null;
  let d = `M${pt(r1, o0)}A${r1} ${r1} 0 ${o1 - o0 > 180 ? 1 : 0} 1 ${pt(r1, o1)}`;
  const tip = span < 180 ? GAP / Math.sin(rad(span / 2)) : 0;
  if (r0 <= tip) d += `L${pt(tip, (a0 + a1) / 2)}z`;
  else {
    const i0 = a0 + pad(r0), i1 = a1 - pad(r0);
    d += `L${pt(r0, i1)}A${r0} ${r0} 0 ${i1 - i0 > 180 ? 1 : 0} 0 ${pt(r0, i0)}z`;
  }
  return d;
}

/** A ring of the sky's letters, spaced out to go once around. */
function Letters({ r, world, class: cls }: { r: number; world: string; class: string }) {
  const ramp = (RAMPS[world] ?? RAMPS.default).slice(1).flatMap((level) => [...level.replace(/\s/g, '')]);
  const n = Math.round((2 * Math.PI * r) / 13);
  const text = Array.from({ length: n }, (_, i) => ramp[(i * 5 + (i >> 2)) % ramp.length]).join('');
  const id = `nw-ring-${r}`;
  return (
    <g class={cls} aria-hidden="true">
      <path id={id} d={`M${C} ${C - r}a${r} ${r} 0 1 1 0 ${2 * r}a${r} ${r} 0 1 1 0 ${-2 * r}`} fill="none" />
      <text><textPath href={`#${id}`} textLength={2 * Math.PI * r - 8} lengthAdjust="spacing">{text}</textPath></text>
    </g>
  );
}

/**
 * The wheel on the button: a ring of the categories' colours that turns, a wave of light running
 * round it, a spark circling the other way and a glow behind, so it reads as the way into everything.
 */
function WheelMark() {
  const tops = layout(WHEEL).filter((s) => s.depth === 0);
  const r = 13, gap = 9; // gap in degrees between the arcs, so they stay separate at this size
  const at = (a: number) => `${(20 + r * Math.sin(rad(a))).toFixed(2)} ${(20 - r * Math.cos(rad(a))).toFixed(2)}`;
  return (
    <span class="nw-mark-wrap" aria-hidden="true">
      <svg class="nw-mark" width="34" height="34" viewBox="0 0 40 40">
        <g class="nw-mark-arcs">
          {tops.map((s, k) => (
            <path
              d={`M${at(s.a0 + gap / 2)}A${r} ${r} 0 0 1 ${at(s.a1 - gap / 2)}`}
              style={{ stroke: `var(--emo-${s.hue})`, '--k': k, '--n': tops.length }}
            />
          ))}
        </g>
        <g class="nw-mark-orbit"><circle cx="20" cy="2.6" r="1.6" /></g>
        <circle cx="20" cy="20" r="4.2" class="nw-mark-hub" />
      </svg>
    </span>
  );
}

/**
 * world: the sky's colour while you're on the outer ring (the page's own, usually).
 * runs: what the page can do from the wheel (`run` nodes without one aren't shown); active: which of those are on.
 */
export function NavWheel({ world, runs = {}, active = {} }: {
  world?: string | null;
  runs?: Record<string, () => void>;
  active?: Record<string, boolean>;
}) {
  const [open, setOpen] = useState(false);
  const [closing, setClosing] = useState(false);
  const [opening, setOpening] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const runKey = Object.keys(runs).sort().join();
  const segs = useMemo(() => layout(prune(WHEEL, runs)), [runKey]);

  const [focus, setFocus] = useState<string | null>(null);
  const focusSeg = segs.find((s) => s.n.id === focus) ?? null;
  const [view, setView] = useState<View>(viewOf(null));
  const cur = useRef(view);
  cur.current = view;
  const [hot, setHot] = useState<string | null>(null);

  // every way out (the X, the middle, Escape, the back button, going somewhere) plays the way out
  const close = () => {
    setOpen(false);
    setClosing(true);
  };
  const back = () => (focusSeg ? setFocus(focusSeg.parent?.n.id ?? null) : close());
  const live = useRef({ back });
  live.current = { back };
  const pending = useRef<(() => void) | null>(null);

  const toggle = () => {
    if (open) return close();
    setFocus(null);
    setView(viewOf(null));
    setClosing(false);
    setOpening(true);
    setOpen(true);
    haptic(6);
  };

  // while open: a history entry for the back button, keys, and the first category focused
  useEffect(() => {
    if (!open) return;
    const release = pushBack(close);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && live.current.back();
    addEventListener('keydown', onKey);
    const raf = requestAnimationFrame(() => stage.current?.querySelector<SVGElement>('.nw-seg[tabindex="0"]')?.focus({ preventScroll: true }));
    const done = setTimeout(() => setOpening(false), 1100);
    return () => {
      release();
      removeEventListener('keydown', onKey);
      cancelAnimationFrame(raf);
      clearTimeout(done);
      setOpening(false);
      // an action picked on the wheel runs once it has let go of the focus and its history entry
      const run = pending.current;
      pending.current = null;
      if (run) run();
      else button.current?.focus({ preventScroll: true });
    };
  }, [open]);

  useEffect(() => {
    if (!closing) return;
    const timer = setTimeout(() => setClosing(false), CLOSE_MS);
    return () => clearTimeout(timer);
  }, [closing]);

  // the wheel grows out of the button and shrinks back into it
  useLayoutEffect(() => {
    if (!open || !stage.current || !button.current) return;
    const b = button.current.getBoundingClientRect(), s = stage.current.getBoundingClientRect();
    stage.current.style.setProperty('--dx', `${b.left + b.width / 2 - (s.left + s.width / 2)}px`);
    stage.current.style.setProperty('--dy', `${b.top + b.height / 2 - (s.top + s.height / 2)}px`);
  }, [open]);

  // zooming between levels
  useEffect(() => {
    const from = cur.current, to = viewOf(focusSeg);
    setHot(null);
    if (from.z === to.z && from.d0 === to.d0 && from.d1 === to.d1) return;
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return setView(to);
    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / MS), k = ease(p);
      setView({ z: lerp(from.z, to.z, k), d0: lerp(from.d0, to.d0, k), d1: lerp(from.d1, to.d1, k) });
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [focus]);

  const act = (s: Seg) => {
    haptic(5);
    if (s === focusSeg) return back();
    if (!s.leaf) return setFocus(s.n.id);
    if (s.n.run) {
      pending.current = runs[s.n.run] ?? null;
      close();
    } else if (s.n.to) {
      navigateAfterSheet(s.n.to);
      close();
    }
  };
  const key = (ev: KeyboardEvent, s: Seg) => {
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      act(s);
    }
  };
  const outside = (ev: MouseEvent) => {
    const tg = ev.target as Element;
    if (tg === ev.currentTarget || tg.matches('.nw-svg, .nw-stage, .nw-body')) back();
  };

  const { z, d0, d1 } = view;
  const map = (a: number) => Math.max(0, Math.min(360, ((a - d0) / (d1 - d0)) * 360));
  const settled = Math.abs(z - Math.round(z)) < 0.001;
  let top = focusSeg;
  while (top?.parent) top = top.parent;
  const sky = top?.hue ?? world ?? 'hope-interest';

  const shapes = [], labels = [];
  for (const s of segs) {
    const rel = s.depth - z;
    const a0 = map(s.a0), a1 = map(s.a1);
    const [r0, r1] = ring(rel);
    const d = sector(r0, r1, a0, a1);
    if (!d) continue;
    const isHub = s === focusSeg;
    const tabbable = settled && (isHub || (Math.round(rel) === 0 && (focusSeg ? s.parent === focusSeg : s.depth === 0)));
    const on = !!(s.n.run && active[s.n.run]);
    const style = { '--c': `var(--emo-${s.hue})`, '--k': s.k };
    shapes.push(
      <path
        d={d}
        class={`nw-seg${isHub ? ' hub' : ''}${hot === s.n.id ? ' hot' : ''}${on ? ' on' : ''}`}
        style={style}
        role="button"
        tabIndex={tabbable ? 0 : -1}
        aria-label={isHub ? t('Back') : s.n.name}
        aria-pressed={s.n.run ? on : undefined}
        onClick={(ev) => { ev.stopPropagation(); act(s); }}
        onKeyDown={(ev) => key(ev as KeyboardEvent, s)}
        onPointerEnter={(ev) => ev.pointerType === 'mouse' && setHot(s.n.id)}
        onPointerLeave={() => setHot((h) => (h === s.n.id ? null : h))}
        onFocus={() => setHot(s.n.id)}
        onBlur={() => setHot((h) => (h === s.n.id ? null : h))}
      />,
    );
    if (isHub) continue;
    // its colour, as a thin line along the outer edge
    const rr = r1 - 7;
    const trim = (Math.asin(Math.min(1, (GAP + 9) / rr)) * 180) / Math.PI;
    if (rr > r0 + 6 && a1 - a0 > trim * 2 + 2) {
      shapes.push(<path d={`M${pt(rr, a0 + trim)}A${rr} ${rr} 0 ${a1 - a0 - trim * 2 > 180 ? 1 : 0} 1 ${pt(rr, a1 - trim)}`} class="nw-rim" style={style} />);
    }

    // labels on the ring only; what's deeper waits at the rim until its category is opened
    const op = Math.max(0, 1 - Math.abs(rel) * 2) ** 2;
    const rm = (r0 + r1) / 2 - 4, m = (a0 + a1) / 2;
    if (op < 0.02 || rad(a1 - a0) * rm < 50) continue;
    const [x, y] = xy(rm, m);
    const kids = s.n.kids?.length ?? 0;
    labels.push(
      <g class={`nw-label${hot === s.n.id ? ' hot' : ''}`} opacity={op} style={{ ...style, transformOrigin: `${x.toFixed(1)}px ${y.toFixed(1)}px` }}>
        <g class="nw-icon" transform={`translate(${(x - 13).toFixed(2)} ${(y - 26).toFixed(2)})`}>
          <Icon name={s.n.icon} size={26} stroke={1.7} />
        </g>
        <text x={x} y={y + 16} class="nw-name">{s.n.name}</text>
        {kids > 0 && (
          // one dot for each thing inside
          <g class="nw-dots">
            {Array.from({ length: kids }, (_, i) => <circle cx={x + (i - (kids - 1) / 2) * 7} cy={y + 28} r={2} />)}
          </g>
        )}
      </g>,
    );
  }

  // the miner's points, for the Twitch category
  const points = usePoints(open).data;
  const isTwitch = (n?: WheelNode | null) => n?.id === 'twitch' || !!n?.to?.startsWith('twitch');
  const pointsLine = points && t('{points} points · {gain} today', { points: points.total.toLocaleString(LOCALE), gain: (points.change.day >= 0 ? '+' : '−') + Math.abs(points.change.day).toLocaleString(LOCALE) });

  const info = (hot && segs.find((s) => s.n.id === hot)) || focusSeg;
  const hub = ring(-1 - z)[1];
  const hubName = focusSeg ? Math.max(0, 1 - Math.abs(z - focusSeg.depth - 1)) ** 2 : 0;
  const layer = (open || closing) && (
    <div
      class={`nw-layer${open ? '' : ' closing'}`}
      style={{ '--sky': `var(--emo-${sky})` }}
      role="dialog"
      aria-modal="true"
      aria-label={t('Everything')}
      onClick={outside}
    >
      <Sky world={sky} />
      <header class="nw-head">
        <div>
          <p class="nw-kicker">{focusSeg ? (focusSeg.parent?.n.name ?? t('Everything')) : t('Everything')}</p>
          <h2 class="nw-title">{focusSeg ? focusSeg.n.name : t('Where to?')}</h2>
        </div>
        <button class="icon-btn nw-close" onClick={close} aria-label={t('Close')}><Icon name="x" /></button>
      </header>
      <div class="nw-body">
        <div ref={stage} class={`nw nw-stage${opening ? ' opening' : ''}`}>
          <svg class="nw-svg" viewBox="0 0 400 400" role="group" aria-label={focusSeg ? focusSeg.n.name : t('Everything')}>
            <Letters r={222} world={sky} class="nw-ring far" />
            <Letters r={208} world={sky} class="nw-ring" />
            {hub > 0.5 && <circle cx={C} cy={C} r={hub} class="nw-hub" onClick={(ev) => { ev.stopPropagation(); close(); }} />}
            <g class="nw-turn">
              {shapes}
              <g class="nw-labels">{labels}</g>
            </g>
            <g class="nw-labels">
              {hub > 20 && (
                <g opacity={(1 - z) ** 2}>
                  <g transform={`translate(${C - 9} ${C - 22})`}><Icon name="x" size={18} stroke={1.8} /></g>
                  <text x={C} y={C + 14} class="nw-hub-text">{t('Close')}</text>
                </g>
              )}
              {focusSeg && hubName > 0.02 && (
                <g opacity={hubName}>
                  <g transform={`translate(${C - 12} ${C - 30})`}><Icon name={focusSeg.n.icon} size={24} stroke={1.7} /></g>
                  <text x={C} y={C + 10} class="nw-hub-name">{focusSeg.n.name}</text>
                  <text x={C} y={C + 28} class="nw-hub-text">{isTwitch(focusSeg.n) && points ? compact(points.total) : t('Back')}</text>
                </g>
              )}
            </g>
          </svg>
        </div>
      </div>
      <div class="nw-caption" aria-live="polite">
        {info ? (
          <>
            <div class="nw-cap-name">{info.n.name}</div>
            <p class="nw-cap-sub">{info.n.sub}</p>
            {isTwitch(info.n) && pointsLine && <p class="nw-cap-stat">{pointsLine}</p>}
          </>
        ) : (
          <p class="nw-cap-sub">{t('Tap one to open it, the middle to close')}</p>
        )}
      </div>
    </div>
  );

  return (
    <>
      <button
        ref={button}
        class="icon-btn nw-trigger"
        aria-label={t('Everything')}
        title={t('Everything')}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={toggle}
      >
        <WheelMark />
      </button>
      {layer && createPortal(layer, document.body)}
    </>
  );
}
