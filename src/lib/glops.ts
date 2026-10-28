// Global Ops player stats: who plays the browser port at savavlad.com/glops, counted by its multiplayer relay
// (netrelay.mjs in the port's repo) and served next to the game at /glops/net/analytics, public, no sign-in.
// One copy for the whole app, fetched again every 30 seconds while the page is open and visible.
import { useEffect, useState } from 'preact/hooks';
import { LOCALE, t } from './i18n';

export interface Peak { n: number; at: string | null }
export interface GlopsDay { day: string; peak: number; playing: number; visitors: number; new: number; sessions: number; plays: number; playMin: number }
export interface GlopsStats {
  now: string;
  /** when counting started */
  since: string;
  /** browsers with the game open */
  online: number;
  /** of those, in a match on one of the servers */
  playing: number;
  /** the servers up now (1-4) and who is on each */
  servers: { n: number; name: string; players: number }[];
  peak: { online: Peak; playing: Peak; servers: Record<string, Peak> };
  /** minutes played on each server */
  serverMin: Record<string, number>;
  visitors: number;
  sessions: number;
  plays: number;
  onlineMin: number;
  playMin: number;
  longest: { min: number; at: string | null };
  /** visit lengths: counts[0] under bounds[0] minutes, counts[i] from bounds[i-1] up to bounds[i], the last above */
  lengths: { bounds: number[]; counts: number[] };
  /** minutes with the game open by hour of the week, UTC, Sunday 0:00 first */
  week: number[];
  /** a line per UTC day, oldest first */
  days: GlopsDay[];
  /** [start ms, most online, most in a match] for every `seriesMs` (5 minutes) of the last week */
  series: [number, number, number][];
  seriesMs: number;
}

type State = { data: GlopsStats | null; error: string | null; loading: boolean };

const FRESH = 30_000;
let state: State = { data: null, error: null, loading: false };
let fetchedAt = 0;
let pending: Promise<void> | null = null;
const subs = new Set<(s: State) => void>();
const set = (next: Partial<State>) => {
  state = { ...state, ...next };
  subs.forEach((f) => f(state));
};

export function loadGlops(force = false) {
  if (pending || (!force && Date.now() - fetchedAt < FRESH && state.data)) return pending;
  set({ loading: true });
  pending = fetch('/glops/net/analytics', { cache: 'no-store', signal: AbortSignal.timeout(15_000) })
    .then(async (r) => {
      if (!r.ok) throw new Error(t('The game’s stats aren’t available right now.'));
      fetchedAt = Date.now();
      set({ data: (await r.json()) as GlopsStats, error: null, loading: false });
    }, () => { throw new Error(t('Couldn’t reach the server. Check your connection.')); })
    .catch((e: Error) => set({ error: e.message || t('The game’s stats aren’t available right now.'), loading: false }))
    .finally(() => (pending = null));
  return pending;
}

/** The stats, loaded while `on` and refreshed every 30 seconds the page stays visible. */
export function useGlops(on = true) {
  const [s, setS] = useState(state);
  useEffect(() => {
    subs.add(setS);
    setS(state);
    return () => void subs.delete(setS);
  }, []);
  useEffect(() => {
    if (!on) return;
    loadGlops();
    const timer = setInterval(() => !document.hidden && loadGlops(), FRESH);
    const wake = () => !document.hidden && loadGlops();
    document.addEventListener('visibilitychange', wake);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', wake);
    };
  }, [on]);
  return s;
}

/** Minutes with the game open by weekday (Monday first) and 3-hour block of the viewer's own day. */
export function busyBlocks(week: number[], offsetMin = -new Date().getTimezoneOffset()) {
  const heat = Array.from({ length: 7 }, () => Array(8).fill(0) as number[]);
  const shift = Math.round(offsetMin / 60);
  week.forEach((v, i) => {
    const h = (i + shift + 168) % 168;   // the hour of the week, local; 0 is Sunday 0:00
    heat[(Math.floor(h / 24) + 6) % 7][Math.floor((h % 24) / 3)] += v;
  });
  return heat;
}

/** "45 min", "3.5 h", "120 h" */
export function hoursText(min: number) {
  if (min < 60) return t('{n} min', { n: Math.round(min) });
  const h = min / 60;
  return t('{n} h', { n: h < 10 ? h.toLocaleString(LOCALE, { maximumFractionDigits: 1 }) : Math.round(h).toLocaleString(LOCALE) });
}
