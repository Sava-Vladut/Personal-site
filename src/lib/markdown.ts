// Note text is Markdown, written the way Obsidian writes it: **bold**, *italic*, ~~strike~~, ==highlight==, `code`,
// # headings, - lists, 1. numbered lists, - [ ] tasks, > quotes, > [!note] callouts, --- dividers and #tags.
// This file has the editing side: formatting commands for the text boxes, and the plain words for excerpts.
// Reading it back is components/Markdown.tsx.
import { hiddenRanges, styleSpans } from './liveMarkdown';

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

/** The inline styles by marker: the class each one's span has in the styled text (lib/liveMarkdown.ts). */
const STYLE: Record<string, string> = { '**': 'md-b', '*': 'md-i', '~~': 'md-s', '==': 'md-hl', '`': 'md-code' };
/** Spans whose words other styles can sit inside. */
const HOLDS = ['md-b', 'md-i', 'md-s', 'md-hl', 'md-link'];

/** Where a line's words start: after its heading, list, task or quote marker (and a callout's [!type]). */
function wordsFrom(line: string) {
  const p = line.match(PREFIX)![0].length;
  const c = /^[ \t]*>/.test(line) ? line.slice(p).match(/^\[![\w-]+\][+-]?[ \t]*/) : null;
  return p + (c ? c[0].length : 0);
}

/**
 * Bold, italic, strike, highlight or code on the selection — or off again if it's all there already — the way a word
 * processor does it. It styles the words only: a line's heading, list or quote marker stays out of it, each line gets
 * its own markers, and spaces stay outside them. Where the selection meets styling already there it fits in: text
 * inside a span is split out of it, a span it touches is merged, and one that only partly overlaps another style is
 * cut so the markers always nest. A caret in a word styles the word. Returns false when there was nothing to style.
 */
