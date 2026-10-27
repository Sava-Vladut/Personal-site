// Tables, as Word edits them: Insert › Table puts in an empty one (a header row, then rows); Tab and Shift+Tab go from
// cell to cell (Tab in the last cell adds a row); Enter goes to the cell below (a row added at the bottom), never
// splitting a cell; the Table tab puts rows and columns in, takes them out, and aligns a column. prosemirror-tables
// (@tiptap/pm/tables) does the grid's work: the arrows between cells, selecting cells, pasting cells into cells. A cell
// is one line of words (lib/noteDoc/schema.ts), so what's pasted into one comes in as one line.
import { Fragment, Slice, type Node as PMNode, type ResolvedPos, type Schema } from '@tiptap/pm/model';
import { Selection, TextSelection, type Command, type EditorState, type Transaction } from '@tiptap/pm/state';
import { CellSelection, TableMap, addColumnAfter, addColumnBefore, addRow, addRowAfter, addRowBefore, deleteColumn, deleteRow, goToNextCell, selectedRect } from '@tiptap/pm/tables';
import { parseBlocks } from '../parse';
import { serializeInline } from '../serialize';
import { delimRow, headerCells, type CellAlign } from '../syntax';
import { placeBlock } from './util';

/** A table's cell, a header's or a plain one. */
export const isCell = (n: PMNode | null | undefined) => !!n && (n.type.spec.tableRole === 'cell' || n.type.spec.tableRole === 'header_cell');

/** The depth of the table a position is in, or -1. */
function tableDepth($p: ResolvedPos): number {
  for (let d = $p.depth; d > 0; d--) if ($p.node(d).type.name === 'table') return d;
  return -1;
}

/** Whether the selection is in one table (a caret or words in a cell, or cells selected), both its ends. */
export function inTable(state: Pick<EditorState, 'selection'>): boolean {
  const { $from, $to } = state.selection;
  const d = tableDepth($from);
  return d > 0 && tableDepth($to) === d && $from.before(d) === $to.before(d);
}

/** The most rows and columns Insert › Table's grid offers. */
export const TABLE_MAX = 8;

/** An empty table: a header row, then `rows - 1` rows, `cols` cells each. */
export function emptyTable(schema: Schema, rows: number, cols: number): PMNode {
  const { table, tableRow, tableHeader, tableCell } = schema.nodes;
  return table.create(null, Array.from({ length: rows }, (_, r) =>
    tableRow.create(null, Array.from({ length: cols }, () => (r ? tableCell : tableHeader).create()))));
}

/**
 * Insert › Table: an empty table of `rows` (its header row among them) by `cols`, in place of an empty line, or before
 * or after the line at its start or end, or splitting it; the caret in its first cell, and a line after it to go on
 * writing. Not in code nor in a table's cell.
 */
export const insertTable = (rows: number, cols: number): Command => (state, dispatch) => {
  const r = Math.max(1, Math.min(TABLE_MAX, Math.round(rows) || 1));
  const c = Math.max(1, Math.min(TABLE_MAX, Math.round(cols) || 1));
  const node = emptyTable(state.schema, r, c);
  const tr = state.tr;
  const at = placeBlock(tr, node);
  if (at === null) return false;
  if (!dispatch) return true;
  const next = tr.doc.resolve(at + node.nodeSize).nodeAfter;
  if (!next?.isTextblock) tr.insert(at + node.nodeSize, state.schema.nodes.paragraph.create());
  // table › row › cell
  dispatch(tr.setSelection(TextSelection.create(tr.doc, at + 3)).scrollIntoView());
  return true;
};

/** The position just inside cell (`row`, `col`) of the table at `tablePos`, at its words' start or end. */
function cellText(doc: PMNode, tablePos: number, row: number, col: number, end = false): number {
  const table = doc.nodeAt(tablePos)!;
  const map = TableMap.get(table);
  const cellPos = tablePos + 1 + map.map[row * map.width + col];
  return cellPos + 1 + (end ? doc.nodeAt(cellPos)!.content.size : 0);
}

/** The table around the selection's head cell: where it is, its map, and that cell's row and column. */
function headCell(state: EditorState) {
  const rect = selectedRect(state);
  const sel = state.selection;
  const $cell = sel instanceof CellSelection ? sel.$headCell : state.doc.resolve(sel.$head.before(tableDepth(sel.$head) + 2));
  const at = rect.map.findCell($cell.pos - rect.tableStart);
  return { tablePos: rect.tableStart - 1, map: rect.map, row: at.top, col: at.left, rect };
}

