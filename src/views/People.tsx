import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { dayLabel, keyOf } from '../lib/dates';
import { navigate } from '../lib/router';
import { DAY } from '../lib/dates';
import { momentsByPerson, pagesByPerson } from '../lib/people';
import { useBooks, useEntries, usePeople, useReady, useSongs, type Entry, type Person } from '../lib/store';
import { coreOf } from '../data/emotions';
import { watchView } from '../lib/inView';
import { plainText } from '../lib/body';
import { usePref } from '../lib/prefs';
import { EmotionChip } from '../components/emotion';
import { Icon, Sprite } from '../components/icons';
import { Avatar } from '../components/people';
import { Sky } from '../components/Sky';
import { count, t } from '../lib/i18n';

/** "today", "yesterday", "24 Sep" */
export function lastSeen(k: string) {
  const d = dayLabel(k);
  return [t('Today'), t('Yesterday'), t('Tomorrow')].includes(d) ? d.toLowerCase() : d.replace(/^\S+ /, '');
}

/** Notes and check-ins each person is tagged in, under "Thinking of" or in their words, newest first. */
export function useMoments() {
  const entries = useEntries();
  const people = usePeople();
  return useMemo(() => momentsByPerson(entries, people), [entries, people]);
}

/** The pages of other people, books and songs that tag each person, last changed first. */
export function usePages() {
  const people = usePeople();
  const books = useBooks();
  const songs = useSongs();
  return useMemo(() => pagesByPerson(people, books, songs), [people, books, songs]);
}

/** When someone was last on your mind: their latest moment, or the latest page that tags them. */
export function useLastThought() {
  const moments = useMoments();
  const pages = usePages();
  return useMemo(() => {
    const m = new Map<string, number>();
    for (const [id, list] of moments) m.set(id, list[0].time);
    for (const [id, list] of pages) m.set(id, Math.max(m.get(id) ?? 0, list[0].item.updated));
    return m;
  }, [moments, pages]);
}

