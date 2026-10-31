import { useEffect, useId, useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { RefObject } from 'preact';
import { onCovered, pageCovered } from '../lib/covered';

/** At most this many threads, so a journal full of highlights stays calm. */
const MAX = 6;
/** Threads keep this far apart where the margin has room, so their waves never touch; a narrow margin draws them closer. */
const GAP = 10;
/** The short bend that carries a thread from the margin into its note's edge. */
const BEND = 30;
/** One wave's length; it rises by one every few seconds, a little slower for each thread further out. */
const WAVE = 96;
/** How long they wave on their own as the journal appears, before resting. */
const WAVE_FOR_MS = 24000;
/** A thread is at full strength within NEAR px of its note, fading to MIN (of that) by FAR px away. */
const NEAR = 140, FAR = 1000, MIN = 0.3;

type Line = { x: number; left: number; y: number; top: number; into: boolean; open: boolean; amp: number; h1: string; h2: string };
/** A highlighted note's colours (views/Journal.tsx highlightOf). */
export type Hue = { '--h1': string; '--h2': string };

/**
 * A thread from each highlighted note (views/Journal.tsx) up the page's margin to the top: into the sky panel when it
 * reaches over the margin (a phone), or fading out at the top of the feed when it sits beside it. The threads are
 * measured from the page, again whenever the page changes size (a day drawn, a picture loaded), and drawn behind
 * everything else (app.css .threads). `changes` is anything that moves the highlighted notes around.
 *
 * Each thread is one line, its wave calming to straight just above the bend into its note, so the two always meet. The
 * topmost note's thread runs nearest the notes and each one below it further out, so no thread crosses another's bend.
 *
 * A note that isn't drawn yet still has its thread, so they're all there when the journal opens: one in a day further
 * down than the feed has drawn (`waiting`) rises from the end of the feed, and one in a day that skips drawing while
 * it's off screen (app.css, content-visibility) is placed by its day, until the day is drawn again.
 */
export function Threads({ page, changes, waiting }: { page: RefObject<HTMLElement>; changes: string; waiting: Hue[] }) {
  const [lines, setLines] = useState<Line[]>([]);
  const later = useRef(waiting);
  later.current = waiting;
  const svg = useRef<SVGSVGElement>(null);
  const id = useId();
  // how long they've waved so far, so measuring again doesn't start the waves over
  const clock = useRef(0);

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
      const cards = [...el.querySelectorAll<HTMLElement>('.note.highlighted, .note-row.highlighted')];
      const end = el.querySelector('.feed-more');
      const anchors = [
        ...cards.map((card) => ({ at: spotOf(card), hue: { '--h1': card.style.getPropertyValue('--h1'), '--h2': card.style.getPropertyValue('--h2') }, open: false })),
        ...(end ? later.current.map((hue) => ({ at: end.getBoundingClientRect(), hue, open: true })) : []),
      ].slice(0, MAX);
      const n = anchors.length;
      const next = anchors.flatMap(({ at: r, hue, open }, i): Line[] => {
        if (!r.width) return [];
        const left = r.left - p.left;
        // from just past the middle of the margin out towards the screen's edge, as far apart as there's room for
        const inner = Math.min(left - 6, left / 2 + 3);
        const gap = n > 1 ? Math.min(GAP, Math.max(0, inner - (4 - p.left)) / (n - 1)) : GAP;
        const x = inner - i * gap;
        const amp = Math.min(3, Math.max(0.5, gap / 2 - 0.8));
        // under the panel's rounded corner, so the thread seems to go into it
        const into = !!panel && panel.left - p.left <= x && panel.bottom <= r.top;
        const top = into ? panel!.bottom - p.top - radius - 4 : 0;
        const y = r.top - p.top + (open ? 0 : Math.min(26, r.height / 2));
        if (y - top < 60) return [];
        const h1 = hue['--h1'] || 'var(--emo-hope-interest)';
        return [{ x, left, y, top, into, open, amp, h1, h2: hue['--h2'] || h1 }];
      });
      const key = JSON.stringify(next);
      if (key !== last) setLines(next);
      last = key;
    };
    const soon = () => { if (!frame) frame = requestAnimationFrame(measure); };
    measure();
    const ro = new ResizeObserver(soon);
    ro.observe(el);
    // a day starting or stopping drawing as it comes near the screen or leaves it (it doesn't bubble, so catch it)
    el.addEventListener('contentvisibilityautostatechange', soon, true);
    return () => {
      ro.disconnect();
      el.removeEventListener('contentvisibilityautostatechange', soon, true);
      cancelAnimationFrame(frame);
    };
  }, [changes]);

  // The waves rise for a while as the journal appears, then rest, and rise again while a highlighted note is pointed at
  // or focused (design.md: quiet by default). ~30 frames a second; still with reduced motion, and holding
  // still under a sheet or the wheel and while a page change slides (lib/covered.ts).
  useEffect(() => {
    const el = page.current;
    const paths = [...(svg.current?.querySelectorAll<SVGPathElement>('.thread-line') ?? [])];
    if (!el || !paths.length) return;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const pointed = () => !!el.querySelector(':is(.note, .note-row).highlighted:is(:hover, :focus-visible)');
    const waving = () => !reduced.matches && !document.hidden && !pageCovered() && (clock.current < WAVE_FOR_MS || pointed());
    let raf = 0, last = 0;
    const frame = (stamp: number) => {
      raf = 0;
      if (last && stamp - last < 30) return schedule();
      clock.current += last ? Math.min(100, stamp - last) : 16;
      last = stamp;
      lines.forEach((l, i) => paths[i].setAttribute('d', pathOf(l, i, clock.current / 1000)));
      schedule();
    };
    const schedule = () => {
      if (raf) return;
      if (waving()) raf = requestAnimationFrame(frame);
      else last = 0;
    };
    const unCover = onCovered(schedule);
    el.addEventListener('pointerover', schedule);
    el.addEventListener('focusin', schedule);
    document.addEventListener('visibilitychange', schedule);
    reduced.addEventListener('change', schedule);
    schedule();
    return () => {
      cancelAnimationFrame(raf);
      unCover();
      el.removeEventListener('pointerover', schedule);
      el.removeEventListener('focusin', schedule);
      document.removeEventListener('visibilitychange', schedule);
      reduced.removeEventListener('change', schedule);
    };
  }, [lines]);

  if (!lines.length) return null;
  const s = clock.current / 1000;
  return (
    <svg ref={svg} class="threads" aria-hidden="true">
      {lines.map((l, i) => {
        const len = l.y - l.top;
        const fadeTop = l.into ? 0 : 60 / len;
        const stops = stopsOf(l, fadeTop);
        return (
          <g class="thread">
            <linearGradient id={`${id}-${i}`} gradientUnits="userSpaceOnUse" x1="0" y1={l.top} x2="0" y2={l.y}>
              {stops.map(([at, color, alpha]) => <stop offset={at} style={{ stopColor: color, stopOpacity: alpha }} />)}
            </linearGradient>
            <path class="thread-line" stroke={`url(#${id}-${i})`} d={pathOf(l, i, s)} />
          </g>
        );
      })}
    </svg>
  );
}

