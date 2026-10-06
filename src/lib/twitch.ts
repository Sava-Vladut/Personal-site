// Channel points, summed up by the server from the Twitch Channel Points Miner (see server/twitch.js).
// One copy is kept for the whole app, so the wheel and the page share it, and it's fetched again
// when it's a minute old.
import { useEffect, useState } from 'preact/hooks';

export interface Change { day: number; week: number; month: number }
export interface Channel {
  name: string;
  balance: number;
  firstAt: number;
  lastAt: number;
  live: boolean;
  change: Change;
  /** what each reason brought in over the last 30 days; negative for what was spent */
  reasons: Record<string, number>;
  /** the balance at the end of each day, oldest first; null before the channel was followed */
  daily: (number | null)[];
}
export interface Happening { channel: string; at: number; reason: string; delta: number }
export interface Points {
  user: string;
  now: number;
  /** the first day of `daily`, midnight UTC */
  start: number;
  total: number;
  change: Change;
  reasons: Record<string, number>;
  daily: (number | null)[];
  recent: Happening[];
  channels: Channel[];
}

type State = { data: Points | null; error: string | null; loading: boolean };

const FRESH = 60_000;
let state: State = { data: null, error: null, loading: false };
let fetchedAt = 0;
let pending: Promise<void> | null = null;
const subs = new Set<(s: State) => void>();
const set = (next: Partial<State>) => {
  state = { ...state, ...next };
  subs.forEach((f) => f(state));
};

export function loadPoints(force = false) {
  if (pending || (!force && Date.now() - fetchedAt < FRESH && state.data)) return pending;
  set({ loading: true });
  pending = fetch('/api/twitch')
    .then(async (r) => {
      const body = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(body.error || 'Channel points couldn’t be loaded.');
      fetchedAt = Date.now();
      set({ data: body as Points, error: null, loading: false });
    })
    .catch((e: Error) => set({ error: e.message || 'Channel points couldn’t be loaded.', loading: false }))
    .finally(() => (pending = null));
  return pending;
}

/** The channel points, loaded while `on` and refreshed every minute the page stays visible. */
export function usePoints(on = true) {
  const [s, setS] = useState(state);
  useEffect(() => {
    subs.add(setS);
    setS(state);
    return () => void subs.delete(setS);
  }, []);
  useEffect(() => {
    if (!on) return;
    loadPoints();
    const timer = setInterval(() => !document.hidden && loadPoints(), FRESH);
    const wake = () => !document.hidden && loadPoints();
    document.addEventListener('visibilitychange', wake);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', wake);
    };
  }, [on]);
  return s;
}

/** 3,460,651 → "3.46M"; 43,454 → "43.5K". */
export function compact(n: number) {
  const a = Math.abs(n);
  if (a >= 1e6) return `${(n / 1e6).toFixed(a >= 1e7 ? 1 : 2)}M`;
  if (a >= 1e4) return `${(n / 1e3).toFixed(1)}K`;
  return String(n);
}
