import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { goBack, navigateAfterSheet } from '../lib/router';
import { usePref } from '../lib/prefs';
import { haptic } from '../lib/haptics';
import { t } from '../lib/i18n';
import { LAWS, REALMS, roman, type Law, type Realm } from '../data/laws';
import { FAMILIES, TRAPS, type Trap } from '../data/traps';
import { Icon } from '../components/icons';
import { Mark } from '../components/Mark';
import { Sheet } from '../components/Sheet';
import { PageHead } from '../components/PageHead';
import { RevealStack } from '../components/charts';
import { Sky } from '../components/Sky';
import { Tile } from './stats/parts';
import '../styles/stats.css';
import '../styles/laws.css';

/*
 * The 48 Laws of Power, under Insights: the same sky, cards and tiles as Stats, with every law wearing its own mark,
 * a small ink-and-paper drawing (data/marks.ts) on a tile in its arena's colour. Each law opens to its history, its
 * psychology, the mind traps it springs (linked to the Mind traps page) and how to see it coming. The data is in data/laws.
 */

const BY_N = new Map(LAWS.map((x) => [x.n, x]));
const TRAP_BY_ID = new Map(TRAPS.map((x) => [x.id, x]));
const REALM_IDS = Object.keys(REALMS) as Realm[];
const hueOf = (x: Law) => REALMS[x.realm].hue;
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Every mind trap the laws spring, most-sprung first, with the laws that spring it. */
const SPRUNG = (() => {
  const by = new Map<string, Law[]>();
  for (const x of LAWS) for (const { id } of x.traps) if (TRAP_BY_ID.has(id)) by.set(id, [...(by.get(id) ?? []), x]);
  return [...by.entries()].map(([id, laws]) => ({ trap: TRAP_BY_ID.get(id)!, laws })).sort((a, b) => b.laws.length - a.laws.length);
})();

function Meter({ label, value, about }: { label: string; value: number; about: string }) {
  return (
    <div class="lw-meter" title={about}>
      <span>{label}</span>
      <i>{Array.from({ length: 10 }, (_, i) => <b class={i < value ? 'on' : ''} style={{ '--i': i }} />)}</i>
      <em>{value}</em>
    </div>
  );
}

/* ---------- the board ---------- */

/** All 48 on a chessboard, eight by six. */
function Board({ realm, open }: { realm: Realm | null; open: (x: Law) => void }) {
  const [hot, setHot] = useState<number | null>(null);
  const focus = hot ? BY_N.get(hot)! : null;
  return (
    <div class="lw-board-wrap">
      <div class="lw-board" role="group" aria-label={t('All 48 laws')}>
        {LAWS.map((x, i) => {
          const dark = (Math.floor(i / 8) + i) % 2 === 1;
          return (
            <button
              class={`lw-sq${dark ? ' dark' : ''}${realm && x.realm !== realm ? ' dim' : ''}${focus && focus.kin.includes(x.n) ? ' kin' : ''}`}
              style={{ '--c': `var(--emo-${hueOf(x)})`, '--i': i }}
              aria-label={`${x.n}. ${x.title}`}
              onClick={() => open(x)}
              onPointerEnter={() => setHot(x.n)}
              onPointerLeave={() => setHot((h) => (h === x.n ? null : h))}
              onFocus={() => setHot(x.n)}
              onBlur={() => setHot((h) => (h === x.n ? null : h))}
            >
              <span class="lw-sq-n">{roman(x.n)}</span>
              <i class="lw-sq-dot" />
            </button>
          );
        })}
      </div>
      <div class="lw-caption" aria-live="polite">
        {focus ? (
          <>
            <b>{focus.title}</b>
            <span>{focus.line}</span>
          </>
        ) : (
          <span>{t('Hover or focus a square to read its law, tap to open it.')}</span>
        )}
      </div>
    </div>
  );
}

/* ---------- the shadow map ---------- */

