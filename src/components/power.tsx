// Power you can see: the pieces the Workout pages and Insights › Workouts share to make ⚡ move. A number that rolls to
// its new value, a gauge that fills (and surges, and laps itself past the target), strips that fill set by set like a
// power-zone bar, a bar against a target, sparks and a flying "+12 ⚡" when a set is ticked off, the full-screen moment
// when a target is met, and an exercise's two pictures played as a tiny flipbook. Styles in styles/power.css (`pw-`).
//
// Motion follows design.md: only transform and opacity move, nothing loops at rest, and with reduced motion every piece
// shows its end state at once (the CSS kill in app.css doesn't reach what runs from JavaScript, so `still()` does).
import type { ComponentChildren } from 'preact';
import { createPortal } from 'preact/compat';
import { useEffect, useId, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { fmtPower } from '../lib/fitness';
import { haptic } from '../lib/haptics';
import { t } from '../lib/i18n';
import '../styles/power.css';

/** Reduced motion: the pieces below then jump to where they end. */
export const still = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Whether a media query matches, kept up to date. */
export function useMedia(q: string) {
  const [on, setOn] = useState(() => typeof matchMedia === 'function' && matchMedia(q).matches);
  useEffect(() => {
    if (typeof matchMedia !== 'function') return;
    const m = matchMedia(q);
    const change = () => setOn(m.matches);
    change();
    m.addEventListener?.('change', change);
    return () => m.removeEventListener?.('change', change);
  }, [q]);
  return on;
}

const canAnimate = () => typeof Element !== 'undefined' && typeof Element.prototype.animate === 'function';

/* ---------- a number that rolls ---------- */

/**
 * A number that rolls from the one on screen to its new value (ease-out, `ms`), every time it changes; the first time
 * from `from` when given (a count-up), else it just shows. The text is written straight into the span, so nothing
 * re-renders per frame, and a change mid-roll carries on from where it is.
 */
export function Rolling({ value, format = fmtPower, ms = 450, from, class: cls }: {
  value: number;
  format?: (n: number) => string;
  ms?: number;
  from?: number;
  class?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const shown = useRef<number | null>(null);
  const fmt = useRef(format);
  fmt.current = format;
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const to = value;
    const start = shown.current ?? from ?? to;
    if (start === to || ms <= 0 || still()) {
      shown.current = to;
      el.textContent = fmt.current(to);
      return;
    }
    const t0 = performance.now();
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, Math.max(0, (now - t0) / ms));
      const v = p < 1 ? start + (to - start) * (1 - Math.pow(1 - p, 3)) : to;
      shown.current = v;
      el.textContent = fmt.current(v);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    tick(t0);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return <span ref={ref} class={`pw-roll${cls ? ' ' + cls : ''}`} />;
}

/* ---------- the gauge ---------- */

/** The gauges flying power can land on (`catcher`), the one on screen picked. */
const catchers = new Set<HTMLElement>();

/** Sixty ticks round the large gauge, every fifth longer: one path, drawn once. */
const TICKS = Array.from({ length: 60 }, (_, i) => {
  const a = (i / 60) * Math.PI * 2;
  const r1 = i % 5 ? 47 : 46, r2 = 49;
  const p = (r: number) => `${(50 + r * Math.cos(a)).toFixed(2)} ${(50 + r * Math.sin(a)).toFixed(2)}`;
  return `M${p(r1)}L${p(r2)}`;
}).join('');

/**
 * Power against a target as a ring that fills: a gradient in the page's colour, a bright head where it's got to, a
 * second lap past the target, a notch where last time came to (`ghost`), and a surge each time it grows. With no
 * target, `scale` stands in (what the sets add up to). `catcher`: flying power (`flyPower`) lands here. `children` sit in
 * the middle (a number, an icon). Sizes: s 46px (a bar), m 96px (a card), l 200px (the cockpit, finishing).
 */
export function PowerGauge({ value, target, scale, ghost, size, label, catcher, surgeDelay = 0, children, class: cls }: {
  value: number;
  target: number;
  scale?: number;
  ghost?: number;
  size: 's' | 'm' | 'l';
  label?: string;
  catcher?: boolean;
  surgeDelay?: number;
  children?: ComponentChildren;
  class?: string;
}) {
  const id = useId();
  const root = useRef<HTMLSpanElement>(null);
  const fill = useRef<SVGCircleElement>(null);
  const lap = useRef<SVGCircleElement>(null);
  const head = useRef<HTMLSpanElement>(null);
  const surge = useRef<HTMLSpanElement>(null);
  const was = useRef<number | null>(null);
  const whole = target > 0 ? target : scale && scale > 0 ? scale : 0;
  const f = whole > 0 ? Math.min(2, Math.max(0, value / whole)) : 0;
  const g = ghost && ghost > 0 && whole > 0 ? Math.min(2, ghost / whole) : 0;
  const met = target > 0 && value >= target;

  // the ring and its head are set here rather than through props, so the very first value draws in from nothing
  useLayoutEffect(() => {
    const a = fill.current, b = lap.current, h = head.current;
    if (!a || !b || !h) return;
    const set = (x: number) => {
      a.style.strokeDashoffset = String(100 - Math.min(1, x) * 100);
      b.style.strokeDashoffset = String(100 - Math.max(0, x - 1) * 100);
      h.style.transform = `rotate(${x}turn)`;
    };
    if (was.current === null && f > 0 && !still()) {
      set(0);
      void root.current?.getBoundingClientRect();
    }
    set(f);
  }, [f]);

  // growing: a ring of light swells out of it as the power lands (after `surgeDelay`, the flight there)
  useEffect(() => {
    const before = was.current;
    was.current = value;
    if (before === null || value <= before || still() || !canAnimate()) return;
    const go = () => {
      surge.current?.animate([{ transform: 'scale(0.92)', opacity: 0.6 }, { transform: 'scale(1.32)', opacity: 0 }], { duration: 900, easing: 'cubic-bezier(.2,.7,.2,1)' });
      root.current?.querySelector('.pw-gauge-svg')?.animate(
        [{ transform: 'rotate(-90deg) scale(1)' }, { transform: 'rotate(-90deg) scale(1.06)', offset: 0.35 }, { transform: 'rotate(-90deg) scale(1)' }],
        { duration: 600, easing: 'cubic-bezier(.3,1.4,.5,1)' },
      );
    };
    const timer = setTimeout(go, surgeDelay);
    return () => clearTimeout(timer);
  }, [value]);

  useEffect(() => {
    const el = root.current;
    if (!catcher || !el) return;
    catchers.add(el);
    return () => void catchers.delete(el);
  }, [catcher]);

  return (
    <span
      ref={root}
      class={`pw-gauge is-${size}${met ? ' is-met' : ''}${f > 1 ? ' is-over' : ''}${f === 0 ? ' is-empty' : ''}${cls ? ' ' + cls : ''}`}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : 'true'}
    >
      <span ref={surge} class="pw-gauge-surge" />
      <svg class="pw-gauge-svg" viewBox="0 0 100 100" aria-hidden="true">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" class="pw-stop-a" />
            <stop offset="1" class="pw-stop-b" />
          </linearGradient>
        </defs>
        {size === 'l' && <path class="pw-gauge-ticks" d={TICKS} />}
        <circle class="pw-gauge-track" cx="50" cy="50" r="42" />
        <circle ref={fill} class="pw-gauge-fill" cx="50" cy="50" r="42" pathLength={100} stroke={`url(#${id})`} />
        <circle ref={lap} class="pw-gauge-lap" cx="50" cy="50" r="42" pathLength={100} />
      </svg>
      {g > 0 && <span class="pw-gauge-ghost" style={{ transform: `rotate(${g}turn)` }}><i /></span>}
      <span ref={head} class="pw-gauge-head"><i /></span>
      {children !== undefined && <span class="pw-gauge-mid">{children}</span>}
    </span>
  );
}

