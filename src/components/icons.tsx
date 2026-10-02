import { useEffect, useState } from 'preact/hooks';
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
    if (!body) resolveIcon(id);
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

/** A world's sprite path, stepping through its idle loop while `on` (and never under reduced motion). */
export function useSpriteIdle(core: string, on: boolean) {
  const [frame, setFrame] = useState(0);
  useEffect(() => {
    setFrame(0);
    const loop = SPRITE_IDLE[core]?.loop;
    if (!on || !loop || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let n = 0, t = 0;
    const next = () => {
      t = window.setTimeout(() => {
        n = (n + 1) % loop.length;
        setFrame(loop[n][0]);
        next();
      }, loop[n][1]);
    };
    next();
    return () => clearTimeout(t);
  }, [core, on]);
  return spritePath(core, frame);
}

/** 8×8 pixel sprite for a core emotion — the "worlds" of Emotion Quest. `idle` plays its idle loop. */
export function Sprite({ core, size = 16, color, idle = false }: { core: string; size?: number; color?: string; idle?: boolean }) {
  const d = useSpriteIdle(core, idle);
  return (
    <svg class="sprite" width={size} height={size} viewBox="0 0 8 8" shape-rendering="crispEdges" aria-hidden="true">
      <path d={d} fill={color ?? `var(--emo-${core})`} />
    </svg>
  );
}

/** The app's own mark: a pixel thought bubble. Also used for the favicon and app icons. */
export const APP_SPRITE = ['..XX.XX.', '.XXXXXXX', 'XXXXXXXX', 'XXXXXXXX', '.XXXXXX.', '........', '.XX.....', 'X.......'];
const appPath = rowsPath(APP_SPRITE);
export function AppMark({ size = 14 }: { size?: number }) {
  return (
    <svg class="sprite" width={size} height={size} viewBox="0 0 8 8" shape-rendering="crispEdges" aria-hidden="true">
      <path d={appPath} fill="currentColor" />
    </svg>
  );
}