/** Every law by how manipulative it is against how often it plays out in ordinary life. */
function ShadowMap({ open }: { open: (x: Law) => void }) {
  const [hot, setHot] = useState<number | null>(null);
  const W = 400, H = 300, P = 30;
  const xOf = (v: number) => P + ((v - 0.5) / 10) * (W - P * 2);
  const yOf = (v: number) => H - P - ((v - 0.5) / 10) * (H - P * 2);
  // laws on the same spot fan out round it, so none hides another
  const dots = useMemo(() => {
    const at = new Map<string, Law[]>();
    for (const x of LAWS) at.set(`${x.everyday},${x.dark}`, [...(at.get(`${x.everyday},${x.dark}`) ?? []), x]);
    return LAWS.map((x) => {
      const same = at.get(`${x.everyday},${x.dark}`)!;
      const k = same.indexOf(x), n = same.length;
      const a = (k / n) * Math.PI * 2 + 0.6, d = n > 1 ? 6 + n * 0.8 : 0;
      return { x, px: xOf(x.everyday) + Math.cos(a) * d, py: yOf(x.dark) + Math.sin(a) * d };
    });
  }, []);
  const focus = hot ? BY_N.get(hot)! : null;
  const quads: [number, number, string, string][] = [
    [P + 6, P + 4, t('Dark arts'), 'start'],
    [W - P - 6, P + 4, t('Everyday manipulation'), 'end'],
    [P + 6, H - P - 8, t('Rare tactics'), 'start'],
    [W - P - 6, H - P - 8, t('Plain wisdom'), 'end'],
  ];
  return (
    <div class="lw-map">
      <svg viewBox={`0 0 ${W} ${H}`} role="group" aria-label={t('Every law by darkness and how often it plays out')}>
        <rect x={W / 2} y={P} width={W / 2 - P} height={H / 2 - P} class="lw-map-hot" />
        <line x1={W / 2} y1={P} x2={W / 2} y2={H - P} class="lw-map-axis" />
        <line x1={P} y1={H / 2} x2={W - P} y2={H / 2} class="lw-map-axis" />
        <rect x={P} y={P} width={W - P * 2} height={H - P * 2} class="lw-map-frame" />
        {quads.map(([x, y, label, anchor]) => <text x={x} y={y + 10} text-anchor={anchor} class="lw-map-quad">{label}</text>)}
        <text x={W / 2} y={H - 8} text-anchor="middle" class="lw-map-label">{t('How often it plays out')} →</text>
        <text x={12} y={H / 2} text-anchor="middle" class="lw-map-label" transform={`rotate(-90 12 ${H / 2})`}>{t('How dark it is')} →</text>
        {focus && (
          <g class="lw-map-kin" style={{ '--c': `var(--emo-${hueOf(focus)})` }}>
            {focus.kin.map((k) => {
              const a = dots.find((d) => d.x.n === focus.n)!, b = dots.find((d) => d.x.n === k);
              return b && <line x1={a.px} y1={a.py} x2={b.px} y2={b.py} />;
            })}
          </g>
        )}
        {dots.map(({ x, px, py }, i) => (
          <g
            class={`lw-dot${hot === x.n ? ' hot' : ''}${focus && focus.kin.includes(x.n) ? ' kin' : ''}`}
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
            <circle cx={px} cy={py} r={11} class="lw-dot-hit" />
            <circle cx={px} cy={py} r={5} class="lw-dot-mark" />
            <text x={px} y={py - 8} text-anchor="middle" class="lw-dot-n">{x.n}</text>
          </g>
        ))}
      </svg>
      <div class="lw-caption" aria-live="polite">
        {focus ? (
          <>
            <b>{focus.n}. {focus.title}</b>
            <span>{t('Darkness {d} · everyday {e} · tap to open', { d: focus.dark, e: focus.everyday })}</span>
          </>
        ) : (
          <span>{t('Up is darker, right is more common. The top right is what you most need to recognise.')}</span>
        )}
      </div>
    </div>
  );
}

