// The bar under the date (a widget on the journal's panel): what's still to do today and what's worth knowing, a line
// each. Lines that need you come first and glow, with a dot that breathes, until you see to them; any line can be put
// away (until tomorrow, or a while longer for the ones that would only come back the same). Only a few show at once.
import type { ComponentChildren, FunctionComponent } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import type { Release } from '../data/changelog';
import { coreOf, EMOTION, shortName } from '../data/emotions';
import { useCountdown, useNow } from '../lib/countdown';
import { addDays, DAY, diffDays, keyOf, shortDate, todayKey } from '../lib/dates';
import { count, LOCALE, t } from '../lib/i18n';
import { keptLesson, lessonOf, type Lesson } from '../lib/lesson';
import { dayMood } from '../lib/mood';
import { momentsByPerson, monthsOf, trendOf, upcoming, whatsComing, whenLabel } from '../lib/people';
import { navigate } from '../lib/router';
import { lastExport, useBooks, usePeople, useSettings, useSongs, type Entry } from '../lib/store';
import { useSync } from '../lib/sync';
import { usePoints } from '../lib/twitch';
import { Icon, type UiName } from './icons';
import { streakOf, type DayPick } from './SongOfDay';

/** How long without a check-in before the bar asks for one. */
const CHECKIN_AFTER = 6 * 3600_000;
/** The last version whose news you've opened, on this device. */
const SEEN = 'mm-seen-version';
/** Lines put away: line id → the last day it stays away. */
const HIDDEN = 'mm-notices-hidden';
/** How many lines show before "more". */
const FIRST = 4;
/** Channel point totals worth a line when you pass them. */
const MILESTONES = [10_000, 25_000, 50_000, 100_000, 250_000, 500_000, 1_000_000, 2_500_000, 5_000_000, 10_000_000];

const feltName = (id: string) => {
  const em = EMOTION[id];
  return em.depth === 0 ? shortName(em.id) : em.name;
};
const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;
const signed = (n: number) => `${n > 0 ? '+' : ''}${n.toLocaleString(LOCALE)}`;
const pleasant = (e: Entry) => coreOf(e.emotions[0])?.valence === 'pleasant';
/** The share of a day's check-ins that felt pleasant, when it has a couple to go on. */
function warmth(list: Entry[]) {
  const felt = list.filter((e) => e.kind === 'checkin' && e.emotions.length);
  return felt.length >= 2 ? felt.filter(pleasant).length / felt.length : null;
}

export type News = ReturnType<typeof useNews>;

/**
 * The newest release, and its sheet once asked for: both load after the journal, so its first paint stays light. The
 * sheet is drawn outside the day's panel (by Journal, like the song picker), where the panel can't clip it.
 */
export function useNews() {
  const [latest, setLatest] = useState<Release | null>(null);
  const [seen, setSeen] = useState(() => {
    try { return localStorage.getItem(SEEN); } catch { return null; }
  });
  const [Sheet, setSheet] = useState<FunctionComponent<{ open: boolean; onClose: () => void }> | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    import('../data/changelog').then((m) => setLatest(m.CHANGELOG[0]), () => {});
  }, []);
  const show = () => {
    if (!latest) return;
    try { localStorage.setItem(SEEN, latest.version); } catch {}
    import('./Changelog').then((m) => {
      setSheet(() => m.ChangelogSheet);
      setOpen(true);
    }, () => {});
  };
  // the line stays while the sheet is open, so it doesn't jump away under your finger
  const fresh = !!latest && (latest.version !== seen || open);
  const sheet = Sheet && <Sheet open={open} onClose={() => { setOpen(false); setSeen(latest?.version ?? null); }} />;
  return { latest: fresh ? latest : null, show, sheet };
}

interface Row {
  id: string;
  c: string;
  icon: ComponentChildren;
  title: ComponentChildren;
  sub?: ComponentChildren;
  due?: boolean;
  go: () => void;
  /** Put away for this many days after today (0: until tomorrow). */
  keep?: number;
}

