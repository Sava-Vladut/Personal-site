import { useEffect, useRef } from 'preact/hooks';
import { watchView } from '../lib/inView';
import { RAMPS } from './ramps';

const COLS = 18, STEP = 90; // a tiny grid, redrawn ~11 times a second
const still = matchMedia('(prefers-reduced-motion: reduce)');

/** What a day's leading feeling does to its cloud: sadness rains, anger storms, joy shines, the rest just drifts. */
type Weather = 'rain' | 'storm' | 'sun' | 'drift';
const WEATHER: Record<string, Weather> = { sadness: 'rain', anger: 'storm', joy: 'sun' };
const ROWS: Record<Weather, number> = { rain: 5, storm: 5, sun: 5, drift: 3 };
const BODY: Partial<Record<Weather, string[]>> = { rain: [' ', '.', ':', '~', '=', '≈'], storm: [' ', '.', ':', '+', '%', '#', '@'] };
const SEAT = 1.4; // a cell is taller than it is wide

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const hash = (n: number) => { const v = Math.sin(n * 12.9898) * 43758.5453; return v - Math.floor(v); };

/**
 * A little sky in its world's letters, beside a day's mood line. A day that leaned toward sadness rains, anger
 * brings thunder (the mood line flashes with each strike), joy shines; anything else is a cloud drifting by.
 * Tap it for more of the same: a downpour, a strike, a burst of sun.
 */
export function AsciiCloud({ world, seed = 0 }: { world: string; seed?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const weather = WEATHER[world] ?? 'drift';
    const rows = ROWS[weather];
    const label = el.closest<HTMLElement>('.day-label');
    if (label) label.dataset.weather = weather;
    const ramp = RAMPS[world] ?? RAMPS.default;
    const body = BODY[weather] ?? ramp;
    const calm = weather === 'drift' ? 1 : 0.25; // rain and storm clouds hang about, the others wander
    const puffs = [0, 1, 2].map((i) => ({ x: (seed * 7 + i * 5.3) % COLS, r: 1.8 + i * 0.5, speed: (0.6 + i * 0.25) * calm, phase: seed + i * 2.1 }));
    const cloudY = weather === 'drift' ? 1.7 : 1;

    /** How solid the cloud is at a cell, 0 to about 1. */
    const cloud = (x: number, y: number, s: number) => {
      let d = 0;
      for (const p of puffs) {
        const px = ((p.x + s * p.speed) % (COLS + 8)) - 4;
        const r = p.r * (1 + 0.18 * Math.sin(s * 0.9 + p.phase));
        const dx = (x - px) / r, dy = (y - cloudY + 0.25 * Math.sin(s * 0.7 + p.phase)) / (r * 0.5);
        d += Math.exp(-(dx * dx + dy * dy));
      }
      const edge = Math.min(1, x / 3, (COLS - 1 - x) / 3); // thin to dust at the ends
      return d * 0.8 * edge * (weather === 'storm' ? 1.25 : 1);
    };

    let kick = -9, rot = 0, nextStrike = 1.2 + hash(seed) * 3, strikeAt = -9, bolt: string[] = [];
    const strike = (s: number) => {
      bolt = new Array(COLS * rows).fill('');
      let x = 4 + Math.floor(Math.random() * (COLS - 8));
      for (let y = 2; y < rows; y++) {
        const dx = Math.floor(Math.random() * 3) - 1;
        bolt[y * COLS + x] = dx < 0 ? '/' : dx > 0 ? '\\' : '|';
        x = Math.min(COLS - 2, Math.max(1, x + dx));
      }
      strikeAt = s;
      nextStrike = s + 2.5 + Math.random() * 3.5;
    };

    const draw = (s: number) => {
      const k = clamp01(1 - (s - kick) / (weather === 'rain' ? 3.5 : 1.6)); // how much a tap is still felt
      const u = s - strikeAt;
      const lit = weather === 'storm' && u >= 0 && u < 0.3 && (u < 0.09 || u > 0.15); // two quick flickers
      if (label) label.toggleAttribute('data-flash', lit);
      let out = '';
      for (let y = 0; y < rows; y++) {
        for (let x = 0; x < COLS; x++) {
          let ch = ' ';
          if (weather === 'sun') {
            const dx = x - (COLS - 1) / 2, dy = (y - (rows - 1) / 2) * SEAT;
            const d = Math.hypot(dx, dy), r = 2 * (1 + 0.05 * Math.sin(s * 1.7) + 0.12 * k);
            if (d < r) ch = ramp[ramp.length - 1 - (d < r * 0.55 ? 0 : 1)];
            else {
              const reach = 2.6 + 1.6 * k;
              const beam = Math.max(0, Math.cos(Math.atan2(dy, dx) * 8 - rot)) ** 4 * (1 - (d - r) / reach);
              if (beam > 0.08) ch = ramp[Math.min(4, 1 + Math.floor(beam * 5))];
            }
          } else {
            const level = Math.min(body.length - 1, Math.floor(cloud(x, y, s) * (body.length - 0.5)) + (lit ? 1 : 0));
            const chars = body[Math.max(0, level)];
            ch = chars[(x * 7 + y * 13 + Math.floor(s * 2)) % chars.length];
            if (weather === 'rain' && y >= 2) {
              // a drop in this column falls from under the cloud, more of them in a downpour
              const h = hash(x + seed * 0.37);
              if ((h < 0.5 + 0.5 * k) && cloud(x, 1, s) > 0.3) {
                const at = Math.floor((s * (5 + 5 * hash(x * 3.1)) + h * 20) % 7) - 1;
                ch = y === at ? '|' : y === at - 1 ? "'" : ' ';
              } else ch = ' ';
            }
            if (lit && bolt[y * COLS + x]) ch = bolt[y * COLS + x];
          }
          out += ch;
        }
        if (y < rows - 1) out += '\n';
      }
      el.textContent = out;
    };

    let timer = 0, s = 0;
    const tick = () => {
      s += STEP / 1000;
      if (weather === 'sun') rot += (STEP / 1000) * (0.7 + 5 * clamp01(1 - (s - kick) / 1.6));
      if (weather === 'storm' && s > nextStrike) strike(s);
      draw(s);
    };
    const tap = () => {
      if (still.matches) return;
      kick = s;
      if (weather === 'storm') strike(s);
    };
    draw(0);
    el.addEventListener('click', tap);
    const stop = watchView(el, (on) => {
      clearInterval(timer);
      timer = on && !still.matches ? window.setInterval(tick, STEP) : 0;
    });
    return () => {
      stop();
      clearInterval(timer);
      el.removeEventListener('click', tap);
      if (label) { delete label.dataset.weather; label.removeAttribute('data-flash'); }
    };
  }, [world, seed]);
  return <span ref={ref} class="ascii-cloud" aria-hidden="true" />;
}