/* ---------- name the move ---------- */

function shuffle<T>(list: T[]) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function deal(not?: number) {
  const pool = LAWS.filter((x) => x.n !== not);
  const law = pool[Math.floor(Math.random() * pool.length)];
  // the wrong answers come from other arenas when possible, so the game turns on the move, not the colour
  const others = shuffle(LAWS.filter((x) => x.n !== law.n && x.realm !== law.realm)).slice(0, 3);
  return { law, options: shuffle([law, ...others]) };
}

function NameTheMove({ open }: { open: (x: Law) => void }) {
  const [round, setRound] = useState(() => deal());
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState({ right: 0, played: 0, streak: 0 });
  const pick = (n: number) => {
    if (picked != null) return;
    const right = n === round.law.n;
    haptic(right ? 6 : 14);
    setPicked(n);
    setScore((s) => ({ right: s.right + (right ? 1 : 0), played: s.played + 1, streak: right ? s.streak + 1 : 0 }));
  };
  const next = () => { setRound(deal(round.law.n)); setPicked(null); };
  return (
    <div class="lw-game">
      {score.played > 0 && <p class="lw-game-score">{t('{right} of {played}', score)}{score.streak > 2 ? ` · ${t('{n} in a row', { n: score.streak })}` : ''}</p>}
      <p class="lw-game-scene" key={round.law.n}>{round.law.scenario}</p>
      <div class="lw-game-options">
        {round.options.map((x, i) => (
          <button
            class={`lw-opt${picked === x.n ? ' picked' : ''}${picked != null && x.n === round.law.n ? ' right' : ''}${picked === x.n && x.n !== round.law.n ? ' wrong' : ''}`}
            onClick={() => pick(x.n)}
            disabled={picked != null && picked !== x.n && x.n !== round.law.n}
            aria-pressed={picked === x.n}
          >
            <span class="lw-opt-key">{String.fromCharCode(65 + i)}</span>
            <span>{x.title}</span>
          </button>
        ))}
      </div>
      {picked != null && (
        <div class="lw-game-reveal" role="status">
          <p><b class={picked === round.law.n ? 'yes' : 'no'}>{picked === round.law.n ? t('Right.') : t('It was law {n}.', { n: round.law.n })}</b> {round.law.line}</p>
          <div class="lw-game-actions">
            <button class="btn btn-quiet btn-s" onClick={() => open(round.law)}>{t('Read the law')}</button>
            <button class="btn btn-primary btn-s" onClick={next}>{t('Next move')} <Icon name="chevron-right" size={16} /></button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ---------- what you've seen ---------- */

/** On this device: how often you've seen each law played on you, and caught yourself playing it. */
const SEEN = 'mm-laws-seen';
type Seen = Record<number, { on?: number; by?: number }>;
function useSeen() {
  const [seen, set] = useState<Seen>(() => {
    try { return JSON.parse(localStorage.getItem(SEEN) || '{}') ?? {}; } catch { return {}; }
  });
  const add = (n: number, k: 'on' | 'by') => {
    const next = { ...seen, [n]: { ...seen[n], [k]: (seen[n]?.[k] ?? 0) + 1 } };
    set(next);
    try { localStorage.setItem(SEEN, JSON.stringify(next)); } catch {}
  };
  return [seen, add] as const;
}

/* ---------- one law, opened ---------- */

type Lens = 'player' | 'target';

function LawDetail({ x, lens, seen, onSeen, go, openTrap }: { x: Law; lens: Lens; seen: { on?: number; by?: number }; onSeen: (k: 'on' | 'by') => void; go: (n: number) => void; openTrap: (id: string) => void }) {
  const realm = REALMS[x.realm];
  const traps = x.traps.map((s) => ({ ...s, trap: TRAP_BY_ID.get(s.id) })).filter((s): s is typeof s & { trap: Trap } => !!s.trap);

  const law = (
    <>
      <h3 class="lw-d-h">{t('The law')}</h3>
      <p class="lw-d-p">{x.gist}</p>
      <figure class="lw-d-scene">
        <p class="lw-d-k"><Icon name="book" size={15} /> {t('From history')}</p>
        <figcaption><b>{x.scene.who}</b><span>{x.scene.when}</span></figcaption>
        <p>{x.scene.text}</p>
      </figure>
    </>
  );
  const machinery = (
    <>
      <h3 class="lw-d-h">{t('Why it works on people')}</h3>
      <p class="lw-d-p">{x.mind}</p>
      <h3 class="lw-d-h">{t('The levers it pulls')}</h3>
      <div class="lw-levers">
        {x.levers.map((l, i) => (
          <div class="lw-lever" style={{ '--i': i }}>
            <b>{l.name}</b>
            <p>{l.text}</p>
          </div>
        ))}
      </div>
      {traps.length > 0 && (
        <>
          <h3 class="lw-d-h">{t('The mind traps it springs')}</h3>
          <div class="lw-springs">
            {traps.map(({ trap, how }) => (
              <button class="lw-spring" style={{ '--t': `var(--emo-${FAMILIES[trap.family].hue})` }} onClick={() => openTrap(trap.id)}>
                <span class="lw-spring-top"><Icon name="spiral" size={15} /> <b>{trap.name}</b> <Icon name="arrow-up-right" size={14} class="lw-spring-go" /></span>
                <span class="lw-spring-how">{how}</span>
              </button>
            ))}
          </div>
        </>
      )}
      <div class="lw-d-study">
        <p class="lw-d-k"><Icon name="info-circle" size={15} /> {t('The experiment')}</p>
        <h4>{x.study.title}</h4>
        <p class="lw-d-who">{x.study.who}</p>
        <p>{x.study.text}</p>
      </div>
      <h3 class="lw-d-h">{t('Where you’ll meet it today')}</h3>
      <ul class="lw-d-list">{x.today.map((l) => <li>{l}</li>)}</ul>
    </>
  );
  const defence = (
    <div class="lw-d-defence">
      <h3 class="lw-d-h">{t('When it’s played on you')}</h3>
      <ul class="lw-d-list signs">{x.signs.map((l) => <li>{l}</li>)}</ul>
      <h3 class="lw-d-h">{t('Your defence')}</h3>
      <ol class="lw-d-list counter">{x.defense.map((l) => <li>{l}</li>)}</ol>
    </div>
  );

  return (
    <article class="lw-detail" style={{ '--c': `var(--emo-${realm.hue})` }}>
      <header class="lw-d-head">
        <Mark id={x.id} hue={hueOf(x)} class="lw-d-mark" />
        <p class="lw-d-kicker">{t('Law {n}', { n: x.n })} · {t(realm.name)}</p>
        <h2 class="lw-d-title">{x.title}</h2>
        <p class="lw-d-line">{x.line}</p>
      </header>

      <section class="lw-d-meters">
        <Meter label={t('Darkness')} value={x.dark} about={t('How manipulative it is')} />
        <Meter label={t('Everyday')} value={x.everyday} about={t('How often it plays out in ordinary life')} />
      </section>

      {lens === 'player' ? <>{law}{machinery}{defence}</> : <>{defence}{law}{machinery}</>}

      <div class="lw-d-shadow">
        <p class="lw-d-k"><Icon name="moon" size={15} /> {t('The shadow side')}</p>
        <p>{x.shadow}</p>
      </div>
      <div class="lw-d-honest">
        <p class="lw-d-k"><Icon name="heart" size={15} /> {t('The honest version')}</p>
        <p>{x.honest}</p>
      </div>

      <blockquote class="lw-d-question">
        <small>{t('A question to sit with')}</small>
        {x.question}
      </blockquote>

      <div class="lw-d-seen">
        <button class="btn btn-quiet lw-seen" onClick={() => { haptic(10); onSeen('on'); }}>
          <Icon name="eye" size={18} />
          <span>{t('Played on me')}</span>
          {!!seen.on && <b>×{seen.on}</b>}
        </button>
        <button class="btn btn-quiet lw-seen" onClick={() => { haptic(10); onSeen('by'); }}>
          <Icon name="crown" size={18} />
          <span>{t('I played it')}</span>
          {!!seen.by && <b>×{seen.by}</b>}
        </button>
      </div>

      <h3 class="lw-d-h">{t('Related laws')}</h3>
      <div class="lw-kin">
        {x.kin.map((k) => BY_N.get(k)).filter((k): k is Law => !!k).map((k) => (
          <button class="lw-kin-chip" onClick={() => go(k.n)}>
            <Mark id={k.id} hue={hueOf(k)} class="lw-kin-mark" />
            <span>{k.title}</span>
          </button>
        ))}
      </div>
    </article>
  );
}

/* ---------- the page ---------- */

type Sort = 'n' | 'dark' | 'everyday';
const SORTS: Sort[] = ['n', 'dark', 'everyday'];
const LENSES: Lens[] = ['player', 'target'];
const WORLD = 'anger';
const LEVERS = new Set(LAWS.flatMap((x) => x.levers.map((l) => l.name.toLowerCase()))).size;

/** The page wears the wheel's red for power; tiles and card titles read the accent from the root. */
function useAccent() {
  useLayoutEffect(() => {
    const root = document.documentElement.style;
    root.setProperty('--accent', `var(--emo-${WORLD})`);
    return () => root.removeProperty('--accent');
  }, []);
}

export function Laws({ query: params }: { query: URLSearchParams }) {
  useAccent();
  const [open, setOpen] = useState<number | null>(() => Number(params.get('open')) || null);
  const [realm, setRealm] = usePref<string>('laws-realm', 'all', ['all', ...REALM_IDS]);
  const [sort, setSort] = usePref<Sort>('laws-sort', 'n', SORTS);
  const [lens, setLens] = usePref<Lens>('laws-lens', 'player', LENSES);
  const [query, setQuery] = useState('');
  const [seen, addSeen] = useSeen();
  const body = useRef<HTMLDivElement>(null);

  const today = LAWS[Math.floor((Date.now() - new Date().getTimezoneOffset() * 60_000) / 86_400_000) % LAWS.length];
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = LAWS.filter((x) => (realm === 'all' || x.realm === realm) && (!q || `${x.n} ${x.title} ${x.line} ${x.gist} ${x.signs.join(' ')} ${x.levers.map((l) => l.name).join(' ')}`.toLowerCase().includes(q)));
    if (sort === 'dark') list.sort((a, b) => b.dark - a.dark || a.n - b.n);
    if (sort === 'everyday') list.sort((a, b) => b.everyday - a.everyday || a.n - b.n);
    return list;
  }, [realm, sort, query]);
  const seenOn = Object.values(seen).reduce((s, v) => s + (v.on ?? 0), 0);
  const seenBy = Object.values(seen).reduce((s, v) => s + (v.by ?? 0), 0);
  const picked = realm === 'all' ? null : REALMS[realm as Realm];

  const openLaw = (x: Law) => { haptic(5); setOpen(x.n); };
  const go = (n: number) => {
    setOpen(n);
    body.current?.closest('.sheet-body')?.scrollTo({ top: 0, behavior: reduced() ? 'auto' : 'smooth' });
  };
  const openTrap = (id: string) => { setOpen(null); navigateAfterSheet(`traps?open=${id}`); };
  // the sheet keeps showing the last law while it slides away
  const last = useRef<Law | null>(null);
  if (open) last.current = BY_N.get(open) ?? null;
  const current = last.current;

  // a link to a law that doesn't exist opens nothing
  useEffect(() => { if (open && !BY_N.has(open)) setOpen(null); }, [open]);

  return (
    <div class="page stats-page laws-page">
      <div class="journal-top stats-top" style={{ '--sky': `var(--emo-${WORLD})` }}>
        <Sky world={WORLD} />
        <PageHead title={t('Laws of power')} back={() => goBack()} subtitle={t('Robert Greene’s 48 laws: the history, the psychology and how to see them coming')} />
        <div class="seg tabs" role="tablist" aria-label={t('Read as')} style={{ '--at': LENSES.indexOf(lens), '--tabs': LENSES.length }}>
          <button role="tab" aria-selected={lens === 'player'} onClick={() => setLens('player')}><Icon name="crown" size={17} /> {t('As the player')}</button>
          <button role="tab" aria-selected={lens === 'target'} onClick={() => setLens('target')}><Icon name="eye" size={17} /> {t('As the target')}</button>
        </div>
      </div>

      <RevealStack>
        <button class="card hero lw-today" style={{ '--c': `var(--emo-${hueOf(today)})` }} onClick={() => openLaw(today)}>
          <span class="tile-label">{t('Law of the day')}</span>
          <span class="lw-today-row">
            <Mark id={today.id} hue={hueOf(today)} class="lw-today-mark" />
            <span class="lw-today-body">
              <span class="lw-today-title">{today.title}</span>
              <span class="lw-today-line">{today.line}</span>
            </span>
          </span>
          <span class="lw-today-q">{today.question}</span>
        </button>

        <div class="tiles">
          <Tile k={0} icon="crown" label={t('Laws')} value={LAWS.length} sub={t('in {n} arenas', { n: REALM_IDS.length })} />
          <Tile k={1} icon="brain" label={t('Levers')} value={LEVERS} sub={t('from psychology')} />
          <Tile k={2} icon="spiral" label={t('Mind traps')} value={SPRUNG.length} sub={t('that the laws spring')} />
          <Tile k={3} icon="eye" label={t('Played on you')} value={seenOn} sub={t('played yourself {n}', { n: seenBy })} />
        </div>

        <section class="card chart-card">
          <header class="chart-head">
            <div>
              <h3 class="chart-title">{t('The board')}</h3>
              <p class="chart-sub">{t('Forty-eight squares, one law each, in its arena’s colour.')}</p>
            </div>
          </header>
          <Board realm={picked ? (realm as Realm) : null} open={openLaw} />
        </section>

        <section class="card chart-card">
          <header class="chart-head">
            <div>
              <h3 class="chart-title">{t('How dark, how common')}</h3>
              <p class="chart-sub">{t('Every law by darkness and how often it plays out')}</p>
            </div>
          </header>
          <ShadowMap open={openLaw} />
        </section>

        <section class="card chart-card">
          <header class="chart-head">
            <div>
              <h3 class="chart-title">{t('The mind traps they spring')}</h3>
              <p class="chart-sub">{t('The biases the laws lean on most. Tap one to read it in Mind traps.')}</p>
            </div>
          </header>
          <ol class="lw-sprung">
            {SPRUNG.slice(0, 8).map(({ trap, laws }, i) => (
              <li style={{ '--c': `var(--emo-${FAMILIES[trap.family].hue})`, '--i': i }}>
                <button class="lw-sprung-row" onClick={() => openTrap(trap.id)}>
                  <span class="lw-sprung-name">{trap.name}</span>
                  <span class="lw-sprung-n">{laws.length}</span>
                  <span class="lw-sprung-bar"><i style={{ width: `${(laws.length / SPRUNG[0].laws.length) * 100}%` }} /></span>
                </button>
              </li>
            ))}
          </ol>
        </section>

        <section class="card chart-card">
          <header class="chart-head">
            <div>
              <h3 class="chart-title">{t('Name the move')}</h3>
              <p class="chart-sub">{t('Which law is being played?')}</p>
            </div>
          </header>
          <NameTheMove open={openLaw} />
        </section>
      </RevealStack>

      <section class="section">
        <h2 class="section-title">{t('All 48 laws')}</h2>
        <label class="search">
          <Icon name="search" size={18} />
          <input type="search" value={query} onInput={(e) => setQuery(e.currentTarget.value)} placeholder={t('Search laws, signs or levers')} aria-label={t('Search laws, signs or levers')} />
        </label>
        <div class="lw-controls">
          <div class="chips scroll-x lw-chips" role="toolbar" aria-label={t('Arena')}>
            <button class="chip" aria-pressed={!picked} onClick={() => setRealm('all')}>{t('All')}</button>
            {REALM_IDS.map((r) => (
              <button class="chip lw-chip" style={{ '--c': `var(--emo-${REALMS[r].hue})` }} aria-pressed={realm === r} onClick={() => setRealm(realm === r ? 'all' : r)}>{t(REALMS[r].name)}</button>
            ))}
          </div>
          <div class="seg compact lw-sort" role="radiogroup" aria-label={t('Sort')}>
            {([['n', t('In order')], ['dark', t('Darkest')], ['everyday', t('Commonest')]] as [Sort, string][]).map(([v, l]) => (
              <button role="radio" aria-checked={sort === v} aria-selected={sort === v} onClick={() => setSort(v)}>{l}</button>
            ))}
          </div>
        </div>
        {picked && <p class="muted small lw-realm-about">{t(picked.about)}</p>}

        <ol class="lw-list">
          {shown.map((x, i) => (
            <li key={x.n} style={{ '--c': `var(--emo-${hueOf(x)})`, '--i': Math.min(i, 4) }}>
              <button class="card lw-card" onClick={() => openLaw(x)}>
                <Mark id={x.id} hue={hueOf(x)} class="lw-card-mark" />
                <span class="lw-card-main">
                  <span class="lw-card-top">
                    {t('Law {n}', { n: x.n })} · {t(REALMS[x.realm].name)}
                    {!!seen[x.n]?.on && <span class="lw-card-seen"><Icon name="eye" size={12} /> {seen[x.n].on}</span>}
                    {!!seen[x.n]?.by && <span class="lw-card-seen"><Icon name="crown" size={12} /> {seen[x.n].by}</span>}
                  </span>
                  <span class="lw-card-title">{x.title}</span>
                  <span class="lw-card-line">{x.line}</span>
                </span>
                <span class="lw-card-dark" title={t('Darkness {d} of 10', { d: x.dark })}>
                  <b>{x.dark}</b>
                  <small>{t('dark')}</small>
                </span>
              </button>
            </li>
          ))}
        </ol>
        {!shown.length && <p class="empty-note">{t('No law matches that. Saying less than necessary, perhaps.')}</p>}
      </section>

      <section class="section lw-about">
        <p>{t('Greene wrote the book without morals on purpose: these are the moves, as courtiers, generals and con artists have made them for centuries. Most people who read it aren’t would-be kings, they’re people who kept losing a game they didn’t know was being played. So each law here also has its shadow side, an honest version, and the signs that someone is playing it on you.')}</p>
        <button class="btn btn-quiet" onClick={() => openLaw(LAWS[Math.floor(Math.random() * LAWS.length)])}><Icon name="dice-5" size={18} /> {t('Draw a law at random')}</button>
      </section>

      <Sheet open={!!open} onClose={() => setOpen(null)} title={current ? t('Law {n} of 48', { n: current.n }) : ''} label={current?.title} tall>
        <div ref={body}>
          {current && <LawDetail key={current.n} x={current} lens={lens} seen={seen[current.n] ?? {}} onSeen={(k) => addSeen(current.n, k)} go={go} openTrap={openTrap} />}
        </div>
      </Sheet>
    </div>
  );
}
