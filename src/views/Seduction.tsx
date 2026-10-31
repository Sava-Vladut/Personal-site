import type { JSX } from 'preact';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { goBack, navigateAfterSheet } from '../lib/router';
import { usePref } from '../lib/prefs';
import { haptic } from '../lib/haptics';
import { listOf, t } from '../lib/i18n';
import { toast } from '../lib/store';
import {
  BY_ID, COUNT, DRAWS, ENTRIES, FLOCKS, KINDS, MOVES, PHASES, SEDUCERS, SEDUCER_GROUPS, VICTIMS, groupOf, hueOf,
  type Entry, type Flock, type GroupInfo, type Kind, type Phase,
} from '../data/seduction';
import { FAMILIES, TRAPS, type Trap } from '../data/traps';
import { LAWS, REALMS, type Law } from '../data/laws';
import { addMarks } from '../components/Mark';
import { SEDUCTION_MARKS } from '../data/seduction/marks';
import { Sheet } from '../components/Sheet';
import { PageHead } from '../components/PageHead';
import { LearnShare, SharedEntry, ShareButton, onSharedLink, type ShareTarget } from '../components/LearnShare';
import { Sky } from '../components/Sky';
import { SortChip } from '../components/collection';
import { Aside, Caption, DetailHead, GroupHead, Ico, LensSwitch, LinkRow, Meter, Option, Row, Tally, Today, jumpTop, playIcon, shuffle, useLocal } from '../components/learn';
import '../styles/stats.css';
import '../styles/seduction.css';

/*
 * The Art of Seduction, under Learn, laid out like the other Learn pages (components/learn.tsx): a sky with three
 * figures and the search, then a feature column (the entry of the day, the arc of the 24 moves, who falls for whom, a
 * game and the mind traps the book springs) and the book in three parts, switched at the top of the list: the nine
 * seducers and their opposite, the eighteen victims and the 24 moves in their four phases. Each opens to its history,
 * its psychology, the mind traps it plays on (linked to Mind traps), the laws of power it echoes (linked to Laws of
 * power), how to see it coming and the honest version. The data is in data/seduction.
 */

addMarks(SEDUCTION_MARKS);

const TRAP_BY_ID = new Map(TRAPS.map((x) => [x.id, x]));
const LAW_BY_N = new Map(LAWS.map((x) => [x.n, x]));
const KIND_IDS = Object.keys(KINDS) as Kind[];
const PHASE_IDS = Object.keys(PHASES) as Phase[];
const FLOCK_IDS = Object.keys(FLOCKS) as Flock[];
const NINE = SEDUCERS.filter((x) => !x.anti);
const WORLD = 'love-connection';
const lawHue = (x: Law) => REALMS[x.realm].hue;
const trapHue = (x: Trap) => FAMILIES[x.family].hue;
/** A title without its article, for the charts' tight labels ("Reformed Rake or Siren"). */
const bare = (title: string) => title.replace(/^The /, '');

/** Where an entry sits in its kind: "Move 3", "Victim 12", "Seducer 2", or the Anti-Seducer's place apart. */
const rankOf = (x: Entry) =>
  x.kind === 'move' ? t('Move {n}', { n: x.n }) : x.kind === 'victim' ? t('Victim {n}', { n: x.n }) : x.anti ? t('Their opposite') : t('Seducer {n}', { n: x.n });
/** The same, out of how many: the sheet's title and a shared entry's rank. */
const rankOfAll = (x: Entry) =>
  x.kind === 'move' ? t('Move {n} of {of}', { n: x.n, of: COUNT.move })
    : x.kind === 'victim' ? t('Victim {n} of {of}', { n: x.n, of: COUNT.victim })
      : x.anti ? t('Their opposite') : t('Seducer {n} of {of}', { n: x.n, of: COUNT.seducer });
const groupKey = (x: Entry) => (x.kind === 'move' ? x.phase : x.kind === 'victim' ? x.flock : x.anti ? 'anti' : 'nine');

/** Every mind trap the book springs, most-sprung first, with the entries that spring it. */
const SPRUNG = (() => {
  const by = new Map<string, Entry[]>();
  for (const x of ENTRIES) for (const { id } of x.traps) if (TRAP_BY_ID.has(id)) by.set(id, [...(by.get(id) ?? []), x]);
  return [...by.entries()].map(([id, list]) => ({ trap: TRAP_BY_ID.get(id)!, list })).sort((a, b) => b.list.length - a.list.length);
})();
const LEVERS = new Set(ENTRIES.flatMap((x) => x.levers.map((l) => l.name.toLowerCase()))).size;

/* ---------- the arc: the 24 moves on a spiral, from first notice to the close ---------- */

/** A spiral from the outside in, sampled finely, and the sample each of `count` stops sits at, evenly spaced along it. */
function spiral(count: number, size: number) {
  const c = size / 2, r0 = size / 2 - 16, r1 = 38, turns = 1.62, steps = 720;
  const pts: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const u = i / steps, a = -Math.PI / 2 + u * turns * Math.PI * 2, r = r0 - (r0 - r1) * u;
    pts.push([c + r * Math.cos(a), c + r * Math.sin(a)]);
  }
  const len = [0];
  for (let i = 1; i < pts.length; i++) len.push(len[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]));
  const at: number[] = [];
  for (let k = 0, i = 0; k < count; k++) {
    const want = (k / (count - 1)) * len[len.length - 1];
    while (i < len.length - 1 && len[i] < want) i++;
    at.push(i);
  }
  return { pts, at };
}

