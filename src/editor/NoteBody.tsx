// The note's words, pictures between them: one ProseMirror editor (lib/noteDoc for the document, ./plugins for how
// it behaves). Writing and reading are the same view, editable or not, so a tap in the reading view puts the caret
// right where it landed. The note's text is the document written back as Markdown, read by views/Editor.tsx through
// the handle this gives it: the editor only ever imports this, never ProseMirror.
import { useEffect, useLayoutEffect, useRef } from 'preact/hooks';
import { EditorState, Plugin, Selection, TextSelection, type Transaction } from '@tiptap/pm/state';
import { EditorView, Decoration, DecorationSet } from '@tiptap/pm/view';
import type { Node as PMNode } from '@tiptap/pm/model';
import { normalizeDoc, noteSchema, parseNote, replaceDoc, serializeNote, serializeSlice } from '../lib/noteDoc';
import {
  canStep, clearFind, commentAt, commentsOf, commentsState, deleteComment, dropTargets, focusComment, saveComment, selectComment, findMedia, findOf, findStep, goToFootnote, goToReference, headingAt, headingsOf, insertAtom, insertMediaAt, insertTrigger, isCell,
  linkAt, litOf, mediaList, mergeMedia, moveItemInto, moveItemOut, moveMedia, parseClipboardText, removeItem, removeMedia, reorderItem, replaceAll,
  replaceCurrent, replaceItem, replaceTyped, sameLit, setFind,
  setMediaLayout, setMediaMeta, stepMedia, takeOutItem, typedAt, ungroupMedia, type Comment, type DropTarget, type FindQuery, type Heading, type LinkTarget, type Lit,
  type TableAction, type Typed,
} from '../lib/noteDoc/edit';
import { dropComments } from '../lib/comments';
import { itemKey, itemsOf, mediaKey, type Item, type Layout, type Media, type Meta } from '../lib/body';
import { bindCommands, type NoteCommands } from './commands';
import { MediaSlots, nodeViews, type MediaSlot } from './nodeViews';
import { dropPreviewPlugin, setDropPreview, type DropPreview } from './dropPreview';
import { tidyPasted, tidyPastedHTML } from './paste';
import { notePlugins } from './plugins';
import type { RefKind } from '../lib/refs';
import { t } from '../lib/i18n';

export type { DropTarget, DropPreview, Lit, Typed, MediaSlot, NoteCommands, FindQuery, Heading, TableAction, Comment };

/** What Find has found: how many, and which is the current one (0-based; -1 when none is yet). */
export interface FindInfo { count: number; current: number }
/** The note's headings, and the one the caret is under (-1: above the first). */
export interface Outline { headings: Heading[]; current: number }
/**
 * The note's comments (each known by where its words start), a new one's words while it's being written, the comment
 * whose box has the focus, and the one at the caret.
 */
export interface Comments { list: Comment[]; draft: { from: number; to: number } | null; focus: number | null; current: number | null }

