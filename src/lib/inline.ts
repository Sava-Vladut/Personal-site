// The inline Markdown of a line, read the same way everywhere: the note editor's document (lib/noteDoc/parse.ts),
// the reading view (components/Markdown.tsx) and the plain words of excerpts (stripMarkdown in lib/markdown.ts).
// Styles take the shortest run they can, so **a** and **b** are two bold words rather than one, and a backslash
// keeps the character after it as it is (\* is a star, not italic). Underline, superscript, subscript and colours are
// the bits of HTML Obsidian shows: <u>, <sup>, <sub>, <span style="color:red"> and <mark style="background:pink">,
// each only in exactly that form and with a colour of lib/palette.ts (anything else is the text it is).
import { HIGHLIGHTS, TEXT_COLORS } from './palette';

/** A piece of a line: plain text, or a styled run with the text inside its markers. */
export type Inline =
  | { t: 'text'; s: string }
  /** a character kept as it is by the backslash before it */
  | { t: 'esc'; s: string }
  | { t: 'code'; tick: string; s: string }
  /** [[a note or book]], @[someone] and ♪[a song], with what they're written as (`raw`) and where they point */
  | { t: 'wiki' | 'person' | 'song'; raw: string; target?: string; s: string }
  | { t: 'link'; s: string; url: string }
  | { t: 'b' | 'i' | 's'; mark: string; s: string }
  /** ==a highlight==, or <mark style="background:…"> in another colour than yellow (`color`, else null) */
  | { t: 'hl'; mark: string; s: string; color: string | null }
  /** <u>, <sup>, <sub> */
  | { t: 'u' | 'sup' | 'sub'; s: string }
  /** <span style="color:…">, a font colour */
  | { t: 'color'; color: string; s: string }
  /** an empty pair of markers, ** ** with nothing in it yet */
  | { t: 'empty'; s: string }
  | { t: 'bare'; s: string }
  /** a #tag, with its # */
  | { t: 'tag'; s: string };

/** A letter inside a style: an escaped one whole, so \* never closes it. */
const C = String.raw`(?:\\[^\n]|[^\\\n])`;

