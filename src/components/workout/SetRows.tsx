// One exercise's sets as rows to fill in: in a plan, what you mean to do; in a workout, what you do, each ticked off as
// it's done. What a row asks for depends on the exercise: weight and reps; reps of a body move; seconds held; or minutes
// and distance. Each number is dragged sideways (or tapped and typed), and the set's power fills the row behind them.
import { Fragment } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { setPower, type Item, type WSet } from '../../lib/fitness';
import { haptic } from '../../lib/haptics';
import { count, t } from '../../lib/i18n';
import { usePref } from '../../lib/prefs';
import { stepOf } from '../../lib/scrub';
import { burst, flyPower, Rolling, still } from '../power';
import { Icon, type UiName } from '../icons';
import { nudge, Scrubber } from './Scrubber';
import { FIELDS, ghostOf, kgText, num, withGhost } from './shared';
import '../../styles/workout-live.css';

type Field = 'kg' | 'reps' | 'secs' | 'mins' | 'km';
interface Col { f: Field; icon: UiName; unit: string; label: string; need: boolean; decimal?: boolean; max: number; say: (n: number) => string }

/** The numbers a set of this exercise asks for, and which of them it can't be ticked off without. */
function columnsOf(it: Item): Col[] {
  const reps: Col = { f: 'reps', icon: 'repeat', unit: t('reps'), label: t('Reps'), need: true, max: 10_000, say: (n) => count(n, 'rep', 'reps') };
  const secs: Col = { f: 'secs', icon: 'stopwatch', unit: t('sec'), label: t('Seconds'), need: true, max: 86_400, say: (n) => t('{n} s', { n }) };
  switch (it.move.kind) {
    case 'weight': return [{ f: 'kg', icon: 'weight', unit: t('kg'), label: it.pair ? t('Kilograms, each hand') : t('Kilograms'), need: true, decimal: true, max: 1000, say: kgText }, reps];
    case 'body': return [reps];
    case 'time': return [secs];
    case 'cardio': return [
      { f: 'mins', icon: 'clock', unit: t('min'), label: t('Minutes'), need: true, decimal: true, max: 1440, say: (n) => t('{n} min', { n: num(n) }) },
      { f: 'km', icon: 'route', unit: t('km'), label: t('Kilometres'), need: false, decimal: true, max: 1000, say: (n) => t('{n} km', { n: num(n, true) }) },
    ];
  }
}

/** Where each field lives in a set (minutes are kept as seconds). */
const KEY = { kg: 'kg', reps: 'reps', secs: 'secs', mins: 'secs', km: 'km' } as const;
/** A field's number as the row shows it: minutes from seconds. */
function get(s: WSet, f: Field) {
  const v = s[KEY[f]];
  if (v === null) return null;
  return f === 'mins' ? Math.round((v / 60) * 100) / 100 : v;
}
function put(s: WSet, f: Field, n: number | null): WSet {
  if (n === null) return { ...s, [KEY[f]]: null };
  return { ...s, [KEY[f]]: f === 'mins' ? Math.round(n * 60) : n };
}

/** The first-time hint goes for every list of sets at once, the moment a number is dragged or typed anywhere. */
let tipGone = false;
const tipWatchers = new Set<() => void>();
function useScrubTip(): [boolean, () => void] {
  const [seen, setSeen] = usePref<boolean>('wo-scrub-tip', false);
  const [, redraw] = useState(0);
  useEffect(() => {
    const f = () => redraw((n) => n + 1);
    tipWatchers.add(f);
    return () => void tipWatchers.delete(f);
  }, []);
  const show = !seen && !tipGone;
  return [show, () => {
    if (!show) return;
    tipGone = true;
    setSeen(true);
    tipWatchers.forEach((f) => f());
  }];
}

/**
 * The rows, numbered. `live` adds the tick that marks a set done (and only done sets count); `ghosts` are last time's
 * sets, shown faintly in empty fields and taken as they are when a set is ticked off empty (with no last time, the set
 * above stands in). `next` is the set to do now, picked out. A set goes with its ×, or a swipe left.
 */
