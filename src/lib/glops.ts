// The Global Ops port's progress, read live by the server from the port's folder (see server/glops.js).
// While the page is open it's fetched again every few seconds when the port is being worked on and every half
// minute otherwise (the server answers "not modified" when nothing changed), and at once when the tab comes back.
import { useEffect, useState } from 'preact/hooks';
import { t } from './i18n';

export interface LogItem { text: string; date?: string; when?: string; done?: boolean }
export interface LogSection { title: string; body: string; items: LogItem[] | null }
export interface Commit { hash: string; at: number; author: string; subject: string; body: string; files: number; added: number; removed: number }
export interface Change { path: string; state: 'new' | 'changed' | 'added' | 'deleted'; added: number; removed: number; at: number | null }
export interface Touched { path: string; at: number }
export interface Build { name: 'native' | 'browser' | 'deployed'; at: number | null }
export interface LogFile { path: string; at: number; size: number; lines: string[] }
export interface Shot { name: string; at: number }
/** One thing a session did to the port (from the activity hook), or the session stopping. */
export interface Happening { t: number; ev: 'tool' | 'stop'; s: string; tool: string; text: string }
export interface Progress {
  now: number;
  /** the latest change of any kind: an edit, a build, a log line, a commit or a hook entry */
  lastWork: number | null;
  /** something changed in the last ten minutes */
  live: boolean;
  log: { title: string; at: number | null; sections: LogSection[] };
  commits: Commit[];
  changes: Change[];
  touched: Touched[];
  builds: Build[];
  logs: LogFile[];
  shots: Shot[];
  activity: Happening[];
}

export const LIVE_EVERY = 5_000;
export const IDLE_EVERY = 30_000;

type State = { data: Progress | null; error: string | null; loading: boolean; fetchedAt: number; skew: number };

/** The progress, polled while the page is up. `skew` is how far the server's clock is ahead of this device's. */
export function useGlops() {
  const [s, setS] = useState<State>({ data: null, error: null, loading: true, fetchedAt: 0, skew: 0 });
  const [nudge, setNudge] = useState(0);
  useEffect(() => {
    let timer = 0, stopped = false, live = false;
    const load = async () => {
      clearTimeout(timer);
      if (document.hidden) return; // picked up again when the tab is visible
      try {
        const r = await fetch('/api/glops', { cache: 'no-cache', signal: AbortSignal.timeout(15_000) });
        const body = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(body.error || t('The port’s progress couldn’t be loaded.'));
        if (stopped) return;
        live = (body as Progress).live;
        setS({ data: body as Progress, error: null, loading: false, fetchedAt: Date.now(), skew: (body as Progress).now - Date.now() });
      } catch (e) {
        if (stopped) return;
        const message = e instanceof TypeError || (e as Error).name === 'TimeoutError' ? t('Couldn’t reach the server. Check your connection.') : (e as Error).message;
        setS((p) => ({ ...p, error: message, loading: false }));
      }
      if (!stopped) timer = window.setTimeout(load, live ? LIVE_EVERY : IDLE_EVERY);
    };
    const wake = () => !document.hidden && load();
    load();
    document.addEventListener('visibilitychange', wake);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', wake);
    };
  }, [nudge]);
  return { ...s, refresh: () => setNudge((n) => n + 1) };
}

/** The port's own section of PORTING_LOG.md, by its title. */
export const section = (p: Progress, title: RegExp) => p.log.sections.find((s) => title.test(s.title)) ?? null;
