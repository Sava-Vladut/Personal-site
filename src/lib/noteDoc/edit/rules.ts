// Markdown typed at the start of a line becomes the block it writes, as in Obsidian and Notion: "# " a heading, "- "
// a bullet, "1. " a numbered item, "[] " a task (also in a bullet), "> " a quote, "[!note] " on a quote's first line a
// callout, "---" a divider, "```js " a code block, "[^1]: " a footnote's text. The rules are pure: each changes a transaction and says whether it
// did, so the browser layer can wrap them in Tiptap's InputRule ({ find, handler: ({ state, range, match }) =>
// rule.apply(state.tr, match, range.from, range.to) || null }) or ProseMirror's (new InputRule(find, (state, match,
// start, end) => { const tr = state.tr; return rule.apply(tr, match, start, end) ? tr : null })).
//
// As with both: the character just typed (the last of the match) isn't in the document yet, and [start, end) is the
// rest of the match there. Backspace straight after undoes a rule (undoInputRule). Not in code.
import { NodeRange, type Node as PMNode } from '@tiptap/pm/model';
import { TextSelection, type EditorState, type Transaction } from '@tiptap/pm/state';
import { findWrapping } from '@tiptap/pm/transform';
import type { ListItemAttrs } from '../schema';
import { AUTOCORRECT } from './autocorrect';
import { LEAF, replaceSelectionText } from './util';

export interface BlockRule {
  name: string;
  /** matched against the line's text before the caret plus what was typed (ends with `$`) */
  find: RegExp;
  apply(tr: Transaction, match: RegExpMatchArray, start: number, end: number): boolean;
}

/** Spaces and tabs as an indent (an iOS non-breaking space counts as a space). */
const indentOf = (s: string | undefined) => (s ?? '').replace(/[^\t]/g, ' ');

/** The textblock [start, end) is in, when it's at its very start: the node and the position before it. */
function lineAt(tr: Transaction, start: number, names: string[]): { node: PMNode; pos: number } | null {
  const $s = tr.doc.resolve(start);
  if ($s.parentOffset !== 0 || !names.includes($s.parent.type.name)) return null;
  return { node: $s.parent, pos: $s.before() };
}

const item = (attrs: Partial<ListItemAttrs>): Partial<ListItemAttrs> => ({
  kind: 'ul', indent: '', bullet: '-', num: '1', delim: '.', checked: false, check: ' ', gap: ' ', sep: ' ', ...attrs,
});

/** Turns the line at [start, end) into a list item with `attrs`, its marker taken out. */
function toItem(tr: Transaction, start: number, end: number, attrs: Partial<ListItemAttrs>, from = ['paragraph']): boolean {
  const line = lineAt(tr, start, from);
  if (!line) return false;
  tr.delete(start, end).setNodeMarkup(line.pos, tr.doc.type.schema.nodes.listItem, item({ ...(line.node.type.name === 'listItem' && line.node.attrs), ...attrs }));
  return true;
}

