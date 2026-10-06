// The song of the day: one record from your collection for each day, picked by you (or by a roll of the dice), and
// the numbers on what you keep coming back to.
import { useMemo, useState } from 'preact/hooks';
import { addDays, dayLabel, todayKey, WEEKDAYS, weekday } from '../lib/dates';
import { hashOf, useColor } from '../lib/colors';
import { haptic } from '../lib/haptics';
import { navigate } from '../lib/router';
import { pickSongOfDay, songOfDay, toast, type Song } from '../lib/store';
import { CountUp } from './charts';
import { Icon } from './icons';
import { MusicEmbed, MusicThing, musicSub } from './music';
import { Sheet } from './Sheet';
import { noun, t } from '../lib/i18n';
import '../styles/sotd.css';

const STRIP = 14;
/** Each place in the ranking takes its own feeling's colour. */
const RANK_COLORS = ['joy', 'love-connection', 'hope-interest', 'calm-safety', 'sadness', 'fear', 'anger'];

/** Days in a row with a song, ending today (or yesterday, while today is still open). */
function streakOf(days: Set<string>, today: string) {
  let d = days.has(today) ? today : addDays(today, -1);
  let n = 0;
  while (days.has(d)) n++, (d = addDays(d, -1));
  return n;
}

/** The longest run of days in a row with a song. */
function bestRunOf(sorted: string[]) {
  let best = 0, run = 0;
  sorted.forEach((d, i) => {
    run = i && addDays(sorted[i - 1], 1) === d ? run + 1 : 1;
    best = Math.max(best, run);
  });
  return best;
}

