import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { usePref } from '../lib/prefs';
import { CORE, EMOTION, PICKER_ORDER, coreOf, shortName } from '../data/emotions';
import { dayLabel, keyOf, longToday, rangeLabel, shortDate, timeLabel, todayKey } from '../lib/dates';
import { navigate } from '../lib/router';
import { useBooks, useEntries, usePeople, useReady, useSettings, type Entry, type WebImage } from '../lib/store';
import { booksIn } from '../lib/books';
import { upcoming, whatsComing, whenLabel, type Upcoming } from '../lib/people';
import { bodyOf, itemsOf, plainText } from '../lib/body';
import { imageSrc } from '../lib/images';
import type { Photo } from '../lib/photos';
import { previewOf, stripMarkdown } from '../lib/markdown';
import { dayMood } from '../lib/mood';
import { watchView } from '../lib/inView';
import { BookChip, BookCover } from '../components/books';
import { Calendar } from '../components/Calendar';
import { useHold } from '../components/EntryMenu';
import { Swipe } from '../components/Swipe';
import { EmotionChip } from '../components/emotion';
import { Sky } from '../components/Sky';
import { NavWheel } from '../components/NavWheel';
import { CoverImg } from '../components/NoteDetails';
import { PhotoImg } from '../components/Photo';
import { PersonChip, usePeopleById } from '../components/people';
import { WeatherMark, weatherOf } from '../components/weather';
import { MiniMusic } from '../components/music';
import { Icon, NoteIcon, Sprite } from '../components/icons';
import '../styles/notes.css';
import { LOCALE, count, t } from '../lib/i18n';

