import { useMemo, useState } from 'preact/hooks';
import { dayLabel } from '../lib/dates';
import { navigate } from '../lib/router';
import { useEntries, usePeople, useReady, type Entry } from '../lib/store';
import { plainText } from '../lib/body';
import { EmotionChip } from '../components/emotion';
import { Icon } from '../components/icons';
import { Avatar } from '../components/people';

/** "today", "yesterday", "24 Sep" */
export function lastSeen(k: string) {
  const d = dayLabel(k);
  return /^(Today|Yesterday|Tomorrow)$/.test(d) ? d.toLowerCase() : d.replace(/^\S+ /, '');
}

/** Notes and check-ins each person is tagged in, newest first. */
export function useMoments() {
  const entries = useEntries();
  return useMemo(() => {
    const m = new Map<string, Entry[]>();
    for (const e of entries)
      for (const id of e.people) {
        const list = m.get(id);
        if (list) list.push(e);
        else m.set(id, [e]);
      }
    return m;
  }, [entries]);
}

export function People() {
  const people = usePeople();
  const ready = useReady();
  const moments = useMoments();
  const [q, setQ] = useState('');
  const [sort, setSort] = useState<'recent' | 'name'>('recent');

  const shown = useMemo(() => {
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const list = people.filter((p) => {
      if (!words.length) return true;
      const hay = `${p.name} ${p.relation} ${plainText(p.text)}`.toLowerCase();
      return words.every((w) => hay.includes(w));
    });
    if (sort === 'recent') {
      const last = (id: string) => moments.get(id)?.[0]?.time ?? 0;
      list.sort((a, b) => last(b.id) - last(a.id) || b.updated - a.updated);
    }
    return list;
  }, [people, moments, q, sort]);

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
          const list = moments.get(p.id) ?? [];
          const facts = [p.relation, list.length ? `${list.length} ${list.length === 1 ? 'moment' : 'moments'} · last ${lastSeen(list[0].date)}` : ''].filter(Boolean);
          return (
            <button class="person-card card" onClick={() => navigate('person/' + p.id)}>
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
