// A countdown that lives for a while and then goes away by itself: its button sits next to the wheel
// (components/PageHead.tsx) and its page is #/countdown, both only until OFF. Times are the device's own.
import { useEffect, useState } from 'preact/hooks';

export const START = new Date(2026, 9, 17, 7, 0).getTime(); // 17 October, 07:00
export const END = new Date(2026, 9, 30, 7, 0).getTime(); // 30 October, 07:00
export const OFF = new Date(2026, 10, 1, 0, 0).getTime(); // 1 November: the button and the page are gone

/** Whether the countdown still shows anywhere. */
export const countdownOn = (now = Date.now()) => now < OFF;

/** How far along it is, 0 to 1. */
export const progress = (now: number) => Math.min(1, Math.max(0, (now - START) / (END - START)));

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
