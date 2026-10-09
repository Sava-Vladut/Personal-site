import { LOCALE, t } from './i18n';

// Dates are stored as local calendar keys ('YYYY-MM-DD') so a note written at 23:50
// stays on that day no matter the timezone the journal is later opened in.

export const DAY = 864e5;

const pad = (n: number) => String(n).padStart(2, '0');

export const keyOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const todayKey = () => keyOf(new Date());
export const parseKey = (k: string) => {
  const [y, m, d] = k.split('-').map(Number);
  const date = new Date(0);
  date.setFullYear(y, m - 1, d);
  date.setHours(0, 0, 0, 0);
  return date;
};
/** A real calendar day, including leap-year checks; malformed backup dates never enter the journal. */
export const isDateKey = (v: unknown): v is string => {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [year, month, day] = v.split('-').map(Number);
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
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

/** Romanian writes day and month names in lower case; at the start of a label they still take a capital. */
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
// Constructing a formatter for every row is much more expensive than formatting it.
// The locale is fixed until reload; this cache only holds the few formats used by the app.
const formats = new Map<string, Intl.DateTimeFormat>();
export function formatDate(date: Date | number, options: Intl.DateTimeFormatOptions) {
  if (!Number.isFinite(typeof date === 'number' ? date : date.getTime())) return 'Invalid Date';
  const key = JSON.stringify(options);
  let format = formats.get(key);
  if (!format) { format = new Intl.DateTimeFormat(LOCALE, options); formats.set(key, format); }
  return format.format(date);
}
const fmt = (k: string, o: Intl.DateTimeFormatOptions) => formatDate(parseKey(k), o);

export const WEEKDAYS = [t('Mon'), t('Tue'), t('Wed'), t('Thu'), t('Fri'), t('Sat'), t('Sun')];

/** "Today", "Yesterday", "Thu 24 Sep", "Thu 24 Sep 2025" */
export function dayLabel(k: string) {
  const today = todayKey();
  if (k === today) return t('Today');
  if (k === addDays(today, -1)) return t('Yesterday');
  if (k === addDays(today, 1)) return t('Tomorrow');
  const sameYear = k.slice(0, 4) === today.slice(0, 4);
  return cap(fmt(k, { weekday: 'short', day: 'numeric', month: 'short', ...(sameYear ? {} : { year: 'numeric' }) }));
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

export const longToday = () => cap(formatDate(new Date(), { weekday: 'long', day: 'numeric', month: 'long' }));
export const monthLabel = (y: number, m: number) =>
  cap(formatDate(new Date(y, m, 1), { month: 'long', year: 'numeric' }));
export const monthShort = (y: number, m: number) => cap(formatDate(new Date(y, m, 1), { month: 'short' }));
export const timeLabel = (ms: number) => formatDate(ms, { hour: '2-digit', minute: '2-digit' });