/* ---------- strips and bars ---------- */

/** One part of a strip: the power it's worth and how much of it is done (0 to 1). */
export interface StripPart { p: number; fill: number }

/**
 * Power in parts, like a power-zone bar: one segment per set (or exercise), as wide as the power it's worth (a small
 * one never vanishes), each filling as it's done. `now` picks out the one to do now.
 */
export function PowerStrip({ parts, now, label, class: cls }: { parts: StripPart[]; now?: number; label?: string; class?: string }) {
  const total = parts.reduce((a, x) => a + Math.max(0, x.p), 0);
  const floor = parts.length ? (total / parts.length) * 0.35 : 0;
  const widths = parts.map((x) => Math.max(x.p, floor) || 1);
  const sum = widths.reduce((a, b) => a + b, 0) || 1;
  return (
    <span class={`pw-strip${cls ? ' ' + cls : ''}`} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : 'true'}>
      {parts.map((x, i) => (
        <i key={i} class={`${x.fill >= 1 ? 'is-done' : ''}${i === now ? ' is-now' : ''}`} style={{ flexGrow: (widths[i] / sum) * 100, '--k': Math.min(i, 4) }}>
          <b style={{ transform: `scaleX(${Math.max(0, Math.min(1, x.fill))})` }} />
        </i>
      ))}
    </span>
  );
}

