// Keeps the document in a shape its text can say: what would read back differently gets fixed, structure only
// (styles and characters are left as they are). The editor runs normalizeTr after each change (appendTransaction);
// normalizeDoc does the same to a document on its own.
//
//   • a picture is never first or last, and two pictures always have a line between them (as the text has)
//   • quotes next to each other become one (their lines would run together)
//   • a callout next to a quote or callout gets an empty line between (else it would read as part of the other)
//   • text holding a line break outside code is split into lines (the part after a break becomes a paragraph)
//   • spaces at the start of a heading's, list item's, footnote's or callout title's text go to its `sep` (where they'd be read),
//     unless they're code, a link's text, in an HTML tag or a comment (written inside its backticks, brackets or tags)
//   • a code block without a closing line that isn't the last in its stretch gets one (the text writes one anyway)
//   • a table is a grid its text can say: every row as long as the longest, the first row's cells headers and the rest
//     plain ones, each cell aligned as its column's header is (a delimiter row aligns whole columns), no spans; a
//     line break in a cell becomes a space (a cell is one line); two tables next to each other get an empty line
//     between (else they'd read as one)
// Pictures can't be inside a quote or callout: the schema keeps them at the top level.
import type { Mark, Node as PMNode } from '@tiptap/pm/model';
import { EditorState, type Transaction } from '@tiptap/pm/state';
import { fenceOf, isCellAlign } from './syntax';
import { cleanComment } from '../comments';

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

/** A table's cell (a header's or a plain one). */
const isCell = (n: PMNode) => n.type.spec.tableRole === 'cell' || n.type.spec.tableRole === 'header_cell';

const splitLines: Fix = (tr) => {
  const found = textblocks(tr.doc, (n) => !n.type.spec.code && n.textContent.includes('\n'));
  const schema = tr.doc.type.schema;
  for (const { node, pos } of found) {
    const breaks: { at: number; marks: readonly Mark[] }[] = [];
    node.forEach((child, offset) => {
      if (!child.isText) return;
      for (let k = child.text!.indexOf('\n'); k >= 0; k = child.text!.indexOf('\n', k + 1)) breaks.push({ at: pos + 1 + offset + k, marks: child.marks });
    });
    for (const { at, marks } of breaks.reverse()) {
      // a cell is one line: its line breaks are spaces
      if (isCell(node)) tr.replaceWith(at, at + 1, schema.text(' ', marks));
      else tr.delete(at, at + 1).split(at, 1, [{ type: schema.nodes.paragraph }]);
    }
  }
  return found.length > 0;
};

const LEAD = /^[ \t]+/;
/**
 * Spaces a line's text starts with that are written before it (in code, a link's [text] or an HTML tag, <u> and the
 * like, they're kept inside).
 */
const keepsSpaces = (m: Mark) =>
  /^(code|link|underline|sup|sub|color)$/.test(m.type.name) || (m.type.name === 'highlight' && !!m.attrs.color)
  // (a comment saying nothing isn't written: its spaces would be the line's)
  || (m.type.name === 'comment' && !!cleanComment(String(m.attrs.text ?? '')));
const leadsWithSpace = (n: PMNode) => !!n.firstChild?.isText && LEAD.test(n.firstChild.text!) && !n.firstChild.marks.some(keepsSpaces);
const absorbSpaces: Fix = (tr) => {
  const found = textblocks(tr.doc, (n) => /^(heading|listItem|calloutTitle|footnote)$/.test(n.type.name) && leadsWithSpace(n));
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

const isTable = (n: PMNode) => n.type.name === 'table';

const parkTables: Fix = (tr) => {
  const found = neighbours(tr.doc).filter(({ a, b }) => isTable(a) && isTable(b));
  for (const { pos } of found) tr.insert(pos, tr.doc.type.schema.nodes.paragraph.create());
  return found.length > 0;
};

/** A column's alignment, as its header cell has it (null when it has none it can write). */
const alignOfHeader = (header: PMNode, k: number) => {
  const a = header.maybeChild(k)?.attrs.align;
  return isCellAlign(a) ? a : null;
};

/** Whether a table is a grid its text can say (see the top of this file). */
function tableInShape(table: PMNode): boolean {
  const header = table.firstChild!;
  const width = header.childCount;
  for (let r = 0; r < table.childCount; r++) {
    const row = table.child(r);
    if (row.childCount !== width) return false;
    for (let k = 0; k < width; k++) {
      const c = row.child(k);
      if (c.type.spec.tableRole !== (r ? 'cell' : 'header_cell') || c.attrs.align !== alignOfHeader(header, k)) return false;
      if (c.attrs.colspan !== 1 || c.attrs.rowspan !== 1 || c.attrs.colwidth !== null) return false;
    }
  }
  return true;
}

const shapeTables: Fix = (tr) => {
  const found: { node: PMNode; pos: number }[] = [];
  tr.doc.descendants((node, pos) => {
    if (isTable(node)) {
      if (!tableInShape(node)) found.push({ node, pos });
      return false;
    }
    return !node.isTextblock;
  });
  const { tableHeader, tableCell } = tr.doc.type.schema.nodes;
  // last first, so each change leaves the positions before it; a cell's type and attributes change in place (the
  // caret in it stays), missing cells go at the end of their row
  for (const { node: table, pos } of found.reverse()) {
    const header = table.firstChild!;
    let width = 0;
    table.forEach((row) => (width = Math.max(width, row.childCount)));
    const rowsAt: number[] = [];
    table.forEach((_, offset) => void rowsAt.push(pos + 1 + offset));
    for (let r = table.childCount - 1; r >= 0; r--) {
      const row = table.child(r);
      const type = r ? tableCell : tableHeader;
      const missing = Array.from({ length: width - row.childCount }, (_, i) => type.create({ align: alignOfHeader(header, row.childCount + i) }));
      if (missing.length) tr.insert(rowsAt[r] + row.nodeSize - 1, missing);
      const cells: number[] = [];
      row.forEach((_, offset) => void cells.push(rowsAt[r] + 1 + offset));
      for (let k = row.childCount - 1; k >= 0; k--) {
        const c = row.child(k);
        const attrs = { align: alignOfHeader(header, k), colspan: 1, rowspan: 1, colwidth: null };
        if (c.type !== type || Object.entries(attrs).some(([a, v]) => c.attrs[a] !== v)) tr.setNodeMarkup(cells[k], type, attrs);
      }
    }
  }
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

const FIXES: Fix[] = [splitLines, absorbSpaces, joinQuotes, parkCallouts, parkTables, shapeTables, frameMedia, closeCode];

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
        if (isTable(a) && isTable(b)) return false;
        if (parent === doc && media(a) && media(b)) return false;
      }
      if (b.type.name === 'codeBlock' && b.attrs.close === null && i < parent.childCount - 1 && !media(parent.child(i + 1))) return false;
      if (isTable(b) && !tableInShape(b)) return false;
      if (b.isTextblock) {
        if (!b.type.spec.code && hasBreak(b)) return false;
        if (/^(heading|listItem|calloutTitle|footnote)$/.test(b.type.name) && leadsWithSpace(b)) return false;
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
