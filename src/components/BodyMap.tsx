import type { Muscle } from '../lib/fitness';
import { t } from '../lib/i18n';
import { BODY, ICON, MAP, SHAPE, type Side } from '../data/bodymap';
import { tipProps } from './charts';
import { MUSCLE_NAME } from './fitness';
import '../styles/bodymap.css';

/*
 * The body map: a figure seen from the front and the back (data/bodymap.ts), each muscle shaded by how much it was
 * worked. Heat runs from 0 (a quiet grey shape) to 1 (the page's accent) in four steps, so a little work and a lot read
 * apart at a glance in both themes. The shaded muscles fade in once, when the map arrives (styles/bodymap.css).
 */

// The part of the 100 × 200 box the figure stands in, with a hair of room for its outline.
const VIEW = { x: 15, y: 3, w: 70, h: 195 };
const VIEWBOX = `${VIEW.x} ${VIEW.y} ${VIEW.w} ${VIEW.h}`;

/** Heat as one of five steps: 0 nothing, then 1–4 up to the full accent. Any work at all shows. */
const step = (h: number | undefined) => (h && h > 0 ? Math.min(4, Math.ceil(h * 4)) : 0);

const tip = (m: Muscle) => () => <div class="tip-row"><b>{MUSCLE_NAME[m]}</b></div>;

/**
 * A body seen from the front and the back, each muscle shaded by how much it was worked (`heat`, 0 to 1), the rest a
 * quiet outline. `side` shows one side or both; `onPick` makes the muscles tappable (a filter), `picked` rings one.
 */
export function BodyMap({ heat = {}, side = 'both', picked = null, onPick, size = 240, label }: {
  heat?: Partial<Record<Muscle, number>>; side?: 'front' | 'back' | 'both'; picked?: Muscle | null; onPick?: (m: Muscle) => void;
  size?: number; label?: string;
}) {
  const sides: Side[] = side === 'both' ? ['front', 'back'] : [side];
  const both = sides.length > 1;
  return (
    <div class={`bm${onPick ? ' bm-pick' : ''}`} role={onPick ? 'group' : 'img'} aria-label={label ?? t('Muscles')}>
      {sides.map((s) => {
        const caption = s === 'front' ? t('Front view') : t('Back view');
        const ring = picked && SHAPE[s][picked];
        return (
          <div class="bm-side" key={s} role={onPick && both ? 'group' : undefined} aria-label={onPick && both ? caption : undefined}>
            <svg class="bm-fig" viewBox={VIEWBOX} width={Math.round((size * VIEW.w) / VIEW.h)} height={size} aria-hidden={onPick ? undefined : 'true'}>
              <path class="bm-body" d={BODY} />
              {MAP[s].map(([m, d]) => {
                const cls = `bm-m bm-h${step(heat[m])}`;
                if (!onPick) return <path key={m} class={cls} d={d} />;
                const pick = () => onPick(m);
                const tp = tipProps(tip(m), MUSCLE_NAME[m]);
                return (
                  <g
                    key={m}
                    class={cls}
                    {...tp}
                    role="button"
                    aria-pressed={picked === m ? 'true' : 'false'}
                    onClick={pick}
                    onKeyDown={(e: KeyboardEvent) => {
                      if (e.key !== 'Enter' && e.key !== ' ') return;
                      e.preventDefault();
                      pick();
                    }}
                  >
                    <path d={d} />
                  </g>
                );
              })}
              {/* drawn last, so the neighbours' gaps never cut into it */}
              {ring && <path class="bm-ring" d={ring} />}
            </svg>
            {both && <span class="bm-cap" aria-hidden="true">{caption}</span>}
          </div>
        );
      })}
    </div>
  );
}

// Each icon's crop of the drawing, worked out once.
const ICON_VIEW = Object.fromEntries(
  Object.entries(ICON).map(([m, [s, x, y, w]]) => [m, [s, `${x - w / 2} ${y - w / 2} ${w} ${w}`]]),
) as Record<Muscle, [Side, string]>;

/**
 * One muscle as a small icon, for chips and rows: the body around it as a faint outline and the muscle filled in, in the
 * text's colour. Strokes stay a pixel wide at any size, so it holds up at 16px.
 */
export function MuscleIcon({ muscle, size = 20 }: { muscle: Muscle; size?: number }) {
  const [side, view] = ICON_VIEW[muscle];
  return (
    <svg class="bm-icon" width={size} height={size} viewBox={view} aria-hidden="true">
      <path class="bm-icon-body" d={BODY} />
      <path class="bm-icon-m" d={SHAPE[side][muscle]} />
    </svg>
  );
}