/**
 * Power against a target as one bar: it fills to the target and caps once it's met. With no target it's against the
 * larger of the value and `ghost`. `ghost` is a notch (last time, or what the sets add up to).
 */
export function PowerBar({ value, target, ghost, label, class: cls }: { value: number; target: number; ghost?: number; label?: string; class?: string }) {
  const whole = target > 0 ? target : Math.max(value, ghost ?? 0, 1);
  const f = Math.max(0, Math.min(1, value / whole));
  const g = ghost && ghost > 0 ? Math.min(1, ghost / whole) : 0;
  const met = target > 0 && value >= target;
  return (
    <span class={`pw-bar${met ? ' is-met' : ''}${cls ? ' ' + cls : ''}`} role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : 'true'}>
      <b style={{ transform: `scaleX(${f})` }} />
      {g > 0 && <span class="pw-bar-ghost" style={{ transform: `translateX(${g * 100}%)` }} />}
    </span>
  );
}

/* ---------- sparks, and power flying to the gauge ---------- */

let layer: HTMLDivElement | null = null;
let sparks = 0;
const MAX_SPARKS = 40;

/** The one layer over everything the sparks and the flying power are drawn in (outside the app, so nothing hides them). */
function overlay() {
  if (!layer || !layer.isConnected) {
    layer = document.createElement('div');
    layer.className = 'pw-layer';
    layer.setAttribute('aria-hidden', 'true');
    layer.dataset.noReveal = '';
    document.body.append(layer);
  }
  return layer;
}

const centre = (at: Element | DOMRect) => {
  const r = at instanceof Element ? at.getBoundingClientRect() : at;
  return r.width || r.height ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null;
};

/** Sparks out of a point (a tick, a finished exercise): dots and streaks in the page's colour, gone in under a second. */
export function burst(at: Element | DOMRect, { n = 10, big = false }: { n?: number; big?: boolean } = {}) {
  if (still() || !canAnimate()) return;
  const c = centre(at);
  if (!c) return;
  const count = Math.min(big ? 16 : n, MAX_SPARKS - sparks);
  const reach = big ? 78 : 46;
  const host = overlay();
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
    const d = reach * (0.6 + Math.random() * 0.6);
    const dx = Math.cos(angle) * d, dy = Math.sin(angle) * d;
    const streak = i % 3 === 0;
    const el = document.createElement('i');
    el.className = `pw-spark${streak ? ' is-streak' : ''}${i % 2 ? ' is-pale' : ''}`;
    el.style.left = `${c.x}px`;
    el.style.top = `${c.y}px`;
    host.append(el);
    sparks++;
    const turn = streak ? ` rotate(${angle + Math.PI / 2}rad)` : '';
    const a = el.animate(
      [
        { transform: `translate(-50%, -50%)${turn} scale(0.4)`, opacity: 1 },
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))${turn} scale(1)`, opacity: 1, offset: 0.55 },
        { transform: `translate(calc(-50% + ${dx * 1.18}px), calc(-50% + ${dy * 1.18 + 12}px))${turn} scale(0.2)`, opacity: 0 },
      ],
      { duration: 600 + Math.random() * 250, easing: 'cubic-bezier(.15,.75,.3,1)' },
    );
    const gone = () => {
      if (!el.isConnected) return;
      el.remove();
      sparks--;
    };
    a.onfinish = gone;
    a.oncancel = gone;
  }
}

/** How long flying power takes to land: a gauge it lands on surges this much later. */
export const FLY_MS = 650;

/** "+12 ⚡" flies in an arc from where it was earned to the gauge on screen (the one marked `catcher`). */
export function flyPower(from: Element, amount: number) {
  if (still() || !canAnimate() || amount <= 0) return;
  const a = centre(from);
  if (!a) return;
  let to: { x: number; y: number } | null = null;
  for (const el of catchers) {
    const r = el.getBoundingClientRect();
    if (r.width > 0 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth) {
      to = { x: r.left + r.width / 2, y: r.top + r.height / 2 };
      break;
    }
  }
  if (!to) return;
  const dx = to.x - a.x, dy = to.y - a.y;
  const chip = document.createElement('span');
  chip.className = 'pw-fly';
  chip.textContent = `+${fmtPower(amount)} ⚡`;
  chip.style.left = `${a.x}px`;
  chip.style.top = `${a.y}px`;
  overlay().append(chip);
  const fly = chip.animate(
    [
      { transform: 'translate(-50%, -50%) scale(0.6)', opacity: 0 },
      { transform: `translate(calc(-50% + ${dx * 0.3}px), calc(-50% + ${dy * 0.3 - 40}px)) scale(1.12)`, opacity: 1, offset: 0.35 },
      { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(0.45)`, opacity: 0.15 },
    ],
    { duration: FLY_MS, easing: 'cubic-bezier(.45,0,.2,1)' },
  );
  fly.onfinish = () => chip.remove();
  fly.oncancel = () => chip.remove();
}

