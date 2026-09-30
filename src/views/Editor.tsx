import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { timeLabel } from '../lib/dates';
import { goBack } from '../lib/router';
import { bodyOf, canStep, findItem, insertMedia, itemKey, itemOf, itemsOf, mediaKey, mergeMedia, moveMedia, plainText, removeItem, removeMedia, sameMedia, serializeBody, setLayout, stepMedia, takeOut, ungroup, type Body, type Item, type Layout, type Media } from '../lib/body';
import { editable, messy, PLAIN } from '../lib/editable';
import { imageSrc } from '../lib/images';
import { listKey, toggleTask } from '../lib/markdown';
import { addPhotos, photoUrl } from '../lib/photos';
import { findBook, mentionOf } from '../lib/books';
import { connectSpotify } from '../lib/spotify';
import { blankEntry, deleteEntry, getBooks, getEntries, getPeople, isEmpty, saveEntry, toast, type Book, type Entry, type Music } from '../lib/store';
import { openViewer } from '../lib/viewer';
import { contextNow, fillWeather, needsWeather } from '../lib/weather';
import { BookSheet } from '../components/books';
import { FormatBar } from '../components/FormatBar';
import { ImageSearchSheet } from '../components/ImageSearchSheet';
import { IconSheet } from '../components/IconPicker';
import { Icon, NoteIcon } from '../components/icons';
import { Markdown } from '../components/Markdown';
import { CoverImg, DetailsSummary, NoteDetails } from '../components/NoteDetails';
import { dropLayout, dropTargets, MediaBlock, MediaTools, sideAt, type DropTarget, type Side } from '../components/NoteMedia';
import { Sheet } from '../components/Sheet';
import { MusicEmbed, MusicRow, SpotifySheet } from '../components/SpotifySheet';
import '../styles/notes.css';

type Open = null | 'icon' | 'images' | 'spotify' | 'book' | { music: Music };

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

/**
 * One stretch of the note's text, between pictures. A plain-text editable block, not a textarea, so that its lines
 * wrap around a picture floated beside it. The browser owns what's in it; it's only rewritten when the text changes
 * from outside (a picture moved, a formatting command that fell back to rewriting).
 */
function BodyText({ value, onChange, onCaret, placeholder, grow, textRef }: {
  value: string;
  onChange: (v: string) => void;
  onCaret: (pos: number) => void;
  placeholder?: string;
  grow?: boolean;
  textRef?: (el: HTMLDivElement | null) => void;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const box = editable(el);
    if (box.value === value) return;
    const focused = document.activeElement === el;
    const at = box.selectionStart;
    box.value = value;
    if (focused) box.setSelectionRange(at, at);
  }, [value]);
  const caret = (e: Event) => {
    const el = e.currentTarget as HTMLDivElement;
    if (document.activeElement === el || e.type === 'blur') onCaret(editable(el).selectionStart);
  };
  return (
    <div
      ref={(el) => { ref.current = el; textRef?.(el); }}
      class={`body-input${grow ? ' grow' : ''}${value ? '' : ' is-empty'}`}
      contentEditable={PLAIN ? 'plaintext-only' : 'true'}
      role="textbox"
      aria-multiline="true"
      aria-label="Note"
      data-placeholder={placeholder}
      spellcheck
      onInput={(e) => {
        const el = e.currentTarget;
        if (!(e as InputEvent).isComposing && messy(el)) editable(el).tidy();
        onChange(editable(el).value);
        caret(e);
      }}
      onBeforeInput={(e) => {
        // browsers without plain-text editing: no bold, lists or pasted formatting, and Enter makes a line break
        if (PLAIN) return;
        if (e.inputType.startsWith('format')) e.preventDefault();
        else if (e.inputType === 'insertParagraph') {
          e.preventDefault();
          document.execCommand('insertText', false, '\n');
        }
      }}
      onPaste={(e) => {
        if (PLAIN || e.clipboardData?.files.length) return; // pictures are the page's to add
        e.preventDefault();
        document.execCommand('insertText', false, e.clipboardData?.getData('text/plain') ?? '');
      }}
      onKeyDown={(e) => listKey(editable(e.currentTarget), e) && e.preventDefault()}
      onKeyUp={caret}
      onPointerUp={caret}
      onFocus={caret}
      onBlur={caret}
    />
  );
}