/** Today's record, the last two weeks of them, and a picker for any of those days. */
export function SongOfDay({ songs }: { songs: Song[] }) {
  const today = todayKey();
  const [picking, setPicking] = useState<string | null>(null);
  const [on, setOn] = useState(false);
  const [busy, setBusy] = useState(false);
  const song = songOfDay(songs, today);
  const color = useColor(song?.music.image);

  const strip = useMemo(() => Array.from({ length: STRIP }, (_, i) => {
    const day = addDays(today, i - STRIP + 1);
    return { day, song: songOfDay(songs, day) };
  }), [songs, today]);
  const streak = useMemo(() => streakOf(new Set(songs.flatMap((s) => s.days)), today), [songs, today]);

  // a few to choose from at a tap: what's on repeat, then the best rated, in an order that changes every day
  const ideas = useMemo(() => [...songs]
    .sort((a, b) => +b.repeat - +a.repeat || b.rating - a.rating || hashOf(today + a.id) - hashOf(today + b.id))
    .slice(0, 8), [songs, today]);

  const pick = async (s: Song | null, day: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await pickSongOfDay(s, day);
      haptic(14);
      setPicking(null);
      if (day === today) setOn(false);
      if (s) toast(day === today ? t('{title} is today’s song', { title: s.music.title }) : t('{title} is the song of {day}', { title: s.music.title, day: dayLabel(day) }));
    } catch {
      toast(t('Couldn’t save this music. Try again.'));
    } finally {
      setBusy(false);
    }
  };

  // a roll of the dice: anything but yesterday's song, if there's a choice
  const surprise = () => {
    const yesterday = songOfDay(songs, addDays(today, -1));
    const fresh = songs.filter((s) => s !== yesterday && s !== song);
    const pool = fresh.length ? fresh : songs.filter((s) => s !== song);
    if (pool.length) void pick(pool[Math.floor(Math.random() * pool.length)], today);
  };

  return (
    <section class={`sotd${song ? ' is-picked' : ''}`} style={{ '--c': color ?? 'var(--emo-love-connection)' }}>
      <div class="sotd-aura" aria-hidden="true"><i /><i /><i /></div>
      <header class="sotd-head">
        <span class="sotd-kicker">
          <span class={`eq${on ? ' is-on' : ''}`} aria-hidden="true"><i /><i /><i /><i /></span>
          {t('Song of the day')}
        </span>
        {streak > 1 && <span class="sotd-streak" title={t('Days in a row')}><Icon name="flame" size={14} stroke={2} /> {streak}</span>}
      </header>

      {song ? (
        <div class="sotd-now" key={song.id}>
          <button class={`sotd-main${on ? ' is-on' : ' is-repeat'}`} aria-expanded={on} onClick={() => setOn(!on)} aria-label={on ? t('Close the player for {title}', { title: song.music.title }) : t('Play {title}', { title: song.music.title })}>
            <MusicThing m={song.music} size={78} />
            <span class="sotd-text">
              <span class="sotd-title">{song.music.title}</span>
              <span class="sotd-sub">{musicSub(song.music)}</span>
              <span class="sotd-times">
                {song.days.length > 1 ? t('Song of the day {n} times', { n: song.days.length }) : t('First time as song of the day')}
              </span>
            </span>
            <span class="deck-button"><Icon name={on ? 'player-pause' : 'player-play'} size={18} stroke={2} /></span>
          </button>
          {on && <div class="sotd-player"><MusicEmbed m={song.music} /></div>}
          <div class="sotd-actions">
            <button class="btn btn-quiet btn-s" onClick={() => setPicking(today)}><Icon name="refresh" size={16} /> {t('Change')}</button>
            <button class="btn btn-quiet btn-s" onClick={surprise} disabled={busy || songs.length < 2}><Icon name="dice-5" size={16} /> {t('Shuffle')}</button>
            <button class="btn btn-quiet btn-s" onClick={() => navigate('song/' + song.id)}><Icon name="vinyl" size={16} /> {t('Open')}</button>
          </div>
        </div>
      ) : (
        <div class="sotd-empty">
          <p class="sotd-ask">{t('What does today sound like?')}</p>
          <div class="sotd-ideas" role="list">
            {ideas.map((s, k) => (
              <button key={s.id} role="listitem" class="sotd-idea" style={{ '--k': k }} disabled={busy} onClick={() => pick(s, today)} aria-label={t('Make {title} today’s song', { title: s.music.title })}>
                <MusicThing m={s.music} size={52} />
                <span class="sotd-idea-title">{s.music.title}</span>
              </button>
            ))}
          </div>
          <div class="sotd-actions">
            <button class="btn btn-primary btn-s" onClick={surprise} disabled={busy}><Icon name="dice-5" size={16} /> {t('Surprise me')}</button>
            {songs.length > ideas.length && <button class="btn btn-quiet btn-s" onClick={() => setPicking(today)}><Icon name="list" size={16} /> {t('Choose…')}</button>}
          </div>
        </div>
      )}

      {/* the last two weeks, a record for each day that had one; tap a day to pick or change its song */}
      <div class="sotd-strip" role="list" aria-label={t('The last two weeks')}>
        {strip.map(({ day, song: s }, i) => (
          <button
            key={day}
            role="listitem"
            class={`sotd-day${s ? ' has' : ''}${day === today ? ' is-today' : ''}`}
            style={{ '--i': i }}
            onClick={() => setPicking(day)}
            aria-label={`${dayLabel(day)}: ${s ? s.music.title : t('no song yet')}`}
            title={`${dayLabel(day)}${s ? ' · ' + s.music.title : ''}`}
          >
            <span class="sotd-disc">{s?.music.image && <img src={s.music.image} alt="" loading="lazy" referrerpolicy="no-referrer" />}</span>
            <small>{WEEKDAYS[weekday(day)].slice(0, 1)}</small>
          </button>
        ))}
      </div>

      <DayPicker day={picking} songs={songs} busy={busy} onPick={pick} onClose={() => setPicking(null)} />
    </section>
  );
}

