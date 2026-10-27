// What the note editor does on top of ProseMirror's own editing: Markdown typed at the start of a line or around words
// becomes what it writes, the keys behave as in Word and Notion, the document's shape is kept writable as text, #tags
// show as tags, and what's typed after an @ (or [[) is reported for the suggestions.
// The pure parts (what each key and rule does to the document) are in lib/noteDoc/edit, tested in Node.
import { NodeSelection, Plugin, PluginKey, TextSelection, type Command, type Transaction } from '@tiptap/pm/state';
import { Mark, type Node as PMNode } from '@tiptap/pm/model';
import { Decoration, DecorationSet, type EditorView } from '@tiptap/pm/view';
import { InputRule, inputRules, undoInputRule } from '@tiptap/pm/inputrules';
import { keymap } from '@tiptap/pm/keymap';
import { baseKeymap, chainCommands, selectAll } from '@tiptap/pm/commands';
import { history, redo, undo } from '@tiptap/pm/history';
import { gapCursor } from '@tiptap/pm/gapcursor';
import { dropCursor } from '@tiptap/pm/dropcursor';
import { normalizeTr, parseInline, BARE } from '../lib/noteDoc';
import {
  AUTOCORRECT, BLOCK_RULES, backspace, deleteForward, enter, exitCode, findOf, findPlugin, findStep, footnotesOf, hasFootnotes, moveBlocks, newLine, noteCommands, paint, painterOf,
  painterPlugin, renumberChanged, stopPainter, tab, tidyAfterTag, typedAt, type BlockRule, type Typed,
} from '../lib/noteDoc/edit';

/* ---------- typing Markdown ---------- */

/**
 * Inline Markdown closed as it's typed: **bold**, *italic*, ~~strike~~, ==highlight==, `code`, [words](address), a
 * tag written out in full (@[Ann], ♪[Song], [[Note]]) and a footnote's reference ([^1]). What was typed is read with the note's own parser, so it
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
    // a footnote's reference, [^1] (not the start of a [[link]])
    String.raw`(?<![\\[])\[\^[\w-]+\]`,
  ].join('|') + ')$',
  'u',
);

/** The styles a pair of markers puts on what's between them, by the marker. */
const WRAPS: [string, string][] = [['**', 'bold'], ['~~', 'strike'], ['==', 'highlight'], ['*', 'italic']];

const markdownRule = new InputRule(INLINE, (state, match, start, end) => {
  const $s = state.doc.resolve(start);
  if ($s.parent.type.spec.code || $s.marks().some((m) => m.type.name === 'code')) return null;
  // What's between the markers may hold styles of its own already (a link, code, a word in bold): read again from its
  // letters, they'd be lost. Then the markers go and the style goes on, around what's there. A marker written as
  // itself (\*) never pairs.
  const base = $s.marks();
  let mixed = false, escaped = false;
  state.doc.nodesBetween(start, end, (n) => {
    if (!n.isInline) return true;
    if (n.marks.some((m) => m.type.name === 'escaped')) escaped = true;
    if (!Mark.sameSet(n.marks, base)) mixed = true;
    return false;
  });
  if (escaped) return null;
  if (mixed) {
    const wrap = WRAPS.find(([d]) => match[0].startsWith(d) && match[0].endsWith(d) && match[0].length > 2 * d.length);
    if (!wrap) return null;
    const [d, name] = wrap;
    const typed = match[0].length - (end - start); // the closing marker's letters not in the document yet
    const closeIn = d.length - typed;
    const tr = state.tr.delete(end - closeIn, end).delete(start, start + d.length);
    const to = end - closeIn - d.length;
    tr.addMark(start, to, state.schema.marks[name].create());
    return tr.setSelection(TextSelection.create(tr.doc, to)).setStoredMarks(base.filter((m) => m.type.name !== 'escaped'));
  }
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
  const tr = state.tr.addMark(start, start + url.length, link);
  // the space is typed now, or (a phone's keyboard ending a word) in the document already
  if (end - start < match[0].length) tr.insertText(match[2], end);
  return tr.setStoredMarks($s.marks());
});