/**
 * A thread's gradient, as [offset, colour, opacity] from the top down: --h1 at the note fading to --h2 above (70% of the
 * way up), strongest near its note and fainter the further up it runs (never below MIN), fading out at the top of the
 * feed, and from below for a note the feed hasn't drawn yet.
 */
function stopsOf(l: Line, fadeTop: number): [number, string, number][] {
  const len = l.y - l.top;
  const blend = Math.max(fadeTop, 0.3);
  const end = l.open ? Math.max(0.3, 1 - 140 / len) : 1;
  const at = new Set([0, fadeTop, blend, end, 1]);
  for (let j = 0; j <= 6; j++) {
    const d = NEAR + (j * (FAR - NEAR)) / 6;
    if (d < len) at.add(1 - d / len);
  }
  return [...at].sort((a, b) => a - b).map((o) => {
    const d = (1 - o) * len;
    const k = Math.min(1, Math.max(0, (d - NEAR) / (FAR - NEAR)));
    let alpha = 1 - (1 - MIN) * k * k * (3 - 2 * k);
    if (!l.into && o < fadeTop) alpha *= o / fadeTop;
    if (l.open && o > end) alpha *= (1 - o) / (1 - end);
    const p = o <= blend ? 0 : o >= end ? 1 : (o - blend) / (end - blend);
    const color = p === 0 ? l.h2 : p === 1 ? l.h1 : `color-mix(in oklab, ${l.h1} ${Math.round(p * 100)}%, ${l.h2})`;
    return [o, color, alpha];
  });
}

/**
 * A thread's line at `s` seconds: down the margin with its wave rising and the whole thread swaying, calming to
 * straight over the last 48px above the bend so it always meets it, then the bend into the note's edge.
 */
function pathOf(l: Line, i: number, s: number) {
  const end = l.open ? l.y : l.y - BEND;
  const rise = (s / (6 + i * 0.7)) * WAVE;
  const sway = l.amp && Math.sin((s / (9 + i * 1.3)) * Math.PI - i * 2.1) * (l.amp / 2);
  let d = '';
  for (let y = l.top; ; y = Math.min(end, y + 8)) {
    const u = l.open ? 1 : Math.min(1, (end - y) / 48);
    const dx = (Math.sin(((y + rise) / WAVE) * 2 * Math.PI) * l.amp + sway) * u * u * (3 - 2 * u);
    d += `${d ? 'L' : 'M'}${(l.x + dx).toFixed(1)} ${y.toFixed(1)}`;
    if (y >= end) break;
  }
  return l.open ? d : `${d}C${l.x} ${end + BEND * 0.6} ${l.x + 2} ${l.y} ${l.left + 4} ${l.y}`;
}

/**
 * Where a highlighted note is on the page. A note in a day that skips drawing while off screen can't be measured
 * (Safari gives it no size), so it's placed at the top of its day's list instead, as it will be when drawn.
 */
function spotOf(card: HTMLElement) {
  if (card.checkVisibility?.({ contentVisibilityAuto: true }) !== false) return card.getBoundingClientRect();
  const list = card.closest<HTMLElement>('.entries');
  if (!list) return card.getBoundingClientRect();
  const r = list.getBoundingClientRect();
  const pad = getComputedStyle(list);
  return new DOMRect(r.left + parseFloat(pad.paddingLeft), r.top + parseFloat(pad.paddingTop), r.width, 52);
}
