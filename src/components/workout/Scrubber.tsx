// A set's number you drag sideways to change, like a dial: a few pixels a step, a flick for a big change, a tap (or
// Enter, or a digit) to type it instead, and the arrow keys a step at a time. While a finger's on it only its row redraws
// (`onPreview`); letting go saves it once (`onValue`), so the workout isn't written on every step. Empty, it shows last
// time's number faintly; going past last time buzzes and pops a "+2". The maths is in lib/scrub.ts.
import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import { haptic } from '../../lib/haptics';
import { t } from '../../lib/i18n';
import { bounds, PX, scaleEnd, startOf, stepped, tracker, type ScrubField } from '../../lib/scrub';
import { Icon } from '../icons';
import { NumInput, num } from './shared';

interface Drag {
  id: number;
  x: number;
  y: number;
  t: number;
  mouse: boolean;
  /** Past the slop: it's a drag now, not a tap or a scroll. */
  on: boolean;
  from: number;
  v: number;
  moved: boolean;
  lo: number;
  hi: number;
  track: ReturnType<typeof tracker>;
  /** Gone past last time already in this drag (it only buzzes the first time). */
  passed: boolean;
  edge: boolean;
  buzz: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

/** The number gives a little shake: it's the one a set can't be ticked off without. */
export function nudge(el: HTMLElement | null) {
  if (!el) return;
  el.focus({ preventScroll: true });
  el.classList.remove('is-nudge');
  void el.offsetWidth;
  el.classList.add('is-nudge');
  setTimeout(() => el.classList.remove('is-nudge'), 650);
}

export function Scrubber({ field, value, ghost, past, step, max, decimal, label, say, onPreview, onValue, onUsed }: {
  field: ScrubField;
  value: number | null;
  /** Shown faintly when it's empty, and where a drag from empty starts. */
  ghost: number | null;
  /** Last time's number (not a stand-in like the set above), for "2 more than last time" and the "+2". */
  past: number | null;
  step: number;
  max: number;
  decimal?: boolean;
  label: string;
  /** A number in words with its unit: "12 reps". */
  say: (n: number) => string;
  onPreview: (n: number) => void;
  onValue: (n: number | null) => void;
  /** Dragged or typed in: the first-time hint can go. */
  onUsed?: () => void;
}) {
  const el = useRef<HTMLSpanElement>(null);
  // typing instead: with the number selected, or (a digit started it) the caret after it
  const [typing, setTyping] = useState<null | 'all' | 'end'>(null);
  const [scrubbing, setScrubbing] = useState(false);
  // how far past last time it is, while dragging
  const [over, setOver] = useState<number | null>(null);
  const drag = useRef<Drag | null>(null);
  // typing ended with Enter or Esc: focus comes back to the slider
  const back = useRef(false);
  const fmt = (n: number) => (decimal ? num(n, field === 'km') : String(n));

  useLayoutEffect(() => {
    const input = el.current?.querySelector('input');
    if (typing === 'end' && input) input.setSelectionRange(input.value.length, input.value.length);
    if (!typing && back.current) {
      back.current = false;
      el.current?.focus({ preventScroll: true });
    }
  }, [typing]);

  const type = (how: 'all' | 'end') => {
    setTyping(how);
    onUsed?.();
  };

  if (typing) {
    return (
      <span
        ref={el}
        class="wo-scrub is-typing"
        data-scrub
        onKeyDownCapture={(e) => {
          if (e.key !== 'Enter' && e.key !== 'Escape') return;
          back.current = true;
          if (e.key === 'Escape') (e.target as HTMLInputElement).blur();
        }}
      >
        <NumInput
          class="wo-scrub-input"
          value={value}
          onValue={onValue}
          label={label}
          ghost={ghost === null ? '–' : fmt(ghost)}
          decimal={decimal}
          max={max}
          field={field}
          autoFocus
          onBlur={() => setTyping(null)}
        />
      </span>
    );
  }

  const end = scaleEnd(value, ghost, field, max, step);
  const text = value === null
    ? past === null ? t('Empty') : t('Empty. Last time: {v}', { v: say(past) })
    : past === null ? say(value)
    : value > past ? t('{v}, {n} more than last time', { v: say(value), n: fmt(round2(value - past)) })
    : value < past ? t('{v}, {n} less than last time', { v: say(value), n: fmt(round2(past - value)) })
    : t('{v}, same as last time', { v: say(value) });

  const down = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const from = startOf(value, ghost);
    const [lo, hi] = bounds(from, step, max);
    const mouse = e.pointerType === 'mouse';
    drag.current = {
      id: e.pointerId, x: e.clientX, y: e.clientY, t: e.timeStamp, mouse, on: false, from, v: from, moved: false, lo, hi,
      track: tracker(PX[field]), passed: false, edge: false, buzz: 0,
    };
    if (mouse) el.current?.setPointerCapture?.(e.pointerId);
  };

