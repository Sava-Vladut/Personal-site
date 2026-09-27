import { useEffect, useRef, useState } from 'preact/hooks';
import { EMOTION } from '../data/emotions';
import { rangeLabel } from '../lib/dates';
import { imageSrc } from '../lib/images';
import { addPhotos } from '../lib/photos';
import { pushBack } from '../lib/router';
import { toast, type Cover, type Entry } from '../lib/store';
import { DateSheet } from './Calendar';
import { EmotionChip, EmotionPicker, INTENSITY, IntensityPicker } from './emotion';
import { Icon } from './icons';
import { ImageSearchSheet } from './ImageSearchSheet';
import { PeopleChips, PeopleSheet, PersonChip, usePeopleById } from './people';
import { PhotoImg } from './Photo';
import { Sheet } from './Sheet';

/** A note's cover picture, filling whatever box it's put in. */
export function CoverImg({ cover, class: cls }: { cover: Cover; class?: string }) {
  return 'photo' in cover ? (
    <PhotoImg photo={cover.photo} class={cls} fit={false} alt="" />
  ) : (
    <img class={cls} src={imageSrc(cover.image, 'full')} alt="" loading="lazy" referrerpolicy="no-referrer" />
  );
}

/** The one-line summary of a note's details at its top: when, how it felt, who it's about. Tap for the Feelings page. */
export function DetailsSummary({ draft, onOpen }: { draft: Entry; onOpen: () => void }) {
  const byId = usePeopleById();
  const people = draft.people.map((id) => byId.get(id)!).filter(Boolean);
  return (
    <button class="details-summary" onClick={onOpen} aria-label="Feelings, people, date and cover">
      <span class="details-chips">
        <span class="details-date"><Icon name="calendar-event" size={15} /> {rangeLabel(draft.date, draft.dateEnd)}</span>
        {draft.emotions.map((id) => <EmotionChip id={id} size="sm" />)}
        {draft.emotions.length > 0 && <Bars n={draft.intensity} />}
        {people.map((p) => <PersonChip p={p} size="sm" />)}
        {!draft.emotions.length && <span class="details-add"><Icon name="mood-plus" size={15} /> How does it feel?</span>}
      </span>
      <Icon name="chevron-right" size={18} class="details-go" />
    </button>
  );
}

function Bars({ n }: { n: number }) {
  return (
    <span class="mini-bars" title={`Intensity: ${INTENSITY[n - 1]}`} aria-label={`Intensity: ${INTENSITY[n - 1]}`}>
      {INTENSITY.map((_, i) => <i class={i < n ? 'on' : ''} style={{ height: `${4 + i * 2}px` }} />)}
    </span>
  );
}

type Open = null | 'date' | 'emotion' | 'people' | 'cover-search';

/**
 * The Feelings page: everything about a note apart from its words — how it felt and how strongly, who it's about,
 * when it happened and its cover. It slides over the note and edits the same draft; Back returns to the writing.
 */
