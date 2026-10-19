import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
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
import { RevealStack } from '../components/charts';
import { Sky } from '../components/Sky';
import { Tile } from './stats/parts';
import '../styles/stats.css';
import '../styles/friends.css';

/*
 * How to Win Friends and Influence People, under Learn: Laws of power's sibling, on the same sky, cards and tiles.
 * Every principle wears its own mark (data/marks.ts) in its part's colour, and opens to the story behind it, the
 * psychology, the mind traps it disarms (linked to Mind traps), the laws of power it answers (linked to Laws of power)
 * and how to practise it. The data is in data/principles.
 */

const BY_N = new Map(PRINCIPLES.map((x) => [x.n, x]));
const TRAP_BY_ID = new Map(TRAPS.map((x) => [x.id, x]));
const LAW_BY_N = new Map(LAWS.map((x) => [x.n, x]));
const PART_IDS = Object.keys(PARTS) as Part[];
const hueOf = (x: Principle) => PARTS[x.part].hue;
const lawHue = (x: Law) => REALMS[x.realm].hue;
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

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

function Meter({ label, value, about }: { label: string; value: number; about: string }) {
  return (
    <div class="wf-meter" title={about}>
      <span>{label}</span>
      <i>{Array.from({ length: 10 }, (_, i) => <b class={i < value ? 'on' : ''} style={{ '--i': i }} />)}</i>
      <em>{value}</em>
    </div>
  );
}

/* ---------- what you're practising ---------- */

/** On this device: which principles you're practising, and how often you've tried each. */
const PRACTICE = 'mm-friends-practice';
type Practice = Record<number, { on?: boolean; tried?: number }>;
function usePractice() {
  const [practice, set] = useState<Practice>(() => {
    try { return JSON.parse(localStorage.getItem(PRACTICE) || '{}') ?? {}; } catch { return {}; }
  });
  const save = (next: Practice) => {
    set(next);
    try { localStorage.setItem(PRACTICE, JSON.stringify(next)); } catch {}
  };
  const toggle = (n: number) => save({ ...practice, [n]: { ...practice[n], on: !practice[n]?.on } });
  const tried = (n: number) => save({ ...practice, [n]: { ...practice[n], tried: (practice[n]?.tried ?? 0) + 1 } });
  return [practice, toggle, tried] as const;
}

/* ---------- the ladder ---------- */

type Filter = 'all' | 'practising' | Part;

