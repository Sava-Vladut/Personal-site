import { Fragment } from 'preact';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { flushSync } from 'preact/compat';
import { rangeLabel, timeLabel } from '../lib/dates';
import { goBack, navigate } from '../lib/router';
import { bodyOf, canStep, findItem, insertMedia, itemKey, itemOf, itemsOf, mediaKey, mergeMedia, moveMedia, plainText, removeItem, removeMedia, sameMedia, serializeBody, setLayout, stepMedia, takeOut, ungroup, type Body, type Item, type Layout, type Media } from '../lib/body';
import { editable, PLAIN } from '../lib/editable';
import { imageSrc } from '../lib/images';
import { deleteKey, listKey, shortcutKey, toggleTask, toggleTaskAt } from '../lib/markdown';
import type { Kind } from '../lib/history';
import { addPhotos, photoUrl } from '../lib/photos';
import { findBook, mentionOf } from '../lib/books';
import { linkedFrom, linkOf, linkRanges, noteLabel, suggestLinks, typedLink, type LinkSuggestion } from '../lib/links';
import { connectSpotify } from '../lib/spotify';
import {
  blankEntry, blankPerson, deleteEntry, getBooks, getEntries, getPeople, getSongs, isEmpty, saveEntry, savePerson, toast, useBooks, useEntries, usePeople, useSongs,
  type Book, type Entry, type Person,
} from '../lib/store';
import { mentionOfPerson, mentionOfSong, mentionsIn, suggest, typedMention, type Suggestion } from '../lib/mentions';
import { CHART_ORDER, coreOf } from '../data/emotions';
import { openViewer } from '../lib/viewer';
import { contextNow, fillWeather, needsWeather } from '../lib/weather';
import { BookSheet } from '../components/books';
import { FormatBar } from '../components/FormatBar';
import { ShareSheet } from '../components/ShareSheet';
import { takeDown } from '../lib/share';
import { ImageSearchSheet } from '../components/ImageSearchSheet';
import { IconSheet } from '../components/IconPicker';
import { Icon, NoteIcon } from '../components/icons';
import { Sheet } from '../components/Sheet';
import { Markdown } from '../components/Markdown';
import { CoverImg, DetailsSummary, NoteDetails } from '../components/NoteDetails';
import { dropLayout, dropTargets, MediaBlock, MediaTools, sideAt, type DropTarget, type Side } from '../components/NoteMedia';
import { MusicDeck } from '../components/music';
import { burst, MentionStrip } from '../components/mentions';
import { SpotifySheet } from '../components/SpotifySheet';
import { NoteStatus, type SaveState } from '../components/NoteStatus';
import { applyDocView, useDocView } from '../lib/docView';
import '../styles/notes.css';
import '../styles/ribbon.css';
import '../styles/document.css';
import { t } from '../lib/i18n';
import { haptic } from '../lib/haptics';

type Open = null | 'icon' | 'images' | 'spotify' | 'book' | 'share' | 'more' | 'music';
/** An @tag or a [[ link being typed: where it starts, where the caret is and what's been typed. */
type Typed = { start: number; end: number; q: string; link?: boolean };
const personNameKey = (name: string) => name.trim().normalize('NFC').toLowerCase();

/** The highlight each kind of tag is coloured with while writing: people in the colour of the feeling they bring. */
const highlights = () => ['mm-at-book', 'mm-at-song', 'mm-at-note', 'mm-at-note-id', 'mm-at-none', ...CHART_ORDER.map((id) => `mm-at-${id}`)];
const highlightRegistry = () => (typeof CSS === 'undefined' ? undefined : (CSS as unknown as { highlights?: Map<string, unknown> }).highlights);

const MAX_PHOTOS = 20;
const isImageFile = (f: File) => f.type.startsWith('image/') || /\.(heic|heif|avif|webp)$/i.test(f.name);

function fit(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
}

/** Keeps the title box as tall as its text, again when the window is resized. */
function useAutosize(value: string) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => fit(ref.current), [value]);
  useEffect(() => {
    const on = () => fit(ref.current);
    addEventListener('resize', on);
    return () => removeEventListener('resize', on);
  }, []);
  return ref;
}

/** What an input event did, for undo (lib/history.ts): letters typed (a space ends a word), letters deleted, or more. */
function kindOf(e: Event): Kind {
  const { inputType: type, data } = e as InputEvent;
  if (type === 'insertText' || type === 'insertCompositionText') return data && /\s$/.test(data) ? 'space' : 'type';
  return type === 'deleteContentBackward' || type === 'deleteContentForward' ? 'delete' : 'other';
}

/**
 * Where a tap on a stretch of formatted text (the reading view) landed in its Markdown, as near as can be told: the
 * words under the finger are found in the text, after as many characters as show before them. Undefined when it
 * can't be told.
 */
function tappedAt(e: MouseEvent, text: string) {
  const d = document as Document & { caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null };
  let node: Node | undefined, offset = 0;
  const p = d.caretPositionFromPoint?.(e.clientX, e.clientY);
  if (p) (node = p.offsetNode), (offset = p.offset);
  else {
    const r = document.caretRangeFromPoint?.(e.clientX, e.clientY);
    if (r) (node = r.startContainer), (offset = r.startOffset);
  }
  const host = e.currentTarget as HTMLElement;
  if (!node || node.nodeType !== Node.TEXT_NODE || !host.contains(node)) return;
  const words = (node as Text).data;
  let shown = 0; // the characters that show before it; its Markdown can only have more
  const tw = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);
  for (let n = tw.nextNode(); n && n !== node; n = tw.nextNode()) shown += (n as Text).data.length;
  const at = text.indexOf(words, Math.min(shown, text.length));
  return at < 0 ? undefined : at + Math.min(offset, words.length);
}

/**
 * One stretch of the note's text, between pictures. A plain-text editable block, not a textarea, so that its lines
 * wrap around a picture floated beside it. Its Markdown shows styled as it's typed: after each change, the lines whose
 * styling changed are laid out again (lib/editable.ts); the rest stays the browser's own. It keeps its own undo, and
 * the keys behave as in Notion and Word (lib/markdown.ts).
 */
