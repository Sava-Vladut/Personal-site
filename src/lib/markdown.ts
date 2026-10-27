// Note text is Markdown, written the way Obsidian writes it: **bold**, *italic*, ~~strike~~, ==highlight==, `code`,
// # headings, - lists, 1. numbered lists, - [ ] tasks, > quotes, > [!note] callouts, --- dividers, #tags, [^1] footnotes,
// and the bits of HTML Obsidian shows for underline, superscript, subscript, colours, a line's alignment and page breaks
// (lib/inline.ts, lib/palette.ts, lib/noteDoc/syntax.ts), and GFM's pipe tables.
// This file has the plain words for excerpts on cards. Reading it formatted is components/Markdown.tsx; editing it is
// the note editor's (src/editor, on the document of lib/noteDoc).
import { plainInline } from './inline';
import { mapTables } from './noteDoc/syntax';

const cut = (s: string, max: number) => {
  const chars = Array.from(s);
  if (chars.length <= max) return s;
  const head = chars.slice(0, max).join('');
  const at = head.search(/\s\S*$/);
  return (at > max * 0.6 ? head.slice(0, at) : head).replace(/[\s,;:.\-–—]+$/, '') + '…';
};

/**
 * A card's heading and preview from a note's plain words. A note without a title borrows its first line
 * (cut at a word if it's long); the preview is what follows, whole lines while they fit and the last one cut at a word.
 */
export function previewOf(text: string, title: string, max = 240) {
  const lines = stripMarkdown(text).split('\n').map((l) => l.trim());
  while (lines.length && !lines[0]) lines.shift();
  let heading = title.trim();
  if (!heading && lines.length) {
    const first = lines.shift()!;
    heading = cut(first, 70);
    const rest = heading.endsWith('…') ? first.slice(heading.length - 1).trim() : '';
    if (rest) lines.unshift(rest);
  }
  let out = '';
  for (const line of lines.filter(Boolean)) {
    const next = out ? `${out}\n${line}` : line;
    if (Array.from(next).length <= max) {
      out = next;
      continue;
    }
    const room = max - Array.from(out).length - 1;
    out = out && room < 30 ? out + '…' : (out ? out + '\n' : '') + cut(line, out ? room : max);
    break;
  }
  return { heading, preview: out };
}

/** A table's row as plain words: its cells' words with a dot between (the empty ones left out). */
const rowWords = (cells: string[]) => cells.map((c) => c.trim()).filter(Boolean).join(' · ');

/** The words without the Markdown around them, for excerpts on cards. A table's rows are its cells' words, a line each. */
export function stripMarkdown(text: string) {
  return mapTables(text, rowWords)
    .split('\n')
    .filter((l) => !/^\s*(```|~~~)/.test(l) && !/^\s*([-*_])([ \t]*\1){2,}\s*$/.test(l) && !/^<div style="page-break-after: ?always;?"><\/div>$/.test(l))
    .map((l) =>
      l
        .replace(/(?:^| )<!-- align:(?:center|right|justify) -->$/, '')
        .replace(/^\[\^[\w-]+\]:[ \t]+/, '')
        .replace(/^\s*>\s?\[![\w-]+\][+-]?\s*/, '')
        .replace(/^\s*(>\s?)+/, '')
        .replace(/^\s*#{1,6}\s+/, '')
        .replace(/^(\s*)[-*+]\s+\[[xX]\]\s+/, '$1☑ ')
        .replace(/^(\s*)[-*+]\s+\[ \]\s+/, '$1☐ ')
        .replace(/^(\s*)[-*+]\s+/, '$1• ')
        .replace(/!\[([^\]\n]*)\]\([^)\s]*\)/g, '$1')
        .replace(/\[\]\([^)\s]*\)/g, '')
        .replace(/__(\S(?:[^\n]*?\S)??)__/g, '$1'),
    )
    .map(plainInline)
    .join('\n');
}
