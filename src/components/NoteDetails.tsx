import { useEffect, useRef, useState } from 'preact/hooks';
import { EMOTION, coreOf } from '../data/emotions';
import { weatherIcon } from '../data/weather';
import { rangeLabel } from '../lib/dates';
import { imageSrc } from '../lib/images';
import { navigateAfterSheet, pushBack } from '../lib/router';
import { toast, type Cover, type Entry } from '../lib/store';
import { here, locationError } from '../lib/weather';
import { DateSheet } from './Calendar';
import { CoverCropSheet } from './CoverCrop';
import { EmotionChip, EmotionPicker, INTENSITY, IntensityPicker } from './emotion';
import { Icon } from './icons';
import { ImageSearchSheet } from './ImageSearchSheet';
import { PeopleChips, PeopleSheet, PersonChip, usePeopleById } from './people';
import { PhotoImg } from './Photo';
import { Sheet, focusIn, giveBack } from './Sheet';
import { HomeSheet, WeatherMark, placeLabel, weatherLine, weatherOf } from './weather';
import { count, t } from '../lib/i18n';

/**
 * A note's cover picture, filling whatever box it's put in, cropped the way it was adjusted. The crop's point sits at the
 * same place in the box (that's what object-position does with a covering picture) and the zoom grows around it.
 */
export function CoverImg({ cover, class: cls }: { cover: Cover; class?: string }) {
  const c = cover.crop;
  const at = c && `${c.x * 100}% ${c.y * 100}%`;
  const style = c && { objectPosition: at, transformOrigin: at, transform: c.zoom > 1 ? `scale(${c.zoom})` : undefined };
  return (
    <span class={`cover-img ${cls ?? ''}`}>
      {'photo' in cover ? (
        <PhotoImg photo={cover.photo} fit={false} alt="" style={style} />
      ) : (
        <img src={imageSrc(cover.image, 'full')} alt="" loading="lazy" referrerpolicy="no-referrer" style={style} />
      )}
    </span>
  );
}

/**
 * The one muted line under a note's title: when, how it felt, who it's about. Tap it for the Feelings page. The music
 * attached to the note is a small chip at its end, "♪ 3 songs", which opens the songs.
 */
export function DetailsSummary({ draft, onOpen, onMusic }: { draft: Entry; onOpen: () => void; onMusic: () => void }) {
  const byId = usePeopleById();
  const people = draft.people.map((id) => byId.get(id)!).filter(Boolean);
  const w = weatherOf(draft);
  // the place and weather are looked up after a new note is kept: ones that turn up then fade in, ones already there don't
  const [had] = useState(() => ({ w: !!w, place: !!draft.place?.name }));
  return (
    <div class="details-line">
      <button class="details-summary" onClick={onOpen} aria-label={t('Feelings, people, date, place and cover')}>
        <span class="details-items">
        <span class="details-date"><Icon name="calendar-event" size={14} /> {rangeLabel(draft.date, draft.dateEnd)}</span>
        {w && <span class={had.w ? 'details-date' : 'details-date fade-arrive'}><WeatherMark w={w} size={14} /></span>}
        {draft.place?.name && <span class={had.place ? 'details-date details-place' : 'details-date details-place fade-arrive'}><Icon name="map-pin" size={14} /> <span>{draft.place.name}</span></span>}
        {draft.emotions.map((id) => <EmotionChip id={id} size="sm" />)}
        {draft.emotions.length > 0 && <Bars n={draft.intensity} />}
        {people.map((p) => <PersonChip p={p} size="sm" />)}
        {!draft.emotions.length && <span class="details-add"><Icon name="mood-plus" size={14} /> {t('How does it feel?')}</span>}
        </span>
        {/* the chips alone don't read as a button: a chevron that never fades out says the line opens something */}
        <span class="details-open" aria-hidden="true"><Icon name="chevron-right" size={14} /></span>
      </button>
      {draft.music.length > 0 && (
        <button class="details-music" onClick={onMusic} aria-label={t('Music in this note')}>
          <Icon name="music" size={14} /> {count(draft.music.length, 'song', 'songs')}
        </button>
      )}
    </div>
  );
}

function Bars({ n }: { n: number }) {
  return (
    <span class="mini-bars" title={t('Intensity: {level}', { level: INTENSITY[n - 1] })} aria-label={t('Intensity: {level}', { level: INTENSITY[n - 1] })}>
      {INTENSITY.map((_, i) => <i class={i < n ? 'on' : ''} style={{ height: `${4 + i * 2}px` }} />)}
    </span>
  );
}