export function SetRows({ item, bw, live, ghosts, next, onSets, onRemove, onDone }: {
  item: Item;
  bw: number;
  live?: boolean;
  ghosts?: WSet[];
  next?: number;
  onSets: (sets: WSet[]) => void;
  onRemove: (i: number) => void;
  onDone?: (i: number) => void;
}) {
  const cols = columnsOf(item);
  const set = (i: number, s: WSet) => onSets(item.sets.map((x, j) => (j === i ? s : x)));
  const [tip, used] = useScrubTip();
  const hint = live && tip && next !== undefined;
  return (
    <div class={`wo-sets${live ? ' live' : ''}`} role="group" aria-label={t('Sets')}>
      <div class="wo-set wo-set-head">
        <span class="wo-h wo-h-n" title={t('Set')}>#</span>
        <span class="wo-set-heads">
          {cols.map((c) => <span key={c.f} class="wo-h" title={c.label}><Icon name={c.icon} size={14} />{c.unit}</span>)}
        </span>
        <span class="wo-h wo-h-p" title={t('Power')}><Icon name="bolt" size={14} /></span>
        {live && <span class="wo-h wo-h-tick" title={t('Done')}><Icon name="check" size={14} /></span>}
        <span class="wo-h wo-h-x" />
      </div>
      {item.sets.map((s, i) => (
        <Fragment key={i}>
          <SetRow
            n={i + 1}
            next={next === i}
            s={s}
            cols={cols}
            item={item}
            bw={bw}
            live={live}
            ghost={ghostOf(item, i, ghosts)}
            past={!!ghosts?.length}
            onSet={(x) => set(i, x)}
            onRemove={() => onRemove(i)}
            onDone={() => onDone?.(i)}
            onUsed={used}
          />
          {hint && next === i && (
            <p class="wo-scrub-tip">
              <Icon name="hand-grab" size={14} />
              {t('Drag a number sideways to change it, or tap to type')}
            </p>
          )}
        </Fragment>
      ))}
    </div>
  );
}

/**
 * One set: its number, the numbers you drag, the power it comes to and (in a workout) its tick. The power fills the row
 * behind the numbers, against half again what last time's set came to (a notch marks that), so beating it fills it up;
 * a set still to do shows what ticking it off now would count, faintly.
 */
function SetRow({ n, next, s, cols, item, bw, live, ghost, past, onSet, onRemove, onDone, onUsed }: {
  n: number;
  next: boolean;
  s: WSet;
  cols: Col[];
  item: Item;
  bw: number;
  live?: boolean;
  ghost?: WSet;
  /** `ghost` is last time's set (not the set above standing in). */
  past: boolean;
  onSet: (s: WSet) => void;
  onRemove: () => void;
  onDone: () => void;
  onUsed: () => void;
}) {
  const row = useRef<HTMLDivElement>(null);
  const tickBtn = useRef<HTMLButtonElement>(null);
  const readout = useRef<HTMLSpanElement>(null);
  const swipe = useSwipeAway(row, onRemove);
  // a number being dragged: only this row redraws until it's let go
  const [preview, setPreview] = useState<WSet | null>(null);
  // a set just ticked off: the row flashes full (a new key plays it again)
  const [flash, setFlash] = useState(0);
  useEffect(() => {
    if (!flash) return;
    const timer = setTimeout(() => setFlash(0), 700);
    return () => clearTimeout(timer);
  }, [flash]);

  const shown = preview ?? s;
  const fields = FIELDS[item.move.kind];
  const maybe = !!live && !shown.done;
  const p = setPower(item.move, maybe ? withGhost(shown, ghost, fields) : shown, bw, item.pair);
  const gp = ghost ? setPower(item.move, ghost, bw, item.pair) : 0;
  // what the fill is measured against: held still while a number's dragged (so the fill moves, not the scale) and only
  // stretched when it nearly runs out
  const whole = useRef(0);
  if (!preview || !whole.current) whole.current = Math.max(gp * 1.5, p / 0.85, 1);
  else if (p > whole.current * 0.95) whole.current = p / 0.85;
  const fill = Math.min(1, p / whole.current);
  const notch = Math.min(1, gp / whole.current);

  const tick = () => {
    if (s.done) return onSet({ ...s, done: false });
    const x = withGhost(s, ghost, fields);
    const missing = cols.find((c) => c.need && x[KEY[c.f]] === null);
    if (missing) return nudge(row.current?.querySelector<HTMLElement>(`[data-f="${missing.f}"]`) ?? null);
    haptic(10);
    onSet({ ...x, done: true });
    if (!still()) setFlash((f) => f + 1);
    if (tickBtn.current) burst(tickBtn.current);
    if (readout.current) flyPower(readout.current, setPower(item.move, x, bw, item.pair));
    onDone();
  };
  const tickLabel = s.done ? t('Done. Tap to undo') : t('Mark the set done');

  return (
    <div ref={row} class={`wo-set${shown.done ? ' is-done' : ''}${next ? ' is-next' : ''}${flash ? ' is-flash' : ''}`} {...swipe}>
      <span class="wo-set-n" aria-label={t('Set {n}', { n })}>{n}</span>
      <span class="wo-set-track">
        <span class="wo-set-fills" aria-hidden="true">
          <i class={`wo-set-fill${maybe ? ' is-maybe' : ''}`} style={{ transform: `scaleX(${fill})` }} />
          {flash > 0 && <i key={flash} class="wo-set-flash" />}
          {gp > 0 && <i class="wo-set-notch" style={{ transform: `translateX(${notch * 100}%)` }} />}
        </span>
        {cols.map((c) => {
          const g = ghost ? get(ghost, c.f) : null;
          return (
            <Scrubber
              key={c.f}
              field={c.f}
              value={get(shown, c.f)}
              ghost={g}
              past={past ? g : null}
              step={stepOf(c.f, item.move.equip)}
              max={c.max}
              decimal={c.decimal}
              label={c.label}
              say={c.say}
              onPreview={(v) => setPreview(put(s, c.f, v))}
              onValue={(v) => {
                setPreview(null);
                onSet(put(s, c.f, v));
              }}
              onUsed={onUsed}
            />
          );
        })}
      </span>
      <span ref={readout} class={`wo-set-p${maybe ? ' is-maybe' : ''}${p > 0 ? '' : ' is-zero'}`} title={t('Power')}>
        <Icon name="bolt" size={12} />
        <Rolling value={p} ms={300} />
      </span>
      {live && (
        <button ref={tickBtn} class="wo-tick" aria-pressed={s.done} onClick={tick} aria-label={tickLabel} title={tickLabel}>
          <Icon name="check" size={18} stroke={2.5} />
        </button>
      )}
      <button class="wo-set-x" onClick={onRemove} aria-label={t('Remove set')} title={t('Remove set')}>
        <Icon name="x" size={16} />
      </button>
    </div>
  );
}

