// Global Ops player stats. The game was taken offline on 2026-11-22; the final numbers its multiplayer relay had counted
// (since 2026-10-28) are kept in data/glopsFinal.json, loaded on demand, and nothing is fetched from a server any more.
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

let final: GlopsStats | null = null;
const loadGlops = () => import('../data/glopsFinal.json').then((m) => (final = m.default as unknown as GlopsStats));

/** The final stats, loaded while `on`. */
export function useGlops(on = true) {
  const [data, setData] = useState(final);
  useEffect(() => {
    if (on && !final) void loadGlops().then(setData);
  }, [on]);
  return { data, error: null as string | null, loading: on && !data };
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
