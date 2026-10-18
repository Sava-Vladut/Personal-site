import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { goBack, navigateAfterSheet } from '../lib/router';
import { usePref } from '../lib/prefs';
import { haptic } from '../lib/haptics';
import { t } from '../lib/i18n';
import { LAWS, REALMS, roman, type Law, type Realm } from '../data/laws';
import { FAMILIES, TRAPS, type Trap } from '../data/traps';
import { Icon } from '../components/icons';
import { NavWheel } from '../components/NavWheel';
import { CountdownButton } from '../components/CountdownButton';
import { Sheet } from '../components/Sheet';
import '../styles/laws.css';

/*
 * The 48 Laws of Power: a candlelit chessboard. A pawn whose shadow on the wall is a king, a board of 48 squares,
 * and every law sealed in wax in its arena's colour. Each law opens to its history, its psychology, the mind traps
 * it springs (linked to the Mind traps page) and how to see it coming. The data is in data/laws.
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

function seeded(text: string) {
  let h = 2166136261;
  for (const c of text) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = Math.imul(a ^ (a >>> 15), 1 | a);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------- the art ---------- */

const PAWN = 'M50 14a15 15 0 0 1 8.6 27.3c4.6 1.3 7.4 3.4 7.4 5.7 0 2.2-2.4 3.9-6 4.9 2.6 11 7.4 24.3 15.6 34.6 2.8.9 4.4 2.8 4.4 5.5v6H20v-6c0-2.7 1.6-4.6 4.4-5.5C32.6 76.2 37.4 62.9 40 51.9c-3.6-1-6-2.7-6-4.9 0-2.3 2.8-4.4 7.4-5.7A15 15 0 0 1 50 14zM14 100h72v10H14z';
const KING = 'M46 2h8v9h9v8h-9v7h-8v-7h-9v-8h9zM29 31q21-9 42 0l-4 22H33zM31 55h38v8H31zM36 65h28c1 28 6 52 13 73H23c7-21 12-45 13-73zM18 140h64v9H18zM13 151h74v12H13z';

/** The hero: a candle, a pawn on the floor, and on the wall behind it the shadow of a king. */
function Hero() {
  return (
    <svg class="lw-scene" viewBox="0 0 300 230" aria-hidden="true">
      <defs>
        <radialGradient id="lw-glow" cx="0.14" cy="0.62" r="0.75">
          <stop offset="0" class="lw-glow-0" />
          <stop offset="1" class="lw-glow-1" />
        </radialGradient>
        <linearGradient id="lw-floor" x1="0" x2="1">
          <stop offset="0" class="lw-floor-0" />
          <stop offset="0.5" class="lw-floor-1" />
          <stop offset="1" class="lw-floor-0" />
        </linearGradient>
      </defs>
      <rect width="300" height="230" fill="url(#lw-glow)" />
      <g class="lw-shadow">
        <path d={KING} transform="translate(150 10) scale(1.22)" />
      </g>
      <rect x="0" y="209" width="300" height="1.2" fill="url(#lw-floor)" />
      <path d={PAWN} class="lw-pawn" transform="translate(84 112) scale(0.88)" />
      <g class="lw-candle" transform="translate(34 148)">
        <ellipse cx="0" cy="-14" rx="16" ry="22" class="lw-halo" />
        <path d="M0 -26C5 -18 6 -12 0 -4C-6 -12 -5 -18 0 -26z" class="lw-flame" />
        <path d="M0 -4v4" class="lw-wick" />
        <rect x="-7" y="0" width="14" height="61" rx="2" class="lw-wax" />
        <path d="M-7 8q3 6 0 12M5 0q2 9 2 14" class="lw-drip" />
      </g>
    </svg>
  );
}

