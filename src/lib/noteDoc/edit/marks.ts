// Styling words: Bold, Italic, Strikethrough, Highlight and Code from the ribbon and their shortcuts, Clear
// formatting, links (for the link sheet), and the tidy-up of a full stop typed after a tag. Ported from the old
// editor (lib/markdown.ts toggleWrap and wrapAtCaret, components/ribbon/commands.ts clearFormatting): what it did to
// the markers in the text, done with marks here, so markers never cross or show.
import type { Mark, MarkType, Node as PMNode } from '@tiptap/pm/model';
import { TextSelection, type Command, type EditorState, type Transaction } from '@tiptap/pm/state';
import { BARE, SAFE } from '../syntax';
import { isWordChar, lineText, wordAround } from './util';

/** The styles the ribbon toggles, by mark name. */
export type MarkName = 'bold' | 'italic' | 'strike' | 'highlight' | 'code';
/** The marks Clear formatting takes off (links stay links). */
export const CLEARED: readonly MarkName[] = ['bold', 'italic', 'strike', 'highlight', 'code'];

const CHIPS = new Set(['person', 'song', 'wiki']);
const blank = (c: string | undefined) => !c || /\s/.test(c);

interface Range { from: number; to: number }

/** The runs of inline nodes in `block` (starting at `start`) that carry `type`, as positions. */
function runsOf(block: PMNode, start: number, type: MarkType, same?: (m: Mark) => boolean): (Range & { mark: Mark })[] {
  const out: (Range & { mark: Mark })[] = [];
  block.forEach((child, offset) => {
    const mark = type.isInSet(child.marks);
    const last = out[out.length - 1];
    const from = start + offset, to = from + child.nodeSize;
    if (!mark || (same && !same(mark))) return;
    if (last && last.to === from && last.mark.eq(mark)) last.to = to;
    else out.push({ from, to, mark });
  });
  return out;
}

/**
 * Where a style goes in each selected line: the words the selection covers, without spaces at either end (they stay
 * outside the style, as the old markers did). Code blocks take none. Other styles go around code, never inside it: a
 * piece of code the selection only partly covers is left out. Code itself never goes on a chip.
 */
function styleRanges(state: EditorState, type: MarkType, { from, to }: Range = state.selection): Range[] {
  const out: Range[] = [];
  state.doc.nodesBetween(from, to, (node, pos) => {
    if (!node.isTextblock) return true;
    if (node.type.spec.code || !node.type.allowsMarkType(type)) return false;
    const start = pos + 1;
    const text = lineText(node);
    let a = Math.max(from, start), b = Math.min(to, start + node.content.size);
    while (a < b && blank(text[a - start])) a++;
    while (b > a && blank(text[b - start - 1])) b--;
    if (a >= b) return false;
    let pieces: Range[] = [{ from: a, to: b }];
    const cut = (x: Range) => {
      pieces = pieces.flatMap((p) => (x.to <= p.from || x.from >= p.to ? [p] : [{ from: p.from, to: Math.max(p.from, x.from) }, { from: Math.min(p.to, x.to), to: p.to }]));
    };
    if (type.name === 'code') {
      node.forEach((child, offset) => !child.isText && cut({ from: start + offset, to: start + offset + child.nodeSize }));
    } else {
      for (const r of runsOf(node, start, state.schema.marks.code)) if (!(a <= r.from && b >= r.to)) cut(r);
    }
    for (const p of pieces) {
      // a piece cut down to spaces takes no style either
      let x = p.from, y = p.to;
      while (x < y && blank(text[x - start])) x++;
      while (y > x && blank(text[y - start - 1])) y--;
      if (x < y) out.push({ from: x, to: y });
    }
    return false;
  });
  return out;
}

/** Whether every letter and chip in `r` carries `type`. */
function covered(doc: PMNode, r: Range, type: MarkType): boolean {
  let all = true;
  doc.nodesBetween(r.from, r.to, (node) => {
    if (node.isInline && !type.isInSet(node.marks)) all = false;
    return all;
  });
  return all;
}

/** Puts `type` on all of `ranges`, or takes it off when they all have it. The selection stays. */
function toggleOn(state: EditorState, ranges: Range[], type: MarkType): Transaction {
  const tr = state.tr;
  const off = ranges.every((r) => covered(state.doc, r, type));
  for (const r of ranges) {
    if (off) tr.removeMark(r.from, r.to, type);
    else tr.addMark(r.from, r.to, type.create());
  }
  return tr;
}