type Open = null | 'date' | 'emotion' | 'people' | 'cover-search' | 'cover-crop' | 'place';

/**
 * The Feelings page: everything about a note apart from its words — how it felt and how strongly, who it's about,
 * when it happened and its cover. It slides over the note and edits the same draft; Back returns to the writing.
 */
export function NoteDetails({ open, onClose, draft, update, uploadCover, uploadingCover }: {
  open: boolean;
  onClose: () => void;
  draft: Entry;
  update: (patch: Partial<Entry>) => void;
  uploadCover: (file: File | undefined) => Promise<void>;
  uploadingCover: boolean;
}) {
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);
  const [sheet, setSheet] = useState<Open>(null);
  const [locating, setLocating] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const locationRequest = useRef(0);

  useEffect(() => {
    setLocating(false);
    if (open) {
      setMounted(true);
      setClosing(false);
      const release = pushBack(() => closeRef.current());
      const prev = document.activeElement as HTMLElement | null;
      const focusFrame = requestAnimationFrame(() => focusIn(panel.current));
      return () => {
        locationRequest.current++;
        cancelAnimationFrame(focusFrame);
        release();
        giveBack(prev, panel.current);
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
  const pictures: Cover[] = [...draft.photos.map((photo) => ({ photo })), ...draft.images.map((image) => ({ image }))];
  const same = (a: Cover | null, b: Cover) => !!a && ('photo' in a ? 'photo' in b && a.photo.id === b.photo.id : 'image' in b && a.image.url === b.image.url);
  const only = draft.emotions.length === 1 ? EMOTION[draft.emotions[0]] : null;
  const weather = weatherOf(draft);
  const addHere = async () => {
    const request = ++locationRequest.current;
    setLocating(true);
    try {
      const place = await here();
      if (request === locationRequest.current) update({ place });
    } catch (e) {
      if (request === locationRequest.current) toast(locationError(e));
    } finally {
      if (request === locationRequest.current) setLocating(false);
    }
  };

  return (
    <div
      ref={panel}
      class={`details${closing ? ' closing' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label={t('Feelings')}
      tabIndex={-1}
      onKeyDown={(e) => e.key === 'Escape' && !document.querySelector('.sheet-wrap') && (e.stopPropagation(), onClose())}
    >
      <div class="details-page">
        <div class="editor-bar">
          <button class="glass glass-btn round" onClick={onClose} aria-label={t('Back to the note')}><Icon name="arrow-left" /></button>
          <span class="grow" />
          <button class="glass glass-btn tinted" onClick={onClose}>{t('Done')}</button>
        </div>
        <h1 class="title details-title">{t('Feelings')}</h1>
        {draft.title.trim() && <p class="details-of">{draft.title}</p>}

        <section class="details-section">
          <h2 class="eyebrow">{t('How does it feel?')}</h2>
          <div class="meta">
            {draft.emotions.map((eid) => (
              <EmotionChip id={eid} onRemove={() => update({ emotions: draft.emotions.filter((x) => x !== eid) })} />
            ))}
            {draft.emotions.length < 3 && (
              <button class="chip" onClick={() => setSheet('emotion')}>
                <Icon name="mood-plus" size={16} /> {draft.emotions.length ? t('Add') : t('Name the feeling')}
              </button>
            )}
          </div>
          {draft.emotions.length > 0 && (
            <div class="details-intensity">
              <IntensityPicker value={draft.intensity} onChange={(n) => update({ intensity: n })} cores={draft.emotions.map((e) => coreOf(e).id)} title={t('Intensity')} />
            </div>
          )}
          {only?.depth === 2 && <p class="definition">{only.def}</p>}
        </section>

        <section class="details-section">
          <h2 class="eyebrow">{t('Thinking of')}</h2>
          <div class="meta">
            <PeopleChips ids={draft.people} onChange={(people) => update({ people })} onAdd={() => setSheet('people')} label={t('Add someone')} />
          </div>
        </section>

        <section class="details-section">
          <h2 class="eyebrow">{t('When')}</h2>
          <div class="meta">
            <button class="chip" onClick={() => setSheet('date')}>
              <Icon name="calendar-event" size={16} /> {rangeLabel(draft.date, draft.dateEnd)}
            </button>
          </div>
        </section>

        <section class="details-section">
          <h2 class="eyebrow">{t('Where')}</h2>
          {draft.place ? (
            <div class="meta-row place-row">
              <span class="row gap-s grow"><Icon name="map-pin" size={16} /> <span class="place-name">{placeLabel(draft.place)}</span></span>
              <span class="row">
                <button class="btn btn-quiet btn-s" onClick={() => setSheet('place')}>{t('Change')}</button>
                <button class="btn btn-quiet btn-s" onClick={() => { navigateAfterSheet('map?focus=' + draft.id); onClose(); }}>{t('Map')}</button>
                <button class="icon-btn small" onClick={() => update({ place: null })} aria-label={t('Remove the place')} title={t('Remove the place')}><Icon name="trash" size={16} /></button>
              </span>
            </div>
          ) : (
            <div class="meta">
              <button class="chip" onClick={addHere} disabled={locating}>
                <Icon name="current-location" size={16} /> {locating ? t('Finding you…') : t('Add where I am')}
              </button>
              <button class="chip" onClick={() => setSheet('place')}>
                <Icon name="map-pin" size={16} /> {t('Choose a place')}
              </button>
            </div>
          )}
          {weather && <p class="details-hint wx-line fade-arrive"><Icon name={weatherIcon(weather.code, weather.dark)} size={15} /> {weatherLine(weather)}</p>}
        </section>

        <section class="details-section">
          <h2 class="eyebrow">{t('Cover')}</h2>
          <p class="details-hint">{t('Shown faintly behind the note in your journal.')}</p>
          {draft.cover && (
            <div class="cover-preview">
              <button class="cover-open" onClick={() => setSheet('cover-crop')} aria-label={t('Adjust the cover')}><CoverImg cover={draft.cover} /></button>
              <div class="cover-tools">
                <button class="glass glass-btn cover-adjust" onClick={() => setSheet('cover-crop')}><Icon name="crop" size={18} /> {t('Adjust')}</button>
                <button class="glass glass-btn round cover-remove" onClick={() => update({ cover: null })} aria-label={t('Remove cover')}><Icon name="trash" size={18} /></button>
              </div>
            </div>
          )}
          <div class="cover-picks">
            <button class="cover-pick" onClick={() => fileRef.current?.click()} disabled={uploadingCover}>
              <Icon name="photo-plus" size={20} /><span>{uploadingCover ? t('Adding…') : t('Upload')}</span>
            </button>
            <button class="cover-pick" onClick={() => setSheet('cover-search')}>
              <Icon name="photo-search" size={20} /><span>{t('Find')}</span>
            </button>
            {pictures.map((c) => (
              <button class="cover-pick is-pic" aria-pressed={same(draft.cover, c)} onClick={() => update({ cover: same(draft.cover, c) ? null : c })} aria-label={t('Use this picture as the cover')}>
                {'photo' in c ? <PhotoImg photo={c.photo} fit={false} /> : <img src={imageSrc(c.image, 'thumb')} alt="" loading="lazy" referrerpolicy="no-referrer" />}
              </button>
            ))}
          </div>
          <input ref={fileRef} type="file" accept="image/*,.heic,.heif" hidden onChange={(e) => { const input = e.currentTarget; uploadCover(input.files?.[0]); input.value = ''; }} />
        </section>
      </div>

      <DateSheet open={sheet === 'date'} onClose={close} start={draft.date} end={draft.dateEnd} onChange={(date, dateEnd) => update({ date, dateEnd })} />
      <Sheet open={sheet === 'emotion'} onClose={close} title={t('How does it feel?')}>
        <EmotionPicker onPick={addEmotion} selected={draft.emotions} />
      </Sheet>
      <HomeSheet kind="place" open={sheet === 'place'} current={draft.place} onClose={close} onPick={(place) => update(draft.place && (draft.place.lat !== place.lat || draft.place.lon !== place.lon) ? { place, weather: null } : { place })} />
      <PeopleSheet open={sheet === 'people'} onClose={close} selected={draft.people} onChange={(people) => update({ people })} />
      <CoverCropSheet open={sheet === 'cover-crop'} onClose={close} cover={draft.cover} onSave={(crop) => draft.cover && update({ cover: { ...draft.cover, crop } })} />
      <ImageSearchSheet open={sheet === 'cover-search'} onClose={close} single action={t('Use as cover')} onAdd={([image]) => image && update({ cover: { image } })} />
    </div>
  );
}
