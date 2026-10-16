// For tests only (nothing in the app imports this): an editor state from a note's text with the caret written in it,
// and back. The caret is `|`, a selection runs from `«` (anchor) to `»` (head):
//
//   const s = stateFrom('- a|b');            // a list item, caret between a and b
//   show(s) === '- a|b'
//   show(stateFrom('# «Day» one')) === '# «Day» one'
//
// The markers ride through the parser as private-use characters, so a caret inside **bold** stays inside it. One
// written before a line's marker (`|- a`, `|> x`) goes to the start of the line's text. They can't go on a fence
// or rule line, or inside a chip's token; pass `{ caret: '‸' }` when the text holds a `|` of its own (`[[a|b]]`).
import type { Schema } from '@tiptap/pm/model';
import { EditorState, TextSelection, type Plugin } from '@tiptap/pm/state';
import { parseNote } from './parse';
import { noteSchema } from './schema';
import { serializeNote } from './serialize';
import { QUOTE, calloutOf, classifyLine, closesFence } from './syntax';

const ANCHOR = '';
const HEAD = '';

/** Where a line's own text starts, after its quote, heading or list marker (and a callout's [!kind]). */
function contentStart(line: string, quoteStart: boolean): number {
  let at = 0;
  for (let first = quoteStart; ; first = false) {
    const c = classifyLine(line.slice(at));
    if (c.t === 'quote') {
      at += c.at;
      const co = first ? calloutOf(line.slice(at)) : null;
      if (co) return at + co.at;
      continue;
    }
    return c.t === 'heading' || c.t === 'item' ? at + c.at : at;
  }
}

export interface StateOptions {
  /** the caret's marker, `|` unless given */
  caret?: string;
  schema?: Schema;
  plugins?: Plugin[];
}

/** An editor state holding `text`, with the selection where its markers are. */
export function stateFrom(text: string, opts: StateOptions = {}): EditorState {
  const caret = opts.caret ?? '|';
  const schema = opts.schema ?? noteSchema();
  // take the markers out, noting where they were
  const marks: { ch: string; at: number }[] = [];
  let clean = '';
  for (const ch of text) {
    if (ch === caret) marks.push({ ch: ANCHOR, at: clean.length });
    else if (ch === '«') marks.push({ ch: ANCHOR, at: clean.length });
    else if (ch === '»') marks.push({ ch: HEAD, at: clean.length });
    else clean += ch;
  }
  // move any written before a line's marker to the start of its text
  let lineStart = 0;
  let fence: string | null = null;
  let prevQuote = false;
  for (const line of clean.split('\n')) {
    let start = 0;
    if (fence) {
      if (closesFence(line, fence)) fence = null;
    } else {
      const c = classifyLine(line);
      if (c.t === 'fence') fence = c.fence;
      else start = contentStart(line, !prevQuote);
    }
    prevQuote = QUOTE.test(line);
    for (const m of marks) if (m.at >= lineStart && m.at < lineStart + start) m.at = lineStart + start;
    lineStart += line.length + 1;
  }
  let marked = clean;
  for (const m of [...marks].sort((a, b) => b.at - a.at)) marked = marked.slice(0, m.at) + m.ch + marked.slice(m.at);

  // read it, then find the markers in the document and take them out
  const doc = parseNote(marked, schema);
  const found: Record<string, number> = {};
  const tr = EditorState.create({ doc }).tr;
  const at: { ch: string; pos: number }[] = [];
  doc.descendants((n, pos) => {
    if (n.isText) for (let k = 0; k < n.text!.length; k++) if (n.text![k] === ANCHOR || n.text![k] === HEAD) at.push({ ch: n.text![k], pos: pos + k });
  });
  if (at.length !== marks.length) throw new Error(`stateFrom: a marker in ${JSON.stringify(text)} isn't in the text`);
  for (const { ch, pos } of at.reverse()) {
    tr.delete(pos, pos + 1);
    found[ch] = pos;
  }
  // positions found last-first: map the earlier one past the later deletion
  const anchor = found[ANCHOR] ?? 1;
  const head = found[HEAD] ?? anchor;
  const a = anchor < head ? anchor : anchor - (HEAD in found ? 1 : 0);
  const h = head > anchor ? head - 1 : head;
  // an address the caret sat in keeps no trace of it
  tr.doc.descendants((n, pos) => {
    for (const m of n.marks) {
      if (m.type.name === 'link' && /[]/.test(m.attrs.href)) {
        tr.removeMark(pos, pos + n.nodeSize, m).addMark(pos, pos + n.nodeSize, m.type.create({ ...m.attrs, href: m.attrs.href.replace(/[]/g, '') }));
      }
    }
  });
  return EditorState.create({ doc: tr.doc, selection: TextSelection.create(tr.doc, a, h), plugins: opts.plugins });
}

/** The state's text with its selection written in: `|` for a caret, `«` … `»` from anchor to head. */
export function show(state: EditorState, opts: { caret?: string } = {}): string {
  const { anchor, head } = state.selection;
  const tr = state.tr;
  const put = anchor === head ? [{ pos: head, ch: ANCHOR }] : [{ pos: anchor, ch: ANCHOR }, { pos: head, ch: HEAD }];
  for (const { pos, ch } of put.sort((a, b) => b.pos - a.pos)) {
    const $p = tr.doc.resolve(pos);
    if (!$p.parent.inlineContent) throw new Error(`show: the selection (${pos}) isn't in text`);
    const marks = $p.marks().filter((m) => m.type.name !== 'escaped' && $p.parent.type.allowsMarkType(m.type));
    tr.insert(pos, state.schema.text(ch, marks));
  }
  const text = serializeNote(tr.doc);
  return anchor === head ? text.replace(ANCHOR, opts.caret ?? '|') : text.replace(ANCHOR, '«').replace(HEAD, '»');
}
