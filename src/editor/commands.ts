// The ribbon's commands, bound to the note's editor: each runs on the document, then puts the focus back in the text
// (a tap on the ribbon keeps it there anyway, see components/ribbon/keepFocus.ts). What they do is in lib/noteDoc/edit.
import type { Command } from '@tiptap/pm/state';
import type { EditorView } from '@tiptap/pm/view';
import { redo, undo } from '@tiptap/pm/history';
import { noteCommands, type BlockKind, type MarkName, type Style } from '../lib/noteDoc/edit';
import type { ListKind } from '../lib/noteDoc';

export interface NoteCommands {
  mark(name: MarkName): boolean;
  clearFormatting(): boolean;
  style(s: Style): boolean;
  list(kind: ListKind): boolean;
  quote(): boolean;
  indent(out: boolean): boolean;
  insert(kind: BlockKind): boolean;
  link(to: { text?: string; href: string } | null): boolean;
  undo(): boolean;
  redo(): boolean;
}

export function bindCommands(view: () => EditorView | null): NoteCommands {
  const run = (cmd: Command) => {
    const v = view();
    if (!v || !v.editable) return false;
    const done = cmd(v.state, v.dispatch, v);
    v.focus();
    return done;
  };
  return {
    mark: (name) => run(noteCommands.mark(name)),
    clearFormatting: () => run(noteCommands.clearFormatting),
    style: (s) => run(noteCommands.style(s)),
    list: (kind) => run(noteCommands.list(kind)),
    quote: () => run(noteCommands.quote),
    indent: (out) => run(noteCommands.indent(out)),
    insert: (kind) => run(noteCommands.insert(kind)),
    link: (to) => run(noteCommands.link(to)),
    undo: () => run(undo),
    redo: () => run(redo),
  };
}
