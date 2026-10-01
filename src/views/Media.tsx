import { useEffect, useState } from 'preact/hooks';
import { navigateAfterSheet } from '../lib/router';
import { connectSpotify } from '../lib/spotify';
import { blankSong, findSong, getSongs, saveSong, toast, useBooks, useSongs, type Music } from '../lib/store';
import { BookSheet } from '../components/books';
import { Icon } from '../components/icons';
import { SpotifySheet } from '../components/SpotifySheet';
import { BooksTab, booksLine } from './Books';
import { MusicTab, musicLine } from './Music';

type Tab = 'books' | 'music';
const TAB_KEY = 'mm-media-tab';

function lastTab(): Tab {
  try {
    return localStorage.getItem(TAB_KEY) === 'music' ? 'music' : 'books';
  } catch {
    return 'books';
  }
}

/** Your books and your music: a shelf and a record collection. `?tab=books|music`, and `?add` opens its picker. */
export function Media({ query }: { query: URLSearchParams }) {
  const books = useBooks();
  const songs = useSongs();
  const asked = query.get('tab');
  const [tab, setTabState] = useState<Tab>(asked === 'music' || asked === 'books' ? asked : lastTab);
  const [adding, setAdding] = useState<Tab | null>(null);

  const setTab = (t: Tab) => {
    setTabState(t);
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
    const fresh = list.filter((m) => !findSong(getSongs(), m));
    for (const m of fresh) await saveSong(blankSong(m));
    if (list.length === 1) return navigateAfterSheet('song/' + findSong(getSongs(), list[0])!.id);
    toast(fresh.length ? `Added ${fresh.length} to your records` : 'Those are already in your records');
  };

  return (
    <div class="page media-page">
      <header class="page-head">
        <div class="eyebrow">Media</div>
        <div class="row between">
          <h1 class="title">{tab === 'books' ? 'Your shelf' : 'Your records'}</h1>
          <button class="icon-btn" onClick={() => setAdding(tab)} aria-label={tab === 'books' ? 'Add a book' : 'Add music'} title={tab === 'books' ? 'Add a book' : 'Add music'}>
            <Icon name="plus" />
          </button>
        </div>
        <p class="subtitle">{tab === 'books' ? booksLine(books) : musicLine(songs)}</p>
      </header>

      <div class="seg media-tabs" role="tablist" aria-label="Media">
        <button role="tab" aria-selected={tab === 'books'} onClick={() => setTab('books')}><Icon name="books" size={17} /> Books</button>
        <button role="tab" aria-selected={tab === 'music'} onClick={() => setTab('music')}><Icon name="vinyl" size={17} /> Music</button>
      </div>

      <div class="media-panel" key={tab}>
        {tab === 'books' ? <BooksTab onAdd={() => setAdding('books')} /> : <MusicTab onAdd={() => setAdding('music')} />}
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
