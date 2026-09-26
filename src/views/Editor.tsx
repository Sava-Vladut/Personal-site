import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { EMOTION } from '../data/emotions';
import { rangeLabel, timeLabel } from '../lib/dates';
import { goBack } from '../lib/router';
import { sized } from '../lib/pinterest';
import { connectSpotify } from '../lib/spotify';
import { blankEntry, deleteEntry, getEntries, isEmpty, saveEntry, toast, type Entry, type Music, type PinImage } from '../lib/store';
import { DateSheet } from '../components/Calendar';
import { EmotionChip, EmotionPicker, IntensityPicker } from '../components/emotion';
import { IconSheet } from '../components/IconPicker';
import { Icon, NoteIcon } from '../components/icons';
import { PinterestSheet } from '../components/PinterestSheet';
import { Sheet } from '../components/Sheet';
import { MusicEmbed, MusicRow, SpotifySheet } from '../components/SpotifySheet';

type Open = null | 'icon' | 'date' | 'emotion' | 'pinterest' | 'spotify' | { image: PinImage } | { music: Music };

function useAutosize(value: string) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }, [value]);
  return ref;
}

export function Editor({ id, query }: { id: string; query?: URLSearchParams }) {
  const [draft, setDraft] = useState<Entry | null>(() => (id === 'new' ? blankEntry('note') : getEntries().find((e) => e.id === id) ?? null));
  const [open, setOpen] = useState<Open>(null);
  const [status, setStatus] = useState('');
  const saved = useRef(id !== 'new');
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const latest = useRef(draft);
  latest.current = draft;

  const titleRef = useAutosize(draft?.title ?? '');
  const textRef = useAutosize(draft?.text ?? '');

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
    if (sp) {
      history.replaceState(history.state, '', location.hash.split('?')[0]);
      toast(sp === 'connected' ? 'Spotify connected' : sp === 'cancelled' ? 'Spotify login cancelled' : 'Couldn’t connect Spotify — try again');
      if (sp === 'connected') setOpen('spotify');
    } else if (id === 'new') titleRef.current?.focus();
    return () => {
      document.removeEventListener('visibilitychange', hide);
      removeEventListener('popstate', syncUrl);
      flush();
    };
  }, []);

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

  const addEmotion = (eid: string) => {
    const list = draft.emotions.filter((x) => x !== eid && !eid.startsWith(x + '/') && !x.startsWith(eid + '/'));
    update({ emotions: [...list, eid].slice(-3) });
    setOpen(null);
  };

  const close = () => setOpen(null);
  const isCheckin = draft.kind === 'checkin';

  return (
    <div class="page editor">
      <div class="editor-bar">
        <button class="glass glass-btn round" onClick={() => { flush(); goBack(); }} aria-label="Back"><Icon name="arrow-left" /></button>
        <span class="editor-status" aria-live="polite">{status && <span class="glass">{status}</span>}</span>
        <button class="glass glass-btn round" onClick={remove} aria-label={isCheckin ? 'Delete check-in' : 'Delete note'}><Icon name="trash" /></button>
        <button class="glass glass-btn tinted" onClick={() => { flush(); goBack(); }}>Done</button>
      </div>

      {isCheckin && <div class="eyebrow">Check-in · {timeLabel(draft.time)}</div>}

      <div class="editor-top">
        <button class={`icon-pick${draft.icon ? '' : ' is-empty'}`} onClick={() => setOpen('icon')} aria-label={draft.icon ? 'Change icon' : 'Add icon'}>
          {draft.icon ? <NoteIcon id={draft.icon} size={28} /> : <Icon name="mood-plus" size={22} />}
        </button>
        <textarea
          ref={titleRef}
          class="title-input"
          rows={1}
          placeholder="Title"
          value={draft.title}
          maxLength={300}
          onInput={(e) => update({ title: e.currentTarget.value.replace(/\n/g, ' ') })}
          onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), textRef.current?.focus())}
          aria-label="Title"
        />
      </div>

      <div class="meta">
        <button class="chip" onClick={() => setOpen('date')}>
          <Icon name="calendar-event" size={16} /> {rangeLabel(draft.date, draft.dateEnd)}
        </button>
        {draft.emotions.map((eid) => (
          <EmotionChip id={eid} onRemove={() => update({ emotions: draft.emotions.filter((x) => x !== eid) })} />
        ))}
        {draft.emotions.length < 3 && (
          <button class="chip" onClick={() => setOpen('emotion')}>
            <Icon name="mood-plus" size={16} /> {draft.emotions.length ? 'Add' : 'How does it feel?'}
          </button>
        )}
      </div>

      {draft.emotions.length > 0 && (
        <div class="meta-row">
          <span class="eyebrow">Intensity</span>
          <IntensityPicker value={draft.intensity} onChange={(n) => update({ intensity: n })} />
        </div>
      )}

      {draft.emotions.length === 1 && EMOTION[draft.emotions[0]]?.depth === 2 && (
        <p class="definition">{EMOTION[draft.emotions[0]].def}</p>
      )}

      <textarea
        ref={textRef}
        class="body-input"
        placeholder="What’s on your mind?"
        value={draft.text}
        onInput={(e) => update({ text: e.currentTarget.value })}
        aria-label="Note"
      />

      {draft.music.length > 0 && (
        <div class="tracks">
          {draft.music.map((m) => (
            <MusicRow m={m} onClick={() => setOpen({ music: m })} end={<Icon name="brand-spotify" size={18} />} />
          ))}
        </div>
      )}
      {draft.images.length > 0 && (
        <div class="images">
          {draft.images.map((img) => (
            <button class="image" onClick={() => setOpen({ image: img })}>
              <img src={sized(img.url, 474)} alt={img.title || 'Image from Pinterest'} loading="lazy" referrerpolicy="no-referrer" style={img.w && img.h ? { aspectRatio: `${img.w} / ${img.h}` } : undefined} />
            </button>
          ))}
        </div>
      )}
      <div class="add-row">
        <button class="btn btn-quiet" onClick={() => setOpen('spotify')}>
          <Icon name="brand-spotify" size={18} /> Add music from Spotify
        </button>
        <button class="btn btn-quiet" onClick={() => setOpen('pinterest')}>
          <Icon name="brand-pinterest" size={18} /> Add image from Pinterest
        </button>
      </div>

      <IconSheet open={open === 'icon'} onClose={close} value={draft.icon} onChange={(icon) => update({ icon })} />
      <DateSheet open={open === 'date'} onClose={close} start={draft.date} end={draft.dateEnd} onChange={(date, dateEnd) => update({ date, dateEnd })} />
      <Sheet open={open === 'emotion'} onClose={close} title="How does it feel?">
        <EmotionPicker onPick={addEmotion} selected={draft.emotions} />
      </Sheet>
      <PinterestSheet
        open={open === 'pinterest'}
        onClose={close}
        onAdd={(imgs) => update({ images: [...draft.images, ...imgs.filter((i) => !draft.images.some((x) => x.url === i.url))].slice(0, 12) })}
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
      <Sheet open={typeof open === 'object' && open !== null && 'image' in open} onClose={close} title="Image">
        {typeof open === 'object' && open && 'image' in open && (
          <div class="stack">
            <img class="lightbox" src={sized(open.image.url, 736)} alt={open.image.title || ''} referrerpolicy="no-referrer" />
            <div class="row gap-s">
              {open.image.link && (
                <a class="btn btn-quiet grow" href={open.image.link} target="_blank" rel="noopener noreferrer">
                  <Icon name="arrow-up-right" size={18} /> Open on Pinterest
                </a>
              )}
              <button class="btn btn-quiet grow danger" onClick={() => { update({ images: draft.images.filter((x) => x.url !== open.image.url) }); close(); }}>
                <Icon name="trash" size={18} /> Remove
              </button>
            </div>
          </div>
        )}
      </Sheet>
    </div>
  );
}
