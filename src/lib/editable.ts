// The note's words are written in plain-text editable blocks rather than textareas: a textarea is a box of its own,
// so text in it can never wrap around a picture beside it. This gives such a block the bits of the textarea API the
// Markdown commands use (value, selection, replacing text), so they work on either. Its text is laid out in spans
// that style the Markdown as it's written (lib/liveMarkdown.ts); reading it back only ever sees the characters.
import { decorate, hiddenRanges, type Deco } from './liveMarkdown';
import type { TextBox } from './markdown';

/** Browsers without plain-text editing (Firefox before 136) get rich editing, kept to plain text by the editor. */
export const PLAIN = (() => {
  try {
    const d = document.createElement('div');
    d.contentEditable = 'plaintext-only';
    return d.contentEditable === 'plaintext-only';
  } catch {
    return false;
  }
})();

const isBlock = (n: Node) => n.nodeName === 'DIV' || n.nodeName === 'P';

/**
 * The text of a block. Lines are text with \n in it, or <br>s and <div>s when a browser edits that way. A line break at
 * the very end doesn't show (it only holds an empty last line open, which is why browsers add one after a line break
 * typed at the end), so it adds nothing. With `at`, also where that DOM point falls in it.
 */
function read(el: HTMLElement, at?: { node: Node; offset: number }) {
  let text = '';
  let found = -1;
  let tail = false; // the last thing is a line break
  const walk = (n: Node) => {
    const kids = n.childNodes;
    for (let i = 0; i <= kids.length; i++) {
      if (at && found < 0 && at.node === n && at.offset === i) found = text.length;
      const c = kids[i];
      if (!c) break;
      if (c.nodeType === Node.TEXT_NODE) {
        const data = (c as Text).data;
        if (at && found < 0 && at.node === c) found = text.length + Math.min(at.offset, data.length);
        text += data;
        if (data) tail = data.endsWith('\n');
      } else if (c.nodeName === 'BR') {
        text += '\n';
        tail = true;
      } else if (c.nodeType === Node.ELEMENT_NODE) {
        if (isBlock(c) && text && !text.endsWith('\n')) text += '\n';
        walk(c);
      }
    }
  };
  walk(el);
  if (tail) text = text.slice(0, -1);
  return { text, found: found < 0 ? text.length : Math.min(found, text.length) };
}

/** Whether a text node is a Markdown marker that's tucked away while writing (lib/liveMarkdown.ts). */
function hiddenText(n: Node) {
  const p = n.nodeType === Node.TEXT_NODE ? n.parentElement : null;
  if (!p?.closest?.('.md-mark, .md-bullet, .md-task-mark') || typeof getComputedStyle !== 'function') return false;
  return getComputedStyle(p).fontSize === '0px';
}

/**
 * The DOM point at character `pos` of a block. Where two pieces meet, a hidden marker's edge gives way to the visible
 * text beside it, so the caret takes that text's size and style.
 */
function locate(el: HTMLElement, pos: number): [Node, number] {
  let at = 0;
  let newline = false;
  let edge: [Node, number] | null = null;
  const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  for (let n = tw.nextNode(); n; n = tw.nextNode()) {
    if (n.nodeType === Node.TEXT_NODE) {
      const len = (n as Text).data.length;
      if (pos <= at + len && pos >= at) {
        if (!len || (pos > at && pos < at + len) || !hiddenText(n)) return [n, pos - at];
        edge ??= [n, pos - at];
      } else if (pos < at) break;
      at += len;
      if (len) newline = (n as Text).data.endsWith('\n');
    } else if (n.nodeName === 'BR') {
      if (pos <= at) return [n.parentNode!, [...n.parentNode!.childNodes].indexOf(n as ChildNode)];
      at += 1;
      newline = true;
    } else if (isBlock(n) && at && !newline) {
      // Safari can create nested line blocks. Match the implicit newline that read() adds
      // before each block, so selections and tag highlight ranges use the same offsets.
      if (pos <= at) return [n.parentNode!, [...n.parentNode!.childNodes].indexOf(n as ChildNode)];
      at++;
      newline = true;
    }
  }
  if (edge) return edge;
  const last = el.lastChild;
  return [el, el.childNodes.length - (last?.nodeName === 'BR' ? 1 : 0)];
}

