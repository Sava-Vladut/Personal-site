import { Fragment } from 'preact';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { createPortal, flushSync } from 'preact/compat';
import { rangeLabel, timeLabel } from '../lib/dates';
import { goBack, navigate } from '../lib/router';
import { bodyOf, canStep, findItem, insertMedia, itemKey, itemOf, itemsOf, mediaKey, mergeMedia, parseBody, plainText, removeItem, removeMedia, sameMedia, serializeBody, stepMedia, takeOut, ungroup, type Body, type Item, type Layout, type Media } from '../lib/body';
import { imageSrc } from '../lib/images';
import { addPhotos, photoUrl } from '../lib/photos';
import { findBook, mentionOf } from '../lib/books';
import { linkedFrom, linkOf, noteLabel, suggestLinks, type LinkSuggestion } from '../lib/links';
import { findRef, refOf, useRefs, type Ref } from '../lib/refs';
import { connectSpotify } from '../lib/spotify';
import {
  blankEntry, blankPerson, deleteEntry, getBooks, getEntries, getPeople, getSongs, isEmpty, onEntries, saveEntry, savePerson, toast, useBooks, usePeople, useSongs,
  type Book, type Entry, type Person,
} from '../lib/store';
import { mentionOfPerson, mentionOfSong, suggest, type Suggestion } from '../lib/mentions';
import { coreOf } from '../data/emotions';
import { openViewer } from '../lib/viewer';
import { contextNow, fillWeather, needsWeather } from '../lib/weather';
import { BookSheet } from '../components/books';
import { RefSheet } from '../components/RefSheet';
import { FormatBar } from '../components/FormatBar';
import { ShareSheet } from '../components/ShareSheet';
import { takeDown } from '../lib/share';
import { ImageSearchSheet } from '../components/ImageSearchSheet';
import { IconSheet } from '../components/IconPicker';
import { Icon, NoteIcon } from '../components/icons';
import { Sheet } from '../components/Sheet';
import { LinkSheet } from '../components/LinkSheet';
import { NoteBody, pastesPictures, type MediaSlot, type NoteBodyHandle, type Typed } from '../editor/NoteBody';
import { CoverImg, DetailsSummary, NoteDetails } from '../components/NoteDetails';
import { dropLayout, MediaBlock, MediaTools, sideAt, type Side } from '../components/NoteMedia';
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

type Open = null | 'icon' | 'images' | 'spotify' | 'book' | 'share' | 'more' | 'music' | 'link' | 'trap' | 'law' | 'principle';
const personNameKey = (name: string) => name.trim().normalize('NFC').toLowerCase();

const MAX_PHOTOS = 20;
/** Writing on without a pause still saves this often (ms): each change otherwise waits for the next pause. */
const MAX_WAIT = 2000;
const isImageFile = (f: File) => f.type.startsWith('image/') || /\.(heic|heif|avif|webp)$/i.test(f.name);

const lengths = new WeakMap<HTMLTextAreaElement, number>();
/** Grows (or shrinks) the box to its text. Text that only got longer is measured once; collapsing the box to measure it
 * again (a second full layout on every key) is only for text that may have got shorter, or when `force`d (a new width). */
function fit(el: HTMLTextAreaElement | null, force = false) {
  if (!el) return;
  const len = el.value.length, before = lengths.get(el);
  lengths.set(el, len);
  if (!force && before !== undefined && len >= before && el.style.height) {
    if (el.scrollHeight > el.clientHeight) el.style.height = el.scrollHeight + 'px';
    return;
  }
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
}

/**
 * The store's notes, for tag suggestions and what links here. Saving while writing (every pause) hands the store a new
 * list in which only this note changed: that doesn't redraw the editor, which has those words already; `changed` still
 * hears of it, to take up a newer copy of this note from another device.
 */
function useNotesAround(id: string | undefined, changed: () => void): Entry[] {
  const [list, setList] = useState(getEntries);
  const heard = useRef(changed);
  heard.current = changed;
  useEffect(() => {
    // only this note's words changed: what links here, which points at its name (its title, or its first line when it
    // has none), kind or date, can't have
    const quiet = (a: Entry, b: Entry) => a.id === id && b.id === id && a.title === b.title && a.kind === b.kind && a.date === b.date
      && (!!a.title.trim() || noteLabel(a) === noteLabel(b));
    const take = () => {
      const next = getEntries();
      setList((prev) => (prev.length === next.length && prev.every((e, i) => e === next[i] || quiet(e, next[i])) ? prev : next));
    };
    const stop = onEntries(() => { take(); queueMicrotask(() => heard.current()); });
    take(); // a change between the first render and now
    return stop;
  }, [id]);
  return list;
}