export function NoteDetails({ open, onClose, draft, update }: { open: boolean; onClose: () => void; draft: Entry; update: (patch: Partial<Entry>) => void }) {
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);
  const [sheet, setSheet] = useState<Open>(null);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;

  useEffect(() => {
    if (open) {
      setMounted(true);
      setClosing(false);
      const release = pushBack(() => closeRef.current());
      const prev = document.activeElement as HTMLElement | null;
      requestAnimationFrame(() => panel.current?.focus({ preventScroll: true }));
      return () => {
        release();
        prev?.focus?.({ preventScroll: true });
      };
    }
    if (mounted) {
      setClosing(true);
      const t = setTimeout(() => setMounted(false), 220);
      return () => clearTimeout(t);
    }
  }, [open]);

  if (!mounted) return null;

  const close = () => setSheet(null);
  const addEmotion = (eid: string) => {
    const list = draft.emotions.filter((x) => x !== eid && !eid.startsWith(x + '/') && !x.startsWith(eid + '/'));
    update({ emotions: [...list, eid].slice(-3) });
    setSheet(null);
  };
  const upload = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    const { photos } = await addPhotos([file]);
    setBusy(false);
    if (photos[0]) update({ cover: { photo: photos[0] } });
    else toast('Couldn’t read that image');
  };
  const pictures: Cover[] = [...draft.photos.map((photo) => ({ photo })), ...draft.images.map((image) => ({ image }))];
  const same = (a: Cover | null, b: Cover) => !!a && ('photo' in a ? 'photo' in b && a.photo.id === b.photo.id : 'image' in b && a.image.url === b.image.url);
  const only = draft.emotions.length === 1 ? EMOTION[draft.emotions[0]] : null;

  return (
    <div
      ref={panel}
      class={`details${closing ? ' closing' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="Feelings"
      tabIndex={-1}
      onKeyDown={(e) => e.key === 'Escape' && !document.querySelector('.sheet-wrap') && (e.stopPropagation(), onClose())}
    >
      <div class="details-page">
        <div class="editor-bar">
          <button class="glass glass-btn round" onClick={onClose} aria-label="Back to the note"><Icon name="arrow-left" /></button>
          <span class="grow" />
          <button class="glass glass-btn tinted" onClick={onClose}>Done</button>
        </div>
        <h1 class="title details-title">Feelings</h1>
        {draft.title.trim() && <p class="details-of">{draft.title}</p>}

        <section class="details-section">
          <h2 class="eyebrow">How does it feel?</h2>
          <div class="meta">
            {draft.emotions.map((eid) => (
              <EmotionChip id={eid} onRemove={() => update({ emotions: draft.emotions.filter((x) => x !== eid) })} />
            ))}
            {draft.emotions.length < 3 && (
              <button class="chip" onClick={() => setSheet('emotion')}>
                <Icon name="mood-plus" size={16} /> {draft.emotions.length ? 'Add' : 'Name the feeling'}
              </button>
            )}
          </div>
          {draft.emotions.length > 0 && (
            <div class="meta-row">
              <span class="eyebrow">Intensity</span>
              <IntensityPicker value={draft.intensity} onChange={(n) => update({ intensity: n })} />
            </div>
          )}
          {only?.depth === 2 && <p class="definition">{only.def}</p>}
        </section>

        <section class="details-section">
          <h2 class="eyebrow">Who is it about?</h2>
          <div class="meta">
            <PeopleChips ids={draft.people} onChange={(people) => update({ people })} onAdd={() => setSheet('people')} label="Add someone" />
          </div>
        </section>

        <section class="details-section">
          <h2 class="eyebrow">When</h2>
          <div class="meta">
            <button class="chip" onClick={() => setSheet('date')}>
              <Icon name="calendar-event" size={16} /> {rangeLabel(draft.date, draft.dateEnd)}
            </button>
          </div>
        </section>

        <section class="details-section">
          <h2 class="eyebrow">Cover</h2>
          <p class="details-hint">Shown faintly behind the note in your journal.</p>
          {draft.cover && (
            <div class="cover-preview">
              <CoverImg cover={draft.cover} />
              <button class="glass glass-btn round cover-remove" onClick={() => update({ cover: null })} aria-label="Remove cover"><Icon name="trash" size={18} /></button>
            </div>
          )}
          <div class="cover-picks">
            <button class="cover-pick" onClick={() => fileRef.current?.click()} disabled={busy}>
              <Icon name="photo-plus" size={20} /><span>{busy ? 'Adding…' : 'Upload'}</span>
            </button>
            <button class="cover-pick" onClick={() => setSheet('cover-search')}>
              <Icon name="photo-search" size={20} /><span>Find</span>
            </button>
            {pictures.map((c) => (
              <button class="cover-pick is-pic" aria-pressed={same(draft.cover, c)} onClick={() => update({ cover: same(draft.cover, c) ? null : c })} aria-label="Use this picture as the cover">
                {'photo' in c ? <PhotoImg photo={c.photo} fit={false} /> : <img src={imageSrc(c.image, 'thumb')} alt="" loading="lazy" referrerpolicy="no-referrer" />}
              </button>
            ))}
          </div>
          <input ref={fileRef} type="file" accept="image/*,.heic,.heif" hidden onChange={(e) => { const input = e.currentTarget; upload(input.files?.[0]); input.value = ''; }} />
        </section>
      </div>

      <DateSheet open={sheet === 'date'} onClose={close} start={draft.date} end={draft.dateEnd} onChange={(date, dateEnd) => update({ date, dateEnd })} />
      <Sheet open={sheet === 'emotion'} onClose={close} title="How does it feel?">
        <EmotionPicker onPick={addEmotion} selected={draft.emotions} />
      </Sheet>
      <PeopleSheet open={sheet === 'people'} onClose={close} selected={draft.people} onChange={(people) => update({ people })} />
      <ImageSearchSheet open={sheet === 'cover-search'} onClose={close} single action="Use as cover" onAdd={([image]) => image && update({ cover: { image } })} />
    </div>
  );
}