/* ---------- the target met ---------- */

const RAYS = Array.from({ length: 16 }, (_, i) => i);

/**
 * The moment a target is met: rays and a ring of light out of the middle, the title slamming in, and `children` (the
 * full gauge, the number) under it. A tap, Esc or a couple of seconds and it's gone. With reduced motion it's only the
 * buzz: `onDone` at once.
 */
export function Celebrate({ open, title, children, onDone }: { open: boolean; title: string; children?: ComponentChildren; onDone: () => void }) {
  const done = useRef(onDone);
  done.current = onDone;
  const [leaving, setLeaving] = useState(false);
  useEffect(() => {
    if (!open) return;
    setLeaving(false);
    if (typeof navigator.vibrate === 'function') navigator.vibrate([30, 60, 30]);
    else haptic(20);
    if (still()) return void done.current();
    const timer = setTimeout(() => setLeaving(true), 2200);
    const key = (e: KeyboardEvent) => e.key === 'Escape' && setLeaving(true);
    addEventListener('keydown', key);
    return () => {
      clearTimeout(timer);
      removeEventListener('keydown', key);
    };
  }, [open]);
  useEffect(() => {
    if (!leaving) return;
    const timer = setTimeout(() => done.current(), 150);
    return () => clearTimeout(timer);
  }, [leaving]);
  if (!open || still() || typeof document === 'undefined') return null;
  return createPortal(
    <div class={`pw-cel${leaving ? ' is-leaving' : ''}`} role="status" aria-live="assertive" data-no-reveal onClick={() => setLeaving(true)}>
      <span class="pw-cel-rays" aria-hidden="true">
        {RAYS.map((i) => <i key={i} style={{ '--i': i }} />)}
      </span>
      <span class="pw-cel-wave" aria-hidden="true" />
      <span class="pw-cel-wave is-late" aria-hidden="true" />
      <div class="pw-cel-body">
        {children}
        <b class="pw-cel-title">{title}</b>
      </div>
    </div>,
    document.body,
  );
}

/* ---------- an exercise's two pictures, played ---------- */

/**
 * The start and the end of a move, played as a flipbook a few times (`runs`) and then still; a tap plays it again, and
 * two dots hold one of the two. One picture: just that.
 */
export function Flipbook({ frames, alt, runs = 3, class: cls }: { frames: string[]; alt: string[]; runs?: number; class?: string }) {
  const [play, setPlay] = useState(0);
  const [hold, setHold] = useState<0 | 1 | null>(null);
  if (!frames.length) return null;
  const two = frames.length > 1;
  return (
    <div class={`pw-flip${cls ? ' ' + cls : ''}`}>
      <button
        type="button"
        class="pw-flip-stage"
        onClick={() => {
          setHold(null);
          setPlay((n) => n + 1);
        }}
        disabled={!two}
        aria-label={two ? t('Play the move again') : alt[0]}
        title={two ? t('Play the move again') : undefined}
      >
        <img src={frames[0]} alt={alt[0] ?? ''} loading="lazy" decoding="async" width={300} height={200} />
        {two && (
          <img
            key={play}
            class={`pw-flip-end${hold === null ? ' is-playing' : hold === 1 ? ' is-held' : ''}`}
            style={{ animationIterationCount: runs * 2 }}
            src={frames[1]}
            alt={alt[1] ?? ''}
            loading="lazy"
            decoding="async"
            width={300}
            height={200}
          />
        )}
      </button>
      {two && (
        <span class="pw-flip-picks" role="group" aria-label={t('The move')}>
          <button type="button" class="pw-flip-pick" aria-pressed={hold === 0} onClick={() => setHold(0)} aria-label={t('Where the move starts')} title={t('Where the move starts')}><i /></button>
          <button type="button" class="pw-flip-pick" aria-pressed={hold === 1} onClick={() => setHold(1)} aria-label={t('Where the move ends')} title={t('Where the move ends')}><i /></button>
        </span>
      )}
    </div>
  );
}
