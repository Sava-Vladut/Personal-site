import { useMemo, useState } from 'preact/hooks';
import { CORE, EMOTION, PICKER_ORDER, coreOf, shortName } from '../data/emotions';
import { dayLabel, longToday, rangeLabel, timeLabel, todayKey } from '../lib/dates';
import { navigate } from '../lib/router';
import { useEntries, usePeople, useReady, type Entry } from '../lib/store';
import { plainText } from '../lib/body';
import { imageSrc } from '../lib/images';
import { stripMarkdown } from '../lib/markdown';
import { Calendar } from '../components/Calendar';
import { useHold } from '../components/EntryMenu';
import { EmotionChip } from '../components/emotion';
import { Sky } from '../components/Sky';
import { CoverImg } from '../components/NoteDetails';
import { PhotoImg } from '../components/Photo';
import { PersonChip, usePeopleById } from '../components/people';
import { Icon, NoteIcon, Sprite } from '../components/icons';
import '../styles/notes.css';

export function Journal() {
  const entries = useEntries();
  const people = usePeople();
  const ready = useReady();
  const [q, setQ] = useState('');
  const [searching, setSearching] = useState(false);
  const [calOpen, setCalOpen] = useState(false);
  const [day, setDay] = useState<string | null>(null);

  const byDay = useMemo(() => {
    const m = new Map<string, Entry[]>();
    for (const e of entries) {
      const list = m.get(e.date) ?? [];
      list.push(e);
      m.set(e.date, list);
    }
    return m;
  }, [entries]);

  const shown = useMemo(() => {
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const names = new Map(people.map((p) => [p.id, p.name]));
    return entries.filter((e) => {
      if (day && !(e.date === day || (e.dateEnd && e.date <= day && day <= e.dateEnd))) return false;
      if (words.length) {
        const hay = `${e.title} ${plainText(e.text)} ${e.emotions.map((id) => EMOTION[id]?.name).join(' ')} ${e.music.map((m) => `${m.title} ${m.sub ?? ''}`).join(' ')} ${e.people.map((id) => names.get(id) ?? '').join(' ')}`.toLowerCase();
        if (!words.every((w) => hay.includes(w))) return false;
      }
      return true;
    });
  }, [entries, people, q, day]);

  const groups = useMemo(() => {
    const out: [string, Entry[]][] = [];
    for (const e of shown) {
      const last = out[out.length - 1];
      if (last && last[0] === e.date) last[1].push(e);
      else out.push([e.date, [e]]);
    }
    return out;
  }, [shown]);

  const filtering = !!q.trim() || !!day;
  // the sky takes the colour of the world you last checked in with today
  const today = todayKey();
  const mood = entries.find((e) => e.kind === 'checkin' && e.date === today && e.emotions.length);
  const world = (mood && coreOf(mood.emotions[0])?.id) || null;

  return (
    <div class="page">
      {/* the day and the check-in, set apart from the notes below on a panel of their own */}
      <div class="journal-top" style={world ? { '--sky': `var(--emo-${world})` } : undefined}>
      <Sky world={world} />
      <header class="page-head">
        <div class="row between">
          <h1 class="title">{longToday()}</h1>
          <div class="row">
            <button class="icon-btn" aria-pressed={searching} aria-label="Search" onClick={() => { setSearching(!searching); if (searching) setQ(''); }}>
              <Icon name="search" />
            </button>
            <button class="icon-btn" aria-pressed={calOpen} aria-label="Calendar" onClick={() => { setCalOpen(!calOpen); if (calOpen) setDay(null); }}>
              <Icon name="calendar" />
            </button>
            <button class="icon-btn" aria-label="Stats" title="Stats" onClick={() => navigate('stats')}>
              <Icon name="chart-dots" />
            </button>
          </div>
        </div>
      </header>

      {searching && (
        <label class="search">
          <Icon name="search" size={18} />
          <input type="search" autoFocus placeholder="Search notes, feelings, people and songs" value={q} onInput={(e) => setQ(e.currentTarget.value)} aria-label="Search notes" />
        </label>
      )}

      {calOpen && (
        <div class="card pad-s">
          <Calendar
            focus={day ?? todayKey()}
            isSelected={(k) => k === day}
            onPick={(k) => setDay(k === day ? null : k)}
            mark={(k) => {
              const list = byDay.get(k);
              if (!list) return null;
              const cores = [...new Set(list.flatMap((e) => e.emotions.map((id) => coreOf(id).id)))].slice(0, 3);
              return (
                <span class="cal-dots">
                  {cores.length ? cores.map((c) => <i style={{ background: `var(--emo-${c})` }} />) : <i />}
                </span>
              );
            }}
          />
        </div>
      )}

      {!filtering && <CheckInPrompt entries={entries} />}

      {day && (
        <div class="row between filter-note">
          <span>Showing {rangeLabel(day, null)}</span>
          <button class="link" onClick={() => setDay(null)}>Clear</button>
        </div>
      )}
      </div>

      {ready && !entries.length && (
        <div class="empty">
          <h2 class="title-s">Your journal is empty</h2>
          <p>Write down what’s on your mind, or check in with how you feel right now.</p>
          <div class="row gap-s center">
            <button class="btn btn-primary" onClick={() => navigate('note/new')}><Icon name="pencil" size={18} /> Write a note</button>
            <button class="btn btn-quiet" onClick={() => navigate('tracker')}>Check in</button>
          </div>
        </div>
      )}
      {ready && !!entries.length && !shown.length && <p class="empty-note center">Nothing matches these filters.</p>}

      {groups.map(([date, list]) => (
        <section class="day">
          <h2 class="day-label">{dayLabel(date)}</h2>
          <div class="entries">{list.map((e) => (e.kind === 'checkin' ? <CheckInRow e={e} /> : <NoteCard e={e} />))}</div>
        </section>
      ))}
    </div>
  );
}

