import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { timeLabel } from '../lib/dates';
import { goBack } from '../lib/router';
import { bodyOf, canStep, insertMedia, mediaKey, moveMedia, plainText, removeMedia, sameMedia, serializeBody, setLayout, stepMedia, type Body, type Media } from '../lib/body';
import { imageSrc } from '../lib/images';
import { listKey, toggleTask } from '../lib/markdown';
import { addPhotos, usePhotoUrl, type Photo } from '../lib/photos';
import { connectSpotify } from '../lib/spotify';
import { blankEntry, deleteEntry, getEntries, getPeople, isEmpty, saveEntry, toast, type Entry, type Music, type WebImage } from '../lib/store';
import { FormatBar } from '../components/FormatBar';
import { ImageSearchSheet } from '../components/ImageSearchSheet';
import { IconSheet } from '../components/IconPicker';
import { Icon, NoteIcon } from '../components/icons';
import { Markdown } from '../components/Markdown';
import { CoverImg, DetailsSummary, NoteDetails } from '../components/NoteDetails';
import { dropTargets, MediaBlock, type DropTarget } from '../components/NoteMedia';
import { PhotoImg } from '../components/Photo';
import { Sheet } from '../components/Sheet';
import { MusicEmbed, MusicRow, SpotifySheet } from '../components/SpotifySheet';
import '../styles/notes.css';

type Open = null | 'icon' | 'images' | 'spotify' | { image: WebImage } | { photo: Photo } | { music: Music };

const MAX_PHOTOS = 20;
const isImageFile = (f: File) => f.type.startsWith('image/') || /\.(heic|heif|avif|webp)$/i.test(f.name);

function fit(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
}

/** Keeps a text box as tall as its text — again when its class changes (a box that stops growing drops its min-height) or the window is resized. */
function useAutosize(value: string, grow?: boolean) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => fit(ref.current), [value, grow]);
  useEffect(() => {
    const on = () => fit(ref.current);
    addEventListener('resize', on);
    return () => removeEventListener('resize', on);
  }, []);
  return ref;
}

/** One stretch of the note's text, between pictures. Grows with its content. */
function BodyText({ value, onChange, onCaret, placeholder, grow, textRef }: {
  value: string;
  onChange: (v: string) => void;
  onCaret: (pos: number) => void;
  placeholder?: string;
  grow?: boolean;
  textRef?: (el: HTMLTextAreaElement | null) => void;
}) {
  const ref = useAutosize(value, grow);
  const caret = (e: Event) => onCaret((e.currentTarget as HTMLTextAreaElement).selectionStart ?? 0);
  return (
    <textarea
      ref={(el) => { ref.current = el; textRef?.(el); }}
      class={`body-input${grow ? ' grow' : ''}`}
      rows={1}
      placeholder={placeholder}
      value={value}
      onInput={(e) => { onChange(e.currentTarget.value); caret(e); }}
      onKeyDown={(e) => listKey(e.currentTarget, e) && e.preventDefault()}
      onBlur={caret}
      onSelect={caret}
      aria-label="Note"
    />
  );
}

