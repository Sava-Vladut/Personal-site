// The people in your life, drawn the way you might map them with a therapist: who takes up your thoughts (the wheel,
// kept in view), how each of them makes you feel, from heavy to warm, who is shifting and who is drifting, and
// everyone in the circles they sit in, from the few closest to the ones further out.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { formatDate, keyOf, DAY } from '../lib/dates';
import { navigate } from '../lib/router';
import { monthsOf, trendOf, upcoming, whatsComing, whenLabel, type Month, type Page } from '../lib/people';
import { usePeople, useReady, type Entry, type Person } from '../lib/store';
import { coreOf } from '../data/emotions';
import { watchView } from '../lib/inView';
import { plainText } from '../lib/body';
import { usePref } from '../lib/prefs';
import { EmotionChip } from '../components/emotion';
import { PageHead } from '../components/PageHead';
import { Icon, Sprite } from '../components/icons';
import { Avatar, lastSeen, useLastThought, useMoments, usePages } from '../components/people';
import { letterOf, runsOf } from '../components/collection';
import { Sky } from '../components/Sky';
import { MindCard, MindSummary, RANGES, RangeChips, Wheel, pctOf, skyMix, useShares, type Range, type Share } from './Mind';
import { count, t } from '../lib/i18n';
import '../styles/people.css';

/* ---------- reading the people ---------- */

/** How close someone is right now: the circles of a social convoy, from the few closest outwards. */
type Circle = 'inner' | 'close' | 'around' | 'far';
/** How someone makes you feel, on balance: warm and hard feelings are weighed separately, as in relationship research. */
type Feel = 'lifts' | 'weighs' | 'mixed' | 'unfelt';

interface Read {
  p: Person;
  moments: Entry[];
  warm: number;              // pleasant feelings felt with them (the ones you picked for them count for a few moments)
  hard: number;              // unpleasant ones
  warmth: number | null;     // warm / (warm + hard); null before any feeling
  feel: Feel;
  core: string | null;       // their colour: the main feeling you picked, else the world you feel most with them
  mix: [string, number][];   // the worlds you feel with them, most first
  feelings: string[];        // what you feel with them: the ones you picked, else the ones you log most
  near: number;              // closeness: every moment counts, the recent ones most
  circle: Circle;
  last: number | undefined;  // when they were last on your mind
}

const HALF_LIFE = 45; // days: a moment a month and a half old counts half as much as one today
const INNER = 5, CLOSE = 15; // the convoy's first rings hold about five people, then about fifteen

function readPeople(people: Person[], moments: Map<string, Entry[]>, pages: Map<string, Page[]>, last: Map<string, number>): Read[] {
  const now = Date.now();
  const fade = (time: number) => 0.5 ** (Math.max(0, now - time) / DAY / HALF_LIFE);
  const list = people.map((p): Read => {
    const ms = moments.get(p.id) ?? [];
    let warm = 0, hard = 0;
    const worlds = new Map<string, number>(), felt = new Map<string, number>();
    const add = (id: string, w: number) => {
      const c = coreOf(id);
      if (!c) return;
      if (c.valence === 'pleasant') warm += w;
      else hard += w;
      worlds.set(c.id, (worlds.get(c.id) ?? 0) + w);
    };
    // what you said they make you feel is a considered view, so it weighs as much as a few moments
    p.emotions.forEach((id, i) => add(id, i ? 2 : 3));
    for (const e of ms) {
      e.emotions.forEach((id, i) => {
        const w = (e.intensity / 3) * (i ? 0.5 : 1);
        add(id, w);
        felt.set(id, (felt.get(id) ?? 0) + w);
      });
    }
    const warmth = warm + hard ? warm / (warm + hard) : null;
    const mix = [...worlds].sort((a, b) => b[1] - a[1]);
    let near = ms.reduce((s, e) => s + fade(e.time), 0);
    for (const pg of pages.get(p.id) ?? []) near += fade(pg.item.updated) / 2;
    return {
      p, moments: ms, warm, hard, warmth,
      feel: warmth === null ? 'unfelt' : warmth >= 2 / 3 ? 'lifts' : warmth <= 1 / 3 ? 'weighs' : 'mixed',
      core: p.emotions[0] ? coreOf(p.emotions[0])?.id ?? null : mix[0]?.[0] ?? null,
      mix,
      feelings: (p.emotions.length ? p.emotions : [...felt].sort((a, b) => b[1] - a[1]).map(([id]) => id)).slice(0, 3),
      near, circle: 'far', last: last.get(p.id),
    };
  });
  // the inner circle and the close ring are the nearest few, as long as they've been on your mind lately at all
  list.filter((x) => x.near > 0.04).sort((a, b) => b.near - a.near).forEach((x, i) => {
    x.circle = i < INNER && x.near >= 0.5 ? 'inner' : i < CLOSE && x.near >= 0.15 ? 'close' : 'around';
  });
  return list;
}

