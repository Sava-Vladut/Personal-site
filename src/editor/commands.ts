// The ribbon's commands, bound to the note's editor: each runs on the document, then puts the focus back in the text
// (a tap on the ribbon keeps it there anyway, see components/ribbon/keepFocus.ts). What they do is in lib/noteDoc/edit.
import { Selection, type Command } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';
import { redo, undo } from '@tiptap/pm/history';
import { noteCommands, type BlockKind, type MarkName, type Style, type TableAction } from '../lib/noteDoc/edit';
import type { ListKind } from '../lib/noteDoc';

export interface NoteCommands {
  /** a style on or off; a highlight in `color` (a colour of lib/palette.ts, null for yellow) */
  mark(name: MarkName, color?: string | null): boolean;
  /** Font colour (null: Automatic) */
  color(color: string | null): boolean;
  /** Text highlight colour (null: yellow, false: No colour) */
  highlight(color: string | null | false): boolean;
  /** the Format Painter: on for once, or until Esc (`sticky`); a click while it's on puts it away */
  painter(sticky: boolean): boolean;
  clearFormatting(): boolean;
  style(s: Style): boolean;
  list(kind: ListKind): boolean;
  quote(): boolean;
  indent(out: boolean): boolean;
  /** Restart numbering (true) or Continue numbering (false) on the numbered item at the caret */
  numbering(restart: boolean): boolean;
  insert(kind: BlockKind): boolean;
  /** Align left, centre, right or justify on the selected paragraphs and headings */
  align(align: 'left' | 'center' | 'right' | 'justify'): boolean;
  /** Insert › Footnote: a reference at the caret, its text at the end of the note */
  footnote(): boolean;
  /** Insert › Table: an empty table, `rows` (the header row among them) by `cols` */
  insertTable(rows: number, cols: number): boolean;
  /** the Table tab: rows and columns in and out, the table taken out, a column aligned */
  table(action: TableAction): boolean;
  link(to: { text?: string; href: string } | null): boolean;
  undo(): boolean;
  redo(): boolean;
}

export function bindCommands(view: () => EditorView | null): NoteCommands {
  const run = (cmd: Command, inText = true) => {
    const v = view();
    if (!v || !v.editable) return false;
    // from the title (the note's other place to write), a command acts on the note's words from their start, not on
    // wherever the caret was in them last; from any other field (a sheet's), on the words where the caret was
    const a = document.activeElement;
    if (inText && !v.hasFocus() && a instanceof HTMLElement && a.closest('.title-input')) {
      v.dispatch(v.state.tr.setSelection(Selection.findFrom(v.state.doc.resolve(0), 1, true) ?? Selection.atStart(v.state.doc)));
    }
    const done = cmd(v.state, v.dispatch, v);
    v.focus();
    return done;
  };
  return {
    mark: (name, color) => run(noteCommands.mark(name, color)),
    color: (color) => run(noteCommands.color(color)),
    highlight: (color) => run(noteCommands.highlight(color)),
    painter: (sticky) => run(noteCommands.painter(sticky)),
    clearFormatting: () => run(noteCommands.clearFormatting),
    style: (s) => run(noteCommands.style(s)),
    list: (kind) => run(noteCommands.list(kind)),
    quote: () => run(noteCommands.quote),
    indent: (out) => run(noteCommands.indent(out)),
    numbering: (restart) => run(noteCommands.numbering(restart)),
    insert: (kind) => run(noteCommands.insert(kind)),
    align: (align) => run(noteCommands.align(align)),
    footnote: () => run(noteCommands.footnote),
    insertTable: (rows, cols) => run(noteCommands.insertTable(rows, cols)),
    table: (action) => run(noteCommands.table(action)),
    link: (to) => run(noteCommands.link(to)),
    undo: () => run(undo, false),
    redo: () => run(redo, false),
  };
}
