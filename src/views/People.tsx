import { useMemo, useState } from 'preact/hooks';
import { dayLabel, keyOf } from '../lib/dates';
import { navigate } from '../lib/router';
import { DAY } from '../lib/dates';
import { momentsByPerson, pagesByPerson } from '../lib/people';
import { useBooks, useEntries, usePeople, useReady, useSongs, type Person } from '../lib/store';
import { plainText } from '../lib/body';
import { EmotionChip } from '../components/emotion';
import { Icon } from '../components/icons';
import { Avatar } from '../components/people';

/** "today", "yesterday", "24 Sep" */
export function lastSeen(k: string) {
  const d = dayLabel(k);
  return /^(Today|Yesterday|Tomorrow)$/.test(d) ? d.toLowerCase() : d.replace(/^\S+ /, '');
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
  const [sort, setSort] = useState<'recent' | 'name'>('recent');

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
        <div class="eyebrow">People</div>
        <div class="row between">
          <h1 class="title">The people in your life</h1>
          <button class="icon-btn" onClick={() => navigate('person/new')} aria-label="Add person" title="Add person">
            <Icon name="user-plus" />
          </button>
        </div>
        <p class="subtitle">Write about them, tag them in notes and check-ins, and notice how they make you feel.</p>
      </header>

      {people.length > 0 && (
        <>
          <MindLink />
          {!q.trim() && <NotLately last={last} />}
          <label class="search">
            <Icon name="search" size={18} />
            <input type="search" placeholder="Search people" value={q} onInput={(e) => setQ(e.currentTarget.value)} aria-label="Search people" />
          </label>
          <div class="chips filters" role="toolbar" aria-label="Sort">
            <button class="chip" aria-pressed={sort === 'recent'} onClick={() => setSort('recent')}>Recent</button>
            <button class="chip" aria-pressed={sort === 'name'} onClick={() => setSort('name')}>A–Z</button>
          </div>
        </>
      )}

      {ready && !people.length && (
        <div class="empty">
          <h2 class="title-s">No one here yet</h2>
          <p>Add the people who matter to you — friends, family, anyone on your mind — and keep what you think and feel about them in one place.</p>
          <button class="btn btn-primary" onClick={() => navigate('person/new')}><Icon name="user-plus" size={18} /> Add a person</button>
        </div>
      )}
      {!!people.length && !shown.length && <p class="empty-note center">No one matches “{q.trim()}”.</p>}

      <div class="entries people-list">
        {shown.map((p) => {
          const n = (moments.get(p.id)?.length ?? 0) + (pages.get(p.id)?.length ?? 0);
          const at = last.get(p.id);
          const facts = [p.relation, n ? `${n} ${n === 1 ? 'moment' : 'moments'} · last ${lastSeen(keyOf(new Date(at!)))}` : ''].filter(Boolean);
          return (
            <button key={p.id} class="person-card card" onClick={() => navigate('person/' + p.id)}>
              <Avatar p={p} size={46} />
              <div class="person-card-main">
                <div class="person-card-name">{p.name || 'Unnamed'}</div>
                {facts.length > 0 && <div class="person-card-sub">{facts.join(' · ')}</div>}
                {p.emotions.length > 0 && (
                  <div class="note-emos">{p.emotions.slice(0, 3).map((id) => <EmotionChip id={id} size="sm" />)}{p.emotions.length > 3 && <span class="muted small">+{p.emotions.length - 3}</span>}</div>
                )}
              </div>
              <Icon name="chevron-right" size={18} />
            </button>
          );
        })}
      </div>
    </div>
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
      <h2 class="section-title">Haven’t thought of in a while</h2>
      <div class="reading-strip" role="list">
        {quiet.map(({ p, days, never }) => {
          const first = p.name.trim().split(/\s+/)[0];
          return (
            <div key={p.id} class="reading-chip card quiet-chip" role="listitem">
              <button class="reading-chip-main" onClick={() => navigate('person/' + p.id)}>
                <Avatar p={p} size={34} />
                <span class="book-row-main">
                  <span class="book-row-title">{p.name}</span>
                  <span class="book-row-sub">{never ? `Added ${ago(days)}` : `Last ${ago(days)}`}</span>
                </span>
              </button>
              <button class="icon-btn small" onClick={() => navigate('tracker?person=' + p.id)} aria-label={`Check in about ${first}`} title="Check in">
                <Icon name="mood-smile" size={16} />
              </button>
              <button class="icon-btn small" onClick={() => navigate('note/new?person=' + p.id)} aria-label={`Write about ${first}`} title="Write about them">
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
  if (days < 60) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  return days < 730 ? 'over a year ago' : `${Math.floor(days / 365)} years ago`;
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
        <span class="mind-link-title">What’s on your mind</span>
        <span class="mind-link-sub">How much of your thoughts each person takes up</span>
      </span>
      {top.length > 0 && <span class="avatar-stack">{top.map((p) => <Avatar p={p} size={26} />)}</span>}
      <Icon name="chevron-right" size={18} />
    </button>
  );
}
