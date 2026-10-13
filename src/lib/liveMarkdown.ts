// The note's Markdown, styled while it's written: the text stays exactly as typed (every * and # is still there, so
// the caret and the commands work as before), but bold reads bold, headings are big, quotes have their bar, and the
// markers themselves are tucked away: bullets and tasks show a dot or a box in their place, the rest don't show at
// all. lib/editable.ts lays these pieces out as spans in the editable blocks and keeps the caret out of the hidden ones.

/** A run of text, or a styled span (class `c`) around more of them. */
export type Deco = string | { c: string; k: Deco[] };

const HR = /^\s*([-*_])([ \t]*\1){2,}\s*$/;
const FENCE = /^\s*(```|~~~)/;
const HEAD = /^(#{1,6}[ \t]+)(.*)$/;
const ITEM = /^([ \t]*)([-*+][ \t]+\[([ xX])\][ \t]+|[-*+][ \t]+|\d{1,9}[.)][ \t]+)(.*)$/;
const QUOTE = /^([ \t]*>[ \t]?)(.*)$/;
const CALLOUT = /^(\[![\w-]+\][+-]?[ \t]*)(.*)$/;

// The same inline syntax the reading view shows (components/Markdown.tsx). Tags and book links stay plain text here:
// they glow in their own colours instead.
const INLINE = new RegExp(
  [
    /(?<tick>`+)(?<code>[^`\n]+?)\k<tick>/.source,
    /(?<plain>\[\[[^\]\n]+\]\]|@\[[^\]\n]+\]|♪\[[^\]\n]+\])/.source,
    /\[(?<text>[^\]\n]+)\]\((?<url>[^)\s]*)\)/.source,
    /\*\*(?<b>\S(?:[^\n]*?\S)?)\*\*(?!\*)/.source,
    /~~(?<s>\S(?:[^\n]*?\S)?)~~/.source,
    /==(?<hl>\S(?:[^\n]*?\S)?)==/.source,
    /\*(?<i>\S(?:[^*\n]*?\S)?)\*/.source,
    /(?<bare>https?:\/\/[^\s<>]*[^\s<>.,:;"'!?)\]])/.source,
    /(?<pre>^|[\s(])(?<tag>#[\p{L}_][\p{L}\p{N}_/-]*)/u.source,
  ].join('|'),
  'gu',
);

const span = (c: string, ...k: Deco[]): Deco => ({ c, k: k.filter((x) => x !== '') });
const mark = (s: string, c = '') => span('md-mark' + (c && ' ' + c), s);
const wrap = (c: string, m: string, inner: string) => span(c, mark(m), ...inline(inner), mark(m));

function inline(text: string): Deco[] {
  const out: Deco[] = [];
  let at = 0;
  for (const m of text.matchAll(INLINE)) {
    const g = m.groups!;
    const i = m.index!;
    if (i > at) out.push(text.slice(at, i));
    at = i + m[0].length;
    if (g.code !== undefined) out.push(span('md-code', mark(g.tick), g.code, mark(g.tick)));
    else if (g.plain !== undefined) out.push(g.plain);
    else if (g.text !== undefined) out.push(span('md-link', mark('['), ...inline(g.text), mark(`](${g.url})`, 'md-url')));
    else if (g.b !== undefined) out.push(wrap('md-b', '**', g.b));
    else if (g.s !== undefined) out.push(wrap('md-s', '~~', g.s));
    else if (g.hl !== undefined) out.push(wrap('md-hl', '==', g.hl));
    else if (g.i !== undefined) out.push(wrap('md-i', '*', g.i));
    else if (g.bare !== undefined) out.push(span('md-link', g.bare));
    else if (g.tag !== undefined) out.push(g.pre, span('md-tag', g.tag));
  }
  if (at < text.length) out.push(text.slice(at));
  return out;
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
    return [m[1], span(c, m[2]), ...(done ? [span('md-done', ...rest)] : rest)];
  }
  if ((m = l.match(QUOTE))) {
    const c = m[2].match(CALLOUT);
    return [span('md-quote', mark(m[1]), ...(c ? [mark(c[1], 'md-callout-mark'), ...inline(c[2])] : inline(m[2])))];
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

/** The pieces of a styled text that don't show while writing: its Markdown markers (bullets and tasks draw their own). */
const HIDDEN = /(^| )(md-mark|md-bullet|md-task-mark)( |$)/;

/** Where a text's hidden markers are, as [start, end) ranges, with neighbouring ones joined. */
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
      } else walk(d.k, hidden || HIDDEN.test(d.c));
    }
  };
  walk(decorate(text), false);
  return out;
}

/** A styled span's place in a text: all of it [x, y), and just what's between its markers [cx, cy). */
export interface Span { c: string; x: number; y: number; cx: number; cy: number }

/** Every styled span in a text (bold, highlight, a link, a code line…), by class `c`, as the editor reads it. */
export function styleSpans(text: string) {
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
      out.push({ c: d.c, x, y: at, cx: x + lead, cy: at - trail });
    }
  };
  walk(decorate(text));
  return out.sort((a, b) => a.x - b.x || b.y - a.y);
}

/** A block's text in styled pieces, ending with the line break that keeps its last line open (see editable.ts). */
export function decorate(text: string): Deco[] {
  if (!text) return [];
  const fence = { open: null as string | null };
  const out: Deco[] = [];
  text.split('\n').forEach((l, i) => {
    if (i) out.push('\n');
    out.push(...line(l, fence));
  });
  out.push('\n');
  return tidy(out);
}
