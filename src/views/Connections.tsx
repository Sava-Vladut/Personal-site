import { useMemo, useState } from 'preact/hooks';
import { arc, buildGraph, memoryLabel, related, spanLabel, starts, thread, feelingName, type Arc, type Graph, type Node, type NodeKind, type Rel, type Step } from '../lib/connections';
import { coreOf } from '../data/emotions';
import { goBack, navigate } from '../lib/router';
import { findSong, useBooks, useEntries, usePeople, useReady, useSongs } from '../lib/store';
import { BookCover } from '../components/books';
import { Icon, type UiName } from '../components/icons';
import { MiniMusic } from '../components/music';
import { Avatar } from '../components/people';
import { Sky } from '../components/Sky';
import { CheckInRow, NoteCard } from './Journal';
import '../styles/connections.css';

const KIND: Record<NodeKind | 'memory', [string, string]> = {
  // what the step is called in a thread, and what a list of them is called
  person: ['With', 'People'],
  place: ['Where', 'Places'],
  month: ['When', 'Months'],
  feeling: ['Felt', 'Feelings'],
  music: ['Playing', 'Music'],
  book: ['Reading', 'Books'],
  memory: ['The memory', 'Notes'],
};
const ONE: Record<NodeKind, string> = { person: 'Person', place: 'Place', month: 'Month', feeling: 'Feeling', music: 'Music', book: 'Book' };
const ICON: Partial<Record<NodeKind, UiName>> = { place: 'map-pin', month: 'calendar' };

const to = (key: string) => 'connections/' + encodeURIComponent(key);
const colour = (core: string | null | undefined) => (core ? `var(--emo-${core})` : undefined);

/** The little picture of a thing: a face, a cover, a record, a pin, a page of the calendar, a feeling's colour. */
function Thumb({ n, size = 24 }: { n: Node; size?: number }) {
  if (n.person) return <Avatar p={n.person} size={size} />;
  if (n.book) return <BookCover b={n.book} width={Math.round(size * 0.72)} />;
  if (n.music) return <span class="cx-mini" style={{ '--s': size + 'px' }}><MiniMusic m={n.music} /></span>;
  if (n.kind === 'feeling') return <span class="cx-dot" style={{ '--s': size + 'px', '--c': colour(n.core) }} aria-hidden="true" />;
  return <span class="cx-badge" style={{ '--s': size + 'px' }} aria-hidden="true"><Icon name={ICON[n.kind]!} size={Math.round(size * 0.6)} /></span>;
}

function Chip({ n, count, size = 'md' }: { n: Node; count?: number; size?: 'sm' | 'md' | 'lg' }) {
  return (
    <button class={`cx-chip is-${size} is-${n.kind}`} style={{ '--c': colour(n.core) }} onClick={(e) => { e.stopPropagation(); navigate(to(n.key)); }}>
      <Thumb n={n} size={size === 'lg' ? 30 : size === 'sm' ? 18 : 22} />
      <span class="cx-chip-label">{n.kind === 'music' ? '♪ ' : ''}{n.label}</span>
      {count !== undefined && count > 1 && <span class="cx-chip-n">×{count}</span>}
    </button>
  );
}

export function Connections({ id }: { id?: string }) {
  const entries = useEntries();
  const people = usePeople();
  const books = useBooks();
  const songs = useSongs();
  const ready = useReady();
  const g = useMemo(() => buildGraph(entries, people, books, songs), [entries, people, books, songs]);
  const focus = id ? g.nodes.get(id) : undefined;
  if (id && !focus)
    return ready ? (
      <div class="page">
        <div class="empty">
          <h2 class="title-s">Nothing connects here anymore</h2>
          <p>The notes that held this thread may have changed or been deleted.</p>
          <button class="btn btn-primary" onClick={() => navigate('connections', true)}>See all connections</button>
        </div>
      </div>
    ) : <div class="page" />;
  return focus ? <Focus g={g} focus={focus} /> : <Overview g={g} ready={ready} />;
}

/* ---------- every thread ---------- */

