// A plain-text copy of everything written in the app, for reading or for handing to an AI chat.
// Only reads what's already loaded: it never writes to the database, and it isn't a backup (Import can't read it).
import { EMOTION, type EmotionDef } from '../data/emotions';
import { weatherName } from '../data/weather';
import { STATUS_LABEL, MENTION, resolveMention } from './books';
import { bodyOf, dropImageLinks, type Item, type Media } from './body';
import { KIND_LABEL } from './spotify';
import { noteLabel, resolveNote } from './links';
import { PERSON, SONG, resolvePerson, resolveSong } from './mentions';
import { dateName, peopleIn } from './people';
import { todayKey } from './dates';
import { getBooks, getEntries, getPeople, getSongs, type Book, type Entry, type Person, type Song } from './store';

const LOCALE = 'en-GB';
const longDate = (k: string) =>
  new Date(k + 'T12:00').toLocaleDateString(LOCALE, { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' });
const clock = (t: number) => new Date(t).toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' });

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
      const n = target?.startsWith('note:') || !resolveMention(target, label, books) ? resolveNote(target, label, entries, books) : undefined;
      if (n) return `“${noteLabel(n)}” (note, ${longDate(n.date)})`;
      const b = resolveMention(target, label, books);
      return b ? `“${b.title}” (book)` : label;
    })
    .replace(PERSON, (_, target: string | undefined, name: string) => resolvePerson(target, name, people)?.name || name)
    .replace(SONG, (_, target: string | undefined, title: string) => {
      const s = resolveSong(target, title, songs);
      return s ? `“${s.music.title}”${s.music.sub ? ` by ${s.music.sub}` : ''} (${s.music.kind === 'track' ? 'song' : s.music.kind})` : title;
    });
}

function picture(it: Item, e: Entry) {
  if (it.kind === 'photo') return 'Photo';
  const img = e.images.find((i) => i.url === it.url);
  return img?.title ? `Image: ${img.title}` : 'Image';
}
const media = (m: Media, e: Entry) =>
  m.kind === 'album' ? `[Album: ${m.items.map((it) => picture(it, e)).join(', ')}]` : `[${picture(m, e)}]`;

/** The note's words with a short placeholder (and caption, when there is one) where each picture sat. */
function body(e: Entry, books: Book[]) {
  const b = bodyOf({ ...e, text: dropImageLinks(e.text, e.images) });
  const parts: string[] = [];
  b.texts.forEach((t, i) => {
    if (t.trim()) parts.push(mentions(t.trim(), books));
    if (b.media[i]) parts.push(media(b.media[i], e));
  });
  return parts.join('\n\n');
}

function entry(e: Entry, people: Map<string, Person>, books: Book[]) {
  const when = e.dateEnd && e.dateEnd !== e.date ? `${longDate(e.date)} – ${longDate(e.dateEnd)}` : `${longDate(e.date)}, ${clock(e.time)}`;
  const kind = e.kind === 'checkin' ? 'Check-in' : 'Note';
  const lines = [`### ${when} · ${kind}${e.title.trim() ? ` · ${e.title.trim()}` : ''}`];
  if (e.emotions.length) lines.push(`- Feelings: ${feelings(e.emotions)}${e.kind === 'checkin' ? ` (intensity ${e.intensity}/5)` : ''}`);
  const who = e.people.map((id) => people.get(id)?.name).filter(Boolean);
  if (who.length) lines.push(`- Thinking of: ${who.join(', ')}`);
  if (e.place?.name) lines.push(`- Place: ${e.place.name}`);
  if (e.weather && e.weather.day === e.date)
    lines.push(`- Weather: ${weatherName(e.weather.code)}, ${Math.round(e.weather.temp)}°C, ${e.weather.daylight.toFixed(1)} h of daylight${e.weather.dark ? ', after dark' : ''}`);
  if (e.cover) lines.push(`- Cover: ${'photo' in e.cover ? '[Photo]' : `[${e.cover.image.title ? `Image: ${e.cover.image.title}` : 'Image'}]`}`);
  const text = body(e, books);
  if (text) lines.push('', text);
  return lines.join('\n');
}

