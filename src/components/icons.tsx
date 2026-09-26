import { useEffect, useMemo } from 'preact/hooks';
import UI from '../data/ui-icons.json';
import { CORE } from '../data/emotions';
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

const spritePaths: Record<string, string> = {};
export function spritePath(core: string) {
  if (!spritePaths[core]) {
    let d = '';
    CORE[core].sprite.forEach((row, y) => [...row].forEach((c, x) => c === 'X' && (d += `M${x} ${y}h1v1h-1z`)));
    spritePaths[core] = d;
  }
  return spritePaths[core];
}

/** 8×8 pixel sprite for a core emotion — the "worlds" of Emotion Quest. */
export function Sprite({ core, size = 16, color }: { core: string; size?: number; color?: string }) {
  const d = useMemo(() => spritePath(core), [core]);
  return (
    <svg class="sprite" width={size} height={size} viewBox="0 0 8 8" shape-rendering="crispEdges" aria-hidden="true">
      <path d={d} fill={color ?? `var(--emo-${core})`} />
    </svg>
  );
}

/** The app's own mark: a pixel thought bubble. Also used for the favicon and app icons. */
export const APP_SPRITE = ['..XX.XX.', '.XXXXXXX', 'XXXXXXXX', 'XXXXXXXX', '.XXXXXX.', '........', '.XX.....', 'X.......'];
const appPath = APP_SPRITE.map((row, y) => [...row].map((c, x) => (c === 'X' ? `M${x} ${y}h1v1h-1z` : '')).join('')).join('');
export function AppMark({ size = 14 }: { size?: number }) {
  return (
    <svg class="sprite" width={size} height={size} viewBox="0 0 8 8" shape-rendering="crispEdges" aria-hidden="true">
      <path d={appPath} fill="currentColor" />
    </svg>
  );
}
