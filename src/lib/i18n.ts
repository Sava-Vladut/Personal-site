// The app is written in English; Romanian comes from a dictionary keyed by the English text, so any string
// without a translation simply stays in English. The language is kept per device and read once when the
// app starts: switching reloads the page, so every screen, date and feeling name changes together.
import { RO, RO_PLURAL } from '../data/ro';

export type Lang = 'en' | 'ro';
export const LANGS: [Lang, string][] = [['en', 'English'], ['ro', 'Română']];

const KEY = 'mm-lang';

function read(): Lang {
  try {
    return localStorage.getItem(KEY) === 'ro' ? 'ro' : 'en';
  } catch {
    return 'en';
  }
}

export const lang: Lang = read();
/** For dates, times and numbers. */
export const LOCALE = lang === 'ro' ? 'ro-RO' : 'en-GB';

if (typeof document !== 'undefined' && document.documentElement) document.documentElement.lang = lang;

export function setLang(next: Lang) {
  if (next === lang) return;
  try {
    localStorage.setItem(KEY, next);
  } catch {}
  location.reload();
}

/** The text in the app's language, with `{name}` placeholders filled in from `vars`. */
export function t(en: string, vars?: Record<string, string | number>) {
  const s = lang === 'ro' ? RO[en] ?? en : en;
  return vars ? s.replace(/\{(\w+)\}/g, (m, k: string) => (k in vars ? String(vars[k]) : m)) : s;
}

/** Like t(), for sentences with markup in them: the `{name}` placeholders become the given elements. */
export function rich<T>(en: string, parts: Record<string, T>): (string | T)[] {
  return t(en).split(/\{(\w+)\}/).map((s, i) => (i % 2 ? (s in parts ? parts[s] : `{${s}}`) : s));
}

/** "a, b and c" in the app's language. */
const lists = new Intl.ListFormat(LOCALE, { type: 'conjunction' });
export const listOf = (items: string[]) => lists.format(items);

const rules = lang === 'ro' ? new Intl.PluralRules('ro-RO') : null;

/** "1 entry" / "5 entries"; in Romanian "1 intrare" / "5 intrări" / "20 de intrări". */
export function count(n: number, one: string, many: string) {
  if (!rules) return `${n} ${n === 1 ? one : many}`;
  const [ro1, roN] = RO_PLURAL[one] ?? [one, many];
  const form = rules.select(n);
  return form === 'one' ? `${n} ${ro1}` : form === 'few' ? `${n} ${roN}` : `${n} de ${roN}`;
}

/** Just the word that goes with n, for when the number is shown apart from it. */
export function noun(n: number, one: string, many: string) {
  if (!rules) return n === 1 ? one : many;
  const [ro1, roN] = RO_PLURAL[one] ?? [one, many];
  const form = rules.select(n);
  return form === 'one' ? ro1 : form === 'few' ? roN : `de ${roN}`;
}
