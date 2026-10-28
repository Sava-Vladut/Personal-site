// Global Ops dev: how work on the browser port is going, read live by the server from the port's folder (see
// server/glopsdev.js): git, deploys, builds, PORTING_LOG.md and what agents are doing to it. Admin only.
// While the page is open it's fetched again every few seconds when the port is being worked on and every half
// minute otherwise (the server answers "not modified" when nothing changed), and at once when the tab comes back.
import { useEffect, useState } from 'preact/hooks';
import { t } from './i18n';

export interface LogItem { text: string; date?: string; time?: string; when?: string; done?: boolean }
export interface LogSection { title: string; body: string; items: LogItem[] | null }
export interface CommitFile { path: string; added: number; removed: number }
export interface Commit {
  hash: string; at: number; author: string; subject: string; body: string; files: number; added: number; removed: number;
  paths: CommitFile[];
  /** touches more than notes (*.md) */
  code: boolean;
  /** made before the last deploy */
  live: boolean;
}
export interface Branch { name: string; hash: string; at: number; subject: string }
export interface Repo { branch: string; upstream: string | null; ahead: number; behind: number; branches: Branch[]; github: string | null }
export interface Change { path: string; state: 'new' | 'changed' | 'added' | 'deleted'; added: number; removed: number; at: number | null }
export interface Touched { path: string; at: number }
export interface Deploy { name: string; at: number; kind: 'page' | 'multiplayer' | 'servers' | 'relay' | 'other'; topic: string; title?: string; note?: string }
/** What's live (`dir` null) or a build folder's newest build. */
export interface Build { name: 'deployed' | 'page' | 'native' | 'browser'; dir: string | null; at: number | null }
export interface LogFile { path: string; at: number; size: number; lines: string[] }
export interface Shot { name: string; at: number }
/** One thing a session did to the port (from the activity hook): a tool call, a prompt, or its turn ending. */
export interface Happening { t: number; ev: 'tool' | 'prompt' | 'stop'; s: string; tool: string; text: string }
export interface Session {
  id: string;
  first: number;
  last: number;
  /** working: did something in the last few minutes; waiting: its turn ended; idle: neither */
  state: 'working' | 'waiting' | 'idle';
  minutes: number;
  tools: number;
  edits: number;
  commands: number;
  turns: number;
  /** what it was asked, newest first */
  prompts: { t: number; text: string }[];
  /** the start of its last reply */
  reply: string | null;
  replyAt: number | null;
  action: { t: number; tool: string; text: string } | null;
  files: { path: string; n: number }[];
}
export interface DevState {
  now: number;
  /** the latest change of any kind: an edit, a build, a log line, a commit or a hook entry */
  lastWork: number | null;
  /** something changed in the last ten minutes */
  live: boolean;
  repo: Repo | null;
  log: { title: string; at: number | null; sections: LogSection[] };
  commits: Commit[];
  /** commits with code made since the last deploy */
  undeployed: number;
  changes: Change[];
  touched: Touched[];
  deploys: Deploy[];
  builds: Build[];
  logs: LogFile[];
  shots: Shot[];
  sessions: Session[];
  activity: Happening[];
}

export const LIVE_EVERY = 5_000;
export const IDLE_EVERY = 30_000;

type State = { data: DevState | null; error: string | null; loading: boolean; skew: number };

/** The dev state, polled while the page is up. `skew` is how far the server's clock is ahead of this device's. */
export function useGlopsDev() {
  const [s, setS] = useState<State>({ data: null, error: null, loading: true, skew: 0 });
  const [nudge, setNudge] = useState(0);
  useEffect(() => {
    let timer = 0, stopped = false, live = false;
    const load = async () => {
      clearTimeout(timer);
      if (document.hidden) return; // picked up again when the tab is visible
      try {
        const r = await fetch('/api/glops-dev', { cache: 'no-cache', signal: AbortSignal.timeout(15_000) });
        const body = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(body.error || t('The game’s development couldn’t be loaded.'));
        if (stopped) return;
        live = (body as DevState).live;
        setS({ data: body as DevState, error: null, loading: false, skew: (body as DevState).now - Date.now() });
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

/** A section of PORTING_LOG.md, by its title. */
export const section = (d: DevState, title: RegExp) => d.log.sections.find((s) => title.test(s.title)) ?? null;
