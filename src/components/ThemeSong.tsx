// The song that is someone's, at the top of their page: put it on from there. Picked from the music that already
// brings them to mind, the rest of your records, or Spotify.
import { useMemo, useState } from 'preact/hooks';
import type { Music, Person } from '../lib/store';
import { useSongs } from '../lib/store';
import { Icon } from './icons';
import { MusicDeck, MusicThing, musicSub } from './music';
import { Sheet } from './Sheet';
import { SpotifySheet } from './SpotifySheet';
import { t } from '../lib/i18n';

const same = (a: Music | null, b: Music) => !!a && a.kind === b.kind && a.id === b.id;

export function ThemeSong({ p, onChange, onConnect }: { p: Person; onChange: (m: Music | null) => void; onConnect: () => void }) {
  const [open, setOpen] = useState<null | 'pick' | 'spotify'>(null);
  const first = p.name.trim().split(/\s+/)[0] || t('them');
  return (
    <>
      <div class="row between person-label theme-head">
        <div class="eyebrow">{t('Theme song')}</div>
        {p.theme && <button class="link small" onClick={() => setOpen('pick')}>{t('Change')}</button>}
      </div>
      {p.theme ? (
        <div class="theme-song">
          <MusicDeck key={p.theme.kind + p.theme.id} m={p.theme} onRemove={() => onChange(null)} removeLabel={t('Remove {name}’s theme song', { name: first })} />
        </div>
      ) : (
        <div class="meta person-meta">
          <button class="chip" onClick={() => setOpen('pick')}><Icon name="vinyl" size={16} /> {t('Add a theme song')}</button>
        </div>
      )}
      <ThemeSheet
        open={open !== null}
        p={p}
        first={first}
        onClose={() => setOpen(null)}
        onPick={(m) => { onChange(m); setOpen(null); }}
        onSpotify={() => setOpen('spotify')}
      />
      {/* on top of the picker: closing it goes back there, picking closes both */}
      <SpotifySheet
        open={open === 'spotify'}
        onClose={() => setOpen((o) => (o === 'spotify' ? 'pick' : o))}
        onConnect={onConnect}
        addLabel={() => t('Make it the theme song')}
        onAdd={(list) => { if (list[0]) { onChange(list[0]); setOpen(null); } }}
      />
    </>
  );
}

/** Your records to pick from: the music that brings them to mind first, then what's on repeat, then the rest. */
function ThemeSheet({ open, p, first, onClose, onPick, onSpotify }: {
  open: boolean;
  p: Person;
  first: string;
  onClose: () => void;
  onPick: (m: Music) => void;
  onSpotify: () => void;
}) {
  const songs = useSongs();
  const [q, setQ] = useState('');
  const theirs = useMemo(() => songs.filter((s) => s.from === p.id), [songs, p.id]);
  const rest = useMemo(() => [...songs.filter((s) => s.from !== p.id && s.repeat), ...songs.filter((s) => s.from !== p.id && !s.repeat)], [songs, p.id]);
  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const match = (m: Music) => words.every((w) => `${m.title} ${m.sub ?? ''}`.toLowerCase().includes(w));
  const row = (m: Music) => (
    <button class="book-row song-row" aria-pressed={same(p.theme, m)} onClick={() => onPick(m)}>
      <MusicThing m={m} size={40} />
      <span class="book-row-main">
        <span class="book-row-title">{m.title}</span>
        <span class="book-row-sub">{musicSub(m)}</span>
      </span>
      {same(p.theme, m) && <Icon name="check" size={18} />}
    </button>
  );
  const a = theirs.filter((s) => match(s.music)), b = rest.filter((s) => match(s.music));
  return (
    <Sheet open={open} onClose={onClose} tall title={t('{name}’s theme song', { name: first })}>
      <div class="theme-pick">
        <button class="btn btn-quiet block" onClick={onSpotify}><Icon name="brand-spotify" size={18} /> {t('Find it on Spotify')}</button>
        {songs.length > 4 && (
          <label class="search">
            <Icon name="search" size={18} />
            <input type="search" placeholder={t('Search your music')} value={q} onInput={(e) => setQ(e.currentTarget.value)} aria-label={t('Search your music')} />
          </label>
        )}
        {a.length > 0 && (
          <section>
            <h3 class="section-title">{t('Brings {name} to mind', { name: first })}</h3>
            <div class="book-rows">{a.map((s) => row(s.music))}</div>
          </section>
        )}
        {b.length > 0 && (
          <section>
            <h3 class="section-title">{a.length ? t('The rest of your music') : t('Your music')}</h3>
            <div class="book-rows">{b.map((s) => row(s.music))}</div>
          </section>
        )}
        {!songs.length && <p class="muted small">{t('Nothing in your music yet. Find it on Spotify, or paste a Spotify link there.')}</p>}
        {!!songs.length && !a.length && !b.length && <p class="muted small">{t('Nothing matches “{q}”.', { q: q.trim() })}</p>}
      </div>
    </Sheet>
  );
}
