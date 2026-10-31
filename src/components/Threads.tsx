import { useLayoutEffect, useState } from 'preact/hooks';
import type { RefObject } from 'preact';

/** At most this many threads, so a journal full of highlights stays calm. */
const MAX = 6;
/** Each thread keeps a little apart from the others in the margin. */
const SPREAD = [0, -3, 3, -5, 5, -1];

type Line = { x: number; left: number; y: number; top: number; into: boolean; h1: string; h2: string };

/**
 * A thread from each highlighted note (views/Journal.tsx) up the page's margin to the top: into the sky panel when it
 * reaches over the margin (a phone), or fading out at the top of the feed when it sits beside it. The threads are
 * measured from the page, again whenever the page changes size (a day drawn, a picture loaded), and drawn behind
 * everything else (app.css .threads). `changes` is anything that moves the highlighted notes around.
 */
export function Threads({ page, changes }: { page: RefObject<HTMLElement>; changes: string }) {
  const [lines, setLines] = useState<Line[]>([]);

  useLayoutEffect(() => {
    const el = page.current;
    if (!el) return;
    let frame = 0;
    let last = '';
    const measure = () => {
      frame = 0;
      const p = el.getBoundingClientRect();
      const panel = el.querySelector<HTMLElement>('.journal-top')?.getBoundingClientRect();
      const radius = parseFloat(getComputedStyle(el.querySelector('.journal-top') ?? el).borderBottomLeftRadius) || 0;
      const cards = [...el.querySelectorAll<HTMLElement>('.note.highlighted, .note-row.highlighted')].slice(0, MAX);
      const next = cards.flatMap((card, i): Line[] => {
        const r = card.getBoundingClientRect();
        const left = r.left - p.left;
        const x = Math.max(4, left / 2 + SPREAD[i]);
        // under the panel's rounded corner, so the thread seems to go into it
        const into = !!panel && panel.left - p.left <= x && panel.bottom <= r.top;
        const top = into ? panel!.bottom - p.top - radius - 4 : 0;
        const y = r.top - p.top + Math.min(26, r.height / 2);
        if (y - top < 60) return [];
        const h1 = card.style.getPropertyValue('--h1') || 'var(--emo-hope-interest)';
        return [{ x, left, y, top, into, h1, h2: card.style.getPropertyValue('--h2') || h1 }];
      });
      const key = JSON.stringify(next);
      if (key !== last) setLines(next);
      last = key;
    };
    const soon = () => { if (!frame) frame = requestAnimationFrame(measure); };
    measure();
    const ro = new ResizeObserver(soon);
    ro.observe(el);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [changes]);

  if (!lines.length) return null;
  return (
    <div class="threads" aria-hidden="true">
      {lines.map((l, i) => {
        // the column rises to just above the note, then a short bend carries it into the note's edge
        const bend = 30;
        return (
          <div class="thread-wrap" style={{ '--h1': l.h1, '--h2': l.h2, '--i': i }}>
            <div class={`thread${l.into ? ' into' : ''}`} style={{ left: l.x - 6, top: l.top, height: l.y - bend + 8 - l.top }}><i /></div>
            <svg class="thread-bend" style={{ left: l.x - 6, top: l.y - bend }} width={l.left - l.x + 10} height={bend + 2}>
              <path d={`M6 0C6 ${bend * 0.6} 8 ${bend} ${l.left - l.x + 10} ${bend}`} />
            </svg>
          </div>
        );
      })}
    </div>
  );
}
