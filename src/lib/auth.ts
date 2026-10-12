// Signing in to the site with the admin password (ADMIN_PASSWORD on the server), which leaves a sealed cookie for 90 days.
// A device that isn't signed in opens on the intro instead of the journal. The journal itself still lives in each browser,
// so this is a front door rather than a lock. A note in localStorage remembers that this device is signed in, so the app
// opens at once (offline too) and only checks with the server in the background.
import { t } from './i18n';

const KEY = 'mm-signed-in';

export interface AuthStatus { configured: boolean; admin: boolean }

export function signedInHere(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function rememberSignedIn(on: boolean) {
  try {
    if (on) localStorage.setItem(KEY, '1');
    else localStorage.removeItem(KEY);
  } catch {}
}

/** What the server says about this browser, or null when it can't be reached in time. */
export async function authStatus(timeout = 2500): Promise<AuthStatus | null> {
  const stop = new AbortController();
  const timer = setTimeout(() => stop.abort(), timeout);
  try {
    const r = await fetch('/api/admin', { signal: stop.signal, cache: 'no-store' });
    if (!r.ok) return null;
    const s = await r.json();
    return { configured: !!s.configured, admin: !!s.admin };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Where a device without the note opens: the app when the server has no password to ask for, or this browser's cookie is still good. */
export function opensOn(status: AuthStatus | null): 'app' | 'intro' {
  return status && (!status.configured || status.admin) ? 'app' : 'intro';
}

/** Whether a device that thinks it's signed in still is. Only a clear no from the server counts: offline, it stays in. */
export async function stillSignedIn(): Promise<boolean> {
  const s = await authStatus(8000);
  if (s && s.configured && !s.admin) {
    rememberSignedIn(false);
    return false;
  }
  return true;
}

async function call(method: string, body?: unknown) {
  let r: Response;
  try {
    r = await fetch('/api/admin', {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new Error(t('Couldn’t reach the server. Check your connection.'));
  }
  const out = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(out.error || t('Something went wrong on the server.'));
}

export async function signIn(password: string) {
  await call('POST', { password });
  rememberSignedIn(true);
}

export async function signOut() {
  await call('DELETE');
  rememberSignedIn(false);
}
