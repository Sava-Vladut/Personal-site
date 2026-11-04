import { pieces, stacks, type Emote, type Emotes } from '../lib/emotes';

function Picture({ e }: { e: Emote }) {
  return (
    <img
      class="cl-emote"
      src={e.src}
      srcset={e.srcset}
      alt={e.name}
      title={e.name}
      loading="lazy"
      decoding="async"
      onError={e.still ? (ev) => { ev.currentTarget.removeAttribute('srcset'); ev.currentTarget.src = e.still!; } : undefined}
    />
  );
}

/** A chat line's text with its emotes as pictures: the line's own Twitch ones, and the channel's 7TV, BetterTTV and FrankerFaceZ ones. */
export function ChatText({ text, own, emotes }: { text: string; own?: Record<string, string>; emotes: Emotes | null }) {
  const list = stacks(pieces(text, own, emotes));
  return (
    <>
      {list.map((p) => (typeof p === 'string' ? p : p.length === 1 ? <Picture e={p[0]} /> : <span class="cl-emote-stack">{p.map((e) => <Picture e={e} />)}</span>))}
    </>
  );
}
