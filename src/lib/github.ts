import { useEffect, useState } from 'preact/hooks';
import { LOCALE, t } from './i18n';
import { retry } from './retry';

// Talks to our own server (server/index.js), which holds the GitHub client secret and
// keeps the access token in an encrypted, http-only cookie. The browser never sees either.
export interface GithubStatus {
  configured: boolean;       // server has GITHUB_CLIENT_ID / SECRET
  connected: boolean;        // this browser has signed in to GitHub
  user?: { name: string };
  public?: number;           // public repos
  private?: number;          // private repos (only when GitHub lets us see them)
  privateVisible?: boolean;
  canClone?: boolean;        // the site's owner, signed in as admin: can clone repos onto the server
  error?: string;
  offline?: boolean;
}

/** Leaves for GitHub's sign-in; comes back to Settings with ?github=connected. */
export const connectGithub = () => {
  location.href = '/api/github/connect';
};
export const disconnectGithub = () => fetch('/api/github/disconnect', { method: 'POST' });

/* ---------- repos ---------- */

/** A repo as GitHub describes it (server/index.js trims it down). */
export interface GhRepo {
  id: number;
  name: string;
  owner: string;
  description: string;
  language: string;
  private: boolean;
  fork: boolean;
  archived: boolean;
  stars: number;
  pushed: string;     // ISO time of the last push
  branch: string;     // the default branch
  url: string;
}
export interface GhCommit { sha: string; message: string; author: string; date: string; url: string }

// Every request here only reads, so one that couldn't get through is safely tried again.
const get = <T>(path: string) => retry(() => once<T>(path));

async function once<T>(path: string, method = 'GET'): Promise<T> {
  let res: Response;
  try {
    res = await fetch('/api/github' + path, { method, credentials: 'same-origin' });
  } catch {
    throw new Error(t('Can’t reach the server. GitHub needs the app’s server running (npm start).'));
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(body.error ? t(body.error) : t('GitHub request failed ({status})', { status: res.status })), { status: res.status });
  return body as T;
}

export const githubStatus = () =>
  get<GithubStatus>('/status').catch(() => ({ configured: false, connected: false, offline: true }) as GithubStatus);

export const repoFullName = (r: Pick<GhRepo, 'owner' | 'name'>) => `${r.owner}/${r.name}`;
export const getGhRepo = (id: number | string) => get<GhRepo>(`/repos/${id}`);
export const listCommits = (id: number | string, page = 1) => get<{ items: GhCommit[]; next?: number }>(`/repos/${id}/commits?page=${page}`);

/** A clone onto the server (server/clone.js), as it's going. */
export interface CloneJob { id: number; name: string; path: string; state: 'running' | 'done' | 'failed'; error?: string; startedAt: number; endedAt?: number }
/** Starting a clone changes the server, so it's sent once and never retried. */
export const cloneRepo = (id: number | string) => once<CloneJob>(`/repos/${id}/clone`, 'POST');
export const listClones = () => get<{ items: CloneJob[] }>('/clones');
const readmes = new Map<string, Promise<{ text: string | null }>>();
export const getReadme = (id: number | string) => {
  const key = String(id);
  let request = readmes.get(key);
  if (!request) {
    request = get<{ text: string | null }>(`/repos/${id}/readme`).catch((error) => {
      if (readmes.get(key) === request) readmes.delete(key);
      throw error;
    });
    if (readmes.size >= 100) readmes.delete(readmes.keys().next().value!);
    readmes.set(key, request);
  }
  return request;
};

// Your repos are listed once per visit and kept in memory (never on disk): going into a repo and back is instant.
let cached: { items: GhRepo[]; at: number } | null = null;
let inflight: Promise<GhRepo[]> | null = null;
const FRESH = 5 * 60_000;

/** The repo list's cache lives only as long as the page: disconnecting forgets it. */
export const forgetRepos = () => { cached = null; readmes.clear(); };

export const listGhRepos = (force = false): Promise<GhRepo[]> => {
  if (!force && cached && Date.now() - cached.at < FRESH) return Promise.resolve(cached.items);
  inflight ??= get<{ items: GhRepo[] }>('/repos')
    .then(({ items }) => (cached = { items, at: Date.now() }).items)
    .finally(() => { inflight = null; });
  return inflight;
};
/** What's known of a repo without asking: it was in the list this visit. */
export const cachedRepo = (id: number | string) => cached?.items.find((r) => String(r.id) === String(id)) ?? null;

const relative = new Intl.RelativeTimeFormat(LOCALE, { numeric: 'auto', style: 'short' });
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [['year', 31_557_600], ['month', 2_629_800], ['week', 604_800], ['day', 86_400], ['hour', 3600], ['minute', 60]];
/** "3 days ago" for a time GitHub gave. */
export function ago(iso: string) {
  const ms = Date.parse(iso);
  if (!ms) return '';
  const s = Math.max(0, (Date.now() - ms) / 1000);
  for (const [unit, size] of UNITS) if (s >= size) return relative.format(-Math.floor(s / size), unit);
  return t('just now');
}

export type Loaded<T> = { data: T | null; error: string | null; status?: number; loading: boolean };

/** Runs a request when `key` changes, giving back the latest answer. */
export function useLoad<T>(load: () => Promise<T>, key: unknown, initial: T | null = null): Loaded<T> & { reload: () => void } {
  const [state, setState] = useState<Loaded<T>>({ data: initial, error: null, loading: true });
  const [again, setAgain] = useState(0);
  useEffect(() => {
    let live = true;
    setState((s) => ({ ...s, error: null, status: undefined, loading: true }));
    load().then(
      (data) => live && setState({ data, error: null, loading: false }),
      (e: Error & { status?: number }) => live && setState((s) => ({ ...s, error: e.message, status: e.status, loading: false })),
    );
    return () => { live = false; };
  }, [key, again]);
  return { ...state, reload: () => setAgain((n) => n + 1) };
}