/**
 * Swiping a row left takes it away, as swiping left deletes in the journal: it follows the finger and, let go far
 * enough, the row goes (the caller offers Undo); short of that it springs back. Touch and pen only, and not from the
 * numbers (they drag sideways themselves); up and down still scroll. A mouse has the row's ×.
 */
function useSwipeAway(row: { current: HTMLElement | null }, away: () => void) {
  const drag = useRef<{ id: number; x: number; y: number; on: boolean } | null>(null);
  const swiped = useRef(false);
  const move = (dx: number) => {
    const el = row.current;
    if (!el) return;
    el.style.transition = dx ? 'none' : '';
    el.style.transform = dx ? `translateX(${dx}px)` : '';
  };
  const end = (e: PointerEvent) => {
    const d = drag.current;
    drag.current = null;
    if (!d?.on || e.pointerId !== d.id) return;
    const dx = e.clientX - d.x;
    move(0);
    swiped.current = true;
    if (dx < -96 && e.type === 'pointerup') {
      haptic(12);
      away();
    }
  };
  return {
    onPointerDown: (e: PointerEvent) => {
      swiped.current = false;
      if (e.pointerType === 'mouse' || (e.target as Element).closest('input, [data-scrub]')) return;
      drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, on: false };
    },
    onPointerMove: (e: PointerEvent) => {
      const d = drag.current;
      if (!d || e.pointerId !== d.id) return;
      const dx = e.clientX - d.x, dy = e.clientY - d.y;
      if (!d.on) {
        if (Math.abs(dy) > 10 || dx > 12) return void (drag.current = null);
        if (dx > -12) return;
        d.on = true;
        row.current?.setPointerCapture(e.pointerId);
      }
      move(Math.min(0, dx));
    },
    onPointerUp: end,
    onPointerCancel: end,
    // a swipe isn't a tap on whatever it started on
    onClickCapture: (e: MouseEvent) => {
      if (swiped.current) {
        e.stopPropagation();
        e.preventDefault();
        swiped.current = false;
      }
    },
  };
}
