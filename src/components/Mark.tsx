import { useEffect, useId, useRef, useState } from 'preact/hooks';
import { LAW_MARKS, PRINCIPLE_MARKS, SPOT_MARKS, TRAP_MARKS } from '../data/marks';
import '../styles/mark.css';

/*
 * A mind trap's, a law's or a principle's mark (or a spot for another screen, `spot:<name>`): its drawing (data/marks.ts) on a flat tile in its family's or arena's colour.
 * The lines are run through a little noise so they waver like brush ink; the noise is seeded from the id,
 * so a mark always wavers the same way.
 *
 * The first time a mark is on screen it is made in front of you (styles/mark.css): the tile settles, the cut paper is
 * laid down piece by piece, the ink lines draw themselves on and the solid ink lands last. `still` skips that.
 */

const ART: Record<string, string> = { ...TRAP_MARKS, ...LAW_MARKS, ...PRINCIPLE_MARKS, ...SPOT_MARKS };

const seedOf = (id: string) => {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h % 997;
};

/* ---------- the drawing, sorted into layers for the arrival ---------- */

interface Drawn { html: string; np: number; nl: number; nb: number }
const drawn = new Map<string, Drawn>();

/**
 * Tags each shape of a drawing with its layer and its place in that layer, once per id: cut paper (`mk-pp`), ink lines
 * that draw on (`mk-ln`, measured as 1 long with pathLength so one dash can reveal any line), lines that are already
 * dashed or dotted and so fade in instead (`mk-dt`, counted with the lines), and solid ink (`mk-bl`).
 */
function draw(id: string): Drawn {
  let d = drawn.get(id);
  if (d) return d;
  let np = 0, nl = 0, nb = 0;
  const html = (ART[id] ?? '').replace(/<path ([^>]*?)\/>/g, (_, a: string) => {
    if (a.includes('fill="none"')) {
      return a.includes('stroke-dasharray')
        ? `<path class="mk-dt" style="--i:${nl++}" ${a}/>`
        : `<path class="mk-ln" pathLength="1" style="--i:${nl++}" ${a}/>`;
    }
    if (a.includes('fill="#faf9f5"')) return `<path class="mk-pp" style="--i:${np++}" ${a}/>`;
    return `<path class="mk-bl" style="--i:${nb++}" ${a}/>`;
  });
  d = { html, np: np || 1, nl: nl || 1, nb: nb || 1 };
  drawn.set(id, d);
  return d;
}

/* ---------- one shared watcher: tells each mark once when it is really on screen ---------- */

const motion = typeof window !== 'undefined' && typeof IntersectionObserver !== 'undefined' &&
  !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const waiting = new Map<Element, () => void>();
let io: IntersectionObserver | null = null;

function onSight(el: Element, fn: () => void) {
  io ??= new IntersectionObserver((list) => {
    for (const e of list) {
      if (!e.isIntersecting) continue;
      const go = waiting.get(e.target);
      if (!go) continue;
      waiting.delete(e.target);
      io!.unobserve(e.target);
      go();
    }
  }, { threshold: 0.35 });
  waiting.set(el, fn);
  io.observe(el);
  return () => {
    if (waiting.delete(el)) io?.unobserve(el);
  };
}

export function Mark({ id, hue, size, class: cls, still }: { id: string; hue: string; size?: number; class?: string; still?: boolean }) {
  const uid = 'mk' + useId().replace(/\W/g, '');
  const ref = useRef<SVGSVGElement>(null);
  // starts in its "not yet drawn" state from the first paint, so the finished art never flashes before it's made
  const anim = motion && !still;
  const [go, setGo] = useState(false);
  useEffect(() => {
    if (!anim || go || !ref.current) return;
    return onSight(ref.current, () => setGo(true));
  }, [anim]);
  const seed = seedOf(id);
  const art = draw(id);
  return (
    <svg
      ref={ref}
      class={`mark${anim ? ' mk-a' : ''}${go ? ' mk-go' : ''}${cls ? ' ' + cls : ''}`}
      width={size}
      height={size}
      viewBox="0 0 100 100"
      style={{
        '--c': `var(--emo-${hue})`,
        // drawing units per screen pixel, so the hover lift is about a pixel at any size
        '--u': size ? +(100 / size).toFixed(2) : 1.5,
        '--sd': `${seed % 121}ms`,
        '--np': art.np,
        '--nl': art.nl,
        '--nb': art.nb,
      }}
      aria-hidden="true"
    >
      <defs>
        <clipPath id={uid + 'c'}>
          <rect width="100" height="100" rx="22" />
        </clipPath>
        <filter id={uid + 'f'} filterUnits="userSpaceOnUse" x="-5" y="-5" width="110" height="110" color-interpolation-filters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves={2} seed={seed} result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="3.2" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
      <rect class="mark-tile" width="100" height="100" rx="22" />
      <g clip-path={`url(#${uid}c)`}>
        <g class="mark-art" filter={`url(#${uid}f)`} dangerouslySetInnerHTML={{ __html: art.html }} />
      </g>
    </svg>
  );
}