const CIRCLES: [Circle, string, string][] = [
  ['inner', t('Inner circle'), t('The few who fill your thoughts right now. Most people keep about five this close.')],
  ['close', t('Close by'), t('Often on your mind. This ring usually holds around fifteen people.')],
  ['around', t('Around you'), t('In your life, if not in every week.')],
  ['far', t('Further out'), t('Not in your notes for a while. Closeness fades without attention, and comes back with it.')],
];

const FEELS: [Feel, string, string][] = [
  ['lifts', t('Lift you up'), t('Mostly warm feelings: the people who give you energy back.')],
  ['mixed', t('Mixed feelings'), t('Warm and hard at once. Ties like these can take more out of you than you notice.')],
  ['weighs', t('Weigh on you'), t('Mostly hard feelings. Worth noticing what these ask of you.')],
  ['unfelt', t('Not felt yet'), t('Nothing logged yet. Add how they make you feel on their page.')],
];

const FEEL_LINE: Record<Feel, string> = {
  lifts: t('mostly warm feelings'),
  mixed: t('warm and hard feelings at once'),
  weighs: t('mostly hard feelings'),
  unfelt: t('no feelings logged yet'),
};

const colorOf = (core: string | null) => (core ? `var(--emo-${core})` : 'var(--ink-3)');

/** What search looks through for someone, once per version of them (a saved person is a new object). */
const searched = new WeakMap<Person, string>();
function searchText(p: Person) {
  let s = searched.get(p);
  if (s === undefined) searched.set(p, (s = `${p.name} ${p.relation} ${plainText(p.text)}`.toLowerCase()));
  return s;
}

/* ---------- the page ---------- */