/** What the note editor can do with its words and pictures. Pictures go by their key (lib/body.ts mediaKey). */
export interface NoteBodyHandle {
  /** the ProseMirror view itself, for tests (scripts/test-notebody.mjs); the editor goes by the methods below */
  view: EditorView;
  /** the note's text now */
  text(): string;
  /** counts the document's changes */
  version(): number;
  /**
   * puts a new text in (only what differs is replaced): one change to undo, or with `undoable` false (a newer copy
   * from sync) none, so undo never takes the words back to what this device had before
   */
  setText(text: string, undoable?: boolean): void;
  focused(): boolean;
  /** brings the caret back into view (after the keyboard or a bar came up over it) */
  reveal(): void;
  setEditable(on: boolean): void;
  /** the caret at the start or end of the note, or at a position (the caret where it was, without one) */
  focus(at?: 'start' | 'end' | number): void;
  /** the position under a point on the screen */
  posAt(x: number, y: number): number | null;
  /** the selection, to put back after a sheet or a wait */
  selection(): { from: number; to: number };
  /** the @query or [[query typed before the caret */
  typed(): Typed | null;
  /** types @ or [[ at the caret (a space before it when it'd stick to a word) and reads what's typed */
  trigger(sigil: '@' | '[['): Typed | null;
  /** swaps what was typed for a tag's token; false when the text there changed */
  pick(typed: Typed, token: string): boolean;
  /** puts a tag's token in at the caret (at the end of the note when it isn't in the words) */
  insertToken(token: string, atEnd?: boolean): void;
  /** the screen range of the document between two positions, for the burst after a tag lands */
  rangeOf(from: number, to: number): Range | null;
  linkAt(): LinkTarget;
  lit(): Lit;
  /** tells `fn` the ribbon's lit state whenever it changes (at most once a frame) */
  watch(fn: (lit: Lit) => void): () => void;
  /** tells `fn` the selected text (as the note writes it), null with nothing selected, whenever it changes */
  watchSelection(fn: (text: string | null) => void): () => void;
  cmds: NoteCommands;
  /** Find and Replace (components/FindBar.tsx): what's found is lit in the text while the bar is open */
  find: {
    /** looks for `q` from the caret on */
    set(q: FindQuery): FindInfo;
    /** Find Next (1) or Previous (-1): the match selected and brought into view */
    step(dir: 1 | -1): FindInfo;
    /** Replace: the current match (once it's selected) becomes `text`, and the next one is selected */
    replace(text: string): FindInfo;
    /** Replace All, as one change to undo: how many were replaced */
    replaceAll(text: string): number;
    /** the bar closed: nothing lit, the current match selected and the focus back in the text */
    close(): void;
    /** the selected words when they're on one line (what the bar starts with, as in Word), else '' */
    selected(): string;
  };
  /** tells `fn` what Find has found whenever it changes (the note changing included) */
  watchFind(fn: (info: FindInfo) => void): () => void;
  /** the Navigation pane's headings */
  outline: {
    get(): Outline;
    /** the caret at the start of the heading at `pos`, brought into view */
    go(pos: number): void;
    /** tells `fn` the outline whenever it (or the heading the caret is under) changes */
    watch(fn: (o: Outline) => void): () => void;
  };
  /** Review's comments (components/CommentsPane.tsx) */
  comments: {
    get(): Comments;
    /** tells `fn` the comments whenever they (or the one at the caret) change */
    watch(fn: (c: Comments) => void): () => void;
    /** the comment (or the draft) starting at `at` says `text` now; saying nothing, it goes */
    save(at: number, text: string): void;
    remove(at: number): void;
    /** its words selected and brought into view */
    select(at: number): void;
    /** its box has the focus (null: none has), its words lit */
    focus(at: number | null): void;
    /** where a position is on the screen (its line's top and bottom), for the boxes beside the text */
    coords(pos: number): { top: number; bottom: number } | null;
    /** the words between two positions, as plain text (a comment's words, quoted in its sheet) */
    words(from: number, to: number): string;
  };
  media: {
    list(): Media[];
    /** at the caret, or at the end of the note (`atEnd`, or when it's never been written in) */
    insert(m: Media[], atEnd?: boolean): void;
    layout(key: string, l: Layout): void;
    /** a caption or alt text (empty words take it off) */
    meta(key: string, meta: Meta): void;
    remove(key: string): void;
    removeItem(item: Item): void;
    /** `from` dropped on `onto`: side by side, at place `at` among its pictures (after them without one) */
    merge(from: string, onto: string, at?: number): void;
    ungroup(key: string): void;
    takeOut(item: Item): void;
    /** one picture of a row: to place `at` among the row's, out on its own at a drop place, or into another picture */
    reorder(item: Item, at: number): void;
    moveOut(item: Item, to: number, layout?: Layout): void;
    moveInto(item: Item, onto: string, at?: number): void;
    /** another picture where `item` is, with its layout, caption and alt text */
    replace(item: Item, next: Item): void;
    step(key: string, dir: -1 | 1): void;
    canStep(key: string, dir: -1 | 1): boolean;
    /** the caret at the start of the words just after a picture */
    writeAfter(key: string): void;
    /** the position before a picture, or -1 */
    posOf(key: string): number;
    dropTargets(): DropTarget[];
    move(key: string, to: number, layout?: Layout): void;
    /** where a picture being dragged would land, drawn in the note (null: nothing drawn) */
    preview(p: DropPreview | null): void;
  };
}