function person(p: Person, moments: number, books: Book[]) {
  const lines = [`### ${p.name || 'Unnamed'}${p.relation.trim() ? ` · ${p.relation.trim()}` : ''}`];
  if (p.emotions.length) lines.push(`- How they make me feel: ${feelings(p.emotions)}`);
  if (p.theme) lines.push(`- Theme song: ${p.theme.title}${p.theme.sub ? ` · ${p.theme.sub}` : ''}`);
  for (const d of p.dates) {
    const [m, day] = d.md.split('-').map(Number);
    lines.push(`- ${dateName(d)}: ${new Date(2000, m - 1, day).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' })}${d.year ? ' ' + d.year : ''}`);
  }
  lines.push(`- Tagged in ${moments} ${moments === 1 ? 'entry' : 'entries'}`);
  if (p.text.trim()) lines.push('', mentions(p.text.trim(), books));
  return lines.join('\n');
}

function book(b: Book, people: Map<string, Person>, books: Book[]) {
  const lines = [`### ${b.title}${b.authors ? ` · ${b.authors}` : ''}${b.year ? ` (${b.year})` : ''}`];
  lines.push(`- Status: ${STATUS_LABEL[b.status]}${b.rating ? ` · rated ${b.rating}/5` : ''}`);
  if (b.started || b.finished) lines.push(`- ${[b.started && `Started ${longDate(b.started)}`, b.finished && `finished ${longDate(b.finished)}`].filter(Boolean).join(', ')}`);
  if (b.status === 'reading' && b.page !== null) lines.push(`- On page ${b.page}${b.pages ? ` of ${b.pages}` : ''}`);
  if (b.emotions.length) lines.push(`- How it made me feel: ${feelings(b.emotions)}`);
  const from = b.from ? people.get(b.from)?.name : null;
  if (from) lines.push(`- Thinking of: ${from}`);
  if (b.text.trim()) lines.push('', mentions(b.text.trim(), books));
  return lines.join('\n');
}

function song(s: Song, people: Map<string, Person>, books: Book[]) {
  const m = s.music;
  const lines = [`### ${m.title}${m.sub ? ` · ${m.sub}` : ''} (${KIND_LABEL[m.kind].toLowerCase()})`];
  const facts = [s.rating ? `rated ${s.rating}/5` : '', s.repeat ? 'on repeat lately' : ''].filter(Boolean);
  if (facts.length) lines.push(`- ${facts.join(' · ')}`);
  if (s.emotions.length) lines.push(`- How it makes me feel: ${feelings(s.emotions)}`);
  const from = s.from ? people.get(s.from)?.name : null;
  if (from) lines.push(`- Thinking of: ${from}`);
  if (s.text.trim()) lines.push('', mentions(s.text.trim(), books));
  return lines.join('\n');
}

/** Markdown: people, books, music, then the journal from oldest to newest. No images are included, only placeholders and captions. */
export function exportText() {
  const entries = [...getEntries()].sort((a, b) => a.date === b.date ? a.time - b.time : a.date < b.date ? -1 : 1);
  const people = getPeople();
  const books = getBooks();
  const songs = getSongs();
  const byId = new Map(people.map((p) => [p.id, p]));
  const counts = new Map<string, number>();
  for (const e of entries)
    for (const id of new Set([...e.people, ...peopleIn(e.text, people)])) counts.set(id, (counts.get(id) ?? 0) + 1);

  const out = [
    '# My Mind: journal export',
    '',
    `Exported ${longDate(todayKey())}. This is my personal journal: the people in my life, the books I read, the music I keep, ` +
      'and my notes and check-ins in date order. Feelings are named on an emotion wheel as Core › Family › Feeling. ' +
      'Pictures aren’t included; [Photo] and [Image: …] mark where they were.',
  ];
  if (people.length) {
    out.push('', `## People (${people.length})`);
    [...people].sort((a, b) => (counts.get(b.id) ?? 0) - (counts.get(a.id) ?? 0)).forEach((p) => out.push('', person(p, counts.get(p.id) ?? 0, books)));
  }
  if (books.length) {
    out.push('', `## Books (${books.length})`);
    books.forEach((b) => out.push('', book(b, byId, books)));
  }
  if (songs.length) {
    out.push('', `## Music (${songs.length})`);
    songs.forEach((s) => out.push('', song(s, byId, books)));
  }
  out.push('', `## Journal (${entries.length} ${entries.length === 1 ? 'entry' : 'entries'})`);
  entries.forEach((e) => out.push('', entry(e, byId, books)));
  return out.join('\n') + '\n';
}
