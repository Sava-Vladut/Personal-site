// Live player stats of the games on the site (Global Ops, Card Wars), each read from its own address, public, no sign-in.
// One copy of each for the whole app, fetched again every 30 seconds while a page showing it is open and visible.
import { useEffect, useState } from 'preact/hooks';
import { t } from './i18n';

export type LiveState<T> = { data: T | null; error: string | null; loading: boolean };

const FRESH = 30_000;

/** A shared copy of the stats at `url`; `tidy` turns what came into the shape the pages read. */
export function liveStats<T>(url: string, tidy: (raw: unknown) => T = (raw) => raw as T) {
  let state: LiveState<T> = { data: null, error: null, loading: false };
  let fetchedAt = 0;
  let pending: Promise<void> | null = null;
  const subs = new Set<(s: LiveState<T>) => void>();
  const set = (next: Partial<LiveState<T>>) => {
    state = { ...state, ...next };
    subs.forEach((f) => f(state));
  };
  const unavailable = () => t('The game’s stats aren’t available right now.');

  function load(force = false) {
    if (pending || (!force && Date.now() - fetchedAt < FRESH && state.data)) return pending;
    set({ loading: true });
    // always asked again, but with the copy the browser kept: unchanged stats come back as a 304 with no body
    pending = fetch(url, { cache: 'no-cache', signal: AbortSignal.timeout(15_000) })
      .then(async (r) => {
        if (!r.ok) throw new Error(unavailable());
        let data: T;
        try {
          data = tidy(await r.json());
        } catch {
          throw new Error(unavailable());
        }
        fetchedAt = Date.now();
        set({ data, error: null, loading: false });
      }, () => { throw new Error(t('Couldn’t reach the server. Check your connection.')); })
      .catch((e: Error) => set({ error: e.message || unavailable(), loading: false }))
      .finally(() => (pending = null));
    return pending;
  }

  /** The stats, loaded while `on` and refreshed every 30 seconds the page stays visible. */
  function use(on = true) {
    const [s, setS] = useState(state);
    useEffect(() => {
      subs.add(setS);
      setS(state);
      return () => void subs.delete(setS);
    }, []);
    useEffect(() => {
      if (!on) return;
      load();
      const timer = setInterval(() => !document.hidden && load(), FRESH);
      const wake = () => !document.hidden && load();
      document.addEventListener('visibilitychange', wake);
      return () => {
        clearInterval(timer);
        document.removeEventListener('visibilitychange', wake);
      };
    }, [on]);
    return s;
  }

  return { load, use };
}
