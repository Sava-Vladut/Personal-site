/**
 * Tries a request again when it couldn't reach the server or the server stumbled — a phone waking up
 * before its connection is back, or a redeploy — so a moment's hiccup doesn't look like being signed out.
 * Answers the server meant (4xx) and timeouts (504, already long waits) come back at once.
 */
export async function retry<T>(load: () => Promise<T>, waits = [700, 2000, 4000]): Promise<T> {
  for (let i = 0; ; i++) {
    try {
      return await load();
    } catch (e) {
      const status = (e as { status?: number }).status;
      if (i >= waits.length || (status !== undefined && status !== 502 && status !== 503) || navigator.onLine === false) throw e;
      await new Promise((r) => setTimeout(r, waits[i]));
    }
  }
}