function Overview({ g, ready }: { g: Graph; ready: boolean }) {
  const people = useMemo(() => starts(g, 'person').slice(0, 8), [g]);
  const others: [NodeKind, Node[]][] = useMemo(
    () => (['place', 'feeling', 'music', 'month', 'book'] as NodeKind[]).map((k) => [k, starts(g, k).slice(0, 10)] as [NodeKind, Node[]]).filter(([, l]) => l.length),
    [g],
  );
  const worlds = people.map((n) => n.core).filter(Boolean) as string[];
  return (
    <div class="page cx-page">
      <div class="journal-top mind-top cx-top" style={worlds[0] ? { '--sky': `var(--emo-${worlds[0]})` } : undefined}>
        <Sky world={worlds[0] ?? null} worlds={worlds.length ? worlds : undefined} />
        <header class="page-head">
          <button class="back-link stats-back" onClick={() => goBack('people')}><Icon name="chevron-left" size={18} /> People</button>
          <h1 class="title">Connections</h1>
          <p class="subtitle">The threads your notes already hold: who, where, when, what you felt and what was playing. Tap anything to follow it.</p>
        </header>
      </div>

      {ready && !people.length && !others.length && (
        <div class="empty">
          <h2 class="title-s">No threads yet</h2>
          <p>Tag people in your notes, log how you felt, add music — once a few things turn up together, their threads show here.</p>
        </div>
      )}

      {people.length > 0 && (
        <section class="section">
          <h2 class="section-title">Threads through the people in your life</h2>
          <div class="cx-threads">
            {people.map((n, i) => <ThreadCard g={g} n={n} i={i} />)}
          </div>
        </section>
      )}

      {others.map(([kind, list]) => (
        <section class="section">
          <h2 class="section-title">Start from {KIND[kind][1].toLowerCase()}</h2>
          <div class="cx-cloud">{list.map((n) => <Chip n={n} count={g.notes.get(n.key)!.length} />)}</div>
        </section>
      ))}
    </div>
  );
}

/** One thread, told in a line: Ana → Cluj → May 2025 → Affection, Regretful → ♪ … → “At the mall”. */
function ThreadCard({ g, n, i }: { g: Graph; n: Node; i: number }) {
  const steps = useMemo(() => thread(g, n.key), [g, n.key]);
  const a = useMemo(() => arc(g, n.key), [g, n.key]);
  const count = g.notes.get(n.key)!.length;
  return (
    <div class="cx-card card" role="link" tabIndex={0} style={{ '--c': colour(n.core), '--i': i }}
      onClick={() => navigate(to(n.key))} onKeyDown={(e) => e.key === 'Enter' && navigate(to(n.key))}>
      <div class="cx-card-head">
        <Thumb n={n} size={38} />
        <div class="cx-card-who">
          <b>{n.label}</b>
          <span>{count} {count === 1 ? 'moment' : 'moments'}</span>
        </div>
        <Icon name="chevron-right" size={18} />
      </div>
      <ThreadLine steps={steps} />
      {a.phases.length > 0 && <ArcLine a={a} />}
    </div>
  );
}

function ThreadLine({ steps }: { steps: Step[] }) {
  return (
    <div class="cx-line">
      {steps.map((s) => (
        <span class="cx-line-step">
          <span class="cx-arrow" aria-hidden="true">→</span>
          {s.memory ? (
            <button class="cx-chip is-sm is-memory" onClick={(e) => { e.stopPropagation(); navigate('note/' + s.memory!.id); }}>“{memoryLabel(s.memory, 26)}”</button>
          ) : (
            s.picks.map((r, i) => <>{i > 0 && <span class="cx-slash" aria-hidden="true">/</span>}<Chip n={r.node} size="sm" /></>)
          )}
        </span>
      ))}
    </div>
  );
}

function ArcLine({ a }: { a: Arc }) {
  return (
    <div class="cx-arcline">
      {a.phases.map((p, i) => (
        <>{i > 0 && <span aria-hidden="true">→</span>}<span style={{ color: colour(coreOf(p.feeling)?.id) }}>{feelingName(p.feeling).toLowerCase()}</span></>
      ))}
      {a.ending && <>{a.phases.length > 0 && <span aria-hidden="true">→</span>}<span class="cx-fade">{a.ending.label.toLowerCase()}</span></>}
    </div>
  );
}

/* ---------- one thing, and everything it's tied to ---------- */

