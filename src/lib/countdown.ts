// The countdown: one at a time, with a name and the two times it runs between, set and changed on its page under Insights
// (views/Countdown.tsx). It's kept on the server (/api/countdown, server/status.js) so every device and the public status show the same
// one, and remembered here for when the server can't be reached. Its button sits next to the wheel (components/PageHead.tsx) until it ends.
import { useEffect, useState } from 'preact/hooks';
import { observable } from './store';
import { t } from './i18n';

export interface Countdown { name: string; start: number; end: number }

const KEY = 'mm-countdown';
/** The one there was before it could be changed (17 to 30 October, 07:00), until the server says otherwise. */
const FIRST: Countdown = { name: '', start: new Date(2026, 9, 17, 7, 0).getTime(), end: new Date(2026, 9, 30, 7, 0).getTime() };

function cached(): Countdown | null {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw !== null) return JSON.parse(raw);
  } catch {}
  return FIRST;
}

const countdown$ = observable<Countdown | null>(cached());
export const useCountdown = countdown$.use;
export const getCountdown = countdown$.get;

function keep(c: Countdown | null) {
  countdown$.set(c);
  try {
    localStorage.setItem(KEY, JSON.stringify(c));
  } catch {}
}

async function call(method: string, countdown?: Countdown) {
  let r: Response;
  try {
    r = await fetch('/api/countdown', {
      method,
      cache: 'no-store',
      signal: AbortSignal.timeout(15_000), // a stalled connection fails instead of spinning
      headers: countdown ? { 'Content-Type': 'application/json' } : undefined,
      body: countdown ? JSON.stringify({ countdown }) : undefined,
    });
  } catch {
    throw new Error(t('Couldn’t reach the server. Check your connection.'));
  }
  const out = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(out.error || t('Something went wrong on the server.'));
  keep(out.countdown ?? null);
}

/** Asks the server for the countdown. Quietly keeps the one remembered here if it can't. */
export const loadCountdown = () => call('GET').catch(() => {});
/** Sets the countdown, or changes it. */
export const saveCountdown = (c: Countdown) => call('PUT', c);
/** Removes it: its button goes, and the public status stops showing it. */
export const removeCountdown = () => call('DELETE');

/** Whether it's still counting down: its button and the public status only show it until it ends. */
export const isRunning = (c: Countdown | null, now = Date.now()): c is Countdown => !!c && now < c.end;

/** Its name, or "Countdown". */
export const countdownName = (c: Countdown) => c.name || t('Countdown');

/** How far along it is, 0 to 1. */
export const progress = (c: Countdown, now: number) => Math.min(1, Math.max(0, (now - c.start) / (c.end - c.start)));

/** A span of time as days, hours, minutes and seconds. */
export function parts(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { d: Math.floor(s / 86400), h: Math.floor(s / 3600) % 24, m: Math.floor(s / 60) % 60, s: s % 60 };
}

/** The time now, refreshed every `every` ms while the tab is visible (and at once when it comes back). */
export function useNow(every = 1000) {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    let timer = 0;
    const tick = () => {
      setNow(Date.now());
      // lands on the next whole step, so the seconds change together with the clock
      timer = setTimeout(tick, every - (Date.now() % every) + 5) as unknown as number;
    };
    const wake = () => {
      clearTimeout(timer);
      if (document.visibilityState === 'visible') tick();
    };
    tick();
    document.addEventListener('visibilitychange', wake);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', wake);
    };
  }, [every]);
  return now;
}
