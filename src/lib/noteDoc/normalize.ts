// Keeps the document in a shape its text can say: what would read back differently gets fixed, structure only
// (styles and characters are left as they are). The editor runs normalizeTr after each change (appendTransaction);
// normalizeDoc does the same to a document on its own.
//
//   • a picture is never first or last, and two pictures always have a line between them (as the text has)
//   • quotes next to each other become one (their lines would run together)
//   • a callout next to a quote or callout gets an empty line between (else it would read as part of the other)
//   • text holding a line break outside code is split into lines (the part after a break becomes a paragraph)
//   • spaces at the start of a heading's, list item's or callout title's text go to its `sep` (where they'd be read),
//     unless they're code or a link's text (written inside its backticks or brackets)
//   • a code block without a closing line that isn't the last in its stretch gets one (the text writes one anyway)
// Pictures can't be inside a quote or callout: the schema keeps them at the top level.
import type { Node as PMNode } from '@tiptap/pm/model';
import { EditorState, type Transaction } from '@tiptap/pm/state';
import { fenceOf } from './syntax';

type Fix = (tr: Transaction) => boolean;

/** Every textblock (with its position) that matches `test`, last first, so fixing one leaves the others' positions. */
function textblocks(doc: PMNode, test: (n: PMNode) => boolean): { node: PMNode; pos: number }[] {
  const out: { node: PMNode; pos: number }[] = [];
  doc.descendants((node, pos) => {
    if (node.isTextblock) {
      if (test(node)) out.push({ node, pos });
      return false;
    }
    return true;
  });
  return out.reverse();
}

/** Each pair of neighbouring blocks (in any container), last first: the position between them, and the two. */
function neighbours(doc: PMNode): { pos: number; a: PMNode; b: PMNode; parent: PMNode }[] {
  const out: { pos: number; a: PMNode; b: PMNode; parent: PMNode }[] = [];
  const walk = (parent: PMNode, start: number) => {
    let pos = start;
    parent.forEach((child, _, i) => {
      if (i > 0) out.push({ pos, a: parent.child(i - 1), b: child, parent });
      if (!child.isTextblock && !child.isLeaf) walk(child, pos + 1);
      pos += child.nodeSize;
    });
  };
  walk(doc, 0);
  return out.sort((x, y) => y.pos - x.pos);
}

const splitLines: Fix = (tr) => {
  const found = textblocks(tr.doc, (n) => !n.type.spec.code && n.textContent.includes('\n'));
  const p = tr.doc.type.schema.nodes.paragraph;
  for (const { node, pos } of found) {
    const breaks: number[] = [];
    node.forEach((child, offset) => {
      if (!child.isText) return;
      for (let k = child.text!.indexOf('\n'); k >= 0; k = child.text!.indexOf('\n', k + 1)) breaks.push(pos + 1 + offset + k);
    });
    for (const at of breaks.reverse()) tr.delete(at, at + 1).split(at, 1, [{ type: p }]);
  }
  return found.length > 0;
};

const LEAD = /^[ \t]+/;
/** Spaces a line's text starts with that are written before it (in code or a link's [text] they're kept inside). */
const leadsWithSpace = (n: PMNode) =>
  !!n.firstChild?.isText && LEAD.test(n.firstChild.text!) && !n.firstChild.marks.some((m) => m.type.name === 'code' || m.type.name === 'link');
const absorbSpaces: Fix = (tr) => {
  const found = textblocks(tr.doc, (n) => /^(heading|listItem|calloutTitle)$/.test(n.type.name) && leadsWithSpace(n));
  for (const { node, pos } of found) {
    const lead = node.firstChild!.text!.match(LEAD)![0];
    tr.delete(pos + 1, pos + 1 + lead.length);
    // a callout's title keeps its sep on the callout, just before it
    const at = node.type.name === 'calloutTitle' ? pos - 1 : pos;
    const owner = tr.doc.nodeAt(at)!;
    tr.setNodeMarkup(at, null, { ...owner.attrs, sep: (owner.attrs.sep ?? '') + lead });
  }
  return found.length > 0;
};

const isQuote = (n: PMNode) => n.type.name === 'blockquote';
const isCallout = (n: PMNode) => n.type.name === 'callout';