interface Props {
  text: string;
  editable: boolean;
  /** the document changed (typing, a command, a picture): the text is to be saved */
  onChange: () => void;
  onTyped: (t: Typed | null) => void;
  /** keys go to the suggestions first, while they're up: true when they took it */
  suggestKey: (e: KeyboardEvent) => boolean;
  onLink: () => void;
  /** Ctrl+S: the note saved now */
  onSave: () => void;
  /** Ctrl+F, Ctrl+H: the find bar, to find or to replace */
  onFind?: (mode: 'find' | 'replace') => void;
  onMedia: (slots: MediaSlot[]) => void;
  /** whether a pasted picture is one the note holds (its photo or image is in the note's list) */
  knows: (m: Media) => boolean;
  onReady: (h: NoteBodyHandle | null) => void;
  /** the screen's margins the caret is kept out of (the ribbon, the bar above the keyboard) */
  margins: () => { top: number; bottom: number };
  /** a tap on a comment's words (where it starts): on a phone, its sheet opens */
  onCommentTap?: (at: number) => void;
  /** a mind trap's, law's or principle's tag to change: its sheet opens, the tag selected (what's picked takes its place) */
  onRef?: (kind: RefKind) => void;
}

/**
 * Whether a paste is pictures to add (the page adds them, views/Editor.tsx): image files, and no words beside them.
 * Word, Excel and others put a picture of what was copied on the clipboard with its text: that pastes as text.
 */
