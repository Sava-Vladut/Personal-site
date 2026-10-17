// What the note editor does on top of ProseMirror's own editing: Markdown typed at the start of a line or around words
// becomes what it writes, the keys behave as in Word and Notion, the document's shape is kept writable as text, #tags
// show as tags, and what's typed after an @ (or [[) is reported for the suggestions.
// The pure parts (what each key and rule does to the document) are in lib/noteDoc/edit, tested in Node.
import { Plugin, PluginKey, TextSelection, type Command, type Transaction } from '@tiptap/pm/state';
import type { Node as PMNode } from '@tiptap/pm/model';
import { Decoration, DecorationSet, type EditorView } from '@tiptap/pm/view';
import { InputRule, inputRules, undoInputRule } from '@tiptap/pm/inputrules';
import { keymap } from '@tiptap/pm/keymap';
import { baseKeymap, chainCommands, selectAll } from '@tiptap/pm/commands';
import { history, redo, undo } from '@tiptap/pm/history';
import { gapCursor } from '@tiptap/pm/gapcursor';
import { dropCursor } from '@tiptap/pm/dropcursor';
import { normalizeTr, parseInline, BARE } from '../lib/noteDoc';
import {
  BLOCK_RULES, backspace, deleteForward, enter, exitCode, newLine, noteCommands, tab, tidyAfterTag, typedAt, type Typed,
} from '../lib/noteDoc/edit';

/* ---------- typing Markdown ---------- */

/**
 * Inline Markdown closed as it's typed: **bold**, *italic*, ~~strike~~, ==highlight==, `code`, [words](address), and a
 * tag written out in full (@[Ann], ♪[Song], [[Note]]). What was typed is read with the note's own parser, so it
 * becomes exactly what the text would read back as. Underscores are left alone (snake_case stays words).
 */
const INLINE = new RegExp(
  '(?:' + [
    String.raw`(?<![*\\])\*\*(?=[^\s*])[^*\n￼]*?[^\s*]\*\*`,
    String.raw`(?<![*\\])\*(?=[^\s*])(?:[^*\n￼]*?[^\s*])?\*`,
    String.raw`(?<![~\\])~~(?=[^\s~])[^~\n￼]*?~~`,
    String.raw`(?<![=\\])==(?=[^\s=])[^=\n￼]*?==`,
    String.raw`(?<![\x60\\])\x60[^\x60\n￼]+\x60`,
    String.raw`(?<!\\)\[[^\]\n￼]*\]\([^)\s]+\)`,
    String.raw`@\[[^\]\n￼]+\]`,
    String.raw`♪\[[^\]\n￼]+\]`,
    String.raw`\[\[[^\]\n￼]+\]\]`,
  ].join('|') + ')$',
  'u',
);

const markdownRule = new InputRule(INLINE, (state, match, start, end) => {
  const $s = state.doc.resolve(start);
  if ($s.parent.type.spec.code || $s.marks().some((m) => m.type.name === 'code')) return null;
  const nodes = parseInline(match[0], $s.marks().filter((m) => m.type.name !== 'escaped'), state.schema);
  // only when it read as something: a lone `*` stays a star
  if (nodes.length === 1 && nodes[0].isText && nodes[0].text === match[0]) return null;
  const tr = state.tr.replaceWith(start, end, nodes);
  const after = start + nodes.reduce((n, x) => n + x.nodeSize, 0);
  // what's typed next is plain again
  return tr.setSelection(TextSelection.create(tr.doc, after)).setStoredMarks($s.marks().filter((m) => m.type.name !== 'escaped'));
});

/** An address typed out, then a space: it becomes a link, as it'll read back anyway. */
const autolink = new InputRule(/(?<![\w/:\]()])(https?:\/\/[^\s<>]+)(\s)$/, (state, match, start, end) => {
  let url = match[1];
  while (url && !BARE.test(url)) url = url.slice(0, -1);
  if (!url || url.length < 10) return null;
  const $s = state.doc.resolve(start);
  if ($s.parent.type.spec.code || state.doc.rangeHasMark(start, end, state.schema.marks.link)) return null;
  const link = state.schema.marks.link.create({ href: url, bare: true });
  const tr = state.tr.addMark(start, start + url.length, link).insertText(match[2], end);
  return tr.setStoredMarks($s.marks());
});

