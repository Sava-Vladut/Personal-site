import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { goBack, navigateAfterSheet } from '../lib/router';
import { usePref } from '../lib/prefs';
import { haptic } from '../lib/haptics';
import { t } from '../lib/i18n';
import { PARTS, PRINCIPLES, type Part, type Principle } from '../data/principles';
import { FAMILIES, TRAPS, type Trap } from '../data/traps';
import { LAWS, REALMS, type Law } from '../data/laws';
import { Icon } from '../components/icons';
import { Mark } from '../components/Mark';
import { Sheet } from '../components/Sheet';
import { PageHead } from '../components/PageHead';
import { Sky } from '../components/Sky';
import { SortChip } from '../components/collection';
import { Aside, Caption, DetailHead, GroupHead, LinkRow, Meter, Option, Row, Tally, Today, jumpTop, shuffle, useLocal } from '../components/learn';
import '../styles/stats.css';
import '../styles/friends.css';

/*
 * How to Win Friends and Influence People, under Learn: Laws of power's sibling, on the same layout (styles/learn.css).
 * A sky with three figures and the search; a feature column (the principle of the day, where to start, the game and
 * the connections to the other two pages); and all thirty in the book's four parts as compact rows. Every principle
 * wears its own mark (data/marks.ts) in its part's colour, and opens to the story behind it, the psychology, the mind
 * traps it disarms (linked to Mind traps), the laws of power it answers (linked to Laws of power) and how to practise
 * it. The data is in data/principles.
 */

const BY_N = new Map(PRINCIPLES.map((x) => [x.n, x]));
const TRAP_BY_ID = new Map(TRAPS.map((x) => [x.id, x]));
const LAW_BY_N = new Map(LAWS.map((x) => [x.n, x]));
const PART_IDS = Object.keys(PARTS) as Part[];
const hueOf = (x: Principle) => PARTS[x.part].hue;
const lawHue = (x: Law) => REALMS[x.realm].hue;
const trapHue = (x: Trap) => FAMILIES[x.family].hue;

/** Every mind trap the principles disarm, most-disarmed first, with the principles that disarm it. */
const DISARMED = (() => {
  const by = new Map<string, Principle[]>();
  for (const x of PRINCIPLES) for (const { id } of x.traps) if (TRAP_BY_ID.has(id)) by.set(id, [...(by.get(id) ?? []), x]);
  return [...by.entries()].map(([id, list]) => ({ trap: TRAP_BY_ID.get(id)!, list })).sort((a, b) => b.list.length - a.list.length);
})();

/** Every law of power the principles answer, most-answered first, with the principles that answer it. */
const ANSWERED = (() => {
  const by = new Map<number, Principle[]>();
  for (const x of PRINCIPLES) for (const { n } of x.laws) if (LAW_BY_N.has(n)) by.set(n, [...(by.get(n) ?? []), x]);
  return [...by.entries()].map(([n, list]) => ({ law: LAW_BY_N.get(n)!, list })).sort((a, b) => b.list.length - a.list.length || a.law.n - b.law.n);
})();

/* ---------- what you're practising ---------- */

/** On this device: which principles you're practising, and how often you've tried each. */
type Practice = Record<number, { on?: boolean; tried?: number }>;
function usePractice() {
  const [practice, save] = useLocal<Practice>('mm-friends-practice', {});
  const toggle = (n: number) => save({ ...practice, [n]: { ...practice[n], on: !practice[n]?.on } });
  const tried = (n: number) => save({ ...practice, [n]: { ...practice[n], tried: (practice[n]?.tried ?? 0) + 1 } });
  return [practice, toggle, tried] as const;
}

/* ---------- where to start ---------- */

/**
 * Every principle by how hard it is against how often it comes up: the easy, common ones are where to begin. A ring
 * marks the ones you're practising; what's under the pointer is told in a caption that never changes height.
 */