/** One letter on from `i` (back, with -1), a whole emoji at once; never across a line break. */
function step(v: string, i: number, dir: 1 | -1) {
  const c = dir > 0 ? v[i] : v[i - 1];
  if (c === undefined || c === '\n') return i;
  const pair = dir > 0 ? /[\uD800-\uDBFF]/.test(c) : /[\uDC00-\uDFFF]/.test(c);
  return i + dir * (pair ? 2 : 1);
}

const lineHead = (v: string, i: number) => /^[ \t]*$/.test(v.slice(v.lastIndexOf('\n', i - 1) + 1, i));

/** Whether a node already shows a piece of the styled text. */
const same = (n: Node | undefined, d: Deco): boolean =>
  !!n && (typeof d === 'string'
    ? n.nodeType === Node.TEXT_NODE && (n as Text).data === d
    : n.nodeName === 'SPAN' && (n as HTMLElement).className === d.c && n.childNodes.length === d.k.length && d.k.every((x, i) => same(n.childNodes[i], x)));

function build(d: Deco): Node {
  if (typeof d === 'string') return document.createTextNode(d);
  const el = document.createElement('span');
  el.className = d.c;
  for (const k of d.k) el.append(build(k));
  return el;
}

/**
 * Puts `text` in a block, styled as Markdown, with the line break that makes the last line show (see `read`). Only
 * the pieces that differ are replaced, so typing inside a word leaves the browser's own nodes (and its undo, and the
 * phone's autocorrect) alone. Returns whether anything changed.
 */
function fill(el: HTMLElement, text: string) {
  const want = decorate(text);
  const kids = [...el.childNodes];
  if (want.length < 2 && typeof want[0] !== 'object') {
    if (kids.length === want.length && (!want.length || same(kids[0], want[0]))) return false;
    el.textContent = want[0] ?? '';
    return true;
  }
  let a = 0;
  while (a < kids.length && a < want.length && same(kids[a], want[a])) a++;
  if (a === kids.length && a === want.length) return false;
  let z = 0;
  while (z < kids.length - a && z < want.length - a && same(kids[kids.length - 1 - z], want[want.length - 1 - z])) z++;
  const before = z ? kids[kids.length - z] : null;
  for (const n of kids.slice(a, kids.length - z)) el.removeChild(n);
  for (const d of want.slice(a, want.length - z)) el.insertBefore(build(d), before);
  return true;
}

export class Editable implements TextBox {
  private last: { start: number; end: number; direction: 'forward' | 'backward' | 'none' } = { start: 0, end: 0, direction: 'none' };
  constructor(readonly el: HTMLElement) {}

  get value() {
    return read(this.el).text;
  }
  set value(v: string) {
    fill(this.el, v);
    this.last = { ...this.last, start: Math.min(this.last.start, v.length), end: Math.min(this.last.end, v.length) };
  }

  /** The selection, when it's in this block; otherwise where it was when it last was. */
  private sel() {
    const s = getSelection();
    if (s && s.rangeCount && this.el.contains(s.anchorNode)) {
      const r = s.getRangeAt(0);
      if (this.el.contains(r.startContainer) && this.el.contains(r.endContainer)) {
        this.last = {
          start: read(this.el, { node: r.startContainer, offset: r.startOffset }).found,
          end: read(this.el, { node: r.endContainer, offset: r.endOffset }).found,
          direction: r.collapsed ? 'none' : s.anchorNode === r.endContainer && s.anchorOffset === r.endOffset ? 'backward' : 'forward',
        };
      }
    }
    return this.last;
  }
  get selectionStart() {
    return this.sel().start;
  }
  get selectionEnd() {
    return this.sel().end;
  }