const INLINE = new RegExp(
  [
    /\\(?<esc>[\x21-\x2f\x3a-\x40\x5b-\x60\x7b-\x7e])/.source,
    /(?<tick>`+)(?<code>[^`\n]+?)\k<tick>/.source,
    /\[\[(?:(?<wt>[^\]|\n]+)\|)?(?<wiki>[^\]\n]+)\]\]/.source,
    /@\[(?:person:(?<pt>[^\]|\n]+)\|)?(?<person>[^\]\n]+)\]/.source,
    /♪\[(?:song:(?<st>[^\]|\n]+)\|)?(?<song>[^\]\n]+)\]/.source,
    /\[(?<text>[^\]\n]+)\]\((?<url>[^)\s]*)\)/.source,
    /(?<![*~=])(?<empty>\*\*\*\*|~~~~|====)(?![*~=])/.source,
    // a style starts at a letter (not a space), and ends at the first marker that closes it
    String.raw`\*\*(?<b>(?!\s)${C}+?)\*\*(?!\*)`,
    String.raw`~~(?<s>(?!\s)${C}+?)~~`,
    String.raw`==(?<hl>(?!\s)${C}+?)==`,
    // (never empty: <u></u> is the text it is, not the start of a run up to the next </u>)
    String.raw`<u>(?!</u>)(?<u>${C}+?)</u>`,
    String.raw`<sup>(?!</sup>)(?<sup>${C}+?)</sup>`,
    String.raw`<sub>(?!</sub>)(?<sub>${C}+?)</sub>`,
    String.raw`<span style="color:(?<fc>${TEXT_COLORS.join('|')})">(?!</span>)(?<fg>${C}+?)</span>`,
    String.raw`<mark style="background:(?<hc>${HIGHLIGHTS.join('|')})">(?!</mark>)(?<mk>${C}+?)</mark>`,
    String.raw`(?<!\*)\*(?<i>(?![\s*])(?:\\[^\n]|[^\\*\n])+?)\*`,
    /(?<bare>https?:\/\/[^\s<>]*[^\s<>.,:;"'!?)\]])/.source,
    /(?<![^\s(])(?<tag>#[\p{L}_][\p{L}\p{N}_/-]*)/u.source,
  ].join('|'),
  'gu',
);

/** A line's text in pieces. Styled runs hold their inner text as it's written: read it with `inline` again. */
export function inline(text: string): Inline[] {
  const out: Inline[] = [];
  let at = 0;
  const plain = (s: string) => {
    if (!s) return;
    const last = out[out.length - 1];
    if (last?.t === 'text') last.s += s;
    else out.push({ t: 'text', s });
  };
  for (const m of text.matchAll(INLINE)) {
    const g = m.groups!;
    const i = m.index!;
    plain(text.slice(at, i));
    at = i + m[0].length;
    if (g.esc !== undefined) out.push({ t: 'esc', s: g.esc });
    else if (g.code !== undefined) out.push({ t: 'code', tick: g.tick, s: g.code });
    else if (g.wiki !== undefined) out.push({ t: 'wiki', raw: m[0], target: g.wt, s: g.wiki });
    else if (g.person !== undefined) out.push({ t: 'person', raw: m[0], target: g.pt, s: g.person });
    else if (g.song !== undefined) out.push({ t: 'song', raw: m[0], target: g.st, s: g.song });
    else if (g.text !== undefined) out.push({ t: 'link', s: g.text, url: g.url });
    else if (g.empty !== undefined) out.push({ t: 'empty', s: g.empty });
    else if (g.b !== undefined) out.push({ t: 'b', mark: '**', s: g.b });
    else if (g.s !== undefined) out.push({ t: 's', mark: '~~', s: g.s });
    else if (g.hl !== undefined) out.push({ t: 'hl', mark: '==', s: g.hl, color: null });
    else if (g.u !== undefined) out.push({ t: 'u', s: g.u });
    else if (g.sup !== undefined) out.push({ t: 'sup', s: g.sup });
    else if (g.sub !== undefined) out.push({ t: 'sub', s: g.sub });
    else if (g.fg !== undefined) out.push({ t: 'color', color: g.fc, s: g.fg });
    else if (g.mk !== undefined) out.push({ t: 'hl', mark: '<mark>', s: g.mk, color: g.hc });
    else if (g.i !== undefined) out.push({ t: 'i', mark: '*', s: g.i });
    else if (g.bare !== undefined) out.push({ t: 'bare', s: g.bare });
    else if (g.tag !== undefined) out.push({ t: 'tag', s: g.tag });
  }
  plain(text.slice(at));
  return out;
}

/** Whether a piece holds styled text, to read again with `inline`. */
const nests = (p: Inline): p is Extract<Inline, { t: 'b' | 'i' | 's' | 'hl' | 'u' | 'sup' | 'sub' | 'color' | 'link' }> =>
  /^(b|i|s|hl|u|sup|sub|color|link)$/.test(p.t);

/** A line's words without their inline Markdown. */
export function plainInline(text: string): string {
  return inline(text)
    .map((p) => (nests(p) ? plainInline(p.s) : p.t === 'empty' ? '' : p.s))
    .join('');
}

const TAGS = new RegExp(
  String.raw`</?(?:u|sup|sub)>|</(?:span|mark)>|<span style="color:(?:${TEXT_COLORS.join('|')})">|<mark style="background:(?:${HIGHLIGHTS.join('|')})">`,
  'g',
);

/** Text without the tags of underline, superscript, subscript and colours, Markdown left as it is (search, exports). */
export const dropTags = (text: string) => text.replace(TAGS, '');
