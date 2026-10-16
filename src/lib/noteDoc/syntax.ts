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

/** How far a list item is indented: two spaces or a tab a level, at most 6. */
export const depthOf = (indent: string) => Math.min(6, [...indent].reduce((n, c) => n + (c === '\t' ? 2 : 1), 0) >> 1);

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