function Arc({ open }: { open: (x: Entry) => void }) {
  const [hot, setHot] = useState<string | null>(null);
  const S = 300;
  const { pts, at } = useMemo(() => spiral(MOVES.length, S), []);
  // a stretch of the spiral for each phase, from its first move to the next phase's first
  const legs = useMemo(() => PHASE_IDS.map((p) => {
    const from = MOVES.findIndex((x) => x.phase === p), next = MOVES.findIndex((x, i) => i > from && x.phase !== p);
    const a = at[from], b = next < 0 ? at[at.length - 1] : at[next];
    return { p, d: 'M' + pts.slice(a, b + 1).map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join('L') };
  }), [pts, at]);
  const focus = hot ? MOVES.find((x) => x.id === hot) ?? null : null;
  const leave = (id: string) => setHot((h) => (h === id ? null : h));
  return (
    <div class="sd-arc">
      <svg viewBox={`0 0 ${S} ${S}`} role="group" aria-label={t('The 24 moves on a spiral, from the outside in')}>
        {legs.map(({ p, d }) => <path d={d} class={`sd-arc-leg${focus && focus.phase !== p ? ' dim' : ''}`} style={{ '--c': `var(--emo-${PHASES[p].hue})` }} />)}
        <text x={S / 2} y={S / 2 - 6} text-anchor="middle" class="sd-arc-k">{focus ? t('Phase {n}', { n: PHASE_IDS.indexOf(focus.phase) + 1 }) : t('From the outside in')}</text>
        <text x={S / 2} y={S / 2 + 12} text-anchor="middle" class="sd-arc-name">{focus ? t(PHASES[focus.phase].name) : t('{n} moves', { n: MOVES.length })}</text>
        {MOVES.map((x, i) => {
          const [px, py] = pts[at[i]];
          return (
            <g
              class={`sd-stop${hot === x.id ? ' hot' : ''}${focus && focus.phase !== x.phase ? ' dim' : ''}`}
              style={{ '--c': `var(--emo-${hueOf(x)})` }}
              role="button"
              tabIndex={0}
              aria-label={`${x.n}. ${x.title}`}
              onClick={() => open(x)}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), open(x))}
              onPointerEnter={() => setHot(x.id)}
              onPointerLeave={() => leave(x.id)}
              onFocus={() => setHot(x.id)}
              onBlur={() => leave(x.id)}
            >
              <circle cx={px} cy={py} r={14} class="sd-stop-hit" />
              <circle cx={px} cy={py} r={10} class="sd-stop-dot" />
              <text x={px} y={py} dy="0.36em" text-anchor="middle" class="sd-stop-n">{x.n}</text>
            </g>
          );
        })}
      </svg>
      <ul class="sd-legend" aria-hidden="true">
        {PHASE_IDS.map((p) => <li style={{ '--c': `var(--emo-${PHASES[p].hue})` }}><i class="lrn-dot" />{t(PHASES[p].name)}</li>)}
      </ul>
      <Caption
        title={focus ? `${focus.n}. ${focus.title}` : undefined}
        sub={focus ? `${t(PHASES[focus.phase].motto)} · ${t('tap to open')}` : undefined}
        idle={t('Start at the top and follow it in: four phases, from first notice to the aftermath. Tap a move to read it.')}
      />
    </div>
  );
}

/* ---------- who falls for whom: the nine seducers and the victims who suit them ---------- */

/** The victims in their flocks, so their colours sit together down the right. */
const FLOCKED = FLOCK_IDS.flatMap((f) => VICTIMS.filter((x) => x.flock === f));

