import { useEffect, useState } from 'preact/hooks';
import { bodyOf, itemKey, itemsOf, type Item, type Media } from '../lib/body';
import { rangeLabel } from '../lib/dates';
import { imageSrc } from '../lib/images';
import { readShared, type PublicNote } from '../lib/share';
import type { Entry } from '../lib/store';
import { Markdown } from '../components/Markdown';
import { t } from '../lib/i18n';
import '../styles/shared.css';

type Note = PublicNote & { shared: number };

/** A note someone chose to make public, read by anyone with its link. No journal, no sign-in: this page never touches the reader's storage. */
export function Shared({ token }: { token: string }) {
  const [note, setNote] = useState<Note | 'gone' | 'loading' | 'error'>('loading');
  const load = () => {
    setNote('loading');
    readShared(token).then(setNote, () => setNote('error'));
  };
  useEffect(load, [token]);
  useEffect(() => {
    if (typeof note === 'object') document.title = note.title || t('A note');
  }, [note]);

  if (typeof note === 'string') {
    return (
      <main class="app route-shared">
        <div class="page shared">
          <div class="empty">
            <h2 class="title-s">{note === 'gone' ? t('This note isn’t shared') : note === 'error' ? t('Couldn’t load this note') : t('Loading…')}</h2>
            {note === 'gone' && <p>{t('The link may have been stopped, or it was typed wrong.')}</p>}
            {note === 'error' && <><p>{t('Check your connection and try again.')}</p><button class="btn" onClick={load}>{t('Try again')}</button></>}
          </div>
        </div>
      </main>
    );
  }

  // the same arrangement the writer sees: text, picture, text, picture…
  const body = bodyOf({ text: note.text, photos: note.photos, images: note.images } as Entry);
  const src = (it: Item, size: 'thumb' | 'full') => {
    if (it.kind === 'photo') return `/api/share/${token}/${it.id}`;
    const img = note.images.find((i) => i.url === it.url);
    return img ? imageSrc(img, size) : '';
  };
  const cover = note.cover && ('photo' in note.cover ? `/api/share/${token}/${note.cover.photo.id}` : imageSrc(note.cover.image, 'full'));
  const crop = note.cover?.crop;
  const at = crop && `${crop.x * 100}% ${crop.y * 100}%`;

  return (
    <main class="app route-shared">
      <article class="page shared">
        <header class={`shared-head${cover ? ' has-cover' : ''}`}>
          {cover && (
            <img
              class="shared-cover"
              src={cover}
              alt=""
              referrerpolicy="no-referrer"
              style={crop && { objectPosition: at, transformOrigin: at, transform: crop.zoom > 1 ? `scale(${crop.zoom})` : undefined }}
            />
          )}
          {note.title && <h1 class="shared-title">{note.title}</h1>}
          <div class="shared-when">{rangeLabel(note.date, note.dateEnd)}</div>
        </header>
        <div class="note-body is-reading shared-body">
          {body.texts.map((text, i) => (
            <>
              {i > 0 && <Pic m={body.media[i - 1]} note={note} src={src} />}
              {text.trim() && <Markdown text={text} />}
            </>
          ))}
        </div>
        <footer class="shared-foot">{t('Shared from My Mind')}</footer>
      </article>
    </main>
  );
}

function Pic({ m, note, src }: { m: Media; note: Note; src: (it: Item, size: 'thumb' | 'full') => string }) {
  const items = itemsOf(m).filter((it) => src(it, 'full'));
  if (!items.length) return null;
  const album = m.kind === 'album' && items.length > 1;
  const size = m.size ?? 100;
  const align = size < 100 ? m.align : undefined;
  const first = items[0];
  const photo = first.kind === 'photo' ? note.photos.find((p) => p.id === first.id) : undefined;
  const web = (it: Item) => (it.kind === 'image' ? note.images.find((i) => i.url === it.url) : undefined);
  const credit = !album && first.kind === 'image' ? web(first) : undefined;
  const tiles = items.slice(0, 5);
  return (
    <figure class={`media shared-media${album ? ' is-album' : ''}${align ? ' is-' + align : ''}`} style={{ width: `${size}%` }}>
      <a class="media-pic" href={src(first, 'full')} target="_blank" rel="noopener noreferrer" aria-label={t('Open the picture')}>
        {album ? (
          <div class={`album n${tiles.length}`}>
            {tiles.map((it, k) => (
              <span key={itemKey(it)} class="album-tile">
                <img src={src(it, 'thumb')} alt={web(it)?.title ?? ''} loading="lazy" referrerpolicy="no-referrer" />
                {k === tiles.length - 1 && items.length > tiles.length && <span class="album-more">+{items.length - tiles.length + 1}</span>}
              </span>
            ))}
          </div>
        ) : (
          <img
            src={src(first, 'full')}
            alt={credit?.title ?? ''}
            loading="lazy"
            referrerpolicy="no-referrer"
            style={photo ? { aspectRatio: `${photo.w} / ${photo.h}` } : credit?.w && credit.h ? { aspectRatio: `${credit.w} / ${credit.h}` } : undefined}
          />
        )}
      </a>
      {credit?.credit && <figcaption class="shared-credit">{credit.credit}</figcaption>}
    </figure>
  );
}
