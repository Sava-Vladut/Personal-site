// What kind of line a line of a note is, read exactly as the reading view reads it (components/Markdown.tsx `parse`).
// The regexes are copies of Markdown.tsx's, so both agree on every line; scripts/test-notedoc.mjs checks they do.
// The editor's parser (parse.ts) reads lines with these, and the serializer (serialize.ts) checks with them that each
// line it writes reads back as the block it was written for.

export const HR = /^\s*([-*_])([ \t]*\1){2,}\s*$/;
export const FENCE = /^\s*(```|~~~)/;
export const HEAD = /^(#{1,6})[ \t]+(.*)$/;
export const ITEM = /^([ \t]*)([-*+][ \t]+\[([ xX])\]|[-*+]|(\d{1,9})[.)])[ \t]+(.*)$/;
export const QUOTE = /^[ \t]*>[ \t]?(.*)$/;
/** A quote's first line that makes it a callout: > [!note] Title (Obsidian's syntax). */
export const CALLOUT = /^\[!([\w-]+)\][+-]?[ \t]*(.*)$/;
/** A page break: the line Obsidian (and its PDF export) breaks the page at, as written (with or without the `;`). */
export const PAGEBREAK = /^<div style="page-break-after: ?always;?"><\/div>$/;
/** A footnote's text, `[^1]: words` (Obsidian's syntax): its label, then the words. */
export const FOOTNOTE = /^\[\^([\w-]+)\]:[ \t]+(.*)$/;
/**
 * A paragraph's or heading's alignment, written at the end of its line: ` <!-- align:center -->` (no space before it
 * on an empty line). An HTML comment, so Obsidian and other Markdown readers hide it and still read the line's
 * Markdown (they don't inside an HTML tag such as <p align="center">). Left is the default, never written.
 */
export const ALIGN = /(?:^| )<!-- align:(center|right|justify) -->$/;
export const ALIGNS = ['center', 'right', 'justify'] as const;
export type Align = (typeof ALIGNS)[number];
export const isAlign = (a: unknown): a is Align => (ALIGNS as readonly unknown[]).includes(a);

/** A line's text (after its marker) without the alignment written at its end, and that alignment (null: left). */
export function alignOf(s: string): { text: string; align: Align | null } {
  const m = s.match(ALIGN);
  return m ? { text: s.slice(0, m.index), align: m[1] as Align } : { text: s, align: null };
}
/** What's written at the end of a line to align it (an empty line's has no space before it). */
export const alignSuffix = (a: Align | null, empty: boolean) => (a ? `${empty ? '' : ' '}<!-- align:${a} -->` : '');

/** How far a list item is indented: two spaces or a tab a level, at most 6. */
export const depthOf = (indent: string) => Math.min(6, [...indent].reduce((n, c) => n + (c === '\t' ? 2 : 1), 0) >> 1);

/** n as a, b, … z, aa, ab… */
const letters = (n: number): string => (n > 26 ? letters(Math.floor((n - 1) / 26)) : '') + String.fromCharCode(97 + ((n - 1) % 26));
/** n in lower-case Roman numerals (as digits past 3999) */
function roman(n: number): string {
  if (n >= 4000) return String(n);
  let out = '';
  for (const [v, r] of [[1000, 'm'], [900, 'cm'], [500, 'd'], [400, 'cd'], [100, 'c'], [90, 'xc'], [50, 'l'], [40, 'xl'], [10, 'x'], [9, 'ix'], [5, 'v'], [4, 'iv'], [1, 'i']] as const) {
    for (; n >= v; n -= v) out += r;
  }
  return out;
}

/**
 * The marker a numbered item shows, as Word's multilevel list: 1. at the top, a. a level in, i. the next, then over
 * again. Only shown: the text keeps its digits.
 */
export function olMarker(num: string, depth: number): string {
  const n = Number(num) || 1;
  const level = depth % 3;
  return (level === 1 ? letters(n) : level === 2 ? roman(n) : num) + '.';
}

export type ListKind = 'ul' | 'ol' | 'task';

/** The parts of a list item's line, as written: `indent + marker + sep + text`. */
export interface ItemParts {
  kind: ListKind;
  /** spaces and tabs before the marker, as written */
  indent: string;
  /** `-`, `*` or `+` (bullets and tasks) */
  bullet: string;
  /** the number as written, `01` stays `01` (numbered items) */
  num: string;
  /** `.` or `)` (numbered items) */
  delim: string;
  /** what's between the bullet and `[` of a task */
  gap: string;
  /** what's in a task's box: ' ', 'x' or 'X' */
  check: string;
  /** the spaces and tabs between the marker and the text */
  sep: string;
}

/** A line, by kind. `at` is where the line's own text starts (after its marker). */
export type Line =
  | { t: 'blank' }
  | { t: 'fence'; fence: '```' | '~~~' }
  | { t: 'hr' }
  | { t: 'heading'; level: number; sep: string; at: number }
  | ({ t: 'item'; at: number } & ItemParts)
  | { t: 'quote'; at: number }
  | { t: 'pagebreak' }
  | { t: 'footnote'; label: string; sep: string; at: number }
  | { t: 'text' };

/** Reads one line the way Markdown.tsx does, trying the kinds in the same order. */
export function classifyLine(l: string): Line {
  let m: RegExpMatchArray | null;
  if (!l.trim()) return { t: 'blank' };
  if (FENCE.test(l)) return { t: 'fence', fence: l.trim().slice(0, 3) as '```' | '~~~' };
  if (HR.test(l)) return { t: 'hr' };
  if ((m = l.match(HEAD))) return { t: 'heading', level: m[1].length, sep: l.slice(m[1].length, l.length - m[2].length), at: l.length - m[2].length };
  if ((m = l.match(ITEM))) {
    const [, indent, marker, check, num] = m;
    const at = l.length - m[5].length;
    const kind: ListKind = check !== undefined ? 'task' : num ? 'ol' : 'ul';
    return {
      t: 'item', at, kind, indent,
      bullet: num ? '-' : marker[0],
      num: num ?? '1',
      delim: num ? marker.slice(-1) : '.',
      gap: kind === 'task' ? marker.slice(1, -3) : ' ',
      check: check ?? ' ',
      sep: l.slice(indent.length + marker.length, at),
    };
  }
  if ((m = l.match(QUOTE))) return { t: 'quote', at: l.length - m[1].length };
  if (PAGEBREAK.test(l)) return { t: 'pagebreak' };
  if ((m = l.match(FOOTNOTE))) return { t: 'footnote', label: m[1], sep: l.slice(m[1].length + 4, l.length - m[2].length), at: l.length - m[2].length };
  return { t: 'text' };
}

/** A quote's first line read as a callout's title line: `[!kind]fold sep title`. Null when it isn't one. */
export function calloutOf(l: string): { kind: string; fold: '' | '+' | '-'; sep: string; at: number } | null {
  const m = l.match(CALLOUT);
  if (!m) return null;
  const rest = l.slice(m[1].length + 3);
  const fold = rest[0] === '+' || rest[0] === '-' ? rest[0] : '';
  const at = l.length - m[2].length;
  return { kind: m[1], fold, sep: l.slice(m[1].length + 3 + fold.length, at), at };
}

/** Whether `l` ends a code block opened with `fence` (the reading view's test: the trimmed line starts with it). */
export const closesFence = (l: string, fence: string) => l.trim().startsWith(fence);

/** The fence (``` or ~~~) a code block's opening line uses, or null when the line doesn't open one. */
export const fenceOf = (open: string) => (FENCE.test(open) ? (open.trim().slice(0, 3) as '```' | '~~~') : null);

/* ---------- callouts, as the reading view shows them ---------- */

export const CALLOUT_ICON: Record<string, string> = {
  note: '✎', info: 'ℹ', tip: '✦', hint: '✦', important: '✦', success: '✓', check: '✓', done: '✓', question: '?', help: '?',
  warning: '!', caution: '!', attention: '!', danger: '⚡', error: '⚡', bug: '⚠', example: '≡', quote: '❝', cite: '❝', abstract: '≡', summary: '≡', todo: '☐',
};
/** A callout's colour, from its kind (any case). */
export const calloutTone = (kind: string) => {
  const c = kind.toLowerCase();
  return /^(success|check|done)$/.test(c) ? 'good' : /^(warning|caution|attention)$/.test(c) ? 'warn' : /^(danger|error|bug|failure|fail|missing)$/.test(c) ? 'bad' : /^(tip|hint|important)$/.test(c) ? 'tip' : 'info';
};
export const calloutIcon = (kind: string) => CALLOUT_ICON[kind.toLowerCase()] ?? '✎';
/** The title a callout shows when its own is empty: its kind, capitalised. */
export const calloutDefaultTitle = (kind: string) => kind[0].toUpperCase() + kind.slice(1).toLowerCase();

/** A link's address that opens: the web or e-mail, never script (the same test as the reading view's). */
export const SAFE = /^(https?:\/\/|mailto:)\S/;
/** A web address written as it is, the same as lib/inline.ts reads one. */
export const BARE = /^https?:\/\/[^\s<>]*[^\s<>.,:;"'!?)\]]$/;