function Pairs({ open }: { open: (x: Entry) => void }) {
  const [hot, setHot] = useState<string | null>(null);
  // 12-unit labels in a 400-wide drawing: 10px or more on a phone
  const W = 400, ROW = 19, P = 12, LX = 88, RX = 242, MID = (LX + RX) / 2;
  const H = P * 2 + ROW * (FLOCKED.length - 1);
  const yOf = useMemo(() => new Map<string, number>([
    ...NINE.map((x, i): [string, number] => [x.id, P + (i * (H - P * 2)) / (NINE.length - 1)]),
    ...FLOCKED.map((x, i): [string, number] => [x.id, P + i * ROW]),
  ]), [H]);
  const edges = useMemo(() => FLOCKED.flatMap((v) => v.seducers.filter((s) => yOf.has(s.id)).map((s) => {
    const a = yOf.get(s.id)!, b = yOf.get(v.id)!;
    return { s: s.id, v: v.id, hue: hueOf(v), d: `M${LX} ${a}C${MID} ${a} ${MID} ${b} ${RX} ${b}` };
  })), [yOf]);
  const lit = hot ? new Set(edges.filter((e) => e.s === hot || e.v === hot).flatMap((e) => [e.s, e.v])) : null;
  const focus = hot ? BY_ID.get(hot) ?? null : null;
  const leave = (id: string) => setHot((h) => (h === id ? null : h));
  const others = focus ? edges.filter((e) => e.s === focus.id || e.v === focus.id).map((e) => bare(BY_ID.get(e.s === focus.id ? e.v : e.s)!.title)) : [];

  const node = (x: Entry, left: boolean) => {
    const y = yOf.get(x.id)!;
    return (
      <g
        class={`sd-node${hot === x.id ? ' hot' : ''}${lit && !lit.has(x.id) ? ' dim' : ''}`}
        style={{ '--c': `var(--emo-${hueOf(x)})` }}
        role="button"
        tabIndex={0}
        aria-label={x.title}
        onClick={() => open(x)}
        onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), open(x))}
        onPointerEnter={() => setHot(x.id)}
        onPointerLeave={() => leave(x.id)}
        onFocus={() => setHot(x.id)}
        onBlur={() => leave(x.id)}
      >
        <rect x={left ? 0 : RX - 8} y={y - ROW / 2} width={left ? LX + 8 : W - RX + 8} height={ROW} class="sd-node-hit" />
        <circle cx={left ? LX : RX} cy={y} r={4.5} class="sd-node-dot" />
        <text x={left ? LX - 9 : RX + 9} y={y} dy="0.35em" text-anchor={left ? 'end' : 'start'} class="sd-node-label">{bare(x.title)}</text>
      </g>
    );
  };

  return (
    <div class="sd-pairs">
      <svg viewBox={`0 0 ${W} ${H}`} role="group" aria-label={t('The nine seducers and the victims who fall for each')}>
        <g class={`sd-edges${lit ? ' is-lit' : ''}`}>
          {edges.map((e) => <path d={e.d} class={lit && (e.s === hot || e.v === hot) ? 'on' : undefined} style={{ '--c': `var(--emo-${e.hue})` }} />)}
        </g>
        {NINE.map((x) => node(x, true))}
        {FLOCKED.map((x) => node(x, false))}
      </svg>
      <Caption
        title={focus?.title}
        sub={focus ? (focus.kind === 'seducer' ? t('Draws in {list}', { list: listOf(others) }) : t('Falls for {list}', { list: listOf(others) })) : undefined}
        idle={t('The seducers on the left, the victims on the right, coloured by what they hunger for. Point at either to see who suits whom.')}
      />
    </div>
  );
}

/* ---------- name it ---------- */

function deal(not?: string) {
  const pool = ENTRIES.filter((x) => x.id !== not);
  const x = pool[Math.floor(Math.random() * pool.length)];
  // the wrong answers are of the same kind, from other groups when there are enough, so the game turns on the idea, not the colour
  const same = ENTRIES.filter((o) => o.kind === x.kind && o.id !== x.id);
  const apart = same.filter((o) => groupKey(o) !== groupKey(x));
  const others = shuffle(apart.length >= 3 ? apart : same).slice(0, 3);
  return { x, options: shuffle([x, ...others]) };
}

const ASK: Record<Kind, string> = { move: 'Which move is being played?', seducer: 'Which seducer is this?', victim: 'Which kind of victim is this?' };

/**
 * A modern scene and four answers of the same kind. Nothing changes size when you answer or deal the next one: the
 * scene keeps room for its longest, the verdict comes into a slot that's always there, and the foot is laid out from the start.
 */
