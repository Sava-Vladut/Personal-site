// Two ribbon commands lib/markdown.ts doesn't have: Clear formatting and the Normal style, both built on its
// replace(), so each is one step to undo like the rest. And what keeps the caret in the text while the toolbar's tapped.
import { styleSpans } from '../../lib/liveMarkdown';
import { replace, type TextBox } from '../../lib/markdown';

const lineStart = (v: string, i: number) => (i <= 0 ? 0 : v.lastIndexOf('\n', i - 1) + 1);
const lineEnd = (v: string, i: number) => {
  const n = v.indexOf('\n', i);
  return n < 0 ? v.length : n;
};
const isWordChar = (c: string | undefined) => !!c && /[\p{L}\p{N}_'’-]/u.test(c);

/** Takes the cut-out ranges (sorted, apart) out of [lo, hi) of the text and selects where `a` and `b` end up. */
function cutOut(el: TextBox, cuts: [number, number][], a: number, b: number) {
  const v = el.value;
  const lo = cuts[0][0], hi = cuts[cuts.length - 1][1];
  let out = '', pos = lo;
  for (const [x, y] of cuts) {
    out += v.slice(pos, x);
    pos = y;
  }
  out += v.slice(pos, hi);
  const moved = (i: number) => {
    let gone = 0;
    for (const [x, y] of cuts) {
      if (i >= y) gone += y - x;
      else if (i > x) return x - gone;
    }
    return i - gone;
  };
  replace(el, lo, hi, out, moved(a), moved(b));
}

/** The inline styles Clear formatting takes off (links stay links). */
const INLINE = ['md-b', 'md-i', 'md-s', 'md-hl', 'md-code'];

/**
 * Clear formatting, as in Word: takes bold, italic, strike, highlight and code off the selected words — the whole of
 * each styled run the selection touches — or off the word at the caret. Returns false when there was nothing to clear.
 */
export function clearFormatting(el: TextBox) {
  const v = el.value;
  const a = el.selectionStart, b = el.selectionEnd;
  let s = a, e = b;
  if (s === e) {
    while (s > 0 && isWordChar(v[s - 1])) s--;
    while (e < v.length && isWordChar(v[e])) e++;
  }
  const hit = styleSpans(v).filter((p) => INLINE.includes(p.c) && (s === e ? p.cx <= s && s <= p.cy : p.x < e && p.y > s));
  if (!hit.length) return false;
  const cuts = new Map<number, number>();
  for (const p of hit) {
    if (p.cx > p.x) cuts.set(p.x, p.cx);
    if (p.y > p.cy) cuts.set(p.cy, p.y);
  }
  if (!cuts.size) return false;
  cutOut(el, [...cuts].sort((x, y) => x[0] - y[0]), a, b);
  return true;
}

/** A heading's #s, or a quote's (or a callout's) marker, at the start of a line. */
const BLOCK = /^[ \t]*(?:#{1,6}[ \t]+|>[ \t]?(?:\[![\w-]+\][+-]?[ \t]*)?)/;

/**
 * The Normal style: the selected lines (or the caret's) stop being headings, quotes or callouts and become plain
 * text again. Lists stay lists. Returns false when they were plain already.
 */
export function setNormal(el: TextBox) {
  const v = el.value;
  const a = el.selectionStart, b = el.selectionEnd;
  const s = lineStart(v, a);
  const e = lineEnd(v, b > a && v[b - 1] === '\n' ? b - 1 : b);
  const cuts: [number, number][] = [];
  let pos = s;
  for (const line of v.slice(s, e).split('\n')) {
    const m = line.match(BLOCK);
    if (m && m[0]) cuts.push([pos, pos + m[0].length]);
    pos += line.length + 1;
  }
  if (!cuts.length) return false;
  cutOut(el, cuts, a, b);
  return true;
}

export const keepFocus = {
  // Keep the text box focused (and the phone keyboard up) while tapping any button of the bar, the add buttons
  // passed in as children too. Safari doesn't focus a tapped button, so the text box losing the focus would read as
  // "not writing" and put the bar away (inert) before the tap's click arrived.
  onPointerDown: (e: PointerEvent) => e.preventDefault(),
  onMouseDown: (e: MouseEvent) => e.preventDefault(),
};