export const BLOCK_RULES: BlockRule[] = [
  {
    name: 'heading',
    find: /^(#{1,6})\s$/,
    apply(tr, m, start, end) {
      const line = lineAt(tr, start, ['paragraph']);
      if (!line) return false;
      tr.delete(start, end).setNodeMarkup(line.pos, tr.doc.type.schema.nodes.heading, { level: m[1].length, sep: m[0].endsWith('\t') ? '\t' : ' ', align: line.node.attrs.align ?? null });
      return true;
    },
  },
  {
    name: 'task',
    find: /^([ \t ]*)\[([ xX]?)\]\s$/,
    apply(tr, m, start, end) {
      const $s = tr.doc.resolve(start);
      const inBullet = $s.parent.type.name === 'listItem' && $s.parent.attrs.kind === 'ul';
      const checked = !!m[2].trim();
      const attrs = { kind: 'task' as const, checked, check: checked ? 'x' : ' ', ...(!inBullet && { indent: indentOf(m[1]) }) };
      return toItem(tr, start, end, attrs, inBullet ? ['listItem'] : ['paragraph']);
    },
  },
  {
    name: 'bullet',
    find: /^([ \t ]*)([-+*])\s$/,
    apply: (tr, m, start, end) => toItem(tr, start, end, { kind: 'ul', indent: indentOf(m[1]), bullet: m[2] }),
  },
  {
    name: 'numbered',
    find: /^([ \t ]*)(\d{1,9})([.)])\s$/,
    apply: (tr, m, start, end) => toItem(tr, start, end, { kind: 'ol', indent: indentOf(m[1]), num: m[2], delim: m[3] }),
  },
  {
    name: 'callout',
    find: /^\[!([\w-]+)\]([+-]?)\s$/,
    apply(tr, m, start, end) {
      const line = lineAt(tr, start, ['paragraph']);
      const $s = tr.doc.resolve(start);
      if (!line || $s.depth < 2 || $s.node(-1).type.name !== 'blockquote' || $s.index(-1) !== 0) return false;
      tr.delete(start, end);
      const quotePos = $s.before(-1);
      const quote = tr.doc.nodeAt(quotePos)!;
      const { callout, calloutTitle } = tr.doc.type.schema.nodes;
      const rest: PMNode[] = [];
      quote.forEach((c, _, i) => i && rest.push(c));
      tr.replaceWith(quotePos, quotePos + quote.nodeSize, callout.create({ kind: m[1], fold: m[2], sep: ' ' }, [calloutTitle.create(null, quote.firstChild!.content), ...rest]));
      tr.setSelection(TextSelection.create(tr.doc, quotePos + 2));
      return true;
    },
  },
  {
    // a footnote's reference ([^1], read as one as it's typed) then ": " starting a line: that footnote's text
    name: 'footnote',
    find: new RegExp(`^${LEAF}:\\s$`),
    apply(tr, _m, start, end) {
      const line = lineAt(tr, start, ['paragraph']);
      const ref = line?.node.firstChild;
      if (!line || ref?.type.name !== 'footnoteRef') return false;
      tr.delete(start, end).setNodeMarkup(line.pos, tr.doc.type.schema.nodes.footnote, { label: ref.attrs.label, sep: ' ' });
      return true;
    },
  },
  {
    name: 'quote',
    find: /^>\s$/,
    apply(tr, _m, start, end) {
      const line = lineAt(tr, start, ['paragraph']);
      if (!line) return false;
      tr.delete(start, end);
      const $a = tr.doc.resolve(line.pos), $b = tr.doc.resolve(line.pos + tr.doc.nodeAt(line.pos)!.nodeSize);
      const range = new NodeRange($a, $b, $a.depth);
      const wrapping = findWrapping(range, tr.doc.type.schema.nodes.blockquote);
      if (!wrapping) return false;
      tr.wrap(range, wrapping);
      return true;
    },
  },
  {
    name: 'divider',
    find: /^(---|—-|___\s|\*\*\*\s)$/,
    apply(tr, m, start, end) {
      const line = lineAt(tr, start, ['paragraph']);
      if (!line) return false;
      tr.delete(start, end);
      const { horizontalRule, paragraph } = tr.doc.type.schema.nodes;
      const node = tr.doc.nodeAt(line.pos)!;
      const hr = horizontalRule.create({ raw: m[1].startsWith('—') ? '---' : m[1].trim() });
      if (!node.content.size) tr.replaceWith(line.pos, line.pos + node.nodeSize, [hr, paragraph.create()]);
      else tr.insert(line.pos, hr);
      tr.setSelection(TextSelection.create(tr.doc, line.pos + hr.nodeSize + 1));
      return true;
    },
  },
  {
    name: 'code',
    find: /^(```|~~~)([^\s`~]*)\s$/,
    apply(tr, m, start, end) {
      const line = lineAt(tr, start, ['paragraph']);
      if (!line) return false;
      tr.delete(start, end);
      const node = tr.doc.nodeAt(line.pos)!;
      const code = tr.doc.type.schema.nodes.codeBlock.create({ open: m[1] + m[2], close: m[1] }, node.textContent ? tr.doc.type.schema.text(node.textContent) : null);
      tr.replaceWith(line.pos, line.pos + node.nodeSize, code);
      tr.setSelection(TextSelection.create(tr.doc, line.pos + 1));
      return true;
    },
  },
];

/** The block rules, then AutoCorrect (autocorrect.ts): what the editor runs as input rules, in this order. */
export const TYPING_RULES: BlockRule[] = [...BLOCK_RULES, ...AUTOCORRECT];

/**
 * What typing `text` at the selection does with the rules (as ProseMirror's inputrules plugin runs them): the
 * transaction of the first rule that applies, or null when none does (the text is typed as it is).
 */
export function ruleFor(state: EditorState, text: string, rules: BlockRule[] = TYPING_RULES): Transaction | null {
  const { $from, from, to } = state.selection;
  if (!$from.parent.isTextblock || $from.parent.type.spec.code || $from.parent !== state.selection.$to.parent) return null;
  const before = $from.parent.textBetween(Math.max(0, $from.parentOffset - 500), $from.parentOffset, undefined, LEAF) + text;
  for (const rule of rules) {
    const m = rule.find.exec(before);
    if (!m) continue;
    const tr = state.tr;
    if (rule.apply(tr, m, from - (m[0].length - text.length), to)) return tr;
  }
  return null;
}

/** Types `text` at the selection, the rules applying (for tests and the plain-key fallback). */
export function typeText(state: EditorState, text: string): Transaction {
  return ruleFor(state, text) ?? replaceSelectionText(state.tr, text);
}
