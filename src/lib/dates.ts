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
/* Stats, the brain and the journal ask for days apart, weekdays and the day after thousands of times; making a Date for
   each was most of their work on a long journal. A key written 'YYYY-MM-DD' is counted with plain calendar arithmetic
   instead (no time zone in it, as there's none in a key); anything else still goes through a Date, as before. */

/** The number at k[from, to), or NaN when it isn't all digits. */
function digits(k: string, from: number, to: number) {
  let n = 0;
  for (let i = from; i < to; i++) {
    const c = k.charCodeAt(i) - 48;
    if (c < 0 || c > 9) return NaN;
    n = n * 10 + c;
  }
  return n;
}
/** Days from 1970-01-01 to the key's day (Howard Hinnant's days_from_civil), or NaN when it isn't 'YYYY-MM-DD' with a
 * month of 1–12 and a day of 1–31. A day past its month's end runs on into the next one, as a Date does. */
function dayNumber(k: string) {
  if (k.length !== 10 || k.charCodeAt(4) !== 45 || k.charCodeAt(7) !== 45) return NaN;
  const y = digits(k, 0, 4), m = digits(k, 5, 7), d = digits(k, 8, 10);
  if (!(m >= 1 && m <= 12 && d >= 1 && d <= 31) || y !== y) return NaN;
  const yy = m <= 2 ? y - 1 : y;
  const era = Math.floor(yy / 400), yoe = yy - era * 400;
  const doy = Math.floor((153 * (m > 2 ? m - 3 : m + 9) + 2) / 5) + d - 1;
  return era * 146097 + yoe * 365 + Math.floor(yoe / 4) - Math.floor(yoe / 100) + doy - 719468;
}
/** The key of day number z (civil_from_days), written as keyOf writes it. */
function keyOfDay(z: number) {
  z += 719468;
  const era = Math.floor(z / 146097), doe = z - era * 146097;
  const yoe = Math.floor((doe - Math.floor(doe / 1460) + Math.floor(doe / 36524) - Math.floor(doe / 146096)) / 365);
  const doy = doe - (365 * yoe + Math.floor(yoe / 4) - Math.floor(yoe / 100));
  const mp = Math.floor((5 * doy + 2) / 153);
  const d = doy - Math.floor((153 * mp + 2) / 5) + 1, m = mp < 10 ? mp + 3 : mp - 9;
  return `${yoe + era * 400 + (m <= 2 ? 1 : 0)}-${pad(m)}-${pad(d)}`;
}
const daysIn = (y: number, m: number) => (m === 2 ? ((y % 4 === 0 && y % 100 !== 0) || y % 400 === 0 ? 29 : 28) : m === 4 || m === 6 || m === 9 || m === 11 ? 30 : 31);

/** A real calendar day, including leap-year checks; malformed backup dates never enter the journal. */
export const isDateKey = (v: unknown): v is string => {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const y = digits(v, 0, 4), m = digits(v, 5, 7), d = digits(v, 8, 10);
  return m >= 1 && m <= 12 && d >= 1 && d <= daysIn(y, m);
};
export const addDays = (k: string, n: number) => {
  const z = dayNumber(k);
  if (z === z && Number.isInteger(n)) return keyOfDay(z + n);
  const d = parseKey(k);
  d.setDate(d.getDate() + n);
  return keyOf(d);
};
/** Whole days from a to b (b - a). */
export const diffDays = (a: string, b: string) => {
  const x = dayNumber(a), y = dayNumber(b);
  return x === x && y === y ? y - x : Math.round((parseKey(b).getTime() - parseKey(a).getTime()) / DAY);
};
/** Monday = 0 … Sunday = 6 */
export const weekday = (k: string) => {
  const z = dayNumber(k);
  // 1970-01-01 was a Thursday
  return z === z ? (((z + 3) % 7) + 7) % 7 : (parseKey(k).getDay() + 6) % 7;
};
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