function Focus({ g, focus }: { g: Graph; focus: Node }) {
  const songs = useSongs();
  const notes = g.notes.get(focus.key) ?? [];
  const steps = useMemo(() => thread(g, focus.key), [g, focus.key]);
  const a = useMemo(() => arc(g, focus.key), [g, focus.key]);
  const rels = useMemo(() => related(g, focus.key), [g, focus.key]);
  const [all, setAll] = useState(false);
  const feelings = rels.filter((r) => r.node.kind === 'feeling');
  const sky = focus.core ?? feelings[0]?.node.core ?? null;
  const groups = (['person', 'place', 'month', 'feeling', 'music', 'book'] as NodeKind[])
    .filter((k) => k !== focus.kind)
    .map((k) => [k, rels.filter((r) => r.node.kind === k)] as [NodeKind, Rel[]])
    .filter(([, l]) => l.length);
  const oldest = notes[notes.length - 1];
  const kept = focus.music && findSong(songs, focus.music);
  const open =
    focus.person ? ['person/' + focus.person.id, 'Open ' + focus.label.split(/\s+/)[0]]
    : focus.book ? ['book/' + focus.book.id, 'Open the book']
    : kept ? ['song/' + kept.id, 'Open in Media']
    : null;

  return (
    <div class="page cx-page">
      <div class="journal-top mind-top cx-top" style={sky ? { '--sky': `var(--emo-${sky})` } : undefined}>
        <Sky world={sky} />
        <header class="page-head">
          <button class="back-link stats-back" onClick={() => goBack('connections')}><Icon name="chevron-left" size={18} /> Back</button>
          <div class="cx-hero">
            <Thumb n={focus} size={56} />
            <div class="cx-hero-main">
              <span class="eyebrow">{ONE[focus.kind]}</span>
              <h1 class="title">{focus.kind === 'music' ? '♪ ' : ''}{focus.label}</h1>
              <p class="subtitle">
                {notes.length} {notes.length === 1 ? 'moment' : 'moments'}
                {oldest && notes.length > 1 ? ` · ${spanLabel(oldest.date, notes[0].date)}` : ''}
              </p>
            </div>
          </div>
          {open && <button class="btn btn-quiet btn-s cx-open" onClick={() => navigate(open[0])}>{open[1]} <Icon name="arrow-up-right" size={15} /></button>}
        </header>
      </div>

      {steps.length > 0 ? (
        <section class="section">
          <h2 class="section-title">The thread</h2>
          <ol class="cx-thread" style={{ '--c': colour(sky) }}>
            {steps.map((s, i) => <ThreadStep s={s} i={i} of={notes.length} />)}
          </ol>
        </section>
      ) : (
        <p class="empty-note">Only one note holds this so far. Write about it again and its connections show up here.</p>
      )}

      {(a.phases.length > 0 || a.ending) && (
        <section class="section">
          <h2 class="section-title">How it changed</h2>
          <ol class="cx-arc">
            {a.phases.map((p, i) => (
              <li class="cx-phase" style={{ '--c': colour(coreOf(p.feeling)?.id), '--i': i }}>
                <button class="cx-phase-name" onClick={() => navigate(to('feeling:' + p.feeling))}>{feelingName(p.feeling)}</button>
                <span class="cx-phase-when">{spanLabel(p.from, p.to)} · {p.n} {p.n === 1 ? 'note' : 'notes'}</span>
              </li>
            ))}
            {a.ending && (
              <li class="cx-phase is-ending" style={{ '--i': a.phases.length }}>
                <span class="cx-phase-name">{a.ending.label}</span>
                <span class="cx-phase-when">{a.ending.kind === 'drift' ? 'the notes come further apart' : 'nothing written since'}</span>
              </li>
            )}
          </ol>
        </section>
      )}

      {groups.length > 0 && (
        <section class="section">
          <h2 class="section-title">Everything it’s tied to</h2>
          <div class="cx-groups card">
            {groups.map(([k, list]) => (
              <div class="cx-group">
                <span class="cx-group-name">{KIND[k][1]}</span>
                <div class="cx-cloud">{list.slice(0, 14).map((r) => <Chip n={r.node} count={r.count} />)}</div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section class="section">
        <h2 class="section-title">The notes</h2>
        <div class="entries">
          {(all ? notes : notes.slice(0, 8)).map((e) => (e.kind === 'checkin' ? <CheckInRow e={e} /> : <NoteCard e={e} dated />))}
        </div>
        {!all && notes.length > 8 && <button class="btn btn-quiet cx-more" onClick={() => setAll(true)}>Show all {notes.length}</button>}
      </section>
    </div>
  );
}

function ThreadStep({ s, i, of }: { s: Step; i: number; of: number }) {
  const strength = s.memory ? 1 : Math.max(...s.picks.map((r) => r.count)) / Math.max(1, of);
  return (
    <li class={`cx-step${s.memory ? ' is-memory' : ''}`} style={{ '--i': i, '--w': strength.toFixed(2), '--c': colour(s.picks[0]?.node.core) }}>
      <span class="cx-step-kind">{KIND[s.kind][0]}</span>
      {s.memory ? (
        <button class="cx-memory card" onClick={() => navigate('note/' + s.memory!.id)}>
          <span class="cx-memory-quote">“{memoryLabel(s.memory, 60)}”</span>
          <span class="cx-memory-when">{spanLabel(s.memory.date, s.memory.date)} · the note that holds most of this thread</span>
        </button>
      ) : (
        <>
          <div class="cx-step-picks">
            {s.picks.map((r) => <Chip n={r.node} size="lg" />)}
            <span class="cx-step-n">{s.picks.length > 1 ? 'in ' : ''}{s.picks.map((r) => r.count).join(' & ')} of {of}</span>
          </div>
          {s.alts.length > 0 && (
            <div class="cx-step-alts">
              <span>also</span>
              {s.alts.map((r) => <Chip n={r.node} count={r.count} size="sm" />)}
            </div>
          )}
        </>
      )}
    </li>
  );
}
