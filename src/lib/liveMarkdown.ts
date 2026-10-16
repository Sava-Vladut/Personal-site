// The note's Markdown, styled while it's written: the text stays exactly as typed (every * and # is still there, so
// the caret and the commands work as before), but bold reads bold, headings are big and quotes have their bar. As in
// Word, the markers never show: they're laid out with no width, so the page holds only the words. Bullets and tasks
// keep their marker's text at full size but see-through, with a dot or a box drawn over it, so the caret never sits in
// text that doesn't show.
import { inline as pieces } from './inline';

/** A run of text, or a styled span (class `c`) around more of them. */
export type Deco = string | { c: string; k: Deco[] };

const HR = /^\s*([-*_])([ \t]*\1){2,}\s*$/;
const FENCE = /^\s*(```|~~~)/;
const HEAD = /^(#{1,6}[ \t]+)(.*)$/;
const ITEM = /^([ \t]*)([-*+][ \t]+\[([ xX])\][ \t]+|[-*+][ \t]+|\d{1,9}[.)][ \t]+)(.*)$/;
const QUOTE = /^([ \t]*>[ \t]?)(.*)$/;
const CALLOUT = /^(\[![\w-]+\][+-]?[ \t]*)(.*)$/;

const span = (c: string, ...k: Deco[]): Deco => ({ c, k: k.filter((x) => x !== '') });
const mark = (s: string, c = '') => span('md-mark' + (c && ' ' + c), s);
const wrap = (c: string, m: string, inner: string) => span(c, mark(m), ...inline(inner), mark(m));

// The same inline syntax the reading view shows (lib/inline.ts). Tags and book links stay plain text here: they glow
// in their own colours instead.
function inline(text: string): Deco[] {
  return pieces(text).flatMap((p): Deco[] => {
    switch (p.t) {
      case 'text': return [p.s];
      case 'esc': return [mark('\\'), p.s];
      case 'code': return [span('md-code', mark(p.tick), p.s, mark(p.tick))];
      case 'wiki': case 'person': case 'song': return [p.raw];
      case 'link': return [span('md-link', mark('['), ...inline(p.s), mark(`](${p.url})`, 'md-url'))];
      case 'b': return [wrap('md-b', p.mark, p.s)];
      case 'i': return [wrap('md-i', p.mark, p.s)];
      case 's': return [wrap('md-s', p.mark, p.s)];
      case 'hl': return [wrap('md-hl', p.mark, p.s)];
      case 'empty': return [span('md-empty', p.s)];
      case 'bare': return [span('md-link', p.s)];
      case 'tag': return [span('md-tag', p.s)];
    }
  });
}

function line(l: string, fence: { open: string | null }): Deco[] {
  let m: RegExpMatchArray | null;
  if (fence.open) {
    if (l.trim().startsWith(fence.open)) fence.open = null;
    return [span('md-pre', l)];
  }
  if (FENCE.test(l)) {
    fence.open = l.trim().slice(0, 3);
    return [span('md-pre', l)];
  }
  if (HR.test(l)) return [span('md-hr', l)];
  if ((m = l.match(HEAD))) return [span(`md-h md-h${Math.min(3, m[1].trim().length)}`, mark(m[1]), ...inline(m[2]))];
  if ((m = l.match(ITEM))) {
    const task = m[3] !== undefined;
    const done = /[xX]/.test(m[3] ?? '');
    const rest = inline(m[4]);
    const c = task ? 'md-li-mark md-task-mark' + (done ? ' is-done' : '') : /^\d/.test(m[2]) ? 'md-li-mark md-num' : 'md-li-mark md-bullet';
    // the space after the marker is plain text, so the caret after it (and what's typed there) is in text that shows
    const sym = m[2].trimEnd();
    return [m[1], span(c, sym), m[2].slice(sym.length), ...(done ? [span('md-done', ...rest)] : rest)];
  }
  if ((m = l.match(QUOTE))) {
    const c = m[2].match(CALLOUT);
    // a quote can hold a list, a task or a heading of its own
    return [span('md-quote', mark(m[1]), ...(c ? [mark(c[1], 'md-callout-mark'), ...inline(c[2])] : line(m[2], { open: null })))];
  }
  return inline(l);
}

/** Joins neighbouring runs of text, and drops empty runs and spans, so the same text always comes out the same. */
function tidy(list: Deco[]): Deco[] {
  const out: Deco[] = [];
  for (const d of list) {
    if (d === '') continue;
    const last = out[out.length - 1];
    if (typeof d === 'string' && typeof last === 'string') out[out.length - 1] = last + d;
    else if (typeof d === 'string') out.push(d);
    else {
      const k = tidy(d.k);
      if (k.length) out.push({ c: d.c, k });
    }
  }
  return out;
}

/** Whether pieces have markers (or are a divider): such a line is a span of its own. */
const marked = (list: Deco[]): boolean => list.some((d) => typeof d === 'object' && (/(^| )md-(mark|hr)( |$)/.test(d.c) || marked(d.k)));

let last: { text: string; out: Deco[] } | null = null;

/**
 * A block's text in styled pieces, ending with the line break that keeps its last line open (see editable.ts). A line
 * with markers is a span of its own (class md-line), so typing on it lays out that line again and leaves the rest. The
 * last text asked for is kept, as the editor asks for the same one several times over for each key pressed.
 */
export function decorate(text: string): Deco[] {
  if (last?.text === text) return last.out;
  let out: Deco[] = [];
  if (text) {
    const fence = { open: null as string | null };
    const list: Deco[] = [];
    text.split('\n').forEach((l, i) => {
      if (i) list.push('\n');
      const d = line(l, fence);
      if (marked(d)) list.push(span('md-line', ...d));
      else list.push(...d);
    });
    list.push('\n');
    out = tidy(list);
  }
  last = { text, out };
  return out;
}

/** Where a text's markers are (what's hidden), as [start, end) ranges, with neighbouring ones joined. */
export function hiddenRanges(text: string) {
  const out: [number, number][] = [];
  let at = 0;
  const walk = (list: Deco[], hidden: boolean) => {
    for (const d of list) {
      if (typeof d === 'string') {
        if (hidden && d) {
          const last = out[out.length - 1];
          if (last && last[1] === at) last[1] += d.length;
          else out.push([at, at + d.length]);
        }
        at += d.length;
      } else walk(d.k, hidden || /(^| )md-mark( |$)/.test(d.c));
    }
  };
  walk(decorate(text), false);
  return out;
}

/** A styled span's place in a text: all of it [x, y), and just what's between its markers [cx, cy). */
export interface Span { c: string; x: number; y: number; cx: number; cy: number }

let lastSpans: { text: string; out: Span[] } | null = null;

/** Every styled span in a text (bold, highlight, a link, a code line…), by class `c`, as the editor reads it. */
export function styleSpans(text: string) {
  if (lastSpans?.text === text) return lastSpans.out;
  const out: Span[] = [];
  let at = 0;
  const size = (d: Deco): number => (typeof d === 'string' ? d.length : d.k.reduce((n, k) => n + size(k), 0));
  const marker = (d: Deco | undefined, other: boolean) => (typeof d === 'object' && other && d.c.startsWith('md-mark') ? size(d) : 0);
  const walk = (list: Deco[]) => {
    for (const d of list) {
      if (typeof d === 'string') {
        at += d.length;
        continue;
      }
      const x = at;
      const lead = marker(d.k[0], d.k.length > 1);
      const trail = marker(d.k[d.k.length - 1], d.k.length > 1);
      walk(d.k);
      if (d.c !== 'md-line') out.push({ c: d.c, x, y: at, cx: x + lead, cy: at - trail });
    }
  };
  walk(decorate(text));
  out.sort((a, b) => a.x - b.x || b.y - a.y);
  lastSpans = { text, out };
  return out;
}

/**
 * Where the caret shouldn't come to rest: inside a bullet's or a task's marker (it's drawn over), or inside the hidden
 * markers of a style, a link or a code word, joined where markers meet. A heading's or a quote's marker starts its line,
 * so the place before it is out too (typing there would undo the heading): its range starts at the end of the line
 * above, or at -1 on the first line. As [start, end): only the places strictly between start and end are out.
 */
export function caretStops(text: string) {
  const items: [number, number][] = [];
  for (const p of styleSpans(text)) {
    if (/(^| )(md-bullet|md-task-mark)( |$)/.test(p.c)) items.push([p.x, p.y + (text.slice(p.y).match(/^[ \t]*/)?.[0].length ?? 0)]);
  }
  const hidden = hiddenRanges(text).map(([a, b]): [number, number] =>
    [(!a || text[a - 1] === '\n') && /^(#{1,6}[ \t]|[ \t]*>)/.test(text.slice(a, b)) ? a - 1 : a, b]);
  // a list marker stays apart from a style right after it, so the caret can rest where the item's words start
  return [...items, ...hidden].filter(([a, b]) => b - a > 1).sort((a, b) => a[0] - b[0]);
}
