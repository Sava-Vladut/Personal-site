import { useEffect, useMemo, useState } from 'preact/hooks';
import { navigateAfterSheet } from '../lib/router';
import { connectSpotify } from '../lib/spotify';
import { blankSong, findSong, getSongs, saveSongs, toast, useBooks, useSongs, type Music } from '../lib/store';
import { BookSheet } from '../components/books';
import { feltWorlds } from '../components/cloud';
import { PageHead } from '../components/PageHead';
import { Icon } from '../components/icons';
import { Sky } from '../components/Sky';
import { DayPicker, useDayPick } from '../components/SongOfDay';
import { SpotifySheet } from '../components/SpotifySheet';
import { BooksTab, bookSummary } from './Books';
import { MusicTab, musicSummary } from './Music';
import { t } from '../lib/i18n';
import '../styles/media.css';

type Tab = 'books' | 'music';
const TABS: Tab[] = ['music', 'books'];

// with nothing felt yet: warm paper for the shelf, a late-night glow for the records
const QUIET: Record<Tab, string[]> = {
  books: ['hope-interest', 'calm-safety', 'joy'],
  music: ['love-connection', 'sadness', 'hope-interest'],
};

/** Media always opens on the music; coming back to it (from a book or a song) finds the tab you left it on. */
function lastTab(): Tab {
  return history.state?.mmMediaTab === 'books' ? 'books' : 'music';
}

/**
 * Your music and your books: a record collection and a shelf. `?tab=books|music`, and `?add` opens its picker.
 * The sky has the title, a line of numbers, the tabs and the search. Under it each tab shows what's on now (today's
 * song, what's on repeat, what you're reading: in a column at the right on a wide screen), then the whole collection
 * as a list.
 */
export function Media({ query }: { query: URLSearchParams }) {
  const books = useBooks();
  const songs = useSongs();
  const asked = query.get('tab');
  const [tab, setTabState] = useState<Tab>(asked === 'music' || asked === 'books' ? asked : lastTab);
  const [adding, setAdding] = useState<Tab | null>(null);
  const [q, setQ] = useState('');
  const picker = useDayPick();

  const setTab = (t: Tab) => {
    setTabState(t);
    setQ('');
    history.replaceState({ ...history.state, mmMediaTab: t }, '');
  };

  // "+ → Book / Music" land here with ?add; back from logging in to Spotify with ?spotify
  useEffect(() => {
    if (asked === 'music' || asked === 'books') setTab(asked);
    const sp = query.get('spotify');
    if (sp) {
      setTab('music');
      toast(sp === 'connected' ? t('Spotify connected') : sp === 'cancelled' ? t('Spotify login cancelled') : t('Couldn’t connect Spotify — try again'));
    }
    if (query.has('add') || sp === 'connected') setAdding(asked === 'music' || sp ? 'music' : tab);
    if ([...query.keys()].length) history.replaceState(history.state, '', '#/media');
  }, []);

  /** Keeps what was picked; one piece of music opens its page, like a book does. */
  const keep = async (list: Music[]) => {
    try {
      // each once, in the order picked: the first comes out on top
      const now = Date.now();
      const fresh = list.filter((m, i) => !findSong(getSongs(), m) && list.findIndex((x) => x.kind === m.kind && x.id === m.id) === i);
      await saveSongs(fresh.map((m, i) => blankSong(m, { created: now - i, updated: now })));
      if (list.length === 1) return navigateAfterSheet('song/' + findSong(getSongs(), list[0])!.id);
      toast(fresh.length ? t('Added {n} to your records', { n: fresh.length }) : t('Those are already in your records'));
    } catch {
      toast(t('Couldn’t save this music. Try again.'));
    }
  };

  const isBooks = tab === 'books';
  const worlds = useMemo(() => (isBooks ? feltWorlds(books, QUIET.books) : feltWorlds(songs, QUIET.music)), [isBooks, books, songs]);
  const summary = useMemo(() => (isBooks ? bookSummary(books) : musicSummary(songs)), [isBooks, books, songs]);
  const has = isBooks ? books.length > 0 : songs.length > 0;
  const search = isBooks ? t('Search your books') : t('Search your music');

  return (
    <div class="page media-page">
      {/* the shelf and the records under a sky of their own: letters over the books, notes over the music */}
      <div class="journal-top media-head" style={{ '--sky': `var(--emo-${worlds[0]})` }}>
        <Sky world={worlds[0]} worlds={worlds} letters={tab} />
        <PageHead
          title={isBooks ? t('Your shelf') : t('Your records')}
          subtitle={has ? summary : isBooks ? t('Keep the books you read, rate them, and mention them in your notes.') : t('Keep the songs, albums and playlists that mean something to you.')}
          wheel world={worlds[0]}
          actions={<>
            <button class="icon-btn" onClick={() => setAdding(tab)} aria-label={isBooks ? t('Add a book') : t('Add music')} title={isBooks ? t('Add a book') : t('Add music')}>
              <Icon name="plus" />
            </button>
          </>}
        />

        <div class="media-bar">
          <div class="seg tabs media-tabs" role="tablist" aria-label={t('Media')} style={{ '--at': TABS.indexOf(tab), '--tabs': TABS.length }}>
            <button role="tab" aria-selected={!isBooks} onClick={() => setTab('music')}><Icon name="vinyl" size={16} /> {t('Music')}</button>
            <button role="tab" aria-selected={isBooks} onClick={() => setTab('books')}><Icon name="books" size={16} /> {t('Books')}</button>
          </div>

          {has && (
            <label class="search">
              <Icon name="search" size={18} />
              <input type="search" placeholder={search} value={q} onInput={(e) => setQ(e.currentTarget.value)} aria-label={search} />
            </label>
          )}
        </div>
      </div>

      {isBooks ? <BooksTab q={q} onClearSearch={() => setQ('')} onAdd={() => setAdding('books')} /> : <MusicTab q={q} onClearSearch={() => setQ('')} onAdd={() => setAdding('music')} picker={picker} />}

      <DayPicker songs={songs} picker={picker} />
      <BookSheet open={adding === 'books'} onClose={() => setAdding(null)} onPick={(b) => { setAdding(null); navigateAfterSheet('book/' + b.id); }} />
      <SpotifySheet
        open={adding === 'music'}
        onClose={() => setAdding(null)}
        onAdd={keep}
        onConnect={() => connectSpotify('#/media?tab=music')}
        addLabel={(n) => (n === 1 ? t('Add to your records') : t('Add {n} to your records', { n }))}
        whole
      />
    </div>
  );
}
