// GitHub projects, as the server sums them up (see server/github.js): the public repositories with every commit's
// time, and pages of commits with their messages. One copy is kept for the whole app, so the wheel and the pages
// share it, and it's fetched again when it's five minutes old. Days, weeks and hours are counted in local time.
import { useEffect, useState } from 'preact/hooks';
import { DAY, addDays, keyOf, parseKey, startOfWeek, todayKey, weekday } from './dates';

export interface Repo {
  name: string;
  description: string;
  url: string;
  homepage: string;
  language: string;
  topics: string[];
  stars: number;
  forks: number;
  issues: number;
  watchers: number;
  size: number;
  fork: boolean;
  archived: boolean;
  /** only there when this browser is signed in with GitHub */
  private: boolean;
  branch: string;
  createdAt: number;
  pushedAt: number;
  commits: number;
  /** bytes of code in each language */
  languages: Record<string, number>;
  /** every commit's time in seconds, newest first */
  times: number[];
  last: { m: string; at: number } | null;
}
export interface Commit { sha: string; m: string; at: number; by: string; repo: string }
export interface Profile { login: string; name: string; avatar: string; url: string; bio: string; followers: number; following: number; createdAt: number }
export interface Github {
  user: string;
  profile: Profile | null;
  now: number;
  checkedAt: number;
  /** the last refresh failed, so this may be a little old */
  stale: boolean;
  repos: Repo[];
  recent: Commit[];
  /** the GitHub account this browser is signed in with, whose private repositories are included */
  viewer: Viewer | null;
  /** whether the server can sign in with GitHub */
  signIn: boolean;
}
export interface Viewer { login: string; avatar: string }
export interface AuthStatus { configured: boolean; connected: boolean; viewer: Viewer | null; owner: string | null; redirect: string | null }

type State = { data: Github | null; error: string | null; loading: boolean };

const FRESH = 5 * 60_000;
let state: State = { data: null, error: null, loading: false };
let fetchedAt = 0;
let pending: Promise<void> | null = null;
const subs = new Set<(s: State) => void>();
const set = (next: Partial<State>) => {
  state = { ...state, ...next };
  subs.forEach((f) => f(state));
};

async function call<T>(path: string): Promise<T> {
  let r: Response;
  try {
    r = await fetch(path);
  } catch {
    throw new Error('Can’t reach the server.');
  }
  const body = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(body.error || 'GitHub projects couldn’t be loaded.');
  return body as T;
}

let generation = 0; // signing out starts a new one: anything asked for before it is dropped

export function loadGithub(force = false) {
  if (pending || (!force && Date.now() - fetchedAt < FRESH && state.data)) return pending;
  set({ loading: true });
  const gen = generation;
  const p: Promise<void> = call<Github>('/api/github')
    .then((data) => {
      if (gen !== generation) return;
      fetchedAt = Date.now();
      set({ data, error: null, loading: false });
    })
    .catch((e: Error) => {
      if (gen === generation) set({ error: e.message, loading: false });
    })
    .finally(() => {
      if (pending === p) pending = null;
    });
  pending = p;
  return p;
}

/** The projects, loaded while `on` and refreshed every five minutes the page stays visible. */
export function useGithub(on = true) {
  const [s, setS] = useState(state);
  useEffect(() => {
    subs.add(setS);
    setS(state);
    return () => void subs.delete(setS);
  }, []);
  useEffect(() => {
    if (!on) return;
    loadGithub();
    const timer = setInterval(() => !document.hidden && loadGithub(), FRESH);
    const wake = () => !document.hidden && loadGithub();
    document.addEventListener('visibilitychange', wake);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', wake);
    };
  }, [on]);
  return s;
}

/* ---------- signing in, to see private repositories ---------- */

export const githubStatus = () => call<AuthStatus>('/api/github/status');

/** Leaves for GitHub's sign-in; comes back to `back` with ?github=connected (or cancelled, wrong-account, error). */
export const connectGithub = (back = '#/projects') => {
  location.href = '/api/github/connect?back=' + encodeURIComponent(back.split('?')[0]);
};

/** Signs this browser out of GitHub, and forgets the private repositories it was shown. */
export async function disconnectGithub() {
  const r = await fetch('/api/github/disconnect', { method: 'POST' }).catch(() => null);
  if (!r?.ok) throw new Error('Couldn’t sign out of GitHub. Try again.');
  generation++;
  pending = null;
  fetchedAt = 0;
  set({ data: null, error: null });
  await loadGithub(true);
}

