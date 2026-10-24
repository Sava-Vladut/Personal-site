import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { memo } from 'preact/compat';
import { usePref } from '../lib/prefs';
import { EMOTION, coreOf, shortName } from '../data/emotions';
import { dayLabel, formatDate, keyOf, longToday, rangeLabel, shortDate, timeLabel, todayKey } from '../lib/dates';
import { keepOnLeave, kept, navigate } from '../lib/router';
import { useBooks, useEntries, usePeople, useReady, useSettings, useSongs, type Entry, type WebImage } from '../lib/store';
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
import { AsciiCloud } from '../components/cloud';
import { CoverImg } from '../components/NoteDetails';
import { PhotoImg } from '../components/Photo';
import { PersonChip, usePeopleById } from '../components/people';
import { WeatherMark, weatherOf } from '../components/weather';
import { MiniMusic } from '../components/music';
import { DayPicker, SongOfDay, useDayPick, type DayPick } from '../components/SongOfDay';
import { PageHead } from '../components/PageHead';
import { WidgetEditor } from '../components/WidgetEditor';
import { Icon, NoteIcon, Sprite } from '../components/icons';
import '../styles/notes.css';
import '../styles/widgets.css';
import { usePoints } from '../lib/twitch';
import { optionOf, shownIn, useWidgets, type WidgetLayout } from '../lib/widgets';
import type { WidgetId } from '../data/widgets';
import { count, LOCALE, t } from '../lib/i18n';
import { Notices, useNews, type News } from '../components/Notices';

/** How many days of the feed are drawn at first; scrolling near the end draws this many more. */
const DAYS_PAGE = 20;

