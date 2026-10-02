// What the People pages know about someone beyond their own page: the days in their year, the other pages that tag
// them, and how thinking of them has felt month by month.
import { CORE, coreOf } from '../data/emotions';
import { DAY, parseKey } from './dates';
import { resolvePerson, PERSON } from './mentions';
import type { Book, Entry, KeyDate, Person, Song } from './store';

/* ---------- key dates ---------- */

export const KEY_DATE_LABEL = { birthday: 'Birthday', anniversary: 'Anniversary', other: 'Date' } as const;

const isLeap = (y: number) => (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;

/** The day it falls on in a year: 29 February is kept on the 28th in other years. */
function inYear(d: KeyDate, y: number) {
  const [m, day] = d.md.split('-').map(Number);
  return new Date(y, m - 1, m === 2 && day === 29 && !isLeap(y) ? 28 : day);
}

export interface Upcoming { person: Person; date: KeyDate; on: Date; days: number; years: number | null }

/** When it next comes round, from today (today counts), and how many years it'll be. */
export function nextOf(person: Person, d: KeyDate, now = new Date()): Upcoming {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let on = inYear(d, today.getFullYear());
  if (on < today) on = inYear(d, today.getFullYear() + 1);
  const years = d.year !== null && on.getFullYear() > d.year ? on.getFullYear() - d.year : null;
  return { person, date: d, on, days: Math.round((on.getTime() - today.getTime()) / DAY), years };
}

/** Every key date coming up within `within` days, soonest first. */
export function upcoming(people: Person[], within = 14, now = new Date()) {
  return people
    .flatMap((p) => p.dates.map((d) => nextOf(p, d, now)))
    .filter((u) => u.days <= within)
    .sort((a, b) => a.days - b.days || a.person.name.localeCompare(b.person.name));
}

/** "Birthday", "Anniversary" or what you called it. */
export const dateName = (d: KeyDate) => (d.kind === 'other' ? d.label.trim() || 'A date' : KEY_DATE_LABEL[d.kind]);

/** "Ana's birthday · turning 30", "10 years together"… */
export function whatsComing(u: Upcoming) {
  const first = u.person.name.trim().split(/\s+/)[0] || 'Someone';
  const what = u.date.kind === 'other' ? `${first} · ${dateName(u.date)}` : `${first}’s ${dateName(u.date).toLowerCase()}`;
  const years = u.years === null ? '' : u.date.kind === 'birthday' ? `turning ${u.years}` : u.date.kind === 'anniversary' ? `${u.years} ${u.years === 1 ? 'year' : 'years'}` : `${u.years} ${u.years === 1 ? 'year' : 'years'} ago`;
  return { what, years };
}

export const whenLabel = (days: number) => (days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `In ${days} days`);

/* ---------- tags on other pages ---------- */

export type Page = { kind: 'person'; item: Person } | { kind: 'book'; item: Book } | { kind: 'song'; item: Song };

/** Ids of the people some words tag. */
export const peopleIn = (text: string, people: Person[]) =>
  text.includes('@[') ? [...new Set([...text.matchAll(PERSON)].map((m) => resolvePerson(m[1], m[2], people)?.id).filter(Boolean) as string[])] : [];

/** person id → the pages of other people, books and songs whose words tag them. */
export function pagesByPerson(people: Person[], books: Book[], songs: Song[]) {
  const out = new Map<string, Page[]>();
  const add = (text: string, page: Page, self?: string) => {
    for (const id of peopleIn(text, people)) {
      if (id === self) continue;
      const list = out.get(id);
      if (list) list.push(page);
      else out.set(id, [page]);
    }
  };
  for (const item of people) add(item.text, { kind: 'person', item }, item.id);
  for (const item of books) add(item.text, { kind: 'book', item });
  for (const item of songs) add(item.text, { kind: 'song', item });
  for (const list of out.values()) list.sort((a, b) => b.item.updated - a.item.updated);
  return out;
}

/** person id → the notes and check-ins they're tagged in, under "Thinking of" or in the words, newest first. */
export function momentsByPerson(entries: Entry[], people: Person[]) {
  const m = new Map<string, Entry[]>();
  for (const e of entries) {
    const ids = new Set(e.people);
    for (const id of peopleIn(e.text, people)) ids.add(id);
    for (const id of ids) {
      const list = m.get(id);
      if (list) list.push(e);
      else m.set(id, [e]);
    }
  }
  return m;
}

/* ---------- how it's changing ---------- */

export interface Month { y: number; m: number; worlds: [string, number][]; total: number; warmth: number | null }

/**
 * The last `count` months of feelings in someone's moments, oldest first: each month's mix of worlds, and its warmth,
 * the share of those feelings that were pleasant (null for a month without any).
 */
export function monthsOf(moments: Entry[], count = 12, now = new Date()): Month[] {
  const out: Month[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    out.push({ y: d.getFullYear(), m: d.getMonth(), worlds: [], total: 0, warmth: null });
  }
  const at = new Map(out.map((x, i) => [x.y * 12 + x.m, i]));
  const counts = out.map(() => new Map<string, number>());
  for (const e of moments) {
    const d = parseKey(e.date);
    const i = at.get(d.getFullYear() * 12 + d.getMonth());
    if (i === undefined) continue;
    for (const id of e.emotions) {
      const c = coreOf(id)?.id;
      if (c) counts[i].set(c, (counts[i].get(c) ?? 0) + 1);
    }
  }
  out.forEach((x, i) => {
    x.worlds = [...counts[i]].sort((a, b) => b[1] - a[1]);
    x.total = x.worlds.reduce((s, [, n]) => s + n, 0);
    const warm = x.worlds.reduce((s, [c, n]) => s + (CORE[c].valence === 'pleasant' ? n : 0), 0);
    x.warmth = x.total ? warm / x.total : null;
  });
  return out;
}

/**
 * Warmer, heavier, or about the same: the last three months against the months before, when both have feelings
 * in them. Null when there isn't enough to say.
 */
export function trendOf(months: Month[]): 'warmer' | 'heavier' | 'steady' | null {
  const share = (list: Month[]) => {
    const total = list.reduce((s, x) => s + x.total, 0);
    return total ? list.reduce((s, x) => s + (x.warmth ?? 0) * x.total, 0) / total : null;
  };
  const recent = share(months.slice(-3)), before = share(months.slice(0, -3));
  if (recent === null || before === null) return null;
  return recent - before > 0.15 ? 'warmer' : before - recent > 0.15 ? 'heavier' : 'steady';
}