export interface CommitPage { commits: Commit[]; next: number | null; total: number }
/** A page of commits, newest first: one project's, or every project's together. */
export const commitPage = (repo: string | null, page: number) =>
  call<CommitPage>(repo ? `/api/github/repos/${encodeURIComponent(repo)}/commits?page=${page}` : `/api/github/commits?page=${page}`);

export const commitUrl = (profile: Profile | null, c: Commit) => `${profile?.url ?? 'https://github.com'}/${c.repo}/commit/${c.sha}`;

/* ---------- counting ---------- */

export type Range = '30' | '90' | '365' | 'all';
export const RANGE_DAYS: Record<Range, number | null> = { '30': 30, '90': 90, '365': 365, all: null };

/** Commits per local day, 'YYYY-MM-DD' → how many. */
export function perDay(times: number[]) {
  const out = new Map<string, number>();
  for (const s of times) {
    const k = keyOf(new Date(s * 1000));
    out.set(k, (out.get(k) ?? 0) + 1);
  }
  return out;
}

/** Every commit time of the given repositories, newest first. */
export const allTimes = (repos: Repo[]) => repos.flatMap((r) => r.times).sort((a, b) => b - a);

/** The first day a range covers ('' for all of it). */
export const rangeStart = (range: Range) => (RANGE_DAYS[range] ? addDays(todayKey(), 1 - RANGE_DAYS[range]!) : '');

/** Times on or after a day ('' keeps them all). */
export const since = (times: number[], day: string) => {
  if (!day) return times;
  const from = parseKey(day).getTime() / 1000;
  return times.filter((s) => s >= from);
};

/** The run of days with commits that's still going (today, or up to yesterday), and the longest there's been. */
export function streaks(days: Map<string, number>) {
  const today = todayKey();
  let current = 0;
  for (let k = days.has(today) ? today : addDays(today, -1); days.has(k); k = addDays(k, -1)) current++;
  const sorted = [...days.keys()].sort();
  let longest = 0, run = 0, prev = '';
  for (const k of sorted) {
    run = prev && addDays(prev, 1) === k ? run + 1 : 1;
    longest = Math.max(longest, run);
    prev = k;
  }
  return { current, longest };
}

export type Step = 'day' | 'week' | 'month';
export interface Bucket { key: string; n: number }

/** Commits counted per day, week or month, from `start` to today, oldest first. */
export function buckets(days: Map<string, number>, start: string, step: Step, weekStart: 0 | 1): Bucket[] {
  const today = todayKey();
  const first = step === 'week' ? startOfWeek(start, weekStart) : step === 'month' ? start.slice(0, 8) + '01' : start;
  const out: Bucket[] = [];
  const index = new Map<string, number>();
  for (let k = first; k <= today; ) {
    index.set(k, out.length);
    out.push({ key: k, n: 0 });
    if (step === 'day') k = addDays(k, 1);
    else if (step === 'week') k = addDays(k, 7);
    else {
      const d = parseKey(k);
      k = keyOf(new Date(d.getFullYear(), d.getMonth() + 1, 1));
    }
  }
  for (const [k, n] of days) {
    if (k < first) continue;
    const at = step === 'day' ? k : step === 'week' ? startOfWeek(k, weekStart) : k.slice(0, 8) + '01';
    const i = index.get(at);
    if (i !== undefined) out[i].n += n;
  }
  return out;
}

/** Weekday (Monday first) × three-hour block, for the rhythm heatmap. */
export function rhythm(times: number[]) {
  const heat = Array.from({ length: 7 }, () => new Array(8).fill(0) as number[]);
  for (const s of times) {
    const d = new Date(s * 1000);
    heat[weekday(keyOf(d))][Math.floor(d.getHours() / 3)]++;
  }
  return heat;
}

/** Commits in each of the last `n` weeks, oldest first, for a sparkline. */
export function weekly(times: number[], n: number, now = Date.now()) {
  const out = new Array(n).fill(0) as number[];
  for (const s of times) {
    const w = Math.floor((now - s * 1000) / (7 * DAY));
    if (w >= n) break; // times are newest first
    if (w >= 0) out[n - 1 - w]++;
  }
  return out;
}

/** Languages by bytes, biggest first, with what share of all the code each is. */
export function languageShares(list: Record<string, number>[]) {
  const sum = new Map<string, number>();
  for (const l of list) for (const [k, v] of Object.entries(l)) sum.set(k, (sum.get(k) ?? 0) + v);
  const total = [...sum.values()].reduce((a, b) => a + b, 0);
  return [...sum].sort((a, b) => b[1] - a[1]).map(([name, bytes]) => ({ name, bytes, share: total ? bytes / total : 0 }));
}