/**
 * A style from the ribbon or its shortcut, as Word does it. On a selection: on for all of it, or off when it's all
 * styled already; each line's words get it, never the spaces at their ends, and other styles stay around code. With
 * nothing selected: a caret inside a word (or at the start of a styled one) styles the whole word or takes the style off
 * it, and anywhere else the style is set for what's typed next (or unset: at the end of bold words, typing goes on
 * plain). False only where the style can't go (in a code block).
 */
export const toggleMarkSmart = (name: MarkName): Command => (state, dispatch) => {
  const type = state.schema.marks[name];
  const sel = state.selection;
  if (!sel.empty) {
    const ranges = styleRanges(state, type);
    if (!ranges.length) return false;
    dispatch?.(toggleOn(state, ranges, type));
    return true;
  }
  const $c = sel.$from;
  const parent = $c.parent;
  if (!parent.isTextblock || parent.type.spec.code || !parent.type.allowsMarkType(type)) return false;
  const text = lineText(parent);
  const off = $c.parentOffset;
  const inWord = isWordChar(text[off - 1]) && isWordChar(text[off]);
  const atStyled = !!$c.nodeAfter && !!type.isInSet($c.nodeAfter.marks) && isWordChar(text[off]);
  if (inWord || atStyled) {
    const word = wordAround(state);
    const ranges = styleRanges(state, type, word);
    if (ranges.length) {
      dispatch?.(toggleOn(state, ranges, type));
      return true;
    }
  }
  const marks = state.storedMarks ?? $c.marks();
  dispatch?.(state.tr.setStoredMarks(type.isInSet(marks) ? type.removeFromSet(marks) : type.create().addToSet(marks)));
  return true;
};

/**
 * Clear formatting, as in Word: bold, italic, strike, highlight and code come off the selected words, the whole of
 * each styled run the selection touches; with nothing selected, off the word at the caret (and off what's typed next).
 * Links stay links. False when there was nothing to clear.
 */
export const clearFormatting: Command = (state, dispatch) => {
  const sel = state.selection;
  let { from, to } = sel;
  if (sel.empty) ({ from, to } = wordAround(state));
  const tr = state.tr;
  const types = CLEARED.map((n) => state.schema.marks[n]);
  const blocks: { node: PMNode; pos: number }[] = [];
  if (from === to) {
    const $p = state.doc.resolve(from);
    if ($p.parent.isTextblock) blocks.push({ node: $p.parent, pos: $p.before() });
  } else {
    state.doc.nodesBetween(from, to, (node, pos) => {
      if (node.isTextblock) blocks.push({ node, pos });
      return !node.isTextblock;
    });
  }
  for (const { node, pos } of blocks) {
    for (const type of types) {
      for (const r of runsOf(node, pos + 1, type)) {
        const hit = from === to ? r.from <= from && from <= r.to : r.from < to && r.to > from;
        if (hit) tr.removeMark(r.from, r.to, type);
      }
    }
  }
  if (sel.empty) {
    const marks = state.storedMarks ?? sel.$from.marks();
    const kept = marks.filter((m) => !types.includes(m.type));
    if (kept.length !== marks.length) tr.setStoredMarks(kept);
  }
  if (!tr.docChanged && !tr.storedMarksSet) return false;
  dispatch?.(tr);
  return true;
};

/* ---------- links ---------- */

/** What the link sheet edits: a range of the text, its words, and its address when it's a link already. */
export interface LinkTarget extends Range {
  text: string;
  /** the link's address, null when the range isn't a link yet */
  href: string | null;
}

/** The link run around `pos` in its line (the one after it first), or null. */
function linkRunAt(state: EditorState, pos: number): (Range & { mark: Mark }) | null {
  const $p = state.doc.resolve(pos);
  if (!$p.parent.isTextblock) return null;
  const type = state.schema.marks.link;
  const runs = runsOf($p.parent, $p.start(), type);
  return runs.find((r) => r.from <= pos && pos < r.to) ?? runs.find((r) => r.from < pos && pos <= r.to) ?? null;
}

/**
 * What a link command acts on: the link the caret (or the whole selection) is in, else the selection, else the word
 * the caret is inside, else just the caret (a new link's words are typed in the sheet).
 */
