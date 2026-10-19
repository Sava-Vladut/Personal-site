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
  canStep, dropTargets, findMedia, insertAtom, insertMediaAt, insertTrigger, linkAt, litOf, mediaList, mergeMedia, moveMedia,
  parseClipboardText, removeItem, removeMedia, replaceTyped, sameLit, setMediaLayout, stepMedia, takeOutItem, typedAt,
  ungroupMedia, type DropTarget, type LinkTarget, type Lit, type Typed,
} from '../lib/noteDoc/edit';
import { itemKey, itemsOf, mediaKey, type Item, type Layout, type Media } from '../lib/body';
import { bindCommands, type NoteCommands } from './commands';
import { MediaSlots, nodeViews, type MediaSlot } from './nodeViews';
import { tidyPasted, tidyPastedHTML } from './paste';
import { notePlugins } from './plugins';
import { t } from '../lib/i18n';

export type { DropTarget, Lit, Typed, MediaSlot, NoteCommands };

/** What the note editor can do with its words and pictures. Pictures go by their key (lib/body.ts mediaKey). */
export interface NoteBodyHandle {
  /** the ProseMirror view itself, for tests (scripts/test-notebody.mjs); the editor goes by the methods below */
  view: EditorView;
  /** the note's text now */
  text(): string;
  /** counts the document's changes */
  version(): number;
  /** puts a new text in, as one change to undo (only what differs is replaced) */
  setText(text: string): void;
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
  cmds: NoteCommands;
  media: {
    list(): Media[];
    /** at the caret, or at the end of the note (`atEnd`, or when it's never been written in) */
    insert(m: Media[], atEnd?: boolean): void;
    layout(key: string, l: Layout): void;
    remove(key: string): void;
    removeItem(item: Item): void;
    merge(from: string, onto: string): void;
    ungroup(key: string): void;
    takeOut(item: Item): void;
    step(key: string, dir: -1 | 1): void;
    canStep(key: string, dir: -1 | 1): boolean;
    /** the caret at the start of the words just after a picture */
    writeAfter(key: string): void;
    dropTargets(): DropTarget[];
    move(key: string, to: number, layout?: Layout): void;
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
  onMedia: (slots: MediaSlot[]) => void;
  /** whether a pasted picture is one the note holds (its photo or image is in the note's list) */
  knows: (m: Media) => boolean;
  onReady: (h: NoteBodyHandle | null) => void;
  /** the screen's margins the caret is kept out of (the ribbon, the bar above the keyboard) */
  margins: () => { top: number; bottom: number };
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
    const slots = new MediaSlots((s) => props.current.onMedia(s));
    const tellLit = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
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
          }),
          placeholder(),
          new Plugin({ props: { handleDOMEvents: { focus: () => void (placed = true) } } }),
        ],
      }),
      editable: () => props.current.editable,
      nodeViews: nodeViews(slots, () => settled),
      attributes: {
        class: 'note-editor md',
        role: 'textbox',
        'aria-multiline': 'true',
        'aria-label': t('Note'),
        spellcheck: 'true',
        autocapitalize: 'sentences',
      },
      scrollMargin: margin,
      scrollThreshold: margin,
      clipboardTextSerializer: (slice) => serializeSlice(slice),
      clipboardTextParser: (text, $context, plain) =>
        parseClipboardText(text, $context, plain, { media: (m) => (props.current.knows(m) && findMedia(view.state.doc, mediaKey(m)) < 0 ? m : null) }),
      transformPastedHTML: tidyPastedHTML,
      transformPasted: (slice) => tidyPasted(slice, known),
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
      // A tap on a tag opens its card (its own click) and leaves the caret just after it, never the tag selected (the
      // next key would replace it)
      handleClickOn(v, _pos, node, nodePos, _e, direct) {
        if (!direct || !v.editable || !/^(person|song|wiki)$/.test(node.type.name)) return false;
        v.dispatch(v.state.tr.setSelection(TextSelection.create(v.state.doc, nodePos + node.nodeSize)));
        return true;
      },
      // Ctrl+click (⌘ on a Mac) opens a link while writing, as in Word
      handleClick(v, _pos, e) {
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
      setText(text) {
        const next = normalizeDoc(parseNote(text, schema));
        if (!next.eq(view.state.doc)) view.dispatch(replaceDoc(view.state.tr, next));
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
      cmds: bindCommands(() => viewRef.current),
      media: {
        list: () => mediaList(view.state.doc).map((m) => m.media),
        insert: (m, atEnd) => void run(insertMediaAt(m, atEnd || !placed ? view.state.doc.content.size : undefined)),
        layout: (key, l) => void run(setMediaLayout(at(key), l)),
        remove: (key) => void run(removeMedia(at(key))),
        removeItem: (item) => void run(removeItem(holding(item), item)),
        merge: (from, onto) => void run(mergeMedia(at(from), at(onto))),
        ungroup: (key) => void run(ungroupMedia(at(key))),
        takeOut: (item) => void run(takeOutItem(holding(item), item)),
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