function BodyText({ value, onChange, onCaret, onMention, onKey, placeholder, grow, textRef, suggestionsOpen, activeSuggestion }: {
  value: string;
  onChange: (v: string) => void;
  onCaret: (pos: number) => void;
  /** an @tag (or a [[ link) being typed before the caret, or null */
  onMention: (m: Typed | null) => void;
  /** keys go here first; true means it was handled */
  onKey: (e: KeyboardEvent) => boolean;
  placeholder?: string;
  grow?: boolean;
  textRef?: (el: HTMLDivElement | null) => void;
  suggestionsOpen?: boolean;
  activeSuggestion?: string;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const composing = useRef(false);
  const frame = useRef(0);
  // the text a "[] " turned into a task made, and the caret then: Backspace straight after takes it back
  const converted = useRef<{ text: string; at: number } | null>(null);
  const handlers = useRef({ onCaret, onMention });
  handlers.current = { onCaret, onMention };
  const readCaret = () => {
    const el = ref.current;
    if (!el || document.activeElement !== el) return;
    const box = editable(el);
    if (!composing.current) box.settle();
    const start = box.selectionStart;
    handlers.current.onCaret(start);
    handlers.current.onMention(!composing.current && getSelection()?.isCollapsed !== false && start === box.selectionEnd ? typedMention(box.value, start) ?? typedLink(box.value, start) : null);
  };
  const queueCaret = () => {
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(readCaret);
  };
  useEffect(() => {
    // On iOS the selection can move after `input`, without a keyup event.
    document.addEventListener('selectionchange', readCaret);
    return () => {
      document.removeEventListener('selectionchange', readCaret);
      cancelAnimationFrame(frame.current);
    };
  }, []);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || composing.current) return;
    const box = editable(el);
    if (box.value === value) return;
    const focused = document.activeElement === el;
    const start = box.selectionStart, end = box.selectionEnd;
    box.value = value;
    if (focused) box.setSelectionRange(start, end);
  }, [value]);
  const caret = (e: Event) => {
    const el = e.currentTarget as HTMLDivElement;
    if (e.type === 'blur') {
      editable(el).settle();
      onMention(null);
      cancelAnimationFrame(frame.current);
    }
    if (document.activeElement !== el && e.type !== 'blur') return;
    if (e.type === 'blur') onCaret(editable(el).selectionStart);
    else {
      readCaret();
      queueCaret();
    }
  };
  /** After the text changed: lays it out again, keeps the change for undo, and passes the text on. */
  const changed = (el: HTMLDivElement, kind: Kind, typed: boolean) => {
    const box = editable(el);
    box.tidy();
    box.record(kind);
    converted.current = null;
    // "[] " at the start of a line becomes a task
    if (typed && shortcutKey(box)) converted.current = { text: box.value, at: box.selectionStart };
    onChange(box.value);
  };
  const history = (el: HTMLDivElement, redo: boolean) => {
    const box = editable(el);
    converted.current = null;
    if (!(redo ? box.redo() : box.undo())) return;
    onChange(box.value);
    readCaret();
  };
  const pressed = useRef<HTMLElement | null>(null); // a task's box, while a finger is on it
  const taskAt = (e: Event) => (e.target as Element | null)?.closest?.('.md-task-mark') as HTMLElement | null;
  const tick = (e: Event) => {
    const mark = taskAt(e);
    const el = ref.current;
    if (!mark || !el) return;
    const box = editable(el);
    toggleTaskAt(box, box.offsetOf(mark), document.activeElement === el);
  };
  return (
    <div
      ref={(el) => { ref.current = el; textRef?.(el); }}
      class={`body-input${grow ? ' grow' : ''}${value ? '' : ' is-empty'}`}
      contentEditable={PLAIN ? 'plaintext-only' : 'true'}
      role="textbox"
      aria-multiline="true"
      aria-label={t('Note')}
      aria-autocomplete="list"
      aria-controls={suggestionsOpen ? 'mention-suggestions' : undefined}
      aria-expanded={!!suggestionsOpen}
      aria-activedescendant={suggestionsOpen ? activeSuggestion : undefined}
      data-placeholder={placeholder}
      spellcheck
      onInput={(e) => {
        const el = e.currentTarget;
        // while a word is being composed (a phone's keyboard, an IME), the browser's text is left alone until it's done
        if (composing.current || (e as InputEvent).isComposing) onChange(editable(el).value);
        else changed(el, kindOf(e), (e as InputEvent).inputType === 'insertText' && (e as InputEvent).data === ' ');
        caret(e);
      }}
      onCompositionStart={() => {
        composing.current = true;
        if (ref.current) editable(ref.current).before();
        onMention(null);
      }}
      onCompositionEnd={(e) => {
        composing.current = false;
        const el = e.currentTarget;
        changed(el, /\s$/.test(e.data ?? '') ? 'space' : 'type', / $/.test(e.data ?? ''));
        caret(e);
      }}
      onBeforeInput={(e) => {
        const el = e.currentTarget;
        const box = editable(el);
        // undo and redo are the note's own, from the keyboard, a shake or the keyboard's own buttons
        if (e.inputType === 'historyUndo' || e.inputType === 'historyRedo') {
          e.preventDefault();
          history(el, e.inputType === 'historyRedo');
          return;
        }
        if (composing.current || e.isComposing) return;
        box.before();
        const back = e.inputType === 'deleteContentBackward';
        // Backspace straight after "[] " became a task gives back what was typed
        const c = converted.current;
        if (back && c && c.text === box.value && c.at === box.selectionStart && box.selectionEnd === c.at) {
          e.preventDefault();
          history(el, false);
          return;
        }
        if ((back || e.inputType === 'deleteContentForward') && deleteKey(box, back)) {
          e.preventDefault();
          return;
        }
        // Enter from a keyboard that doesn't say which key it was (Android) carries lists on all the same
        if ((e.inputType === 'insertParagraph' || e.inputType === 'insertLineBreak')
          && listKey(box, { key: 'Enter', shiftKey: e.inputType === 'insertLineBreak' } as KeyboardEvent)) {
          e.preventDefault();
          return;
        }
        // browsers without plain-text editing: no bold, lists or pasted formatting, and Enter makes a line break
        if (PLAIN) return;
        if (e.inputType.startsWith('format')) e.preventDefault();
        else if (e.inputType === 'insertParagraph') {
          e.preventDefault();
          box.edit(() => document.execCommand('insertText', false, '\n'));
        }
      }}
      onPaste={(e) => {
        if (PLAIN || e.clipboardData?.files.length) return; // pictures are the page's to add
        e.preventDefault();
        const text = e.clipboardData?.getData('text/plain') ?? '';
        editable(e.currentTarget).edit(() => document.execCommand('insertText', false, text));
      }}
      onKeyDown={(e) => {
        if (composing.current || e.isComposing || e.keyCode === 229) return;
        const el = e.currentTarget;
        const k = e.key.toLowerCase();
        // Ctrl/Cmd+Z undoes, Shift+Ctrl/Cmd+Z and Ctrl+Y redo
        if ((e.metaKey || e.ctrlKey) && !e.altKey && (k === 'z' || (k === 'y' && e.ctrlKey && !e.metaKey))) {
          e.preventDefault();
          history(el, k === 'y' || e.shiftKey);
          return;
        }
        if (onKey(e) || listKey(editable(el), e)) e.preventDefault();
      }}
      onKeyUp={(e) => !['Enter', 'Tab', 'Escape'].includes(e.key) && caret(e)}
      onPointerUp={caret}
      // a task's box ticks it, without moving the caret or bringing the keyboard up
      onMouseDown={(e) => taskAt(e) && e.preventDefault()}
      onTouchStart={(e) => {
        pressed.current = taskAt(e);
        if (pressed.current) e.preventDefault();
      }}
      onTouchEnd={(e) => {
        if (pressed.current && pressed.current === taskAt(e)) tick(e);
        pressed.current = null;
      }}
      onClick={(e) => taskAt(e) && tick(e)}
      onFocus={(e) => {
        editable(e.currentTarget).before();
        caret(e);
      }}
      onBlur={caret}
    />
  );
}

