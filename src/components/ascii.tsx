// Small pieces of the stats page drawn in letters, in the same letters as the skies (ramps.ts): a texture to fill
// bars with, numbers that scramble into place like the intro's brain, and meters written as a row of characters.
import { useLayoutEffect, useRef } from 'preact/hooks';
import { watchView } from '../lib/inView';
import { LOCALE } from '../lib/i18n';
import { RAMPS } from './ramps';

const still = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const hash = (n: number) => { const v = Math.sin(n * 12.9898 + 78.233) * 43758.5453; return v - Math.floor(v); };
const clamp01 = (v: number) => Math.min(1, Math.max(0, v));

/** The densest few letters of a world's ramp, one character each. */
export function dense(world: string | null | undefined, levels = 3) {
  const ramp = RAMPS[world ?? ''] ?? RAMPS.default;
  return ramp.slice(-levels).join('');
}

/** `n` letters of a world (or of a given set), mixed so neighbours differ: the same seed gives the same texture. */
export function texture(world: string | null | undefined, n: number, seed = 0, chars = dense(world)) {
  let out = '';
  for (let i = 0; i < n; i++) out += chars[Math.floor(hash(i * 7.13 + seed) * chars.length)];
  return out;
}

/** A box filled with letters: it wraps a long run of them and hides what doesn't fit. */
export const GlyphFill = ({ world, chars, seed = 0, n = 160 }: { world?: string | null; chars?: string; seed?: number; n?: number }) => (
  <span class="glyph-fill" aria-hidden="true">{texture(world, n, seed, chars)}</span>
);

const NOISE = '!<>-_/\\[]{}=+*^?#%&$';

/** A figure or a word that scrambles into place, left to right, the first time it comes into view. */
export function Scramble({ value }: { value: string | number }) {
  // whole numbers are written the local way ("1,234" or "1.234"); other figures come already formatted
  const text = typeof value === 'number' && Number.isInteger(value) ? value.toLocaleString(LOCALE) : String(value);
  const ref = useRef<HTMLSpanElement>(null);
  const shown = useRef(false);
  useLayoutEffect(() => {
    const el = ref.current!;
    el.textContent = text;
    if (shown.current || still() || typeof IntersectionObserver === 'undefined') return;
    let raf = 0;
    const stop = watchView(el, (on) => {
      if (!on || shown.current) return;
      shown.current = true;
      stop();
      const t0 = performance.now(), dur = 520 + text.length * 40;
      const tick = (now: number) => {
        const p = clamp01((now - t0) / dur);
        const fixed = Math.floor(p * p * (text.length + 1));
        let out = '';
        for (let i = 0; i < text.length; i++) {
          const ch = text[i];
          // digits stay digits so the width holds (tabular figures); letters become noise
          out += i < fixed || !/[\p{L}\p{N}]/u.test(ch) ? ch : /\d/.test(ch) ? String(Math.floor(Math.random() * 10)) : NOISE[Math.floor(Math.random() * NOISE.length)];
        }
        el.textContent = p < 1 ? out : text;
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    });
    return () => {
      stop();
      cancelAnimationFrame(raf);
      el.textContent = text;
    };
  }, [text]);
  // the text is written by the effect, so Preact never holds a stale text node here
  return <span ref={ref} class="scramble" />;
}

/**
 * A meter written in letters: `[####······]`, filled with a world's densest letters (the page's colour by default).
 * Give `marks` instead of `value` for a row that is lit here and there, like the days of a week.
 */
export function AsciiMeter({ value = 0, marks, cells = 14, world }: { value?: number; marks?: boolean[]; cells?: number; world?: string | null }) {
  const lit = marks ?? Array.from({ length: cells }, (_, i) => i < Math.round(clamp01(value) * cells));
  const tex = texture(world, lit.length, lit.length);
  return (
    <span class="ascii-meter" aria-hidden="true" style={world ? { '--c': `var(--emo-${world})` } : undefined}>
      <span class="am-edge">[</span>
      {lit.map((on, i) => (on ? <b style={{ '--k': i }}>{tex[i]}</b> : <i>·</i>))}
      <span class="am-edge">]</span>
    </span>
  );
}
