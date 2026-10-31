// Signing in with the admin password (ADMIN_PASSWORD on the server), which leaves a sealed cookie for 90 days. The site
// itself opens without it: signing in only lets a device publish notes and change the miner's channels. A note in
// localStorage remembers that this device is signed in, for Settings.
import { t } from './i18n';

const KEY = 'mm-signed-in';
const INTRO_SEEN = 'mm-intro-seen';

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

/** Whether the intro has played in this visit (this tab, until it's closed): it plays once when the app opens. */
export function introSeen(): boolean {
  try {
    return sessionStorage.getItem(INTRO_SEEN) === '1';
  } catch {
    return false;
  }
}

export function markIntroSeen() {
  try {
    sessionStorage.setItem(INTRO_SEEN, '1');
  } catch {}
}

async function call(method: string, body?: unknown) {
  let r: Response;
  try {
    r = await fetch('/api/admin', {
      method,
      signal: AbortSignal.timeout(15_000), // a stalled connection fails instead of spinning
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