function StartMap({ practice, open }: { practice: Practice; open: (x: Principle) => void }) {
  const [hot, setHot] = useState<number | null>(null);
  // narrow enough that 12-unit labels still read at 10px or more on a phone
  const W = 360, H = 280, P = 30;
  const xOf = (v: number) => P + ((v - 0.5) / 10) * (W - P * 2);
  const yOf = (v: number) => H - P - ((v - 0.5) / 10) * (H - P * 2);
  // principles on the same spot fan out round it, so none hides another
  const dots = useMemo(() => {
    const at = new Map<string, Principle[]>();
    for (const x of PRINCIPLES) at.set(`${x.everyday},${x.hard}`, [...(at.get(`${x.everyday},${x.hard}`) ?? []), x]);
    return PRINCIPLES.map((x) => {
      const same = at.get(`${x.everyday},${x.hard}`)!;
      const k = same.indexOf(x), n = same.length;
      const a = (k / n) * Math.PI * 2 + 0.6, d = n > 1 ? 6 + n * 0.8 : 0;
      return { x, px: xOf(x.everyday) + Math.cos(a) * d, py: yOf(x.hard) + Math.sin(a) * d };
    });
  }, []);
  const focus = hot ? BY_N.get(hot) ?? null : null;
  const quads: [number, number, string, string][] = [
    [P + 6, P + 16, t('Hard, and rare'), 'start'],
    [W - P - 6, P + 16, t('The lifelong work'), 'end'],
    [P + 6, H - P - 8, t('Easy, now and then'), 'start'],
    [W - P - 6, H - P - 8, t('Start here'), 'end'],
  ];
  const leave = (n: number) => setHot((h) => (h === n ? null : h));
  return (
    <div class="wf-map">
      <svg viewBox={`0 0 ${W} ${H}`} role="group" aria-label={t('Every principle by how hard it is and how often it comes up')}>
        <rect x={W / 2} y={H / 2} width={W / 2 - P} height={H / 2 - P} class="wf-map-hot" />
        <line x1={W / 2} y1={P} x2={W / 2} y2={H - P} class="wf-map-axis" />
        <line x1={P} y1={H / 2} x2={W - P} y2={H / 2} class="wf-map-axis" />
        <rect x={P} y={P} width={W - P * 2} height={H - P * 2} class="wf-map-frame" />
        {quads.map(([x, y, label, anchor]) => <text x={x} y={y} text-anchor={anchor} class="wf-map-quad">{label}</text>)}
        <text x={W / 2} y={H - 9} text-anchor="middle" class="wf-map-label">{t('How often it comes up')} →</text>
        <text x={14} y={H / 2} text-anchor="middle" class="wf-map-label" transform={`rotate(-90 14 ${H / 2})`}>{t('How hard it is')} →</text>
        {focus && (
          <g class="wf-map-kin" style={{ '--c': `var(--emo-${hueOf(focus)})` }}>
            {focus.kin.map((k) => {
              const a = dots.find((d) => d.x.n === focus.n)!, b = dots.find((d) => d.x.n === k);
              return b && <line x1={a.px} y1={a.py} x2={b.px} y2={b.py} />;
            })}
          </g>
        )}
        {dots.map(({ x, px, py }) => (
          <g
            class={`wf-dot${hot === x.n ? ' hot' : ''}${focus && focus.kin.includes(x.n) ? ' kin' : ''}`}
            style={{ '--c': `var(--emo-${hueOf(x)})` }}
            role="button"
            tabIndex={0}
            aria-label={`${x.n}. ${x.title}${practice[x.n]?.on ? ` (${t('practising')})` : ''}`}
            onClick={() => open(x)}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), open(x))}
            onPointerEnter={() => setHot(x.n)}
            onPointerLeave={() => leave(x.n)}
            onFocus={() => setHot(x.n)}
            onBlur={() => leave(x.n)}
          >
            <circle cx={px} cy={py} r={11} class="wf-dot-hit" />
            {practice[x.n]?.on && <circle cx={px} cy={py} r={8.5} class="wf-dot-on" />}
            <circle cx={px} cy={py} r={5} class="wf-dot-mark" />
            <text x={px} y={py - 10} text-anchor="middle" class="wf-dot-n">{x.n}</text>
          </g>
        ))}
      </svg>
      <Caption
        title={focus ? `${focus.n}. ${focus.title}` : undefined}
        sub={focus ? t('Hard {h} · everyday {e} · tap to open', { h: focus.hard, e: focus.everyday }) : undefined}
        idle={<>
          {t('Lower is easier, right is more common. Start in the bottom right.')}
          {Object.values(practice).some((p) => p.on) && <> {t('A ring marks one you’re practising.')}</>}
        </>}
      />
    </div>
  );
}

/* ---------- name the principle ---------- */