/** The id part of a tag or link (`note:<id>|`), which search shouldn't match. */
const TAG_ID = /(\[\[|@\[|♪\[)(?:note|book|person|song):[^\]|\n]+\|/g;

/** `?search` or `?calendar` (from the wheel on another page) opens that as the journal appears. */
export function Journal({ query }: { query?: URLSearchParams }) {
  const entries = useEntries();
  const people = usePeople();
  const ready = useReady();
  const [q, setQ] = useState('');
  const [searching, setSearching] = useState(false);
  const [calOpen, setCalOpen] = usePref<boolean>('journal-calendar', false);
  const [day, setDay] = useState<string | null>(null);
  const compact = useSettings().density === 'compact';
  useEffect(() => {
    if (!query) return;
    const s = query.has('search'), c = query.has('calendar');
    if (!s && !c) return;
    if (s) setSearching(true);
    if (c) setCalOpen(true);
    history.replaceState(history.state, '', '#/');
  }, [query]);

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
        const hay = `${e.title} ${plainText(e.text).replace(TAG_ID, '$1')} ${e.emotions.map((id) => EMOTION[id]?.name).join(' ')} ${e.music.map((m) => `${m.title} ${m.sub ?? ''}`).join(' ')} ${e.people.map((id) => names.get(id) ?? '').join(' ')} ${e.place?.name ?? ''}`.toLowerCase();
        if (!words.every((w) => hay.includes(w))) return false;
      }
      return true;
    });
  }, [entries, people, q, day]);

  const pinned = useMemo(() => shown.filter((e) => e.pinned), [shown]);
  const groups = useMemo(() => {
    const out: [string, Entry[]][] = [];
    for (const e of shown) {
      if (e.pinned) continue;
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
            {/* search and the calendar open from the wheel; while open, their button stays here to close them */}
            {searching && (
              <button class="icon-btn" aria-pressed="true" aria-label={t('Close search')} title={t('Close search')} onClick={() => { setSearching(false); setQ(''); }}>
                <Icon name="search" />
              </button>
            )}
            {calOpen && (
              <button class="icon-btn" aria-pressed="true" aria-label={t('Close the calendar')} title={t('Close the calendar')} onClick={() => { setCalOpen(false); setDay(null); }}>
                <Icon name="calendar" />
              </button>
            )}
            <NavWheel
              world={world}
              runs={{ search: () => setSearching(true), calendar: () => { setCalOpen(!calOpen); if (calOpen) setDay(null); } }}
              active={{ search: searching, calendar: calOpen }}
            />
          </div>
        </div>
      </header>

      {searching && (
        <label class="search">
          <Icon name="search" size={18} />
          <input type="search" autoFocus placeholder={t('Search notes, feelings, people, songs and books')} value={q} onInput={(e) => setQ(e.currentTarget.value)} aria-label={t('Search notes')} />
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
      {!filtering && <OnThisDay byDay={byDay} onOpen={setDay} />}
      {!filtering && <ComingUp />}
      {!filtering && <ReadingNow />}

      {day && (
        <div class="row between filter-note">
          <span>{t('Showing {day}', { day: rangeLabel(day, null) })}</span>
          <button class="link" onClick={() => setDay(null)}>{t('Clear')}</button>
        </div>
      )}
      </div>

      {ready && !entries.length && (
        <div class="empty">
          <h2 class="title-s">{t('Your journal is empty')}</h2>
          <p>{t('Write down what’s on your mind, or check in with how you feel right now.')}</p>
          <div class="row gap-s center">
            <button class="btn btn-primary" onClick={() => navigate('note/new')}><Icon name="pencil" size={18} /> {t('Write a note')}</button>
            <button class="btn btn-quiet" onClick={() => navigate('tracker')}>{t('Check in')}</button>
          </div>
        </div>
      )}
      {ready && !!entries.length && !shown.length && <p class="empty-note center">{t('Nothing matches these filters.')}</p>}

      {pinned.length > 0 && (
        <section class="day pinned">
          <h2 class="day-label"><Icon name="pin" size={13} /> {t('Pinned')}</h2>
          <Entries list={pinned} compact={compact} dated />
        </section>
      )}
      {groups.map(([date, list]) => <Day key={date} date={date} list={list} compact={compact} />)}
    </div>
  );
}

/** Sprites side by side shouldn't move in step: each waits a little, by when its entry was written. */
const stagger = (n: number) => n % 1300;

/**
 * One day of the journal, wearing its overall feeling: the world it leaned toward leads the label with a
 * line of what it was like, a ribbon under it holds the day's colours at the hours they were felt, and a
 * soft cloud of those colours drifts behind the entries while the day is on screen.
 */
function Day({ date, list, compact }: { date: string; list: Entry[]; compact: boolean }) {
  const mood = useMemo(() => dayMood(list), [list]);
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    return el ? watchView(el, (on) => el.toggleAttribute('data-live', on)) : undefined;
  }, []);
  const style = mood ? { '--d1': `var(--emo-${mood.worlds[0]})`, '--d2': `var(--emo-${mood.worlds[1] ?? mood.worlds[0]})` } : undefined;
  return (
    <section ref={ref} class={mood ? 'day has-mood' : 'day'} style={style}>
      <h2 class="day-label">
        {mood && <Sprite core={mood.worlds[0]} size={12} idle="view" delay={stagger(+date.replace(/-/g, ''))} />}
        <span>{dayLabel(date)}</span>
        {mood && <span class="day-mood">{mood.word}</span>}
        {mood && <i class="day-ribbon" style={{ background: mood.ribbon }} aria-hidden="true" />}
      </h2>
      <Entries list={list} compact={compact} />
    </section>
  );
}

type Item = { run: Entry[] } | { one: Entry };

function Entries({ list, compact, dated }: { list: Entry[]; compact: boolean; dated?: boolean }) {
  const items: Item[] = [];
  for (const e of list) {
    const last = items[items.length - 1];
    if (e.kind !== 'checkin') items.push({ one: e });
    else if (last && 'run' in last) last.run.push(e);
    else if (last && 'one' in last && last.one.kind === 'checkin') items[items.length - 1] = { run: [last.one, e] };
    else items.push({ one: e });
  }
  return (
    <div class={compact ? 'entries compact card' : 'entries'}>
      {items.map((it) =>
        'run' in it ? (
          <CheckInRun key={'run:' + it.run[0].id} list={it.run} />
        ) : (
          <Swipe key={it.one.id} e={it.one}>
            {it.one.kind === 'checkin' ? <CheckInRow e={it.one} /> : compact ? <NoteRow e={it.one} dated={dated} /> : <NoteCard e={it.one} dated={dated} />}
          </Swipe>
        ),
      )}
    </div>
  );
}

/** Back-to-back check-ins folded into one line; tap to unfold them. */
function CheckInRun({ list }: { list: Entry[] }) {
  const [open, setOpen] = useState(false);
  const worlds = [...new Set(list.flatMap((e) => e.emotions.slice(0, 1).map((id) => coreOf(id).id)))].slice(0, 4);
  const times = list.map((e) => e.time).sort();
  const span = times[0] === times[times.length - 1] ? timeLabel(times[0]) : `${timeLabel(times[0])} – ${timeLabel(times[times.length - 1])}`;
  return (
    <div class={open ? 'checkin-run open' : 'checkin-run'}>
      <button class="checkin checkin-fold" style={worlds.length ? { '--c': `var(--emo-${worlds[0]})` } : undefined} aria-expanded={open} onClick={() => setOpen(!open)}>
        <span class="fold-sprites">{worlds.map((c, i) => <Sprite core={c} size={14} idle="view" delay={stagger(list[0].time) + i * 420} />)}</span>
        <span class="checkin-name">{count(list.length, 'check-in', 'check-ins')}</span>
        <span class="checkin-meta">{worlds.map((c) => shortName(c)).join(', ')}</span>
        <span class="checkin-time">{span}</span>
        <Icon name="chevron-down" size={14} />
      </button>
      {open && list.map((e) => <Swipe key={e.id} e={e}><CheckInRow e={e} /></Swipe>)}
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
        <h2 class="prompt-q">{t('How are you feeling?')}</h2>
        {em ? (
          <button class="prompt-last" onClick={() => navigate('note/' + last!.id)}>
            <Sprite core={em.core} size={11} /> {em.depth === 0 ? shortName(em.id) : em.name} · {timeLabel(last!.time)}
          </button>
        ) : (
          <span class="prompt-sub">{t('Name it to tame it.')}</span>
        )}
      </div>
      <div class="prompt-worlds">
        {PICKER_ORDER.map((c, i) => (
          <button data-core={c} style={{ '--c': `var(--emo-${c})` }} aria-label={CORE[c].name} title={CORE[c].name} onClick={() => navigate('tracker?world=' + c)}>
            <Sprite core={c} size={18} idle delay={i * 370} />
            <span>{shortName(c)}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

/** A day from a year (or more) ago, on today's date: how it felt, and a tap away from what you wrote. */
function OnThisDay({ byDay, onOpen }: { byDay: Map<string, Entry[]>; onOpen: (day: string) => void }) {
  const today = todayKey();
  const date = [...byDay.keys()].filter((k) => k < today && k.slice(5) === today.slice(5)).sort().pop();
  const list = date ? byDay.get(date)! : null;
  const mood = useMemo(() => (list ? dayMood(list) : null), [list]);
  if (!date || !list) return null;
  const years = +today.slice(0, 4) - +date.slice(0, 4);
  const note = list.find((e) => e.kind === 'note');
  const title = note ? previewOf(plainText(note.text), note.title).heading : '';
  const c = mood?.worlds[0];
  return (
    <div class="coming-up">
      <div class="coming-chip card on-this-day" style={c ? { '--c': `var(--emo-${c})` } : undefined}>
        <button class="coming-main" onClick={() => onOpen(date)}>
          <span class="coming-icon">{c ? <Sprite core={c} size={16} idle /> : <Icon name="clock" size={18} />}</span>
          <span class="book-row-main">
            <span class="book-row-title">{years === 1 ? t('A year ago today') : t('{span} ago today', { span: count(years, 'year', 'years') })}</span>
            <span class="book-row-sub">{[mood?.word, title].filter(Boolean).join(' · ') || count(list.length, 'entry', 'entries')}</span>
          </span>
          <Icon name="chevron-right" size={16} />
        </button>
      </div>
    </div>
  );
}

/** The books you're in the middle of, a tap away from their page or a note about them. */
const DISMISSED = 'mm-dates-seen';
const occurrence = (u: Upcoming) => `${u.person.id}:${u.date.id}:${keyOf(u.on)}`;
function seen(): string[] {
  try { const v = JSON.parse(localStorage.getItem(DISMISSED) ?? '[]'); return Array.isArray(v) ? v : []; } catch { return []; }
}

/**
 * A gentle note about the birthdays and anniversaries of the next two weeks. Putting one away hides it until it
 * comes round again next year.
 */
function ComingUp() {
  const people = usePeople();
  const [hidden, setHidden] = useState(seen);
  const list = upcoming(people, 14).filter((u) => !hidden.includes(occurrence(u))).slice(0, 3);
  if (!list.length) return null;
  const hide = (u: Upcoming) => {
    const keep = new Set(list.map(occurrence));
    // only this year's ones are worth remembering; older ones have passed
    const next = [...hidden.filter((k) => keep.has(k) || k.slice(-10) >= todayKey()), occurrence(u)];
    try { localStorage.setItem(DISMISSED, JSON.stringify(next)); } catch {}
    setHidden(next);
  };
  return (
    <div class="coming-up" role="list" aria-label={t('Coming up')}>
      {list.map((u) => {
        const { what, years } = whatsComing(u);
        return (
          <div class={`coming-chip card${u.days === 0 ? ' is-today' : ''}`} role="listitem">
            <button class="coming-main" onClick={() => navigate('person/' + u.person.id)}>
              <span class="coming-icon"><Icon name={u.date.kind === 'birthday' ? 'cake' : u.date.kind === 'anniversary' ? 'heart' : 'calendar-event'} size={18} /></span>
              <span class="book-row-main">
                <span class="book-row-title">{what}</span>
                <span class="book-row-sub">{[whenLabel(u.days), u.days > 1 ? u.on.toLocaleDateString(LOCALE, { weekday: 'short', day: 'numeric', month: 'short' }) : '', years].filter(Boolean).join(' · ')}</span>
              </span>
            </button>
            <button class="icon-btn small" onClick={() => hide(u)} aria-label={t('Put away until next time')} title={t('Put away')}>
              <Icon name="x" size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

function ReadingNow() {
  const reading = useBooks().filter((b) => b.status === 'reading');
  if (!reading.length) return null;
  return (
    <div class="reading-strip" role="list" aria-label={t('Reading now')}>
      {reading.map((b) => {
        const pct = b.pages && b.page ? Math.min(100, Math.round((b.page / b.pages) * 100)) : null;
        return (
          <div class="reading-chip card" role="listitem">
            <button class="reading-chip-main" onClick={() => navigate('book/' + b.id)}>
              <BookCover b={b} width={30} />
              <span class="book-row-main">
                <span class="book-row-title">{b.title.trim() || t('Untitled')}</span>
                <span class="book-row-sub">{pct !== null ? t('{pct}% read', { pct }) : t('Reading')}</span>
              </span>
            </button>
            <button class="icon-btn small" onClick={() => navigate('note/new?book=' + b.id)} aria-label={t('Write about {title}', { title: b.title })} title={t('Write about it')}>
              <Icon name="pencil" size={16} />
            </button>
          </div>
        );
      })}
    </div>
  );
}

/** The first picture in a note's text, big enough to see on its card. */
function heroOf(e: Entry): { photo: Photo } | { image: WebImage } | null {
  const first = bodyOf(e).media.flatMap(itemsOf)[0];
  if (!first) return null;
  if (first.kind === 'photo') {
    const photo = e.photos.find((p) => p.id === first.id);
    return photo ? { photo } : null;
  }
  const image = e.images.find((i) => i.url === first.url);
  return image ? { image } : null;
}

export function NoteCard({ e, dated }: { e: Entry; dated?: boolean }) {
  const byId = usePeopleById();
  const shelf = useBooks();
  const books = booksIn(e.text, shelf).map((id) => shelf.find((b) => b.id === id)!).filter(Boolean);
  const { heading, preview } = previewOf(plainText(e.text), e.title);
  const hero = e.cover ? null : heroOf(e);
  const pictures = e.photos.length + e.images.length;
  const people = e.people.map((id) => byId.get(id)!).filter(Boolean);
  const hold = useHold(e, () => navigate('note/' + e.id));
  const strip = hero ? pictures - 1 : pictures;
  const skip = hero && 'photo' in hero ? hero.photo.id : null;
  const photos = e.photos.filter((p) => p.id !== skip);
  const images = e.images.filter((i) => !(hero && 'image' in hero && hero.image.url === i.url));
  const w = weatherOf(e);
  // the note's feelings drift through its card as a soft cloud, brighter the stronger they were
  const worlds = [...new Set(e.emotions.map((id) => coreOf(id)?.id).filter(Boolean))];
  const mood = worlds.length ? { '--c1': `var(--emo-${worlds[0]})`, '--c2': `var(--emo-${worlds[1] ?? worlds[0]})`, '--k': e.intensity, '--t': stagger(e.time) } : undefined;
  return (
    <button class={`note card${e.cover ? ' has-cover' : ''}${mood ? ' has-mood' : ''}`} style={mood} {...hold}>
      {e.cover && <CoverImg cover={e.cover} class="note-cover" />}
      <div class="note-top">
        {e.icon && <span class="note-icon"><NoteIcon id={e.icon} size={22} /></span>}
        <div class="note-main">
          <div class="note-title">{heading || t('Untitled')}</div>
          <div class="note-when">
            {e.dateEnd ? rangeLabel(e.date, e.dateEnd) : dated ? `${shortDate(e.date)} · ${timeLabel(e.time)}` : timeLabel(e.time)}
            {w && <> · <WeatherMark w={w} /></>}
          </div>
        </div>
      </div>
      {preview && <p class="note-text">{preview}</p>}
      {hero && (
        <div class="note-hero">
          {'photo' in hero ? <PhotoImg photo={hero.photo} fit={false} /> : <img src={imageSrc(hero.image, 'full')} alt="" loading="lazy" referrerpolicy="no-referrer" />}
        </div>
      )}
      {(e.emotions.length > 0 || strip > 0 || e.music.length > 0 || people.length > 0 || books.length > 0 || !!e.place?.name) && (
        <div class="note-foot">
          <div class="note-emos">
            {e.emotions.map((id, i) => <EmotionChip id={id} size="sm" idle="view" delay={stagger(e.time) + i * 380} />)}
            {people.map((p) => <PersonChip p={p} size="sm" />)}
            {books.map((b) => <BookChip b={b} />)}
            {e.music.length > 0 && (
              <span class="note-music" title={e.music.map((m) => m.title).join(', ')}>
                <MiniMusic m={e.music[0]} /> <span>{e.music[0].title}</span>{e.music.length > 1 && ` +${e.music.length - 1}`}
              </span>
            )}
            {e.place?.name && (
              <span class="note-music" title={e.place.name}>
                <Icon name="map-pin" size={14} /> <span>{e.place.name}</span>
              </span>
            )}
          </div>
          {strip > 0 && (
            <div class="note-imgs">
              {photos.slice(0, 3).map((p) => <PhotoImg photo={p} fit={false} />)}
              {images.slice(0, Math.max(0, 3 - photos.length)).map((img) => <img src={imageSrc(img, 'thumb')} alt="" loading="lazy" referrerpolicy="no-referrer" />)}
              {strip > 3 && <span class="more">+{strip - 3}</span>}
            </div>
          )}
        </div>
      )}
    </button>
  );
}

/** A note as one line, for the compact journal. */
export function NoteRow({ e, dated }: { e: Entry; dated?: boolean }) {
  const { heading, preview } = previewOf(plainText(e.text), e.title, 120);
  const worlds = [...new Set(e.emotions.map((id) => coreOf(id).id))].slice(0, 3);
  const pictures = e.photos.length + e.images.length;
  const hold = useHold(e, () => navigate('note/' + e.id));
  return (
    <button class="note-row" {...hold}>
      <span class="row-icon">{e.icon ? <NoteIcon id={e.icon} size={18} /> : <Icon name="notebook" size={18} />}</span>
      <span class="row-title">{heading || t('Untitled')}</span>
      <span class="row-text">{preview.replace(/\n+/g, ' · ')}</span>
      <span class="row-marks">
        {worlds.map((c, i) => <Sprite core={c} size={12} idle="view" delay={stagger(e.time) + i * 380} />)}
        {pictures > 0 && <Icon name="photo" size={14} />}
        {e.music.length > 0 && <Icon name="music" size={14} />}
      </span>
      <span class="checkin-time">{dated ? shortDate(e.date) : timeLabel(e.time)}</span>
    </button>
  );
}

export function CheckInRow({ e }: { e: Entry }) {
  const byId = usePeopleById();
  const id = e.emotions[0];
  const em = id ? EMOTION[id] : null;
  const people = e.people.map((pid) => byId.get(pid)?.name).filter(Boolean);
  const hold = useHold(e, () => navigate('note/' + e.id));
  const w = weatherOf(e);
  return (
    <button class="checkin" style={em ? { '--c': `var(--emo-${em.core})`, '--k': e.intensity } : undefined} {...hold}>
      {em ? <Sprite core={em.core} size={16} idle="view" delay={stagger(e.time)} /> : <span />}
      <span class="checkin-name">{em ? (em.depth === 0 ? shortName(em.id) : em.name) : t('Check-in')}</span>
      <span class="checkin-meta">{[em && em.depth > 0 ? shortName(em.core) : '', people.length ? t('thinking of {names}', { names: people.join(', ') }) : '', stripMarkdown(plainText(e.text)).trim().slice(0, 60)].filter(Boolean).join(' · ')}</span>
      <span class="checkin-time">{w && <WeatherMark w={w} />}{timeLabel(e.time)}</span>
    </button>
  );
}