export function Editor({ id, query }: { id: string; query?: URLSearchParams }) {
  const [draft, setDraft] = useState<Entry | null>(() => {
    if (id !== 'new') return getEntries().find((e) => e.id === id) ?? null;
    // "Write about …" from a person's page starts the note already tagged with them; from a book's, mentioning it.
    const pid = query?.get('person');
    const book = findBook(query?.get('book') ?? '');
    return { ...blankEntry('note'), people: pid && getPeople().some((p) => p.id === pid) ? [pid] : [], text: book ? mentionOf(book, getBooks()) + ' ' : '' };
  });
  const [open, setOpen] = useState<Open>(null);
  const [status, setStatus] = useState('');
  const [adding, setAdding] = useState(0);
  const [coverAdding, setCoverAdding] = useState(false);
  const [dropping, setDropping] = useState(false);
  const [sel, setSel] = useState<string | null>(null); // the selected picture's mediaKey
  // a picture being dragged, and where it would land: how far down the note, on which side, and its size there
  // — or the picture it's over, to make an album with
  const [moving, setMoving] = useState<{ key: string; y: number; side: Side; layout: Layout; ratio: number; onto: string | null } | null>(null);
  const [details, setDetails] = useState(false); // the Feelings page
  // Notes that already have words open formatted, to read; the pencil (or a tap on the words) switches to writing.
  const [reading, setReading] = useState(() => !!draft && id !== 'new' && !!plainText(draft.text).trim());
  const fileRef = useRef<HTMLInputElement>(null);
  const saved = useRef(id !== 'new');
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const latest = useRef(draft);
  latest.current = draft;

  const titleRef = useAutosize(draft?.title ?? '');
  const textRef = useRef<HTMLDivElement | null>(null);
  const areas = useRef<(HTMLDivElement | null)[]>([]);
  const bodyRef = useRef<HTMLDivElement>(null);
  const alive = useRef(true);
  const removing = useRef(false);
  const pendingImports = useRef(0);
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
    if (!d || !dirty.current) return;
    dirty.current = false;
    if (!saved.current && isEmpty(d)) return; // don't keep blank notes
    saveEntry(d);
    if (!saved.current) addPlaceAndWeather(d);
    saved.current = true;
    syncUrl();
    setStatus('Saved');
  };

  /** Where you are and the weather, looked up once a new note is kept. Joins the draft if it's still open. */
  const addPlaceAndWeather = async (d: Entry) => {
    const patch = await contextNow(d).catch(() => null);
    if (!patch || removing.current) return;
    if (alive.current && latest.current) {
      const now = latest.current;
      update({ ...(patch.place && !now.place ? { place: patch.place } : {}), ...(patch.weather && !now.weather ? { weather: patch.weather } : {}) });
    } else {
      const cur = getEntries().find((x) => x.id === d.id);
      if (cur) saveEntry({ ...cur, place: cur.place ?? patch.place ?? null, weather: cur.weather ?? patch.weather ?? null });
    }
  };

  const update = (patch: Partial<Entry>) => {
    if (!alive.current || removing.current || !latest.current) return;
    latest.current = { ...latest.current, ...patch };
    setDraft(latest.current);
    dirty.current = true;
    setStatus('');
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, 500);
  };

  useEffect(() => {
    const hide = () => document.visibilityState === 'hidden' && flush();
    document.addEventListener('visibilitychange', hide);
    addEventListener('popstate', syncUrl);
    // Back from logging in to Spotify (it returns to this note): say how it went and reopen the picker.
    const sp = query?.get('spotify');
    if (query?.get('person') || query?.get('book')) history.replaceState(history.state, '', '#/note/new');
    if (sp) {
      history.replaceState(history.state, '', location.hash.split('?')[0]);
      toast(sp === 'connected' ? 'Spotify connected' : sp === 'cancelled' ? 'Spotify login cancelled' : 'Couldn’t connect Spotify — try again');
      if (sp === 'connected') setOpen('spotify');
    } else if (id === 'new') titleRef.current?.focus();
    return () => {
      alive.current = false;
      if (pendingImports.current && !removing.current) toast('Photo import cancelled because you left the note');
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

  if (!draft)
    return (
      <div class="page">
        <div class="empty">
          <h2 class="title-s">This note doesn’t exist</h2>
          <p>It may have been deleted.</p>
          <button class="btn btn-primary" onClick={() => goBack()}>Back to journal</button>
        </div>
      </div>
    );

  const remove = async () => {
    removing.current = true;
    clearTimeout(timer.current);
    dirty.current = false;
    const removed = saved.current ? await deleteEntry(draft.id) : null;
    goBack();
    if (removed) toast(removed.kind === 'checkin' ? 'Check-in deleted' : 'Note deleted', { label: 'Undo', run: () => saveEntry(removed) });
  };

  const addFiles = async (all: File[]) => {
    if (!alive.current || removing.current) return;
    const files = all.filter(isImageFile);
    if (!files.length) return;
    const room = MAX_PHOTOS - draft.photos.length - adding;
    if (room <= 0) return toast(`A note can hold ${MAX_PHOTOS} photos`);
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
      if (failed) toast(failed === take.length && failed === 1 ? 'Couldn’t read that image' : `Couldn’t read ${failed} of the images`);
      else if (files.length > room) toast(`Added ${take.length} — a note can hold ${MAX_PHOTOS} photos`);
    } catch {
      if (alive.current && !removing.current) toast('Couldn’t save those photos. Please try again.');
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
      else toast('Couldn’t read that image');
    } catch {
      if (alive.current && !removing.current) toast('Couldn’t save that cover. Please try again.');
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
    const b = bodyOf(draft);
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
    toast(gone.length > 1 ? 'Album removed' : gone[0].kind === 'photo' ? 'Photo removed' : 'Image removed', {
      label: 'Undo',
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

    let target: DropTarget | null = null;
    let side: Side = 'center';
    let onto: string | null = null;
    let x = e.clientX, y = e.clientY;
    let frame = 0;
    const pick = () => {
      const col = bodyEl.getBoundingClientRect();
      const at = y + scrollY;
      target = targets.reduce((a, b) => (Math.abs(b.y - at) < Math.abs(a.y - at) ? b : a));
      side = sideAt(x, col);
      // over another picture of this note (the copy under the finger lets touches through)
      const over = document.elementFromPoint(x, y)?.closest<HTMLElement>('.media');
      onto = over && over.parentElement === bodyEl && over.dataset.key !== key ? over.dataset.key! : null;
      ghost.style.transform = `translate(${x - e.clientX}px, ${y - e.clientY}px) scale(${scale})`;
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
      cancelAnimationFrame(frame);
      removeEventListener('pointermove', move);
      removeEventListener('pointerup', up);
      removeEventListener('pointercancel', cancel);
      removeEventListener('keydown', esc, true);
      document.documentElement.classList.remove('is-moving');
      ghost.remove();
      setMoving(null);
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
        navigator.vibrate?.(10);
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
          return { src: (await photoUrl(it.id)) ?? '', w: p?.w, h: p?.h, el: at, save: name, alt: 'Photo', album, it };
        }
        const img = d.images.find((x) => x.url === it.url);
        return {
          src: img ? imageSrc(img, 'full') : it.url, w: img?.w, h: img?.h, el: at, link: img?.link, alt: img?.title || 'Image', album, it,
          caption: img ? [img.title, img.credit].filter(Boolean).join(' — ') : undefined,
        };
      }),
    );
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

  /** Switches to writing, with the caret at the end of text block `seg` (or where it was). */
  const write = (seg?: number) => {
    const go = () => {
      const el = seg === undefined ? areas.current[Math.max(0, where.current.seg)] ?? textRef.current : areas.current[seg];
      if (!el) return;
      el.focus();
      if (seg !== undefined) {
        const box = editable(el);
        box.setSelectionRange(box.value.length, box.value.length);
      }
    };
    if (!reading) return go();
    setReading(false);
    requestAnimationFrame(go); // once the text boxes are back
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
    const t = bb.texts[seg];
    const before = t.slice(0, pos), after = t.slice(pos);
    const add = (before && !/\s$/.test(before) ? ' ' : '') + mentionOf(b, getBooks()) + (/^\s/.test(after) ? '' : ' ');
    bb.texts[seg] = before + add + after;
    where.current = { seg, pos: pos + add.length };
    update({ text: serializeBody(bb) });
    setOpen(null);
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
        <button class="glass glass-btn round" onClick={() => { flush(); goBack(); }} disabled={adding > 0 || coverAdding} aria-label="Back"><Icon name="arrow-left" /></button>
        <span class="editor-status" aria-live="polite">{status && <span class="glass">{status}</span>}</span>
        <button
          class="glass glass-btn round"
          onClick={() => (reading ? write() : setReading(true))}
          aria-label={reading ? 'Edit' : 'Reading view'}
          title={reading ? 'Edit' : 'Reading view'}
        >
          <Icon name={reading ? 'pencil' : 'book'} />
        </button>
        <button class="glass glass-btn round" onClick={remove} aria-label={isCheckin ? 'Delete check-in' : 'Delete note'}><Icon name="trash" /></button>
        <button class="glass glass-btn tinted" onClick={() => { flush(); goBack(); }} disabled={adding > 0 || coverAdding}>Done</button>
      </div>

      <section class={`note-head${draft.cover ? ' has-cover' : ''}`}>
        {draft.cover && <CoverImg cover={draft.cover} class="note-head-cover" />}
        {isCheckin && <div class="eyebrow">Check-in · {timeLabel(draft.time)}</div>}
        <div class="editor-top">
          <button class={`icon-pick${draft.icon ? '' : ' is-empty'}`} onClick={() => setOpen('icon')} aria-label={draft.icon ? 'Change icon' : 'Add icon'}>
            {draft.icon ? <NoteIcon id={draft.icon} size={24} /> : <Icon name="mood-plus" size={20} />}
          </button>
          <textarea
            ref={titleRef}
            class="title-input"
            rows={1}
            placeholder="Title"
            value={draft.title}
            maxLength={300}
            onInput={(e) => update({ title: e.currentTarget.value.replace(/\n/g, ' ') })}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), write(0))}
            aria-label="Title"
          />
        </div>
        <DetailsSummary draft={draft} onOpen={() => setDetails(true)} />
      </section>

      <div class={`note-body${reading ? ' is-reading' : ''}`} ref={bodyRef}>
        {body.texts.map((t, i) => (
          <>
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
              t.trim() && (
                <div
                  class="read-text"
                  onClick={(e) => {
                    // a tap on the words starts writing there; links, ticks and selecting text don't
                    if ((e.target as Element).closest('a, input, button') || !getSelection()?.isCollapsed) return;
                    write(i);
                  }}
                >
                  <Markdown text={t} onTask={(line) => setText(i, toggleTask(t, line))} />
                </div>
              )
            ) : (
            <BodyText
              value={t}
              textRef={(el) => { areas.current[i] = el; if (i === 0) textRef.current = el; }}
              grow={i === last}
              placeholder={i === 0 && !body.media.length ? 'What’s on your mind?' : i === last ? 'Keep writing…' : undefined}
              onChange={(v) => setText(i, v)}
              onCaret={(pos) => (where.current = { seg: i, pos })}
            />
            )}
          </>
        ))}
        {adding > 0 && Array.from({ length: adding }, () => <span class="inline-media photo-ph is-loading" aria-label="Adding photo" />)}
        {moving && !moving.onto && (
          <span
            class={`drop-slot is-${moving.side}`}
            style={{ top: moving.y + 'px', width: (moving.layout.size ?? 100) + '%', aspectRatio: String(moving.ratio) }}
            aria-hidden="true"
          >
            <span class="drop-slot-label glass">{moving.side === 'center' ? 'On its own line' : 'Text wraps around'}</span>
          </span>
        )}
        {reading && !plainText(draft.text).trim() && (
          <button class="read-empty" onClick={() => write(last)}>Nothing written yet. Tap to write.</button>
        )}
        {reading && <button class="read-tail" onClick={() => write(last)} aria-label="Keep writing" tabIndex={-1} />}
      </div>

      {draft.music.length > 0 && (
        <div class="tracks">
          {draft.music.map((m) => (
            <MusicRow m={m} onClick={() => setOpen({ music: m })} end={<Icon name="brand-spotify" size={18} />} />
          ))}
        </div>
      )}
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
        swap={selIndex >= 0 && (
          <MediaTools
            m={body.media[selIndex]}
            canUp={canStep(body, selIndex, -1)}
            canDown={canStep(body, selIndex, 1)}
            onLayout={(l) => update({ text: serializeBody(setLayout(bodyOf(latest.current!), selIndex, l)) })}
            onStep={(dir) => setBody(stepMedia(bodyOf(latest.current!), selIndex, dir))}
            onOpen={() => view(selIndex)}
            onRemove={() => removePicture(body.media[selIndex])}
            onUngroup={() => {
              const b = ungroup(bodyOf(latest.current!), selIndex);
              setBody(b);
              setSel(mediaKey(b.media[selIndex]));
            }}
          />
        )}
      >
        <button class="format-btn" onClick={() => fileRef.current?.click()} disabled={draft.photos.length + adding >= MAX_PHOTOS} aria-label="Add photos" title="Add photos">
          <Icon name="photo-plus" size={19} />
        </button>
        <button class="format-btn" onClick={() => setOpen('images')} aria-label="Find an image" title="Find an image">
          <Icon name="photo-search" size={19} />
        </button>
        <button class="format-btn" onClick={() => setOpen('spotify')} aria-label="Add music from Spotify" title="Add music from Spotify">
          <Icon name="brand-spotify" size={19} />
        </button>
        <button class="format-btn" onClick={() => setOpen('book')} aria-label="Mention a book" title="Mention a book">
          <Icon name="books" size={19} />
        </button>
      </FormatBar>
      {dropping && <div class="drop-overlay" aria-hidden="true"><span class="glass"><Icon name="photo-plus" size={20} /> Drop to add photos</span></div>}

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
      <BookSheet open={open === 'book'} onClose={close} onPick={mentionBook} title="Mention a book" status="reading" />
      <SpotifySheet
        open={open === 'spotify'}
        onClose={close}
        onConnect={() => { flush(); connectSpotify(saved.current ? '#/note/' + draft.id : '#/note/new'); }}
        onAdd={(list) => update({ music: [...draft.music, ...list.filter((m) => !draft.music.some((x) => x.kind === m.kind && x.id === m.id))].slice(0, 20) })}
      />
      <Sheet open={typeof open === 'object' && open !== null && 'music' in open} onClose={close} title="Music">
        {typeof open === 'object' && open && 'music' in open && (
          <div class="stack">
            <MusicEmbed m={open.music} />
            <div class="row gap-s">
              <a class="btn btn-quiet grow" href={open.music.link} target="_blank" rel="noopener noreferrer">
                <Icon name="brand-spotify" size={18} /> Open in Spotify
              </a>
              <button class="btn btn-quiet grow danger" onClick={() => { update({ music: draft.music.filter((x) => !(x.kind === open.music.kind && x.id === open.music.id)) }); close(); }}>
                <Icon name="trash" size={18} /> Remove
              </button>
            </div>
          </div>
        )}
      </Sheet>
    </div>
  );
}
