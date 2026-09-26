// Dates are stored as local calendar keys ('YYYY-MM-DD') so a note written at 23:50
// stays on that day no matter the timezone the journal is later opened in.

export const DAY = 864e5;
const LOCALE = 'en-GB';

const pad = (n: number) => String(n).padStart(2, '0');

export const keyOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayKey = () => keyOf(new Date());
export const parseKey = (k: string) => {
  const [y, m, d] = k.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const addDays = (k: string, n: number) => {
  const d = parseKey(k);
  d.setDate(d.getDate() + n);
  return keyOf(d);
};
/** Whole days from a to b (b - a). */
export const diffDays = (a: string, b: string) => Math.round((parseKey(b).getTime() - parseKey(a).getTime()) / DAY);
/** Monday = 0 … Sunday = 6 */
export const weekday = (k: string) => (parseKey(k).getDay() + 6) % 7;
export const startOfWeek = (k: string, weekStart: 0 | 1 = 1) => {
  const dow = parseKey(k).getDay();
  return addDays(k, -((dow - weekStart + 7) % 7));
};

const fmt = (k: string, o: Intl.DateTimeFormatOptions) => parseKey(k).toLocaleDateString(LOCALE, o);

export const WEEKDAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

/** "Today", "Yesterday", "Thu 24 Sep", "Thu 24 Sep 2025" */
export function dayLabel(k: string) {
  const t = todayKey();
  if (k === t) return 'Today';
  if (k === addDays(t, -1)) return 'Yesterday';
  if (k === addDays(t, 1)) return 'Tomorrow';
  const sameYear = k.slice(0, 4) === t.slice(0, 4);
  return fmt(k, { weekday: 'short', day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) });
}

/** "24 Sep" / "24 Sep 2025" */
export function shortDate(k: string) {
  const sameYear = k.slice(0, 4) === todayKey().slice(0, 4);
  return fmt(k, { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) });
}

/** "Today" · "24–26 Sep" · "30 Sep – 2 Oct" */
export function rangeLabel(start: string, end: string | null) {
  if (!end || end === start) return dayLabel(start);
  const [a, b] = [parseKey(start), parseKey(end)];
  const sameYear = a.getFullYear() === b.getFullYear();
  const thisYear = b.getFullYear() === new Date().getFullYear();
  if (sameYear && a.getMonth() === b.getMonth())
    return `${a.getDate()}–${fmt(end, { day: 'numeric', month: 'short', ...(thisYear ? {} : { year: 'numeric' }) })}`;
  return `${fmt(start, { day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) })} – ${fmt(end, {
    day: 'numeric', month: 'short', ...(thisYear && sameYear ? {} : { year: 'numeric' }),
  })}`;
}

export const longToday = () => new Date().toLocaleDateString(LOCALE, { weekday: 'long', day: 'numeric', month: 'long' });
export const monthLabel = (y: number, m: number) =>
  new Date(y, m, 1).toLocaleDateString(LOCALE, { month: 'long', year: 'numeric' });
export const monthShort = (y: number, m: number) => new Date(y, m, 1).toLocaleDateString(LOCALE, { month: 'short' });
export const timeLabel = (ms: number) => new Date(ms).toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' });
