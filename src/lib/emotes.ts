// Emotes in chat logs. A code is a provider letter and the emote's id: t Twitch, s 7TV, b BetterTTV, f FrankerFaceZ
// (g when animated), with a leading z on the zero-width ones that sit on top of the emote before them. Twitch's come with
// each line (its `e`); the rest are the channel's, from server/chatlog-emotes.js.

export type Emotes = Map<string, string>;
export interface Emote { name: string; zero: boolean; src: string; srcset: string; /** shown if the picture can't be loaded */ still?: string }
export type Piece = string | Emote;

const ADDRESS: Record<string, (id: string, size: number) => string> = {
  t: (id, n) => `https://static-cdn.jtvnw.net/emoticons/v2/${id}/default/dark/${n}.0`,
  s: (id, n) => `https://cdn.7tv.app/emote/${id}/${n}x.webp`,
  b: (id, n) => `https://cdn.betterttv.net/emote/${id}/${n}x.webp`,
  f: (id, n) => `https://cdn.frankerfacez.com/emote/${id}/${n}`,
  g: (id, n) => `https://cdn.frankerfacez.com/emote/${id}/animated/${n}`,
};

/** An emote from its code; null when the code isn't one this knows. */
export function emote(name: string, code: string): Emote | null {
  const zero = code[0] === 'z';
  const kind = ADDRESS[code[zero ? 1 : 0]];
  const id = code.slice(zero ? 2 : 1);
  if (!kind || !id) return null;
  return { name, zero, src: kind(id, 1), srcset: `${kind(id, 1)} 1x, ${kind(id, 2)} 2x`, still: code[zero ? 1 : 0] === 'g' ? ADDRESS.f(id, 1) : undefined };
}

/**
 * A line's text as words and emotes, with the spacing kept. A word is an emote when Twitch marked it in this line
 * (`own`) or the channel's emote sets have it; the line's own Twitch emotes come first. Names are case-sensitive.
 */
export function pieces(text: string, own: Record<string, string> | undefined, channel: Emotes | null): Piece[] {
  if (!own && !channel) return [text];
  const out: Piece[] = [];
  let run = '';
  for (const part of text.split(/(\s+)/)) {
    const code = part && ((own && Object.hasOwn(own, part) ? own[part] : null) ?? channel?.get(part));
    const e = code ? emote(part, code) : null;
    if (!e) { run += part; continue; }
    if (run) out.push(run);
    run = '';
    out.push(e);
  }
  if (run) out.push(run);
  return out;
}

/** The pieces as words (strings) and emotes (an emote and the zero-width ones laid over it). A lone zero-width emote stands as it is. */
export function stacks(list: Piece[]): (string | Emote[])[] {
  const out: (string | Emote[])[] = [];
  for (const p of list) {
    if (typeof p === 'string') { out.push(p); continue; }
    const last = out[out.length - 1];
    const spaced = typeof last === 'string' && !last.trim(); // only spaces since the emote before
    const before = spaced ? out[out.length - 2] : last;
    if (p.zero && Array.isArray(before)) {
      if (spaced) out.pop();
      before.push(p);
    } else out.push([p]);
  }
  return out;
}
