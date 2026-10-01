// The note's Markdown, styled while it's written: the text stays exactly as typed (every * and # is still there, so
// the caret and the commands work as before), but bold reads bold, headings are big, quotes have their bar and the
// markers fade back. lib/editable.ts lays these pieces out as spans in the editable blocks.

/** A run of text, or a styled span (class `c`) around more of them. */
export type Deco = string | { c: string; k: Deco[] };

const HR = /^\s*([-*_])([ \t]*\1){2,}\s*$/;
const FENCE = /^\s*(```|~~~)/;
const HEAD = /^(#{1,6}[ \t]+)(.*)$/;
const ITEM = /^([ \t]*)([-*+][ \t]+\[([ xX])\][ \t]+|[-*+][ \t]+|\d{1,9}[.)][ \t]+)(.*)$/;
const QUOTE = /^([ \t]*>[ \t]?)(.*)$/;
const CALLOUT = /^(\[![\w-]+\][+-]?)(.*)$/;

// The same inline syntax the reading view shows (components/Markdown.tsx). Tags and book links stay plain text here:
// they glow in their own colours instead.
const INLINE = new RegExp(
  [
    /(?<tick>`+)(?<code>[^`\n]+?)\k<tick>/.source,
    /(?<plain>\[\[[^\]\n]+\]\]|@\[[^\]\n]+\]|♪\[[^\]\n]+\])/.source,
    /\[(?<text>[^\]\n]+)\]\((?<url>[^)\s]*)\)/.source,
    /\*\*(?<b>\S(?:[^\n]*?\S)?)\*\*/.source,
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
    const rest = inline(m[4]);
    return [m[1], span(task ? 'md-li-mark md-task-mark' : 'md-li-mark', m[2]), ...(/[xX]/.test(m[3] ?? '') ? [span('md-done', ...rest)] : rest)];
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