function Notice({ row, onHide }: { row: Row; onHide: () => void }) {
  return (
    <div class={row.due ? 'notice due' : 'notice'} style={{ '--c': row.c }}>
      <button class="notice-go" onClick={row.go}>
        <span class="notice-ico">{row.icon}</span>
        <span class="notice-main"><b>{row.title}</b>{row.sub && <small>{row.sub}</small>}</span>
        {row.due && <i class="notice-dot" aria-hidden="true" />}
      </button>
      <button class="notice-x" onClick={onHide} aria-label={t('Put away')} title={t('Put away')}><Icon name="x" size={14} /></button>
    </div>
  );
}

const ico = (name: UiName) => <Icon name={name} size={18} />;

function readHidden(): Record<string, string> {
  try {
    const v = JSON.parse(localStorage.getItem(HIDDEN) || '{}');
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  } catch {
    return {};
  }
}

/** Whether Spotify or GitHub could be connected here and isn't: asked once each time the app opens. */
let links: Promise<{ spotify: boolean; github: boolean }> | null = null;
const missingLinks = () => (links ??= Promise.all([
  import('../lib/spotify').then((m) => m.spotifyStatus()),
  import('../lib/github').then((m) => m.githubStatus()),
]).then(([s, g]) => ({ spotify: s.configured && !s.connected && !s.offline, github: g.configured && !g.connected && !g.offline }))
  .catch(() => ({ spotify: false, github: false })));

function useLinks() {
  const [v, setV] = useState({ spotify: false, github: false });
  useEffect(() => void missingLinks().then(setV), []);
  return v;
}

/** Today's law, principle or mind trap: kept from earlier today, else loaded once. */
function useLesson(day: string) {
  const [l, setL] = useState<Lesson | null>(() => keptLesson(day));
  useEffect(() => {
    if (l?.day === day) return;
    let on = true;
    lessonOf(day).then((x) => on && setL(x), () => {});
    return () => void (on = false);
  }, [day]);
  return l?.day === day ? l : null;
}

const LESSON_KIND = { law: t('Law of the day'), principle: t('Win friends, today'), trap: t('Mind trap of the day') };
const LESSON_ICON: Record<Lesson['kind'], UiName> = { law: 'crown', principle: 'heart-handshake', trap: 'brain' };

/**
 * Every line it can show, in the order they come (lines that need you then go first):
 * people's dates today or tomorrow · a check-in (how you slept, a run to keep, or a while without one) · today's song
 * · writing (days without a note, or the evening's) · a heavy few hours, a lighter day than yesterday, the week on a
 * Sunday evening · someone you haven't mentioned in weeks, or who's felt heavier lately · your song on this day years
 * ago, a song on repeat with no feelings yet · a book stalled, nearly done or finished without a rating · the countdown
 * ending or over · Twitch channels live, the miner gone quiet, a points milestone or best day · Spotify or GitHub not
 * connected, no home for the weather, sync failing, no backup in a while · the news after an update · today's lesson.
 */