/** A row added at the bottom of the table, the caret going into its cell in column `col`. */
function rowAtBottom(state: EditorState, col: number): Transaction {
  const { tablePos, map, rect } = headCell(state);
  const tr = addRow(state.tr, rect, map.height);
  return tr.setSelection(TextSelection.create(tr.doc, cellText(tr.doc, tablePos, map.height, col))).scrollIntoView();
}

/**
 * Tab and Shift+Tab in a table: the next or the previous cell, its words selected (as Word does); Tab in the last cell
 * adds a row and goes to its first cell, Shift+Tab in the first stays. False out of a table.
 */
export const cellTab = (back: boolean): Command => (state, dispatch) => {
  if (!inTable(state)) return false;
  if (goToNextCell(back ? -1 : 1)(state, dispatch)) return true;
  if (!back && dispatch) dispatch(rowAtBottom(state, 0));
  return true;
};

/**
 * Enter (and Shift+Enter) in a table: the caret to the end of the words in the cell below, a row added when it's the
 * bottom row. A cell is never split: it's one line of words. False out of a table.
 */
export const cellEnter: Command = (state, dispatch) => {
  if (!inTable(state)) return false;
  if (!dispatch) return true;
  const { tablePos, map, row, col } = headCell(state);
  if (row + 1 >= map.height) dispatch(rowAtBottom(state, col));
  else dispatch(state.tr.setSelection(TextSelection.create(state.doc, cellText(state.doc, tablePos, row + 1, col, true))).scrollIntoView());
  return true;
};

/**
 * Enter at the end of a delimiter row typed under a header row (`| a | b |`, then `| --- | --- |`), as a table's
 * Markdown is typed: the two lines become a table with an empty row, the caret in its first cell.
 */
export const tableEnter: Command = (state, dispatch) => {
  const { $from, empty } = state.selection;
  const p = $from.parent;
  const i = $from.index(-1);
  if (!empty || p.type.name !== 'paragraph' || $from.parentOffset !== p.content.size || i === 0) return false;
  const prev = $from.node(-1).child(i - 1);
  if (prev.type.name !== 'paragraph' || prev.attrs.align || p.attrs.align) return false;
  let plain = true;
  p.forEach((c) => (plain &&= c.isText && !c.marks.length));
  const head = serializeInline(prev);
  const n = headerCells(head);
  if (!plain || !n || delimRow(p.textContent)?.length !== n) return false;
  const [table] = parseBlocks(`${head}\n${p.textContent}\n|`, state.schema);
  if (table?.type.name !== 'table') return false;
  if (dispatch) {
    const from = $from.before() - prev.nodeSize;
    const tr = state.tr.replaceWith(from, $from.after(), table);
    // the header row's, the delimiter row's, then the caret in the first cell of the row under them
    dispatch(tr.setSelection(TextSelection.create(tr.doc, from + 1 + table.firstChild!.nodeSize + 2)).scrollIntoView());
  }
  return true;
};

/** What the Table tab does: rows and columns in and out, the table taken out, a column aligned. */
export type TableAction = 'rowAbove' | 'rowBelow' | 'colLeft' | 'colRight' | 'deleteRow' | 'deleteColumn' | 'deleteTable' | 'left' | 'center' | 'right';

/** Delete Table: the table goes, the caret on the line after it (an empty line in its place when nothing else is). */
export const deleteTable: Command = (state, dispatch) => {
  if (!inTable(state)) return false;
  if (!dispatch) return true;
  const $p = state.selection.$from;
  const d = tableDepth($p);
  const from = $p.before(d), to = $p.after(d);
  const parent = $p.node(d - 1);
  const tr = state.tr;
  if (parent.childCount === 1) tr.replaceWith(from, to, state.schema.nodes.paragraph.create());
  else tr.delete(from, to);
  const $at = tr.doc.resolve(Math.min(from, tr.doc.content.size));
  dispatch(tr.setSelection(Selection.findFrom($at, 1, true) ?? Selection.findFrom($at, -1, true) ?? Selection.near($at)).scrollIntoView());
  return true;
};