function NameIt({ open }: { open: (x: Entry) => void }) {
  const [round, setRound] = useState(() => deal());
  const [picked, setPicked] = useState<string | null>(null);
  const [score, setScore] = useState({ right: 0, played: 0, streak: 0 });
  const pick = (id: string) => {
    if (picked != null) return;
    const right = id === round.x.id;
    haptic(right ? 6 : 14);
    setPicked(id);
    setScore((s) => ({ right: s.right + (right ? 1 : 0), played: s.played + 1, streak: right ? s.streak + 1 : 0 }));
  };
  const next = () => { setRound(deal(round.x.id)); setPicked(null); };
  const won = picked === round.x.id;
  return (
    <section class="card lrn-card">
      <header class="lrn-card-head">
        <h3 class="lrn-card-title">{t('Name it')}</h3>
        <p class="lrn-card-sub">{t(ASK[round.x.kind])}</p>
      </header>
      <div class="lrn-quiz">
        <p class="lrn-q sd-scene">{round.x.scenario}</p>
        <div class="lrn-opts">
          {round.options.map((o, i) => {
            const state = picked == null ? 'idle' : o.id === round.x.id ? 'right' : picked === o.id ? 'wrong' : 'idle';
            return <Option index={i} label={o.title} state={state} disabled={picked != null && state === 'idle'} pressed={picked === o.id} onClick={() => pick(o.id)} />;
          })}
        </div>
        <div class="sd-verdict" role="status">
          {picked != null && (
            <p class="lrn-verdict">
              <b class={won ? 'is-right' : 'is-wrong'}>{won ? t('Right.') : t('It was {title}.', { title: round.x.title })}</b> {round.x.line}
            </p>
          )}
        </div>
        <div class="lrn-quiz-foot">
          <p class="lrn-score">{score.played > 0 ? `${t('{right} of {played}', score)}${score.streak > 2 ? ` · ${t('{n} in a row', { n: score.streak })}` : ''}` : ''}</p>
          {/* always laid out (hidden until you answer), so the card keeps its height between rounds */}
          <div class="sd-game-actions" style={picked == null ? { visibility: 'hidden' } : undefined}>
            <button class="btn btn-quiet btn-s" onClick={() => open(round.x)}>{t('Read it')}</button>
            <button class="btn btn-primary btn-s" onClick={next}>{t('Next one')} <Ico name="chevron-right" size={16} /></button>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- what you've seen ---------- */

/** On this device, by id: how often a move or a type has been played on you and by you, and the victims you see yourself in. */
type Seen = Record<string, { on?: number; by?: number; me?: boolean }>;

/* ---------- one entry, opened ---------- */

type Lens = 'player' | 'target';
const LENSES: Lens[] = ['player', 'target'];
/** The chapters, in the order each lens reads them: the seducer meets the idea and why it works first, the target how
 *  to spot it and defend themselves. A move has no `core` (what a type offers, or what a victim lacks). */
type Chapter = 'what' | 'core' | 'why' | 'test' | 'today' | 'signs' | 'defence';
const READING: Record<Lens, Chapter[]> = {
  player: ['what', 'core', 'why', 'test', 'today', 'signs', 'defence'],
  target: ['signs', 'defence', 'today', 'what', 'core', 'why', 'test'],
};

/** What each part of an entry is called, by kind (the Anti-Seducer reads its signs and defence as your own). */
function labelsOf(x: Entry) {
  if (x.kind === 'victim') {
    return {
      what: t('The type'), why: t('Why they fall'), today: t('Where you’ll meet them today'), signs: t('How to recognise them'), defence: t('If this is you'),
      shadow: t('How it gets used'), honest: t('What would really meet it'), dark: t('Exposed'), darkAbout: t('How easily the hunger is played on'),
      everydayAbout: t('How often you meet the type'),
      player: t('Starts with the type and what they lack, then how to recognise them'), target: t('Starts with how to recognise the type, and what to do if it’s you'),
    };
  }
  const anti = x.kind === 'seducer' && x.anti;
  return {
    what: x.kind === 'move' ? t('The move') : t('The type'),
    why: anti ? t('Why it repels') : t('Why it works'),
    today: t('Where you’ll meet it today'),
    signs: anti ? t('Signs it’s you') : x.kind === 'seducer' ? t('How to spot one') : t('How to spot it'),
    defence: anti ? t('The cure') : x.kind === 'seducer' ? t('How to keep your head') : t('How to defend yourself'),
    shadow: x.kind === 'seducer' ? t('The dangers') : t('The shadow side'),
    honest: t('The honest version'),
    dark: t('Darkness'), darkAbout: t('How manipulative it is'), everydayAbout: t('How often you meet it in ordinary life'),
    player: x.kind === 'move' ? t('Starts with the move and why it works, then how to spot it') : t('Starts with the type and why it works, then how to spot one'),
    target: x.kind === 'move' ? t('Starts with how to spot it and defend yourself, then the move') : t('Starts with how to spot one and keep your head, then the type'),
  };
}

function EntryDetail({ x, lens, onLens, seen, onSeen, onMe, go, openTrap, openLaw, onShare }: {
  x: Entry;
  lens: Lens;
  onLens: (l: Lens) => void;
  seen: { on?: number; by?: number; me?: boolean };
  onSeen: (k: 'on' | 'by') => void;
  onMe: () => void;
  /** Left out on a shared link, with the links they follow: only what was shared shows. */
  go?: (id: string) => void;
  openTrap?: (id: string) => void;
  openLaw?: (n: number) => void;
  onShare?: () => void;
}) {
  const L = labelsOf(x);
  const group = groupOf(x);
  const traps = x.traps.map((s) => ({ ...s, trap: TRAP_BY_ID.get(s.id) })).filter((s): s is typeof s & { trap: Trap } => !!s.trap);
  const laws = x.laws.map((s) => ({ ...s, law: LAW_BY_N.get(s.n) })).filter((s): s is typeof s & { law: Law } => !!s.law);
  const kin = x.kin.map((k) => BY_ID.get(k)).filter((k): k is Entry => !!k);
  // a seducer's victims, or a victim's seducers, and why they suit each other
  const pairs = x.kind === 'victim'
    ? x.seducers.map(({ id, how }) => ({ e: BY_ID.get(id), how })).filter((p): p is { e: Entry; how: string } => !!p.e)
    : x.kind === 'seducer' ? (DRAWS.get(x.id) ?? []).map(({ v, how }) => ({ e: v as Entry, how })) : [];
  // on a shared link there's nowhere to go (no handlers), so those links hide, and with them the whole section
  const linked = (go && (pairs.length > 0 || kin.length > 0)) || (openTrap && traps.length > 0) || (openLaw && laws.length > 0);

  // one idea to a chapter: a heading and one paragraph, and at most one list or story under it. Keyed, so switching
  // the lens moves them rather than rewriting them in place.
  const chapters: Record<Chapter, JSX.Element | null> = {
    what: (
      <section class="lrn-d-sec" key="what">
        <h3 class="lrn-d-h">{L.what}</h3>
        <p class="lrn-d-p is-lead">{x.gist}</p>
        <Aside icon="book" label={t('From history')} title={x.scene.who} who={x.scene.when}>{x.scene.text}</Aside>
      </section>
    ),
    core: x.kind === 'seducer' ? (
      <section class="lrn-d-sec" key="core">
        <h3 class="lrn-d-h">{x.anti ? t('What they fail to offer') : t('What they offer')}</h3>
        <p class="lrn-d-p">{x.offers}</p>
        <div class="lrn-d-group">
          <p class="kicker">{x.anti ? t('Its kinds') : t('Its faces')}</p>
          <ul class="lrn-list">{x.faces.map((l) => <li><b>{l.name}</b>. {l.text}</li>)}</ul>
        </div>
      </section>
    ) : x.kind === 'victim' ? (
      <section class="lrn-d-sec" key="core">
        <h3 class="lrn-d-h">{t('What they lack')}</h3>
        <p class="lrn-d-p">{x.lack}</p>
      </section>
    ) : null,
    why: (
      <section class="lrn-d-sec" key="why">
        <h3 class="lrn-d-h">{L.why}</h3>
        <p class="lrn-d-p">{x.mind}</p>
        <div class="lrn-d-group">
          <p class="kicker">{t('The levers it pulls')}</p>
          <ul class="lrn-list">{x.levers.map((l) => <li><b>{l.name}</b>. {l.text}</li>)}</ul>
        </div>
      </section>
    ),
    test: (
      <section class="lrn-d-sec" key="test">
        <h3 class="lrn-d-h">{t('Put to the test')}</h3>
        <Aside icon="info-circle" label={t('The experiment')} title={x.study.title} who={x.study.who}>{x.study.text}</Aside>
      </section>
    ),
    today: (
      <section class="lrn-d-sec" key="today">
        <h3 class="lrn-d-h">{L.today}</h3>
        <ul class="lrn-list">{x.today.map((l) => <li>{l}</li>)}</ul>
      </section>
    ),
    signs: (
      <section class="lrn-d-sec" key="signs">
        <h3 class="lrn-d-h">{L.signs}</h3>
        <ul class="lrn-list">{x.signs.map((l) => <li>{l}</li>)}</ul>
      </section>
    ),
    defence: (
      <section class="lrn-d-sec" key="defence">
        <h3 class="lrn-d-h">{L.defence}</h3>
        <ol class="lrn-list is-steps">{x.defense.map((l) => <li>{l}</li>)}</ol>
      </section>
    ),
  };

  return (
    <article class="lrn-detail" key={x.id}>
      {/* on a wide screen the head and the scores are a rail at the left and the chapters one reading column beside it (learn.css) */}
      <div class="lrn-d-rail">
        <DetailHead id={x.id} hue={hueOf(x)} kicker={`${rankOf(x)} · ${t(group.name)}`} title={x.title} line={x.line} onShare={onShare} />
        <div class="lrn-meters">
          <Meter label={L.dark} value={x.dark} about={L.darkAbout} />
          <Meter label={t('Everyday')} value={x.everyday} about={L.everydayAbout} />
        </div>
      </div>

      <div class="lrn-d-flow">
        {/* the lens, right over the chapters it reorders */}
        <LensSwitch
          label={t('Read as')}
          value={lens}
          onChange={onLens}
          options={[
            { id: 'player', icon: 'flame', label: t('As the seducer'), hint: L.player },
            { id: 'target', icon: 'eye', label: x.kind === 'victim' ? t('As yourself') : t('As the target'), hint: L.target },
          ]}
        />
        {READING[lens].map((c) => chapters[c])}

        {/* the balance, after the core: where it goes wrong, and the version worth keeping */}
        <div class="lrn-pair">
          <Aside icon="moon" label={L.shadow}>{x.shadow}</Aside>
          <Aside icon="heart" label={L.honest}>{x.honest}</Aside>
        </div>

        {/* reflection and action together: the question, then the counts it might prompt */}
        <section class="lrn-d-sec">
          <h3 class="lrn-d-h">{t('Your turn')}</h3>
          <blockquote class="lrn-quote">
            <small>{t('A question to sit with')}</small>
            {x.question}
          </blockquote>
          <div class="lrn-actions">
            {x.kind === 'victim' ? (
              <>
                <Tally icon="user" label={t('That’s me')} pressed={!!seen.me} onClick={() => { haptic(10); onMe(); }} />
                <Tally icon="eye" label={t('I know one')} n={seen.on ?? 0} onClick={() => { haptic(10); onSeen('on'); }} />
              </>
            ) : (
              <>
                <Tally icon="eye" label={x.kind === 'seducer' && x.anti ? t('I’ve met one') : t('Played on me')} n={seen.on ?? 0} onClick={() => { haptic(10); onSeen('on'); }} />
                <Tally icon="flame" label={x.kind === 'seducer' && x.anti ? t('I’ve been one') : t('I played it')} n={seen.by ?? 0} onClick={() => { haptic(10); onSeen('by'); }} />
              </>
            )}
          </div>
        </section>

        {/* every link out, at the end, so none breaks the reading: each kind under its own label */}
        {linked && (
          <section class="lrn-d-sec">
            <h3 class="lrn-d-h">{t('Connections')}</h3>
            {go && pairs.length > 0 && (
              <div class="lrn-d-group">
                <p class="kicker">{x.kind === 'victim' ? t('The seducers who suit them') : t('The victims who fall for them')}</p>
                <div class="lrn-links">
                  {pairs.map(({ e, how }) => <LinkRow hue={hueOf(e)} id={e.id} kicker={rankOf(e)} title={e.title} how={how} onClick={() => go(e.id)} />)}
                </div>
              </div>
            )}
            {openTrap && traps.length > 0 && (
              <div class="lrn-d-group">
                <p class="kicker">{t('The mind traps it plays on')}</p>
                <div class="lrn-links">
                  {traps.map(({ trap, how }) => <LinkRow hue={trapHue(trap)} id={trap.id} title={trap.name} how={how} onClick={() => openTrap(trap.id)} />)}
                </div>
              </div>
            )}
            {openLaw && laws.length > 0 && (
              <div class="lrn-d-group">
                <p class="kicker">{t('The laws of power it echoes')}</p>
                <div class="lrn-links">
                  {laws.map(({ law, how }) => <LinkRow hue={lawHue(law)} id={law.id} kicker={t('Law {n}', { n: law.n })} title={law.title} how={how} onClick={() => openLaw(law.n)} />)}
                </div>
              </div>
            )}
            {go && kin.length > 0 && (
              <div class="lrn-d-group">
                <p class="kicker">{t('Related')}</p>
                <ol class="lrn-rows">
                  {kin.map((k) => <Row id={k.id} hue={hueOf(k)} top={`${rankOf(k)} · ${t(groupOf(k).name)}`} title={k.title} onClick={() => go(k.id)} />)}
                </ol>
              </div>
            )}
          </section>
        )}
      </div>
    </article>
  );
}

/* ---------- the page ---------- */

type Sort = 'group' | 'dark' | 'everyday';
const SORTS: Sort[] = ['group', 'dark', 'everyday'];

/** The groups a kind's list is split into, in order, with what each is called. */
function groupsOf(kind: Kind): [string, GroupInfo][] {
  if (kind === 'move') return PHASE_IDS.map((p) => [p, PHASES[p]]);
  if (kind === 'victim') return FLOCK_IDS.map((f) => [f, FLOCKS[f]]);
  return (['nine', 'anti'] as const).map((g) => [g, SEDUCER_GROUPS[g]]);
}

export function Seduction({ query: params }: { query: URLSearchParams }) {
  const [open, setOpen] = useState<string | null>(() => params.get('open'));
  const [sharing, setSharing] = useState<ShareTarget | null>(null);
  // a shared link to one entry shows just that entry, as a page
  const [solo] = useState(() => onSharedLink && open !== null);
  const [kind, setKind] = usePref<Kind>('seduction-kind', 'seducer', KIND_IDS);
  const [group, setGroup] = useState('all');
  const [sort, setSort] = usePref<Sort>('seduction-sort', 'group', SORTS);
  const [lens, setLens] = usePref<Lens>('seduction-lens', 'player', LENSES);
  const [query, setQuery] = useState('');
  const [seen, setSeen] = useLocal<Seen>('mm-seduction-seen', {});
  // counted at once, with Undo for a slip of the finger
  const addSeen = (id: string, k: 'on' | 'by') => {
    setSeen({ ...seen, [id]: { ...seen[id], [k]: (seen[id]?.[k] ?? 0) + 1 } });
    toast(t('Counted'), { label: t('Undo'), run: () => setSeen((s) => ({ ...s, [id]: { ...s[id], [k]: Math.max(0, (s[id]?.[k] ?? 0) - 1) } })) });
  };
  const toggleMe = (id: string) => setSeen((s) => ({ ...s, [id]: { ...s[id], me: !s[id]?.me } }));
  const body = useRef<HTMLDivElement>(null);

  const today = ENTRIES[Math.floor((Date.now() - new Date().getTimezoneOffset() * 60_000) / 86_400_000) % ENTRIES.length];
  const q = query.trim().toLowerCase();
  const pickKind = (k: Kind) => { setKind(k); setGroup('all'); };

  const groups = useMemo(() => {
    // a search looks through all three parts at once, each under its own head
    const pool = q ? ENTRIES : ENTRIES.filter((x) => x.kind === kind && (group === 'all' || groupKey(x) === group));
    const list = pool.filter((x) => !q || `${x.title} ${x.line} ${x.gist} ${x.scene.who} ${x.signs.join(' ')} ${x.levers.map((l) => l.name).join(' ')} ${x.kind === 'seducer' ? x.faces.map((f) => f.name).join(' ') : ''}`.toLowerCase().includes(q));
    if (sort === 'dark') list.sort((a, b) => b.dark - a.dark || a.n - b.n);
    if (sort === 'everyday') list.sort((a, b) => b.everyday - a.everyday || a.n - b.n);
    if (q) return KIND_IDS.map((k) => ({ key: k, title: t(KINDS[k].name), info: null as GroupInfo | null, list: list.filter((x) => x.kind === k) })).filter((g) => g.list.length);
    if (sort === 'group') return groupsOf(kind).map(([key, info]) => ({ key, title: t(info.name), info, list: list.filter((x) => groupKey(x) === key) })).filter((g) => g.list.length);
    const info = group === 'all' ? null : groupsOf(kind).find(([k]) => k === group)?.[1] ?? null;
    return list.length ? [{ key: 'all', title: info ? t(info.name) : t(KINDS[kind].name), info, list }] : [];
  }, [q, kind, group, sort]);
  const any = groups.length > 0;
  const seenOn = Object.values(seen).reduce((s, v) => s + (v.on ?? 0), 0);

  const openEntry = (x: Entry) => { haptic(5); setOpen(x.id); };
  // to another entry inside the sheet: back to its top at once, in the same tick, so the new one starts at its head
  const go = (id: string) => { jumpTop(body.current); setOpen(id); };
  const openTrap = (id: string) => { setOpen(null); navigateAfterSheet(`traps?open=${id}`); };
  const openLaw = (n: number) => { setOpen(null); navigateAfterSheet(`laws?open=${n}`); };
  // the sheet keeps showing the last entry while it slides away
  const last = useRef<Entry | null>(null);
  if (open) last.current = BY_ID.get(open) ?? null;
  const current = last.current;

  // a link to an entry that doesn't exist opens nothing
  useEffect(() => { if (open && !BY_ID.has(open)) setOpen(null); }, [open]);

  const search = t('Search seducers, victims and moves');
  const top = SPRUNG.slice(0, 6);
  const darkLabel = kind === 'victim' && !q ? t('Most exposed') : t('Darkest');

  if (solo && current) {
    return (
      <SharedEntry world={WORLD} page="seduction-page" title={t('Art of seduction')} rank={rankOfAll(current)} onShare={() => setSharing({ path: `seduction?open=${current.id}`, title: current.title })}>
        <EntryDetail x={current} lens={lens} onLens={setLens} seen={seen[current.id] ?? {}} onSeen={(k) => addSeen(current.id, k)} onMe={() => toggleMe(current.id)} />
        <LearnShare target={sharing} onClose={() => setSharing(null)} />
      </SharedEntry>
    );
  }

  return (
    <div class="page lrn-page seduction-page" style={{ '--accent': `var(--emo-${WORLD})` }}>
      <div class="journal-top lrn-top" style={{ '--sky': `var(--emo-${WORLD})` }}>
        <Sky world={WORLD} />
        <PageHead title={t('Art of seduction')} back={onSharedLink ? undefined : () => goBack()} actions={<ShareButton onClick={() => setSharing({ path: 'seduction', title: t('Art of seduction') })} />} subtitle={t('Nine seducers, eighteen victims and 24 moves: the psychology and how to see them coming')} />
        <div class="media-stats stats-figures">
          <span class="stat" style={{ '--i': 0 }}>
            <b>{COUNT.seducer}</b>
            <small>{t('Seducer types')}</small>
          </span>
          <span class="stat" style={{ '--i': 1 }}>
            <b>{COUNT.victim}</b>
            <small>{t('Kinds of victim')}</small>
          </span>
          <span class="stat" style={{ '--i': 2 }}>
            <b>{COUNT.move}{seenOn > 0 && <em class="stat-aside">{t('played on you {n}', { n: seenOn })}</em>}</b>
            <small>{t('Moves in four phases')}</small>
          </span>
        </div>
        <label class="search">
          <Ico name="search" size={18} />
          <input type="search" value={query} onInput={(e) => setQuery(e.currentTarget.value)} placeholder={search} aria-label={search} />
        </label>
      </div>

      <div class="lrn">
        <div class="lrn-side">
          <Today
            kicker={today.kind === 'move' ? t('Move of the day') : today.kind === 'victim' ? t('Victim of the day') : t('Seducer of the day')}
            id={today.id}
            hue={hueOf(today)}
            title={today.title}
            line={today.line}
            footLabel={t('A question to sit with')}
            foot={today.question}
            onClick={() => openEntry(today)}
          />

          <section class="card lrn-card">
            <header class="lrn-card-head">
              <h3 class="lrn-card-title">{t('The arc of a seduction')}</h3>
              <p class="lrn-card-sub">{t('The 24 moves in their four phases')}</p>
            </header>
            <Arc open={openEntry} />
          </section>

          <section class="card lrn-card">
            <header class="lrn-card-head">
              <h3 class="lrn-card-title">{t('Who falls for whom')}</h3>
              <p class="lrn-card-sub">{t('Each seducer and the victims who suit them')}</p>
            </header>
            <Pairs open={openEntry} />
          </section>

          <NameIt open={openEntry} />

          {!onSharedLink && (
            <section class="card lrn-card">
              <header class="lrn-card-head">
                <h3 class="lrn-card-title">{t('The mind traps it springs')} <span class="lrn-count">{SPRUNG.length}</span></h3>
                <p class="lrn-card-sub">{t('The biases the book leans on most, across {n} levers. Tap one to read it in Mind traps.', { n: LEVERS })}</p>
              </header>
              <ol class="ranked sd-sprung">
                {top.map(({ trap, list }, i) => (
                  <li style={{ '--k': i, '--c': `var(--emo-${trapHue(trap)})`, '--w': list.length / top[0].list.length }}>
                    <button onClick={() => openTrap(trap.id)} title={list.map((x) => x.title).join(', ')}>
                      <span class="rk-top">
                        <i class="lrn-dot" aria-hidden="true" />
                        <span class="rk-name">{trap.name}</span>
                        <span class="rk-n"><b>{list.length}</b></span>
                      </span>
                      <span class="rk-bar"><i /></span>
                    </button>
                  </li>
                ))}
              </ol>
            </section>
          )}

          <section class="card lrn-card sd-about">
            <p>{t('Greene wrote a manual, and an unapologetic one: seduction as a campaign, other people as targets. Read the other way round, it’s a field guide to how attention, longing and illusion get used on you, by lovers, leaders, brands and feeds. So every entry here also has its signs, a defence, its shadow side and an honest version: the warmth and attention worth keeping, without the manipulation.')}</p>
            <button class="btn btn-quiet" onClick={(e) => { playIcon(e); openEntry(ENTRIES[Math.floor(Math.random() * ENTRIES.length)]); }}><Ico name="dice-5" size={18} /> {t('Draw one at random')}</button>
          </section>
        </div>

        <div class="lrn-main">
          <section aria-label={t('The book')}>
            {/* the book's three parts, one at a time; a search looks through all three */}
            <div class="sd-kinds">
              <LensSwitch
                label={t('Part of the book')}
                value={kind}
                onChange={pickKind}
                options={KIND_IDS.map((k) => ({ id: k, icon: KINDS[k].icon, label: t(KINDS[k].name), hint: t(KINDS[k].about) }))}
              />
            </div>
            <div class="lrn-head">
              <div class="chips scroll-x lrn-chips" role="toolbar" aria-label={t('Group')}>
                <button class="chip" aria-pressed={group === 'all'} onClick={() => setGroup('all')}>{t('All')}</button>
                {groupsOf(kind).map(([key, info]) => (
                  <button class="chip lrn-chip" style={{ '--c': `var(--emo-${info.hue})` }} aria-pressed={group === key} onClick={() => setGroup(group === key ? 'all' : key)}>
                    <i class="lrn-dot" aria-hidden="true" />
                    {t(info.name)}
                  </button>
                ))}
              </div>
              <SortChip sort={sort} onSort={setSort} options={[['group', t('Groups')], ['dark', darkLabel], ['everyday', t('Most common')]]} />
            </div>

            <div class="lrn-groups">
              {groups.map((g) => (
                <section class="lrn-group" key={g.key}>
                  <GroupHead
                    hue={g.info?.hue}
                    title={g.title}
                    motto={g.info ? t(g.info.motto) : q ? t(KINDS[g.key as Kind].about) : undefined}
                    about={g.info && group !== 'all' ? t(g.info.about) : undefined}
                    count={g.list.length}
                  />
                  <ol class="lrn-rows">
                    {g.list.map((x, i) => {
                      const s = seen[x.id];
                      const grouped = !q && (sort === 'group' || group !== 'all');
                      return (
                        <Row
                          key={x.id}
                          id={x.id}
                          hue={hueOf(x)}
                          rank={sort !== 'group' && !q ? i + 1 : undefined}
                          top={grouped ? rankOf(x) : `${rankOf(x)} · ${t(groupOf(x).name)}`}
                          badge={s?.on || s?.by || s?.me ? (
                            <>
                              {!!s.me && <Ico name="user" size={12} />}
                              {!!s.on && <><Ico name="eye" size={12} />{s.on}</>}
                              {!!s.by && <><Ico name="flame" size={12} />{s.by}</>}
                            </>
                          ) : undefined}
                          title={x.title}
                          sub={x.line}
                          end={sort === 'everyday'
                            ? <span class="lrn-num" title={t('Everyday {d} of 10', { d: x.everyday })}><b>{x.everyday}</b><small>{t('common')}</small></span>
                            : <span class="lrn-num" title={t('Darkness {d} of 10', { d: x.dark })}><b>{x.dark}</b><small>{x.kind === 'victim' ? t('exposed') : t('dark')}</small></span>}
                          onClick={() => openEntry(x)}
                        />
                      );
                    })}
                  </ol>
                </section>
              ))}
            </div>
            {!any && (
              <div class="empty-note">
                <p>{t('Nothing matches that. Keep them in suspense, perhaps.')}</p>
                <button class="btn btn-quiet" onClick={() => { setQuery(''); setGroup('all'); }}>{t('Clear filters')}</button>
              </div>
            )}
          </section>
        </div>
      </div>

      <Sheet open={!!open} onClose={() => setOpen(null)} title={current ? rankOfAll(current) : ''} label={current?.title} tall class="lrn-sheet">
        <div ref={body}>
          {current && (
            <EntryDetail
              x={current}
              onShare={() => setSharing({ path: `seduction?open=${current.id}`, title: current.title })}
              lens={lens}
              onLens={setLens}
              seen={seen[current.id] ?? {}}
              onSeen={(k) => addSeen(current.id, k)}
              onMe={() => toggleMe(current.id)}
              go={go}
              openTrap={onSharedLink ? undefined : openTrap}
              openLaw={onSharedLink ? undefined : openLaw}
            />
          )}
        </div>
      </Sheet>
      <LearnShare target={sharing} onClose={() => setSharing(null)} />
    </div>
  );
}