export function People() {
  const people = usePeople();
  const ready = useReady();
  const moments = useMoments();
  const pages = usePages();
  const last = useLastThought();
  const [range, setRange] = usePref<Range>('mind-range', 'all', RANGES.map(([r]) => r));
  const shares = useShares(range);
  const reads = useMemo(() => readPeople(people, moments, pages, last), [people, moments, pages, last]);
  // one person in focus across the page: picked with a tap (wheel, map or list) or pointed at with a mouse
  const [picked, setPicked] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const focus = hover ?? picked;
  const pick = (id: string | null) => setPicked((now) => (now === id ? null : id));
  const point = (id: string | null) => setHover(id);

  return (
    <div class="page pp-page">
      <PageHead
        title={t('The people in your life')}
        subtitle={t('Who takes up your thoughts, how each of them makes you feel, and who you’ve drifted from.')}
        wheel world="love-connection"
        actions={
          <button class="icon-btn" onClick={() => navigate('person/new')} aria-label={t('Add person')} title={t('Add person')}>
            <Icon name="user-plus" />
          </button>
        }
      />

      {ready && !people.length && (
        <div class="empty">
          <h2 class="title-s">{t('No one here yet')}</h2>
          <p>{t('Add the people who matter to you — friends, family, anyone on your mind — and keep what you think and feel about them in one place.')}</p>
          <button class="btn btn-primary" onClick={() => navigate('person/new')}><Icon name="user-plus" size={18} /> {t('Add a person')}</button>
        </div>
      )}

      {people.length > 0 && (
        <>
          <MindPanel shares={shares} range={range} onRange={(r) => { setRange(r); setPicked(null); }} focus={focus} picked={picked} onPick={pick} onHover={point} />
          <div class="pp-main">
            <FeelMap reads={reads} focus={focus} onPick={pick} onHover={point} />
            <div class="pp-body">
              <aside class="pp-notes">
                <Shifting reads={reads} onHover={point} />
                <Drifting reads={reads} />
                <ComingUp people={people} />
              </aside>
              <Everyone reads={reads} shares={shares} focus={focus} onHover={point} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ---------- what's on your mind: the wheel, always in view ---------- */

function MindPanel({ shares, range, onRange, focus, picked, onPick, onHover }: {
  shares: Share[];
  range: Range;
  onRange: (r: Range) => void;
  focus: string | null;
  picked: string | null;
  onPick: (id: string | null) => void;
  onHover: (id: string | null) => void;
}) {
  const inWheel = useMemo(() => shares.filter((x) => x.count), [shares]);
  const worlds = useMemo(() => skyMix(shares), [shares]);
  const sel = picked ? shares.find((x) => x.p.id === picked) : undefined;
  // only someone with a slice can light it; anyone else leaves the wheel as it is
  const lit = focus && inWheel.some((x) => x.p.id === focus) ? focus : null;
  return (
    <section class="journal-top pp-top" style={worlds[0] ? { '--sky': `var(--emo-${worlds[0]})` } : undefined} aria-label={t('What’s on your mind')}>
      <Sky world={worlds[0] ?? null} worlds={worlds} />
      <header class="pp-top-head">
        <h2 class="section-title">{t('What’s on your mind')}</h2>
        <button class="pp-more" onClick={() => navigate('people/mind')}>{t('See all')}<Icon name="chevron-right" size={14} /></button>
      </header>
      <RangeChips range={range} onRange={onRange} />
      <Wheel key={range} shares={inWheel} focus={lit} picked={picked} onPick={onPick} onHover={onHover} />
      {sel ? <MindCard sel={sel} /> : <MindSummary shares={shares} range={range} />}
    </section>
  );
}

/* ---------- how they make you feel: everyone on one line, from heavy to warm ---------- */

interface Dot { r: Read; x: number; y: number; size: number }

/**
 * Lays people along the line by how warm they feel (left heavy, right warm), the ones you feel most about biggest
 * and nearest the middle, the rest nudged up or down until nobody overlaps.
 */
function swarm(reads: Read[], width: number): Dot[] {
  const EDGE = 26; // room for the biggest face at either end
  const max = Math.max(1, ...reads.map((r) => r.warm + r.hard));
  const out: Dot[] = [];
  for (const r of [...reads].sort((a, b) => b.warm + b.hard - (a.warm + a.hard))) {
    const size = Math.round(26 + 14 * Math.sqrt((r.warm + r.hard) / max));
    const x = EDGE + r.warmth! * (width - 2 * EDGE);
    let y = 0;
    for (let k = 0; k < 240; k++) {
      const dy = (k % 2 ? -1 : 1) * Math.ceil(k / 2) * 2;
      if (out.every((o) => (o.x - x) ** 2 + (o.y - dy) ** 2 >= (o.size / 2 + size / 2 + 3) ** 2)) { y = dy; break; }
    }
    out.push({ r, x, y, size });
  }
  return out;
}

function FeelMap({ reads, focus, onPick, onHover }: { reads: Read[]; focus: string | null; onPick: (id: string) => void; onHover: (id: string | null) => void }) {
  const field = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    const el = field.current;
    if (!el) return;
    setWidth(Math.round(el.clientWidth));
    const ro = new ResizeObserver(() => setWidth(Math.round(el.clientWidth)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const felt = useMemo(() => reads.filter((r) => r.warmth !== null && r.p.name.trim()), [reads]);
  const unfelt = useMemo(() => reads.filter((r) => r.warmth === null && r.p.name.trim()), [reads]);
  const dots = useMemo(() => (width ? swarm(felt, width) : []), [felt, width]);
  const reach = dots.reduce((m, d) => Math.max(m, Math.abs(d.y) + d.size / 2), 22);
  const n = (f: Feel) => felt.filter((r) => r.feel === f).length;
  const on = focus ? reads.find((r) => r.p.id === focus) : undefined;

  const most = (['lifts', 'mixed', 'weighs'] as Feel[]).sort((a, b) => n(b) - n(a))[0];
  const reading = !felt.length
    ? t('Add how people make you feel, or log feelings in notes about them, and they’ll find their place on this line.')
    : most === 'lifts'
      ? t('Most of the people you write about leave you warmer. Those ties are worth tending.')
      : most === 'mixed'
        ? t('Many of your ties are mixed. That’s common with the people who matter most, and worth noticing.')
        : t('More of your people weigh on you than lift you up right now. Who gives you energy back?');

  return (
    <section class="pp-feel section" aria-label={t('How they make you feel')}>
      <h2 class="section-title"><Icon name="heart-handshake" size={16} />{t('How they make you feel')}</h2>
      <div class="pp-feel-card card" data-focus={on && on.warmth !== null ? '' : undefined}>
        <div class="pp-field" ref={field} style={{ height: `${reach * 2 + 28}px` }}>
          <span class="pp-third" style={{ left: '33.3%' }} />
          <span class="pp-third" style={{ left: '66.6%' }} />
          {dots.map(({ r, x, y, size }, i) => (
            <button
              key={r.p.id}
              class={`pp-dot${focus === r.p.id ? ' on' : ''}`}
              style={{ left: `${x}px`, top: `calc(50% + ${y}px)`, '--c': colorOf(r.core), '--i': i }}
              onClick={() => onPick(r.p.id)}
              onPointerEnter={(e) => e.pointerType === 'mouse' && onHover(r.p.id)}
              onPointerLeave={() => onHover(null)}
              aria-label={`${r.p.name}: ${FEEL_LINE[r.feel]}`}
              aria-pressed={focus === r.p.id}
            >
              <Avatar p={r.p} size={size} />
            </button>
          ))}
        </div>
        <div class="pp-scale" aria-hidden="true">
          <span>{t('Weighs on you')} <b>{n('weighs')}</b></span>
          <span>{t('Mixed')} <b>{n('mixed')}</b></span>
          <span>{t('Lifts you up')} <b>{n('lifts')}</b></span>
        </div>
        {unfelt.length > 0 && (
          <div class="pp-unfelt">
            <span class="pp-unfelt-label">{t('Not felt yet')}</span>
            <span class="pp-unfelt-faces">
              {unfelt.map((r) => (
                <button class={focus === r.p.id ? 'on' : undefined} onClick={() => onPick(r.p.id)} onPointerEnter={(e) => e.pointerType === 'mouse' && onHover(r.p.id)} onPointerLeave={() => onHover(null)} aria-label={r.p.name} title={r.p.name}>
                  <Avatar p={r.p} size={24} />
                </button>
              ))}
            </span>
          </div>
        )}
      </div>
      {on ? (
        <div class="pp-feel-who" key={on.p.id} style={{ '--c': colorOf(on.core) }}>
          <div class="pp-feel-who-main">
            <b>{on.p.name || t('Unnamed')}</b>
            <span>{FEEL_LINE[on.feel]}</span>
            {on.feelings.length > 0 && <span class="note-emos">{on.feelings.map((id) => <EmotionChip id={id} size="sm" />)}</span>}
          </div>
          <button class="icon-btn" onClick={() => navigate('person/' + on.p.id)} aria-label={t('Open {name}', { name: on.p.name })} title={t('Open')}><Icon name="chevron-right" /></button>
        </div>
      ) : (
        <p class="pp-feel-read">{reading}</p>
      )}
    </section>
  );
}

/* ---------- shifting lately: warmer or heavier than before ---------- */

/** Twelve months as small bars: how much you felt with them each month, in the colour you felt most. */
function MonthBars({ months }: { months: Month[] }) {
  const max = Math.max(1, ...months.map((m) => m.total));
  return (
    <span class="pp-months" aria-hidden="true">
      {months.map((m) => (
        <i style={m.total ? { height: `${Math.max(18, (m.total / max) * 100)}%`, background: colorOf(m.worlds[0][0]) } : undefined} />
      ))}
    </span>
  );
}

function Shifting({ reads, onHover }: { reads: Read[]; onHover: (id: string | null) => void }) {
  const list = useMemo(() => reads
    .filter((r) => r.moments.length > 2)
    .map((r) => { const months = monthsOf(r.moments); return { r, months, trend: trendOf(months) }; })
    .filter((x) => x.trend === 'warmer' || x.trend === 'heavier')
    .sort((a, b) => (b.r.last ?? 0) - (a.r.last ?? 0))
    .slice(0, 4), [reads]);
  if (!list.length) return null;
  return (
    <section class="pp-note">
      <h2 class="section-title"><Icon name="trending-up" size={16} />{t('Shifting lately')}</h2>
      <div class="card list">
        {list.map(({ r, months, trend }) => (
          <button class="pp-mini" onClick={() => navigate('person/' + r.p.id)} onPointerEnter={(e) => e.pointerType === 'mouse' && onHover(r.p.id)} onPointerLeave={() => onHover(null)}>
            <Avatar p={r.p} size={34} />
            <span class="pp-mini-main">
              <span class="pp-mini-name">{r.p.name}</span>
              <span class={`pp-trend is-${trend}`}>
                <Icon name="trending-up" size={14} />
                {trend === 'warmer' ? t('Warmer than before') : t('Heavier than before')}
              </span>
            </span>
            <MonthBars months={months} />
          </button>
        ))}
      </div>
    </section>
  );
}

/* ---------- drifting away: quiet for a month or more ---------- */

const QUIET_DAYS = 30;

/**
 * The people you haven't thought of in a month or more, the ones who used to be on your mind most first: someone
 * you've written about before, or added a while ago and never since. A tap checks in or writes about them.
 */
function Drifting({ reads }: { reads: Read[] }) {
  const quiet = useMemo(() => {
    const now = Date.now();
    const since = (r: Read) => r.last ?? r.p.created;
    return reads
      .filter((r) => r.p.name.trim() && now - since(r) >= QUIET_DAYS * DAY)
      .sort((a, b) => b.moments.length - a.moments.length || since(a) - since(b))
      .slice(0, 5)
      .map((r) => ({ r, days: Math.floor((now - since(r)) / DAY), never: r.last === undefined }));
  }, [reads]);
  if (!quiet.length) return null;
  return (
    <section class="pp-note">
      <h2 class="section-title"><Icon name="hourglass" size={16} />{t('Drifting away')}</h2>
      <div class="card list">
        {quiet.map(({ r, days, never }) => {
          const first = r.p.name.trim().split(/\s+/)[0];
          return (
            <div key={r.p.id} class="pp-mini">
              <button class="pp-mini-open" onClick={() => navigate('person/' + r.p.id)}>
                <Avatar p={r.p} size={34} />
                <span class="pp-mini-main">
                  <span class="pp-mini-name">{r.p.name}</span>
                  <span class="pp-mini-sub">{never ? t('Added {when}', { when: ago(days) }) : t('Last {when}', { when: ago(days) })}</span>
                </span>
              </button>
              <button class="icon-btn small" onClick={() => navigate('tracker?person=' + r.p.id)} aria-label={t('Check in about {name}', { name: first })} title={t('Check in')}>
                <Icon name="mood-smile" size={16} />
              </button>
              <button class="icon-btn small" onClick={() => navigate('note/new?person=' + r.p.id)} aria-label={t('Write about {title}', { title: first })} title={t('Write about them')}>
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

/* ---------- coming up: their days in the next month ---------- */

function ComingUp({ people }: { people: Person[] }) {
  const list = useMemo(() => upcoming(people, 30).slice(0, 4), [people]);
  if (!list.length) return null;
  return (
    <section class="pp-note">
      <h2 class="section-title"><Icon name="cake" size={16} />{t('Coming up')}</h2>
      <div class="card list">
        {list.map((u) => {
          const { what, years } = whatsComing(u);
          return (
            <button class={`pp-mini${u.days === 0 ? ' is-today' : ''}`} onClick={() => navigate('person/' + u.person.id)}>
              <span class="coming-icon"><Icon name={u.date.kind === 'birthday' ? 'cake' : u.date.kind === 'anniversary' ? 'heart' : 'calendar-event'} size={18} /></span>
              <span class="pp-mini-main">
                <span class="pp-mini-name">{what}</span>
                <span class="pp-mini-sub">{[whenLabel(u.days), u.days > 1 ? formatDate(u.on, { weekday: 'short', day: 'numeric', month: 'short' }) : '', years].filter(Boolean).join(' · ')}</span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

/* ---------- everyone, in their circles ---------- */

type Group = 'circle' | 'feel' | 'name';
const GROUPS: [Group, string][] = [['circle', t('Circles')], ['feel', t('Feelings')], ['name', t('A–Z')]];

function Everyone({ reads, shares, focus, onHover }: { reads: Read[]; shares: Share[]; focus: string | null; onHover: (id: string | null) => void }) {
  const [q, setQ] = useState('');
  const [group, setGroup] = usePref<Group>('people-group', 'circle', GROUPS.map(([g]) => g));
  const share = useMemo(() => new Map(shares.map((x) => [x.p.id, x])), [shares]);
  const top = shares[0]?.share || 1;

  const runs = useMemo(() => {
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const list = reads.filter((r) => words.every((w) => searchText(r.p).includes(w)));
    const byNear = (a: Read, b: Read) => b.near - a.near || (b.last ?? 0) - (a.last ?? 0) || a.p.name.localeCompare(b.p.name);
    if (group === 'name') {
      list.sort((a, b) => a.p.name.localeCompare(b.p.name));
      return runsOf(list, (r) => letterOf(r.p.name)).map(([label, rs]) => ({ id: label, title: label, note: '', rs }));
    }
    if (group === 'feel') {
      return FEELS.map(([id, title, note]) => ({
        id, title, note,
        // the warmest of the warm first, the heaviest of the heavy first
        rs: list.filter((r) => r.feel === id).sort((a, b) => (id === 'weighs' ? (a.warmth ?? 0) - (b.warmth ?? 0) : id === 'lifts' ? (b.warmth ?? 0) - (a.warmth ?? 0) : 0) || byNear(a, b)),
      })).filter((g) => g.rs.length);
    }
    return CIRCLES.map(([id, title, note]) => ({ id, title, note, rs: list.filter((r) => r.circle === id).sort(byNear) })).filter((g) => g.rs.length);
  }, [reads, q, group]);
  const shown = runs.reduce((s, g) => s + g.rs.length, 0);

  return (
    <section class="pp-all section">
      <header class="pp-all-head">
        <h2 class="section-title"><Icon name="users" size={16} />{t('Everyone')}<span class="pp-count">{reads.length}</span></h2>
        <div class="chips" role="toolbar" aria-label={t('Group by')}>
          {GROUPS.map(([id, name]) => <button class="chip" aria-pressed={group === id} onClick={() => setGroup(id)}>{name}</button>)}
        </div>
      </header>
      <label class="search">
        <Icon name="search" size={18} />
        <input type="search" placeholder={t('Search people')} value={q} onInput={(e) => setQ(e.currentTarget.value)} aria-label={t('Search people')} />
      </label>
      {!shown && (
        <div class="empty-note center">
          <p>{t('No one matches “{q}”.', { q: q.trim() })}</p>
          <button class="btn btn-quiet" onClick={() => setQ('')}>{t('Clear search')}</button>
        </div>
      )}
      {runs.map((g) => (
        <section class={`pp-run is-${g.id}`} key={`${group}:${g.id}`}>
          <h3 class="pp-run-head">
            <span class="pp-run-title">{g.title}</span>
            <span class="pp-count">{g.rs.length}</span>
          </h3>
          {g.note && <p class="pp-run-note">{g.note}</p>}
          <div class={g.id === 'inner' ? 'pp-inner' : 'card list pp-rows'}>
            {g.rs.map((r) => (g.id === 'inner'
              ? <PersonCard key={r.p.id} r={r} on={focus === r.p.id} onHover={onHover} />
              : <PersonRow key={r.p.id} r={r} share={share.get(r.p.id)} top={top} on={focus === r.p.id} onHover={onHover} />))}
          </div>
        </section>
      ))}
    </section>
  );
}

/** "Coworker · 18 moments · last 28 Oct" */
function factsOf(r: Read) {
  const n = r.moments.length;
  return [r.p.relation, n ? count(n, 'moment', 'moments') : '', r.last ? t('last {date}', { date: lastSeen(keyOf(new Date(r.last))) }) : ''].filter(Boolean).join(' · ');
}

/**
 * Someone in a ring of the list: who they are, and a bar as long as the share of your thoughts they take up, coloured
 * by what you feel with them.
 */
function PersonRow({ r, share, top, on, onHover }: { r: Read; share: Share | undefined; top: number; on: boolean; onHover: (id: string | null) => void }) {
  const total = r.mix.reduce((s, [, w]) => s + w, 0);
  return (
    <button
      class={`pp-row${on ? ' on' : ''}`}
      style={{ '--c': colorOf(r.core) }}
      onClick={() => navigate('person/' + r.p.id)}
      onPointerEnter={(e) => e.pointerType === 'mouse' && onHover(r.p.id)}
      onPointerLeave={() => onHover(null)}
    >
      <Avatar p={r.p} size={40} />
      <span class="pp-row-main">
        <span class="pp-row-name">{r.p.name || t('Unnamed')}</span>
        <span class="pp-row-sub">{factsOf(r)}</span>
      </span>
      {r.feelings.length > 0 && <span class="pp-row-feel note-emos">{r.feelings.slice(0, 2).map((id) => <EmotionChip id={id} size="sm" />)}</span>}
      <span class="pp-row-mind" title={t('Share of your thoughts')}>
        <span class="pp-bar" style={{ '--w': share?.count ? share.share / top : 0 }}>
          <span>{(total ? r.mix.slice(0, 4) : [[r.core ?? '', 1] as [string, number]]).map(([c, w]) => <i style={{ flex: w, background: colorOf(c || null) }} />)}</span>
        </span>
        <b>{share?.count ? pctOf(share.share) : '—'}</b>
      </span>
    </button>
  );
}

/** Where the feelings float on a card: off to the right, clear of the name, each on its own slow loop. */
const SPOTS = [
  { right: '15%', top: '14%', size: 13, dur: 7.4 },
  { right: '31%', bottom: '13%', size: 11, dur: 9.1 },
  { right: '7%', bottom: '16%', size: 10, dur: 8.3 },
];

/**
 * Someone in your inner circle, in the colour of what they make you feel: a small sky of their worlds drifts through
 * the card, drawn in their main world's letters, and their feelings' sprites float around it. The sky is only
 * there while the card is on (or near) the screen.
 */
function PersonCard({ r, on, onHover }: { r: Read; on: boolean; onHover: (id: string | null) => void }) {
  const { p } = r;
  const worlds = useMemo(() => r.mix.map(([c]) => c), [r.mix]);
  const ref = useRef<HTMLButtonElement>(null);
  const [live, setLive] = useState(false);
  useEffect(() => {
    const el = ref.current;
    return el && worlds.length
      ? watchView(el, (on) => { el.toggleAttribute('data-live', on); setLive(on); })
      : undefined;
  }, [worlds.length > 0]);
  const sky = useMemo(() => [worlds[0], worlds[1] ?? worlds[0], worlds[2] ?? worlds[0]], [worlds.join()]);
  const style = worlds.length ? { '--m1': `var(--emo-${worlds[0]})`, '--m2': `var(--emo-${worlds[1] ?? worlds[0]})` } : undefined;
  const facts = factsOf(r);
  return (
    <button
      ref={ref}
      class={`person-card card${worlds.length ? ' has-mood' : ''}${on ? ' on' : ''}`}
      style={style}
      onClick={() => navigate('person/' + p.id)}
      onPointerEnter={(e) => e.pointerType === 'mouse' && onHover(p.id)}
      onPointerLeave={() => onHover(null)}
    >
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
        {facts && <div class="person-card-sub">{facts}</div>}
        {r.feelings.length > 0 && (
          <div class="note-emos">{r.feelings.map((id, i) => <EmotionChip id={id} size="sm" idle="view" delay={(p.created + i * 380) % 1300} />)}</div>
        )}
      </div>
      <Icon name="chevron-right" size={18} />
    </button>
  );
}
