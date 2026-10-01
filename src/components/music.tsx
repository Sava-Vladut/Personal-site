// Music as things: a song or an album is a record in its sleeve, a playlist or a podcast is a cassette. Putting one on
// (a tap) slides the record out and spins it, or turns the tape's reels, and opens Spotify's own player beneath.
import { useState } from 'preact/hooks';
import { navigate } from '../lib/router';
import { embedHeight, embedUrl, KIND_LABEL } from '../lib/spotify';
import { blankSong, findSong, saveSong, toast, useSongs, type Music, type Song } from '../lib/store';
import { Icon } from './icons';
import '../styles/objects.css';

/** Playlists and podcasts come on tape; songs, albums and artists on vinyl. */
export const isTape = (m: Music) => m.kind === 'playlist' || m.kind === 'show' || m.kind === 'episode';

/** "Artist" for a song, "Playlist · Owner" for the rest. */
export const musicSub = (m: Music) => (m.kind === 'track' ? m.sub ?? 'Song' : KIND_LABEL[m.kind] + (m.sub ? ` · ${m.sub}` : ''));

const Art = ({ m, class: cls }: { m: Music; class: string }) =>
  m.image ? <img class={cls} src={m.image} alt="" loading="lazy" referrerpolicy="no-referrer" draggable={false} /> : <span class={`${cls} no-art`} />;

const sized = (size?: number) => (size ? { '--s': `${size}px` } : undefined);

/** A record half out of its sleeve, the cover art on both. `size` is the sleeve's side in px (else the CSS decides). */
export function Record({ m, size }: { m: Music; size?: number }) {
  return (
    <span class="record" style={sized(size)} aria-hidden="true">
      <span class="record-disc">
        <span class="record-spin">
          <span class="record-label"><Art m={m} class="record-art" /></span>
        </span>
      </span>
      <span class="record-sleeve">{m.image ? <Art m={m} class="record-cover" /> : <Icon name="music" size={22} />}</span>
    </span>
  );
}

/** A cassette with the cover stuck on its label and two reels showing through the window. */
export function Cassette({ m, size }: { m: Music; size?: number }) {
  return (
    <span class="cassette" style={sized(size)} aria-hidden="true">
      <span class="cassette-label">
        <Art m={m} class="cassette-art" />
        <span class="cassette-lines" />
        <span class="cassette-window"><i class="reel" /><span class="cassette-tape" /><i class="reel" /></span>
      </span>
      <span class="cassette-foot" />
    </span>
  );
}

/** Record or cassette, whichever the music comes on. */
export const MusicThing = ({ m, size }: { m: Music; size?: number }) => (isTape(m) ? <Cassette m={m} size={size} /> : <Record m={m} size={size} />);

/** Spotify's own player for a song, album, playlist or podcast. */
export function MusicEmbed({ m }: { m: Music }) {
  return (
    <iframe
      class="embed"
      src={embedUrl(m)}
      height={embedHeight(m)}
      title={`${m.title} on Spotify`}
      loading="lazy"
      allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
    />
  );
}

/** Music in a note: tap to put it on (the player opens beneath), again to take it off. */
export function MusicDeck({ m, onRemove }: { m: Music; onRemove?: () => void }) {
  const [on, setOn] = useState(false);
  const kept = findSong(useSongs(), m);
  const keep = async () => {
    const s = await saveSong(blankSong(m));
    toast(`${m.title} is in your records`, { label: 'Open', run: () => navigate('song/' + s.id) });
  };
  return (
    <div class={`deck${on ? ' is-on' : ''}${isTape(m) ? ' is-tape' : ''}`}>
      <button class="deck-main" aria-expanded={on} onClick={() => setOn(!on)} aria-label={`${on ? 'Close the player for' : 'Play'} ${m.title}`}>
        <MusicThing m={m} />
        <span class="track-main">
          <span class="track-title">{m.title}</span>
          <span class="track-sub">{musicSub(m)}</span>
        </span>
        <span class="deck-button"><Icon name={on ? 'player-pause' : 'player-play'} size={18} stroke={2} /></span>
      </button>
      {on && (
        <div class="deck-player">
          <MusicEmbed m={m} />
          <div class="row gap-s">
            <a class="btn btn-quiet btn-s grow" href={m.link} target="_blank" rel="noopener noreferrer"><Icon name="brand-spotify" size={16} /> Spotify</a>
            {kept ? (
              <button class="btn btn-quiet btn-s grow" onClick={() => navigate('song/' + kept.id)}><Icon name="vinyl" size={16} /> In Media</button>
            ) : (
              <button class="btn btn-quiet btn-s grow" onClick={keep}><Icon name="plus" size={16} /> Keep in Media</button>
            )}
            {onRemove && <button class="btn btn-quiet btn-s grow danger" onClick={onRemove} aria-label="Remove from the note"><Icon name="trash" size={16} /> Remove</button>}
          </div>
        </div>
      )}
    </div>
  );
}

/** Kept music in a list: the record or tape, its title and what it is. */
export function SongRow({ s, onClick }: { s: Song; onClick: () => void }) {
  return (
    <button class="book-row song-row" onClick={onClick}>
      <MusicThing m={s.music} size={40} />
      <span class="book-row-main">
        <span class="book-row-title">{s.music.title}</span>
        <span class="book-row-sub">{musicSub(s.music)}</span>
      </span>
    </button>
  );
}

/** A tiny record or cassette, for a line of text. */
export function MiniMusic({ m }: { m: Music }) {
  if (isTape(m)) return <span class="mini-tape" aria-hidden="true"><i /><i /></span>;
  return (
    <span class="mini-record" aria-hidden="true">
      {m.image && <img src={m.image} alt="" loading="lazy" referrerpolicy="no-referrer" />}
    </span>
  );
}