/** The id part of a tag or link (`note:<id>|`), which search shouldn't match. */
const TAG_ID = /(\[\[|@\[|♪\[)(?:note|book|person|song|trap|law):[^\]|\n]+\|/g;

export function Journal() {
  const entries = useEntries();
  const people = usePeople();
  const ready = useReady();
  // back from a note, the feed is as it was left: the same search, the same day, as far down
  const [was] = useState(() => kept<{ q: string; day: string | null; upTo: number }>('journal'));
  const [q, setQ] = useState(was.q ?? '');
  const [searching, setSearching] = useState(!!was.q);
  const [calOpen, setCalOpen] = usePref<boolean>('journal-calendar', false);
  const [day, setDay] = useState<string | null>(was.day ?? null);
  const [editing, setEditing] = useState(false);
  const widgets = useWidgets();
  const compact = useSettings().density === 'compact';
  const picker = useDayPick();
  const news = useNews();

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

  // Only the newest days are drawn; the rest come in as you scroll toward them, so a long journal opens (and saves) quickly.
  const [upTo, setUpTo] = useState(Math.max(DAYS_PAGE, was.upTo ?? 0));
  const filter = useRef({ q, day });
  useEffect(() => {
    if (filter.current.q === q && filter.current.day === day) return; // not as it comes back
    filter.current = { q, day };
    setUpTo(DAYS_PAGE);
  }, [q, day]);
  const now = useRef({ q, day, upTo });
  now.current = { q, day, upTo };
  useEffect(() => keepOnLeave(() => ({ journal: now.current })), []);
  const hasMore = groups.length > upTo;
  const moreRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = moreRef.current;
    if (!el) return;
    // a new observer after each page, so one that still leaves the end in reach draws the next page too
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setUpTo((n) => n + DAYS_PAGE), { rootMargin: '1500px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [hasMore, upTo]);

  const filtering = !!q.trim() || !!day;
  // the sky takes the colour of the world you last checked in with today
  const today = todayKey();
  const mood = entries.find((e) => e.kind === 'checkin' && e.date === today && e.emotions.length);
  const world = (mood && coreOf(mood.emotions[0])?.id) || null;

  return (
    <div class="page">
      {/* the day and the check-in, set apart from the notes below on a panel of their own */}
      <aside class="journal-side">
      <div class="journal-top" style={world ? { '--sky': `var(--emo-${world})` } : undefined}>
      <Sky world={world} />
      <PageHead
        title={longToday()}
        wheel world={world}
        actions={<>
          {/* searching and the calendar belong to the feed, so they live here; everywhere else is on the wheel */}
          <button class="icon-btn" aria-pressed={searching} aria-label={t('Search')} title={t('Search')} onClick={() => { setSearching(!searching); if (searching) setQ(''); }}>
            <Icon name="search" />
          </button>
          <button class="icon-btn" aria-pressed={calOpen} aria-label={t('Calendar')} title={t('Calendar')} onClick={() => { setCalOpen(!calOpen); if (calOpen) setDay(null); }}>
            <Icon name="calendar" />
          </button>
          <button class="icon-btn" aria-label={t('Edit the feed')} title={t('Edit the feed')} onClick={() => setEditing(true)}>
            <Icon name="layout-grid" />
          </button>
        </>}
      />

      {searching && (
        <label class="search">
          <Icon name="search" size={18} />
          <input type="search" autoFocus={!was.q} enterKeyHint="search" onKeyDown={(e) => e.key === 'Enter' && !e.isComposing && e.currentTarget.blur()} placeholder={t('Search notes, feelings, people, songs and books')} value={q} onInput={(e) => setQ(e.currentTarget.value)} aria-label={t('Search notes')} />
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

      {!filtering && (
        <div class="widgets">
          {shownIn(widgets, 'panel').map((id) => <Widget key={id} id={id} layout={widgets} entries={entries} byDay={byDay} onOpenDay={setDay} picker={picker} news={news} />)}
        </div>
      )}

      {day && (
        <div class="row between filter-note">
          <span>{t('Showing {day}', { day: rangeLabel(day, null) })}</span>
          <button class="link" onClick={() => setDay(null)}>{t('Clear')}</button>
        </div>
      )}
      </div>
      {shownIn(widgets, 'side').map((id) => <Widget key={id} id={id} layout={widgets} entries={entries} byDay={byDay} onOpenDay={setDay} picker={picker} news={news} />)}
      </aside>
      <JournalSongPicker picker={picker} />
      {news.sheet}
      <WidgetEditor open={editing} onClose={() => setEditing(false)} />

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
      {groups.slice(0, upTo).map(([date, list]) => <Day key={date} date={date} list={list} compact={compact} />)}
      {hasMore && <div ref={moreRef} class="feed-more" aria-hidden="true" />}
    </div>
  );
}

/** One of the feed's widgets (data/widgets.ts), set up as the layout says. */
function Widget({ id, layout, entries, byDay, onOpenDay, picker, news }: {
  id: WidgetId; layout: WidgetLayout; entries: Entry[]; byDay: Map<string, Entry[]>; onOpenDay: (day: string) => void; picker: DayPick; news: News;
}) {
  switch (id) {
    case 'notices': return <Notices entries={entries} picker={picker} news={news} />;
    case 'on-this-day': return <OnThisDay byDay={byDay} onOpen={onOpenDay} />;
    case 'coming-up': return <ComingUp within={optionOf(layout, id, 'days')} max={optionOf(layout, id, 'max')} />;
    case 'reading': return <ReadingNow max={optionOf(layout, id, 'max')} />;
    case 'song': return <JournalSong picker={picker} />;
    case 'points': return <JournalPoints graph={!!optionOf(layout, id, 'graph')} />;
  }
}

/** Sprites side by side shouldn't move in step: each waits a little, by when its entry was written. */
const stagger = (n: number) => n % 1300;

/**
 * One day of the journal, wearing its overall feeling: the world it leaned toward leads the label with a
 * line of what it was like, a ribbon under it holds the day's colours at the hours they were felt, and a
 * soft cloud of those colours drifts behind the entries while the day is on screen.
 */
type DayProps = { date: string; list: Entry[]; compact: boolean };
/** A day is drawn again only when one of its entries changed: saving a note leaves every other entry the same object. */
const sameDay = (a: DayProps, b: DayProps) =>
  a.date === b.date && a.compact === b.compact && a.list.length === b.list.length && a.list.every((e, i) => e === b.list[i]);
const Day = memo(DayOf, sameDay);

function DayOf({ date, list, compact }: DayProps) {
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
        {mood && <AsciiCloud world={mood.worlds[0]} seed={stagger(+date.replace(/-/g, ''))} />}
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

/** True while the screen is wide enough for the desktop layout's right-hand column (desktop.css). */
function useWide() {
  const [wide, setWide] = useState(() => matchMedia('(min-width: 1280px)').matches);
  useEffect(() => {
    const q = matchMedia('(min-width: 1280px)');
    const on = () => setWide(q.matches);
    on();
    q.addEventListener('change', on);
    return () => q.removeEventListener('change', on);
  }, []);
  return wide;
}

/** Desktop only: today's song under the day's panel. Its day picker is a sheet, so it sits outside the panel (JournalSongPicker). */
function JournalSong({ picker }: { picker: DayPick }) {
  const songs = useSongs();
  const wide = useWide();
  return wide && songs.length ? <SongOfDay songs={songs} picker={picker} /> : null;
}

/** Desktop only: the channel points total under the song, a tap away from the full page. */
function JournalPoints({ graph }: { graph: boolean }) {
  const wide = useWide();
  const { data } = usePoints(wide);
  if (!wide || !data) return null;
  const { total, change, daily, channels } = data;
  const live = channels.filter((c) => c.live);
  const tail = daily.slice(-30);
  const known = tail.filter((v): v is number => v !== null);
  const lo = Math.min(...known), hi = Math.max(...known);
  const W = 120, H = 34;
  let d = '';
  tail.forEach((v, i) => {
    if (v === null) return;
    const px = (i / (tail.length - 1)) * W, py = H - 2 - ((v - lo) / (hi - lo || 1)) * (H - 4);
    d += `${d ? 'L' : 'M'}${px.toFixed(1)},${py.toFixed(1)}`;
  });
  return (
    <button class="tw-mini fade-arrive" onClick={() => navigate('twitch')} aria-label={t('Channel points')}>
      <span class="tw-mini-ico"><Icon name="brand-twitch" size={18} /></span>
      <span class="tw-mini-main">
        <small>{t('Channel points')}</small>
        <b>{total.toLocaleString(LOCALE)}</b>
        <span class="tw-mini-sub">
          {live.length > 0 && <span class="tw-live" aria-hidden="true" />}
          {live.length ? t('Watching {names} now', { names: live.map((c) => c.name).join(', ') }) : `${change.day > 0 ? '+' : ''}${change.day.toLocaleString(LOCALE)} ${t('today')}`}
        </span>
      </span>
      {graph && known.length > 1 && <svg class="tw-mini-spark" width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true"><path d={d} /></svg>}
      <Icon name="chevron-right" size={16} />
    </button>
  );
}

function JournalSongPicker({ picker }: { picker: DayPick }) {
  const songs = useSongs();
  return <DayPicker songs={songs} picker={picker} />;
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
function ComingUp({ within, max }: { within: number; max: number }) {
  const people = usePeople();
  const [hidden, setHidden] = useState(seen);
  const list = upcoming(people, within).filter((u) => !hidden.includes(occurrence(u))).slice(0, max);
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
                <span class="book-row-sub">{[whenLabel(u.days), u.days > 1 ? formatDate(u.on, { weekday: 'short', day: 'numeric', month: 'short' }) : '', years].filter(Boolean).join(' · ')}</span>
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

function ReadingNow({ max }: { max: number }) {
  const reading = useBooks().filter((b) => b.status === 'reading').slice(0, max || undefined);
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
/** A picture keeps its own shape on the card: close to square or wide it fills the frame, a banner or a sliver is shown whole, and a small one isn't blown up. */
function heroShape(p: Photo) {
  const raw = p.w > 0 && p.h > 0 ? p.w / p.h : 16 / 9;
  const ar = Math.min(2.4, Math.max(0.8, raw));
  return { '--ar': ar, '--mw': `${Math.max(160, p.w)}px`, '--fit': raw === ar ? 'cover' : 'contain' };
}

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
        <div class={`note-hero${'photo' in hero ? ' is-photo' : ''}`} style={'photo' in hero ? heroShape(hero.photo) : undefined}>
          {'photo' in hero ? <PhotoImg photo={hero.photo} fit={false} /> : <img src={imageSrc(hero.image, 'full')} alt="" loading="lazy" referrerpolicy="no-referrer" />}
        </div>
      )}
      {(e.emotions.length > 0 || strip > 0 || e.music.length > 0 || people.length > 0 || books.length > 0 || !!e.place?.name || !!e.share) && (
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
            {e.share && (
              <span class="note-public" title={t('This note is public')}>
                <Icon name="world" size={14} /> <span>{t('Public')}</span>
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
      <span class="checkin-meta">{[em && em.depth > 0 ? shortName(em.core) : '', people.length ? t('thinking of {names}', { names: people.join(', ') }) : '', e.music[0] ? t('listening to {title}', { title: e.music[0].title }) : '', stripMarkdown(plainText(e.text)).trim().slice(0, 60)].filter(Boolean).join(' · ')}</span>
      <span class="checkin-time">{w && <WeatherMark w={w} />}{timeLabel(e.time)}</span>
    </button>
  );
}