export function Notices({ entries, picker, news }: { entries: Entry[]; picker: DayPick; news: News }) {
  const now = useNow(60_000);
  const songs = useSongs();
  const people = usePeople();
  const books = useBooks();
  const settings = useSettings();
  const sync = useSync();
  const cd = useCountdown();
  const { data: points } = usePoints();
  const missing = useLinks();
  const today = todayKey();
  const lesson = useLesson(today);
  const [hidden, setHidden] = useState(readHidden);
  const [all, setAll] = useState(false);
  const date = new Date(now);
  const hour = date.getHours();
  // no nudges through the night
  const awake = hour >= 8 && hour < 23;

  const todays = useMemo(() => entries.filter((e) => e.date === today), [entries, today]);
  const checkins = useMemo(() => entries.filter((e) => e.kind === 'checkin' && e.emotions.length).sort((a, b) => b.time - a.time), [entries]);
  const moments = useMemo(() => momentsByPerson(entries, people), [entries, people]);
  const rows: Row[] = [];

  /* people's dates */
  for (const u of upcoming(people, 1, date)) {
    const { what, years } = whatsComing(u);
    rows.push({
      id: `date:${u.person.id}:${keyOf(u.on)}:${u.date.kind}`, c: 'var(--emo-love-connection)', due: u.days === 0,
      icon: ico(u.date.kind === 'birthday' ? 'cake' : u.date.kind === 'anniversary' ? 'heart' : 'calendar-event'),
      title: what, sub: [whenLabel(u.days), years].filter(Boolean).join(' · '), go: () => navigate('person/' + u.person.id),
    });
  }

  /* checking in: one line at most */
  const last = checkins[0];
  const em = last ? EMOTION[last.emotions[0]] : null;
  const checkinC = em ? `var(--emo-${em.core})` : 'var(--emo-joy)';
  const checkedToday = todays.some((e) => e.kind === 'checkin');
  const ciRun = streakOf(new Set(checkins.map((e) => e.date)), today);
  if (awake && hour < 11 && !todays.length) {
    rows.push({ id: 'morning', c: 'var(--emo-calm-safety)', due: true, icon: ico('sunrise'), title: t('How did you sleep?'), sub: t('Start the day with a check-in'), go: () => navigate('tracker') });
  } else if (awake && hour >= 18 && !checkedToday && ciRun > 1) {
    rows.push({ id: 'checkin-run', c: checkinC, due: true, icon: ico('flame'), title: t('Check in to keep your {n}-day run', { n: ciRun }), sub: em ? t('Last felt {name}', { name: feltName(em.id) }) : undefined, go: () => navigate('tracker') });
  } else if (awake && (!last || now - last.time >= CHECKIN_AFTER)) {
    rows.push({ id: 'checkin', c: checkinC, due: true, icon: ico('mood-plus'), title: t('You haven’t checked in in a while'), sub: em ? t('Last felt {name}', { name: feltName(em.id) }) : t('How are you feeling?'), go: () => navigate('tracker') });
  }

  /* today's song, while it's still to pick */
  if (songs.length && awake && !songs.some((s) => s.days.includes(today))) {
    const run = streakOf(new Set(songs.flatMap((s) => s.days)), today);
    rows.push({
      id: 'song', c: 'var(--emo-sadness)', due: true, icon: ico('music'), title: t('Pick today’s song'),
      sub: run > 1 ? t('Keep your {n}-day run going', { n: run }) : t('The day doesn’t have a record yet'), go: () => picker.open(today),
    });
  }

  /* writing: days without a note, or else the evening's */
  const lastNote = entries.find((e) => e.kind === 'note');
  const gap = lastNote ? diffDays(lastNote.date, today) : 0;
  if (awake && gap >= 3) {
    rows.push({ id: 'quiet-journal', c: 'var(--emo-hope-interest)', due: true, icon: ico('writing'), title: t('Nothing written for {span}', { span: count(gap, 'day', 'days') }), sub: t('A few lines is enough'), go: () => navigate('note/new') });
  } else if (awake && hour >= 20 && !todays.some((e) => e.kind === 'note')) {
    const mood = dayMood(todays);
    const n = todays.filter((e) => e.kind === 'checkin').length;
    rows.push({
      id: 'evening', c: mood ? `var(--emo-${mood.worlds[0]})` : 'var(--emo-calm-safety)', due: true, icon: ico('pencil'), title: t('Write about today'),
      sub: [mood?.word, n ? count(n, 'check-in', 'check-ins') : t('A few lines before the day ends')].filter(Boolean).join(' · '), go: () => navigate('note/new'),
    });
  }

  /* how it's been going */
  const lastThree = checkins.slice(0, 3);
  if (lastThree.length === 3 && now - lastThree[2].time < 12 * 3600_000 && !lastThree.some(pleasant)) {
    rows.push({ id: 'heavy:' + lastThree[0].id, c: `var(--emo-${coreOf(lastThree[0].emotions[0]).id})`, icon: ico('cloud-rain'), title: t('A heavy few hours'), sub: t('Want to write it out?'), go: () => navigate('note/new') });
  }
  const yesterday = addDays(today, -1);
  const wNow = warmth(todays), wBefore = warmth(entries.filter((e) => e.date === yesterday));
  if (wNow !== null && wBefore !== null && wNow - wBefore >= 0.3) {
    rows.push({ id: 'brighter', c: 'var(--emo-joy)', icon: ico('sun'), title: t('Lighter than yesterday'), sub: dayMood(todays)?.word, go: () => navigate('stats') });
  }
  if (date.getDay() === 0 && hour >= 17) {
    const week = entries.filter((e) => e.date > addDays(today, -7));
    const mood = dayMood(week);
    const n = week.filter((e) => e.kind === 'checkin').length;
    if (mood) {
      rows.push({
        id: 'week', c: `var(--emo-${mood.worlds[0]})`, icon: ico('chart-donut-2'), title: t('Your week: mostly {world}', { world: shortName(mood.worlds[0]).toLowerCase() }),
        sub: [count(n, 'check-in', 'check-ins'), count(week.length - n, 'note', 'notes')].join(' · '), go: () => navigate('stats'),
      });
    }
  }

  /* people: the most present of those you haven't mentioned lately, and of those it's felt heavier with */
  const regulars = people.filter((p) => (moments.get(p.id)?.length ?? 0) >= 5).sort((a, b) => moments.get(b.id)!.length - moments.get(a.id)!.length);
  const missed = regulars.find((p) => diffDays(moments.get(p.id)![0].date, today) >= 21);
  if (missed) {
    const weeks = Math.floor(diffDays(moments.get(missed.id)![0].date, today) / 7);
    rows.push({ id: 'missed:' + missed.id, keep: 7, c: 'var(--emo-love-connection)', icon: ico('user'), title: t('Nothing about {name} in {span}', { name: firstName(missed.name), span: count(weeks, 'week', 'weeks') }), sub: t('Still on your mind?'), go: () => navigate('person/' + missed.id) });
  }
  const heavier = regulars.find((p) => trendOf(monthsOf(moments.get(p.id)!, 12, date)) === 'heavier');
  if (heavier) {
    rows.push({ id: `heavier:${heavier.id}:${today.slice(0, 7)}`, keep: 30, c: 'var(--emo-sadness)', icon: ico('trending-up'), title: t('Things with {name} have felt heavier lately', { name: firstName(heavier.name) }), sub: t('The last three months, against the ones before'), go: () => navigate('person/' + heavier.id) });
  }

  /* music */
  let ago: { s: (typeof songs)[number]; d: string } | null = null;
  for (const s of songs) for (const d of s.days) if (d < today && d.slice(5) === today.slice(5) && (!ago || d > ago.d)) ago = { s, d };
  if (ago) {
    const { s, d } = ago;
    rows.push({ id: 'song-ago', c: 'var(--emo-sadness)', icon: ico('vinyl'), title: t('Your song on this day'), sub: `${s.music.title} · ${t('{span} ago', { span: count(+today.slice(0, 4) - +d.slice(0, 4), 'year', 'years') })}`, go: () => navigate('song/' + s.id) });
  }
  const unfelt = songs.find((s) => s.repeat && !s.emotions.length);
  if (unfelt) {
    rows.push({ id: 'song-feel:' + unfelt.id, keep: 7, c: 'var(--emo-sadness)', icon: ico('repeat'), title: t('How does {title} make you feel?', { title: unfelt.music.title }), sub: t('It’s on repeat, but has no feelings yet'), go: () => navigate('song/' + unfelt.id) });
  }

  /* books */
  const reading = books.filter((b) => b.status === 'reading');
  const stalled = reading.filter((b) => now - b.updated >= 14 * DAY).sort((a, b) => a.updated - b.updated)[0];
  if (stalled) {
    const span = count(Math.floor((now - stalled.updated) / (7 * DAY)), 'week', 'weeks');
    rows.push({ id: 'stalled:' + stalled.id, keep: 7, c: 'var(--emo-calm-safety)', icon: ico('book'), title: t('Still reading {title}?', { title: stalled.title }), sub: stalled.page ? t('Page {p}, untouched for {span}', { p: stalled.page, span }) : t('Untouched for {span}', { span }), go: () => navigate('book/' + stalled.id) });
  }
  for (const b of reading) {
    const left = b.pages && b.page ? b.pages - b.page : 0;
    if (left > 0 && left <= 50) rows.push({ id: 'nearly:' + b.id, keep: 3, c: 'var(--emo-calm-safety)', icon: ico('bookmark'), title: t('{span} left of {title}', { span: count(left, 'page', 'pages'), title: b.title }), sub: t('Almost there'), go: () => navigate('book/' + b.id) });
  }
  const unrated = books.find((b) => b.status === 'read' && !b.rating && b.finished && diffDays(b.finished, today) <= 60);
  if (unrated) {
    rows.push({ id: 'rate:' + unrated.id, keep: 7, c: 'var(--emo-joy)', icon: ico('star'), title: t('Rate {title}', { title: unrated.title }), sub: t('And say how it left you'), go: () => navigate('book/' + unrated.id) });
  }

  /* the countdown */
  if (cd) {
    const end = keyOf(new Date(cd.end));
    const name = cd.name || t('Countdown');
    const until = diffDays(today, end);
    if (cd.end > now && until <= 1) {
      rows.push({ id: 'cd-soon:' + cd.end, c: 'var(--emo-hope-interest)', icon: ico('hourglass'), title: until ? t('{name} is tomorrow', { name }) : t('{name} is today', { name }), sub: t('The countdown’s nearly done'), go: () => navigate('countdown') });
    } else if (cd.end <= now && now - cd.end < 3 * DAY) {
      rows.push({ id: 'cd-over:' + cd.end, keep: 3, c: 'var(--emo-hope-interest)', icon: ico('hourglass'), title: t('{name} is over', { name }), sub: t('Write about how it went?'), go: () => navigate('note/new') });
    }
  }

  /* Twitch */
  if (points) {
    for (const ch of points.channels.filter((c) => c.live)) {
      rows.push({ id: 'live:' + ch.name, c: 'var(--emo-fear)', icon: <><Icon name="brand-twitch" size={18} /><i class="notice-live" aria-hidden="true" /></>, title: t('{name} is live', { name: ch.name }), sub: t('{n} channel points today', { n: signed(ch.change.day) }), go: () => navigate('twitch') });
    }
    const newest = Math.max(0, ...points.channels.map((c) => c.lastAt));
    const quiet = Math.floor((points.now - newest) / 3600_000);
    if (newest && quiet >= 12 && points.mining?.length !== 0) {
      rows.push({ id: 'miner', c: 'var(--emo-fear)', due: true, icon: ico('alert-circle'), title: t('The miner hasn’t earned in {span}', { span: count(quiet, 'hour', 'hours') }), sub: t('Check it’s still running'), go: () => navigate('twitch') });
    }
    const passed = [...MILESTONES].reverse().find((m) => points.total >= m && points.total - points.change.day < m);
    if (passed) {
      rows.push({ id: 'points:' + passed, keep: 30, c: 'var(--emo-fear)', icon: ico('trophy'), title: t('You passed {n} channel points', { n: passed.toLocaleString(LOCALE) }), sub: t('{n} in all', { n: points.total.toLocaleString(LOCALE) }), go: () => navigate('twitch') });
    }
    const daily = points.daily.slice(-31);
    const gains: number[] = [];
    for (let i = 1; i < daily.length - 1; i++) if (daily[i] !== null && daily[i - 1] !== null) gains.push(daily[i]! - daily[i - 1]!);
    if (gains.length >= 7 && points.change.day > 0 && points.change.day > Math.max(...gains)) {
      rows.push({ id: 'points-best', c: 'var(--emo-fear)', icon: ico('coins'), title: t('{n} channel points today', { n: signed(points.change.day) }), sub: t('Your best day this month'), go: () => navigate('twitch') });
    }
  }

  /* setting things up and keeping them safe */
  if (missing.spotify) rows.push({ id: 'link:spotify', keep: 7, c: 'var(--emo-calm-safety)', icon: ico('brand-spotify'), title: t('Spotify isn’t connected'), sub: t('Search and Now playing need it'), go: () => navigate('settings') });
  if (missing.github) rows.push({ id: 'link:github', keep: 7, c: 'var(--emo-calm-safety)', icon: ico('brand-github'), title: t('GitHub isn’t connected'), sub: t('Your repos can’t update without it'), go: () => navigate('settings') });
  if (!settings.home) rows.push({ id: 'home', keep: 30, c: 'var(--emo-calm-safety)', icon: ico('home'), title: t('Set your home'), sub: t('So your check-ins get the weather'), go: () => navigate('settings') });
  if (sync.on && !sync.busy && (sync.error || (sync.last && now - sync.last > 2 * DAY))) {
    rows.push({ id: 'sync', keep: 1, c: 'var(--emo-fear)', due: true, icon: ico('refresh'), title: sync.error ? t('Sync isn’t working') : t('Not synced for {span}', { span: count(Math.floor((now - sync.last) / DAY), 'day', 'days') }), sub: sync.error || t('Open Settings to check on it'), go: () => navigate('settings') });
  }
  const backup = lastExport();
  if (entries.length >= 20 && now - backup > 60 * DAY) {
    rows.push({ id: 'backup', keep: 30, c: 'var(--emo-calm-safety)', icon: ico('download'), title: t('Back up your journal'), sub: backup ? t('Last backup {date}', { date: shortDate(keyOf(new Date(backup))) }) : t('You haven’t saved a backup yet'), go: () => navigate('settings') });
  }

  /* news, and something to learn */
  if (news.latest) rows.push({ id: 'news:' + news.latest.version, c: 'var(--emo-hope-interest)', icon: ico('sparkles'), title: t('Updated to {v}', { v: news.latest.version }), sub: news.latest.changes[0], go: news.show });
  if (lesson) rows.push({ id: 'lesson', c: 'var(--emo-hope-interest)', icon: ico(LESSON_ICON[lesson.kind]), title: lesson.title, sub: `${LESSON_KIND[lesson.kind]} · ${lesson.line}`, go: () => navigate(lesson.to) });

  const hide = (r: Row) => {
    const next: Record<string, string> = {};
    for (const [k, v] of Object.entries(hidden)) if (v >= today) next[k] = v;
    next[r.id] = addDays(today, r.keep ?? 0);
    try { localStorage.setItem(HIDDEN, JSON.stringify(next)); } catch {}
    setHidden(next);
  };

  // what needs you first; the order otherwise stays put
  const shown = rows.filter((r) => !(hidden[r.id] >= today)).sort((a, b) => +!!b.due - +!!a.due);
  if (!shown.length) return null;
  const more = shown.length - FIRST;
  return (
    <div class="notices card fade-arrive">
      {(all ? shown : shown.slice(0, FIRST)).map((r) => <div key={r.id} class="notice-slot"><Notice row={r} onHide={() => hide(r)} /></div>)}
      {more > 0 && (
        <button class="notice-more" aria-expanded={all} onClick={() => setAll(!all)}>
          {all ? t('Show less') : t('{n} more', { n: more })}
          <Icon name={all ? 'chevron-up' : 'chevron-down'} size={14} />
        </button>
      )}
    </div>
  );
}