const blockRules = BLOCK_RULES.map((rule) => new InputRule(rule.find, (state, match, start, end) => {
  const tr = state.tr;
  return rule.apply(tr, match, start, end) ? tr : null;
}));

/* ---------- keys ---------- */

export interface KeyOptions {
  /** the Link sheet (Ctrl+K) */
  link: () => void;
  /** while an @'s suggestions are up, they have the arrows, Enter, Tab and Escape: true when they took the key */
  suggestKey: (e: KeyboardEvent) => boolean;
}

/** Word's shortcuts. AltGr is Ctrl+Alt to the browser and types characters on many keyboards: never a style. */
function shortcut(view: EditorView, e: KeyboardEvent, opts: KeyOptions): boolean {
  const mod = e.ctrlKey || e.metaKey;
  if (!mod) return false;
  const k = e.key.toLowerCase(), code = e.code;
  let cmd: Command | null = null;
  if (e.altKey && !e.shiftKey) {
    if (e.getModifierState?.('AltGraph')) return false;
    if (/^Digit[0-6]$/.test(code)) cmd = noteCommands.style(code === 'Digit0' ? 'normal' : (('h' + code.slice(5)) as 'h1'));
  } else if (e.shiftKey && !e.altKey) {
    if (k === 'x') cmd = noteCommands.mark('strike');
    else if (k === 'h') cmd = noteCommands.mark('highlight');
    else if (k === 'l') cmd = noteCommands.list('ul');
    else if (k === 'n') cmd = noteCommands.style('normal');
    else if (code === 'Digit7') cmd = noteCommands.list('ol');
    else if (code === 'Digit9') cmd = noteCommands.list('task');
    else if (code === 'Period') cmd = noteCommands.quote;
    else if (k === 'z') cmd = redo;
  } else if (!e.altKey) {
    if (k === 'b') cmd = noteCommands.mark('bold');
    else if (k === 'i') cmd = noteCommands.mark('italic');
    else if (k === 'e') cmd = noteCommands.mark('code');
    else if (k === 'z') cmd = undo;
    else if (k === 'y' && !e.metaKey) cmd = redo;
    else if (k === 'u') return true; // no underline in a note's text: swallowed, not the browser's
    else if (k === 'k') {
      opts.link();
      return true;
    }
    // never the browser's Back and Forward (⌘[ and ⌘]) from the text, in a list or not
    else if (code === 'BracketRight' || code === 'BracketLeft') {
      noteCommands.indent(code === 'BracketLeft')(view.state, view.dispatch);
      return true;
    }
  }
  if (!cmd) return false;
  cmd(view.state, view.dispatch, view);
  return true;
}

/* ---------- #tags ---------- */