/** A column's alignment as the ribbon shows it ('left' for none), of all the selected columns; null when they differ. */
export function cellAlignAt(state: EditorState): 'left' | 'center' | 'right' | null {
  if (!inTable(state)) return null;
  const { map, table, left, right } = selectedRect(state);
  let out: 'left' | 'center' | 'right' | null = null;
  for (let col = left; col < right; col++) {
    const a = (table.nodeAt(map.map[col])!.attrs.align as CellAlign) ?? 'left';
    if (out && out !== a) return null;
    out = a;
  }
  return out;
}

/** Aligns the selected columns, every cell of each (left is no alignment written, as for a paragraph). */
const alignColumns = (align: 'left' | 'center' | 'right'): Command => (state, dispatch) => {
  if (!inTable(state)) return false;
  const { map, table, tableStart, left, right } = selectedRect(state);
  const to = align === 'left' ? null : align;
  const tr = state.tr;
  for (let col = left; col < right; col++) {
    for (let row = 0; row < map.height; row++) {
      const pos = tableStart + map.map[row * map.width + col];
      const cell = table.nodeAt(pos - tableStart)!;
      if ((cell.attrs.align ?? null) !== to) tr.setNodeMarkup(pos, null, { ...cell.attrs, align: to });
    }
  }
  dispatch?.(tr.scrollIntoView());
  return true;
};

/**
 * The Table tab's commands. Deleting every row (or every column) deletes the table, as Word does. The header row is
 * always the first: a row put in above it becomes the header, and when it's deleted the row under it becomes the header
 * (lib/noteDoc/normalize.ts).
 */
export function tableCommand(action: TableAction): Command {
  switch (action) {
    case 'rowAbove': return (s, d) => inTable(s) && addRowBefore(s, d);
    case 'rowBelow': return (s, d) => inTable(s) && addRowAfter(s, d);
    case 'colLeft': return (s, d) => inTable(s) && addColumnBefore(s, d);
    case 'colRight': return (s, d) => inTable(s) && addColumnAfter(s, d);
    case 'deleteRow':
    case 'deleteColumn':
      return (s, d, v) => {
        if (!inTable(s)) return false;
        const { map, top, bottom, left, right } = selectedRect(s);
        const all = action === 'deleteRow' ? top === 0 && bottom === map.height : left === 0 && right === map.width;
        return all ? deleteTable(s, d, v) : (action === 'deleteRow' ? deleteRow : deleteColumn)(s, d);
      };
    case 'deleteTable': return deleteTable;
    default: return alignColumns(action);
  }
}

/* ---------- pasting into a cell ---------- */

/** Whether a slice is cells of a table (a table, its rows or cells), which prosemirror-tables pastes cell by cell. */
export function isCellsSlice(slice: Slice): boolean {
  let { content, openStart, openEnd } = slice;
  if (!content.childCount) return false;
  while (content.childCount === 1 && ((openStart > 0 && openEnd > 0) || content.firstChild!.type.name === 'table')) {
    openStart--;
    openEnd--;
    content = content.firstChild!.content;
  }
  const role = content.firstChild?.type.spec.tableRole;
  return role === 'row' || role === 'cell' || role === 'header_cell';
}

/**
 * A slice as one line of words, to paste into a cell: each line's words (a table's cells', too) one after another with
 * a space between, styles and tags kept; pictures and line breaks left out.
 */
export function oneLine(slice: Slice, schema: Schema): Slice {
  const out: PMNode[] = [];
  const gap = () => {
    const last = out[out.length - 1];
    if (last && !(last.isText && /\s$/.test(last.text!))) out.push(schema.text(' '));
  };
  const walk = (f: Fragment) =>
    f.forEach((n) => {
      if (n.isText) out.push(n.text!.includes('\n') ? schema.text(n.text!.replace(/\n/g, ' '), n.marks) : n);
      else if (n.isInline) out.push(n);
      else if (n.isTextblock && !n.type.spec.code) (gap(), walk(n.content));
      else if (n.isTextblock) (gap(), n.textContent && out.push(schema.text(n.textContent.replace(/\n/g, ' '))));
      else walk(n.content);
    });
  walk(slice.content);
  while (out[0]?.isText && out[0].text === ' ') out.shift();
  return new Slice(Fragment.from(out), 0, 0);
}
