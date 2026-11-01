import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';

/**
 * Something that opens and closes in place instead of popping in: it unfolds from a line (its height easing, fading and
 * sliding down a few px) and folds back before it's taken out of the page, so what's below it moves smoothly too. It
 * comes up already open, without the opening motion, when `open` starts true. While it folds it keeps showing what
 * it held when it was open. The styles are in notes.css.
 */
export function Unfold({ open, children, class: cls }: { open: boolean; children: ComponentChildren; class?: string }) {
  // in: opening; still: open and at rest (its edges free to show a focus ring); out: closing, then gone
  const [phase, setPhase] = useState<'in' | 'still' | 'out' | null>(open ? 'still' : null);
  useEffect(() => {
    if (open) return void setPhase((p) => (p === 'still' ? p : 'in'));
    setPhase((p) => (p ? 'out' : p));
    const gone = setTimeout(() => setPhase(null), 260);
    return () => clearTimeout(gone);
  }, [open]);
  // what it held when it was open: folding away shows that, not whatever is passed once the thing it's for is gone
  const held = useRef(children);
  if (open) held.current = children;
  if (!phase) return null;
  return (
    <div
      class={`unfold is-${phase}${cls ? ` ${cls}` : ''}`}
      inert={phase === 'out'}
      onAnimationEnd={(e) => e.target === e.currentTarget && setPhase((p) => (p === 'in' ? 'still' : p))}
    >
      <div class="unfold-in">{held.current}</div>
    </div>
  );
}
