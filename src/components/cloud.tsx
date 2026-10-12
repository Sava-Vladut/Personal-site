import { coreOf } from '../data/emotions';
import { useEffect, useRef } from 'preact/hooks';
import { skyWorlds } from '../lib/stats';
import { watchView } from '../lib/inView';
import { RAMPS } from './Sky';

/** A title that rises out of the clouds a letter at a time. */
export function CloudTitle({ text }: { text: string }) {
  return (
    <h1 class="title cloud-title" aria-label={text}>
      {[...text].map((ch, i) => (
        <span aria-hidden="true" style={{ '--i': i }}>{ch === ' ' ? ' ' : ch}</span>
      ))}
    </h1>
  );
}

/** A sky's colours, from how the things on a page make you feel (their main feeling each); `quiet` when nothing's felt yet. */
export function feltWorlds(list: { emotions: string[] }[], quiet: string[]) {
  const counts = new Map<string, number>();
  for (const x of list) {
    const core = x.emotions[0] && coreOf(x.emotions[0])?.id;
    if (core) counts.set(core, (counts.get(core) ?? 0) + 1);
  }
  const worlds = skyWorlds([...counts].map(([id, count]) => ({ id, count })));
  return worlds.length ? worlds : quiet;
}

const COLS = 16, ROWS = 3, STEP = 140; // a tiny grid, redrawn ~7 times a second
const still = matchMedia('(prefers-reduced-motion: reduce)');

/** A little cloud drawn in its world's letters, like the sky's, drifting and breathing beside a day's mood line. */
export function AsciiCloud({ world, seed = 0 }: { world: string; seed?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ramp = RAMPS[world] ?? RAMPS.default;
    const puffs = [0, 1, 2].map((i) => ({ x: (seed * 7 + i * 5.3) % COLS, r: 1.8 + i * 0.5, speed: 0.6 + i * 0.25, phase: seed + i * 2.1 }));
    const draw = (s: number) => {
      let out = '';
      for (let y = 0; y < ROWS; y++) {
        for (let x = 0; x < COLS; x++) {
          let d = 0;
          for (const p of puffs) {
            const px = ((p.x + s * p.speed) % (COLS + 8)) - 4;
            const r = p.r * (1 + 0.18 * Math.sin(s * 0.9 + p.phase));
            const dx = (x - px) / r, dy = (y - 1.7 + 0.25 * Math.sin(s * 0.7 + p.phase)) / (r * 0.5);
            d += Math.exp(-(dx * dx + dy * dy));
          }
          const edge = Math.min(1, x / 3, (COLS - 1 - x) / 3); // thin to dust at the ends
          const level = Math.min(ramp.length - 1, Math.floor(d * 0.8 * edge * (ramp.length - 0.5)));
          const chars = ramp[level];
          out += chars[(x * 7 + y * 13 + Math.floor(s * 2)) % chars.length];
        }
        if (y < ROWS - 1) out += '\n';
      }
      el.textContent = out;
    };
    let timer = 0, s = 0;
    const tick = () => { s += STEP / 1000; draw(s); };
    draw(0);
    const stop = watchView(el, (on) => {
      clearInterval(timer);
      timer = on && !still.matches ? window.setInterval(tick, STEP) : 0;
    });
    return () => { stop(); clearInterval(timer); };
  }, [world, seed]);
  return <span ref={ref} class="ascii-cloud" aria-hidden="true" />;
}
