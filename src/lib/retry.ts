/**
 * Tries a request again when it couldn't reach the server or the server stumbled — a phone waking up
 * before its connection is back, or a redeploy — so a moment's hiccup doesn't look like being signed out.
 * Answers the server meant (4xx) and timeouts (504, already long waits) come back at once.
 * With no connection at all, it waits a little for one to come back before giving up.
 */
export async function retry<T>(load: () => Promise<T>, waits = [700, 2000, 4000], offlineWait = 8000): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      return await load();
    } catch (e) {
      const status = (e as { status?: number }).status;
      if (i >= waits.length || (status !== undefined && status !== 502 && status !== 503)) throw e;
      if (navigator.onLine === false) {
        if (!(await backOnline(offlineWait))) throw e;
      } else await new Promise((r) => setTimeout(r, waits[i]));
    }
  }
}

/** Resolves true as soon as the device is online again, or false after `ms`. */
function backOnline(ms: number) {
  return new Promise<boolean>((resolve) => {
    const done = (ok: boolean) => {
      clearTimeout(timer);
      removeEventListener('online', onOnline);
      resolve(ok);
    };
    const onOnline = () => done(true);
    const timer = setTimeout(() => done(false), ms);
    addEventListener('online', onOnline);
  });
}
