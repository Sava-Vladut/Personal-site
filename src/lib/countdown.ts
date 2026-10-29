// The countdowns: as many as you like, each with a name and the two times it runs between, started, changed and removed on
// their page under Insights (views/Countdown.tsx). They're kept on the server (/api/countdown, server/status.js) so every device
// and the public status show the same ones, and remembered here for when the server can't be reached. The button for the one
// ending soonest sits next to the wheel (components/PageHead.tsx) while any is still running.
import { useEffect, useState } from 'preact/hooks';
import { observable } from './store';
import { noun, t } from './i18n';

export interface Countdown { id: string; name: string; start: number; end: number }
/** One to save: a new one has no id yet, and the server gives it one. */
type NewCountdown = Omit<Countdown, 'id'> & { id?: string };

const KEY = 'mm-countdowns';
/** The one there was before it could be changed (17 to 30 October, 07:00), until the server says otherwise. */
const FIRST: Countdown = { id: 'first', name: '', start: new Date(2026, 9, 17, 7, 0).getTime(), end: new Date(2026, 9, 30, 7, 0).getTime() };

function cached(): Countdown[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw !== null) return JSON.parse(raw);
    // from when there was only one
    const old = localStorage.getItem('mm-countdown');
    if (old !== null) {
      const one = JSON.parse(old);
      return one ? [{ id: 'first', ...one }] : [];
    }
  } catch {}
  return [FIRST];
}

const countdowns$ = observable<Countdown[]>(cached());
export const useCountdowns = countdowns$.use;
export const getCountdowns = countdowns$.get;

function keep(list: Countdown[]) {
  countdowns$.set(list);
  try {
    localStorage.setItem(KEY, JSON.stringify(list));
    localStorage.removeItem('mm-countdown');
  } catch {}
}

async function call(method: string, { countdown, id }: { countdown?: NewCountdown; id?: string } = {}) {
  let r: Response;
  try {
    r = await fetch('/api/countdown' + (id ? '?id=' + encodeURIComponent(id) : ''), {
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
  if (Array.isArray(out.countdowns)) keep(out.countdowns);
}

/** Asks the server for the countdowns. Quietly keeps the ones remembered here if it can't. */
export const loadCountdowns = () => call('GET').catch(() => {});
/** Starts a countdown, or changes one (matched by its id). */
export const saveCountdown = (c: NewCountdown) => call('PUT', { countdown: c });
/** Removes one: the public status stops showing it. */
export const removeCountdown = (id: string) => call('DELETE', { id });

/** Whether it's still counting down: the wheel's button and the public status only show it until it ends. */
export const isRunning = <T extends { end: number }>(c: T | null | undefined, now = Date.now()): c is T => !!c && now < c.end;

/** The ones still counting down, ending soonest first. */
export const running = <T extends { end: number }>(list: T[], now = Date.now()) => list.filter((c) => now < c.end).sort((a, b) => a.end - b.end);

/** Its name, or "Countdown". */
export const countdownName = (c: { name: string }) => c.name || t('Countdown');

/** How far along it is, 0 to 1. */
export const progress = (c: { start: number; end: number }, now: number) => Math.min(1, Math.max(0, (now - c.start) / (c.end - c.start)));

/** A span of time as days, hours, minutes and seconds. */
export function parts(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { d: Math.floor(s / 86400), h: Math.floor(s / 3600) % 24, m: Math.floor(s / 60) % 60, s: s % 60 };
}

export type Unit = 'd' | 'h' | 'm' | 's';
/** The biggest whole unit of a span that isn't zero: days, else hours, else minutes, else seconds (never "0 days"). */
export function biggest(ms: number): { n: number; unit: Unit } {
  const x = parts(ms);
  return x.d ? { n: x.d, unit: 'd' } : x.h ? { n: x.h, unit: 'h' } : x.m ? { n: x.m, unit: 'm' } : { n: x.s, unit: 's' };
}

/** The word for a unit, matching the number before it: "5 hours", "1 day". */
export const unitWord = (n: number, unit: Unit) =>
  unit === 'd' ? noun(n, 'day', 'days') : unit === 'h' ? noun(n, 'hour', 'hours') : unit === 'm' ? noun(n, 'minute', 'minutes') : noun(n, 'second', 'seconds');

/** A span as its biggest unit, counted: "13 days", "5 hours", "1 minute". */
export const biggestText = (ms: number) => {
  const { n, unit } = biggest(ms);
  return `${n} ${unitWord(n, unit)}`;
};

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