export function Editor({ id, query }: { id: string; query?: URLSearchParams }) {
  const [draft, setDraft] = useState<Entry | null>(() => {
    if (id !== 'new') return getEntries().find((e) => e.id === id) ?? null;
    // "Write about …" from a person's page starts the note already tagged with them; from a book's, mentioning it;
    // from a song's, with the song in it.
    const pid = query?.get('person');
    const book = findBook(query?.get('book') ?? '');
    const song = getSongs().find((s) => s.id === query?.get('song'));
    return {
      ...blankEntry('note'), people: pid && getPeople().some((p) => p.id === pid) ? [pid] : [], text: book ? mentionOf(book, getBooks()) + ' ' : '',
      music: song ? [song.music] : [],
    };
  });
  const [open, setOpen] = useState<Open>(null);
  const [adding, setAdding] = useState(0);
  const [coverAdding, setCoverAdding] = useState(false);
  const [dropping, setDropping] = useState(false);
  const [sel, setSel] = useState<string | null>(null); // the selected picture's mediaKey
  // a picture being dragged, and where it would land: how far down the note, on which side, and its size there
  // — or the picture it's over, to make an album with
  const [moving, setMoving] = useState<{ key: string; y: number; side: Side; layout: Layout; ratio: number; onto: string | null } | null>(null);
  const [details, setDetails] = useState(false); // the Feelings page
  // an @tag (or [[ link) being typed: in which text block, where its @ is and what follows it; and which suggestion is picked
  const [mention, setMentionState] = useState<({ seg: number } & Typed) | null>(null);
  const [pickAt, setPickAt] = useState(0);
  const dismissed = useRef(''); // which @ Escape put away, as block:position
  const pickingMention = useRef(false);
  const people = usePeople();
  const shelf = useBooks();
  const songs = useSongs();
  const allEntries = useEntries();
  // Notes that already have words open formatted, to read; the pencil (or a tap on the words) switches to writing.
  const [reading, setReading] = useState(() => !!draft && id !== 'new' && !!plainText(draft.text).trim());
  const fileRef = useRef<HTMLInputElement>(null);
  const saved = useRef(id !== 'new');
  const dirty = useRef(false);
  const saveRequest = useRef(0);
  const pendingSave = useRef<Promise<boolean> | null>(null);
  const leaving = useRef(false);
  const contextStarted = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const latest = useRef(draft);
  latest.current = draft;
  // what the status bar says about saving: only shown, never consulted, so saving works exactly as without it
  const [saveState, setSaveState] = useState<SaveState>(id !== 'new' ? 'saved' : 'idle');
  // the notes that link here, shown at the bottom. Saving while writing hands over a new list of entries, but unless
  // another note changed (or this one's title, which links can point at) what links here can't have, so the scan of
  // every note is skipped.
  const backlinkCache = useRef<{ key: string; list: Entry[]; shelf: Book[]; out: ReturnType<typeof linkedFrom> } | null>(null);
  const backlinks = useMemo(() => {
    if (!draft) return [];
    const self = allEntries.find((e) => e.id === draft.id);
    const key = self ? `${self.kind}\n${self.title}\n${noteLabel(self)}` : '';
    const c = backlinkCache.current;
    if (c && c.key === key && c.shelf === shelf && c.list.length === allEntries.length && c.list.every((e, i) => e === allEntries[i] || e.id === draft.id)) return c.out;
    const out = linkedFrom(draft.id, allEntries, shelf);
    backlinkCache.current = { key, list: allEntries, shelf, out };
    return out;
  }, [draft?.id, allEntries, shelf]);

  const titleRef = useAutosize(draft?.title ?? '');
  // the page's zoom sets the title's size too: fit its box again when it changes
  const docView = useDocView();
  useLayoutEffect(() => fit(titleRef.current), [docView?.zoom]);
  // while the note is open, the page carries its zoom, Focus and ribbon (lib/docView.ts)
  // (before the first paint, so the floating Back and Done never flash over the ribbon)
  useLayoutEffect(() => applyDocView(), []);
  const textRef = useRef<HTMLDivElement | null>(null);
  const areas = useRef<(HTMLDivElement | null)[]>([]);
  const bodyRef = useRef<HTMLDivElement>(null);
  const alive = useRef(true);
  const removing = useRef(false);
  const pendingImports = useRef(0);
  const cancelMove = useRef<(() => void) | null>(null);
  // Where new pictures go: a text block of the body and the caret in it. -1 means the end of the note.
  const where = useRef({ seg: -1, pos: 0 });

  // Once a new note is saved, point the URL at it so a reload reopens it. Never rewrite a sheet's history entry.
  const syncUrl = () => {
    const d = latest.current;
    if (saved.current && d && !history.state?.mmSheet && location.hash === '#/note/new') history.replaceState(history.state, '', '#/note/' + d.id);
  };

  const flush = () => {
    clearTimeout(timer.current);
    const d = latest.current;
    if (removing.current || !d) return Promise.resolve(false);
    if (!dirty.current) return pendingSave.current ?? Promise.resolve(saved.current);
    dirty.current = false;
    if (!saved.current && isEmpty(d)) {
      if (alive.current) setSaveState('idle');
      return Promise.resolve(false); // don't keep blank notes
    }
    const request = ++saveRequest.current;
    const saving = saveEntry(d).then(() => {
      if (removing.current) return false;
      if (!saved.current && !contextStarted.current) {
        contextStarted.current = true;
        addPlaceAndWeather(d);
      }
      saved.current = true;
      if (alive.current) {
        syncUrl();
        if (request === saveRequest.current && !dirty.current) setSaveState('saved');
      }
      return true;
    }).catch(() => {
      if (removing.current || request !== saveRequest.current) return false;
      dirty.current = true;
      if (alive.current) setSaveState('error');
      toast(t('Couldn’t save this note. Try again.'));
      return false;
    }).finally(() => {
      if (pendingSave.current === saving) pendingSave.current = null;
    });
    pendingSave.current = saving;
    return saving;
  };

  /** Where you are and the weather, looked up once a new note is kept. Joins the draft if it's still open. */
  const addPlaceAndWeather = async (d: Entry) => {
    const patch = await contextNow(d).catch(() => null);
    if (!patch || removing.current) return;
    const unchanged = (cur: Entry) => cur.date === d.date && cur.time === d.time && cur.place?.lat === d.place?.lat && cur.place?.lon === d.place?.lon;
    if (alive.current && latest.current) {
      const now = latest.current;
      if (!unchanged(now)) return;
      update(patch.place && !now.place
        ? { place: patch.place, weather: patch.weather ?? null }
        : patch.weather && !now.weather ? { weather: patch.weather } : {});
    } else {
      const cur = getEntries().find((x) => x.id === d.id);
      if (cur && unchanged(cur)) saveEntry({ ...cur, place: cur.place ?? patch.place ?? null,
        weather: patch.place && !cur.place ? patch.weather ?? null : cur.weather ?? patch.weather ?? null,
      }).catch(() => toast(t('Couldn’t save the note’s weather.')));
    }
  };

  const update = (patch: Partial<Entry>) => {
    if (!alive.current || removing.current || !latest.current) return;
    latest.current = { ...latest.current, ...patch };
    setDraft(latest.current);
    dirty.current = true;
    setSaveState('saving');
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, 500);
  };

  useEffect(() => {
    const hide = () => document.visibilityState === 'hidden' && flush();
    document.addEventListener('visibilitychange', hide);
    addEventListener('popstate', syncUrl);
    // Back from logging in to Spotify (it returns to this note): say how it went and reopen the picker.
    const sp = query?.get('spotify');
    if (query?.get('person') || query?.get('book') || query?.get('song')) history.replaceState(history.state, '', '#/note/new');
    if (sp) {
      history.replaceState(history.state, '', location.hash.split('?')[0]);
      toast(sp === 'connected' ? t('Spotify connected') : sp === 'cancelled' ? t('Spotify login cancelled') : t('Couldn’t connect Spotify — try again'));
      if (sp === 'connected') setOpen('spotify');
    } else if (id === 'new') titleRef.current?.focus();
    return () => {
      alive.current = false;
      cancelMove.current?.();
      if (pendingImports.current && !removing.current) toast(t('Photo import cancelled because you left the note'));
      document.removeEventListener('visibilitychange', hide);
      removeEventListener('popstate', syncUrl);
      flush();
      // moved to another day, or written offline: that day's weather
      if (saved.current && !removing.current && latest.current && needsWeather(latest.current)) fillWeather();
    };
  }, []);

  // A selected picture lets go when you tap anywhere else, or press Escape.
  useEffect(() => {
    if (!sel) return;
    const down = (e: PointerEvent) => {
      if (!(e.target as Element).closest?.('.media.is-selected, .format-bar, .sheet, .toast, .pswp')) setSel(null);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.documentElement.classList.contains('sheet-open')) setSel(null);
    };
    document.addEventListener('pointerdown', down);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('pointerdown', down);
      document.removeEventListener('keydown', key);
    };
  }, [sel]);

  useEffect(() => setPickAt(0), [mention?.seg, mention?.start, mention?.q]);

  // Tags glow in their own colours while writing. These are CSS Custom Highlights: the text itself stays plain.
  useEffect(() => {
    const reg = highlightRegistry();
    const Make = (globalThis as unknown as { Highlight?: new (...r: Range[]) => unknown }).Highlight;
    if (!reg || !Make) return;
    const groups = new Map<string, Range[]>();
    if (!reading && draft)
      areas.current.slice(0, bodyOf(draft).texts.length).forEach((el) => {
        if (!el?.isConnected) return;
        const box = editable(el);
        const add = (name: string, start: number, end: number) => {
          if (!groups.has(name)) groups.set(name, []);
          groups.get(name)!.push(box.range(start, end));
        };
        for (const f of mentionsIn(box.value, people, shelf, songs)) add(f.kind === 'person' ? `mm-at-${f.core ?? 'none'}` : `mm-at-${f.kind}`, f.start, f.end);
        // a note link's note:<id>| fades back, leaving the title to read
        for (const l of linkRanges(box.value, allEntries, shelf)) {
          add('mm-at-note', l.start, l.end);
          if (l.label > l.start + 2) add('mm-at-note-id', l.start + 2, l.label);
        }
      });
    for (const name of highlights()) {
      const ranges = groups.get(name);
      if (ranges) reg.set(name, new Make(...ranges));
      else reg.delete(name);
    }
  }, [draft?.text, reading, people, shelf, songs, allEntries]);
  useEffect(() => () => {
    const reg = highlightRegistry();
    if (reg) highlights().forEach((n) => reg.delete(n));
  }, []);

  if (!draft)
    return (
      <div class="page">
        <div class="empty">
          <h2 class="title-s">{t('This note doesn’t exist')}</h2>
          <p>{t('It may have been deleted.')}</p>
          <button class="btn btn-primary" onClick={() => goBack()}>{t('Back to journal')}</button>
        </div>
      </div>
    );

  const remove = async () => {
    if (removing.current) return;
    haptic(12);
    removing.current = true;
    clearTimeout(timer.current);
    dirty.current = false;
    const pending = pendingSave.current;
    await pending;
    try {
      const removed = saved.current || pending ? await deleteEntry(draft.id) : null;
      takeDown(removed);
      if (alive.current) goBack();
      if (removed) toast(removed.kind === 'checkin' ? t('Check-in deleted') : t('Note deleted'), { label: t('Undo'), run: () => saveEntry({ ...removed, share: null }) });
    } catch {
      removing.current = false;
      dirty.current = true;
      toast(t('Couldn’t delete this note. Try again.'));
    }
  };

  const done = async () => {
    if (leaving.current) return;
    leaving.current = true;
    await flush();
    if (!dirty.current && alive.current && !removing.current) goBack();
    else leaving.current = false;
  };

  const addFiles = async (all: File[]) => {
    if (!alive.current || removing.current) return;
    const files = all.filter(isImageFile);
    if (!files.length) return;
    const room = MAX_PHOTOS - draft.photos.length - adding;
    if (room <= 0) return toast(t('A note can hold {n} photos', { n: MAX_PHOTOS }));
    const take = files.slice(0, room);
    pendingImports.current++;
    setAdding((n) => n + take.length);
    try {
      const { photos, failed } = await addPhotos(take);
      if (!alive.current || removing.current) return;
      const d = latest.current;
      if (d && photos.length) {
        const fit = photos.slice(0, MAX_PHOTOS - d.photos.length);
        update({ photos: [...d.photos, ...fit], text: place(bodyOf(d), fit.map((p) => ({ kind: 'photo', id: p.id }))) });
      }
      if (failed) toast(failed === take.length && failed === 1 ? t('Couldn’t read that image') : t('Couldn’t read {n} of the images', { n: failed }));
      else if (files.length > room) toast(t('Added {n} — a note can hold {max} photos', { n: take.length, max: MAX_PHOTOS }));
    } catch {
      if (alive.current && !removing.current) toast(t('Couldn’t save those photos. Please try again.'));
    } finally {
      pendingImports.current--;
      if (alive.current && !removing.current) setAdding((n) => n - take.length);
    }
  };

  const uploadCover = async (file: File | undefined) => {
    if (!file || !alive.current || removing.current) return;
    pendingImports.current++;
    setCoverAdding(true);
    try {
      const { photos } = await addPhotos([file]);
      if (!alive.current || removing.current) return;
      if (photos[0]) update({ cover: { photo: photos[0] } });
      else toast(t('Couldn’t read that image'));
    } catch {
      if (alive.current && !removing.current) toast(t('Couldn’t save that cover. Please try again.'));
    } finally {
      pendingImports.current--;
      if (alive.current && !removing.current) setCoverAdding(false);
    }
  };
  /** Inserts pictures where the caret was (or at the end), and moves the insert point after them. */
  const place = (b: Body, add: Media[]) => {
    const last = b.texts.length - 1;
    const { seg, pos } = where.current.seg < 0 || where.current.seg > last ? { seg: last, pos: b.texts[last].length } : where.current;
    where.current = { seg: seg + add.length, pos: 0 };
    return serializeBody(insertMedia(b, add, seg, pos));
  };
  const setText = (i: number, v: string) => {
    const d = latest.current;
    if (!d) return;
    const b = bodyOf(d);
    if (i < 0 || i >= b.texts.length || b.texts[i] === v) return;
    b.texts[i] = v;
    update({ text: serializeBody(b) });
  };
  const hasFiles = (e: DragEvent) => !!e.dataTransfer?.types.includes('Files');

  /** Rearranges the body's pictures. Carets from before the change no longer point anywhere useful. */
  const setBody = (b: Body) => {
    where.current = { seg: -1, pos: 0 };
    update({ text: serializeBody(b) });
  };

  /** Removes a picture — on its own or from its album — or a whole album, with Undo. */
  const removePicture = (target: Media | Item) => {
    const d = latest.current;
    if (!d) return;
    const b = bodyOf(d);
    const whole = target.kind === 'album' ? b.media.findIndex((x) => sameMedia(x, target)) : -1;
    const gone = itemsOf(target.kind === 'album' ? target : itemOf(target));
    const { i } = findItem(b, gone[0]);
    if (i < 0) return;
    const at = b.media[i];
    const alone = whole >= 0 || at.kind !== 'album'; // the picture's line goes with it
    const pos = b.texts[i].length + (b.texts[i] && b.texts[i + 1] ? 1 : 0); // where it sat in the joined text
    const isGone = (it: Item) => gone.some((g) => itemKey(g) === itemKey(it));
    const photos = d.photos.filter((p) => isGone({ kind: 'photo', id: p.id }));
    const images = d.images.filter((x) => isGone({ kind: 'image', url: x.url }));
    const after = serializeBody(alone ? removeMedia(b, at) : removeItem(b, gone[0]));
    where.current = { seg: -1, pos: 0 };
    update({ photos: d.photos.filter((p) => !photos.includes(p)), images: d.images.filter((x) => !images.includes(x)), text: after });
    setSel(null);
    setOpen(null);
    const restore = (e: Entry): Partial<Entry> => ({
      photos: [...e.photos, ...photos.filter((p) => !e.photos.some((x) => x.id === p.id))],
      images: [...e.images, ...images.filter((p) => !e.images.some((x) => x.url === p.url))],
      // untouched since: as it was. Otherwise the picture goes back where it was, or (from an album) at the end.
      text: e.text === after ? d.text : alone ? serializeBody(insertMedia(bodyOf(e), [at], i, pos)) : e.text,
    });
    toast(gone.length > 1 ? t('Album removed') : gone[0].kind === 'photo' ? t('Photo removed') : t('Image removed'), {
      label: t('Undo'),
      run: () => {
        if (alive.current) return latest.current && update(restore(latest.current));
        const e = getEntries().find((x) => x.id === d.id);
        if (e) saveEntry({ ...e, ...restore(e) });
      },
    });
  };

  /**
   * Picks a picture up: a small copy of it follows the finger (or pointer), and an outline shows where it would land —
   * which paragraph it goes before, and on which side: over the left or right third of the note it sits on that side
   * with the text wrapping around it, over the middle it's centred on its own. Dropped on another picture, the two
   * become an album (or it joins that album). Drops it on release; Escape cancels.
   */
  const startMove = (i: number, e: PointerEvent, el: HTMLElement) => {
    cancelMove.current?.();
    const bodyEl = bodyRef.current;
    const d = latest.current;
    if (!bodyEl || !d) return;
    const m = bodyOf(d).media[i];
    const key = mediaKey(m);
    const targets = dropTargets(areas.current.slice(0, bodyOf(d).texts.length));
    if (!targets.length) return;
    const r = el.getBoundingClientRect();
    const ratio = r.width / Math.max(1, r.height);

    // the copy under the finger, shrunk about the point that was grabbed
    const ghost = document.createElement('div');
    ghost.className = 'media-ghost';
    const pic = el.querySelector('.media-pic');
    if (pic) ghost.append(pic.cloneNode(true));
    const scale = Math.min(1, 150 / r.width, 150 / r.height);
    const ox = e.clientX - r.left, oy = e.clientY - r.top;
    Object.assign(ghost.style, { left: r.left + 'px', top: r.top + 'px', width: r.width + 'px', height: r.height + 'px', transformOrigin: `${ox}px ${oy}px` });
    document.body.append(ghost);
    // it lifts off the page, shrinking smoothly about the finger, then follows it without delay
    requestAnimationFrame(() => (ghost.style.scale = String(scale)));

    let target: DropTarget | null = null;
    let side: Side = 'center';
    let onto: string | null = null;
    let x = e.clientX, y = e.clientY;
    let frame = 0;
    let picked = false;
    const pick = () => {
      const col = bodyEl.getBoundingClientRect();
      const at = y + scrollY;
      // the nearest place to land; the one it's at holds on until another is clearly nearer
      const near = targets.reduce((a, b) => (Math.abs(b.y - at) < Math.abs(a.y - at) ? b : a));
      if (!target || Math.abs(near.y - at) + 14 < Math.abs(target.y - at)) target = near;
      side = sideAt(x, col, picked ? side : undefined);
      picked = true;
      // over another picture of this note (the copy under the finger lets touches through)
      const over = document.elementFromPoint(x, y)?.closest<HTMLElement>('.media');
      onto = over && over.parentElement === bodyEl && over.dataset.key !== key ? over.dataset.key! : null;
      ghost.style.translate = `${x - e.clientX}px ${y - e.clientY}px`;
      ghost.classList.toggle('is-merging', !!onto);
      setMoving({ key, y: target.y - (col.top + scrollY), side, layout: dropLayout(m, side), ratio, onto });
    };
    // Near the top or bottom of the screen the page scrolls along.
    const tick = () => {
      const edge = 90;
      const v = y < edge ? -(edge - y) / 4 : y > innerHeight - edge ? (y - innerHeight + edge) / 4 : 0;
      if (v) {
        scrollBy(0, v);
        pick();
      }
      frame = requestAnimationFrame(tick);
    };
    const move = (ev: PointerEvent) => {
      ev.preventDefault();
      x = ev.clientX;
      y = ev.clientY;
      pick();
    };
    const end = (drop: boolean) => {
      cancelMove.current = null;
      cancelAnimationFrame(frame);
      removeEventListener('pointermove', move);
      removeEventListener('pointerup', up);
      removeEventListener('pointercancel', cancel);
      removeEventListener('keydown', esc, true);
      document.documentElement.classList.remove('is-moving');
      const from = ghost.getBoundingClientRect();
      ghost.remove();
      setMoving(null);
      settle(key, from);
      const now = latest.current;
      if (!drop || !target || !now) return;
      const b = bodyOf(now);
      const j = b.media.findIndex((x) => mediaKey(x) === key);
      if (j < 0) return;
      const into = onto ? b.media.findIndex((x) => mediaKey(x) === onto) : -1;
      if (into >= 0) {
        const merged = mergeMedia(b, j, into);
        setBody(merged);
        setSel(mediaKey(merged.media[into > j ? into - 1 : into]));
        haptic(10);
        return;
      }
      let next = moveMedia(b, j, target.seg, target.pos);
      const k = next.media.findIndex((x) => mediaKey(x) === key);
      const was = next.media[k];
      const layout = dropLayout(was, side);
      if ((layout.size ?? 100) !== (was.size ?? 100) || (layout.size ?? 100) < 100 && layout.align !== was.align) next = setLayout(next, k, layout);
      if (next !== b) setBody(next);
    };
    const up = () => end(true);
    const cancel = () => end(false);
    cancelMove.current = cancel;
    const esc = (ev: KeyboardEvent) => {
      if (ev.key !== 'Escape') return;
      ev.stopPropagation();
      end(false);
    };
    addEventListener('pointermove', move, { passive: false });
    addEventListener('pointerup', up);
    addEventListener('pointercancel', cancel);
    addEventListener('keydown', esc, true);
    document.documentElement.classList.add('is-moving');
    (document.activeElement as HTMLElement | null)?.blur?.(); // the keyboard would only get in the way
    setSel(key);
    pick();
    frame = requestAnimationFrame(tick);
  };

  /** Glides a dropped picture from where it was let go (`from`, on screen) into its place in the note. */
  const settle = (key: string, from: DOMRect) => {
    requestAnimationFrame(() => requestAnimationFrame(() => {
      const el = bodyRef.current?.querySelector<HTMLElement>(`:scope > .media[data-key="${CSS.escape(key)}"]`);
      if (!el || !el.animate || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const to = el.getBoundingClientRect();
      if (!to.width || !to.height) return;
      const dx = from.left - to.left, dy = from.top - to.top;
      el.animate(
        [{ transformOrigin: '0 0', transform: `translate(${dx}px, ${dy}px) scale(${from.width / to.width}, ${from.height / to.height})` }, { transformOrigin: '0 0', transform: 'none' }],
        { duration: 340, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
      );
    }));
  };

  /** Opens the note's pictures full screen — every picture, albums opened out — at picture `k` of picture or album `i`. */
  const view = async (i: number, k = 0, el?: HTMLElement | null) => {
    const d = latest.current;
    if (!d) return;
    const b = bodyOf(d);
    const blocks = bodyRef.current ? [...bodyRef.current.querySelectorAll<HTMLElement>(':scope > .media')] : [];
    const name = d.title.trim().replace(/[\\/:*?"<>|]+/g, '').slice(0, 60) || 'photo';
    const flat = b.media.flatMap((m, mi) => itemsOf(m).map((it, j) => ({ it, mi, j, album: m.kind === 'album' })));
    const items = await Promise.all(
      flat.map(async ({ it, mi, j, album }) => {
        // what it grows out of: the tile (an album's hidden pictures, its last tile), or the picture
        const tiles = blocks[mi]?.querySelectorAll<HTMLElement>('.album-tile');
        const at = mi === i && j === k && el ? el : tiles?.length ? tiles[Math.min(j, tiles.length - 1)] : blocks[mi]?.querySelector<HTMLElement>('.media-pic');
        if (it.kind === 'photo') {
          const p = d.photos.find((x) => x.id === it.id);
          return { src: (await photoUrl(it.id)) ?? '', w: p?.w, h: p?.h, el: at, save: name, alt: t('Photo'), album, it };
        }
        const img = d.images.find((x) => x.url === it.url);
        return {
          src: img ? imageSrc(img, 'full') : it.url, w: img?.w, h: img?.h, el: at, link: img?.link, alt: img?.title || t('Image'), album, it,
          caption: img ? [img.title, img.credit].filter(Boolean).join(' — ') : undefined,
        };
      }),
    );
    if (!alive.current || removing.current) return;
    const shown = items.filter((x) => x.src);
    const start = items[flat.findIndex((f) => f.mi === i && f.j === k)];
    const now = () => latest.current && bodyOf(latest.current);
    openViewer(shown, Math.max(0, shown.indexOf(start)), reading ? {} : {
      onRemove: (n) => removePicture(shown[n].it),
      onTakeOut: (n) => {
        const b = now();
        const it = shown[n].it;
        const { i } = b ? findItem(b, it) : { i: -1 };
        if (b && i >= 0) {
          setBody(takeOut(b, i, it));
          setSel(itemKey(it));
        }
      },
    });
  };

  /** Switches to writing, with the caret at `pos` (or the end) of text block `seg` (or where it was). */
  const write = (seg?: number, pos?: number) => {
    const go = () => {
      const el = seg === undefined ? areas.current[Math.max(0, where.current.seg)] ?? textRef.current : areas.current[seg];
      if (!el) return;
      el.focus();
      if (seg !== undefined) {
        const box = editable(el);
        const at = pos ?? box.value.length;
        box.setSelectionRange(at, at);
      }
    };
    if (!reading) return go();
    // Render the editable before this touch ends: iOS only opens its keyboard for synchronous focus.
    flushSync(() => setReading(false));
    go();
  };
  /** Reading view and writing, back and forth (the More menu, the status bar). */
  const toggleReading = () => (reading ? write() : setReading(true));
  /**
   * A click on the empty paper below the words starts writing at the end, as in Word. Clicks beside a line are left
   * to the browser, and the notes linking here at the foot of the page keep theirs.
   */
  const clickPaper = (e: MouseEvent) => {
    const host = bodyRef.current;
    if (!host || (e.target !== e.currentTarget && e.target !== host) || !getSelection()?.isCollapsed) return;
    const words = host.lastElementChild?.getBoundingClientRect();
    const foot = (e.currentTarget as HTMLElement).querySelector('.backlinks')?.getBoundingClientRect();
    if (!words || e.clientY <= words.bottom || (foot && e.clientY >= foot.top)) return;
    write(last);
  };
  /** The text box the toolbar formats: the one being written in, or the last one that was. */
  const target = () => {
    const active = document.activeElement;
    const el = active instanceof HTMLDivElement && areas.current.includes(active) ? active : areas.current[where.current.seg] ?? areas.current[body.texts.length - 1];
    return el ? editable(el) : null;
  };

  /** Mentions a book where the caret was (or at the end of the note), as a link to it. */
  const mentionBook = (b: Book) => {
    const d = latest.current;
    if (!d) return;
    const bb = bodyOf(d);
    const end = bb.texts.length - 1;
    const { seg, pos } = reading || where.current.seg < 0 || where.current.seg > end ? { seg: end, pos: bb.texts[end].length } : where.current;
    const text = bb.texts[seg];
    const before = text.slice(0, pos), after = text.slice(pos);
    const add = (before && !/\s$/.test(before) ? ' ' : '') + mentionOf(b, getBooks()) + (/^\s/.test(after) ? '' : ' ');
    bb.texts[seg] = before + add + after;
    where.current = { seg, pos: pos + add.length };
    update({ text: serializeBody(bb) });
    setOpen(null);
  };

  /* ---------- @tags ---------- */

  const setMention = (seg: number, m: Typed | null) => {
    if (!m) dismissed.current = '';
    else if (dismissed.current === `${seg}:${m.start}`) m = null;
    setMentionState((cur) =>
      !m ? (cur?.seg === seg ? null : cur)
      : cur && cur.seg === seg && cur.start === m.start && cur.end === m.end && cur.q === m.q && !!cur.link === !!m.link ? cur
      : { seg, ...m });
  };
  const typing = mention;
  const suggestions: (Suggestion | LinkSuggestion)[] = !typing ? []
    : typing.link ? suggestLinks(typing.q, allEntries, shelf, draft.id)
    : suggest(typing.q, people, shelf, songs, allEntries);
  const canAdd = !!typing && !typing.link && typing.q.trim().length > 1 && !people.some((p) => personNameKey(p.name) === personNameKey(typing.q));
  const choices = suggestions.length + (canAdd ? 1 : 0);
  const activeChoice = Math.min(pickAt, Math.max(0, choices - 1));

  /**
   * Swaps the typed @query for the tag (or the [[query for the link), tags a person in the note too, and lets it land
   * with a little burst.
   */
  const pickMention = async (s: Suggestion | LinkSuggestion | 'new') => {
    const m = mention;
    const el = m && areas.current[m.seg];
    if (!m || !el || !latest.current || !alive.current || removing.current || pickingMention.current) return;
    const box = editable(el);
    const source = box.value;
    if (source.slice(m.start, m.end) !== (m.link ? '[[' : '@') + m.q) return setMentionState(null);
    // Keep the keyboard open in the original touch event; a later asynchronous focus cannot open it on iOS.
    box.focus({ preventScroll: true });
    const selection = { start: box.selectionStart, end: box.selectionEnd };
    let awaitedCreation = false;
    let person: Person | null = null;
    let token: string;
    let color = 'var(--ink)';
    if (s === 'new') {
      if (!canAdd) return;
      person = getPeople().find((p) => personNameKey(p.name) === personNameKey(m.q)) ?? null;
      if (!person) {
        pickingMention.current = true;
        awaitedCreation = true;
        try {
          person = await savePerson(blankPerson(m.q.trim()));
          toast(t('{name} added to People', { name: person.name }));
        } catch {
          toast(t('Couldn’t save this person. Try again.'));
          return;
        } finally {
          pickingMention.current = false;
        }
      }
      token = mentionOfPerson(person, getPeople());
    } else if (s.kind === 'person') {
      person = getPeople().find((p) => p.id === s.item.id) ?? null;
      if (!person) return setMentionState(null);
      token = mentionOfPerson(person, getPeople());
    } else if (s.kind === 'book') {
      const current = getBooks().find((b) => b.id === s.item.id);
      if (!current) return setMentionState(null);
      token = mentionOf(current, getBooks());
      color = '#c08a52';
    } else if (s.kind === 'note') {
      const current = getEntries().find((e) => e.id === s.item.id);
      if (!current) return setMentionState(null);
      token = linkOf(current);
      if (current.emotions[0]) color = `var(--emo-${coreOf(current.emotions[0]).id})`;
    } else {
      const current = getSongs().find((song) => song.id === s.item.id);
      if (!current) return setMentionState(null);
      token = mentionOfSong(current, getSongs());
      color = '#8a6cf0';
    }
    if (person?.emotions[0]) color = `var(--emo-${coreOf(person.emotions[0]).id})`;
    const d = latest.current;
    if (!alive.current || removing.current || !d || areas.current[m.seg] !== el || box.value !== source) return;
    if (awaitedCreation && (document.activeElement !== el || box.selectionStart !== selection.start || box.selectionEnd !== selection.end)) return;
    const b = bodyOf(d);
    if (b.texts[m.seg] !== source) return;
    const v = source;
    // a link typed inside brackets already closed takes their place
    const after = m.link && v.startsWith(']]', m.end) ? v.slice(m.end + 2) : v.slice(m.end);
    const insert = token + (/^\s/.test(after) ? '' : ' ');
    box.value = v.slice(0, m.start) + insert + after;
    box.setSelectionRange(m.start + insert.length, m.start + insert.length);
    where.current = { seg: m.seg, pos: m.start + insert.length };
    b.texts[m.seg] = box.value;
    update({ text: serializeBody(b), ...(person && !d.people.includes(person.id) ? { people: [...d.people, person.id] } : {}) });
    setMentionState(null);
    requestAnimationFrame(() => {
      const host = bodyRef.current;
      if (alive.current && host && el.isConnected && areas.current[m.seg] === el && box.value.slice(m.start, m.start + token.length) === token)
        burst(box.range(m.start, m.start + token.length), host, color);
    });
  };

  const mentionKey = (e: KeyboardEvent) => {
    if (e.isComposing) return false;
    if (!typing) return tidyAfterTag(e);
    if (e.key === 'Escape') {
      dismissed.current = `${typing.seg}:${typing.start}`;
      setMentionState(null);
      return true;
    }
    if (!choices) return false;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      setPickAt((i) => (i + (e.key === 'ArrowDown' ? 1 : -1) + choices) % choices);
      return true;
    }
    if (e.key === 'Enter' || e.key === 'Tab') {
      pickMention(activeChoice < suggestions.length ? suggestions[activeChoice] : 'new');
      return true;
    }
    return false;
  };

  /** A full stop, comma… typed just after a tag takes the place of the space the tag came with. */
  const tidyAfterTag = (e: KeyboardEvent) => {
    if (!/^[.,!?;:)]$/.test(e.key) || e.metaKey || e.ctrlKey || e.altKey) return false;
    const el = e.currentTarget as HTMLDivElement;
    const box = editable(el);
    const at = box.selectionStart;
    const i = areas.current.indexOf(el);
    if (i < 0 || at !== box.selectionEnd || !/(@\[[^\]\n]+\]|♪\[[^\]\n]+\]|\]\]) $/.test(box.value.slice(0, at))) return false;
    box.setRangeText(e.key, at - 1, at);
    box.setSelectionRange(at, at);
    setText(i, box.value);
    return true;
  };

  /** The @ and link buttons: type an @ (or [[) where the caret is (writing first, if reading), which brings up the suggestions. */
  const startMention = (sigil: '@' | '[[' = '@') => {
    const go = () => {
      const box = target();
      if (!box) return;
      const { selectionStart: a, selectionEnd: z } = box;
      box.focus();
      box.setSelectionRange(a, z);
      const original = box.value;
      const before = original.slice(0, a);
      const insert = (before && !/[\s([{]$/.test(before) ? ' ' : '') + sigil;
      try { document.execCommand('insertText', false, insert); } catch {}
      if (box.value === original) box.setRangeText(insert, a, z);
      const pos = a + insert.length;
      box.setSelectionRange(pos, pos);
      const seg = areas.current.findIndex((el) => el === box.el);
      if (seg >= 0) {
        setText(seg, box.value);
        where.current = { seg, pos };
        setMention(seg, sigil === '@' ? typedMention(box.value, pos) : typedLink(box.value, pos));
      }
    };
    if (!reading) return go();
    flushSync(() => setReading(false));
    go();
  };

  const close = () => setOpen(null);
  const isCheckin = draft.kind === 'checkin';
  const body = bodyOf(draft);

  const last = body.texts.length - 1;
  const selIndex = reading || !sel ? -1 : body.media.findIndex((m) => mediaKey(m) === sel);

  return (
    <div
      class={`page editor${dropping ? ' is-dropping' : ''}`}
      onDragOver={(e) => { if (hasFiles(e)) { e.preventDefault(); e.dataTransfer!.dropEffect = 'copy'; setDropping(true); } }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropping(false); }}
      onDrop={(e) => { if (hasFiles(e)) { e.preventDefault(); setDropping(false); addFiles([...e.dataTransfer!.files]); } }}
      onPaste={(e) => { const files = [...(e.clipboardData?.files ?? [])].filter(isImageFile); if (files.length) { e.preventDefault(); addFiles(files); } }}
    >
      <div class="editor-bar">
        <button class="glass glass-btn round" onClick={done} disabled={adding > 0 || coverAdding} aria-label={t('Back')}><Icon name="arrow-left" /></button>
        <span class="grow" />
        <button class="glass glass-btn round" onClick={() => setOpen('more')} aria-label={t('More')} title={t('More')}><Icon name="dots" /></button>
        <button class="glass glass-btn tinted" onClick={done} disabled={adding > 0 || coverAdding}>{t('Done')}</button>
      </div>

      <article class="note-sheet" onClick={clickPaper}>
        <section class={`note-head${draft.cover ? ' has-cover' : ''}`}>
          {draft.cover && <CoverImg cover={draft.cover} class="note-head-cover" />}
          {isCheckin && <div class="eyebrow">{t('Check-in')} · {timeLabel(draft.time)}</div>}
          <div class="editor-top">
            {draft.icon && (
              <button class="icon-pick" onClick={() => setOpen('icon')} aria-label={t('Change icon')}>
                <NoteIcon id={draft.icon} size={26} />
              </button>
            )}
            <textarea
              ref={titleRef}
              class="title-input"
              rows={1}
              placeholder={t('Title')}
              value={draft.title}
              maxLength={300}
              onInput={(e) => update({ title: e.currentTarget.value.replace(/\n/g, ' ') })}
              onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), write(0))}
              aria-label={t('Title')}
            />
          </div>
          <DetailsSummary draft={draft} onOpen={() => setDetails(true)} onMusic={() => setOpen('music')} />
        </section>

        <div class={`note-body${reading ? ' is-reading' : ''}`} ref={bodyRef}>
          {body.texts.map((text, i) => (
            // keyed by the picture before it, so a picture put in mid-text gets a new block after it and the one
            // being written in stays itself
            <Fragment key={i ? mediaKey(body.media[i - 1]) : ''}>
              {i > 0 && (() => {
                const m = body.media[i - 1];
                const key = mediaKey(m);
                return (
                  <MediaBlock
                    key={key}
                    m={m}
                    draft={draft}
                    editing={!reading}
                    selected={!reading && sel === key}
                    dragging={moving?.key === key}
                    merging={moving?.onto === key}
                    onSelect={() => setSel(key)}
                    onOpen={(el, k) => view(i - 1, k, el)}
                    onResize={(size) => update({ text: serializeBody(setLayout(bodyOf(latest.current!), i - 1, { size, align: m.align })) })}
                    onDrag={(e, el) => !reading && startMove(i - 1, e, el)}
                  />
                );
              })()}
              {reading ? (
                text.trim() && (
                  <div
                    class="read-text"
                    onClick={(e) => {
                      // a tap on the words starts writing there; links, ticks and selecting text don't
                      if ((e.target as Element).closest('a, input, button') || !getSelection()?.isCollapsed) return;
                      write(i, tappedAt(e, text));
                    }}
                  >
                    <Markdown text={text} onTask={(line) => setText(i, toggleTask(text, line))} />
                  </div>
                )
              ) : (
              <BodyText
                value={text}
                textRef={(el) => { areas.current[i] = el; if (i === 0) textRef.current = el; }}
                grow={i === last}
                placeholder={i === 0 && !body.media.length ? t('What’s on your mind?') : i === last ? t('Keep writing…') : undefined}
                onChange={(v) => setText(i, v)}
                onCaret={(pos) => (where.current = { seg: i, pos })}
                onMention={(m) => setMention(i, m)}
                onKey={mentionKey}
                suggestionsOpen={typing?.seg === i}
                activeSuggestion={typing?.seg === i && choices ? `mention-suggestions-option-${activeChoice}` : undefined}
              />
              )}
            </Fragment>
          ))}
          {adding > 0 && Array.from({ length: adding }, () => <span class="inline-media photo-ph is-loading" aria-label={t('Adding photo')} />)}
          {moving && !moving.onto && (
            <span
              class={`drop-slot is-${moving.side}`}
              style={{ top: moving.y + 'px', width: (moving.layout.size ?? 100) + '%', aspectRatio: String(moving.ratio) }}
              aria-hidden="true"
            >
              <span class="drop-slot-label glass">{moving.side === 'center' ? t('On its own line') : t('Text wraps around')}</span>
            </span>
          )}
          {reading && !plainText(draft.text).trim() && (
            <button class="read-empty" onClick={() => write(last)}>{t('Nothing written yet. Tap to write.')}</button>
          )}
          {reading && <button class="read-tail" onClick={() => write(last)} aria-label={t('Keep writing')} tabIndex={-1} />}
        </div>

        {backlinks.length > 0 && (
          <section class="backlinks" aria-label={t('Linked from')}>
            <h2 class="eyebrow">{t('Linked from')}</h2>
            {backlinks.map(({ entry: e, context }) => (
              <button key={e.id} class="backlink card" onClick={() => navigate('note/' + e.id)}>
                <span class="backlink-icon">{e.icon ? <NoteIcon id={e.icon} size={20} /> : <Icon name={e.kind === 'checkin' ? 'mood-smile' : 'notebook'} size={18} />}</span>
                <span class="backlink-main">
                  <span class="backlink-title">{e.kind === 'checkin' && !e.title.trim() ? t('Check-in') : noteLabel(e)}</span>
                  <span class="backlink-when">{rangeLabel(e.date, e.dateEnd)}</span>
                  {context && <span class="backlink-context">{context}</span>}
                </span>
              </button>
            ))}
          </section>
        )}
      </article>
      <NoteStatus text={draft.text} save={saveState} reading={reading} onRead={() => setReading(true)} onWrite={() => write()} />
      <input
        ref={fileRef}
        type="file"
        accept="image/*,.heic,.heif"
        multiple
        hidden
        onChange={(e) => { const input = e.currentTarget; addFiles([...(input.files ?? [])]); input.value = ''; }}
      />
      <FormatBar
        target={target}
        format={!reading}
        swapLabel={typing?.link ? t('Link a note or a book') : t('Tag someone, a book or music')}
        swap={typing && (
          <MentionStrip items={suggestions} active={activeChoice} q={typing.q} canAdd={canAdd} onPick={pickMention} onAdd={() => pickMention('new')} link={typing.link} />
        )}
        context={selIndex >= 0 ? { label: t('Picture'), content: (
            <MediaTools
              m={body.media[selIndex]}
              canUp={canStep(body, selIndex, -1)}
              canDown={canStep(body, selIndex, 1)}
              onLayout={(l) => update({ text: serializeBody(setLayout(bodyOf(latest.current!), selIndex, l)) })}
              onStep={(dir) => setBody(stepMedia(bodyOf(latest.current!), selIndex, dir))}
              onOpen={() => view(selIndex)}
              onWrite={() => {
                // beside a picture on a side; a picture on its own line moves to the left first, half as wide
                const m = body.media[selIndex];
                if ((m.size ?? 100) >= 100 || !m.align) update({ text: serializeBody(setLayout(bodyOf(latest.current!), selIndex, dropLayout(m, 'left'))) });
                setSel(null);
                const el = areas.current[selIndex + 1];
                if (!el) return;
                el.focus({ preventScroll: true });
                editable(el).setSelectionRange(0, 0);
              }}
              onRemove={() => removePicture(body.media[selIndex])}
              onUngroup={() => {
                const b = ungroup(bodyOf(latest.current!), selIndex);
                setBody(b);
                setSel(mediaKey(b.media[selIndex]));
              }}
            />
        ) } : undefined}
        ribbon={{
          title: draft.title,
          back: done,
          done,
          busy: adding > 0 || coverAdding,
          more: () => setOpen('more'),
          share: isCheckin || (!draft.share && isEmpty(draft)) ? undefined : () => setOpen('share'),
          shared: !!draft.share,
          icon: () => setOpen('icon'),
          details: () => setDetails(true),
          reading,
          setReading: (on) => (on ? setReading(true) : write()),
          addPhotos: () => fileRef.current?.click(),
          canAddPhotos: draft.photos.length + adding < MAX_PHOTOS,
          findImage: () => setOpen('images'),
          addMusic: () => setOpen('spotify'),
          mention: () => startMention('@'),
          linkNote: () => startMention('[['),
          mentionBook: () => setOpen('book'),
        }}
      />
      {dropping && <div class="drop-overlay" aria-hidden="true"><span class="glass"><Icon name="photo-plus" size={20} /> {t('Drop to add photos')}</span></div>}

      {!isCheckin && <ShareSheet open={open === 'share'} onClose={close} entry={draft} onChange={(share) => update({ share })} />}
      <Sheet open={open === 'more'} onClose={close} title={t('More')}>
        <div class="card list menu-list">
          <button class="list-row action" onClick={() => { close(); toggleReading(); }}>
            <span class="row gap-s"><Icon name={reading ? 'pencil' : 'book'} size={18} /> {reading ? t('Edit') : t('Reading view')}</span>
          </button>
          {!isCheckin && (draft.share || !isEmpty(draft)) && (
            <button class="list-row action" onClick={() => setOpen('share')}>
              <span class="row gap-s"><Icon name="world" size={18} /> {draft.share ? t('Public link') : t('Make public')}</span>
            </button>
          )}
          <button class="list-row action" onClick={() => setOpen('icon')}>
            <span class="row gap-s"><Icon name="mood-plus" size={18} /> {draft.icon ? t('Change icon') : t('Add icon')}</span>
          </button>
          <button class="list-row action danger" aria-label={isCheckin ? t('Delete check-in') : t('Delete note')} onClick={() => { close(); return remove(); }}>
            <span class="row gap-s"><Icon name="trash" size={18} /> {isCheckin ? t('Delete check-in') : t('Delete note')}</span>
          </button>
        </div>
      </Sheet>
      <Sheet open={open === 'music'} onClose={close} title={t('Music in this note')}>
        <div class="tracks note-music">
          {draft.music.map((m) => (
            <MusicDeck key={m.kind + m.id} m={m} onRemove={() => update({ music: (latest.current ?? draft).music.filter((x) => !(x.kind === m.kind && x.id === m.id)) })} />
          ))}
        </div>
      </Sheet>
      <IconSheet open={open === 'icon'} onClose={close} value={draft.icon} onChange={(icon) => update({ icon })} />
      <NoteDetails open={details} onClose={() => setDetails(false)} draft={draft} update={update} uploadCover={uploadCover} uploadingCover={coverAdding} />
      <ImageSearchSheet
        open={open === 'images'}
        onClose={close}
        onAdd={(imgs) => {
          const fresh = imgs.filter((i) => !draft.images.some((x) => x.url === i.url)).slice(0, 12 - draft.images.length);
          update({ images: [...draft.images, ...fresh], text: place(body, fresh.map((i) => ({ kind: 'image', url: i.url }))) });
        }}
      />
      <BookSheet open={open === 'book'} onClose={close} onPick={mentionBook} title={t('Mention a book')} status="reading" />
      <SpotifySheet
        open={open === 'spotify'}
        onClose={close}
        onConnect={async () => { await flush(); if (!dirty.current && alive.current && !removing.current) connectSpotify(saved.current ? '#/note/' + draft.id : '#/note/new'); }}
        onAdd={(list) => update({ music: [...draft.music, ...list.filter((m) => !draft.music.some((x) => x.kind === m.kind && x.id === m.id))].slice(0, 20) })}
      />
    </div>
  );
}
