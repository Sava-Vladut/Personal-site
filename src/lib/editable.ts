// The note's words are written in plain-text editable blocks rather than textareas: a textarea is a box of its own,
// so text in it can never wrap around a picture beside it. This gives such a block the bits of the textarea API the
// Markdown commands use (value, selection, replacing text), so they work on either. Its text is laid out in spans
// that style the Markdown as it's written (lib/liveMarkdown.ts); reading it back only ever sees the characters.
import { History, type Kind, type Snap } from './history';
import { caretStops, decorate, type Deco } from './liveMarkdown';
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

/** Whether a text node is part of a Markdown marker (lib/liveMarkdown.ts). */
const inMark = (n: Node) => !!n.parentElement?.closest?.('.md-mark, .md-li-mark');

/**
 * The DOM point at character `pos` of a block. Where two pieces meet, the caret stays with the text before (so typing
 * at the end of a bold word goes on in bold), unless that's a marker or a line break and visible text on the same line
 * starts there: then it goes with that (so typing after a closing ** is plain, and a line starts after its marker).
 */
function locate(el: HTMLElement, pos: number): [Node, number] {
  let at = 0;
  let newline = false;
  let edge: [Node, number] | null = null; // the end of a marker (or a line break) right at `pos`
  let broke = false;
  const tw = document.createTreeWalker(el, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
  for (let n = tw.nextNode(); n; n = tw.nextNode()) {
    if (n.nodeType === Node.TEXT_NODE) {
      const data = (n as Text).data;
      const len = data.length;
      if (edge) {
        if (!len) continue;
        // after a line break, whatever starts the next line; after a marker, the visible text after it on the line
        return broke || (data[0] !== '\n' && !inMark(n)) ? [n, 0] : edge;
      }
      if (pos >= at && pos <= at + len) {
        if (!len || pos < at + len || (!inMark(n) && !data.endsWith('\n'))) return [n, pos - at];
        edge = [n, len];
        broke = data.endsWith('\n');
      } else if (pos < at) break;
      at += len;
      if (len) newline = data.endsWith('\n');
    } else if (n.nodeName === 'BR') {
      if (edge) return edge;
      if (pos <= at) return [n.parentNode!, [...n.parentNode!.childNodes].indexOf(n as ChildNode)];
      at += 1;
      newline = true;
    } else if (isBlock(n) && at && !newline) {
      if (edge) return edge;
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

type Direction = 'forward' | 'backward' | 'none';
interface Sel { start: number; end: number; direction: Direction }

export class Editable implements TextBox {
  /** The selection when it was last in this block (only the block's own caret handling changes it). */
  private last: Sel = { start: 0, end: 0, direction: 'none' };
  /** Where the caret was when it last came to rest, and the text then: which way it's moving, and whether it was typing. */
  private was = -1;
  private seen = '';
  private commands = 0;
  /** Undo and redo (lib/history.ts). */
  readonly history = new History();
  constructor(readonly el: HTMLElement) {}

  get value() {
    return read(this.el).text;
  }
  set value(v: string) {
    fill(this.el, v);
    this.last = { ...this.last, start: Math.min(this.last.start, v.length), end: Math.min(this.last.end, v.length) };
  }

  /** The selection, when it's in this block. Reading it changes nothing. */
  private live(): Sel | null {
    const s = getSelection();
    if (!s || !s.rangeCount || !this.el.contains(s.anchorNode)) return null;
    const r = s.getRangeAt(0);
    if (!this.el.contains(r.startContainer) || !this.el.contains(r.endContainer)) return null;
    return {
      start: read(this.el, { node: r.startContainer, offset: r.startOffset }).found,
      end: read(this.el, { node: r.endContainer, offset: r.endOffset }).found,
      direction: r.collapsed ? 'none' : s.anchorNode === r.endContainer && s.anchorOffset === r.endOffset ? 'backward' : 'forward',
    };
  }
  /** The selection, when it's in this block; otherwise where it was when it last was. */
  private sel() {
    return this.live() ?? this.last;
  }
  get selectionStart() {
    return this.sel().start;
  }
  get selectionEnd() {
    return this.sel().end;
  }

  /** Selects characters [start, end), by where they are in the text. Leaves a selection that's there already alone. */
  setSelectionRange(start: number, end: number, direction: Direction = 'none') {
    const len = this.value.length;
    start = Number.isFinite(start) ? Math.max(0, Math.min(Math.trunc(start), len)) : 0;
    end = Number.isFinite(end) ? Math.max(start, Math.min(Math.trunc(end), len)) : start;
    const s = getSelection();
    if (s) {
      const a = locate(this.el, start);
      const b = end === start ? a : locate(this.el, end);
      const [anchor, focus] = direction === 'backward' ? [b, a] : [a, b];
      if (s.anchorNode !== anchor[0] || s.anchorOffset !== anchor[1] || s.focusNode !== focus[0] || s.focusOffset !== focus[1]) {
        if (s.setBaseAndExtent) s.setBaseAndExtent(anchor[0], anchor[1], focus[0], focus[1]);
        else {
          const r = document.createRange();
          r.setStart(...a);
          r.setEnd(...b);
          s.removeAllRanges();
          s.addRange(r);
        }
      }
    }
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
   * After the selection moved: lets a caret that came to rest inside a bullet's or a task's marker, or in the hidden
   * markers of a heading, a quote or a style, go on out of it — the way it was going, or else to after it. It only
   * ever moves the caret to a place it can stay, so it never goes back and forth.
   */
  settle() {
    const now = document.activeElement === this.el ? this.live() : null;
    if (!now) {
      this.was = -1;
      return;
    }
    const v = this.value;
    let p = now.start;
    // only a caret that moved: typing leaves it where the letters went
    if (now.start === now.end && v === this.seen) {
      const r = caretStops(v).find(([a, b]) => p > a && p < b);
      if (r) {
        // back out of a heading's or a quote's marker is the end of the line above (there's none above the first)
        p = this.was === r[1] && r[0] >= 0 ? r[0] : r[1];
        this.setSelectionRange(p, p);
      }
    }
    if (p === now.start) this.last = now;
    this.was = p;
    this.seen = v;
  }

  /**
   * Lays the block out again as its styled text (whatever the browser's editing left in it). Only the lines whose
   * styling changed are replaced; the caret is put back by where it is in the text, and only if that moved.
   */
  tidy() {
    const focused = document.activeElement === this.el;
    const at = this.sel();
    if (fill(this.el, this.value) && focused) {
      const now = this.live();
      if (!now || now.start !== at.start || now.end !== at.end) this.setSelectionRange(at.start, at.end, at.direction);
    }
  }

  private snap(): Snap {
    const s = this.sel();
    return { text: this.value, start: s.start, end: s.end };
  }
  /** Before the text changes (typing, a paste…): where the change starts from, for undo. */
  before() {
    if (!this.commands) this.history.before(this.snap());
  }
  /** After the text changed: the change, for undo. */
  record(kind: Kind) {
    this.history.after(this.snap(), this.commands ? 'other' : kind);
  }
  /** A command that changes the text (lib/markdown.ts): a step of its own to undo, apart from the typing around it. */
  edit(change: () => void) {
    if (!this.commands) this.history.before(this.snap());
    this.commands++;
    try {
      change();
    } finally {
      this.commands--;
    }
    if (!this.commands) this.history.cut();
  }
  undo() {
    return this.restore(this.history.undo(this.snap()));
  }
  redo() {
    return this.restore(this.history.redo(this.snap()));
  }
  private restore(s: Snap | null) {
    if (!s) return false;
    this.value = s.text;
    if (document.activeElement === this.el) this.setSelectionRange(s.start, s.end);
    else this.last = { start: s.start, end: s.end, direction: 'none' };
    this.seen = s.text;
    return true;
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