export function toggleWrap(el: TextBox, mark: string) {
  const v = el.value;
  const style = STYLE[mark];
  const spans = styleSpans(v);
  const own = spans.filter((p) => p.c === style);
  const blank = (i: number) => /\s/.test(v[i]);

  /** [a, b) as the pieces that can wear the markers without breaking how the other spans nest. */
  const pieces = (a: number, b: number): [number, number][] => {
    while (a < b && blank(a)) a++;
    while (b > a && blank(b - 1)) b--;
    if (a >= b) return [];
    for (const p of spans) {
      if (p.x >= b || p.y <= a || p.c === style) continue;
      const holds = a >= p.cx && b <= p.cy;
      const whole = a <= p.x && b >= p.y;
      let cut: [number, number][];
      if (p.c === 'md-pre' || p.c === 'md-hr') return []; // a code or divider line takes no styling
      else if (p.c === 'md-code' && mark !== '`') {
        if (holds) return []; // code is one piece: styled around, never inside
        if (whole) continue;
        cut = [[a, p.x], [p.y, b]];
      } else if (HOLDS.includes(p.c) && !holds && !whole) cut = [[a, p.x], [Math.max(a, p.cx), Math.min(b, p.cy)], [p.y, b]];
      // an italic can't hold a bold's asterisks, nor a bold an italic's beside its own: they get theirs on their own
      else if (whole && (a !== p.x || b !== p.y) && ((mark === '*' && p.c === 'md-b') || (mark === '**' && p.c === 'md-i' && (a === p.x || b === p.y)))) cut = [[a, p.x], [p.x, p.y], [p.y, b]];
      else continue;
      return cut.flatMap(([s, e]) => (s < e ? pieces(s, e) : []));
    }
    return [[a, b]];
  };

  const segs: [number, number][] = [];
  for (let ls = lineStart(v, el.selectionStart); ls <= el.selectionEnd; ls = lineEnd(v, ls) + 1) {
    const le = lineEnd(v, ls);
    const cs = ls + wordsFrom(v.slice(ls, le));
    let a = Math.max(el.selectionStart, cs), b = Math.min(el.selectionEnd, le);
    if (el.selectionStart === el.selectionEnd) {
      b = a;
      while (a > cs && isWordChar(v[a - 1])) a--;
      while (b < le && isWordChar(v[b])) b++;
    }
    segs.push(...pieces(a, b));
    if (le >= v.length) break;
  }
  if (!segs.length) return false;

  // Off when all of it is styled already (markers don't count, they don't show); otherwise on, for all of it.
  const hidden = new Uint8Array(v.length);
  for (const p of spans) (hidden.fill(1, p.x, p.cx), hidden.fill(1, p.cy, p.y));
  const covered = ([a, b]: [number, number]) => {
    let any = false;
    for (let i = a; i < b; i++) {
      if (hidden[i]) continue;
      if (!own.some((p) => i >= p.cx && i < p.cy)) return false;
      any = true;
    }
    return any;
  };
  const off = segs.every(covered);

  const edits = new Map<number, { del: number; ins: string }>();
  const edit = (at: number, del: number, ins = '') => {
    const e = edits.get(at) ?? { del: 0, ins: '' };
    edits.set(at, { del: Math.max(e.del, del), ins: e.ins + ins });
  };
  const unmark = (p: { x: number; y: number; cx: number; cy: number }) => (edit(p.x, p.cx - p.x), edit(p.cy, p.y - p.cy));
  for (const [a, b] of segs) {
    if (!off) {
      const hit = own.filter((p) => p.x <= b && p.y >= a);
      hit.forEach(unmark);
      edit(Math.min(a, ...hit.map((p) => p.x)), 0, mark);
      edit(Math.max(b, ...hit.map((p) => p.y)), 0, mark);
      continue;
    }
    for (const p of own.filter((q) => q.x < b && q.y > a)) {
      // the part of the span before the selection keeps its markers (not around spaces); with none left, it's gone
      let at = a;
      while (at > p.cx && blank(at - 1)) at--;
      if (at <= p.cx) edit(p.x, p.cx - p.x);
      else edit(at, 0, mark);
      at = b;
      while (at < p.cy && blank(at)) at++;
      if (at >= p.cy) edit(p.cy, p.y - p.cy);
      else edit(at, 0, mark);
    }
  }

  const list = [...edits].sort((x, y) => x[0] - y[0]);
  /** Where a place in the text goes once the edits are made; `after` keeps it past text added right there. */
  const moved = (p: number, after: boolean) => {
    let shift = 0;
    for (const [at, e] of list) {
      if (at > p || (at === p && !after)) break;
      if (at + e.del > p) return at + shift + e.ins.length;
      shift += e.ins.length - e.del;
    }
    return p + shift;
  };
  const lo = list[0][0];
  const hi = Math.max(...list.map(([at, e]) => at + e.del));
  let out = '', pos = lo;
  for (const [at, e] of list) {
    out += v.slice(pos, at) + e.ins;
    pos = Math.max(pos, at + e.del);
  }
  out += v.slice(pos, hi);
  const first = segs[0][0], last = segs[segs.length - 1][1];
  if (out === v.slice(lo, hi)) el.setSelectionRange(first, last);
  else replace(el, lo, hi, out, moved(first, true), moved(last, false));
  return true;
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
  if (e.key !== 'Enter' || e.shiftKey || s !== el.selectionEnd || !kind || s < ls + m[0].length) return false;
  // Enter before an item's (or a heading's) first word opens a plain line above it, and the line stays what it is.
  if (s === ls + m[0].length && line.slice(m[0].length).trim()) {
    replace(el, ls, ls, '\n', s + 1);
    return true;
  }
  if (kind[0] === 'h') return false;
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

/** The character at `i`, two code units long when it's an emoji or another character from beyond the first plane. */
const charAt = (v: string, i: number, back: boolean) =>
  back ? (i >= 2 && /[\uDC00-\uDFFF]/.test(v[i - 1]) && /[\uD800-\uDBFF]/.test(v[i - 2]) ? [i - 2, i] : [i - 1, i])
    : /[\uD800-\uDBFF]/.test(v[i]) && /[\uDC00-\uDFFF]/.test(v[i + 1] ?? '') ? [i, i + 2] : [i, i + 1];

/** Takes out [a, b), and the markers around it as well when that leaves them with nothing between. */
function cutOut(el: TextBox, v: string, a: number, b: number) {
  for (const mark of ['**', '~~', '==', '*', '`']) {
    const n = mark.length;
    if (v.slice(a - n, a) === mark && v.slice(b, b + n) === mark && (mark !== '*' || (v[a - n - 1] !== '*' && v[b + n] !== '*')))
      return replace(el, a - n, b + n, '');
  }
  replace(el, a, b, '');
}

/**
 * Backspace and Delete next to the markers that are hidden while writing (lib/liveMarkdown.ts), so they act on what
 * shows. At the start of a heading, list item or quote, Backspace turns it back into plain text (a nested item steps
 * out a level first); beside a hidden ** or ~~ they take out the letter next to it, not the marker. Returns true when
 * it handled the key.
 */
export function deleteKey(el: TextBox, back: boolean) {
  const v = el.value;
  const s = el.selectionStart;
  if (s !== el.selectionEnd) return false;
  const ranges = hiddenRanges(v);
  const ls = lineStart(v, s);
  const m = v.slice(ls, lineEnd(v, s)).match(PREFIX)!;
  if (back) {
    const head = !!m[2] && ranges.some(([a, b]) => b === s && a === ls + m[1].length);
    if ((m[2] && s === ls + m[0].length) || head) {
      const kind = kindOf(m[2]);
      if (m[1] && (kind === 'ul' || kind === 'ol' || kind === 'task')) indentLines(el, true);
      else {
        // a callout's [!note] goes with its quote marker
        const callout = kind === 'quote' ? v.slice(ls + m[0].length).match(/^\[![\w-]+\][+-]?[ \t]*/)?.[0] ?? '' : '';
        replace(el, ls, ls + m[0].length + callout.length, '');
      }
      return true;
    }
    // past the hidden markers right before the caret, to the letter that shows
    let q = s;
    for (let r = ranges.find(([a, b]) => b === q && a < q); r; r = ranges.find(([a, b]) => b === q && a < q)) q = r[0];
    if (q === s) return false;
    if (q > 0) {
      const [a, b] = charAt(v, q, true);
      cutOut(el, v, a, b);
    }
    return true;
  }
  let q = s;
  for (let r = ranges.find(([a, b]) => a === q && b > q); r; r = ranges.find(([a, b]) => a === q && b > q)) q = r[1];
  if (v[q] === '\n') {
    // joining the next line on: its own marker goes with the line break
    const r = ranges.find(([a]) => a === q + 1);
    if (r) return replace(el, q, r[1], ''), true;
  }
  if (q === s) return false;
  if (q < v.length) {
    const [a, b] = charAt(v, q, false);
    cutOut(el, v, a, b);
  }
  return true;
}

/** Ticks or unticks the task at character `at` of a text box (its hidden marker), leaving the caret where it was. */
export function toggleTaskAt(el: TextBox, at: number, focused: boolean) {
  const v = el.value;
  const i = v.indexOf('[', at);
  if (i < 0 || v[i + 2] !== ']' || !/[ xX]/.test(v[i + 1])) return;
  const c = v[i + 1] === ' ' ? 'x' : ' ';
  if (focused) return replace(el, i + 1, i + 2, c, el.selectionStart, el.selectionEnd);
  el.setRangeText(c, i + 1, i + 2);
  el.dispatchEvent(new Event('input', { bubbles: true }));
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