/** The nudge to check in: pick the world that feels closest. Once you have today, it shows how you last felt. */
function CheckInPrompt({ entries }: { entries: Entry[] }) {
  const today = todayKey();
  const last = entries.find((e) => e.kind === 'checkin' && e.date === today && e.emotions.length);
  const em = last ? EMOTION[last.emotions[0]] : null;
  return (
    <section class="prompt card">
      <div class="prompt-head">
        <h2 class="prompt-q">How are you feeling?</h2>
        {em ? (
          <button class="prompt-last" onClick={() => navigate('note/' + last!.id)}>
            <Sprite core={em.core} size={11} /> {em.depth === 0 ? shortName(em.id) : em.name} · {timeLabel(last!.time)}
          </button>
        ) : (
          <span class="prompt-sub">Name it to tame it.</span>
        )}
      </div>
      <div class="prompt-worlds">
        {PICKER_ORDER.map((c) => (
          <button style={{ '--c': `var(--emo-${c})` }} aria-label={CORE[c].name} title={CORE[c].name} onClick={() => navigate('tracker?world=' + c)}>
            <Sprite core={c} size={18} />
            <span>{shortName(c)}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

export function NoteCard({ e }: { e: Entry }) {
  const byId = usePeopleById();
  const excerpt = stripMarkdown(plainText(e.text)).trim().slice(0, 240);
  const pictures = e.photos.length + e.images.length;
  const people = e.people.map((id) => byId.get(id)!).filter(Boolean);
  const hold = useHold(e, () => navigate('note/' + e.id));
  return (
    <button class={`note card${e.cover ? ' has-cover' : ''}`} {...hold}>
      {e.cover && <CoverImg cover={e.cover} class="note-cover" />}
      <div class="note-top">
        {e.icon && <span class="note-icon"><NoteIcon id={e.icon} size={22} /></span>}
        <div class="note-main">
          <div class="note-title">{e.title.trim() || (excerpt ? excerpt.split('\n')[0].slice(0, 60) : 'Untitled')}</div>
          <div class="note-when">{e.dateEnd ? rangeLabel(e.date, e.dateEnd) : timeLabel(e.time)}</div>
        </div>
      </div>
      {excerpt && e.title.trim() && <p class="note-text">{excerpt}</p>}
      {(e.emotions.length > 0 || pictures > 0 || e.music.length > 0 || people.length > 0) && (
        <div class="note-foot">
          <div class="note-emos">
            {e.emotions.map((id) => <EmotionChip id={id} size="sm" />)}
            {people.map((p) => <PersonChip p={p} size="sm" />)}
            {e.music.length > 0 && (
              <span class="note-music" title={e.music.map((m) => m.title).join(', ')}>
                <Icon name="music" size={14} /> <span>{e.music[0].title}</span>{e.music.length > 1 && ` +${e.music.length - 1}`}
              </span>
            )}
          </div>
          {pictures > 0 && (
            <div class="note-imgs">
              {e.photos.slice(0, 3).map((p) => <PhotoImg photo={p} fit={false} />)}
              {e.images.slice(0, Math.max(0, 3 - e.photos.length)).map((img) => <img src={imageSrc(img, 'thumb')} alt="" loading="lazy" referrerpolicy="no-referrer" />)}
              {pictures > 3 && <span class="more">+{pictures - 3}</span>}
            </div>
          )}
        </div>
      )}
    </button>
  );
}

export function CheckInRow({ e }: { e: Entry }) {
  const byId = usePeopleById();
  const id = e.emotions[0];
  const em = id ? EMOTION[id] : null;
  const with_ = e.people.map((pid) => byId.get(pid)?.name).filter(Boolean);
  const hold = useHold(e, () => navigate('note/' + e.id));
  return (
    <button class="checkin" {...hold}>
      {em ? <Sprite core={em.core} size={16} /> : <span />}
      <span class="checkin-name">{em ? (em.depth === 0 ? shortName(em.id) : em.name) : 'Check-in'}</span>
      <span class="checkin-meta">{[em && em.depth > 0 ? shortName(em.core) : '', with_.length ? `with ${with_.join(', ')}` : '', stripMarkdown(plainText(e.text)).trim().slice(0, 60)].filter(Boolean).join(' · ')}</span>
      <span class="checkin-time">{timeLabel(e.time)}</span>
    </button>
  );
}