/** All thirty, rung by rung, one row for each of the book's four parts. */
function Ladder({ filter, practice, open }: { filter: Filter; practice: Practice; open: (x: Principle) => void }) {
  const [hot, setHot] = useState<number | null>(null);
  const focus = hot ? BY_N.get(hot) ?? null : null;
  let k = 0;
  return (
    <div class="wf-ladder-wrap">
      <div class="wf-ladder" role="group" aria-label={t('All {n} principles', { n: PRINCIPLES.length })}>
        {PART_IDS.map((part) => {
          const list = PRINCIPLES.filter((x) => x.part === part);
          return (
            <div class="wf-ladder-row" style={{ '--c': `var(--emo-${PARTS[part].hue})` }}>
              <p class="wf-ladder-part"><b>{t(PARTS[part].name)}</b> <span>{t(PARTS[part].motto)}</span></p>
              <div class="wf-rungs">
                {list.map((x) => {
                  const dim = (filter === 'practising' && !practice[x.n]?.on) || (filter !== 'all' && filter !== 'practising' && x.part !== filter);
                  return (
                    <button
                      class={`wf-rung${practice[x.n]?.on ? ' on' : ''}${dim ? ' dim' : ''}${focus && focus.kin.includes(x.n) ? ' kin' : ''}`}
                      style={{ '--i': k++ }}
                      aria-label={`${x.n}. ${x.title}`}
                      onClick={() => open(x)}
                      onPointerEnter={() => setHot(x.n)}
                      onPointerLeave={() => setHot((h) => (h === x.n ? null : h))}
                      onFocus={() => setHot(x.n)}
                      onBlur={() => setHot((h) => (h === x.n ? null : h))}
                    >
                      <span class="wf-rung-n">{x.n}</span>
                      {practice[x.n]?.on ? <Icon name="check" size={12} stroke={2.5} class="wf-rung-tick" /> : <i class="wf-rung-dot" />}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <div class="wf-caption" aria-live="polite">
        {focus ? (
          <>
            <b>{focus.title}</b>
            <span>{focus.line}</span>
          </>
        ) : (
          <span>{t('Hover or focus a rung to read its principle, tap to open it. A tick means you’re practising it.')}</span>
        )}
      </div>
    </div>
  );
}

/* ---------- where to start ---------- */

/** Every principle by how hard it is against how often it comes up: the easy, common ones are where to begin. */
function StartMap({ open }: { open: (x: Principle) => void }) {
  const [hot, setHot] = useState<number | null>(null);
  const W = 400, H = 300, P = 30;
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
    [P + 6, P + 4, t('Hard, and rare'), 'start'],
    [W - P - 6, P + 4, t('The lifelong work'), 'end'],
    [P + 6, H - P - 8, t('Easy, now and then'), 'start'],
    [W - P - 6, H - P - 8, t('Start here'), 'end'],
  ];
  return (
    <div class="wf-map">
      <svg viewBox={`0 0 ${W} ${H}`} role="group" aria-label={t('Every principle by how hard it is and how often it comes up')}>
        <rect x={W / 2} y={H / 2} width={W / 2 - P} height={H / 2 - P} class="wf-map-hot" />
        <line x1={W / 2} y1={P} x2={W / 2} y2={H - P} class="wf-map-axis" />
        <line x1={P} y1={H / 2} x2={W - P} y2={H / 2} class="wf-map-axis" />
        <rect x={P} y={P} width={W - P * 2} height={H - P * 2} class="wf-map-frame" />
        {quads.map(([x, y, label, anchor]) => <text x={x} y={y + 10} text-anchor={anchor} class="wf-map-quad">{label}</text>)}
        <text x={W / 2} y={H - 8} text-anchor="middle" class="wf-map-label">{t('How often it comes up')} →</text>
        <text x={12} y={H / 2} text-anchor="middle" class="wf-map-label" transform={`rotate(-90 12 ${H / 2})`}>{t('How hard it is')} →</text>
        {focus && (
          <g class="wf-map-kin" style={{ '--c': `var(--emo-${hueOf(focus)})` }}>
            {focus.kin.map((k) => {
              const a = dots.find((d) => d.x.n === focus.n)!, b = dots.find((d) => d.x.n === k);
              return b && <line x1={a.px} y1={a.py} x2={b.px} y2={b.py} />;
            })}
          </g>
        )}
        {dots.map(({ x, px, py }, i) => (
          <g
            class={`wf-dot${hot === x.n ? ' hot' : ''}${focus && focus.kin.includes(x.n) ? ' kin' : ''}`}
            style={{ '--c': `var(--emo-${hueOf(x)})`, '--i': i }}
            role="button"
            tabIndex={0}
            aria-label={`${x.n}. ${x.title}`}
            onClick={() => open(x)}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), open(x))}
            onPointerEnter={() => setHot(x.n)}
            onPointerLeave={() => setHot((h) => (h === x.n ? null : h))}
            onFocus={() => setHot(x.n)}
            onBlur={() => setHot((h) => (h === x.n ? null : h))}
          >
            <circle cx={px} cy={py} r={11} class="wf-dot-hit" />
            <circle cx={px} cy={py} r={5} class="wf-dot-mark" />
            <text x={px} y={py - 8} text-anchor="middle" class="wf-dot-n">{x.n}</text>
          </g>
        ))}
      </svg>
      <div class="wf-caption" aria-live="polite">
        {focus ? (
          <>
            <b>{focus.n}. {focus.title}</b>
            <span>{t('Hard {h} · everyday {e} · tap to open', { h: focus.hard, e: focus.everyday })}</span>
          </>
        ) : (
          <span>{t('Lower is easier, right is more common. Start in the bottom right.')}</span>
        )}
      </div>
    </div>
  );
}

/* ---------- name the principle ---------- */

function shuffle<T>(list: T[]) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function deal(not?: number) {
  const pool = PRINCIPLES.filter((x) => x.n !== not);
  const principle = pool[Math.floor(Math.random() * pool.length)];
  // the wrong answers come from other parts when possible, so the game turns on the move, not the colour
  const others = shuffle(PRINCIPLES.filter((x) => x.n !== principle.n && x.part !== principle.part)).slice(0, 3);
  return { principle, options: shuffle([principle, ...others]) };
}

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
    <div class="wf-game">
      {score.played > 0 && <p class="wf-game-score">{t('{right} of {played}', score)}{score.streak > 2 ? ` · ${t('{n} in a row', { n: score.streak })}` : ''}</p>}
      <p class="wf-game-scene" key={answer.n}>{answer.scenario}</p>
      <div class="wf-game-options">
        {round.options.map((x, i) => (
          <button
            class={`wf-opt${picked === x.n ? ' picked' : ''}${picked != null && x.n === answer.n ? ' right' : ''}${picked === x.n && x.n !== answer.n ? ' wrong' : ''}`}
            onClick={() => pick(x.n)}
            disabled={picked != null && picked !== x.n && x.n !== answer.n}
            aria-pressed={picked === x.n}
          >
            <span class="wf-opt-key">{String.fromCharCode(65 + i)}</span>
            <span>{x.title}</span>
          </button>
        ))}
      </div>
      {picked != null && (
        <div class="wf-game-reveal" role="status">
          <p><b class={picked === answer.n ? 'yes' : 'no'}>{picked === answer.n ? t('Right.') : t('It was principle {n}.', { n: answer.n })}</b> {answer.line}</p>
          <div class="wf-game-actions">
            <button class="btn btn-quiet btn-s" onClick={() => open(answer)}>{t('Read the principle')}</button>
            <button class="btn btn-primary btn-s" onClick={next}>{t('Next scene')} <Icon name="chevron-right" size={16} /></button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- one principle, opened ---------- */

type Lens = 'why' | 'how';

function PrincipleDetail({ x, lens, practice, onToggle, onTried, go, openTrap, openLaw }: {
  x: Principle;
  lens: Lens;
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

  const principle = (
    <>
      <h3 class="wf-d-h">{t('The principle')}</h3>
      <p class="wf-d-p">{x.gist}</p>
      <figure class="wf-d-story">
        <p class="wf-d-k"><Icon name="book" size={15} /> {t('The story')}</p>
        <figcaption><b>{x.story.who}</b><span>{x.story.when}</span></figcaption>
        <p>{x.story.text}</p>
      </figure>
    </>
  );
  const machinery = (
    <>
      <h3 class="wf-d-h">{t('Why it works on people')}</h3>
      <p class="wf-d-p">{x.mind}</p>
      <h3 class="wf-d-h">{t('The levers it pulls')}</h3>
      <div class="wf-levers">
        {x.levers.map((l, i) => (
          <div class="wf-lever" style={{ '--i': i }}>
            <b>{l.name}</b>
            <p>{l.text}</p>
          </div>
        ))}
      </div>
      {traps.length > 0 && (
        <>
          <h3 class="wf-d-h">{t('The mind traps it disarms')}</h3>
          <div class="wf-links">
            {traps.map(({ trap, how }) => (
              <button class="wf-link" style={{ '--t': `var(--emo-${FAMILIES[trap.family].hue})` }} onClick={() => openTrap(trap.id)}>
                <span class="wf-link-top"><Icon name="spiral" size={15} /> <b>{trap.name}</b> <Icon name="arrow-up-right" size={14} class="wf-link-go" /></span>
                <span class="wf-link-how">{how}</span>
              </button>
            ))}
          </div>
        </>
      )}
      {laws.length > 0 && (
        <>
          <h3 class="wf-d-h">{t('Carnegie vs Greene')}</h3>
          <p class="wf-d-note">{t('The laws of power it answers, and how.')}</p>
          <div class="wf-links">
            {laws.map(({ law, how }) => (
              <button class="wf-link wf-link-law" style={{ '--t': `var(--emo-${lawHue(law)})` }} onClick={() => openLaw(law.n)}>
                <span class="wf-link-top">
                  <Mark id={law.id} hue={lawHue(law)} class="wf-link-mark" />
                  <b><small>{t('Law {n}', { n: law.n })}</small>{law.title}</b>
                  <Icon name="arrow-up-right" size={14} class="wf-link-go" />
                </span>
                <span class="wf-link-how">{how}</span>
              </button>
            ))}
          </div>
        </>
      )}
      <div class="wf-d-study">
        <p class="wf-d-k"><Icon name="info-circle" size={15} /> {t('The experiment')}</p>
        <h4>{x.study.title}</h4>
        <p class="wf-d-who">{x.study.who}</p>
        <p>{x.study.text}</p>
      </div>
      <h3 class="wf-d-h">{t('Where you’ll meet it today')}</h3>
      <ul class="wf-d-list">{x.today.map((l) => <li>{l}</li>)}</ul>
    </>
  );
  const practise = (
    <div class="wf-d-practice">
      <h3 class="wf-d-h">{t('Try this week')}</h3>
      <ol class="wf-d-list tries">{x.practice.map((l) => <li>{l}</li>)}</ol>
      <h3 class="wf-d-h">{t('Where it goes wrong')}</h3>
      <ul class="wf-d-list slips">{x.slips.map((l) => <li>{l}</li>)}</ul>
    </div>
  );

  return (
    <article class="wf-detail" style={{ '--c': `var(--emo-${part.hue})` }}>
      <header class="wf-d-head">
        <Mark id={x.id} hue={hueOf(x)} class="wf-d-mark" />
        <p class="wf-d-kicker">{t('Principle {n}', { n: x.n })} · {t(part.name)}</p>
        <h2 class="wf-d-title">{x.title}</h2>
        <p class="wf-d-line">{x.line}</p>
      </header>

      <section class="wf-d-meters">
        <Meter label={t('How hard')} value={x.hard} about={t('How hard it is to actually do')} />
        <Meter label={t('Everyday')} value={x.everyday} about={t('How often it comes up in ordinary life')} />
      </section>

      {lens === 'why' ? <>{principle}{machinery}{practise}</> : <>{practise}{principle}{machinery}</>}

      <div class="wf-d-shadow">
        <p class="wf-d-k"><Icon name="moon" size={15} /> {t('The shadow side')}</p>
        <p>{x.shadow}</p>
      </div>
      <div class="wf-d-honest">
        <p class="wf-d-k"><Icon name="heart" size={15} /> {t('The honest version')}</p>
        <p>{x.honest}</p>
      </div>

      <blockquote class="wf-d-question">
        <small>{t('A question to sit with')}</small>
        {x.question}
      </blockquote>

      <div class="wf-d-act">
        <button class={`btn btn-quiet wf-act${practice.on ? ' on' : ''}`} aria-pressed={!!practice.on} onClick={() => { haptic(practice.on ? 6 : 10); onToggle(); }}>
          <Icon name={practice.on ? 'check' : 'plus'} size={18} />
          <span>{practice.on ? t('Practising') : t('Practise this')}</span>
        </button>
        <button class="btn btn-quiet wf-act" onClick={() => { haptic(10); onTried(); }}>
          <Icon name="sparkles" size={18} />
          <span>{t('I tried it')}</span>
          {!!practice.tried && <b>×{practice.tried}</b>}
        </button>
      </div>

      <h3 class="wf-d-h">{t('Related principles')}</h3>
      <div class="wf-kin">
        {x.kin.map((k) => BY_N.get(k)).filter((k): k is Principle => !!k).map((k) => (
          <button class="wf-kin-chip" onClick={() => go(k.n)}>
            <Mark id={k.id} hue={hueOf(k)} class="wf-kin-mark" />
            <span>{k.title}</span>
          </button>
        ))}
      </div>
    </article>
  );
}

/* ---------- the page ---------- */

type Sort = 'n' | 'everyday' | 'easy';
const SORTS: Sort[] = ['n', 'everyday', 'easy'];
const LENSES: Lens[] = ['why', 'how'];
const FILTERS: Filter[] = ['all', 'practising', ...PART_IDS];
const WORLD = 'joy';
const LEVERS = new Set(PRINCIPLES.flatMap((x) => x.levers.map((l) => l.name.toLowerCase()))).size;

/** The page wears the wheel's yellow for warmth; tiles and card titles read the accent from the root. */
function useAccent() {
  useLayoutEffect(() => {
    const root = document.documentElement.style;
    root.setProperty('--accent', `var(--emo-${WORLD})`);
    return () => root.removeProperty('--accent');
  }, []);
}

export function Friends({ query: params }: { query: URLSearchParams }) {
  useAccent();
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
  const picked = filter === 'all' || filter === 'practising' ? null : PARTS[filter];

  const openPrinciple = (x: Principle) => { haptic(5); setOpen(x.n); };
  const go = (n: number) => {
    setOpen(n);
    body.current?.closest('.sheet-body')?.scrollTo({ top: 0, behavior: reduced() ? 'auto' : 'smooth' });
  };
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

  return (
    <div class="page stats-page friends-page">
      <div class="journal-top stats-top" style={{ '--sky': `var(--emo-${WORLD})` }}>
        <Sky world={WORLD} />
        <PageHead title={t('Win friends')} back={() => goBack()} subtitle={t('Dale Carnegie’s 30 principles: why they work and how to practise them')} />
        <div class="seg tabs" role="tablist" aria-label={t('Read as')} style={{ '--at': LENSES.indexOf(lens), '--tabs': LENSES.length }}>
          <button role="tab" aria-selected={lens === 'why'} onClick={() => setLens('why')}><Icon name="brain" size={17} /> {t('Why it works')}</button>
          <button role="tab" aria-selected={lens === 'how'} onClick={() => setLens('how')}><Icon name="list-check" size={17} /> {t('How to practise')}</button>
        </div>
      </div>

      <RevealStack>
        <button class="card hero wf-today" style={{ '--c': `var(--emo-${hueOf(today)})` }} onClick={() => openPrinciple(today)}>
          <span class="tile-label">{t('Principle of the day')}</span>
          <span class="wf-today-row">
            <Mark id={today.id} hue={hueOf(today)} class="wf-today-mark" />
            <span class="wf-today-body">
              <span class="wf-today-title">{today.title}</span>
              <span class="wf-today-line">{today.line}</span>
            </span>
          </span>
          {tryToday && (
            <span class="wf-today-try">
              <small><Icon name="sparkles" size={13} /> {t('Try today')}</small>
              {tryToday}
            </span>
          )}
        </button>

        <div class="tiles">
          <Tile k={0} icon="heart-handshake" label={t('Principles')} value={PRINCIPLES.length} sub={t('in {n} parts', { n: PART_IDS.length })} />
          <Tile k={1} icon="brain" label={t('Levers')} value={LEVERS} sub={t('from psychology')} />
          <Tile k={2} icon="spiral" label={t('Mind traps')} value={DISARMED.length} sub={t('that they disarm')} />
          <Tile k={3} icon="check" label={t('Practising')} value={practising} sub={t('tries logged: {n}', { n: triedTotal })} />
        </div>

        <section class="card chart-card">
          <header class="chart-head">
            <div>
              <h3 class="chart-title">{t('The ladder')}</h3>
              <p class="chart-sub">{t('Thirty rungs in the book’s four parts, each in its part’s colour.')}</p>
            </div>
          </header>
          <Ladder filter={filter} practice={practice} open={openPrinciple} />
        </section>

        <section class="card chart-card">
          <header class="chart-head">
            <div>
              <h3 class="chart-title">{t('Where to start')}</h3>
              <p class="chart-sub">{t('Every principle by how hard it is and how often it comes up')}</p>
            </div>
          </header>
          <StartMap open={openPrinciple} />
        </section>

        {ANSWERED.length > 0 && (
          <section class="card chart-card">
            <header class="chart-head">
              <div>
                <h3 class="chart-title">{t('Carnegie vs Greene')}</h3>
                <p class="chart-sub">{t('The laws of power the principles answer. Tap a law to read it, a number to open its principle.')}</p>
              </div>
            </header>
            <ol class="wf-greene">
              {ANSWERED.slice(0, 8).map(({ law, list }, i) => (
                <li style={{ '--c': `var(--emo-${lawHue(law)})`, '--i': i }}>
                  <button class="wf-greene-law" onClick={() => openLaw(law.n)}>
                    <Mark id={law.id} hue={lawHue(law)} class="wf-greene-mark" />
                    <span class="wf-greene-body">
                      <small>{t('Law {n}', { n: law.n })}</small>
                      <b>{law.title}</b>
                    </span>
                  </button>
                  <span class="wf-greene-by">
                    {list.map((x) => (
                      <button class="wf-pip" style={{ '--c': `var(--emo-${hueOf(x)})` }} title={x.title} aria-label={`${x.n}. ${x.title}`} onClick={() => openPrinciple(x)}>{x.n}</button>
                    ))}
                  </span>
                </li>
              ))}
            </ol>
          </section>
        )}

        {DISARMED.length > 0 && (
          <section class="card chart-card">
            <header class="chart-head">
              <div>
                <h3 class="chart-title">{t('The mind traps they disarm')}</h3>
                <p class="chart-sub">{t('The biases the principles work against most. Tap one to read it in Mind traps.')}</p>
              </div>
            </header>
            <ol class="wf-disarmed">
              {DISARMED.slice(0, 8).map(({ trap, list }, i) => (
                <li style={{ '--c': `var(--emo-${FAMILIES[trap.family].hue})`, '--i': i }}>
                  <button class="wf-disarmed-row" onClick={() => openTrap(trap.id)}>
                    <span class="wf-disarmed-name">{trap.name}</span>
                    <span class="wf-disarmed-n">{list.length}</span>
                    <span class="wf-disarmed-bar"><i style={{ width: `${(list.length / DISARMED[0].list.length) * 100}%` }} /></span>
                  </button>
                </li>
              ))}
            </ol>
          </section>
        )}

        <section class="card chart-card">
          <header class="chart-head">
            <div>
              <h3 class="chart-title">{t('Name the principle')}</h3>
              <p class="chart-sub">{t('Which principle is at work?')}</p>
            </div>
          </header>
          <NameThePrinciple open={openPrinciple} />
        </section>
      </RevealStack>

      <section class="section">
        <h2 class="section-title">{t('All {n} principles', { n: PRINCIPLES.length })}</h2>
        <label class="search">
          <Icon name="search" size={18} />
          <input type="search" value={query} onInput={(e) => setQuery(e.currentTarget.value)} placeholder={t('Search principles, levers or things to try')} aria-label={t('Search principles, levers or things to try')} />
        </label>
        <div class="wf-controls">
          <div class="chips scroll-x wf-chips" role="toolbar" aria-label={t('Part')}>
            <button class="chip" aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>{t('All')}</button>
            <button class="chip wf-chip" style={{ '--c': 'var(--accent)' }} aria-pressed={filter === 'practising'} onClick={() => setFilter(filter === 'practising' ? 'all' : 'practising')}>
              <Icon name="check" size={14} /> {t('Practising')}
            </button>
            {PART_IDS.map((p) => (
              <button class="chip wf-chip" style={{ '--c': `var(--emo-${PARTS[p].hue})` }} aria-pressed={filter === p} onClick={() => setFilter(filter === p ? 'all' : p)}>{t(PARTS[p].name)}</button>
            ))}
          </div>
          <div class="seg compact wf-sort" role="radiogroup" aria-label={t('Sort')}>
            {([['n', t('In order')], ['everyday', t('Commonest')], ['easy', t('Easiest')]] as [Sort, string][]).map(([v, l]) => (
              <button role="radio" aria-checked={sort === v} aria-selected={sort === v} onClick={() => setSort(v)}>{l}</button>
            ))}
          </div>
        </div>
        {picked && <p class="muted small wf-part-about">{t(picked.about)}</p>}

        <ol class="wf-list">
          {shown.map((x, i) => (
            <li key={x.n} style={{ '--c': `var(--emo-${hueOf(x)})`, '--i': Math.min(i, 4) }}>
              <button class="card wf-card" onClick={() => openPrinciple(x)}>
                <Mark id={x.id} hue={hueOf(x)} class="wf-card-mark" />
                <span class="wf-card-main">
                  <span class="wf-card-top">
                    {t('Principle {n}', { n: x.n })} · {t(PARTS[x.part].name)}
                    {practice[x.n]?.on && <span class="wf-card-on"><Icon name="check" size={12} /> {t('practising')}</span>}
                    {!!practice[x.n]?.tried && <span class="wf-card-tried"><Icon name="sparkles" size={12} /> {practice[x.n].tried}</span>}
                  </span>
                  <span class="wf-card-title">{x.title}</span>
                  <span class="wf-card-line">{x.line}</span>
                </span>
                <span class="wf-card-hard" title={t('How hard: {h} of 10', { h: x.hard })}>
                  <b>{x.hard}</b>
                  <small>{t('hard')}</small>
                </span>
              </button>
            </li>
          ))}
        </ol>
        {!shown.length && (
          <p class="empty-note">
            {filter === 'practising' && !query.trim()
              ? t('Nothing in practice yet. Open a principle and tap “Practise this”.')
              : t('No principle matches that. Try talking in terms of what it wants.')}
          </p>
        )}
      </section>

      <section class="section wf-about">
        <p>{t('Carnegie wrote the book in 1936 for salesmen and managers, and it has sold more than thirty million copies since. It’s easy to read as a manual for getting your way, and easy to sneer at for the same reason. But nearly every principle rests on one plain fact: people can tell whether you’re actually interested in them. So each principle here has the psychology underneath it, the mind traps it disarms, the laws of power it answers, and an honest version beside the one that turns into flattery.')}</p>
        <button class="btn btn-quiet" onClick={() => openPrinciple(PRINCIPLES[Math.floor(Math.random() * PRINCIPLES.length)])}><Icon name="dice-5" size={18} /> {t('Draw a principle at random')}</button>
      </section>

      <Sheet open={!!open} onClose={() => setOpen(null)} title={current ? t('Principle {n} of {total}', { n: current.n, total: PRINCIPLES.length }) : ''} label={current?.title} tall>
        <div ref={body}>
          {current && (
            <PrincipleDetail
              key={current.n}
              x={current}
              lens={lens}
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
