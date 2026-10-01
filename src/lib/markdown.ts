// Note text is Markdown, written the way Obsidian writes it: **bold**, *italic*, ~~strike~~, ==highlight==, `code`,
// # headings, - lists, 1. numbered lists, - [ ] tasks, > quotes, > [!note] callouts, --- dividers and #tags.
// This file has the editing side: formatting commands for the text boxes, and the plain words for excerpts.
// Reading it back is components/Markdown.tsx.

/* ---------- block prefixes ---------- */

/** The marker a line starts with: its indent, then a heading, task, bullet, number or quote marker. */
export const PREFIX = /^([ \t]*)(#{1,6}[ \t]+|[-*+][ \t]+\[[ xX]\][ \t]+|[-*+][ \t]+|\d{1,9}[.)][ \t]+|>[ \t]?)?/;

export type LineKind = 'h1' | 'h2' | 'h3' | 'ul' | 'ol' | 'task' | 'quote';

function kindOf(marker: string): LineKind | null {
  if (!marker) return null;
  if (marker[0] === '#') return (['h1', 'h2', 'h3'][marker.trim().length - 1] as LineKind) ?? 'h3';
  if (marker[0] === '>') return 'quote';
  if (/\[[ xX]\]/.test(marker)) return 'task';
  return /^\d/.test(marker) ? 'ol' : 'ul';
}

const markerFor = (kind: LineKind, n: number) =>
  ({ h1: '# ', h2: '## ', h3: '### ', ul: '- ', ol: `${n}. `, task: '- [ ] ', quote: '> ' })[kind];

/* ---------- editing a text box ---------- */

/** What the commands need of a text box: a textarea, or a note's editable block (lib/editable.ts). */
export interface TextBox {
  value: string;
  readonly selectionStart: number;
  readonly selectionEnd: number;
  setSelectionRange(start: number, end: number): void;
  setRangeText(text: string, start: number, end: number): void;
  focus(options?: FocusOptions): void;
  dispatchEvent(e: Event): boolean;
}

/**
 * Replaces [start, end) with `text` and selects [selStart, selEnd]. Goes through the browser's own editing so
 * undo keeps working, and the input event updates the note like typing does.
 */
export function replace(el: TextBox, start: number, end: number, text: string, selStart = start + text.length, selEnd = selStart) {
  el.focus({ preventScroll: true });
  el.setSelectionRange(start, end);
  let done = false;
  try {
    done = document.execCommand('insertText', false, text);
  } catch {}
  if (!done || el.value.slice(start, start + text.length) !== text) {
    el.setRangeText(text, start, end);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }
  el.setSelectionRange(selStart, selEnd);
}

const lineStart = (v: string, i: number) => i <= 0 ? 0 : v.lastIndexOf('\n', i - 1) + 1;
const lineEnd = (v: string, i: number) => {
  const n = v.indexOf('\n', i);
  return n < 0 ? v.length : n;
};
const isWordChar = (c: string | undefined) => !!c && /[\p{L}\p{N}_'’-]/u.test(c);

/** Bold, italic, strike, highlight or code around the selection — or off again if it's already there. */
export function toggleWrap(el: TextBox, mark: string) {
  const v = el.value;
  let s = el.selectionStart, e = el.selectionEnd;
  const n = mark.length;
  // A caret inside a word formats the whole word.
  if (s === e) {
    while (s > 0 && isWordChar(v[s - 1])) s--;
    while (e < v.length && isWordChar(v[e])) e++;
  }
  // Markers can't sit against spaces, so leave those outside.
  while (s < e && /\s/.test(v[s])) s++;
  while (e > s && /\s/.test(v[e - 1])) e--;
  const sel = v.slice(s, e);
  // `*` next to `**` is part of the bold, not an italic.
  const around = (at: number) => v.slice(at, at + n) === mark && (mark !== '*' || (v[at - 1] !== '*' && v[at + 1] !== '*') || v.slice(at - 2, at + 1) === '***' || v.slice(at, at + 3) === '***');
  if (sel.length >= 2 * n && sel.startsWith(mark) && sel.endsWith(mark) && !(mark === '*' && sel.startsWith('**') && !sel.startsWith('***'))) {
    return replace(el, s, e, sel.slice(n, -n), s, e - 2 * n);
  }
  if (s >= n && around(s - n) && around(e)) {
    return replace(el, s - n, e + n, sel, s - n, e - n);
  }
  if (s === e) return replace(el, s, e, mark + mark, s + n);
  replace(el, s, e, mark + sel + mark, s + n, e + n);
}

/**
 * Turns the selected lines into a heading, list, task list or quote — or back into plain text when they all
 * already are one. Headings step through #, ##, ### and back to plain.
 */
export function toggleLines(el: TextBox, kind: LineKind | 'heading') {
  const v = el.value;
  const s = lineStart(v, el.selectionStart);
  const e = lineEnd(v, el.selectionEnd > el.selectionStart && v[el.selectionEnd - 1] === '\n' ? el.selectionEnd - 1 : el.selectionEnd);
  const lines = v.slice(s, e).split('\n');
  const parsed = lines.map((l) => {
    const m = l.match(PREFIX)!;
    return { indent: m[1], kind: kindOf(m[2] ?? ''), rest: l.slice(m[0].length) };
  });
  const used = parsed.filter((p, i) => lines.length === 1 || p.rest.trim() || p.kind || i === 0);
  let target: LineKind | null;
  if (kind === 'heading') {
    const k = used[0]?.kind;
    target = k === 'h1' ? 'h2' : k === 'h2' ? 'h3' : k === 'h3' ? null : 'h1';
  } else target = used.every((p) => p.kind === kind) ? null : kind;
  let n = 0;
  const out = parsed.map((p, i) => {
    if (!used.includes(p) && !lines[i].trim()) return lines[i];
    const heading = target === 'h1' || target === 'h2' || target === 'h3';
    return (heading ? '' : p.indent) + (target ? markerFor(target, ++n) : '') + p.rest;
  });
  const text = out.join('\n');
  if (lines.length === 1) {
    // keep the caret where it was in the words
    const at = Math.max(s + text.length - (e - el.selectionEnd), s + text.length - parsed[0].rest.length);
    return replace(el, s, e, text, at);
  }
  replace(el, s, e, text, s, s + text.length);
}

/** Puts a block (a divider, a code block, a callout) on lines of its own at the caret, then carries on below it. */
export function insertBlock(el: TextBox, block: string, caretAt?: number) {
  const v = el.value;
  const s = el.selectionStart, e = el.selectionEnd;
  const ls = lineStart(v, s);
  // a blank line before, so the block doesn't join the text, quote or list above it
  const above = ls > 0 ? v.slice(lineStart(v, ls - 1), ls - 1) : '';
  const before = s === 0 ? '' : v.slice(ls, s).trim() ? '\n\n' : above.trim() ? '\n' : '';
  const after = e === v.length || v[e] !== '\n' ? '\n' : '';
  const text = before + block + after;
  replace(el, s, e, text, s + before.length + (caretAt ?? block.length + 1)); // by default, on the line below
}

/** Adds a link around the selection, or an empty one to fill in. */
export function insertLink(el: TextBox) {
  const v = el.value;
  const s = el.selectionStart, e = el.selectionEnd;
  const sel = v.slice(s, e);
  if (/^https?:\/\/\S+$/.test(sel)) return replace(el, s, e, `[](${sel})`, s + 1);
  if (sel) return replace(el, s, e, `[${sel}](https://)`, s + sel.length + 3, s + sel.length + 11);
  replace(el, s, e, '[](https://)', s + 1);
}

/** Moves the selected list lines in or out a level. */
export function indentLines(el: TextBox, out: boolean) {
  const v = el.value;
  const s = lineStart(v, el.selectionStart);
  const e = lineEnd(v, el.selectionEnd > el.selectionStart && v[el.selectionEnd - 1] === '\n' ? el.selectionEnd - 1 : el.selectionEnd);
  const lines = v.slice(s, e).split('\n');
  const next = lines.map((l) => (out ? l.replace(/^(\t| {1,4})/, '') : '\t' + l));
  const text = next.join('\n');
  const shift = next[0].length - lines[0].length;
  if (text === v.slice(s, e)) return;
  replace(el, s, e, text, Math.max(s, el.selectionStart + shift), el.selectionEnd + text.length - (e - s));
}

/**
 * List typing, as in Obsidian: Enter carries a list, task or quote on to the next line (Enter on an empty item ends
 * it), Tab and Shift+Tab move list items in and out. Returns true when it handled the key.
 */
export function listKey(el: TextBox, e: KeyboardEvent) {
  if (e.isComposing || e.keyCode === 229 || e.altKey || e.ctrlKey || e.metaKey) return false;
  const v = el.value;
  const s = el.selectionStart;
  const ls = lineStart(v, s);
  const line = v.slice(ls, lineEnd(v, s));
  const m = line.match(PREFIX)!;
  const kind = kindOf(m[2] ?? '');
  const inList = kind === 'ul' || kind === 'ol' || kind === 'task';
  if (e.key === 'Tab' && inList) {
    indentLines(el, e.shiftKey);
    return true;
  }
  if (e.key !== 'Enter' || e.shiftKey || s !== el.selectionEnd || !kind || kind[0] === 'h' || s < ls + m[0].length) return false;
  if (!line.slice(m[0].length).trim()) {
    // an empty item: step out a level, or end the list
    if (m[1] && inList) indentLines(el, true);
    else replace(el, ls, ls + line.length, '');
    return true;
  }
  let marker = m[2]!;
  if (kind === 'task') marker = marker.replace(/\[[xX]\]/, '[ ]');
  if (kind === 'ol') marker = marker.replace(/\d+/, (d) => String(+d + 1));
  replace(el, s, s, '\n' + m[1] + marker);
  return true;
}

/* ---------- reading ---------- */

/** Ticks or unticks the task on line `line` of a text. */
export function toggleTask(text: string, line: number) {
  const lines = text.split('\n');
  if (!Number.isInteger(line) || line < 0 || line >= lines.length) return text;
  lines[line] = lines[line].replace(/^((?:[ \t]*>[ \t]?)*[ \t]*[-*+][ \t]+\[)([ xX])\]/, (_, a, c) => a + (c === ' ' ? 'x' : ' ') + ']');
  return lines.join('\n');
}

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

/** The words without the Markdown around them, for excerpts on cards. */
export function stripMarkdown(text: string) {
  return text
    .split('\n')
    .filter((l) => !/^\s*(```|~~~)/.test(l) && !/^\s*([-*_])([ \t]*\1){2,}\s*$/.test(l))
    .map((l) =>
      l
        .replace(/^\s*>\s?\[![\w-]+\][+-]?\s*/, '')
        .replace(/^\s*(>\s?)+/, '')
        .replace(/^\s*#{1,6}\s+/, '')
        .replace(/^(\s*)[-*+]\s+\[[xX]\]\s+/, '$1☑ ')
        .replace(/^(\s*)[-*+]\s+\[ \]\s+/, '$1☐ ')
        .replace(/^(\s*)[-*+]\s+/, '$1• ')
        .replace(/!?\[([^\]\n]*)\]\([^)\s]*\)/g, '$1')
        .replace(/\[\[([^\]|\n]+\|)?([^\]\n]+)\]\]/g, '$2')
        .replace(/@\[(?:person:[^\]|\n]+\|)?([^\]\n]+)\]/g, '$1')
        .replace(/♪\[(?:song:[^\]|\n]+\|)?([^\]\n]+)\]/g, '$1')
        .replace(/(\*\*|__|~~|==)(\S(?:.*?\S)?)\1/g, '$2')
        .replace(/\*(?=[^\s*])([^*\n]+?)\*/g, '$1')
        .replace(/`([^`\n]+)`/g, '$1'),
    )
    .join('\n');
}