export function People() {
  const people = usePeople();
  const ready = useReady();
  const moments = useMoments();
  const pages = usePages();
  const last = useLastThought();
  const [q, setQ] = useState('');
  const [sort, setSort] = usePref<'recent' | 'name'>('people-sort', 'recent', ['recent', 'name']);

  const shown = useMemo(() => {
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const list = people.filter((p) => {
      if (!words.length) return true;
      const hay = `${p.name} ${p.relation} ${plainText(p.text)}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    });
    if (sort === 'recent') list.sort((a, b) => (last.get(b.id) ?? 0) - (last.get(a.id) ?? 0) || b.updated - a.updated);
    return list;
  }, [people, last, q, sort]);

  return (
    <div class="page">
      <header class="page-head">
        <div class="eyebrow">{t('People')}</div>
        <div class="row between">
          <h1 class="title">{t('The people in your life')}</h1>
          <button class="icon-btn" onClick={() => navigate('person/new')} aria-label={t('Add person')} title={t('Add person')}>
            <Icon name="user-plus" />
          </button>
        </div>
        <p class="subtitle">{t('Write about them, tag them in notes and check-ins, and notice how they make you feel.')}</p>
      </header>

      {people.length > 0 && (
        <>
          <MindLink />
          {!q.trim() && <NotLately last={last} />}
          <label class="search">
            <Icon name="search" size={18} />
            <input type="search" placeholder={t('Search people')} value={q} onInput={(e) => setQ(e.currentTarget.value)} aria-label={t('Search people')} />
          </label>
          <div class="chips filters" role="toolbar" aria-label={t('Sort')}>
            <button class="chip" aria-pressed={sort === 'recent'} onClick={() => setSort('recent')}>{t('Recent')}</button>
            <button class="chip" aria-pressed={sort === 'name'} onClick={() => setSort('name')}>{t('A–Z')}</button>
          </div>
        </>
      )}

      {ready && !people.length && (
        <div class="empty">
          <h2 class="title-s">{t('No one here yet')}</h2>
          <p>{t('Add the people who matter to you — friends, family, anyone on your mind — and keep what you think and feel about them in one place.')}</p>
          <button class="btn btn-primary" onClick={() => navigate('person/new')}><Icon name="user-plus" size={18} /> {t('Add a person')}</button>
        </div>
      )}
      {!!people.length && !shown.length && <p class="empty-note center">{t('No one matches “{q}”.', { q: q.trim() })}</p>}

      <div class="entries people-list">
        {shown.map((p) => {
          const n = (moments.get(p.id)?.length ?? 0) + (pages.get(p.id)?.length ?? 0);
          const at = last.get(p.id);
          const facts = [p.relation, n ? `${count(n, 'moment', 'moments')} · ${t('last {date}', { date: lastSeen(keyOf(new Date(at!))) })}` : ''].filter(Boolean);
          return <PersonCard key={p.id} p={p} facts={facts} moments={moments.get(p.id)} />;
        })}
      </div>
    </div>
  );
}

/**
 * The worlds someone brings out, most first: how they make you feel (the first feeling counts double), or,
 * before you've said, the main feelings of the moments they're in.
 */
function worldsOf(p: Person, moments: Entry[] = []) {
  const weight = new Map<string, number>();
  const add = (id: string, w: number) => {
    const c = coreOf(id)?.id;
    if (c) weight.set(c, (weight.get(c) ?? 0) + w);
  };
  p.emotions.forEach((id, i) => add(id, i ? 1 : 2));
  if (!weight.size) for (const e of moments) if (e.emotions[0]) add(e.emotions[0], 1);
  return [...weight.keys()].sort((a, b) => weight.get(b)! - weight.get(a)!);
}

/** Where the feelings float on a card: off to the right, clear of the name, each on its own slow loop. */
const SPOTS = [
  { right: '15%', top: '14%', size: 13, dur: 7.4 },
  { right: '31%', bottom: '13%', size: 11, dur: 9.1 },
  { right: '7%', bottom: '16%', size: 10, dur: 8.3 },
];

/**
 * Someone in the list, in the colour of what they make you feel: a small sky of their worlds drifts through
 * the card, drawn in their main world's letters, and their feelings' sprites float around it. The sky is only
 * there while the card is on (or near) the screen, so a long list stays light.
 */
function PersonCard({ p, facts, moments }: { p: Person; facts: string[]; moments?: Entry[] }) {
  const worlds = useMemo(() => worldsOf(p, moments), [p, moments]);
  const ref = useRef<HTMLButtonElement>(null);
  const [live, setLive] = useState(false);
  useEffect(() => {
    const el = ref.current;
    return el && worlds.length
      ? watchView(el, (on) => { el.toggleAttribute('data-live', on); setLive(on); })
      : undefined;
  }, [worlds.length > 0]);
  const sky = useMemo(() => [worlds[0], worlds[1] ?? worlds[0], worlds[2] ?? worlds[0]], [worlds.join()]);
  const style = worlds.length ? { '--m1': `var(--emo-${worlds[0]})`, '--m2': `var(--emo-${worlds[1] ?? worlds[0]})`, '--t': p.created % 9000 } : undefined;
  return (
    <button ref={ref} class={`person-card card${worlds.length ? ' has-mood' : ''}`} style={style} onClick={() => navigate('person/' + p.id)}>
      {worlds.length > 0 && (
        <span class="person-sky" aria-hidden="true">
          {live && <span class="person-clouds"><Sky worlds={sky} letters={worlds[0]} small /></span>}
          {SPOTS.map((s, i) => (
            <span class="person-float" style={{ right: s.right, top: s.top, bottom: s.bottom, '--d': `${s.dur}s`, '--i': i }}>
              <Sprite core={worlds[i % worlds.length]} size={s.size} idle="view" delay={(p.created + i * 530) % 1500} />
            </span>
          ))}
        </span>
      )}
      <Avatar p={p} size={46} />
      <div class="person-card-main">
        <div class="person-card-name">{p.name || t('Unnamed')}</div>
        {facts.length > 0 && <div class="person-card-sub">{facts.join(' · ')}</div>}
        {p.emotions.length > 0 && (
          <div class="note-emos">{p.emotions.slice(0, 3).map((id, i) => <EmotionChip id={id} size="sm" idle="view" delay={(p.created + i * 380) % 1300} />)}{p.emotions.length > 3 && <span class="muted small">+{p.emotions.length - 3}</span>}</div>
        )}
      </div>
      <Icon name="chevron-right" size={18} />
    </button>
  );
}

const QUIET_DAYS = 30;

/**
 * The people you haven't thought of in a month or more, longest first: someone you've written about before, or
 * added a while ago and never since. A tap checks in or writes about them.
 */
function NotLately({ last }: { last: Map<string, number> }) {
  const people = usePeople();
  const quiet = useMemo(() => {
    const now = Date.now();
    const since = (p: Person) => last.get(p.id) ?? p.created;
    return people
      .filter((p) => p.name.trim() && now - since(p) >= QUIET_DAYS * DAY)
      .sort((a, b) => since(a) - since(b))
      .slice(0, 8)
      .map((p) => ({ p, days: Math.floor((now - since(p)) / DAY), never: !last.has(p.id) }));
  }, [people, last]);
  if (!quiet.length) return null;
  return (
    <section class="not-lately">
      <h2 class="section-title">{t('Haven’t thought of in a while')}</h2>
      <div class="reading-strip" role="list">
        {quiet.map(({ p, days, never }) => {
          const first = p.name.trim().split(/\s+/)[0];
          return (
            <div key={p.id} class="reading-chip card quiet-chip" role="listitem">
              <button class="reading-chip-main" onClick={() => navigate('person/' + p.id)}>
                <Avatar p={p} size={34} />
                <span class="book-row-main">
                  <span class="book-row-title">{p.name}</span>
                  <span class="book-row-sub">{never ? t('Added {when}', { when: ago(days) }) : t('Last {when}', { when: ago(days) })}</span>
                </span>
              </button>
              <button class="icon-btn small" onClick={() => navigate('tracker?person=' + p.id)} aria-label={t('Check in about {name}', { name: first })} title={t('Check in')}>
                <Icon name="mood-smile" size={16} />
              </button>
              <button class="icon-btn small" onClick={() => navigate('note/new?person=' + p.id)} aria-label={t('Write about {title}', { title: first })} title={t('Write about them')}>
                <Icon name="pencil" size={16} />
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}

/** "5 weeks ago", "3 months ago", "over a year ago" */
function ago(days: number) {
  if (days < 60) return t('{span} ago', { span: count(Math.floor(days / 7), 'week', 'weeks') });
  if (days < 365) return t('{span} ago', { span: count(Math.floor(days / 30), 'month', 'months') });
  return days < 730 ? t('over a year ago') : t('{span} ago', { span: count(Math.floor(days / 365), 'year', 'years') });
}

/** The way into the mind page: the people who take up the most room, peeking out on the right. */
function MindLink() {
  const people = usePeople();
  const moments = useMoments();
  const top = useMemo(
    () => people.filter((p) => moments.has(p.id)).sort((a, b) => moments.get(b.id)!.length - moments.get(a.id)!.length).slice(0, 3),
    [people, moments],
  );
  return (
    <button class="mind-link card" onClick={() => navigate('people/mind')}>
      <span class="mind-link-icon"><Icon name="chart-pie" size={24} stroke={1.6} /></span>
      <span class="mind-link-main">
        <span class="mind-link-title">{t('What’s on your mind')}</span>
        <span class="mind-link-sub">{t('How much of your thoughts each person takes up')}</span>
      </span>
      {top.length > 0 && <span class="avatar-stack">{top.map((p) => <Avatar p={p} size={26} />)}</span>}
      <Icon name="chevron-right" size={18} />
    </button>
  );
}
