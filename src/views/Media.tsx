import { useEffect, useMemo, useState } from 'preact/hooks';
import { coreOf } from '../data/emotions';
import { navigateAfterSheet } from '../lib/router';
import { connectSpotify } from '../lib/spotify';
import { skyWorlds } from '../lib/stats';
import { blankSong, findSong, getSongs, saveSong, toast, useBooks, useSongs, type Music } from '../lib/store';
import { BookSheet } from '../components/books';
import { CountUp } from '../components/charts';
import { Icon } from '../components/icons';
import { Sky } from '../components/Sky';
import { SpotifySheet } from '../components/SpotifySheet';
import { BooksTab, bookStats } from './Books';
import { MusicTab, musicStats } from './Music';

type Tab = 'books' | 'music';
const TAB_KEY = 'mm-media-tab';
const TABS: Tab[] = ['books', 'music'];

// with nothing felt yet: warm paper for the shelf, a late-night glow for the records
const QUIET: Record<Tab, string[]> = {
  books: ['hope-interest', 'calm-safety', 'joy'],
  music: ['love-connection', 'sadness', 'hope-interest'],
};

function lastTab(): Tab {
  try {
    return localStorage.getItem(TAB_KEY) === 'music' ? 'music' : 'books';
  } catch {
    return 'books';
  }
}

/** The sky's colours, from how the books or music on this tab make you feel. */
function feltWorlds(list: { emotions: string[] }[], tab: Tab) {
  const counts = new Map<string, number>();
  for (const x of list) {
    const core = x.emotions[0] && coreOf(x.emotions[0])?.id;
    if (core) counts.set(core, (counts.get(core) ?? 0) + 1);
  }
  const worlds = skyWorlds([...counts].map(([id, count]) => ({ id, count })));
  return worlds.length ? worlds : QUIET[tab];
}

/** A title that rises out of the clouds a letter at a time. */
function CloudTitle({ text }: { text: string }) {
  return (
    <h1 class="title cloud-title" aria-label={text}>
      {[...text].map((ch, i) => (
        <span aria-hidden="true" style={{ '--i': i }}>{ch === ' ' ? ' ' : ch}</span>
      ))}
    </h1>
  );
}

/** Your books and your music: a shelf and a record collection. `?tab=books|music`, and `?add` opens its picker. */
export function Media({ query }: { query: URLSearchParams }) {
  const books = useBooks();
  const songs = useSongs();
  const asked = query.get('tab');
  const [tab, setTabState] = useState<Tab>(asked === 'music' || asked === 'books' ? asked : lastTab);
  const [adding, setAdding] = useState<Tab | null>(null);
  const [searching, setSearching] = useState(false);
  const [q, setQ] = useState('');

  const setTab = (t: Tab) => {
    setTabState(t);
    setQ('');
    try {
      localStorage.setItem(TAB_KEY, t);
    } catch {}
  };

  // "+ → Book / Music" land here with ?add; back from logging in to Spotify with ?spotify
  useEffect(() => {
    if (asked === 'music' || asked === 'books') setTab(asked);
    const sp = query.get('spotify');
    if (sp) {
      setTab('music');
      toast(sp === 'connected' ? 'Spotify connected' : sp === 'cancelled' ? 'Spotify login cancelled' : 'Couldn’t connect Spotify — try again');
    }
    if (query.has('add') || sp === 'connected') setAdding(asked === 'music' || sp ? 'music' : tab);
    if ([...query.keys()].length) history.replaceState(history.state, '', '#/media');
  }, []);

  /** Keeps what was picked; one piece of music opens its page, like a book does. */
  const keep = async (list: Music[]) => {
    let added = 0;
    try {
      for (const m of list) {
        if (findSong(getSongs(), m)) continue;
        await saveSong(blankSong(m));
        added++;
      }
      if (list.length === 1) return navigateAfterSheet('song/' + findSong(getSongs(), list[0])!.id);
      toast(added ? `Added ${added} to your records` : 'Those are already in your records');
    } catch {
      toast('Couldn’t save this music. Try again.');
    }
  };

  const isBooks = tab === 'books';
  const worlds = useMemo(() => (isBooks ? feltWorlds(books, 'books') : feltWorlds(songs, 'music')), [isBooks, books, songs]);
  const stats = isBooks ? bookStats(books) : musicStats(songs);
  const has = isBooks ? books.length > 0 : songs.length > 0;
  const noun = isBooks ? 'books' : 'music';

  return (
    <div class="page media-page">
      {/* the shelf and the records under a sky of their own: letters over the books, notes over the music */}
      <div class="journal-top media-top" style={{ '--sky': `var(--emo-${worlds[0]})` }}>
        <Sky world={worlds[0]} worlds={worlds} letters={tab} />
        <header class="page-head">
          <div class="row between">
            <CloudTitle key={tab} text={isBooks ? 'Your shelf' : 'Your records'} />
            <div class="row">
              {has && (
                <button class="icon-btn" aria-pressed={searching} aria-label={`Search your ${noun}`} title="Search" onClick={() => { setSearching(!searching); if (searching) setQ(''); }}>
                  <Icon name="search" />
                </button>
              )}
              <button class="icon-btn" onClick={() => setAdding(tab)} aria-label={isBooks ? 'Add a book' : 'Add music'} title={isBooks ? 'Add a book' : 'Add music'}>
                <Icon name="plus" />
              </button>
            </div>
          </div>
          {!has && (
            <p class="subtitle">{isBooks ? 'Keep the books you read, rate them, and mention them in your notes.' : 'Keep the songs, albums and playlists that mean something to you.'}</p>
          )}
        </header>

        {stats.length > 0 && (
          <div class="media-stats" key={tab}>
            {stats.map(([value, label], i) => (
              <span class="media-stat" style={{ '--i': i }}>
                <b><CountUp value={value} /></b>
                <small>{label}</small>
              </span>
            ))}
          </div>
        )}

        <div class="seg tabs media-tabs" role="tablist" aria-label="Media" style={{ '--at': TABS.indexOf(tab), '--tabs': TABS.length }}>
          <button role="tab" aria-selected={isBooks} onClick={() => setTab('books')}><Icon name="books" size={17} /> Books</button>
          <button role="tab" aria-selected={!isBooks} onClick={() => setTab('music')}><Icon name="vinyl" size={17} /> Music</button>
        </div>

        {searching && has && (
          <label class="search">
            <Icon name="search" size={18} />
            <input type="search" autoFocus placeholder={`Search your ${noun}`} value={q} onInput={(e) => setQ(e.currentTarget.value)} aria-label={`Search your ${noun}`} />
          </label>
        )}
      </div>

      <div class="media-panel" key={tab}>
        {isBooks ? <BooksTab q={q} onAdd={() => setAdding('books')} /> : <MusicTab q={q} onAdd={() => setAdding('music')} />}
      </div>

      <BookSheet open={adding === 'books'} onClose={() => setAdding(null)} onPick={(b) => { setAdding(null); navigateAfterSheet('book/' + b.id); }} />
      <SpotifySheet
        open={adding === 'music'}
        onClose={() => setAdding(null)}
        onAdd={keep}
        onConnect={() => connectSpotify('#/media?tab=music')}
        addLabel={(n) => (n === 1 ? 'Add to your records' : `Add ${n} to your records`)}
      />
    </div>
  );
}