export function linkAt(state: EditorState): LinkTarget {
  const { from, to, empty, $from } = state.selection;
  const run = linkRunAt(state, from);
  if (run && (empty || (to <= run.to && $from.parent === state.selection.$to.parent))) {
    return { from: run.from, to: run.to, text: state.doc.textBetween(run.from, run.to, undefined, '￼'), href: run.mark.attrs.href };
  }
  if (!empty) return { from, to, text: state.doc.textBetween(from, to, ' ', '￼'), href: null };
  const text = $from.parent.isTextblock ? lineText($from.parent) : '';
  const off = $from.parentOffset;
  const r = isWordChar(text[off - 1]) && isWordChar(text[off]) ? wordAround(state) : { from, to: from };
  return { ...r, text: state.doc.textBetween(r.from, r.to), href: null };
}

/** An address as typed in the link sheet, made one that opens: `example.com` is a web address. */
export function normalizeHref(href: string): string {
  const h = href.trim().replace(/\s/g, '%20');
  if (!h || /^[a-z][\w+.-]*:/i.test(h) || /^[#/?]/.test(h)) return h;
  if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(h)) return 'mailto:' + h;
  return 'https://' + h;
}

/**
 * The link sheet's Done: the words of the link at the caret (or of the selection, or the word) become `text`, linked
 * to `href`. Unchanged words keep their own styles. With no words, the address is shown. An empty address takes the
 * link off. The caret goes after the link.
 */
export const setLink = ({ text, href }: { text?: string; href: string }): Command => (state, dispatch) => {
  const t = linkAt(state);
  const url = normalizeHref(href);
  if (!url) return removeLink(state, dispatch);
  const $f = state.doc.resolve(t.from);
  if (!$f.parent.isTextblock || $f.parent.type.spec.code || $f.parent !== state.doc.resolve(t.to).parent) return false;
  const words = text ?? t.text;
  const shown = words || (t.text || url);
  const type = state.schema.marks.link;
  // written as the address alone only when nothing runs into it (else as [address](address))
  const next = state.doc.textBetween(t.to, Math.min(t.to + 1, $f.end()), undefined, '￼');
  const prev = state.doc.textBetween(Math.max(t.from - 1, $f.start()), t.from, undefined, '￼');
  const bare = shown === url && BARE.test(url) && SAFE.test(url) && !/\S/.test(next) && !/[\w/:]/.test(prev);
  const link = type.create({ href: url, bare });
  if (!dispatch) return true;
  const tr = state.tr;
  let end = t.to;
  if (shown === t.text && t.from < t.to) {
    // on the words only: a chip can't sit inside a link's [words]
    tr.removeMark(t.from, t.to, type);
    state.doc.nodesBetween(t.from, t.to, (node, pos) => {
      if (node.isText) tr.addMark(Math.max(pos, t.from), Math.min(pos + node.nodeSize, t.to), link);
    });
  } else {
    // new words: they take the styles of the first letter they replace (or of the caret), not its link or escape
    const first = t.from < t.to ? state.doc.nodeAt(t.from) : null;
    const marks = (first?.marks ?? state.storedMarks ?? $f.marks()).filter((m) => m.type !== type && m.type.name !== 'escaped' && m.type.name !== 'code');
    tr.replaceWith(t.from, t.to, state.schema.text(shown, link.addToSet(marks)));
    end = t.from + shown.length;
  }
  tr.setSelection(TextSelection.create(tr.doc, end));
  dispatch(tr.scrollIntoView());
  return true;
};

/** Takes the link off the words at the caret (all of that link) or off the selection. False when there's none. */
export const removeLink: Command = (state, dispatch) => {
  const { from, to, empty } = state.selection;
  const type = state.schema.marks.link;
  const run = linkRunAt(state, from);
  let a = from, b = to;
  if (run) (a = Math.min(a, run.from)), (b = Math.max(b, run.to));
  if (empty && !run) return false;
  if (!empty && !state.doc.rangeHasMark(a, b, type)) return false;
  dispatch?.(state.tr.removeMark(a, b, type));
  return true;
};

/* ---------- after a tag ---------- */

/**
 * A full stop, comma… typed just after a tag (a chip and the space it came with) takes the place of the space:
 * `@[Ann] ` + `.` → `@[Ann].` For handleTextInput: true when it did.
 */
export const tidyAfterTag = (typed: string): Command => (state, dispatch) => {
  if (!/^[.,!?;:)]$/.test(typed)) return false;
  const { $from, empty } = state.selection;
  if (!empty || !$from.parent.isTextblock) return false;
  const before = $from.nodeBefore;
  if (!before?.isText || !before.text!.endsWith(' ')) return false;
  const chip = state.doc.resolve($from.pos - 1).nodeBefore;
  if (!chip || !CHIPS.has(chip.type.name)) return false;
  dispatch?.(state.tr.insertText(typed, $from.pos - 1, $from.pos));
  return true;
};