function deal(not?: number) {
  const pool = PRINCIPLES.filter((x) => x.n !== not);
  const principle = pool[Math.floor(Math.random() * pool.length)];
  // the wrong answers come from other parts when possible, so the game turns on the move, not the colour
  const others = shuffle(PRINCIPLES.filter((x) => x.n !== principle.n && x.part !== principle.part)).slice(0, 3);
  return { principle, options: shuffle([principle, ...others]) };
}

/**
 * A scene, four principles, pick the one at work. Everything is always there (the score line, the verdict's slot,
 * both buttons) and the scene keeps room for its longest, so the options never move under your finger.
 */
function NameThePrinciple({ open }: { open: (x: Principle) => void }) {
  const [round, setRound] = useState(() => deal());
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState({ right: 0, played: 0, streak: 0 });
  const answer = round.principle;
  const pick = (n: number) => {
    if (picked != null) return;
    const right = n === answer.n;
    haptic(right ? 6 : 14);
    setPicked(n);
    setScore((s) => ({ right: s.right + (right ? 1 : 0), played: s.played + 1, streak: right ? s.streak + 1 : 0 }));
  };
  const next = () => { setRound(deal(answer.n)); setPicked(null); };
  return (
    <div class="lrn-quiz wf-game">
      <p class="lrn-q wf-scene">{answer.scenario}</p>
      <div class="lrn-opts">
        {round.options.map((x, i) => (
          <Option
            index={i}
            label={x.title}
            state={picked == null ? 'idle' : x.n === answer.n ? 'right' : picked === x.n ? 'wrong' : 'idle'}
            disabled={picked != null && picked !== x.n && x.n !== answer.n}
            pressed={picked === x.n}
            onClick={() => pick(x.n)}
          />
        ))}
      </div>
      <div class="wf-verdict" role="status">
        {picked != null && (
          <p class="lrn-verdict">
            <b class={picked === answer.n ? 'is-right' : 'is-wrong'}>{picked === answer.n ? t('Right.') : t('It was principle {n}.', { n: answer.n })}</b> {answer.line}
          </p>
        )}
      </div>
      <div class="lrn-quiz-foot">
        <p class="lrn-score">{score.played > 0 ? `${t('{right} of {played}', score)}${score.streak > 2 ? ` · ${t('{n} in a row', { n: score.streak })}` : ''}` : ''}</p>
        <span class="wf-game-acts">
          <button class="btn btn-quiet btn-s" style={picked == null ? { visibility: 'hidden' } : undefined} onClick={() => open(answer)}>{t('Read the principle')}</button>
          <button class="btn btn-primary btn-s" onClick={next}>{t('Next scene')} <Icon name="chevron-right" size={16} /></button>
        </span>
      </div>
    </div>
  );
}

/* ---------- where they meet the other two pages ---------- */

