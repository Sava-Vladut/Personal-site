import { useMemo, useState } from 'preact/hooks';
import { CORE, EMOTION, PICKER_ORDER, coreOf, shortName } from '../data/emotions';
import { dayLabel, longToday, rangeLabel, timeLabel, todayKey } from '../lib/dates';
import { navigate } from '../lib/router';
import { useEntries, useReady, type Entry } from '../lib/store';
import { sized } from '../lib/pinterest';
import { Calendar } from '../components/Calendar';
import { EmotionChip } from '../components/emotion';
import { AppMark, Icon, NoteIcon, Sprite } from '../components/icons';

type Filter = 'all' | 'note' | 'checkin' | string; // string = core emotion id

export function Journal() {
  const entries = useEntries();
  const ready = useReady();
  const [filter, setFilter] = useState<Filter>('all');
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
    return entries.filter((e) => {
      if (filter === 'note' || filter === 'checkin') { if (e.kind !== filter) return false; }
      else if (filter !== 'all' && !e.emotions.some((id) => id.startsWith(filter))) return false;
      if (day && !(e.date === day || (e.dateEnd && e.date <= day && day <= e.dateEnd))) return false;
      if (words.length) {
        const hay = `${e.title} ${e.text} ${e.emotions.map((id) => EMOTION[id]?.name).join(' ')} ${e.music.map((m) => `${m.title} ${m.sub ?? ''}`).join(' ')}`.toLowerCase();
        if (!words.every((w) => hay.includes(w))) return false;
      }
      return true;
    });
  }, [entries, filter, q, day]);

  const groups = useMemo(() => {
    const out: [string, Entry[]][] = [];
    for (const e of shown) {
      const last = out[out.length - 1];
      if (last && last[0] === e.date) last[1].push(e);
      else out.push([e.date, [e]]);
    }
    return out;
  }, [shown]);

  const filtering = filter !== 'all' || !!q.trim() || !!day;

  return (
    <div class="page">
      <header class="page-head">
        <div class="brand"><AppMark size={12} /> My Mind</div>
        <div class="row between">
          <h1 class="title">{longToday()}</h1>
          <div class="row">
            <button class="icon-btn" aria-pressed={searching} aria-label="Search" onClick={() => { setSearching(!searching); if (searching) setQ(''); }}>
              <Icon name="search" />
            </button>
            <button class="icon-btn" aria-pressed={calOpen} aria-label="Calendar" onClick={() => { setCalOpen(!calOpen); if (calOpen) setDay(null); }}>
              <Icon name="calendar" />
            </button>
          </div>
        </div>
      </header>

      {searching && (
        <label class="search">
          <Icon name="search" size={18} />
          <input type="search" autoFocus placeholder="Search notes, feelings and songs" value={q} onInput={(e) => setQ(e.currentTarget.value)} aria-label="Search notes" />
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

      {!filtering && <CheckInPrompt />}

      <div class="chips scroll-x filters" role="toolbar" aria-label="Filter">
        {([['all', 'All'], ['note', 'Notes'], ['checkin', 'Check-ins']] as const).map(([v, label]) => (
          <button class="chip" aria-pressed={filter === v} onClick={() => setFilter(v)}>{label}</button>
        ))}
        <span class="chip-sep" />
        {PICKER_ORDER.map((c) => (
          <button class="chip chip-icon" aria-pressed={filter === c} aria-label={shortName(c)} title={CORE[c].name} onClick={() => setFilter(filter === c ? 'all' : c)}>
            <Sprite core={c} size={14} />
          </button>
        ))}
      </div>

      {day && (
        <div class="row between filter-note">
          <span>Showing {rangeLabel(day, null)}</span>
          <button class="link" onClick={() => setDay(null)}>Clear</button>
        </div>
      )}

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

function CheckInPrompt() {
  return (
    <div class="prompt card">
      <div>
        <div class="prompt-q">How are you feeling?</div>
        <div class="prompt-sub">Name it to tame it.</div>
      </div>
      <div class="prompt-worlds">
        {PICKER_ORDER.map((c) => (
          <button aria-label={CORE[c].name} title={CORE[c].name} onClick={() => navigate('tracker?world=' + c)}>
            <Sprite core={c} size={18} />
          </button>
        ))}
      </div>
    </div>
  );
}

function NoteCard({ e }: { e: Entry }) {
  const excerpt = e.text.trim().slice(0, 240);
  return (
    <button class="note card" onClick={() => navigate('note/' + e.id)}>
      <div class="note-top">
        {e.icon && <span class="note-icon"><NoteIcon id={e.icon} size={22} /></span>}
        <div class="note-main">
          <div class="note-title">{e.title.trim() || (excerpt ? excerpt.split('\n')[0].slice(0, 60) : 'Untitled')}</div>
          <div class="note-when">{e.dateEnd ? rangeLabel(e.date, e.dateEnd) : timeLabel(e.time)}</div>
        </div>
      </div>
      {excerpt && e.title.trim() && <p class="note-text">{excerpt}</p>}
      {(e.emotions.length > 0 || e.images.length > 0 || e.music.length > 0) && (
        <div class="note-foot">
          <div class="note-emos">
            {e.emotions.map((id) => <EmotionChip id={id} size="sm" />)}
            {e.music.length > 0 && (
              <span class="note-music" title={e.music.map((m) => m.title).join(', ')}>
                <Icon name="music" size={14} /> <span>{e.music[0].title}</span>{e.music.length > 1 && ` +${e.music.length - 1}`}
              </span>
            )}
          </div>
          {e.images.length > 0 && (
            <div class="note-imgs">
              {e.images.slice(0, 3).map((img) => <img src={sized(img.url, 236)} alt="" loading="lazy" referrerpolicy="no-referrer" />)}
              {e.images.length > 3 && <span class="more">+{e.images.length - 3}</span>}
            </div>
          )}
        </div>
      )}
    </button>
  );
}

export function CheckInRow({ e }: { e: Entry }) {
  const id = e.emotions[0];
  const em = id ? EMOTION[id] : null;
  return (
    <button class="checkin" onClick={() => navigate('note/' + e.id)}>
      {em ? <Sprite core={em.core} size={16} /> : <span />}
      <span class="checkin-name">{em ? (em.depth === 0 ? shortName(em.id) : em.name) : 'Check-in'}</span>
      <span class="checkin-meta">{em && em.depth > 0 ? shortName(em.core) : ''}{e.text ? ` · ${e.text.slice(0, 60)}` : ''}</span>
      <span class="checkin-time">{timeLabel(e.time)}</span>
    </button>
  );
}
