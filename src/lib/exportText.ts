// A plain-text copy of what's written in the app, for reading or for handing to an AI chat: all of it, or just some days
// and some parts. Only reads what's already loaded: it never writes to the database, and it isn't a backup (Import can't read it).
import { EMOTION, coreOf, valence, type EmotionDef } from '../data/emotions';
import { weatherName } from '../data/weather';
import { STATUS_LABEL, MENTION, resolveMention } from './books';
import { bodyOf, dropImageLinks, type Item, type Media } from './body';
import { dropTags } from './inline';
import { KIND_LABEL } from './spotify';
import { noteLabel, resolveNote } from './links';
import { refTarget } from './refs';
import { PERSON, SONG, resolvePerson, resolveSong } from './mentions';
import { dateName, peopleIn } from './people';
import { addDays, diffDays, formatDate, keyOf, parseKey, startOfWeek, todayKey } from './dates';
import { moodOf } from './stats';
import { getBooks, getEntries, getPeople, getRepos, getSongs, type Book, type Entry, type Music, type Person, type Repo, type Song } from './store';
import { LOCALE, count, listOf, t } from './i18n';

const longDate = (k: string) =>
  new Date(k + 'T12:00').toLocaleDateString(LOCALE, { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
const clock = (time: number) => new Date(time).toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' });

/** "Joy › Excitement › Playful" */
function feeling(id: string) {
  const names: string[] = [];
  for (let e: EmotionDef | undefined = EMOTION[id]; e; e = e.parent ? EMOTION[e.parent] : undefined) names.unshift(e.name);
  return names.join(' › ') || id;
}
const feelings = (ids: string[]) => ids.map(feeling).join('; ');

/** Tags read as words: a book as its title, someone as their name, music as its title and who it's by, a linked note as its title and day. */
function mentions(text: string, books: Book[]) {
  const people = getPeople();
  const songs = getSongs();
  const entries = getEntries();
  return text
    .replace(MENTION, (_, target: string | undefined, label: string) => {
      const ref = refTarget(target);
      if (ref)
        return ref.kind === 'trap' ? t('“{title}” (mind trap)', { title: label })
          : ref.kind === 'law' ? t('“{title}” (law of power {n})', { title: label, n: ref.id })
          : t('“{title}” (Win friends principle {n})', { title: label, n: ref.id });
      const n = target?.startsWith('note:') || !resolveMention(target, label, books) ? resolveNote(target, label, entries, books) : undefined;
      if (n) return t('“{title}” (note, {date})', { title: noteLabel(n), date: longDate(n.date) });
      const b = resolveMention(target, label, books);
      return b ? t('“{title}” (book)', { title: b.title }) : label;
    })
    .replace(PERSON, (_, target: string | undefined, name: string) => resolvePerson(target, name, people)?.name || name)
    .replace(SONG, (_, target: string | undefined, title: string) => {
      const s = resolveSong(target, title, songs);
      return s ? music(s.music) : title;
    });
}

function picture(it: Item, e: Entry) {
  if (it.kind === 'photo') return t('Photo');
  const img = e.images.find((i) => i.url === it.url);
  return img?.title ? t('Image: {title}', { title: img.title }) : t('Image');
}
const media = (m: Media, e: Entry) =>
  (m.kind === 'album' ? `[${t('Album: {items}', { items: m.items.map((it) => picture(it, e)).join(', ') })}]` : `[${picture(m, e)}]`)
  // what the picture's caption says (or, without one, its alt text)
  + (m.caption ? ` ${m.caption}` : m.alt ? ` (${m.alt})` : '');

/** The note's words with a short placeholder (and caption, when there is one) where each picture sat, if pictures are wanted. */
function body(e: Entry, books: Book[], pictures: boolean) {
  const b = bodyOf({ ...e, text: dropImageLinks(e.text, e.images) });
  const parts: string[] = [];
  b.texts.forEach((text, i) => {
    // the Markdown stays (an AI chat reads it), the tags of underline and colours go
    if (text.trim()) parts.push(mentions(dropTags(text.trim()), books));
    if (pictures && b.media[i]) parts.push(media(b.media[i], e));
  });
  return parts.join('\n\n');
}

const music = (m: Music) => `“${m.title}”${m.sub ? ' ' + t('by {authors}', { authors: m.sub }) : ''} (${KIND_LABEL[m.kind].toLowerCase()})`;

function entry(e: Entry, people: Map<string, Person>, books: Book[], has: (d: ExportDetail) => boolean) {
  const when = e.dateEnd && e.dateEnd !== e.date ? `${longDate(e.date)} – ${longDate(e.dateEnd)}` : `${longDate(e.date)}, ${clock(e.time)}`;
  const kind = e.kind === 'checkin' ? t('Check-in') : t('Note');
  const lines = [`### ${when} · ${kind}${e.title.trim() ? ` · ${e.title.trim()}` : ''}`];
  if (has('feelings') && e.emotions.length) lines.push(`- ${t('Feelings')}: ${feelings(e.emotions)}${e.kind === 'checkin' ? ` (${t('intensity {n}/5', { n: e.intensity })})` : ''}`);
  const who = e.people.map((id) => people.get(id)?.name).filter(Boolean);
  if (has('people') && who.length) lines.push(`- ${t('Thinking of')}: ${who.join(', ')}`);
  if (has('place') && e.place?.name) lines.push(`- ${t('Place')}: ${e.place.name}`);
  if (has('weather') && e.weather && e.weather.day === e.date)
    lines.push(`- ${t('Weather')}: ${weatherName(e.weather.code)}, ${Math.round(e.weather.temp)}°C, ${t('{hours} of daylight', { hours: e.weather.daylight.toFixed(1) + ' h' })}${e.weather.dark ? ', ' + t('after dark') : ''}`);
  if (has('music') && e.music.length) lines.push(`- ${t('Music')}: ${e.music.map(music).join('; ')}`);
  if (has('pictures') && e.cover) lines.push(`- ${t('Cover')}: [${'photo' in e.cover ? t('Photo') : e.cover.image.title ? t('Image: {title}', { title: e.cover.image.title }) : t('Image')}]`);
  const text = body(e, books, has('pictures'));
  if (text) lines.push('', text);
  return lines.join('\n');
}

function person(p: Person, moments: number, books: Book[]) {
  const lines = [`### ${p.name || t('Unnamed')}${p.relation.trim() ? ` · ${p.relation.trim()}` : ''}`];
  if (p.emotions.length) lines.push(`- ${t('How they make me feel')}: ${feelings(p.emotions)}`);
  if (p.theme) lines.push(`- ${t('Theme song')}: ${p.theme.title}${p.theme.sub ? ` · ${p.theme.sub}` : ''}`);
  for (const d of p.dates) {
    const [m, day] = d.md.split('-').map(Number);
    lines.push(`- ${dateName(d)}: ${new Date(2000, m - 1, day).toLocaleDateString(LOCALE, { day: 'numeric', month: 'long' })}${d.year ? ' ' + d.year : ''}`);
  }
  lines.push(`- ${t('Tagged in {count}', { count: count(moments, 'entry', 'entries') })}`);
  if (p.text.trim()) lines.push('', mentions(p.text.trim(), books));
  return lines.join('\n');
}

function book(b: Book, people: Map<string, Person>, books: Book[]) {
  const lines = [`### ${b.title}${b.authors ? ` · ${b.authors}` : ''}${b.year ? ` (${b.year})` : ''}`];
  lines.push(`- ${t('Status')}: ${STATUS_LABEL[b.status]}${b.rating ? ' · ' + t('rated {n}/5', { n: b.rating }) : ''}`);
  if (b.started || b.finished) lines.push(`- ${[b.started && t('Started {date}', { date: longDate(b.started) }), b.finished && t('finished {date}', { date: longDate(b.finished) })].filter(Boolean).join(', ')}`);
  if (b.status === 'reading' && b.page !== null) lines.push(`- ${b.pages ? t('On page {page} of {pages}', { page: b.page, pages: b.pages }) : t('On page {page}', { page: b.page })}`);
  if (b.emotions.length) lines.push(`- ${t('How it made me feel')}: ${feelings(b.emotions)}`);
  const from = b.from ? people.get(b.from)?.name : null;
  if (from) lines.push(`- ${t('Thinking of')}: ${from}`);
  if (b.text.trim()) lines.push('', mentions(b.text.trim(), books));
  return lines.join('\n');
}

function song(s: Song, people: Map<string, Person>, books: Book[]) {
  const m = s.music;
  const lines = [`### ${m.title}${m.sub ? ` · ${m.sub}` : ''} (${KIND_LABEL[m.kind].toLowerCase()})`];
  const facts = [s.rating ? t('rated {n}/5', { n: s.rating }) : '', s.repeat ? t('on repeat lately') : ''].filter(Boolean);
  if (facts.length) lines.push(`- ${facts.join(' · ')}`);
  if (s.emotions.length) lines.push(`- ${t('How it makes me feel')}: ${feelings(s.emotions)}`);
  const from = s.from ? people.get(s.from)?.name : null;
  if (from) lines.push(`- ${t('Thinking of')}: ${from}`);
  if (s.text.trim()) lines.push('', mentions(s.text.trim(), books));
  return lines.join('\n');
}

function repo(r: Repo) {
  const lines = [`### ${r.name}`];
  const facts = [r.private ? t('private') : t('public'), r.language, r.rating ? t('rated {n}/5', { n: r.rating }) : ''].filter(Boolean);
  lines.push(`- ${facts.join(' · ')}`);
  if (r.description) lines.push(`- ${r.description}`);
  if (r.emotions.length) lines.push(`- ${t('How it makes me feel')}: ${feelings(r.emotions)}`);
  if (r.url) lines.push(`- ${r.url}`);
  if (r.text.trim()) lines.push('', r.text.trim());
  return lines.join('\n');
}

/* ---------- what goes in ---------- */

export type ExportPart = 'overview' | 'notes' | 'checkins' | 'people' | 'books' | 'music' | 'repos';
/** What each note and check-in shows besides its words. */
export type ExportDetail = 'feelings' | 'people' | 'place' | 'weather' | 'music' | 'pictures';
export const EXPORT_PARTS: ExportPart[] = ['overview', 'notes', 'checkins', 'people', 'books', 'music', 'repos'];
export const EXPORT_DETAILS: ExportDetail[] = ['feelings', 'people', 'place', 'weather', 'music', 'pictures'];

export interface ExportOptions {
  from: string | null;      // first day, 'YYYY-MM-DD'; null from the very first entry
  to: string | null;        // last day; null up to today
  parts: ExportPart[];
  details: ExportDetail[];
  linked: boolean;          // with days chosen: only the people, books, music and repos that belong to them
  ask: boolean;             // open with a request for the AI to read it and say what it sees
  newest: boolean;          // the journal newest first instead of oldest first
}

export const EXPORT_DEFAULT: ExportOptions = { from: null, to: null, parts: EXPORT_PARTS, details: EXPORT_DETAILS, linked: true, ask: true, newest: false };

const overlaps = (e: Entry, from: string, to: string) => e.date <= to && (e.dateEnd ?? e.date) >= from;
const byDate = (a: Entry, b: Entry) => (a.date === b.date ? a.time - b.time : a.date < b.date ? -1 : 1);
const dayOf = (ms: number) => keyOf(new Date(ms));
/** Everyone tagged in a note: under Thinking of, or in its words. */
const taggedIn = (e: Entry, people: Person[]) => new Set([...e.people, ...peopleIn(e.text, people)]);

/** What a choice of days takes in: its notes and check-ins in date order, and the people, books, music and repos that go with them. */
export function exportScope(o: Pick<ExportOptions, 'from' | 'to' | 'linked'>) {
  const all = getEntries();
  const today = todayKey();
  const from = o.from ?? all.reduce((first, e) => (e.date < first ? e.date : first), today);
  const to = o.to ?? today;
  const ranged = o.from !== null || o.to !== null;
  const entries = all.filter((e) => overlaps(e, from, to)).sort(byDate);
  let people = getPeople();
  let books = getBooks();
  let songs = getSongs();
  let repos = getRepos();
  if (ranged && o.linked) {
    const tagged = new Set<string>(), named = new Set<string>(), played = new Set<string>(), attached = new Set<string>();
    for (const e of entries) {
      for (const id of taggedIn(e, people)) tagged.add(id);
      for (const m of e.text.matchAll(MENTION)) { const b = resolveMention(m[1], m[2], books); if (b) named.add(b.id); }
      for (const m of e.text.matchAll(SONG)) { const s = resolveSong(m[1], m[2], songs); if (s) played.add(s.id); }
      for (const m of e.music) attached.add(m.id);
    }
    const inDays = (k: string | null) => !!k && k >= from && k <= to;
    /** Whether the time it was being read overlaps the days. */
    const reading = (b: Book) => {
      const start = b.started ?? b.finished;
      const end = b.finished ?? (b.status === 'reading' ? today : start);
      return !!start && !!end && start <= to && end >= from;
    };
    people = people.filter((p) => tagged.has(p.id));
    books = books.filter((b) => named.has(b.id) || reading(b));
    songs = songs.filter((s) => played.has(s.id) || attached.has(s.music.id) || s.days.some(inDays));
    repos = repos.filter((r) => inDays(dayOf(r.created)) || inDays(dayOf(r.updated)));
  }
  return { from, to, ranged, entries, people, books, songs, repos };
}

/* ---------- the overview ---------- */

const top = <K>(m: Map<K, number>, n: number) => [...m].sort((a, b) => b[1] - a[1]).slice(0, n);
const inc = <K>(m: Map<K, number>, k: K) => m.set(k, (m.get(k) ?? 0) + 1);
const percent = (n: number, of: number) => Math.round((n / of) * 100);
const signed = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(n).toFixed(1);
const mean = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;

/** How these entries feel, added up, so the AI doesn't have to count. */
function feelingStats(list: Entry[]) {
  const lines: string[] = [];
  const ids = list.flatMap((e) => e.emotions);
  if (ids.length) {
    const pleasant = ids.filter((id) => valence(id) > 0).length;
    lines.push(`- ${t('Feelings named')}: ${ids.length} · ${t('{a}% pleasant, {b}% unpleasant', { a: percent(pleasant, ids.length), b: 100 - percent(pleasant, ids.length) })}`);
    const worlds = new Map<string, number>();
    for (const id of ids) inc(worlds, coreOf(id)?.name ?? id);
    lines.push(`- ${t('By world')}: ${top(worlds, 8).map(([name, n]) => `${name} ${percent(n, ids.length)}%`).join(' · ')}`);
    const named = new Map<string, number>();
    for (const id of ids) inc(named, id);
    lines.push(`- ${t('Most named feelings')}: ${top(named, 10).map(([id, n]) => `${feeling(id)} (${n})`).join('; ')}`);
  }
  const checkins = list.filter((e) => e.kind === 'checkin');
  if (checkins.length) lines.push(`- ${t('Average check-in intensity')}: ${mean(checkins.map((e) => e.intensity)).toFixed(1)}/5`);
  const moods = list.map(moodOf).filter((m): m is number => m !== null);
  if (moods.length) lines.push(`- ${t('Average mood')}: ${signed(mean(moods))} ${t('(from −5, intensely unpleasant, to +5, intensely pleasant)')}`);
  return lines;
}

/** One line per day, week or month of the period, quiet ones too, so changes over time are easy to see. */
function timeline(list: Entry[], from: string, to: string) {
  const span = diffDays(from, to) + 1;
  const unit = span > 92 ? 'month' : span > 14 ? 'week' : 'day';
  const keyOfDay = (k: string) => (unit === 'month' ? k.slice(0, 7) : unit === 'week' ? startOfWeek(k, 1) : k);
  const groups = new Map<string, Entry[]>();
  for (const e of list) {
    const k = keyOfDay(e.date < from ? from : e.date);
    const g = groups.get(k);
    if (g) g.push(e);
    else groups.set(k, [e]);
  }
  const lines = ['', `### ${unit === 'month' ? t('Month by month') : unit === 'week' ? t('Week by week') : t('Day by day')}`, ''];
  const label = (k: string) =>
    unit === 'month' ? formatDate(parseKey(k + '-01'), { month: 'long', year: 'numeric' })
      : unit === 'week' ? t('Week of {date}', { date: formatDate(parseKey(k), { day: 'numeric', month: 'short', year: 'numeric' }) })
        : longDate(k);
  for (let k = keyOfDay(from); k <= keyOfDay(to); k = unit === 'month' ? keyOfDay(addDays(k + '-28', 7)) : addDays(k, unit === 'week' ? 7 : 1)) {
    const g = groups.get(k) ?? [];
    if (!g.length) { lines.push(`- ${label(k)}: ${t('nothing written')}`); continue; }
    const facts = [count(g.length, 'entry', 'entries')];
    const moods = g.map(moodOf).filter((m): m is number => m !== null);
    if (moods.length) facts.push(t('mood {n}', { n: signed(mean(moods)) }));
    const worlds = new Map<string, number>();
    for (const id of g.flatMap((e) => e.emotions)) inc(worlds, coreOf(id)?.name ?? id);
    const lead = top(worlds, 2).map(([name]) => name);
    if (lead.length) facts.push(t('mostly {feelings}', { feelings: lead.join(', ') }));
    lines.push(`- ${label(k)}: ${facts.join(' · ')}`);
  }
  return lines;
}

function overview(list: Entry[], from: string, to: string, people: Person[]) {
  const span = diffDays(from, to) + 1;
  const out = [`## ${t('Overview')}`, '', `- ${t('Period')}: ${longDate(from)} – ${longDate(to)} (${count(span, 'day', 'days')})`];
  if (!list.length) return [...out, `- ${t('Nothing written in these days')}`];
  const notes = list.filter((e) => e.kind === 'note').length;
  out.push(`- ${t('Entries')}: ${listOf([count(list.length - notes, 'check-in', 'check-ins'), count(notes, 'note', 'notes')])}`);
  out.push(`- ${t('Written on {days} of {span}', { days: new Set(list.map((e) => (e.date < from ? from : e.date))).size, span: count(span, 'day', 'days') })}`);
  out.push(...feelingStats(list));
  const names = new Map(people.map((p) => [p.id, p.name]));
  const met = new Map<string, number>();
  for (const e of list) for (const id of taggedIn(e, people)) if (names.get(id)) inc(met, names.get(id)!);
  if (met.size) out.push(`- ${t('Most present people')}: ${top(met, 10).map(([name, n]) => `${name} (${n})`).join(', ')}`);
  const places = new Map<string, number>();
  for (const e of list) if (e.place?.name) inc(places, e.place.name);
  if (places.size) out.push(`- ${t('Places')}: ${top(places, 8).map(([name, n]) => `${name} (${n})`).join(', ')}`);
  out.push(...timeline(list, from, to));
  return out;
}

/** What to ask for, so pasting the file into a chat is all it takes. */
const ASK = () => [
  `## ${t('What I’d like from you')}`,
  '',
  t('Read this as a thoughtful friend with a counsellor’s eye, then:'),
  `1. ${t('Sum up how I’ve been in a few sentences.')}`,
  `2. ${t('Name the patterns in my feelings: what tends to lift me and what tends to weigh on me (people, places, times, weather, what I was doing).')}`,
  `3. ${t('Point out what changed over this time, with dates.')}`,
  `4. ${t('Note what I keep coming back to, and what I seem to avoid.')}`,
  `5. ${t('Suggest two or three small, concrete things to try.')}`,
  '',
  t('Quote my own words and dates as evidence, say when something is only a guess, and be honest but kind.'),
];

/** Markdown: a request for the AI, an overview, people, books, music, repos, then the journal. No images are included, only placeholders and captions. */
export function exportText(o: ExportOptions = EXPORT_DEFAULT) {
  const scope = exportScope(o);
  const has = (p: ExportPart) => o.parts.includes(p);
  const shows = (d: ExportDetail) => o.details.includes(d);
  const allPeople = getPeople();
  const allBooks = getBooks();
  const byId = new Map(allPeople.map((p) => [p.id, p]));
  const kinds = scope.entries.filter((e) => has(e.kind === 'checkin' ? 'checkins' : 'notes'));
  const journal = o.newest ? [...kinds].reverse() : kinds;
  const counts = new Map<string, number>();
  for (const e of scope.entries) for (const id of taggedIn(e, allPeople)) inc(counts, id);

  const holds = [
    has('overview') && t('an overview of my feelings'),
    has('people') && scope.people.length && t('the people in my life'),
    has('books') && scope.books.length && t('the books I read'),
    has('music') && scope.songs.length && t('the music I keep'),
    has('repos') && scope.repos.length && t('the repos I work on'),
    has('notes') && has('checkins') ? t('my notes and check-ins') : has('notes') ? t('my notes') : has('checkins') && t('my check-ins'),
  ].filter((x): x is string => !!x);
  const intro = [
    t('Exported {date}.', { date: longDate(todayKey()) }),
    t('It covers {from} to {to}.', { from: longDate(scope.from), to: longDate(scope.to) }),
    holds.length && t('This is my personal journal, with {list}.', { list: listOf(holds) }),
    (has('notes') || has('checkins')) && (o.newest ? t('The journal runs newest first.') : t('The journal runs oldest first.')),
    scope.ranged && o.linked && (has('people') || has('books') || has('music') || has('repos')) && t('People, books, music and repos are only the ones tied to these days.'),
    t('Feelings are named on an emotion wheel as Core › Family › Feeling.'),
    shows('pictures') && t('Pictures aren’t included; [{photo}] and [{image}: …] mark where they were.', { photo: t('Photo'), image: t('Image') }),
  ].filter((x): x is string => !!x);

  const out = ['# ' + t('My Mind: journal export'), '', intro.join(' ')];
  if (o.ask) out.push('', ...ASK());
  if (has('overview')) out.push('', ...overview(has('notes') || has('checkins') ? kinds : scope.entries, scope.from, scope.to, allPeople));
  if (has('people') && scope.people.length) {
    out.push('', `## ${t('People')} (${scope.people.length})`);
    [...scope.people].sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0)).forEach((p) => out.push('', person(p, counts.get(p.id) ?? 0, allBooks)));
  }
  if (has('books') && scope.books.length) {
    out.push('', `## ${t('Books')} (${scope.books.length})`);
    scope.books.forEach((b) => out.push('', book(b, byId, allBooks)));
  }
  if (has('music') && scope.songs.length) {
    out.push('', `## ${t('Music')} (${scope.songs.length})`);
    scope.songs.forEach((s) => out.push('', song(s, byId, allBooks)));
  }
  if (has('repos') && scope.repos.length) {
    out.push('', `## ${t('Repos')} (${scope.repos.length})`);
    scope.repos.forEach((r) => out.push('', repo(r)));
  }
  if (has('notes') || has('checkins')) {
    out.push('', `## ${t('Journal')} (${count(journal.length, 'entry', 'entries')})`);
    if (!journal.length) out.push('', t('Nothing written in these days'));
    journal.forEach((e) => out.push('', entry(e, byId, allBooks, shows)));
  }
  return out.join('\n') + '\n';
}
