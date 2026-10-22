import { useEffect, useRef, useState } from 'preact/hooks';
import { watchView } from '../lib/inView';
import UI from '../data/ui-icons.json';
import { CORE, SPRITE_IDLE } from '../data/emotions';
import { useIconCache } from '../lib/store';
import { resolveIcon, svgInner, viewBoxOf } from '../lib/icons';

export type UiName = keyof typeof UI;

/** Interface icon (Tabler, bundled). */
export function Icon({ name, size = 20, stroke = 1.75, class: cls }: { name: UiName; size?: number; stroke?: number; class?: string }) {
  return (
    <svg
      class={cls}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: svgInner('t:' + name, UI[name], stroke) }}
    />
  );
}

/** The icon a note carries. Bodies come from the local cache, resolved lazily if missing. */
export function NoteIcon({ id, size = 22 }: { id: string; size?: number }) {
  const cache = useIconCache();
  const body = cache[id];
  useEffect(() => {
    if (!body) void resolveIcon(id).catch(() => {});
  }, [id, body]);
  if (!body) return <span style={{ width: size, height: size, display: 'inline-block' }} />;
  return (
    <svg width={size} height={size} viewBox={viewBoxOf(id)} aria-hidden="true" dangerouslySetInnerHTML={{ __html: svgInner(id, body) }} />
  );
}

const rowsPath = (rows: string[]) => rows.map((row, y) => [...row].map((c, x) => (c === 'X' ? `M${x} ${y}h1v1h-1z` : '')).join('')).join('');

const spritePaths: Record<string, string> = {};
/** Path for a world's sprite; frame > 0 is one of its idle frames. */
export function spritePath(core: string, frame = 0) {
  const key = `${core}:${frame}`;
  if (!spritePaths[key]) {
    const rows = frame ? SPRITE_IDLE[core]?.frames[frame - 1] : null;
    spritePaths[key] = rowsPath(rows ?? CORE[core].sprite);
  }
  return spritePaths[key];
}

/**
 * A world's sprite path, stepping through its idle loop while `on` (and never under reduced motion).
 * `delay` holds the first frame a little longer, so sprites side by side don't move in step.
 */
export function useSpriteIdle(core: string, on: boolean, delay = 0) {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    setFrame(0);
    const loop = SPRITE_IDLE[core]?.loop;
    if (!on || !loop || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let n = 0, t = 0;
    const next = (wait: number) => {
      t = window.setTimeout(() => {
        n = (n + 1) % loop.length;
        setFrame(loop[n][0]);
        next(loop[n][1]);
      }, wait);
    };
    next(loop[0][1] + delay);
    return () => clearTimeout(t);
  }, [core, on, delay]);
  return spritePath(core, frame);
}

/**
 * 8×8 pixel sprite for a core emotion — the "worlds" of Emotion Quest. `idle` plays its idle loop;
 * `idle="view"` plays it only while the sprite is on screen, for long lists like the journal.
 */
export function Sprite({ core, size = 16, color, idle = false, delay }: { core: string; size?: number; color?: string; idle?: boolean | 'view'; delay?: number }) {
  const ref = useRef<SVGSVGElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => (idle === 'view' && ref.current ? watchView(ref.current, setShown) : undefined), [idle]);
  const d = useSpriteIdle(core, idle === true || (idle === 'view' && shown), delay);
  return (
    <svg ref={ref} class="sprite" width={size} height={size} viewBox="0 0 8 8" shape-rendering="crispEdges" aria-hidden="true">
      <path d={d} fill={color ?? `var(--emo-${core})`} />
    </svg>
  );
}
