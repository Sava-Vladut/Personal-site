import { useEffect, useState } from 'preact/hooks';
import { hashOf } from '../lib/colors';

const FRAMES = '⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏';
const still = matchMedia('(prefers-reduced-motion: reduce)').matches;

/** A terminal's spinner, in braille: for the moments a page waits on GitHub. */
export function Spin() {
  const [n, setN] = useState(0);
  useEffect(() => {
    if (still) return;
    const id = setInterval(() => setN((x) => (x + 1) % FRAMES.length), 80);
    return () => clearInterval(id);
  }, []);
  return <span class="spin" aria-hidden="true">{still ? '…' : FRAMES[n]}</span>;
}

/** A language's dot: its own colour, from its name. */
export const languageColor = (name: string) => `hsl(${hashOf(name) % 360} 58% 56%)`;