const joinQuotes: Fix = (tr) => {
  const found = neighbours(tr.doc).filter(({ a, b }) => isQuote(a) && isQuote(b));
  for (const { pos } of found) tr.join(pos);
  return found.length > 0;
};

const parkCallouts: Fix = (tr) => {
  const found = neighbours(tr.doc).filter(({ a, b }) => (isCallout(a) && (isQuote(b) || isCallout(b))) || (isQuote(a) && isCallout(b)));
  for (const { pos } of found) tr.insert(pos, tr.doc.type.schema.nodes.paragraph.create());
  return found.length > 0;
};

const frameMedia: Fix = (tr) => {
  const doc = tr.doc;
  const p = doc.type.schema.nodes.paragraph;
  const at: number[] = [];
  if (doc.lastChild?.type.name === 'media') at.push(doc.content.size);
  for (const { pos, a, b, parent } of neighbours(doc)) if (parent === doc && a.type.name === 'media' && b.type.name === 'media') at.push(pos);
  if (doc.firstChild?.type.name === 'media') at.push(0);
  for (const pos of at) tr.insert(pos, p.create());
  return at.length > 0;
};

const closeCode: Fix = (tr) => {
  const found: { pos: number; node: PMNode }[] = [];
  tr.doc.descendants((node, pos, parent, index) => {
    // the last block before a picture ends its stretch of text, as the last block of the note does
    if (node.type.name === 'codeBlock' && node.attrs.close === null && parent && index < parent.childCount - 1 && parent.child(index + 1).type.name !== 'media') {
      found.push({ pos, node });
    }
    return !node.isTextblock;
  });
  for (const { pos, node } of found) tr.setNodeMarkup(pos, null, { ...node.attrs, close: fenceOf(node.attrs.open) ?? '```' });
  return found.length > 0;
};

const FIXES: Fix[] = [splitLines, absorbSpaces, joinQuotes, parkCallouts, frameMedia, closeCode];

/** Whether a textblock's text holds a line break (as its textContent would, without building it). */
function hasBreak(n: PMNode): boolean {
  for (let i = 0; i < n.childCount; i++) {
    const c = n.child(i);
    if ((c.isText ? c.text! : c.textContent).includes('\n')) return true;
  }
  return false;
}

/**
 * Whether the document is in shape already: the fixes' own tests in one walk, without collecting anything. The editor
 * asks after every change, and nearly always it is.
 */
export function inShape(doc: PMNode): boolean {
  const media = (n: PMNode | null | undefined) => n?.type.name === 'media';
  if (media(doc.firstChild) || media(doc.lastChild)) return false;
  const walk = (parent: PMNode): boolean => {
    for (let i = 0; i < parent.childCount; i++) {
      const b = parent.child(i);
      if (i > 0) {
        const a = parent.child(i - 1);
        if (isQuote(a) && isQuote(b)) return false;
        if ((isCallout(a) && (isQuote(b) || isCallout(b))) || (isQuote(a) && isCallout(b))) return false;
        if (parent === doc && media(a) && media(b)) return false;
      }
      if (b.type.name === 'codeBlock' && b.attrs.close === null && i < parent.childCount - 1 && !media(parent.child(i + 1))) return false;
      if (b.isTextblock) {
        if (!b.type.spec.code && hasBreak(b)) return false;
        if (/^(heading|listItem|calloutTitle)$/.test(b.type.name) && leadsWithSpace(b)) return false;
      } else if (!b.isLeaf && !walk(b)) return false;
    }
    return true;
  };
  return walk(doc);
}

/**
 * The changes that put the state's document in shape, or null when it already is. Running it again gives null.
 * (`check: false` skips the quick look first, for tests comparing the two.)
 */
export function normalizeTr(state: EditorState, check = true): Transaction | null {
  if (check && inShape(state.doc)) return null;
  const tr = state.tr;
  for (let pass = 0; pass < 20; pass++) {
    let changed = false;
    for (const fix of FIXES) if (fix(tr)) changed = true;
    if (!changed) break;
  }
  return tr.docChanged ? tr : null;
}

/** The document in shape (the same node when there's nothing to do). */
export function normalizeDoc(doc: PMNode): PMNode {
  return normalizeTr(EditorState.create({ doc }))?.doc ?? doc;
}