/** A wax seal with the law's numeral pressed into it. Its edge is grown from the law's id, so each seal is its own. */
function Seal({ x, size = 64, class: cls }: { x: Law; size?: number; class?: string }) {
  const edge = useMemo(() => {
    const r = seeded(x.id);
    const pts = Array.from({ length: 22 }, (_, i) => {
      const a = (i / 22) * Math.PI * 2, rad = 44 + r() * 4.5;
      return [50 + rad * Math.cos(a), 50 + rad * Math.sin(a)];
    });
    let d = '';
    pts.forEach((p, i) => {
      const q = pts[(i + 1) % pts.length];
      const mx = (p[0] + q[0]) / 2, my = (p[1] + q[1]) / 2;
      d += (i ? '' : `M${((pts[pts.length - 1][0] + p[0]) / 2).toFixed(1)} ${((pts[pts.length - 1][1] + p[1]) / 2).toFixed(1)}`) + `Q${p[0].toFixed(1)} ${p[1].toFixed(1)} ${mx.toFixed(1)} ${my.toFixed(1)}`;
    });
    return d + 'z';
  }, [x.id]);
  const num = roman(x.n);
  return (
    <svg class={`lw-seal${cls ? ' ' + cls : ''}`} width={size} height={size} viewBox="0 0 100 100" style={{ '--c': `var(--emo-${hueOf(x)})` }} aria-hidden="true">
      <path d={edge} class="lw-seal-wax" />
      <circle cx="50" cy="50" r="33" class="lw-seal-ring" />
      <circle cx="50" cy="50" r="29" class="lw-seal-ring thin" />
      <text x="50" y="50" class="lw-seal-num" style={{ fontSize: num.length > 4 ? '17px' : num.length > 2 ? '21px' : '26px' }} text-anchor="middle" dominant-baseline="central">{num}</text>
    </svg>
  );
}

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
          <span>{t('Forty-eight squares, one law each. Hover or focus one to read it, tap to open it.')}</span>
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
    <div class="lw-game" style={{ '--c': `var(--emo-${hueOf(round.law)})` }}>
      <div class="lw-game-top">
        <span><Icon name="eye" size={15} /> {t('Which law is being played?')}</span>
        {score.played > 0 && <b>{t('{right} of {played}', score)}{score.streak > 2 ? ` · ${t('{n} in a row', { n: score.streak })}` : ''}</b>}
      </div>
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
      <p class="lw-d-p lw-d-gist">{x.gist}</p>
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
        <Seal x={x} size={118} class="lw-d-seal" />
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
        <button class="lw-seen" onClick={() => { haptic(10); onSeen('on'); }}>
          <Icon name="eye" size={18} />
          <span>{t('Played on me')}</span>
          {!!seen.on && <b>×{seen.on}</b>}
        </button>
        <button class="lw-seen" onClick={() => { haptic(10); onSeen('by'); }}>
          <Icon name="crown" size={18} />
          <span>{t('I played it')}</span>
          {!!seen.by && <b>×{seen.by}</b>}
        </button>
      </div>

      <h3 class="lw-d-h">{t('Related laws')}</h3>
      <div class="lw-kin">
        {x.kin.map((k) => BY_N.get(k)).filter((k): k is Law => !!k).map((k) => (
          <button class="lw-kin-chip" onClick={() => go(k.n)}>
            <Seal x={k} size={38} />
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

export function Laws({ query: params }: { query: URLSearchParams }) {
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
  const leversN = new Set(LAWS.flatMap((x) => x.levers.map((l) => l.name.toLowerCase()))).size;

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
    <div class="page laws-page">
      <div class="page-bar lw-bar">
        <button class="glass glass-btn round" onClick={() => goBack()} aria-label={t('Back')}><Icon name="arrow-left" /></button>
        <div class="page-actions"><CountdownButton /><NavWheel world="anger" /></div>
      </div>

      <header class="lw-hero">
        <div class="lw-hero-art"><Hero /></div>
        <p class="lw-kicker">{t('Robert Greene · 1998 · three thousand years of history')}</p>
        <h1 class="lw-title"><span class="lw-title-n">48</span> <span>{t('Laws of Power')}</span></h1>
        <p class="lw-lede">{t('The game is being played whether you play it or not. Every law, with the history it came from, the psychology that makes it work, the mind traps it springs, and how to see it coming.')}</p>
        <dl class="lw-facts">
          <div><dt>48</dt><dd>{t('laws')}</dd></div>
          <div><dt>{REALM_IDS.length}</dt><dd>{t('arenas')}</dd></div>
          <div><dt>{leversN}</dt><dd>{t('psychological levers')}</dd></div>
          <div><dt>{SPRUNG.length}</dt><dd>{t('mind traps they spring')}</dd></div>
        </dl>
      </header>

      <div class="lw-run" aria-hidden="true">
        <div class="lw-run-in">
          {[0, 1].map(() => LAWS.map((x) => <span style={{ '--c': `var(--emo-${hueOf(x)})` }}>{x.line}</span>))}
        </div>
      </div>

      <section class="lw-section lw-read">
        <p class="lw-eyebrow">{t('How to read it')}</p>
        <h2 class="lw-h2">{t('Two ways through the same book')}</h2>
        <p class="lw-p">{t('Greene wrote it without morals on purpose: these are the moves, as courtiers, generals and con artists have made them for centuries. Most people who read it are not would-be kings. They are people who kept losing a game they didn’t know was being played. So every law here comes with its shadow side, an honest version, and the signs that someone is playing it on you.')}</p>
        <div class="lw-lens" role="radiogroup" aria-label={t('Read as')}>
          <button role="radio" aria-checked={lens === 'player'} class={lens === 'player' ? 'on' : ''} onClick={() => setLens('player')}>
            <Icon name="crown" size={22} />
            <b>{t('The player')}</b>
            <span>{t('The law first: its history and how it works, then the defence.')}</span>
          </button>
          <button role="radio" aria-checked={lens === 'target'} class={lens === 'target' ? 'on' : ''} onClick={() => setLens('target')}>
            <Icon name="eye" size={22} />
            <b>{t('The target')}</b>
            <span>{t('The signs it’s being played on you and how to answer, first.')}</span>
          </button>
        </div>
      </section>

      <section class="lw-section">
        <p class="lw-eyebrow">{t('Law of the day')}</p>
        <button class="lw-today" style={{ '--c': `var(--emo-${hueOf(today)})` }} onClick={() => openLaw(today)}>
          <Seal x={today} size={92} class="lw-today-seal" />
          <span class="lw-today-body">
            <span class="lw-today-k">{t('Law {n}', { n: today.n })} · {t(REALMS[today.realm].name)}</span>
            <span class="lw-today-title">{today.title}</span>
            <span class="lw-today-line">{today.line}</span>
            <span class="lw-today-q">{today.question}</span>
          </span>
        </button>
      </section>

      <section class="lw-section">
        <p class="lw-eyebrow">{t('The board')}</p>
        <h2 class="lw-h2">{t('Forty-eight squares')}</h2>
        <Board realm={realm === 'all' ? null : (realm as Realm)} open={openLaw} />
      </section>

      <section class="lw-section lw-realms">
        {REALM_IDS.map((r) => {
          const list = LAWS.filter((x) => x.realm === r);
          return (
            <button class="lw-realm" style={{ '--c': `var(--emo-${REALMS[r].hue})` }} aria-pressed={realm === r} onClick={() => setRealm(realm === r ? 'all' : r)}>
              <b>{t(REALMS[r].name)}</b>
              <span class="lw-realm-motto">{t(REALMS[r].motto)}</span>
              <span class="lw-realm-about">{t(REALMS[r].about)}</span>
              <span class="lw-realm-n">{list.map((x) => roman(x.n)).join(' · ')}</span>
            </button>
          );
        })}
      </section>

      <section class="lw-section">
        <p class="lw-eyebrow">{t('The shadow map')}</p>
        <h2 class="lw-h2">{t('How dark, how common')}</h2>
        <ShadowMap open={openLaw} />
      </section>

      <section class="lw-section">
        <p class="lw-eyebrow">{t('The machinery underneath')}</p>
        <h2 class="lw-h2">{t('The mind traps they spring')}</h2>
        <p class="lw-p">{t('Almost every law works by leaning on a bias you already have. These are the ones the laws lean on most. Tap one to read it on the Mind traps page.')}</p>
        <ol class="lw-sprung">
          {SPRUNG.slice(0, 10).map(({ trap, laws }, i) => (
            <li style={{ '--c': `var(--emo-${FAMILIES[trap.family].hue})`, '--i': i }}>
              <button class="lw-sprung-row" onClick={() => openTrap(trap.id)}>
                <span class="lw-sprung-name">{trap.name}</span>
                <span class="lw-sprung-bar"><i style={{ width: `${(laws.length / SPRUNG[0].laws.length) * 100}%` }} /></span>
                <span class="lw-sprung-laws">{laws.map((x) => roman(x.n)).join(' · ')}</span>
              </button>
            </li>
          ))}
        </ol>
      </section>

      <section class="lw-section">
        <p class="lw-eyebrow">{t('Name the move')}</p>
        <h2 class="lw-h2">{t('Can you see it being played?')}</h2>
        <NameTheMove open={openLaw} />
      </section>

      <section class="lw-section" id="lw-all">
        <div class="lw-list-head">
          <div>
            <p class="lw-eyebrow">{realm === 'all' ? t('All forty-eight') : t(REALMS[realm as Realm]?.motto ?? '')}</p>
            <h2 class="lw-h2">{realm === 'all' ? t('The laws') : t(REALMS[realm as Realm]?.name ?? '')}</h2>
          </div>
          {(seenOn > 0 || seenBy > 0) && <p class="lw-seen-sum">{t('Seen played on you {on}× · played yourself {by}×', { on: seenOn, by: seenBy })}</p>}
        </div>
        <div class="lw-controls">
          <label class="lw-search">
            <Icon name="search" size={17} />
            <input type="search" value={query} onInput={(e) => setQuery((e.target as HTMLInputElement).value)} placeholder={t('Search laws, signs or levers')} aria-label={t('Search laws, signs or levers')} />
          </label>
          <div class="seg compact lw-sort" role="radiogroup" aria-label={t('Sort')}>
            {([['n', t('In order')], ['dark', t('Darkest')], ['everyday', t('Commonest')]] as [Sort, string][]).map(([v, l]) => (
              <button role="radio" aria-checked={sort === v} aria-selected={sort === v} onClick={() => setSort(v)}>{l}</button>
            ))}
          </div>
        </div>
        <div class="filters lw-chips">
          <button class="chip" aria-pressed={realm === 'all'} onClick={() => setRealm('all')}>{t('All')}</button>
          {REALM_IDS.map((r) => (
            <button class="chip lw-chip" style={{ '--c': `var(--emo-${REALMS[r].hue})` }} aria-pressed={realm === r} onClick={() => setRealm(r)}>{t(REALMS[r].name)}</button>
          ))}
        </div>

        <ol class="lw-list">
          {shown.map((x, i) => (
            <li key={x.n} style={{ '--c': `var(--emo-${hueOf(x)})`, '--i': Math.min(i, 12) }}>
              <button class="lw-card" onClick={() => openLaw(x)}>
                <Seal x={x} size={58} class="lw-card-seal" />
                <span class="lw-card-main">
                  <span class="lw-card-top">
                    <span class="lw-card-realm">{t(REALMS[x.realm].name)}</span>
                    {!!seen[x.n]?.on && <span class="lw-card-seen"><Icon name="eye" size={12} /> {seen[x.n].on}</span>}
                    {!!seen[x.n]?.by && <span class="lw-card-seen"><Icon name="crown" size={12} /> {seen[x.n].by}</span>}
                  </span>
                  <span class="lw-card-title">{x.title}</span>
                  <span class="lw-card-line">{x.line}</span>
                  <span class="lw-card-dark" aria-label={t('Darkness {d} of 10', { d: x.dark })}>
                    {Array.from({ length: 10 }, (_, k) => <i class={k < x.dark ? 'on' : ''} />)}
                  </span>
                </span>
                <span class="lw-card-n" aria-hidden="true">{x.n}</span>
              </button>
            </li>
          ))}
        </ol>
        {!shown.length && <p class="empty-note">{t('No law matches that. Saying less than necessary, perhaps.')}</p>}
      </section>

      <section class="lw-section lw-outro">
        <svg class="lw-outro-king" viewBox="0 0 100 165" aria-hidden="true"><path d={KING} /></svg>
        <p class="lw-outro-text">{t('Power is mostly attention: who notices what, and when. The laws describe how people have taken it from each other for as long as there have been courts. You don’t have to play every one. But a move you can name is a move that has far less hold on you.')}</p>
        <button class="btn btn-quiet" onClick={() => openLaw(LAWS[Math.floor(Math.random() * LAWS.length)])}>{t('Draw a law at random')}</button>
      </section>

      <Sheet open={!!open} onClose={() => setOpen(null)} title={current ? t('Law {n} of 48', { n: current.n }) : ''} label={current?.title} tall>
        <div ref={body}>
          {current && <LawDetail key={current.n} x={current} lens={lens} seen={seen[current.n] ?? {}} onSeen={(k) => addSeen(current.n, k)} go={go} openTrap={openTrap} />}
        </div>
      </Sheet>
    </div>
  );
}