const asInputRule = (rule: BlockRule) => new InputRule(rule.find, (state, match, start, end) => {
  const tr = state.tr;
  return rule.apply(tr, match, start, end) ? tr : null;
});
const blockRules = BLOCK_RULES.map(asInputRule);
/** Word's AutoCorrect (curly quotes, dashes, …, ©): after the Markdown rules, so a [link](c) stays a link. */
const autocorrect = AUTOCORRECT.map(asInputRule);

/* ---------- keys ---------- */

export interface KeyOptions {
  /** the Link sheet (Ctrl+K) */
  link: () => void;
  /** saves the note now and says so (Ctrl+S) */
  save: () => void;
  /** while an @'s suggestions are up, they have the arrows, Enter, Tab and Escape: true when they took the key */
  suggestKey: (e: KeyboardEvent) => boolean;
  /** the find bar: Find (Ctrl+F) or Replace (Ctrl+H); without it, those keys are the browser's */
  find?: (mode: 'find' | 'replace') => void;
}

/** Word's shortcuts. AltGr is Ctrl+Alt to the browser and types characters on many keyboards: never a style. */
function shortcut(view: EditorView, e: KeyboardEvent, opts: KeyOptions): boolean {
  const mod = e.ctrlKey || e.metaKey;
  // F3 and Shift+F3: the next and the previous match while the find bar is open, as in Word
  if (e.key === 'F3' && !mod && !e.altKey && findOf(view.state)) return findStep(e.shiftKey ? -1 : 1)(view.state, view.dispatch);
  if (!mod) return false;
  const code = e.code;
  // by the letter's key where the layout's letter isn't Latin (Cyrillic, Greek…): Ctrl+B is bold there too
  const typed = e.key.toLowerCase();
  const k = /^[a-z]$/.test(typed) || !/^Key[A-Z]$/.test(code) ? typed : code.slice(3).toLowerCase();
  let cmd: Command | null = null;
  // Ctrl++ superscript, Ctrl+= subscript, as in Word: by the character where the layout has it, else by the key
  const sup = typed === '+' || (typed !== '=' && code === 'Equal' && e.shiftKey);
  const sub = !sup && (typed === '=' || code === 'Equal');
  if (!e.altKey && (sup || sub)) cmd = noteCommands.mark(sup ? 'sup' : 'sub');
  else if (e.altKey && !e.shiftKey) {
    if (e.getModifierState?.('AltGraph')) return false;
    if (/^Digit[0-6]$/.test(code)) cmd = noteCommands.style(code === 'Digit0' ? 'normal' : (('h' + code.slice(5)) as 'h1'));
    // Ctrl+Alt+F: a footnote (by the key: Alt changes the letter typed on a Mac)
    else if (code === 'KeyF' || k === 'f') cmd = noteCommands.footnote;
  } else if (e.shiftKey && !e.altKey) {
    if (k === 'x') cmd = noteCommands.mark('strike');
    // inline code moved here from Ctrl+E, which centres as in Word
    else if (k === 'e') cmd = noteCommands.mark('code');
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
    // alignment, as in Word (Ctrl+E centres; again, back to the left). Ctrl+R never reloads the page from the text,
    // nor Ctrl+L or Ctrl+J go to the address bar or the downloads, even on a line that can't be aligned (a list)
    else if (k === 'l') cmd = noteCommands.align('left', true);
    else if (k === 'e') cmd = noteCommands.align('center', true);
    else if (k === 'r') cmd = noteCommands.align('right', true);
    else if (k === 'j') cmd = noteCommands.align('justify', true);
    else if (k === 'z') cmd = undo;
    else if (k === 'y' && !e.metaKey) cmd = redo;
    // Find (the browser's own find for the page, when the note has no find bar) and Replace, as in Word
    else if ((k === 'f' || k === 'h') && opts.find) {
      opts.find(k === 'f' ? 'find' : 'replace');
      return true;
    }
    else if (k === 'u') cmd = noteCommands.mark('underline');
    else if (k === 'k') {
      opts.link();
      return true;
    }
    // saving and printing are the note's, never the browser's page saved or printed whole
    else if (k === 's') {
      opts.save();
      return true;
    } else if (k === 'p') {
      print();
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

/* ---------- footnotes ---------- */

/**
 * Each footnote's number, by where it's first referred to (lib/noteDoc/edit/footnotes.ts), put in --fn on its
 * references and its text for CSS to show. A text nothing refers to shows its label, faded (.is-orphan); a reference
 * whose text is gone is marked too (.is-missing).
 */
export function footnoteDecorations(doc: PMNode): DecorationSet {
  if (!hasFootnotes(doc)) return DecorationSet.empty;
  const { num, refs, defs } = footnotesOf(doc);
  const defined = new Set(defs.map((d) => d.label));
  const found: Decoration[] = [];
  for (const r of refs) {
    found.push(Decoration.node(r.pos, r.pos + 1, { style: `--fn: "${num.get(r.label)}"`, ...(!defined.has(r.label) && { class: 'is-missing' }) }));
  }
  for (const d of defs) {
    const n = num.get(d.label);
    found.push(Decoration.node(d.pos, d.pos + d.node.nodeSize, n ? { style: `--fn: "${n}"` } : { style: `--fn: "${d.label}"`, class: 'is-orphan' }));
  }
  return DecorationSet.create(doc, found);
}

/** Whether a change put a footnote or a reference in (looked for only where it changed the document). */
function addsFootnotes(tr: Transaction): boolean {
  let found = false;
  const size = tr.doc.content.size;
  tr.mapping.maps.forEach((map, i) => {
    map.forEach((_a, _b, from, to) => {
      const rest = tr.mapping.slice(i + 1);
      const a = rest.map(from, -1), b = rest.map(to, 1);
      if (found || b <= a) return;
      tr.doc.nodesBetween(Math.max(0, a), Math.min(size, b), (n) => {
        if (n.type.name === 'footnote' || n.type.name === 'footnoteRef') found = true;
        return !found;
      });
    });
  });
  return found;
}

const footnotesKey = new PluginKey<DecorationSet>('footnotes');
const footnotes = new Plugin<DecorationSet>({
  key: footnotesKey,
  state: {
    init: (_, state) => footnoteDecorations(state.doc),
    // a note without footnotes isn't read through again on every key, only what each change put in
    apply: (tr, old) => (!tr.docChanged ? old : old === DecorationSet.empty && !addsFootnotes(tr) ? old : footnoteDecorations(tr.doc)),
  },
  props: { decorations: (state) => footnotesKey.getState(state) },
});

/* ---------- tags in a selection ---------- */

const CHIP = /^(person|song|wiki)$/;

/**
 * The tags inside a selection light up with it: a phone draws no selection colour over a chip, so without this a
 * stretch of text being selected for copying looks as if it stopped at the first tag.
 */
const chipsInRange = new Plugin({
  // and while reading, Tab goes from tag to tag; while writing, a press on one mustn't take the focus from the words
  view(view) {
    let was: boolean | null = null;
    const sync = () => {
      if (was === view.editable) return;
      was = view.editable;
      for (const el of view.dom.querySelectorAll<HTMLElement>('.note-chip [role="button"]')) {
        if (view.editable) el.removeAttribute('tabindex');
        else el.tabIndex = 0;
      }
    };
    sync();
    return { update: sync };
  },
  props: {
    decorations(state) {
      const sel = state.selection;
      if (sel.empty || sel instanceof NodeSelection) return null;
      const found: Decoration[] = [];
      state.doc.nodesBetween(sel.from, sel.to, (n, pos) => {
        if (CHIP.test(n.type.name) && pos >= sel.from && pos + n.nodeSize <= sel.to) found.push(Decoration.node(pos, pos + n.nodeSize, { class: 'is-in-range' }));
      });
      return found.length ? DecorationSet.create(state.doc, found) : null;
    },
  },
});

/* ---------- suggestions ---------- */

/**
 * Reports the @query (or [[query) typed just before the caret, or null, after each change of the text or the caret
 * (only with nothing selected). A word being composed (a phone's keyboard composes every word on Android) is read as
 * it's typed too: ProseMirror keeps its document up to date meanwhile, and the suggestions narrow letter by letter
 * instead of going away until the word ends.
 */
function suggest(onTyped: (t: Typed | null) => void): Plugin {
  let last: string | null = null;
  const report = (view: EditorView) => {
    const typed = !view.hasFocus() ? null : typedAt(view.state);
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
    // a page break, as in Word (in code, a new line)
    'Mod-Enter': chainCommands(noteCommands.insert('pagebreak'), newLine),
    Backspace: chainCommands(undoInputRule, backspace),
    Delete: deleteForward,
    'Mod-Backspace': chainCommands(undoInputRule, backspace),
    Tab: tab(false),
    'Shift-Tab': tab(true),
    ArrowDown: exitCode,
    // the line (or the selected lines) up or down past the block beside it, as in Word
    'Alt-Shift-ArrowUp': moveBlocks(-1),
    'Alt-Shift-ArrowDown': moveBlocks(1),
    'Mod-a': selectAll,
  });
  return [
    // the suggestions go first: while they're up, Enter picks one
    new Plugin({
      props: {
        handleKeyDown(view, e) {
          if (view.composing || e.isComposing || e.keyCode === 229) return false;
          if (opts.suggestKey(e)) return true;
          // Esc puts the Format Painter away
          if (e.key === 'Escape' && stopPainter(view.state, view.dispatch)) return true;
          return shortcut(view, e, opts);
        },
        // A full stop, comma… typed just after a tag takes the place of the space the tag came with: only when it's
        // typed at the caret. A phone's keyboard can put it in elsewhere, as iOS's double-space full stop turns the
        // tag's space into ". " (the "." lands before that space, the caret after it): that stays as written.
        handleTextInput: (view, from, to, text) => {
          const sel = view.state.selection;
          return from === to && sel.empty && sel.from === from && tidyAfterTag(text)(view.state, view.dispatch);
        },
        handleDOMEvents: {
          // the Format Painter paints what's selected when the mouse lets go (once ProseMirror has the selection),
          // or when Shift does after selecting with the keys
          mouseup(view) {
            if (painterOf(view.state)) setTimeout(() => painterOf(view.state) && paint(view.state, view.dispatch));
            return false;
          },
          keyup(view, e) {
            if (e.key === 'Shift' && painterOf(view.state) && !view.state.selection.empty) paint(view.state, view.dispatch);
            return false;
          },
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
    inputRules({ rules: [...blockRules, markdownRule, autolink, ...autocorrect] }),
    keys,
    keymap(baseKeymap),
    history({ depth: 300, newGroupDelay: 1000 }),
    // the document is always one its text can say (lib/noteDoc/normalize.ts)
    new Plugin({
      appendTransaction: (trs, _old, state) => (trs.some((tr) => tr.docChanged) ? normalizeTr(state) : null),
    }),
    // numbered lists count again wherever a change touched their lines (deleting a selection, joining, pasting, a drag)
    new Plugin({ appendTransaction: (trs, _old, state) => renumberChanged(trs, state) }),
    tags,
    footnotes,
    // what Find finds, lit (lib/noteDoc/edit/find.ts)
    findPlugin(),
    chipsInRange,
    painterPlugin(),
    // the pointer shows a brush while the Format Painter is on
    new Plugin({ props: { attributes: (state): Record<string, string> => (painterOf(state) ? { class: 'is-painting' } : {}) } }),
    suggest(opts.onTyped),
    gapCursor(),
    dropCursor({ color: 'var(--word-ink)', width: 2 }),
  ];
}
