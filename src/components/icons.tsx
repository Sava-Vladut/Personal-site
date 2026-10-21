import { useEffect, useRef, useState } from 'preact/hooks';
import { watchView } from '../lib/inView';
import UI from '../data/ui-icons.json';
import { critter, critterStyle } from './critters';
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

/**
 * A core emotion's character, the "worlds" of Emotion Quest. `idle` plays its idle loop;
 * `idle="view"` plays it only while it's on screen, for long lists like the journal.
 * `delay` holds the loop back a little, so characters side by side don't move in step.
 */
export function Sprite({ core, size = 16, color, idle = false, delay }: { core: string; size?: number; color?: string; idle?: boolean | 'view'; delay?: number }) {
  const ref = useRef<SVGSVGElement>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => (idle === 'view' && ref.current ? watchView(ref.current, setShown) : undefined), [idle]);
  const on = idle === true || (idle === 'view' && shown);
  return (
    <svg
      ref={ref}
      class={`sprite${on ? ' idle' : ''}`}
      data-k={core}
      width={size}
      height={size}
      viewBox="0 0 32 32"
      style={critterStyle(core, delay, color)}
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: critter(core, size < 16) }}
    />
  );
}
