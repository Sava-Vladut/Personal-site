import { coreOf } from '../data/emotions';
import { skyWorlds } from '../lib/stats';

export { AsciiCloud } from './AsciiCloud';

/** A title that rises out of the clouds a letter at a time. */
export function CloudTitle({ text }: { text: string }) {
  return (
    <h1 class="title cloud-title" aria-label={text}>
      {[...text].map((ch, i) => (
        <span aria-hidden="true" style={{ '--i': i }}>{ch === ' ' ? '\u00a0' : ch}</span>
      ))}
    </h1>
  );
}

/** A sky's colours, from how the things on a page make you feel (their main feeling each); `quiet` when nothing's felt yet. */
export function feltWorlds(list: { emotions: string[] }[], quiet: string[]) {
  const counts = new Map<string, number>();
  for (const x of list) {
    const core = x.emotions[0] && coreOf(x.emotions[0])?.id;
    if (core) counts.set(core, (counts.get(core) ?? 0) + 1);
  }
  const worlds = skyWorlds([...counts].map(([id, count]) => ({ id, count })));
  return worlds.length ? worlds : quiet;
}