  const move = (e: PointerEvent) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    const dx = e.clientX - d.x, dy = e.clientY - d.y;
    if (!d.on) {
      if (d.mouse) {
        if (Math.abs(dx) < 3) return;
      } else if (Math.abs(dx) >= 8 && Math.abs(dx) > 1.3 * Math.abs(dy)) {
        el.current?.setPointerCapture?.(e.pointerId);
      } else {
        // up and down first: the page is scrolling, not the number
        if (Math.abs(dy) >= 8) drag.current = null;
        return;
      }
      d.on = true;
      d.track.start(d.x, d.t);
      setScrubbing(true);
      if (past !== null && d.from > past) setOver(round2(d.from - past));
    }
    const steps = d.track.move(e.clientX, e.timeStamp, d.lo, d.hi);
    const now = e.timeStamp;
    // against an end: one bump
    const edge = (steps <= d.lo && dx < 0) || (steps >= d.hi && dx > 0);
    if (edge && !d.edge) {
      haptic(10);
      d.buzz = now;
    }
    d.edge = edge;
    const v = stepped(d.from, steps, step, max);
    if (v === d.v) return;
    d.v = v;
    d.moved = true;
    onPreview(v);
    if (past !== null) {
      const up = v > past;
      if (up && !d.passed) {
        d.passed = true;
        haptic(14);
        d.buzz = now;
      }
      setOver(up ? round2(v - past) : null);
    }
    if (now - d.buzz >= 40) {
      haptic(4);
      d.buzz = now;
    }
  };

  const up = (e: PointerEvent) => {
    const d = drag.current;
    if (!d || e.pointerId !== d.id) return;
    drag.current = null;
    if (d.on) {
      setScrubbing(false);
      setOver(null);
      if (d.moved) {
        onValue(d.v);
        onUsed?.();
      }
      return;
    }
    // a tap: type it instead
    if (e.type === 'pointerup' && Math.hypot(e.clientX - d.x, e.clientY - d.y) < 6 && e.timeStamp - d.t < 500) type('all');
  };

  const key = (e: KeyboardEvent) => {
    if (e.target !== e.currentTarget || e.altKey || e.ctrlKey || e.metaKey) return;
    const k = e.key;
    const by = (n: number) => stepped(startOf(value, ghost), n * (e.shiftKey ? 5 : 1), step, max);
    let next: number | null;
    if (k === 'ArrowRight' || k === 'ArrowUp') next = by(1);
    else if (k === 'ArrowLeft' || k === 'ArrowDown') next = by(-1);
    else if (k === 'PageUp') next = stepped(startOf(value, ghost), 5, step, max);
    else if (k === 'PageDown') next = stepped(startOf(value, ghost), -5, step, max);
    else if (k === 'Home') next = 0;
    else if (k === 'End') next = end;
    else if (k === 'Backspace' || k === 'Delete') next = null;
    else if (k === 'Enter' || k === 'F2') {
      e.preventDefault();
      return type('all');
    } else if (/^[0-9]$/.test(k)) {
      e.preventDefault();
      onValue(Number(k));
      return type('end');
    } else return;
    e.preventDefault();
    if (next !== value) onValue(next);
    onUsed?.();
  };

  return (
    <span
      ref={el}
      class={`wo-scrub${scrubbing ? ' is-scrubbing' : ''}${value === null ? ' is-empty' : ''}`}
      role="slider"
      tabIndex={0}
      data-scrub
      data-f={field}
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={end}
      aria-valuenow={value ?? undefined}
      aria-valuetext={text}
      title={label}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onKeyDown={key}
    >
      <Icon name="chevron-left" size={14} class="wo-scrub-chev is-l" />
      <span class={`wo-scrub-n${value === null ? ' is-ghost' : ''}`}>{value === null ? (ghost === null ? '–' : fmt(ghost)) : fmt(value)}</span>
      <Icon name="chevron-right" size={14} class="wo-scrub-chev is-r" />
      {over !== null && <span class="wo-scrub-up" aria-hidden="true">+{fmt(over)}</span>}
    </span>
  );
}
