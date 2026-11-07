// One exercise's sets as rows to fill in: in a plan, what you mean to do; in a workout, what you do, each ticked off as
// it's done. What a row asks for depends on the exercise: weight and reps; reps of a body move; seconds held; or minutes
// and distance.
import { useRef } from 'preact/hooks';
import { setPower, type Item, type WSet } from '../../lib/fitness';
import { haptic } from '../../lib/haptics';
import { t } from '../../lib/i18n';
import { Power } from '../fitness';
import { Icon, type UiName } from '../icons';
import { NumInput, num } from './shared';

type Field = 'kg' | 'reps' | 'secs' | 'mins' | 'km';
interface Col { f: Field; icon: UiName; unit: string; label: string; need: boolean; decimal?: boolean; max: number }

/** The numbers a set of this exercise asks for, and which of them it can't be ticked off without. */
function columnsOf(it: Item): Col[] {
  const reps: Col = { f: 'reps', icon: 'repeat', unit: t('reps'), label: t('Reps'), need: true, max: 10_000 };
  const secs: Col = { f: 'secs', icon: 'stopwatch', unit: t('sec'), label: t('Seconds'), need: true, max: 86_400 };
  switch (it.move.kind) {
    case 'weight': return [{ f: 'kg', icon: 'weight', unit: t('kg'), label: it.pair ? t('Kilograms, each hand') : t('Kilograms'), need: true, decimal: true, max: 1000 }, reps];
    case 'body': return [reps];
    case 'time': return [secs];
    case 'cardio': return [
      { f: 'mins', icon: 'clock', unit: t('min'), label: t('Minutes'), need: true, decimal: true, max: 1440 },
      { f: 'km', icon: 'route', unit: t('km'), label: t('Kilometres'), need: false, decimal: true, max: 1000 },
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

/**
 * The rows. `live` adds the tick that marks a set done (and only done sets count); `ghosts` are last time's sets, shown
 * faintly in empty fields and taken as they are when a set is ticked off empty. A set goes with its ×, or a swipe left.
 */
export function SetRows({ item, bw, live, ghosts, onSets, onRemove, onDone }: {
  item: Item;
  bw: number;
  live?: boolean;
  ghosts?: WSet[];
  onSets: (sets: WSet[]) => void;
  onRemove: (i: number) => void;
  onDone?: (i: number) => void;
}) {
  const cols = columnsOf(item);
  const set = (i: number, s: WSet) => onSets(item.sets.map((x, j) => (j === i ? s : x)));
  return (
    <div class={`wo-sets${live ? ' live' : ''}`} role="group" aria-label={t('Sets')}>
      <div class="wo-set wo-set-head">
        {cols.map((c) => <span key={c.f} class="wo-h" title={c.label}><Icon name={c.icon} size={14} />{c.unit}</span>)}
        <span class="wo-h wo-h-p" title={t('Power')}><Icon name="bolt" size={14} /></span>
        {live && <span class="wo-h wo-h-tick" title={t('Done')}><Icon name="check" size={14} /></span>}
        <span class="wo-h wo-h-x" />
      </div>
      {item.sets.map((s, i) => {
        const ghost = ghosts?.[i] ?? ghosts?.[ghosts.length - 1];
        return (
          <SetRow
            key={i}
            s={s}
            cols={cols}
            item={item}
            bw={bw}
            live={live}
            ghost={ghost}
            onSet={(x) => set(i, x)}
            onRemove={() => onRemove(i)}
            onDone={() => onDone?.(i)}
          />
        );
      })}
    </div>
  );
}

function SetRow({ s, cols, item, bw, live, ghost, onSet, onRemove, onDone }: {
  s: WSet;
  cols: Col[];
  item: Item;
  bw: number;
  live?: boolean;
  ghost?: WSet;
  onSet: (s: WSet) => void;
  onRemove: () => void;
  onDone: () => void;
}) {
  const row = useRef<HTMLDivElement>(null);
  const swipe = useSwipeAway(row, onRemove);
  // what an empty set would count as, ticked off now: last time's numbers
  const filled = (): WSet => {
    let x = s;
    if (ghost) for (const c of cols) if (x[KEY[c.f]] === null && ghost[KEY[c.f]] !== null) x = { ...x, [KEY[c.f]]: ghost[KEY[c.f]] };
    return x;
  };
  const p = setPower(item.move, live && !s.done ? filled() : s, bw, item.pair);
  const tick = () => {
    if (s.done) return onSet({ ...s, done: false });
    const x = filled();
    const missing = cols.find((c) => c.need && x[KEY[c.f]] === null);
    if (missing) return row.current?.querySelector<HTMLInputElement>(`[data-f="${missing.f}"]`)?.focus();
    haptic(10);
    onSet({ ...x, done: true });
    onDone();
  };
  return (
    <div ref={row} class={`wo-set${s.done ? ' is-done' : ''}`} {...swipe}>
      {cols.map((c) => {
        const g = ghost && get(ghost, c.f);
        return (
          <NumInput
            key={c.f}
            field={c.f}
            value={get(s, c.f)}
            onValue={(v) => onSet(put(s, c.f, v))}
            label={c.label}
            ghost={g === null || g === undefined ? '–' : c.decimal ? num(g) : String(g)}
            decimal={c.decimal}
            max={c.max}
          />
        );
      })}
      <span class={`wo-set-p${live && !s.done ? ' is-maybe' : ''}`}>{p > 0 && <Power value={p} size={12} />}</span>
      {live && (
        <button class="wo-tick" aria-pressed={s.done} onClick={tick} aria-label={s.done ? t('Done. Tap to undo') : t('Mark the set done')} title={s.done ? t('Done. Tap to undo') : t('Mark the set done')}>
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
 * enough, the row goes (the caller offers Undo); short of that it springs back. Touch and pen only; up and down still
 * scroll. A mouse has the row's ×.
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
      if (e.pointerType === 'mouse' || (e.target as Element).closest('input')) return;
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