  setSelectionRange(start: number, end: number, direction: 'forward' | 'backward' | 'none' = 'none') {
    const len = this.value.length;
    start = Number.isFinite(start) ? Math.max(0, Math.min(Math.trunc(start), len)) : 0;
    end = Number.isFinite(end) ? Math.max(start, Math.min(Math.trunc(end), len)) : start;
    const r = document.createRange();
    r.setStart(...locate(this.el, start));
    r.setEnd(...locate(this.el, end));
    const s = getSelection();
    s?.removeAllRanges();
    s?.addRange(r);
    if (direction === 'backward' && s?.setBaseAndExtent) s.setBaseAndExtent(r.endContainer, r.endOffset, r.startContainer, r.startOffset);
    this.last = { start, end, direction };
  }

  setRangeText(text: string, start = this.selectionStart, end = this.selectionEnd) {
    const v = this.value;
    this.value = v.slice(0, start) + text + v.slice(end);
  }

  /** A range over characters [start, end), to measure where they sit on screen. */
  range(start: number, end: number) {
    const len = this.value.length;
    start = Number.isFinite(start) ? Math.max(0, Math.min(Math.trunc(start), len)) : 0;
    end = Number.isFinite(end) ? Math.max(start, Math.min(Math.trunc(end), len)) : start;
    const r = document.createRange();
    r.setStart(...locate(this.el, start));
    r.setEnd(...locate(this.el, end));
    return r;
  }

  /** Where a node inside the block starts, in characters. */
  offsetOf(node: Node) {
    return read(this.el, { node, offset: 0 }).found;
  }

  /**
   * Keeps a caret out of the hidden markers. One that lands inside them goes on to the text the way it was moving (or
   * back), and always after a line's own marker — so typing at the start of a heading or a list item stays in it.
   */
  settle() {
    const s = getSelection();
    const n = s?.anchorNode;
    if (!s || !n || document.activeElement !== this.el || !this.el.contains(n)) return this.reveal(null);
    // a link shows its address while the caret is in it
    this.reveal((n.nodeType === Node.ELEMENT_NODE ? (n as Element) : n.parentElement)?.closest?.('.md-link') ?? null);
    if (!s.isCollapsed) return;
    const was = this.last.start;
    if (!hiddenText(n)) return void this.sel();
    const v = this.value;
    const p = read(this.el, { node: n, offset: s.anchorOffset }).found;
    const r = hiddenRanges(v).find(([a, b]) => p >= a && p <= b);
    let to = p;
    if (r) {
      const [a, b] = r;
      const ls = v.lastIndexOf('\n', a - 1) + 1;
      // arrowing back out of a line's marker goes on to the end of the line above
      if (lineHead(v, a)) to = was === b && p < b && ls > 0 ? ls - 1 : b;
      // an arrow press that only stepped into hidden markers goes on one letter more, so every press moves
      else if (p > a && p < b) to = was === a ? step(v, b, 1) : was === b ? step(v, a, -1) : was < p ? b : a;
    }
    const [node] = locate(this.el, to);
    if (to === p && (node === n || hiddenText(node))) return void this.sel();
    this.setSelectionRange(to, to);
  }

  private reveal(link: Element | null) {
    for (const l of this.el.querySelectorAll?.('.md-link[data-active]') ?? []) if (l !== link) l.removeAttribute('data-active');
    if (link && this.el.contains(link) && !link.hasAttribute('data-active')) link.setAttribute('data-active', '');
  }

  /** Lays the block out again as its styled text (whatever the browser's editing left in it), keeping the caret. */
  tidy() {
    const focused = document.activeElement === this.el;
    const at = this.sel();
    if (fill(this.el, this.value) && focused) this.setSelectionRange(at.start, at.end, at.direction);
  }

  focus(o?: FocusOptions) {
    this.el.focus(o);
  }
  dispatchEvent(e: Event) {
    return this.el.dispatchEvent(e);
  }
}

const boxes = new WeakMap<HTMLElement, Editable>();
export function editable(el: HTMLElement) {
  let b = boxes.get(el);
  if (!b) boxes.set(el, (b = new Editable(el)));
  return b;
}