/** Keeps the title box as tall as its text, again when the window is resized. */
function useAutosize(value: string) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => fit(ref.current), [value]);
  useEffect(() => {
    const on = () => fit(ref.current, true);
    addEventListener('resize', on);
    // measured again once the serif has loaded: it can take another line, which would be cut off
    let live = true;
    document.fonts?.ready.then(() => live && on());
    return () => {
      live = false;
      removeEventListener('resize', on);
    };
  }, []);
  return ref;
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
  // an @tag (or [[ link) being typed: where its @ is and what follows it; and which suggestion is picked
  const [mention, setMentionState] = useState<Typed | null>(null);
  const [pickAt, setPickAt] = useState(0);
  const arrowed = useRef(false); // whether the arrow keys chose among the suggestions (Return then takes "New person" too)
  const dismissed = useRef(''); // which @ Escape put away, by where it is
  const pickingMention = useRef(false);
  const people = usePeople();
  const shelf = useBooks();
  const songs = useSongs();
  const allEntries = useNotesAround(draft?.id, () => catchUp());
  // Notes that already have words open formatted, to read; the pencil (or a tap on the words) switches to writing.
  const [reading, setReading] = useState(() => !!draft && id !== 'new' && !!plainText(draft.text).trim());
  // for what's finished after a wait (photos read in): reading or writing then, not when it started
  const readingNow = useRef(reading);
  readingNow.current = reading;
  const fileRef = useRef<HTMLInputElement>(null);
  const saved = useRef(id !== 'new');
  const dirty = useRef(false);
  const saveRequest = useRef(0);
  const pendingSave = useRef<Promise<boolean> | null>(null);
  const leaving = useRef(false);
  const contextStarted = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  // a save that failed is tried again by itself, a little later each time (after leaving the note too)
  const retryTimer = useRef<ReturnType<typeof setTimeout>>();
  const retries = useRef(0);
  const latest = useRef(draft);
  latest.current = draft;
  // the note as this page last saw it stored (as it opened, or as saved from here): a newer copy in the store came
  // from somewhere else (another device, through sync)
  const base = useRef<Entry | null>(id !== 'new' ? draft : null);
  // when the oldest change not saved yet was made (0: none waiting)
  const changedAt = useRef(0);
  // what the status bar says about saving: only shown, never consulted, so saving works exactly as without it
  const [saveState, setSaveState] = useState<SaveState>(id !== 'new' ? 'saved' : 'idle');
  const [savedNow, setSavedNow] = useState(0); // saved by Ctrl+S: the status bar says so once more
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
  const bodyRef = useRef<HTMLDivElement>(null);
  const alive = useRef(true);
  const removing = useRef(false);
  const pendingImports = useRef(0);
  const cancelMove = useRef<(() => void) | null>(null);
  const marginsAt = useRef<{ at: number; m: { top: number; bottom: number } } | null>(null); // margins(), once a frame
  const selectedOnPress = useRef(false); // whether words were selected as the last press on the page began
  const selBodyAt = useRef<{ version: number; body: Body } | null>(null);
  const addFilesNow = useRef<(files: File[]) => void>(() => {});
  // The note's words and pictures (editor/NoteBody.tsx): its document is the text, written back to the draft a moment
  // after each change. Kept once it's been there, so leaving still reads the last words.
  const [note, setNote] = useState<NoteBodyHandle | null>(null);
  const noteRef = useRef<NoteBodyHandle | null>(null);
  const [initialText] = useState(() => (draft ? serializeBody(bodyOf(draft)) : ''));
  const textDirty = useRef(false);
  const textTimer = useRef<ReturnType<typeof setTimeout>>();
  // pictures cut from the note (or undone): their photos wait here, to come back with them
  const stash = useRef<{ photos: Entry['photos']; images: Entry['images'] }>({ photos: [], images: [] });
  const [slots, setSlots] = useState<MediaSlot[]>([]);
  const [linkTo, setLinkTo] = useState<{ text: string; href: string | null }>({ text: '', href: null });

  // Once a new note is saved, point the URL at it so a reload reopens it. Never rewrite a sheet's history entry.
  const syncUrl = () => {
    const d = latest.current;
    if (saved.current && d && !history.state?.mmSheet && location.hash === '#/note/new') history.replaceState(history.state, '', '#/note/' + d.id);
  };

  /**
   * Writes the document back into the draft as text. The note's photos follow it: those whose picture left the text
   * (cut, or an insert undone) go to the stash, and come back from it with their picture (undo, paste).
   */
  const syncText = () => {
    clearTimeout(textTimer.current);
    const n = noteRef.current;
    const d = latest.current;
    if (!textDirty.current || !n || !d || removing.current) return;
    textDirty.current = false;
    const text = n.text();
    const inDoc = new Set(parseBody(text).media.flatMap(itemsOf).map(itemKey));
    const has = (it: Item) => inDoc.has(itemKey(it));
    const st = stash.current;
    const pool = { photos: [...d.photos, ...st.photos], images: [...d.images, ...st.images] };
    const photos = pool.photos.filter((p) => has({ kind: 'photo', id: p.id }));
    const images = pool.images.filter((x) => has({ kind: 'image', url: x.url }));
    stash.current = { photos: pool.photos.filter((p) => !photos.includes(p)), images: pool.images.filter((x) => !images.includes(x)) };
    const same = <T,>(a: T[], b: T[]) => a.length === b.length && a.every((x, i) => x === b[i]);
    const patch: Partial<Entry> = {
      ...(text !== d.text && { text }),
      ...(!same(photos, d.photos) && { photos }),
      ...(!same(images, d.images) && { images }),
    };
    if (!Object.keys(patch).length) {
      // the words came back to what's kept (typed and taken out again): nothing to save, so it's saved
      if (alive.current && !dirty.current && !pendingSave.current) {
        changedAt.current = 0;
        setSaveState(saved.current ? 'saved' : 'idle');
        catchUp();
      }
      return;
    }
    if (alive.current) return update(patch);
    // leaving: straight into what's saved
    latest.current = { ...d, ...patch };
    dirty.current = true;
  };
  /**
   * How long a change waits before it's written back or saved: `ms` after it, unless changes have been waiting
   * MAX_WAIT already — typing on with no pause would otherwise put saving off for as long as it lasts.
   */
  const soon = (ms: number) => {
    const now = Date.now();
    if (!changedAt.current) changedAt.current = now;
    return Math.max(0, Math.min(ms, changedAt.current + MAX_WAIT - now));
  };
  /** The document changed: its text is written back shortly (and on leaving, at once). */
  const docChanged = () => {
    textDirty.current = true;
    setSaveState('saving');
    clearTimeout(textTimer.current);
    textTimer.current = setTimeout(syncText, soon(300));
  };
  /** The note's text now, the document's when it's open. */
  const textNow = () => noteRef.current?.text() ?? (latest.current ? serializeBody(bodyOf(latest.current)) : '');
  /** Puts a new text in the note: into the document when it's open (one step to undo), else straight into the draft. */
  const setBodyText = (text: string) => {
    const n = noteRef.current;
    if (n) n.setText(text);
    else update({ text });
  };

  /** Saves the draft now (`quiet`: a retry, which doesn't say again that saving failed). */
  const flush = (quiet = false) => {
    syncText();
    clearTimeout(timer.current);
    clearTimeout(retryTimer.current);
    changedAt.current = 0;
    const d = latest.current;
    if (removing.current || !d) return Promise.resolve(false);
    if (!dirty.current) return pendingSave.current ?? Promise.resolve(saved.current);
    dirty.current = false;
    if (!saved.current && isEmpty(d)) {
      if (alive.current) setSaveState('idle');
      return Promise.resolve(false); // don't keep blank notes
    }
    const request = ++saveRequest.current;
    const saving = saveEntry(d).then((kept) => {
      if (removing.current) return false;
      if (kept?.id === d.id) base.current = kept;
      if (!saved.current && !contextStarted.current) {
        contextStarted.current = true;
        addPlaceAndWeather(d);
      }
      saved.current = true;
      retries.current = 0;
      if (alive.current) {
        syncUrl();
        if (request === saveRequest.current && !dirty.current) setSaveState('saved');
      }
      return true;
    }).catch(() => {
      if (removing.current || request !== saveRequest.current) return false;
      dirty.current = true;
      if (alive.current) setSaveState('error');
      if (retries.current < 6) retryTimer.current = setTimeout(retry, Math.min(30_000, 2000 * 2 ** retries.current++));
      if (!quiet) toast(t('Couldn’t save this note. Try again.'));
      return false;
    }).finally(() => {
      if (pendingSave.current === saving) pendingSave.current = null;
      catchUp();
    });
    pendingSave.current = saving;
    return saving;
  };

  /**
   * A failed save, tried again. Leaving the note doesn't drop it (its words are only here now): it's still tried
   * after, as long as nothing newer of the note has been saved meanwhile (it reopened and was written in).
   */
  const retry = () => {
    const d = latest.current;
    if (alive.current || (d && (getEntries().find((e) => e.id === d.id) ?? null) === base.current)) void flush(true);
  };
  /** Ctrl+S, or a tap on "Not saved": saved now, and the status bar says so once it is. */
  const saveNow = () => void flush().then((ok) => ok && alive.current && setSavedNow((n) => n + 1));

  /**
   * A newer copy of the note came in while it's open (sync, from another device). With nothing here waiting to be
   * saved, it's taken up, its words into the editor: what's written next goes on from it, rather than this page
   * saving its older copy over it. Changes here that are still to be saved win, as before.
   */
  const catchUp = () => {
    const b = base.current;
    if (!alive.current || removing.current || !b || dirty.current || textDirty.current || pendingSave.current) return;
    const now = getEntries().find((e) => e.id === b.id);
    if (!now || now === b || now.updated < b.updated) return;
    base.current = now;
    latest.current = now;
    setDraft(now);
    // not a step to undo: undo never takes the words back to this device's older copy
    noteRef.current?.setText(serializeBody(bodyOf(now)), false);
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
    timer.current = setTimeout(() => flush(), soon(500));
  };

  /**
   * A note started here and left with nothing in it isn't kept, as one never saved isn't: saved while it was being
   * written (a word typed, then taken out), leaving takes it out again. Returns that removal; null when the note stays.
   */
  const dropBlank = () => {
    syncText();
    const d = latest.current;
    if (id !== 'new' || !d || removing.current || !isEmpty(d) || d.share || (!saved.current && !pendingSave.current)) return null;
    removing.current = true;
    clearTimeout(timer.current);
    clearTimeout(retryTimer.current);
    dirty.current = false;
    return Promise.resolve(pendingSave.current).then(() => deleteEntry(d.id)).then(() => {}, () => {});
  };

  useEffect(() => {
    const hide = () => document.visibilityState === 'hidden' && flush();
    const leave = () => flush();
    // back online: what failed to save goes at once, not at the next try
    const online = () => dirty.current && retry();
    document.addEventListener('visibilitychange', hide);
    addEventListener('online', online);
    // the tab closing or the page going away (Safari doesn't always say it's hidden first)
    addEventListener('pagehide', leave);
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
      removeEventListener('pagehide', leave);
      removeEventListener('online', online);
      removeEventListener('popstate', syncUrl);
      if (!dropBlank()) flush();
      // moved to another day, or written offline: that day's weather
      if (saved.current && !removing.current && latest.current && needsWeather(latest.current)) fillWeather();
    };
  }, []);

  // Pictures dropped on the ribbon or the status bar (they float over the page, outside it) come into the note too,
  // rather than the browser opening them in place of the app.
  useEffect(() => {
    const files = (e: DragEvent) => !!e.dataTransfer?.types.includes('Files');
    const outside = (e: DragEvent) => files(e) && !(e.target as Element | null)?.closest?.('.page.editor');
    const over = (e: DragEvent) => {
      if (!outside(e)) return;
      e.preventDefault();
      e.dataTransfer!.dropEffect = 'copy';
    };
    const drop = (e: DragEvent) => {
      if (!outside(e)) return;
      e.preventDefault();
      addFilesNow.current([...e.dataTransfer!.files]);
    };
    addEventListener('dragover', over);
    addEventListener('drop', drop);
    return () => {
      removeEventListener('dragover', over);
      removeEventListener('drop', drop);
    };
  }, []);

  // A selected picture lets go when you tap anywhere else, or press Escape.
  useEffect(() => {
    if (!sel) return;
    const down = (e: PointerEvent) => {
      // a tap on another picture selects that one (its click does): letting go first would flash the Picture tab away
      if (!(e.target as Element).closest?.('.media, .format-bar, .sheet, .toast, .pswp')) setSel(null);
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

  // the notes changed (a save from here, or sync): a newer copy of this one is taken up when nothing here waits
  useEffect(catchUp, [allEntries]);

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
    clearTimeout(retryTimer.current);
    dirty.current = false;
    const pending = pendingSave.current;
    await pending;
    try {
      const removed = saved.current || pending ? await deleteEntry(draft.id) : null;
      takeDown(removed);
      if (alive.current) goBack();
      if (removed) toast(removed.kind === 'checkin' ? t('Check-in deleted') : t('Note deleted'), {
        label: t('Undo'),
        run: () => void saveEntry({ ...removed, share: null }).catch(() => toast(t('Couldn’t save this note. Try again.'))),
      });
    } catch {
      removing.current = false;
      dirty.current = true;
      toast(t('Couldn’t delete this note. Try again.'));
    }
  };

  const done = async () => {
    if (leaving.current) return;
    leaving.current = true;
    const blank = dropBlank();
    if (blank) {
      await blank;
      if (alive.current) goBack();
      return;
    }
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
        update({ photos: [...d.photos, ...fit] });
        place(fit.map((p) => ({ kind: 'photo', id: p.id })));
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
  /**
   * Puts pictures in where the caret is (at the end of the note when it's never been written in, or while reading),
   * the caret going after them. Without the editor there yet, at the end of the draft's text.
   */
  const place = (add: Media[]) => {
    const n = noteRef.current;
    if (n) return n.media.insert(add, readingNow.current);
    const d = latest.current;
    if (!d) return;
    const b = bodyOf(d);
    const last = b.texts.length - 1;
    update({ text: serializeBody(insertMedia(b, add, last, b.texts[last].length)) });
  };
  addFilesNow.current = addFiles;
  const hasFiles = (e: DragEvent) => !!e.dataTransfer?.types.includes('Files');

  /** The note's pictures as body.ts has them, read from the text now. */
  const bodyNow = (): Body => parseBody(textNow());
  /** Changes the pictures with a body.ts change, by the key of the one changed (`i` is its index then). */
  const withBody = (key: string, change: (b: Body, i: number) => Body) => {
    const b = bodyNow();
    const i = b.media.findIndex((m) => mediaKey(m) === key);
    if (i < 0) return;
    const next = change(b, i);
    if (next !== b) setBodyText(serializeBody(next));
  };

  /** Removes a picture — on its own or from its album — or a whole album, with Undo. */
  const removePicture = (target: Media | Item) => {
    const d = latest.current;
    if (!d) return;
    const before = textNow();
    const b = parseBody(before);
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
    setBodyText(after);
    syncText();
    update({ photos: latest.current!.photos.filter((p) => !photos.includes(p)), images: latest.current!.images.filter((x) => !images.includes(x)), text: after });
    stash.current = { photos: stash.current.photos.filter((p) => !photos.includes(p)), images: stash.current.images.filter((x) => !images.includes(x)) };
    setSel(null);
    setOpen(null);
    const restore = (e: Entry, now: string): Partial<Entry> => ({
      photos: [...e.photos, ...photos.filter((p) => !e.photos.some((x) => x.id === p.id))],
      images: [...e.images, ...images.filter((p) => !e.images.some((x) => x.url === p.url))],
      // untouched since: as it was. Otherwise the picture goes back where it was, or (from an album) at the end.
      text: now === after ? before : alone ? serializeBody(insertMedia(parseBody(now), [at], Math.min(i, parseBody(now).texts.length - 1), pos)) : now,
    });
    toast(gone.length > 1 ? t('Album removed') : gone[0].kind === 'photo' ? t('Photo removed') : t('Image removed'), {
      label: t('Undo'),
      run: () => {
        if (alive.current && latest.current) {
          const patch = restore(latest.current, textNow());
          update({ photos: patch.photos, images: patch.images });
          setBodyText(patch.text!);
          return;
        }
        const e = getEntries().find((x) => x.id === d.id);
        if (e) saveEntry({ ...e, ...restore(e, e.text) }).catch(() => toast(t('Couldn’t save this note. Try again.')));
      },
    });
  };

  /**
   * Picks a picture up: a small copy of it follows the finger (or pointer), and an outline shows where it would land —
   * which paragraph it goes before, and on which side: over the left or right third of the note it sits on that side
   * with the text wrapping around it, over the middle it's centred on its own. Dropped on another picture, the two
   * become an album (or it joins that album). Drops it on release; Escape cancels.
   */
  const startMove = (key: string, e: PointerEvent, el: HTMLElement) => {
    cancelMove.current?.();
    const bodyEl = bodyRef.current;
    const n = noteRef.current;
    const m = bodyNow().media.find((x) => mediaKey(x) === key);
    if (!bodyEl || !n || !m) return;
    const targets = n.media.dropTargets();
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

    let target: { pos: number; y: number } | null = null;
    let side: Side = 'center';
    let onto: string | null = null;
    let x = e.clientX, y = e.clientY;
    let frame = 0;
    let picked = false;
    let shown = ''; // what the page last drew of the move: it's drawn again only when that changes, not on every move
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
      onto = over && bodyEl.contains(over) && over.dataset.key !== key ? over.dataset.key! : null;
      ghost.style.translate = `${x - e.clientX}px ${y - e.clientY}px`;
      ghost.classList.toggle('is-merging', !!onto);
      const slotY = target.y - (col.top + scrollY);
      const now = `${slotY}|${side}|${onto}`;
      if (now === shown) return;
      shown = now;
      setMoving({ key, y: slotY, side, layout: dropLayout(m, side), ratio, onto });
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
      if (!drop || !target || !alive.current) return;
      if (onto) {
        const into = onto;
        let merged = '';
        withBody(key, (b, j) => {
          const k = b.media.findIndex((x) => mediaKey(x) === into);
          if (k < 0) return b;
          const next = mergeMedia(b, j, k);
          merged = mediaKey(next.media[k > j ? k - 1 : k]);
          return next;
        });
        if (merged) setSel(merged);
        haptic(10);
        return;
      }
      noteRef.current?.media.move(key, target.pos, dropLayout(m, side));
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
      const el = bodyRef.current?.querySelector<HTMLElement>(`.media[data-key="${CSS.escape(key)}"]`);
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

  /** Opens the note's pictures full screen — every picture, albums opened out — at picture `k` of the one named `key`. */
  const view = async (key: string, k = 0, el?: HTMLElement | null) => {
    const d = latest.current;
    if (!d) return;
    const b = bodyOf({ ...d, text: textNow() });
    const i = b.media.findIndex((m) => mediaKey(m) === key);
    const blocks = bodyRef.current ? [...bodyRef.current.querySelectorAll<HTMLElement>('.media-node > .media')] : [];
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
    openViewer(shown, Math.max(0, shown.indexOf(start)), reading ? {} : {
      onRemove: (n) => removePicture(shown[n].it),
      onTakeOut: (n) => {
        const it = shown[n].it;
        const b = bodyNow();
        const { i } = findItem(b, it);
        if (i < 0) return;
        setBodyText(serializeBody(takeOut(b, i, it)));
        setSel(itemKey(it));
      },
    });
  };

  /** Where the caret goes when writing starts from reading: the end of the note if it's in view, else the first line that is. */
  const inView = (): 'end' | number => {
    const r = bodyRef.current?.querySelector('.note-editor')?.getBoundingClientRect();
    const m = margins();
    const visH = window.visualViewport?.height ?? innerHeight;
    if (!r || r.bottom <= visH - m.bottom || r.bottom < m.top || r.top > visH) return 'end';
    return noteRef.current?.posAt(r.left + 2, Math.max(r.top, m.top) + 4) ?? 'end';
  };
  /** Switches to writing, with the caret at a position (or the start or end of the note, or where it was). */
  const write = (at?: 'start' | 'end' | number) => {
    const n = noteRef.current;
    // from reading, with no place given: the end when it's on screen, else the first line in view (not a jump to the end)
    const where = at === undefined && reading ? inView() : 'end';
    if (reading) {
      // Editable before this touch ends: iOS only opens its keyboard for synchronous focus.
      flushSync(() => setReading(false));
      n?.setEditable(true);
    }
    n?.focus(at ?? (reading ? where : undefined));
  };
  /** Reading view and writing, back and forth (the More menu, the status bar). */
  const toggleReading = () => (reading ? write() : setReading(true));
  /** Print / Save as PDF: the browser's print dialog, which prints the note alone (document.css), once a sheet has gone. */
  const printNote = () => void setTimeout(() => print());
  /** A tap on the words of the reading view starts writing there; links, tags, ticks and selecting text don't. */
  const tapToWrite = (e: MouseEvent) => {
    // a tap that only puts a selection away (a phone clears it before the click) doesn't start writing either
    if (!reading || selectedOnPress.current || (e.target as Element).closest('a, input, button, .media, .note-chip') || !getSelection()?.isCollapsed) return;
    if (!(e.target as Element).closest('.note-editor')) return;
    write(noteRef.current?.posAt(e.clientX, e.clientY) ?? 'end');
  };
  /**
   * A click on the empty paper below the words starts writing at the end, as in Word. Clicks beside a line are left
   * to the browser, and the notes linking here at the foot of the page keep theirs.
   */
  const clickPaper = (e: MouseEvent) => {
    const host = bodyRef.current;
    const target = e.target as Element;
    if (!host || selectedOnPress.current || (target !== e.currentTarget && target !== host && !target.classList?.contains('note-editor-host')) || !getSelection()?.isCollapsed) return;
    const words = host.querySelector('.note-editor')?.getBoundingClientRect();
    const foot = (e.currentTarget as HTMLElement).querySelector('.backlinks')?.getBoundingClientRect();
    if (!words || e.clientY <= words.bottom || (foot && e.clientY >= foot.top)) return;
    write('end');
  };

  /** Puts a tag's token in where the caret is (or at the end of the note, while reading). */
  const insertToken = (token: string) => {
    const n = noteRef.current;
    setOpen(null);
    if (n) return n.insertToken(token, reading);
    const d = latest.current;
    if (!d) return;
    update({ text: d.text + (d.text && !/\s$/.test(d.text) ? ' ' : '') + token + ' ' });
  };
  /** Mentions a book, as a link to it. */
  const mentionBook = (b: Book) => insertToken(mentionOf(b, getBooks()));
  /** Links a mind trap, a law of power or a Win friends principle. */
  const insertRef = (r: Ref) => insertToken(refOf(r));

  /** The Link sheet, for the link at the caret (or the selected words, or the word at the caret). */
  const openLink = () => {
    const n = noteRef.current;
    if (!n || reading) return;
    const at = n.linkAt();
    setLinkTo({ text: at.text, href: at.href });
    setOpen('link');
  };

  /* ---------- @tags ---------- */

  const setMention = (m: Typed | null) => {
    if (!m) dismissed.current = '';
    else if (dismissed.current === String(m.from)) m = null;
    // a new query starts at its first suggestion, in the same render (not a frame later with the old one lit)
    if (!m || m.from !== mention?.from || m.q !== mention?.q) {
      setPickAt(0);
      arrowed.current = false;
    }
    setMentionState((cur) => (!m ? null : cur && cur.from === m.from && cur.to === m.to && cur.q === m.q && cur.link === m.link ? cur : m));
  };
  const typing = mention;
  // the mind traps, laws of power and principles are fetched the first time a [[ link is typed
  const refs = useRefs(!!typing?.link);
  const suggestions: (Suggestion | LinkSuggestion)[] = !typing ? []
    : typing.link ? suggestLinks(typing.q, allEntries, shelf, draft.id, refs)
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
    const n = noteRef.current;
    if (!m || !n || !latest.current || !alive.current || removing.current || pickingMention.current) return;
    // Keep the keyboard open in the original touch event; a later asynchronous focus cannot open it on iOS.
    n.focus();
    const version = n.version();
    const selection = n.selection();
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
    } else if (s.kind === 'trap' || s.kind === 'law' || s.kind === 'principle') {
      const current = findRef(refs, s.kind, s.item.id);
      if (!current) return setMentionState(null);
      token = refOf(current);
      color = `var(--emo-${current.hue})`;
    } else {
      const current = getSongs().find((song) => song.id === s.item.id);
      if (!current) return setMentionState(null);
      token = mentionOfSong(current, getSongs());
      color = '#8a6cf0';
    }
    if (person?.emotions[0]) color = `var(--emo-${coreOf(person.emotions[0]).id})`;
    const d = latest.current;
    // the words changed meanwhile (or, after a wait, the caret moved or the note lost the focus): left as they are
    if (!alive.current || removing.current || !d || noteRef.current !== n || n.version() !== version) return;
    const now = n.selection();
    if (awaitedCreation && (!n.focused() || now.from !== selection.from || now.to !== selection.to)) return;
    if (!n.pick(m, token)) return setMentionState(null);
    if (person && !d.people.includes(person.id)) update({ people: [...d.people, person.id] });
    setMentionState(null);
    const landed = n.version();
    requestAnimationFrame(() => {
      const host = bodyRef.current;
      if (!alive.current || !host || noteRef.current !== n || n.version() !== landed) return;
      const range = n.rangeOf(m.from, m.from + 1);
      if (range) burst(range, host, color);
    });
  };

  const mentionKey = (e: KeyboardEvent) => {
    if (e.isComposing || !typing) return false;
    if (e.key === 'Escape') {
      dismissed.current = String(typing.from);
      setMentionState(null);
      return true;
    }
    if (!choices) return false;
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      setPickAt((activeChoice + (e.key === 'ArrowDown' ? 1 : -1) + choices) % choices);
      arrowed.current = true;
      return true;
    }
    // Return picks what's found. A new person takes a tap on "New person" (or Tab, or the arrows to it): Return after
    // an @word nobody is called just ends the line, as a phone's keyboard user means it to
    if ((e.key === 'Enter' || e.key === 'Tab') && (activeChoice < suggestions.length || e.key === 'Tab' || arrowed.current)) {
      pickMention(activeChoice < suggestions.length ? suggestions[activeChoice] : 'new');
      return true;
    }
    return false;
  };

  /** The @ and link buttons: type an @ (or [[) where the caret is (writing first, if reading), which brings up the suggestions. */
  const startMention = (sigil: '@' | '[[' = '@') => {
    // from reading, the tag goes at the end of the note
    write(reading ? 'end' : undefined);
    const typed = noteRef.current?.trigger(sigil);
    if (typed) setMention(typed);
  };

  /**
   * Where the caret is kept clear of: under the ribbon on a computer (and above its status bar), under the floating
   * Back and Done on a phone and above the bar over its keyboard. Read once a frame: ProseMirror asks for each box it
   * scrolls, and each read measures the page.
   */
  const margins = () => {
    const now = Date.now();
    const memo = marginsAt.current;
    if (memo && now - memo.at < 16) return memo.m;
    const shown = (el: Element | null) => !!el && getComputedStyle(el).display !== 'none' && getComputedStyle(el).visibility !== 'hidden';
    const wide = document.querySelector('.ribbon.is-wide:not(.is-focus)');
    const head = document.querySelector('.page.editor .editor-bar');
    // ProseMirror measures the window as the part of the page in view (the visual viewport, 0 to its height). On
    // Android the layout's innerHeight keeps the keyboard's height, so it can't be what the bar is taken from.
    const vv = window.visualViewport;
    const visTop = vv?.offsetTop ?? 0, visH = vv?.height ?? innerHeight;
    const top = Math.max(visTop, wide ? wide.getBoundingClientRect().bottom : 0, shown(head) ? head!.getBoundingClientRect().bottom : 0);
    const bars = [...document.querySelectorAll('.ribbon-root .format-bar:not(.is-tucked):not(.is-wide), .note-status')].filter(shown);
    const barTop = Math.min(visTop + visH, ...bars.map((b) => b.getBoundingClientRect().top));
    const m = { top: Math.max(0, top) + 24, bottom: Math.max(0, visH - barTop) + 24 };
    marginsAt.current = { at: now, m };
    return m;
  };
  /** Whether a picture is the note's own: its photos or images are in the note (pasted from another note, they aren't). */
  const knows = (m: Media) => {
    const d = latest.current;
    const st = stash.current;
    return !!d && itemsOf(m).every((it) => it.kind === 'photo'
      ? [...d.photos, ...st.photos].some((p) => p.id === it.id)
      : [...d.images, ...st.images].some((x) => x.url === it.url));
  };

  const close = () => setOpen(null);
  const isCheckin = draft.kind === 'checkin';
  const selected = !reading && sel ? slots.find((s) => mediaKey(s.media) === sel)?.media : undefined;
  const selKey = selected ? mediaKey(selected) : '';
  // read from the text once per change of the note, not on every render (a drag renders many times)
  const version = note?.version() ?? -1;
  const cached = selBodyAt.current;
  const selBody = !selected ? null : cached && cached.version === version && version >= 0 ? cached.body : bodyNow();
  if (selected && selBody) selBodyAt.current = { version, body: selBody };
  const selIndex = selBody ? selBody.media.findIndex((m) => mediaKey(m) === selKey) : -1;

  return (
    <div
      class={`page editor${dropping ? ' is-dropping' : ''}`}
      onDragOver={(e) => { if (hasFiles(e)) { e.preventDefault(); e.dataTransfer!.dropEffect = 'copy'; setDropping(true); } }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropping(false); }}
      onDrop={(e) => { if (hasFiles(e)) { e.preventDefault(); setDropping(false); addFiles([...e.dataTransfer!.files]); } }}
      onPaste={(e) => { if (!pastesPictures(e.clipboardData)) return; e.preventDefault(); addFiles([...e.clipboardData!.files].filter(isImageFile)); }}
    >
      <div class="editor-bar">
        <button class="glass glass-btn round" onClick={done} disabled={adding > 0 || coverAdding} aria-label={t('Back')}><Icon name="arrow-left" /></button>
        <span class="grow" />
        <button class="glass glass-btn round" onClick={() => setOpen('more')} aria-label={t('More')} title={t('More')}><Icon name="dots" /></button>
        <button class="glass glass-btn tinted" onClick={done} disabled={adding > 0 || coverAdding}>{t('Done')}</button>
      </div>

      <article class="note-sheet" onPointerDown={() => void (selectedOnPress.current = !getSelection()?.isCollapsed)} onClick={clickPaper}>
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
              // Return goes on to the words; not the Return that picks a word from a Japanese or Chinese keyboard
              // (Safari says it's no longer composing by then, but gives it key code 229)
              onKeyDown={(e) => e.key === 'Enter' && !e.isComposing && e.keyCode !== 229 && (e.preventDefault(), write('start'))}
              aria-label={t('Title')}
            />
          </div>
          <DetailsSummary draft={draft} onOpen={() => setDetails(true)} onMusic={() => setOpen('music')} />
        </section>

        <div class={`note-body${reading ? ' is-reading' : ''}`} ref={bodyRef} onClick={tapToWrite}>
          <NoteBody
            text={initialText}
            editable={!reading}
            onChange={docChanged}
            onTyped={setMention}
            suggestKey={mentionKey}
            onLink={openLink}
            onSave={saveNow}
            onMedia={setSlots}
            knows={knows}
            margins={margins}
            onReady={(h) => {
              if (!h) return;
              noteRef.current = h;
              setNote(h);
            }}
          />
          {slots.map(({ dom, media: m }) => {
            const key = mediaKey(m);
            // each picture into its own slot in the document, keyed so it stays itself when pictures move
            return <Fragment key={key}>{createPortal(
              <MediaBlock
                m={m}
                draft={draft}
                editing={!reading}
                selected={!reading && sel === key}
                dragging={moving?.key === key}
                merging={moving?.onto === key}
                onSelect={() => setSel(key)}
                onOpen={(el, k) => view(key, k, el)}
                onResize={(size) => noteRef.current?.media.layout(key, { size, align: m.align })}
                onDrag={(e, el) => !reading && startMove(key, e, el)}
              />,
              dom,
            )}</Fragment>;
          })}
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
            <button class="read-empty" onClick={() => write('end')}>{t('Nothing written yet. Tap to write.')}</button>
          )}
          {/* the room below the words, the same reading or writing (so switching moves nothing): a tap there writes on
              at the end, the keyboard staying up when it's up already */}
          <div class="read-tail" aria-hidden="true" onPointerDown={(e) => !reading && e.preventDefault()} onClick={() => write('end')} />
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
      <NoteStatus
        text={draft.text}
        note={note}
        save={saveState}
        savedNow={savedNow}
        onRetry={saveNow}
        reading={reading}
        onRead={() => setReading(true)}
        onWrite={() => write()}
      />
      <input
        ref={fileRef}
        type="file"
        accept="image/*,.heic,.heif"
        multiple
        hidden
        onChange={(e) => { const input = e.currentTarget; addFiles([...(input.files ?? [])]); input.value = ''; }}
      />
      <FormatBar
        note={note}
        swapLabel={typing?.link ? t('Link a note, a book, a bias or a law') : t('Tag someone, a book or music')}
        swap={typing && (
          <MentionStrip items={suggestions} active={activeChoice} q={typing.q} canAdd={canAdd} onPick={pickMention} onAdd={() => pickMention('new')} onDismiss={() => { dismissed.current = String(typing.from); setMentionState(null); }} link={typing.link} />
        )}
        context={selected && selBody ? { label: t('Picture'), content: (
            <MediaTools
              m={selected}
              canUp={canStep(selBody, selIndex, -1)}
              canDown={canStep(selBody, selIndex, 1)}
              onLayout={(l) => noteRef.current?.media.layout(selKey, l)}
              onStep={(dir) => withBody(selKey, (b, i) => stepMedia(b, i, dir))}
              onOpen={() => view(selKey)}
              onWrite={() => {
                // beside a picture on a side; a picture on its own line moves to the left first, half as wide
                const n = noteRef.current;
                if ((selected.size ?? 100) >= 100 || !selected.align) n?.media.layout(selKey, dropLayout(selected, 'left'));
                setSel(null);
                n?.media.writeAfter(selKey);
              }}
              onRemove={() => removePicture(selected)}
              onUngroup={() => {
                let first = '';
                withBody(selKey, (b, i) => {
                  const next = ungroup(b, i);
                  first = mediaKey(next.media[i]);
                  return next;
                });
                if (first) setSel(first);
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
          link: openLink,
          addPhotos: () => fileRef.current?.click(),
          canAddPhotos: draft.photos.length + adding < MAX_PHOTOS,
          findImage: () => setOpen('images'),
          addMusic: () => setOpen('spotify'),
          mention: () => startMention('@'),
          linkNote: () => startMention('[['),
          mentionBook: () => setOpen('book'),
          insertRef: (kind) => setOpen(kind),
          print: printNote,
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
          <button class="list-row action" onClick={() => { close(); printNote(); }}>
            <span class="row gap-s"><Icon name="printer" size={18} /> {t('Print / Save as PDF')}</span>
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
          update({ images: [...draft.images, ...fresh] });
          place(fresh.map((i) => ({ kind: 'image', url: i.url })));
        }}
      />
      <LinkSheet
        open={open === 'link'}
        onClose={close}
        text={linkTo.text}
        href={linkTo.href}
        onDone={(to) => {
          close();
          // the focus back in the words first, on what was selected: it's still in the sheet's field here, and a
          // command run from a field acts on the note's start (as from the title) instead
          const n = noteRef.current;
          n?.focus();
          n?.cmds.link(to);
        }}
      />
      <RefSheet kind={open === 'trap' || open === 'law' || open === 'principle' ? open : null} onClose={close} onPick={insertRef} />
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
