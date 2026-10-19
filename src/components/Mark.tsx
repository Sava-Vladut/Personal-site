import { useId } from 'preact/hooks';
import { LAW_MARKS, TRAP_MARKS } from '../data/marks';
import '../styles/mark.css';

/*
 * A mind trap's or a law's mark: its drawing (data/marks.ts) on a flat tile in its family's or arena's colour.
 * The lines are run through a little noise so they waver like brush ink; the noise is seeded from the id,
 * so a mark always wavers the same way.
 */

const ART: Record<string, string> = { ...TRAP_MARKS, ...LAW_MARKS };

const seedOf = (id: string) => {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h % 997;
};

export function Mark({ id, hue, size, class: cls }: { id: string; hue: string; size?: number; class?: string }) {
  const uid = 'mk' + useId().replace(/\W/g, '');
  return (
    <svg class={`mark${cls ? ' ' + cls : ''}`} width={size} height={size} viewBox="0 0 100 100" style={{ '--c': `var(--emo-${hue})` }} aria-hidden="true">
      <defs>
        <clipPath id={uid + 'c'}>
          <rect width="100" height="100" rx="22" />
        </clipPath>
        <filter id={uid + 'f'} filterUnits="userSpaceOnUse" x="-5" y="-5" width="110" height="110" color-interpolation-filters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves={2} seed={seedOf(id)} result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale="3.2" xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
      <rect class="mark-tile" width="100" height="100" rx="22" />
      <g clip-path={`url(#${uid}c)`}>
        <g filter={`url(#${uid}f)`} dangerouslySetInnerHTML={{ __html: ART[id] ?? '' }} />
      </g>
    </svg>
  );
}
