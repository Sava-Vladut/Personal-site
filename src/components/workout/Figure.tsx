// An exercise's silhouette (lib/poses.ts): a figure in the pose of its move, in the text colour, the far arm and leg and
// what's around it fainter. Drawn once per exercise and kept.
import { figureOf, type Shape } from '../../lib/poses';
import type { Snap } from '../../lib/fitness';

type Drawn = Pick<Snap, 'id' | 'name' | 'cat' | 'kind' | 'muscles' | 'force' | 'equip'>;

const cache = new Map<string, Shape[]>();
const shapesOf = (m: Drawn) => {
  const key = `${m.id}|${m.name}|${m.equip}`;
  let s = cache.get(key);
  if (!s) cache.set(key, (s = figureOf(m)));
  return s;
};

export function Figure({ move, size, class: cls }: { move: Drawn; size?: number; class?: string }) {
  return (
    <svg class={`figure${cls ? ` ${cls}` : ''}`} viewBox="0 0 64 64" width={size} height={size} aria-hidden="true" focusable="false">
      {shapesOf(move).map((s, i) => s.t === 'line'
        ? <line key={i} x1={s.x1} y1={s.y1} x2={s.x2} y2={s.y2} stroke="currentColor" stroke-width={s.w} stroke-linecap="round" stroke-opacity={s.o} />
        : s.t === 'circle'
          ? s.ring
            ? <circle key={i} cx={s.cx} cy={s.cy} r={s.r - s.ring / 2} fill="none" stroke="currentColor" stroke-width={s.ring} stroke-opacity={s.o} />
            : <circle key={i} cx={s.cx} cy={s.cy} r={s.r} fill="currentColor" fill-opacity={s.o} />
          : <rect key={i} x={s.x} y={s.y} width={s.w} height={s.h} rx={1} fill="currentColor" fill-opacity={s.o} />)}
    </svg>
  );
}