/** Every record you keep, to make one the song of `day`. */
function DayPicker({ day, songs, busy, onPick, onClose }: { day: string | null; songs: Song[]; busy: boolean; onPick: (s: Song | null, day: string) => void; onClose: () => void }) {
  const [q, setQ] = useState('');
  const current = day ? songOfDay(songs, day) : null;
  const shown = useMemo(() => {
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    return songs
      .filter((s) => words.every((w) => `${s.music.title} ${s.music.sub ?? ''}`.toLowerCase().includes(w)))
      .sort((a, b) => +(b.music.kind === 'track') - +(a.music.kind === 'track') || b.days.length - a.days.length);
  }, [songs, q]);
  const close = () => {
    setQ('');
    onClose();
  };
  const title = !day ? '' : day === todayKey() ? t('Today’s song') : t('Song of {day}', { day: dayLabel(day) });

  return (
    <Sheet
      open={!!day}
      onClose={close}
      title={title}
      tall
      footer={current && day ? <button class="btn btn-quiet danger" disabled={busy} onClick={() => { setQ(''); onPick(null, day); }}><Icon name="x" size={16} /> {t('Clear this day')}</button> : undefined}
    >
      <label class="search">
        <Icon name="search" size={18} />
        <input type="search" placeholder={t('Search your music')} value={q} onInput={(e) => setQ(e.currentTarget.value)} aria-label={t('Search your music')} />
      </label>
      <div class="tracks sotd-picks">
        {shown.map((s) => (
          <button key={s.id} class="track" aria-pressed={s === current} disabled={busy} onClick={() => day && (setQ(''), onPick(s, day))}>
            <span class="track-thing"><MusicThing m={s.music} size={38} /></span>
            <span class="track-main">
              <span class="track-title">{s.music.title}</span>
              <span class="track-sub">{musicSub(s.music)}</span>
            </span>
            {s.days.length > 0 && <span class="sotd-pick-count">×{s.days.length}</span>}
          </button>
        ))}
        {!shown.length && <p class="empty-note center">{t('No music matches.')}</p>}
      </div>
    </Sheet>
  );
}

/** Which songs got picked the most: a podium of bars, and the streaks behind them. */
export function SongStats({ songs }: { songs: Song[] }) {
  const [all, setAll] = useState(false);
  const today = todayKey();
  const stats = useMemo(() => {
    const ranked = songs.filter((s) => s.days.length).sort((a, b) => b.days.length - a.days.length || (b.days[b.days.length - 1] > a.days[a.days.length - 1] ? 1 : -1));
    const days = [...new Set(ranked.flatMap((s) => s.days))].sort();
    return { ranked, days: days.length, best: bestRunOf(days), streak: streakOf(new Set(days), today) };
  }, [songs, today]);
  if (!stats.ranked.length) return null;

  const { ranked } = stats;
  const top = ranked[0].days.length;
  const shown = all ? ranked.slice(0, 10) : ranked.slice(0, 3);
  const tiles: [number, string, 'calendar' | 'vinyl' | 'flame' | 'trophy'][] = [
    [stats.days, noun(stats.days, 'day', 'days'), 'calendar'],
    [ranked.length, noun(ranked.length, 'song', 'songs'), 'vinyl'],
    [stats.streak, t('in a row now'), 'flame'],
    [stats.best, t('best streak'), 'trophy'],
  ];

  return (
    <section class="section sotd-stats">
      <h2 class="section-title"><Icon name="chart-bar" size={16} /> {t('Most picked')}</h2>
      <div class="sotd-tiles">
        {tiles.map(([value, label, icon], i) => (
          <span class="sotd-tile" style={{ '--i': i, '--t': `var(--emo-${RANK_COLORS[i + 1]})` }}>
            <Icon name={icon} size={15} stroke={2} />
            <b><CountUp value={value} /></b>
            <small>{label}</small>
          </span>
        ))}
      </div>
      <ol class="sotd-rank">
        {shown.map((s, i) => (
          <li key={s.id} style={{ '--i': i, '--t': `var(--emo-${RANK_COLORS[i % RANK_COLORS.length]})`, '--w': s.days.length / top }}>
            <button class="sotd-rank-row" onClick={() => navigate('song/' + s.id)}>
              <span class={`sotd-place${i < 3 ? ' p' + (i + 1) : ''}`}>{i === 0 ? <Icon name="crown" size={15} stroke={2} /> : i + 1}</span>
              <MusicThing m={s.music} size={34} />
              <span class="sotd-rank-main">
                <span class="sotd-rank-title">{s.music.title}</span>
                <span class="sotd-bar"><i /></span>
                <span class="sotd-rank-sub">{musicSub(s.music)}</span>
              </span>
              <span class="sotd-rank-n"><b>{s.days.length}</b><small>{noun(s.days.length, 'day', 'days')}</small></span>
            </button>
          </li>
        ))}
      </ol>
      {ranked.length > 3 && (
        <button class="btn btn-quiet btn-s sotd-more" onClick={() => setAll(!all)}>
          <Icon name={all ? 'arrow-up' : 'chevron-down'} size={16} /> {all ? t('Show less') : t('Show the top {n}', { n: Math.min(10, ranked.length) })}
        </button>
      )}
    </section>
  );
}