export function Editor({ id, query }: { id: string; query?: URLSearchParams }) {
  const [draft, setDraft] = useState<Entry | null>(() => {
    if (id !== 'new') return getEntries().find((e) => e.id === id) ?? null;
    // "Write about …" from a person's page starts the note already tagged with them.
    const pid = query?.get('person');
    return { ...blankEntry('note'), people: pid && getPeople().some((p) => p.id === pid) ? [pid] : [] };
  });
  const [open, setOpen] = useState<Open>(null);
  const [status, setStatus] = useState('');
  const [adding, setAdding] = useState(0);
  const [dropping, setDropping] = useState(false);
  const [sel, setSel] = useState<string | null>(null); // the selected picture's mediaKey
  const [moving, setMoving] = useState<{ key: string; y: number } | null>(null); // a picture being dragged, and where it would land
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
  const textRef = useRef<HTMLTextAreaElement | null>(null);
  const areas = useRef<(HTMLTextAreaElement | null)[]>([]);
  const bodyRef = useRef<HTMLDivElement>(null);
  const alive = useRef(true);
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
    saved.current = true;
    syncUrl();
    setStatus('Saved');
  };

  const update = (patch: Partial<Entry>) => {
    setDraft((d) => (d ? { ...d, ...patch } : d));
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
    if (query?.get('person')) history.replaceState(history.state, '', '#/note/new');
    if (sp) {
      history.replaceState(history.state, '', location.hash.split('?')[0]);
      toast(sp === 'connected' ? 'Spotify connected' : sp === 'cancelled' ? 'Spotify login cancelled' : 'Couldn’t connect Spotify — try again');
      if (sp === 'connected') setOpen('spotify');
    } else if (id === 'new') titleRef.current?.focus();
    return () => {
      alive.current = false;
      document.removeEventListener('visibilitychange', hide);
      removeEventListener('popstate', syncUrl);
      flush();
    };
  }, []);

  // A selected picture lets go when you tap anywhere else, or press Escape.
  useEffect(() => {
    if (!sel) return;
    const down = (e: PointerEvent) => {
      if (!(e.target as Element).closest?.('.media.is-selected, .sheet, .toast')) setSel(null);
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
    clearTimeout(timer.current);
    dirty.current = false;
    const removed = saved.current ? await deleteEntry(draft.id) : null;
    goBack();
    if (removed) toast(removed.kind === 'checkin' ? 'Check-in deleted' : 'Note deleted', { label: 'Undo', run: () => saveEntry(removed) });
  };

  const addFiles = async (all: File[]) => {
    const files = all.filter(isImageFile);
    if (!files.length) return;
    const room = MAX_PHOTOS - draft.photos.length - adding;
    if (room <= 0) return toast(`A note can hold ${MAX_PHOTOS} photos`);
    const take = files.slice(0, room);
    setAdding((n) => n + take.length);
    const { photos, failed } = await addPhotos(take);
    setAdding((n) => n - take.length);
    const d = latest.current;
    if (d && photos.length) {
      const fit = photos.slice(0, MAX_PHOTOS - d.photos.length);
      update({ photos: [...d.photos, ...fit], text: place(bodyOf(d), fit.map((p) => ({ kind: 'photo', id: p.id }))) });
    }
    if (failed) toast(failed === take.length && failed === 1 ? 'Couldn’t read that image' : `Couldn’t read ${failed} of the images`);
    else if (files.length > room) toast(`Added ${take.length} — a note can hold ${MAX_PHOTOS} photos`);
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

  const removePicture = (m: Media) => {
    const d = latest.current;
    if (!d) return;
    const b = bodyOf(d);
    const i = b.media.findIndex((x) => sameMedia(x, m));
    if (i < 0) return;
    const at = b.media[i];
    const pos = b.texts[i].length + (b.texts[i] && b.texts[i + 1] ? 1 : 0); // where it sat in the joined text
    const photo = at.kind === 'photo' ? d.photos.find((p) => p.id === at.id) : undefined;
    const image = at.kind === 'image' ? d.images.find((x) => x.url === at.url) : undefined;
    where.current = { seg: -1, pos: 0 };
    update({ photos: d.photos.filter((p) => p !== photo), images: d.images.filter((x) => x !== image), text: serializeBody(removeMedia(b, at)) });
    setSel(null);
    setOpen(null);
    const restore = (e: Entry): Partial<Entry> => ({
      photos: photo && !e.photos.some((p) => p.id === photo.id) ? [...e.photos, photo] : e.photos,
      images: image && !e.images.some((x) => x.url === image.url) ? [...e.images, image] : e.images,
      text: serializeBody(insertMedia(bodyOf(e), [at], i, pos)),
    });
    toast(photo ? 'Photo removed' : 'Image removed', {
      label: 'Undo',
      run: () => {
        if (alive.current) return latest.current && update(restore(latest.current));
        const e = getEntries().find((x) => x.id === d.id);
        if (e) saveEntry({ ...e, ...restore(e) });
      },
    });
  };

  /** Follows the pointer and shows where the picture would land; drops it there on release. Escape cancels. */
  const startMove = (i: number, e: PointerEvent) => {
    const bodyEl = bodyRef.current;
    const d = latest.current;
    if (!bodyEl || !d) return;
    const key = mediaKey(bodyOf(d).media[i]);
    const targets = dropTargets(areas.current.slice(0, bodyOf(d).texts.length));
    if (!targets.length) return;
    const origin = bodyEl.getBoundingClientRect().top + scrollY;
    let target: DropTarget | null = null;
    let y = e.clientY;
    let frame = 0;
    const pick = () => {
      const at = y + scrollY;
      target = targets.reduce((a, b) => (Math.abs(b.y - at) < Math.abs(a.y - at) ? b : a));
      setMoving({ key, y: target.y - origin });
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
      setMoving(null);
      const now = latest.current;
      if (!drop || !target || !now) return;
      const b = bodyOf(now);
      const j = b.media.findIndex((x) => mediaKey(x) === key);
      if (j < 0) return;
      const next = moveMedia(b, j, target.seg, target.pos);
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
    setSel(key);
    pick();
    frame = requestAnimationFrame(tick);
  };

  /** Switches to writing, with the caret at the end of text block `seg` (or where it was). */
  const write = (seg?: number) => {
    const go = () => {
      const el = seg === undefined ? areas.current[Math.max(0, where.current.seg)] ?? textRef.current : areas.current[seg];
      if (!el) return;
      if (seg !== undefined) el.setSelectionRange(el.value.length, el.value.length);
      el.focus();
    };
    if (!reading) return go();
    setReading(false);
    requestAnimationFrame(go); // once the text boxes are back
  };
  /** The text box the toolbar formats: the one being written in, or the last one that was. */
  const target = () => {
    const active = document.activeElement;
    if (active instanceof HTMLTextAreaElement && areas.current.includes(active)) return active;
    return areas.current[where.current.seg] ?? areas.current[body.texts.length - 1] ?? null;
  };

  const close = () => setOpen(null);
  const isCheckin = draft.kind === 'checkin';
  const body = bodyOf(draft);
  const last = body.texts.length - 1;

  return (
    <div
      class={`page editor${dropping ? ' is-dropping' : ''}`}
      onDragOver={(e) => { if (hasFiles(e)) { e.preventDefault(); e.dataTransfer!.dropEffect = 'copy'; setDropping(true); } }}
      onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropping(false); }}
      onDrop={(e) => { if (hasFiles(e)) { e.preventDefault(); setDropping(false); addFiles([...e.dataTransfer!.files]); } }}
      onPaste={(e) => { const files = [...(e.clipboardData?.files ?? [])].filter(isImageFile); if (files.length) { e.preventDefault(); addFiles(files); } }}
    >
      <div class="editor-bar">
        <button class="glass glass-btn round" onClick={() => { flush(); goBack(); }} aria-label="Back"><Icon name="arrow-left" /></button>
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
        <button class="glass glass-btn tinted" onClick={() => { flush(); goBack(); }}>Done</button>
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
              const photo = m.kind === 'photo' ? draft.photos.find((p) => p.id === m.id) : undefined;
              const image = m.kind === 'image' ? draft.images.find((x) => x.url === m.url) : undefined;
              return (
                <MediaBlock
                  key={key}
                  m={m}
                  draft={draft}
                  selected={!reading && sel === key}
                  dragging={moving?.key === key}
                  canUp={canStep(body, i - 1, -1)}
                  canDown={canStep(body, i - 1, 1)}
                  onSelect={() => (reading ? photo ? setOpen({ photo }) : image && setOpen({ image }) : setSel(key))}
                  onOpen={() => photo ? setOpen({ photo }) : image && setOpen({ image })}
                  onLayout={(l) => update({ text: serializeBody(setLayout(bodyOf(latest.current!), i - 1, l)) })}
                  onStep={(dir) => setBody(stepMedia(bodyOf(latest.current!), i - 1, dir))}
                  onRemove={() => removePicture(m)}
                  onDrag={(e) => !reading && startMove(i - 1, e)}
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
        {moving && <span class="drop-line" style={{ top: moving.y + 'px' }} aria-hidden="true" />}
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
      <FormatBar target={target} format={!reading}>
        <button class="format-btn" onClick={() => fileRef.current?.click()} disabled={draft.photos.length + adding >= MAX_PHOTOS} aria-label="Add photos" title="Add photos">
          <Icon name="photo-plus" size={19} />
        </button>
        <button class="format-btn" onClick={() => setOpen('images')} aria-label="Find an image" title="Find an image">
          <Icon name="photo-search" size={19} />
        </button>
        <button class="format-btn" onClick={() => setOpen('spotify')} aria-label="Add music from Spotify" title="Add music from Spotify">
          <Icon name="brand-spotify" size={19} />
        </button>
      </FormatBar>
      {dropping && <div class="drop-overlay" aria-hidden="true"><span class="glass"><Icon name="photo-plus" size={20} /> Drop to add photos</span></div>}

      <IconSheet open={open === 'icon'} onClose={close} value={draft.icon} onChange={(icon) => update({ icon })} />
      <NoteDetails open={details} onClose={() => setDetails(false)} draft={draft} update={update} />
      <ImageSearchSheet
        open={open === 'images'}
        onClose={close}
        onAdd={(imgs) => {
          const fresh = imgs.filter((i) => !draft.images.some((x) => x.url === i.url)).slice(0, 12 - draft.images.length);
          update({ images: [...draft.images, ...fresh], text: place(body, fresh.map((i) => ({ kind: 'image', url: i.url }))) });
        }}
      />
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
      <Sheet open={typeof open === 'object' && open !== null && 'photo' in open} onClose={close} title="Photo">
        {typeof open === 'object' && open && 'photo' in open && (
          <PhotoView
            photo={open.photo}
            name={draft.title.trim() || 'photo'}
            onRemove={() => removePicture({ kind: 'photo', id: open.photo.id })}
          />
        )}
      </Sheet>
      <Sheet open={typeof open === 'object' && open !== null && 'image' in open} onClose={close} title="Image">
        {typeof open === 'object' && open && 'image' in open && (
          <div class="stack">
            <img class="lightbox" src={imageSrc(open.image, 'full')} alt={open.image.title || ''} referrerpolicy="no-referrer" />
            {(open.image.title || open.image.credit) && (
              <p class="hint center">{[open.image.title, open.image.credit].filter(Boolean).join(' — ')}</p>
            )}
            <div class="row gap-s">
              {open.image.link && (
                <a class="btn btn-quiet grow" href={open.image.link} target="_blank" rel="noopener noreferrer">
                  <Icon name="arrow-up-right" size={18} /> Open source
                </a>
              )}
              <button class="btn btn-quiet grow danger" onClick={() => removePicture({ kind: 'image', url: open.image.url })}>
                <Icon name="trash" size={18} /> Remove
              </button>
            </div>
          </div>
        )}
      </Sheet>
    </div>
  );
}

function PhotoView({ photo, name, onRemove }: { photo: Photo; name: string; onRemove: () => void }) {
  const url = usePhotoUrl(photo.id);
  return (
    <div class="stack">
      <PhotoImg photo={photo} class="lightbox" alt="" fit={false} />
      <div class="row gap-s">
        {url && (
          <a class="btn btn-quiet grow" href={url} download={name.replace(/[\\/:*?"<>|]+/g, '').slice(0, 60) || 'photo'}>
            <Icon name="download" size={18} /> Save
          </a>
        )}
        <button class="btn btn-quiet grow danger" onClick={onRemove}>
          <Icon name="trash" size={18} /> Remove
        </button>
      </div>
    </div>
  );
}