/** The laws of power the principles answer most (with the principles that answer each) and the mind traps they disarm most. */
function Connections({ open, openLaw, openTrap }: { open: (x: Principle) => void; openLaw: (n: number) => void; openTrap: (id: string) => void }) {
  const laws = ANSWERED.slice(0, 5), traps = DISARMED.slice(0, 5);
  const lawMax = laws[0]?.list.length ?? 1, trapMax = traps[0]?.list.length ?? 1;
  return (
    <section class="card lrn-card">
      <header class="lrn-card-head">
        <h3 class="lrn-card-title">{t('Connections')}</h3>
        <p class="lrn-card-sub">{t('{laws} laws of power answered, {traps} mind traps disarmed', { laws: ANSWERED.length, traps: DISARMED.length })}</p>
      </header>
      {laws.length > 0 && (
        <div class="wf-conn">
          <h4 class="kicker wf-conn-h">{t('Carnegie vs Greene')}</h4>
          <p class="wf-conn-sub">{t('The laws of power the principles answer. Tap a law to read it, a number to open its principle.')}</p>
          <ol class="ranked">
            {laws.map(({ law, list }) => (
              <li style={{ '--c': `var(--emo-${lawHue(law)})`, '--w': list.length / lawMax }}>
                <span class="rk-top">
                  <button class="wf-rk-main" onClick={() => openLaw(law.n)}>
                    <Mark id={law.id} hue={lawHue(law)} size={28} />
                    <span class="wf-rk-body">
                      <small>{t('Law {n}', { n: law.n })}</small>
                      <b>{law.title}</b>
                    </span>
                  </button>
                  <span class="wf-pips">
                    {list.map((x) => (
                      <button class="wf-pip" style={{ '--c': `var(--emo-${hueOf(x)})` }} title={x.title} aria-label={`${x.n}. ${x.title}`} onClick={() => open(x)}>{x.n}</button>
                    ))}
                  </span>
                </span>
                <span class="rk-bar"><i /></span>
              </li>
            ))}
          </ol>
        </div>
      )}
      {traps.length > 0 && (
        <div class="wf-conn">
          <h4 class="kicker wf-conn-h">{t('The mind traps they disarm')}</h4>
          <p class="wf-conn-sub">{t('The biases the principles work against most. Tap one to read it in Mind traps.')}</p>
          <ol class="ranked">
            {traps.map(({ trap, list }) => (
              <li style={{ '--c': `var(--emo-${trapHue(trap)})`, '--w': list.length / trapMax }}>
                <button class="wf-rk" onClick={() => openTrap(trap.id)}>
                  <span class="rk-top">
                    <Mark id={trap.id} hue={trapHue(trap)} size={28} />
                    <span class="rk-name">{trap.name}</span>
                    <span class="rk-n"><b>{list.length}</b></span>
                  </span>
                  <span class="rk-bar"><i /></span>
                </button>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}

/* ---------- one principle, opened ---------- */

type Lens = 'why' | 'how';
const LENSES: Lens[] = ['why', 'how'];

function PrincipleDetail({ x, lens, setLens, practice, onToggle, onTried, go, openTrap, openLaw }: {
  x: Principle;
  lens: Lens;
  setLens: (l: Lens) => void;
  practice: { on?: boolean; tried?: number };
  onToggle: () => void;
  onTried: () => void;
  go: (n: number) => void;
  openTrap: (id: string) => void;
  openLaw: (n: number) => void;
}) {
  const part = PARTS[x.part];
  const traps = x.traps.map((s) => ({ ...s, trap: TRAP_BY_ID.get(s.id) })).filter((s): s is typeof s & { trap: Trap } => !!s.trap);
  const laws = x.laws.map((s) => ({ ...s, law: LAW_BY_N.get(s.n) })).filter((s): s is typeof s & { law: Law } => !!s.law);
  const kin = x.kin.map((k) => BY_N.get(k)).filter((k): k is Principle => !!k);

  const why = (
    <>
      <section class="lrn-d-sec">
        <h3 class="lrn-d-h">{t('The principle')}</h3>
        <p class="lrn-d-p">{x.gist}</p>
        <Aside icon="book" label={t('The story')} title={x.story.who} who={x.story.when}>{x.story.text}</Aside>
      </section>
      <section class="lrn-d-sec">
        <h3 class="lrn-d-h">{t('Why it works on people')}</h3>
        <p class="lrn-d-p">{x.mind}</p>
        <Aside icon="info-circle" label={t('The experiment')} title={x.study.title} who={x.study.who}>{x.study.text}</Aside>
      </section>
      <section class="lrn-d-sec">
        <h3 class="lrn-d-h">{t('The levers it pulls')}</h3>
        <ul class="lrn-list">{x.levers.map((l) => <li><b>{l.name}.</b> {l.text}</li>)}</ul>
      </section>
      {traps.length > 0 && (
        <section class="lrn-d-sec">
          <h3 class="lrn-d-h">{t('The mind traps it disarms')}</h3>
          <div class="lrn-links">
            {traps.map(({ trap, how }) => <LinkRow hue={trapHue(trap)} id={trap.id} title={trap.name} how={how} onClick={() => openTrap(trap.id)} />)}
          </div>
        </section>
      )}
      {laws.length > 0 && (
        <section class="lrn-d-sec">
          <h3 class="lrn-d-h">{t('Carnegie vs Greene')}</h3>
          <p class="lrn-d-p wf-d-note">{t('The laws of power it answers, and how.')}</p>
          <div class="lrn-links">
            {laws.map(({ law, how }) => <LinkRow hue={lawHue(law)} id={law.id} kicker={t('Law {n}', { n: law.n })} title={law.title} how={how} onClick={() => openLaw(law.n)} />)}
          </div>
        </section>
      )}
      <section class="lrn-d-sec">
        <h3 class="lrn-d-h">{t('Where you’ll meet it today')}</h3>
        <ul class="lrn-list">{x.today.map((l) => <li>{l}</li>)}</ul>
      </section>
    </>
  );
  const how = (
    <>
      <section class="lrn-d-sec">
        <h3 class="lrn-d-h">{t('Try this week')}</h3>
        <ol class="lrn-list is-steps">{x.practice.map((l) => <li>{l}</li>)}</ol>
      </section>
      <section class="lrn-d-sec">
        <h3 class="lrn-d-h">{t('Where it goes wrong')}</h3>
        <ul class="lrn-list">{x.slips.map((l) => <li>{l}</li>)}</ul>
      </section>
    </>
  );

  return (
    <article class="lrn-detail" key={x.n}>
      <DetailHead id={x.id} hue={hueOf(x)} kicker={`${t('Principle {n}', { n: x.n })} · ${t(part.name)}`} title={x.title} line={x.line} />

      <div class="lrn-meters">
        <Meter label={t('How hard')} value={x.hard} about={t('How hard it is to actually do')} />
        <Meter label={t('Everyday')} value={x.everyday} about={t('How often it comes up in ordinary life')} />
      </div>

      {/* the lens: which half you read first (the other follows) */}
      <div class="seg tabs" role="tablist" aria-label={t('Read as')} style={{ '--at': LENSES.indexOf(lens), '--tabs': LENSES.length }}>
        <button role="tab" aria-selected={lens === 'why'} onClick={() => setLens('why')}><Icon name="brain" size={16} /> {t('Why it works')}</button>
        <button role="tab" aria-selected={lens === 'how'} onClick={() => setLens('how')}><Icon name="list-check" size={16} /> {t('How to practise')}</button>
      </div>

      {lens === 'why' ? <>{why}{how}</> : <>{how}{why}</>}

      <div class="lrn-pair">
        <Aside icon="moon" label={t('The shadow side')}>{x.shadow}</Aside>
        <Aside icon="heart" label={t('The honest version')}>{x.honest}</Aside>
      </div>

      <blockquote class="lrn-quote">
        <small>{t('A question to sit with')}</small>
        {x.question}
      </blockquote>

      <div class="lrn-actions">
        <Tally icon={practice.on ? 'check' : 'plus'} label={practice.on ? t('Practising') : t('Practise this')} pressed={!!practice.on} onClick={() => { haptic(practice.on ? 6 : 10); onToggle(); }} />
        <Tally icon="sparkles" label={t('I tried it')} n={practice.tried ?? 0} onClick={() => { haptic(10); onTried(); }} />
      </div>

      {kin.length > 0 && (
        <section class="lrn-d-sec">
          <h3 class="lrn-d-h">{t('Related principles')}</h3>
          <ol class="lrn-rows">
            {kin.map((k) => <Row id={k.id} hue={hueOf(k)} top={t('Principle {n}', { n: k.n })} title={k.title} onClick={() => go(k.n)} />)}
          </ol>
        </section>
      )}
    </article>
  );
}

/* ---------- the page ---------- */

type Filter = 'all' | 'practising' | Part;
// 'n' is the book's order, in its four parts
type Sort = 'n' | 'easy' | 'everyday';
const SORTS: Sort[] = ['n', 'easy', 'everyday'];
const FILTERS: Filter[] = ['all', 'practising', ...PART_IDS];
const WORLD = 'joy';
const LEVERS = new Set(PRINCIPLES.flatMap((x) => x.levers.map((l) => l.name.toLowerCase()))).size;

export function Friends({ query: params }: { query: URLSearchParams }) {
  // ?open=<n> opens a principle straight away (Laws of power and Mind traps link here)
  const [open, setOpen] = useState<number | null>(() => Number(params.get('open')) || null);
  const [filter, setFilter] = usePref<Filter>('friends-part', 'all', FILTERS);
  const [sort, setSort] = usePref<Sort>('friends-sort', 'n', SORTS);
  const [lens, setLens] = usePref<Lens>('friends-lens', 'why', LENSES);
  const [query, setQuery] = useState('');
  const [practice, toggle, tried] = usePractice();
  const body = useRef<HTMLDivElement>(null);

  const day = Math.floor((Date.now() - new Date().getTimezoneOffset() * 60_000) / 86_400_000);
  const today = PRINCIPLES[day % PRINCIPLES.length];
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = PRINCIPLES.filter((x) =>
      (filter === 'all' || (filter === 'practising' ? !!practice[x.n]?.on : x.part === filter))
      && (!q || `${x.n} ${x.title} ${x.line} ${x.gist} ${x.practice.join(' ')} ${x.levers.map((l) => l.name).join(' ')}`.toLowerCase().includes(q)));
    if (sort === 'everyday') list.sort((a, b) => b.everyday - a.everyday || a.n - b.n);
    if (sort === 'easy') list.sort((a, b) => a.hard - b.hard || a.n - b.n);
    return list;
  }, [filter, sort, query, practice]);
  const practising = PRINCIPLES.filter((x) => practice[x.n]?.on).length;
  const triedTotal = Object.values(practice).reduce((s, v) => s + (v.tried ?? 0), 0);

  const openPrinciple = (x: Principle) => { haptic(5); setOpen(x.n); };
  // another principle from inside the sheet: back to its top at once, in the same tick as the switch
  const go = (n: number) => { jumpTop(body.current); setOpen(n); };
  const openTrap = (id: string) => { setOpen(null); navigateAfterSheet(`traps?open=${id}`); };
  const openLaw = (n: number) => { setOpen(null); navigateAfterSheet(`laws?open=${n}`); };
  // the sheet keeps showing the last principle while it slides away
  const last = useRef<Principle | null>(null);
  if (open) last.current = BY_N.get(open) ?? null;
  const current = last.current;

  // a link to a principle that doesn't exist opens nothing
  useEffect(() => { if (open && !BY_N.has(open)) setOpen(null); }, [open]);

  if (!today) return null;
  const tryToday = today.practice[day % Math.max(1, today.practice.length)];

  const row = (x: Principle, rank?: number) => {
    const p = practice[x.n];
    return (
      <Row
        key={x.n}
        id={x.id}
        hue={hueOf(x)}
        rank={rank}
        top={<>
          {rank != null ? t('Principle {n} · {part}', { n: x.n, part: t(PARTS[x.part].name) }) : t('Principle {n}', { n: x.n })}
          {!!p?.tried && <span class="wf-tried" title={t('I tried it')}><Icon name="sparkles" size={12} />{p.tried}</span>}
        </>}
        badge={p?.on ? t('Practising') : undefined}
        title={x.title}
        sub={x.line}
        end={sort === 'everyday'
          ? <span class="lrn-num"><b>{x.everyday}</b><small>{t('Everyday')}</small></span>
          : <span class="lrn-num" title={t('How hard: {h} of 10', { h: x.hard })}><b>{x.hard}</b><small>{t('hard')}</small></span>}
        onClick={() => openPrinciple(x)}
      />
    );
  };

  return (
    <div class="page lrn-page friends-page" style={{ '--accent': `var(--emo-${WORLD})` }}>
      <div class="journal-top lrn-top" style={{ '--sky': `var(--emo-${WORLD})` }}>
        <Sky world={WORLD} />
        <PageHead title={t('Win friends')} back={() => goBack()} subtitle={t('Dale Carnegie’s 30 principles: why they work and how to practise them')} />
        <div class="media-stats stats-figures">
          <span class="stat" style={{ '--i': 0 }}>
            <b>{practising}<em class="stat-aside">/{PRINCIPLES.length}</em></b>
            <small>{t('Practising')}</small>
          </span>
          <span class="stat" style={{ '--i': 1 }}>
            <b>{triedTotal}</b>
            <small>{t('Tries logged')}</small>
          </span>
          <span class="stat" style={{ '--i': 2 }}>
            <b>{LEVERS}</b>
            <small>{t('Levers from psychology')}</small>
          </span>
        </div>
        <label class="search">
          <Icon name="search" size={18} />
          <input type="search" value={query} onInput={(e) => setQuery(e.currentTarget.value)} placeholder={t('Search principles, levers or things to try')} aria-label={t('Search principles, levers or things to try')} />
        </label>
      </div>

      <div class="lrn">
        <div class="lrn-side">
          <Today
            kicker={t('Principle of the day')}
            id={today.id}
            hue={hueOf(today)}
            title={today.title}
            line={today.line}
            footLabel={tryToday ? t('Try today') : undefined}
            foot={tryToday}
            onClick={() => openPrinciple(today)}
          />

          <section class="card lrn-card">
            <header class="lrn-card-head">
              <h3 class="lrn-card-title">{t('Where to start')}</h3>
              <p class="lrn-card-sub">{t('Every principle by how hard it is and how often it comes up')}</p>
            </header>
            <StartMap practice={practice} open={openPrinciple} />
          </section>

          <section class="card lrn-card">
            <header class="lrn-card-head">
              <h3 class="lrn-card-title">{t('Name the principle')}</h3>
              <p class="lrn-card-sub">{t('Which principle is at work?')}</p>
            </header>
            <NameThePrinciple open={openPrinciple} />
          </section>

          <Connections open={openPrinciple} openLaw={openLaw} openTrap={openTrap} />
        </div>

        <div class="lrn-main">
          <div>
            <div class="lrn-head">
              <div class="chips scroll-x lrn-chips" role="toolbar" aria-label={t('Part')}>
                <button class="chip" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>{t('All')}</button>
                <button class="chip lrn-chip" style={{ '--c': 'var(--accent)' }} aria-pressed={filter === 'practising'} onClick={() => setFilter(filter === 'practising' ? 'all' : 'practising')}>
                  <Icon name="check" size={16} /> {t('Practising')}
                </button>
                {PART_IDS.map((p) => (
                  <button class="chip lrn-chip" style={{ '--c': `var(--emo-${PARTS[p].hue})` }} aria-pressed={filter === p} onClick={() => setFilter(filter === p ? 'all' : p)}>
                    <i class="lrn-dot" aria-hidden="true" />{t(PARTS[p].name)}
                  </button>
                ))}
              </div>
              <SortChip<Sort> sort={sort} onSort={setSort} options={[['n', t('In order')], ['easy', t('Easiest')], ['everyday', t('Commonest')]]} />
            </div>

            {shown.length > 0 && (
              <div class="lrn-groups">
                {sort === 'n'
                  ? PART_IDS.map((part) => {
                    const list = shown.filter((x) => x.part === part);
                    return list.length > 0 && (
                      <section class="lrn-group" key={part}>
                        <GroupHead hue={PARTS[part].hue} title={t(PARTS[part].name)} motto={t(PARTS[part].motto)} about={t(PARTS[part].about)} count={list.length} />
                        <ol class="lrn-rows">{list.map((x) => row(x))}</ol>
                      </section>
                    );
                  })
                  : (
                    <section class="lrn-group" key={sort}>
                      <GroupHead title={sort === 'easy' ? t('Easiest') : t('Commonest')} count={shown.length} />
                      <ol class="lrn-rows">{shown.map((x, i) => row(x, i + 1))}</ol>
                    </section>
                  )}
              </div>
            )}
            {!shown.length && (
              <p class="empty-note">
                {filter === 'practising' && !query.trim()
                  ? t('Nothing in practice yet. Open a principle and tap “Practise this”.')
                  : t('No principle matches that. Try talking in terms of what it wants.')}
              </p>
            )}
          </div>

          <section class="wf-about">
            <p>{t('Carnegie wrote the book in 1936 for salesmen and managers, and it has sold more than thirty million copies since. It’s easy to read as a manual for getting your way, and easy to sneer at for the same reason. But nearly every principle rests on one plain fact: people can tell whether you’re actually interested in them. So each principle here has the psychology underneath it, the mind traps it disarms, the laws of power it answers, and an honest version beside the one that turns into flattery.')}</p>
            <button class="btn btn-quiet" onClick={() => openPrinciple(PRINCIPLES[Math.floor(Math.random() * PRINCIPLES.length)])}><Icon name="dice-5" size={18} /> {t('Draw a principle at random')}</button>
          </section>
        </div>
      </div>

      <Sheet open={!!open} onClose={() => setOpen(null)} title={current ? t('Principle {n} of {total}', { n: current.n, total: PRINCIPLES.length }) : ''} label={current?.title} tall>
        <div ref={body}>
          {current && (
            <PrincipleDetail
              x={current}
              lens={lens}
              setLens={setLens}
              practice={practice[current.n] ?? {}}
              onToggle={() => toggle(current.n)}
              onTried={() => tried(current.n)}
              go={go}
              openTrap={openTrap}
              openLaw={openLaw}
            />
          )}
        </div>
      </Sheet>
    </div>
  );
}