export function pastesPictures(data: DataTransfer | null): boolean {
  const files = [...(data?.files ?? [])];
  if (!files.some((f) => /^image\//.test(f.type) || /\.(heic|heif|avif|webp)$/i.test(f.name))) return false;
  // a picture copied from a page comes with an <img> as its HTML and no words: still a picture
  const words = (data?.getData('text/html') ?? '').replace(/<(style|script)[\s\S]*?<\/\1>/gi, '').replace(/<[^>]*>/g, '').replace(/&nbsp;|\s/g, '');
  const plain = (data?.getData('text/plain') ?? '').trim();
  // (some browsers add the picture's address as its plain text)
  return !((plain && !/^https?:\/\/\S+$/.test(plain)) || words);
}

/** "What's on your mind?" in an empty note, "Keep writing…" on an empty line after a picture at the end. */
function placeholder(): Plugin {
  return new Plugin({
    props: {
      decorations(state) {
        const doc = state.doc;
        const last = doc.lastChild;
        if (doc.childCount === 1 && last?.type.name === 'paragraph' && !last.content.size) {
          return DecorationSet.create(doc, [Decoration.node(0, last.nodeSize, { class: 'is-empty', 'data-placeholder': t('What’s on your mind?') })]);
        }
        const before = doc.childCount > 1 ? doc.child(doc.childCount - 2) : null;
        if (last?.type.name === 'paragraph' && !last.content.size && before?.type.name === 'media') {
          const at = doc.content.size - last.nodeSize;
          return DecorationSet.create(doc, [Decoration.node(at, doc.content.size, { class: 'is-empty', 'data-placeholder': t('Keep writing…') })]);
        }
        return null;
      },
    },
  });
}

export function NoteBody(p: Props) {
  const host = useRef<HTMLDivElement>(null);
  const props = useRef(p);
  props.current = p;
  const viewRef = useRef<EditorView | null>(null);

  // made before the page paints (a layout effect), so the note opens with its words and pictures in place, not a frame
  // later with everything under the title moving down
  useLayoutEffect(() => {
    const el = host.current!;
    const schema = noteSchema();
    let version = 0;
    let placed = false; // the caret's been put in the words (before that, it's only at the start by default)
    let frame = 0;
    let lit: Lit | null = null;
    let settled = false; // the note has opened: tags drawn from now on don't play the opening sheen
    const settle = setTimeout(() => void (settled = true), 1500);
    const watchers = new Set<(l: Lit) => void>();
    const findWatchers = new Set<(f: FindInfo) => void>();
    const outlineWatchers = new Set<(o: Outline) => void>();
    const commentWatchers = new Set<(c: Comments) => void>();
    let comments: string | null = null;
    let found = '';
    let outline: Outline | null = null;
    let outlineAt = '';
    const findInfo = (): FindInfo => {
      const f = findOf(view.state);
      return { count: f?.matches.length ?? 0, current: f?.current ?? -1 };
    };
    const outlineNow = (): Outline => {
      const headings = headingsOf(view.state.doc);
      return { headings, current: headingAt(headings, view.state.selection.from) };
    };
    const commentsNow = (): Comments => {
      const st = commentsState(view.state);
      return { list: commentsOf(view.state.doc), draft: st.draft, focus: st.focus, current: commentAt(view.state)?.from ?? null };
    };
    const selWatchers = new Set<(text: string | null) => void>();
    let selText: string | null = null;
    let selAt = '';
    const selectedText = () => {
      const sel = view.state.selection;
      return sel.empty ? null : serializeSlice(sel.content());
    };
    const slots = new MediaSlots((s) => props.current.onMedia(s));
    const tellLit = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        // the selection's text only read again when the selection or the document moved
        const at = view.state.selection.empty ? '' : `${view.state.selection.from}:${view.state.selection.to}:${version}`;
        if (selWatchers.size && at !== selAt) {
          selAt = at;
          const text = selectedText();
          if (text !== selText) {
            selText = text;
            selWatchers.forEach((fn) => fn(text));
          }
        }
        if (findWatchers.size) {
          const f = findInfo();
          const key = `${f.count}:${f.current}`;
          if (key !== found) {
            found = key;
            findWatchers.forEach((fn) => fn(f));
          }
        }
        // the outline read again only when the note or the caret moved
        const oAt = `${version}:${view.state.selection.from}`;
        if (outlineWatchers.size && oAt !== outlineAt) {
          outlineAt = oAt;
          const o = outlineNow();
          if (!outline || JSON.stringify(o) !== JSON.stringify(outline)) {
            outline = o;
            outlineWatchers.forEach((fn) => fn(o));
          }
        }
        if (commentWatchers.size) {
          const c = commentsNow();
          const key = JSON.stringify(c);
          if (key !== comments) {
            comments = key;
            commentWatchers.forEach((fn) => fn(c));
          }
        }
        const next = litOf(view.state);
        if (lit && sameLit(lit, next)) return;
        lit = next;
        watchers.forEach((fn) => fn(next));
      });
    };
    const known = (node: PMNode) => {
      const m = node.attrs.media as Media | null;
      return !!m && props.current.knows(m) && findMedia(view.state.doc, mediaKey(m)) < 0;
    };
    const margin = {
      get top() { return props.current.margins().top; },
      get bottom() { return props.current.margins().bottom; },
      left: 0,
      right: 0,
    };

    const view: EditorView = new EditorView(el, {
      state: EditorState.create({
        doc: normalizeDoc(parseNote(props.current.text, schema)),
        plugins: [
          ...notePlugins({
            onTyped: (typed) => props.current.onTyped(typed),
            suggestKey: (e) => props.current.suggestKey(e),
            link: () => props.current.onLink(),
            save: () => props.current.onSave(),
            find: (mode) => props.current.onFind?.(mode),
          }),
          placeholder(),
          dropPreviewPlugin(),
          new Plugin({ props: { handleDOMEvents: { focus: () => void (placed = true) } } }),
        ],
      }),
      editable: () => props.current.editable,
      nodeViews: nodeViews(slots, () => settled, { ref: (kind) => props.current.onRef?.(kind) }),
      attributes: {
        class: 'note-editor md',
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-label': t('Note'),
        spellcheck: 'true',
        autocorrect: 'on',
        autocapitalize: 'sentences',
      },
      scrollMargin: margin,
      scrollThreshold: margin,
      // as plain text (for other apps) comments are left out: they're private. Copied from one note to another they
      // come along, in the HTML (the comment mark's data-comment)
      clipboardTextSerializer: (slice) => dropComments(serializeSlice(slice)),
      clipboardTextParser: (text, $context, plain) =>
        parseClipboardText(text, $context, plain, { media: (m) => (props.current.knows(m) && findMedia(view.state.doc, mediaKey(m)) < 0 ? m : null) }),
      transformPastedHTML: tidyPastedHTML,
      transformPasted: (slice, v) => tidyPasted(slice, known, isCell(v.state.selection.$from.parent)),
      // pictures pasted or dropped as files are the page's to add (views/Editor.tsx), where the caret is
      // — unless there are words too: Word and Excel put a picture of what was copied beside its text, and the text wins
      handlePaste: (_v, e) => pastesPictures(e.clipboardData),
      handleDrop(v, e) {
        if (!(e as DragEvent).dataTransfer?.files.length) return false;
        const at = v.posAtCoords({ left: (e as DragEvent).clientX, top: (e as DragEvent).clientY });
        if (at) {
          placed = true;
          v.dispatch(v.state.tr.setSelection(textNear(v.state.doc, at.pos)));
        }
        return true;
      },
      // A tap on a tag opens its card (its own click) and leaves the caret beside it, on the side tapped (a tag at the
      // start of a line can have words put before it), never the tag selected (the next key would replace it). While
      // reading, the tag isn't selected either.
      handleClickOn(v, _pos, node, nodePos, e, direct) {
        if (!direct || !/^(person|song|wiki)$/.test(node.type.name)) return false;
        if (!v.editable) return true;
        const r = (v.nodeDOM(nodePos) as HTMLElement | null)?.getBoundingClientRect();
        const before = !!r && r.width > 0 && e.clientX < r.left + r.width / 2;
        v.dispatch(v.state.tr.setSelection(TextSelection.create(v.state.doc, before ? nodePos : nodePos + node.nodeSize)));
        return true;
      },
      // Ctrl+click (⌘ on a Mac) opens a link while writing, as in Word. A footnote's reference goes to its text, and the
      // text's number back to the reference (the caret goes there while writing; reading, the page scrolls there)
      handleClick(v, pos, e) {
        // a tap on a comment's words: its sheet, on a phone (the caret goes there all the same)
        const onComment = props.current.onCommentTap;
        if (onComment && (e.target as Element | null)?.closest?.('.cm')) {
          const c = commentAt(v.state, pos);
          if (c) onComment(c.from);
        }
        const fn = (e.target as Element | null)?.closest?.('.fn-ref, .md-fn-num');
        const label = fn?.closest('[data-fn]')?.getAttribute('data-fn');
        if (fn && label) {
          const toText = fn.classList.contains('fn-ref');
          if (v.editable) (toText ? goToFootnote(label) : goToReference(label))(v.state, v.dispatch);
          else v.dom.querySelector(toText ? `.md-fn[data-fn="${label}"]` : `.fn-ref[data-fn="${label}"]`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
          return true;
        }
        const a = (e.target as Element | null)?.closest?.('a[href]') as HTMLAnchorElement | null;
        if (!a || !v.editable || !(e.ctrlKey || e.metaKey)) return false;
        open(a.href, '_blank', 'noopener');
        return true;
      },
      dispatchTransaction(tr: Transaction) {
        const before = view.state;
        view.updateState(view.state.apply(tr));
        if (view.state.doc !== before.doc) {
          version++;
          slots.changed();
          props.current.onChange();
        }
        tellLit();
      },
    });
    viewRef.current = view;

    const run = (cmd: (s: EditorState, d: (tr: Transaction) => void) => boolean) => cmd(view.state, view.dispatch);
    const at = (key: string) => findMedia(view.state.doc, key);
    const holding = (item: Item) => mediaList(view.state.doc).find((m) => itemsOf(m.media).some((x) => itemKey(x) === itemKey(item)))?.pos ?? -1;
    // A caret in words, never a divider or a tag selected whole (the next key would replace it)
    const textNear = (doc: PMNode, pos: number) => {
      const $p = doc.resolve(Math.max(0, Math.min(pos, doc.content.size)));
      return Selection.findFrom($p, 1, true) ?? Selection.findFrom($p, -1, true) ?? Selection.near($p);
    };
    const caretAt = (pos: number) => {
      placed = true;
      view.dispatch(view.state.tr.setSelection(textNear(view.state.doc, pos)).scrollIntoView());
    };
    /**
     * The caret at the start of the note, or at its end: on a line of its own after a divider that ends it (and, with
     * `plain`, after a code block: a tag can't go in code), so what's typed never replaces the divider.
     */
    const caretAtEdge = (end: boolean, plain = false) => {
      const tr = view.state.tr;
      const last = tr.doc.lastChild;
      if (end && last && (last.isAtom || (plain && last.type.spec.code))) tr.insert(tr.doc.content.size, schema.nodes.paragraph.create());
      const doc = tr.doc;
      tr.setSelection(end ? Selection.findFrom(doc.resolve(doc.content.size), -1, true) ?? Selection.atEnd(doc)
        : Selection.findFrom(doc.resolve(0), 1, true) ?? Selection.atStart(doc));
      placed = true;
      view.dispatch(tr.scrollIntoView());
    };

    const handle: NoteBodyHandle = {
      view,
      text: () => serializeNote(view.state.doc),
      version: () => version,
      setText(text, undoable = true) {
        const next = normalizeDoc(parseNote(text, schema));
        if (!next.eq(view.state.doc)) view.dispatch(replaceDoc(view.state.tr, next).setMeta('addToHistory', undoable));
      },
      focused: () => view.hasFocus(),
      reveal() {
        if (!view.isDestroyed) view.dispatch(view.state.tr.scrollIntoView());
      },
      setEditable(on) {
        if (view.editable === on) return;
        view.setProps({ editable: () => on });
      },
      focus(where) {
        // the caret first, then the focus: the browser's selection lands once, where it's meant to (not at the old
        // caret first, which can make iOS scroll there)
        if (where === 'start' || where === 'end') caretAtEdge(where === 'end');
        else if (where !== undefined) caretAt(where);
        view.focus();
      },
      posAt(x, y) {
        return view.posAtCoords({ left: x, top: y })?.pos ?? null;
      },
      selection: () => ({ from: view.state.selection.from, to: view.state.selection.to }),
      typed: () => typedAt(view.state),
      trigger(sigil) {
        if (!run(insertTrigger(sigil))) return null;
        return typedAt(view.state);
      },
      pick: (typed, token) => run(replaceTyped(typed, token)),
      insertToken(token, atEnd) {
        if (atEnd) caretAtEdge(true, true);
        if (!run(insertAtom(token))) {
          caretAtEdge(true, true);
          run(insertAtom(token));
        }
        // in the same tap as the sheet's pick: the keyboard comes (back) up on iOS
        if (view.editable) view.focus();
      },
      rangeOf(from, to) {
        try {
          const a = view.domAtPos(from), b = view.domAtPos(to);
          const r = document.createRange();
          r.setStart(a.node, a.offset);
          r.setEnd(b.node, b.offset);
          return r;
        } catch {
          return null;
        }
      },
      linkAt: () => linkAt(view.state),
      lit: () => (lit ??= litOf(view.state)),
      watch(fn) {
        watchers.add(fn);
        fn(handle.lit());
        return () => watchers.delete(fn);
      },
      watchSelection(fn) {
        selWatchers.add(fn);
        selText = selectedText();
        selAt = view.state.selection.empty ? '' : `${view.state.selection.from}:${view.state.selection.to}:${version}`;
        fn(selText);
        return () => selWatchers.delete(fn);
      },
      cmds: bindCommands(() => viewRef.current),
      find: {
        set(q) {
          run(setFind(q));
          return findInfo();
        },
        step(dir) {
          run(findStep(dir));
          return findInfo();
        },
        replace(text) {
          if (view.editable) run(replaceCurrent(text));
          return findInfo();
        },
        replaceAll: (text) => (view.editable ? replaceAll(view.state, view.dispatch, text) : 0),
        close() {
          const f = findOf(view.state);
          const m = f && f.current >= 0 ? f.matches[f.current] : null;
          const tr = view.state.tr;
          if (m) tr.setSelection(TextSelection.create(tr.doc, m.from, m.to)).scrollIntoView();
          view.dispatch(tr);
          run(clearFind);
          if (view.editable) {
            placed = true;
            view.focus();
          }
        },
        selected() {
          const { from, to, empty } = view.state.selection;
          if (empty) return '';
          const words = view.state.doc.textBetween(from, to, '\n', '');
          return words.includes('\n') || words.length > 255 ? '' : words;
        },
      },
      watchFind(fn) {
        findWatchers.add(fn);
        const f = findInfo();
        found = `${f.count}:${f.current}`;
        fn(f);
        return () => findWatchers.delete(fn);
      },
      outline: {
        get: () => outlineNow(),
        go(pos) {
          const node = view.state.doc.nodeAt(pos);
          if (!node) return;
          placed = true;
          view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, pos + 1)).scrollIntoView());
          if (view.editable) view.focus();
        },
        watch(fn) {
          outlineWatchers.add(fn);
          outline = outlineNow();
          outlineAt = `${version}:${view.state.selection.from}`;
          fn(outline);
          return () => outlineWatchers.delete(fn);
        },
      },
      comments: {
        get: () => commentsNow(),
        watch(fn) {
          commentWatchers.add(fn);
          const c = commentsNow();
          comments = JSON.stringify(c);
          fn(c);
          return () => commentWatchers.delete(fn);
        },
        save: (at, text) => void run(saveComment(at, text)),
        remove: (at) => void run(deleteComment(at)),
        select: (at) => void run(selectComment(at)),
        focus: (at) => void run(focusComment(at)),
        coords(pos) {
          try {
            const r = view.coordsAtPos(Math.max(0, Math.min(pos, view.state.doc.content.size)), 1);
            return { top: r.top, bottom: r.bottom };
          } catch {
            return null;
          }
        },
        words(from, to) {
          const size = view.state.doc.content.size;
          return view.state.doc.textBetween(Math.max(0, from), Math.min(size, to), ' ', (n) => n.attrs.label ?? '');
        },
      },
      media: {
        list: () => mediaList(view.state.doc).map((m) => m.media),
        insert: (m, atEnd) => void run(insertMediaAt(m, atEnd || !placed ? view.state.doc.content.size : undefined)),
        layout: (key, l) => void run(setMediaLayout(at(key), l)),
        meta: (key, meta) => void run(setMediaMeta(at(key), meta)),
        remove: (key) => void run(removeMedia(at(key))),
        removeItem: (item) => void run(removeItem(holding(item), item)),
        merge: (from, onto, k) => void run(mergeMedia(at(from), at(onto), k)),
        ungroup: (key) => void run(ungroupMedia(at(key))),
        takeOut: (item) => void run(takeOutItem(holding(item), item)),
        reorder: (item, k) => void run(reorderItem(holding(item), item, k)),
        moveOut: (item, to, layout) => void run(moveItemOut(holding(item), item, to, layout)),
        moveInto: (item, onto, k) => void run(moveItemInto(holding(item), item, at(onto), k)),
        replace: (item, next) => void run(replaceItem(holding(item), item, next)),
        posOf: at,
        preview: (p) => view.dispatch(setDropPreview(view.state, p)),
        step: (key, dir) => void run(stepMedia(at(key), dir)),
        canStep: (key, dir) => at(key) >= 0 && canStep(view.state, at(key), dir),
        writeAfter(key) {
          const pos = at(key);
          if (pos < 0) return;
          const node = view.state.doc.nodeAt(pos)!;
          placed = true;
          view.dispatch(view.state.tr.setSelection(TextSelection.near(view.state.doc.resolve(pos + node.nodeSize), 1)).scrollIntoView());
          view.focus();
        },
        dropTargets: () => dropTargets(view),
        move: (key, to, layout) => void run(moveMedia(at(key), to, layout)),
      },
    };
    props.current.onReady(handle);
    slots.flush();

    return () => {
      clearTimeout(settle);
      cancelAnimationFrame(frame);
      slots.destroy();
      props.current.onReady(null);
      view.destroy();
      viewRef.current = null;
    };
  }, []);

  // reading and writing: the same view, editable or not
  useEffect(() => {
    const v = viewRef.current;
    if (v && v.editable !== p.editable) v.setProps({ editable: () => p.editable });
  }, [p.editable]);

  return <div ref={host} class="note-editor-host" />;
}
