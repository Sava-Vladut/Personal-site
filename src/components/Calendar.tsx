import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { WEEKDAYS, addDays, keyOf, monthLabel, parseKey, rangeLabel, startOfWeek, todayKey } from '../lib/dates';
import { useSettings } from '../lib/store';
import { Icon } from './icons';
import { Sheet } from './Sheet';

interface CalendarProps {
  focus: string;                          // any day in the month to show first
  isSelected?: (k: string) => boolean;
  inRange?: (k: string) => boolean;
  onPick: (k: string) => void;
  mark?: (k: string) => ComponentChildren; // e.g. dots for days with entries
}

export function Calendar({ focus, isSelected, inRange, onPick, mark }: CalendarProps) {
  const { weekStart } = useSettings();
  const [ym, setYm] = useState(() => {
    const d = parseKey(focus);
    return [d.getFullYear(), d.getMonth()] as [number, number];
  });
  const [y, m] = ym;
  const first = keyOf(new Date(y, m, 1));
  const gridStart = startOfWeek(first, weekStart);
  const today = todayKey();
  const days = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  const weeks = days[35] > keyOf(new Date(y, m + 1, 0)) ? 5 : 6;
  const labels = weekStart === 1 ? WEEKDAYS : [WEEKDAYS[6], ...WEEKDAYS.slice(0, 6)];
  const shift = (n: number) => setYm(([yy, mm]) => {
    const d = new Date(yy, mm + n, 1);
    return [d.getFullYear(), d.getMonth()];
  });

  return (
    <div class="cal">
      <div class="cal-head">
        <button class="icon-btn" onClick={() => shift(-1)} aria-label="Previous month"><Icon name="chevron-left" /></button>
        <span class="cal-month">{monthLabel(y, m)}</span>
        <button class="icon-btn" onClick={() => shift(1)} aria-label="Next month"><Icon name="chevron-right" /></button>
      </div>
      <div class="cal-grid" role="grid">
        {labels.map((l) => <span class="cal-dow">{l.slice(0, 2)}</span>)}
        {days.slice(0, weeks * 7).map((k) => {
          const out = parseKey(k).getMonth() !== m;
          const sel = isSelected?.(k);
          return (
            <button
              class={`cal-day${out ? ' out' : ''}${k === today ? ' today' : ''}${inRange?.(k) ? ' in-range' : ''}`}
              aria-pressed={!!sel}
              aria-label={rangeLabel(k, null)}
              onClick={() => onPick(k)}
            >
              <span class="cal-num">{parseKey(k).getDate()}</span>
              {mark?.(k)}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ---------- date / range picker ---------- */

export function DateSheet({ open, onClose, start, end, onChange }: {
  open: boolean;
  onClose: () => void;
  start: string;
  end: string | null;
  onChange: (start: string, end: string | null) => void;
}) {
  const [mode, setMode] = useState<'day' | 'range'>(end ? 'range' : 'day');
  const [a, setA] = useState(start);
  const [b, setB] = useState<string | null>(end);
  const [picking, setPicking] = useState<'start' | 'end'>('start');
  const { weekStart } = useSettings();
  const today = todayKey();
  useEffect(() => {
    if (!open) return;
    setMode(end ? 'range' : 'day');
    setA(start);
    setB(end);
    setPicking('start');
  }, [open]);

  const set = (s: string, e: string | null) => {
    setA(s);
    setB(e);
  };
  const pick = (k: string) => {
    if (mode === 'day') return set(k, null);
    if (picking === 'start' || k < a) {
      set(k, null);
      setPicking('end');
    } else {
      set(a, k === a ? null : k);
      setPicking('start');
    }
  };
  const presets: [string, () => void][] = mode === 'day'
    ? [['Today', () => set(today, null)], ['Yesterday', () => set(addDays(today, -1), null)]]
    : [
        ['This week', () => set(startOfWeek(today, weekStart), today)],
        ['Last 7 days', () => set(addDays(today, -6), today)],
        ['This month', () => set(today.slice(0, 8) + '01', today)],
      ];

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Date"
      footer={
        <>
          <span class="foot-note">{rangeLabel(a, b)}</span>
          <button class="btn btn-primary" onClick={() => { onChange(a, b); onClose(); }}>Done</button>
        </>
      }
    >
      <div class="seg" role="tablist">
        {(['day', 'range'] as const).map((m) => (
          <button role="tab" aria-selected={mode === m} onClick={() => { setMode(m); setPicking('start'); if (m === 'day') setB(null); }}>
            {m === 'day' ? 'Single day' : 'Range'}
          </button>
        ))}
      </div>
      <div class="chips">
        {presets.map(([label, run]) => <button class="chip" onClick={run}>{label}</button>)}
      </div>
      <Calendar
        focus={a}
        isSelected={(k) => k === a || k === b}
        inRange={(k) => !!b && k > a && k < b}
        onPick={pick}
      />
      {/* always rendered so the sheet doesn't change height when switching modes */}
      <p class="hint center" style={{ visibility: mode === 'range' ? 'visible' : 'hidden' }}>
        {picking === 'end' ? 'Now tap the last day' : 'Tap the first day'}
      </p>
    </Sheet>
  );
}