const TAG = /(?<![^\s(])#[\p{L}_][\p{L}\p{N}_/-]*/gu;

/** The #tags in `node` (its content starting at `start`), added to `found`. */
function findTags(node: PMNode, start: number, found: Decoration[]) {
  node.nodesBetween(0, node.content.size, (n, pos) => {
    if (n.type.spec.code) return false;
    if (!n.isText) return true;
    if (n.marks.some((m) => m.type.name === 'code' || m.type.name === 'link')) return false;
    for (const m of n.text!.matchAll(TAG)) found.push(Decoration.inline(start + pos + m.index!, start + pos + m.index! + m[0].length, { class: 'md-tag' }));
    return false;
  });
}

/** #tags show as tags (span.md-tag) while they stay plain text. */
export function tagDecorations(doc: PMNode): DecorationSet {
  const found: Decoration[] = [];
  findTags(doc, 0, found);
  return DecorationSet.create(doc, found);
}

/**
 * The tags after a change: the old ones moved along, and only the lines the change touched read again (reading
 * every line on each key is slow in a long note).
 */
export function updateTags(tr: Transaction, old: DecorationSet): DecorationSet {
  const doc = tr.doc;
  // where the steps changed the document, in its final positions
  const ranges: [number, number][] = [];
  for (const map of tr.mapping.maps) {
    for (const r of ranges) (r[0] = map.map(r[0], -1)), (r[1] = map.map(r[1], 1));
    map.forEach((_a, _b, from, to) => void ranges.push([from, to]));
  }
  let set = old.map(tr.mapping, doc);
  const size = doc.content.size;
  for (const [a, b] of ranges) {
    // the whole lines around it (a line joined to the next, or split, included)
    doc.nodesBetween(Math.max(0, a - 1), Math.min(size, b + 1), (node, pos) => {
      if (!node.isTextblock) return true;
      const from = pos + 1, to = pos + node.nodeSize - 1;
      set = set.remove(set.find(from, to));
      const found: Decoration[] = [];
      if (!node.type.spec.code) findTags(node, from, found);
      if (found.length) set = set.add(doc, found);
      return false;
    });
  }
  return set;
}

const tagsKey = new PluginKey<DecorationSet>('tags');
const tags = new Plugin<DecorationSet>({
  key: tagsKey,
  state: {
    init: (_, state) => tagDecorations(state.doc),
    apply: (tr, old) => (tr.docChanged ? updateTags(tr, old) : old),
  },
  props: { decorations: (state) => tagsKey.getState(state) },
});

/* ---------- suggestions ---------- */

/**
 * Reports the @query (or [[query) typed just before the caret, or null, after each change of the text or the caret
 * (only with nothing selected). While a word is being composed (a phone's keyboard) it isn't read.
 */
function suggest(onTyped: (t: Typed | null) => void): Plugin {
  let last: string | null = null;
  const report = (view: EditorView) => {
    const typed = view.composing || !view.hasFocus() ? null : typedAt(view.state);
    const key = typed && `${typed.from}:${typed.to}:${typed.q}:${typed.link}`;
    if (key === last) return;
    last = key;
    onTyped(typed);
  };
  return new Plugin({
    view: () => ({ update: report }),
    props: {
      handleDOMEvents: {
        focus: (view) => void setTimeout(() => report(view)),
        blur: (view) => void report(view),
        compositionend: (view) => void setTimeout(() => report(view)),
      },
    },
  });
}

/* ---------- all of it ---------- */

export interface PluginOptions extends KeyOptions {
  onTyped: (t: Typed | null) => void;
}

export function notePlugins(opts: PluginOptions): Plugin[] {
  const keys = keymap({
    Enter: enter,
    'Shift-Enter': newLine,
    'Mod-Enter': newLine,
    Backspace: chainCommands(undoInputRule, backspace),
    Delete: deleteForward,
    'Mod-Backspace': chainCommands(undoInputRule, backspace),
    Tab: tab(false),
    'Shift-Tab': tab(true),
    ArrowDown: exitCode,
    'Mod-a': selectAll,
  });
  return [
    // the suggestions go first: while they're up, Enter picks one
    new Plugin({
      props: {
        handleKeyDown(view, e) {
          if (view.composing || e.isComposing || e.keyCode === 229) return false;
          if (opts.suggestKey(e)) return true;
          return shortcut(view, e, opts);
        },
        // a full stop, comma… typed just after a tag takes the place of the space the tag came with
        handleTextInput: (view, _from, _to, text) => tidyAfterTag(text)(view.state, view.dispatch),
        handleDOMEvents: {
          // undo and redo from a shake, or the keyboard's own buttons, are the note's
          beforeinput(view, e) {
            const type = (e as InputEvent).inputType;
            if (type !== 'historyUndo' && type !== 'historyRedo') return false;
            e.preventDefault();
            (type === 'historyUndo' ? undo : redo)(view.state, view.dispatch);
            return true;
          },
        },
      },
    }),
    inputRules({ rules: [...blockRules, markdownRule, autolink] }),
    keys,
    keymap(baseKeymap),
    history({ depth: 300, newGroupDelay: 1000 }),
    // the document is always one its text can say (lib/noteDoc/normalize.ts)
    new Plugin({
      appendTransaction: (trs, _old, state) => (trs.some((tr) => tr.docChanged) ? normalizeTr(state) : null),
    }),
    tags,
    suggest(opts.onTyped),
    gapCursor(),
    dropCursor({ color: 'var(--word-ink)', width: 2 }),
  ];
}
