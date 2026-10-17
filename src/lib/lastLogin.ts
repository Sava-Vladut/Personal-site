// Remembers who this device was last logged in to Spotify / GitHub as (only the name, never a token), so a moment
// the server can't be reached (a redeploy, a phone waking up) shows as "can't reach it", not as being logged out.
// Only the server saying "not connected" forgets it.
type Status = { configured: boolean; connected: boolean; user?: { name: string }; offline?: boolean };

const key = (service: string) => `mm-last-login-${service}`;

/** Notes what the server said: who's logged in, or that nobody is. */
export function remember<T extends Status>(service: string, status: T): T {
  try {
    if (!status.connected) localStorage.removeItem(key(service));
    else if (status.user) localStorage.setItem(key(service), JSON.stringify(status.user));
  } catch { /* private mode: nothing to remember with */ }
  return status;
}

/** The server couldn't be asked: the last login known on this device, marked offline, or `fallback`. */
export function recall<T extends Status>(service: string, fallback: T): T {
  try {
    const user = JSON.parse(localStorage.getItem(key(service)) || 'null');
    if (user && typeof user.name === 'string') return { ...fallback, configured: true, connected: true, user };
  } catch { /* unreadable: treat as unknown */ }
  return fallback;
}
