import { useEffect, useId, useMemo, useRef, useState } from 'preact/hooks';
import { goBack } from '../lib/router';
import { usePref } from '../lib/prefs';
import { haptic } from '../lib/haptics';
import { t } from '../lib/i18n';
import { EVIDENCE, FAMILIES, POWER, REFLECT, TRAPS, power, type Family, type Trap } from '../data/traps';
import { Icon } from '../components/icons';
import { NavWheel } from '../components/NavWheel';
import { CountdownButton } from '../components/CountdownButton';
import { Sheet } from '../components/Sheet';
import '../styles/traps.css';

/*
 * Mind traps: forty cognitive biases on a page that looks like a psychologist's desk at night.
 * Every trap gets its own Rorschach blot, grown from its name, so the same trap always wears the same stain.
 * The data and the scoring are in data/traps.ts.
 */

const RANKED = [...TRAPS].sort((a, b) => power(b) - power(a) || b.pull - a.pull);
const RANK = new Map(RANKED.map((x, i) => [x.id, i + 1]));
const BY_ID = new Map(TRAPS.map((x) => [x.id, x]));
const FAMILY_IDS = Object.keys(FAMILIES) as Family[];
const hueOf = (x: Trap) => FAMILIES[x.family].hue;
const two = (n: number) => String(n).padStart(2, '0');
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ---------- the blots ---------- */

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

/** Half a blot, drawn left of the fold: a spine down the middle, a body, arms and a spray of drops. */
function blotShapes(seed: string) {
  const r = seeded(seed);
  const between = (a: number, b: number) => a + (b - a) * r();
  const out: { cx: number; cy: number; rx: number; ry: number; rot: number }[] = [];
  const spine = 3 + Math.floor(r() * 3);
  for (let i = 0; i < spine; i++) out.push({ cx: 50, cy: between(22, 78), rx: between(3, 8), ry: between(7, 15), rot: 0 });
  const body = 5 + Math.floor(r() * 4);
  for (let i = 0; i < body; i++) {
    const cy = between(20, 80);
    out.push({ cx: between(30, 49), cy, rx: between(4, 12), ry: between(4, 12), rot: between(-40, 40) });
  }
  const arms = 2 + Math.floor(r() * 2);
  for (let i = 0; i < arms; i++) out.push({ cx: between(20, 38), cy: between(14, 86), rx: between(9, 16), ry: between(1.6, 3.6), rot: between(-60, 60) });
  const drops = 5 + Math.floor(r() * 6);
  for (let i = 0; i < drops; i++) {
    const s = between(0.6, 2.6);
    out.push({ cx: between(9, 40), cy: between(8, 92), rx: s, ry: s, rot: 0 });
  }
  return { shapes: out, noise: Math.floor(r() * 1000), wobble: between(9, 15) };
}

/** A Rorschach blot: half drawn, run through noise so its edges bleed, then folded over. */
function Inkblot({ seed, class: cls }: { seed: string; class?: string }) {
  const id = 'ink' + useId().replace(/\W/g, '');
  const { shapes, noise, wobble } = useMemo(() => blotShapes(seed), [seed]);
  return (
    <svg class={`ink${cls ? ' ' + cls : ''}`} viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <filter id={id + 'f'} x="-15%" y="-15%" width="130%" height="130%" color-interpolation-filters="sRGB">
          <feTurbulence type="fractalNoise" baseFrequency="0.045" numOctaves={2} seed={noise} result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale={wobble} xChannelSelector="R" yChannelSelector="G" result="d" />
          <feGaussianBlur in="d" stdDeviation="1.1" result="b" />
          <feColorMatrix in="b" type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 16 -7" />
        </filter>
      </defs>
      <g id={id + 'h'} filter={`url(#${id}f)`} fill="currentColor">
        {shapes.map((s) => <ellipse cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry} transform={s.rot ? `rotate(${s.rot.toFixed(1)} ${s.cx.toFixed(1)} ${s.cy.toFixed(1)})` : undefined} />)}
      </g>
      <use href={`#${id}h`} transform="translate(100 0) scale(-1 1)" />
    </svg>
  );
}

/** An eye in the hero's blot that watches the pointer, and blinks now and then. */
function Eye() {
  const pupil = useRef<SVGGElement>(null);
  useEffect(() => {
    if (reduced()) return;
    let raf = 0, x = 0, y = 0;
    const move = (e: PointerEvent) => {
      x = e.clientX;
      y = e.clientY;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const el = pupil.current;
        const box = el?.ownerSVGElement?.getBoundingClientRect();
        if (!el || !box) return;
        const dx = x - (box.left + box.width / 2), dy = y - (box.top + box.height / 2);
        const d = Math.hypot(dx, dy) || 1, k = Math.min(1, d / 260);
        el.style.transform = `translate(${((dx / d) * 9 * k).toFixed(2)}px, ${((dy / d) * 4.5 * k).toFixed(2)}px)`;
      });
    };
    addEventListener('pointermove', move, { passive: true });
    return () => { removeEventListener('pointermove', move); cancelAnimationFrame(raf); };
  }, []);
  return (
    <svg class="tr-eye" viewBox="-30 -16 60 32" aria-hidden="true">
      <g class="tr-eye-lid">
        <path d="M-28 0Q0 -22 28 0Q0 22 -28 0z" class="tr-eye-white" />
        <g ref={pupil} class="tr-eye-look">
          <circle r="10" class="tr-eye-iris" />
          <circle r="4.6" class="tr-eye-pupil" />
          <circle r="1.6" cx="-3" cy="-3.4" class="tr-eye-glint" />
        </g>
      </g>
    </svg>
  );
}

/** The title decodes itself out of noise. */
function Scramble({ text }: { text: string }) {
  const [shown, setShown] = useState(text);
  useEffect(() => {
    if (reduced()) return;
    const glyphs = '#%&?!*+=<>/\\|~^ΨΔΣΩ∞≠';
    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const p = (now - start) / 900;
      setShown([...text].map((c, i) => (c === ' ' || p * text.length > i + 2 ? c : glyphs[Math.floor(Math.random() * glyphs.length)])).join(''));
      if (p < 1.3) raf = requestAnimationFrame(step);
      else setShown(text);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [text]);
  return <>{shown}</>;
}

/* ---------- small pieces ---------- */

function Gauge({ value, size = 76 }: { value: number; size?: number }) {
  const r = 30, c = 2 * Math.PI * r;
  return (
    <svg class="tr-gauge" width={size} height={size} viewBox="0 0 76 76" aria-hidden="true">
      <circle cx="38" cy="38" r={r} class="tr-gauge-track" />
      <circle cx="38" cy="38" r={r} class="tr-gauge-fill" style={{ strokeDasharray: `${(c * value) / 100} ${c}` }} />
      <text x="38" y="44" class="tr-gauge-num">{value}</text>
    </svg>
  );
}

function Quiz({ q, options, answer, reveal, gut, onAnswer }: { q: string; options: string[]; answer?: number; reveal: string; gut?: number; onAnswer?: (right: boolean) => void }) {
  const [picked, setPicked] = useState<number | null>(null);
  const pick = (i: number) => {
    if (picked != null) return;
    haptic(answer == null || i === answer ? 6 : 14);
    setPicked(i);
    onAnswer?.(answer == null || i === answer);
  };
  return (
    <div class={`tr-quiz${picked != null ? ' done' : ''}`}>
      <p class="tr-quiz-q">{q}</p>
      <div class="tr-quiz-options">
        {options.map((o, i) => (
          <button
            class={`tr-opt${picked === i ? ' picked' : ''}${picked != null && answer === i ? ' right' : ''}${picked === i && answer != null && i !== answer ? ' wrong' : ''}`}
            onClick={() => pick(i)}
            disabled={picked != null && picked !== i && answer !== i}
            aria-pressed={picked === i}
          >
            <span class="tr-opt-key">{String.fromCharCode(65 + i)}</span>
            <span>{o}</span>
          </button>
        ))}
      </div>
      {picked != null && (
        <div class="tr-reveal" role="status">
          {answer != null && <b class={picked === answer ? 'yes' : 'no'}>{picked === answer ? t('Right.') : picked === gut ? t('That’s the gut answer.') : t('Not quite.')}</b>}
          {' '}{reveal}
        </div>
      )}
    </div>
  );
}

/** How often you’ve caught yourself in each trap, on this device. */
const CAUGHT = 'mm-traps-caught';
function useCaught() {
  const [caught, set] = useState<Record<string, number>>(() => {
    try { return JSON.parse(localStorage.getItem(CAUGHT) || '{}') ?? {}; } catch { return {}; }
  });
  const add = (id: string) => {
    const next = { ...caught, [id]: (caught[id] ?? 0) + 1 };
    set(next);
    try { localStorage.setItem(CAUGHT, JSON.stringify(next)); } catch {}
  };
  return [caught, add] as const;
}

/* ---------- the power map ---------- */

/** Every trap as a star: its family's slice of the sky, and the stronger it pulls, the nearer the centre. */
function PowerMap({ open }: { open: (x: Trap) => void }) {
  const [hot, setHot] = useState<string | null>(null);
  const C = 200;
  const rOf = (p: number) => 26 + (100 - p) * 3.7;
  const at = (r: number, a: number) => [C + r * Math.sin((a * Math.PI) / 180), C - r * Math.cos((a * Math.PI) / 180)];
  const stars = useMemo(() => {
    const out: { x: Trap; px: number; py: number; a: number }[] = [];
    const span = 360 / FAMILY_IDS.length;
    FAMILY_IDS.forEach((f, fi) => {
      const list = RANKED.filter((x) => x.family === f);
      list.forEach((x, i) => {
        const a = fi * span + span * ((i + 0.5) / list.length);
        const [px, py] = at(rOf(power(x)), a);
        out.push({ x, px, py, a });
      });
    });
    return out;
  }, []);
  const where = new Map(stars.map((s) => [s.x.id, s]));
  const focus = hot ? BY_ID.get(hot)! : null;
  // the spiral the stars sit on: one slow turn per ring
  const spiral = useMemo(() => {
    let d = '';
    for (let a = 0; a <= 360 * 4.2; a += 6) {
      const [x, y] = at(8 + a / 8.4, a);
      d += (a ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
    }
    return d;
  }, []);
  return (
    <div class="tr-map">
      <svg viewBox="-34 -34 468 468" role="group" aria-label={t('Every trap by family and power')}>
        <g class="tr-map-spin"><path d={spiral} class="tr-map-spiral" /></g>
        {[90, 80, 70, 60].map((p) => (
          <g class="tr-map-ring">
            <circle cx={C} cy={C} r={rOf(p)} />
            <text x={C + 3} y={C - rOf(p) - 3}>{p}</text>
          </g>
        ))}
        {FAMILY_IDS.map((f, fi) => {
          const span = 360 / FAMILY_IDS.length;
          const [x1, y1] = at(214, fi * span);
          const [lx, ly] = at(222, (fi + 0.5) * span);
          return (
            <g style={{ '--c': `var(--emo-${FAMILIES[f].hue})` }}>
              <line x1={C} y1={C} x2={x1} y2={y1} class="tr-map-spoke" />
              <text x={lx} y={ly} class="tr-map-family" text-anchor="middle" dominant-baseline="middle">{t(FAMILIES[f].name)}</text>
            </g>
          );
        })}
        {focus && (
          <g class="tr-map-kin" style={{ '--c': `var(--emo-${hueOf(focus)})` }}>
            {focus.kin.map((k) => {
              const a = where.get(focus.id)!, b = where.get(k);
              return b && <path d={`M${a.px} ${a.py}Q${C} ${C} ${b.px} ${b.py}`} />;
            })}
          </g>
        )}
        {stars.map(({ x, px, py }, i) => (
          <g
            class={`tr-star${hot === x.id ? ' hot' : ''}${focus && focus.kin.includes(x.id) ? ' kin' : ''}`}
            style={{ '--c': `var(--emo-${hueOf(x)})`, '--i': i }}
            role="button"
            tabIndex={0}
            aria-label={`${x.name}, ${t('power')} ${power(x)}`}
            onClick={() => open(x)}
            onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), open(x))}
            onPointerEnter={() => setHot(x.id)}
            onPointerLeave={() => setHot((h) => (h === x.id ? null : h))}
            onFocus={() => setHot(x.id)}
            onBlur={() => setHot((h) => (h === x.id ? null : h))}
          >
            <circle cx={px} cy={py} r={14} class="tr-star-hit" />
            <circle cx={px} cy={py} r={2.6 + x.reach * 0.45} class="tr-star-dot" />
          </g>
        ))}
        <g class="tr-map-hub">
          <circle cx={C} cy={C} r={22} />
          <text x={C} y={C + 5} text-anchor="middle">{focus ? power(focus) : '∞'}</text>
        </g>
      </svg>
      <div class="tr-map-caption" aria-live="polite">
        {focus ? (
          <>
            <b>{focus.name}</b>
            <span>{t('#{rank} · {family} · tap to open', { rank: RANK.get(focus.id)!, family: t(FAMILIES[focus.family].name) })}</span>
          </>
        ) : (
          <span>{t('The nearer the centre, the harder it pulls. Bigger stars reach further into everyday life.')}</span>
        )}
      </div>
    </div>
  );
}

/* ---------- one trap, opened ---------- */

function TrapDetail({ x, caught, onCaught, go }: { x: Trap; caught: number; onCaught: () => void; go: (id: string) => void }) {
  const p = power(x);
  const [ev, evAbout] = EVIDENCE[x.evidence];
  const bars: [string, number, string][] = [
    [t('Pull'), x.pull, t('How hard it is to resist, even knowing it’s there')],
    [t('Reach'), x.reach, t('How much of everyday life it touches')],
    [t('Harm'), x.harm, t('What it costs when it wins')],
  ];
  return (
    <article class="tr-detail" style={{ '--c': `var(--emo-${hueOf(x)})` }}>
      <header class="tr-d-head">
        <Inkblot seed={x.id} class="tr-d-ink" />
        <p class="tr-d-kicker">{t(FAMILIES[x.family].name)} · {t(FAMILIES[x.family].motto)}</p>
        <h2 class="tr-d-name">{x.name}</h2>
        {x.aka && <p class="tr-d-aka">{t('also called')} {x.aka}</p>}
        <p class="tr-d-line">{x.line}</p>
      </header>

      <section class="tr-d-power">
        <Gauge value={p} />
        <div class="tr-d-bars">
          {bars.map(([name, v, about]) => (
            <div class="tr-d-bar" title={about}>
              <span>{name}</span>
              <i><b style={{ width: `${v * 10}%` }} /></i>
              <em>{v}</em>
            </div>
          ))}
        </div>
      </section>
      <p class={`tr-ev tr-ev-${x.evidence}`}><Icon name={x.evidence === 'debated' ? 'alert-circle' : 'check'} size={15} /> <b>{t('Evidence: {level}', { level: t(ev) })}</b> {t(evAbout)}</p>

      <blockquote class="tr-d-tell">
        <small>{t('The thought that gives it away')}</small>
        {x.tell}
      </blockquote>

      <h3 class="tr-d-h">{t('What it is')}</h3>
      <p class="tr-d-p">{x.what}</p>
      <h3 class="tr-d-h">{t('Why your brain does it')}</h3>
      <p class="tr-d-p">{x.why}</p>

      <div class="tr-d-study">
        <p class="tr-d-study-k"><Icon name="info-circle" size={15} /> {t('The experiment')}</p>
        <h4>{x.study.title}</h4>
        <p class="tr-d-who">{x.study.who}</p>
        <p>{x.study.text}</p>
      </div>

      {x.test && (
        <>
          <h3 class="tr-d-h">{t('Try it on yourself')}</h3>
          <Quiz key={x.id} {...x.test} />
        </>
      )}

      <h3 class="tr-d-h">{t('Where it gets you')}</h3>
      <ul class="tr-d-list">{x.life.map((l) => <li>{l}</li>)}</ul>
      <h3 class="tr-d-h">{t('How to get out')}</h3>
      <ol class="tr-d-list escape">{x.escape.map((l) => <li>{l}</li>)}</ol>

      <div class="tr-d-fact">
        <p class="tr-d-study-k"><Icon name="sparkles" size={15} /> {t('Strange but true')}</p>
        <p>{x.fact}</p>
      </div>

      <button class="tr-caught" onClick={() => { haptic(10); onCaught(); }}>
        <Icon name="eye" size={18} />
        <span>{t('I caught myself in this one')}</span>
        {caught > 0 && <b>×{caught}</b>}
      </button>

      <h3 class="tr-d-h">{t('Related traps')}</h3>
      <div class="tr-kin">
        {x.kin.map((k) => BY_ID.get(k)).filter((k): k is Trap => !!k).map((k) => (
          <button class="tr-kin-chip" style={{ '--c': `var(--emo-${hueOf(k)})` }} onClick={() => go(k.id)}>
            <Inkblot seed={k.id} class="tr-kin-ink" />
            <span>{k.name}</span>
            <em>{power(k)}</em>
          </button>
        ))}
      </div>
    </article>
  );
}

/* ---------- the page ---------- */

type Sort = 'power' | 'name' | 'pull';
const SORTS: Sort[] = ['power', 'pull', 'name'];

export function Traps() {
  const [open, setOpen] = useState<string | null>(null);
  const [family, setFamily] = usePref<string>('traps-family', 'all', ['all', ...FAMILY_IDS]);
  const [sort, setSort] = usePref<Sort>('traps-sort', 'power', SORTS);
  const [query, setQuery] = useState('');
  const [caught, addCaught] = useCaught();
  const [score, setScore] = useState<boolean[]>([]);
  const body = useRef<HTMLDivElement>(null);

  const today = RANKED[Math.floor((Date.now() - new Date().getTimezoneOffset() * 60_000) / 86_400_000) % RANKED.length];
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = RANKED.filter((x) => (family === 'all' || x.family === family) && (!q || `${x.name} ${x.aka ?? ''} ${x.line} ${x.tell}`.toLowerCase().includes(q)));
    if (sort === 'name') list.sort((a, b) => a.name.localeCompare(b.name));
    if (sort === 'pull') list.sort((a, b) => b.pull - a.pull || power(b) - power(a));
    return list;
  }, [family, sort, query]);
  const caughtTotal = Object.values(caught).reduce((s, n) => s + n, 0);
  const mostCaught = Object.entries(caught).sort((a, b) => b[1] - a[1])[0];

  const openTrap = (x: Trap) => { haptic(5); setOpen(x.id); };
  const go = (id: string) => {
    setOpen(id);
    body.current?.closest('.sheet-body')?.scrollTo({ top: 0, behavior: reduced() ? 'auto' : 'smooth' });
  };
  // the sheet keeps showing the last trap while it slides away
  const last = useRef<Trap | null>(null);
  if (open) last.current = BY_ID.get(open) ?? null;
  const current = last.current;

  return (
    <div class="page traps-page">
      <div class="page-bar tr-bar">
        <button class="glass glass-btn round" onClick={() => goBack()} aria-label={t('Back')}><Icon name="arrow-left" /></button>
        <div class="page-actions"><CountdownButton /><NavWheel world="fear" /></div>
      </div>

      <header class="tr-hero">
        <div class="tr-hero-art" aria-hidden="true">
          <svg class="tr-hypno" viewBox="-100 -100 200 200">
            {Array.from({ length: 9 }, (_, i) => <circle r={12 + i * 11} style={{ '--i': i }} />)}
          </svg>
          <Inkblot seed="mind traps" class="tr-hero-ink" />
          <Eye />
        </div>
        <p class="tr-kicker">{t('A field guide to the mind’s blind spots')}</p>
        <h1 class="tr-title" data-text={t('Mind traps')}><Scramble text={t('Mind traps')} /></h1>
        <p class="tr-lede">{t('Forty ways your brain fools you, ranked by how hard they pull. The experiments that caught them, the thoughts that give them away, and how to get out.')}</p>
        <dl class="tr-facts">
          <div><dt>{TRAPS.length}</dt><dd>{t('traps')}</dd></div>
          <div><dt>{FAMILY_IDS.length}</dt><dd>{t('families')}</dd></div>
          <div><dt>180+</dt><dd>{t('biases named so far')}</dd></div>
          <div><dt>1/661</dt><dd>{t('people who think they’re more biased than average')}</dd></div>
        </dl>
      </header>

      <div class="tr-tells" aria-hidden="true">
        <div class="tr-tells-run">
          {[0, 1].map(() => RANKED.map((x) => <span style={{ '--c': `var(--emo-${hueOf(x)})` }}>{x.tell}</span>))}
        </div>
      </div>

      <section class="tr-section tr-two">
        <p class="tr-eyebrow">{t('Before you start')}</p>
        <h2 class="tr-h2">{t('You have two minds')}</h2>
        <p class="tr-p">{t('Psychologists describe two ways of thinking. System 1 is fast, automatic and effortless: it reads faces, finishes sentences and jumps to answers. System 2 is slow and deliberate: it checks, counts and doubts. System 1 runs almost everything, and nearly every trap below is System 1 answering a question that needed System 2. Try it: answer these with your first instinct.')}</p>
        <div class="tr-crt">
          {REFLECT.map((r, i) => (
            <Quiz q={`${i + 1}. ${r.q}`} options={r.options} answer={r.answer} gut={r.gut} reveal={r.why} onAnswer={(right) => setScore((s) => { const n = [...s]; n[i] = right; return n; })} />
          ))}
        </div>
        {score.filter((x) => x != null).length === REFLECT.length && (
          <p class="tr-crt-score" role="status">
            {t('You got {n} of 3.', { n: score.filter(Boolean).length })}{' '}
            {t('In Shane Frederick’s 2005 study of 3,428 people, only 17% got all three; even at MIT, fewer than half did. The wrong answers aren’t random: almost everyone who misses picks the same one, the one that jumps out first.')}
          </p>
        )}
      </section>

      <section class="tr-section">
        <p class="tr-eyebrow">{t('Trap of the day')}</p>
        <button class="tr-today" style={{ '--c': `var(--emo-${hueOf(today)})` }} onClick={() => openTrap(today)}>
          <Inkblot seed={today.id} class="tr-today-ink" />
          <span class="tr-today-body">
            <span class="tr-today-rank">#{RANK.get(today.id)} · {t(FAMILIES[today.family].name)}</span>
            <span class="tr-today-name">{today.name}</span>
            <span class="tr-today-line">{today.line}</span>
            <span class="tr-today-tell">{today.tell}</span>
          </span>
          <Gauge value={power(today)} size={64} />
        </button>
      </section>

      <section class="tr-section">
        <p class="tr-eyebrow">{t('The power map')}</p>
        <h2 class="tr-h2">{t('Where they pull from')}</h2>
        <PowerMap open={openTrap} />
      </section>

      <section class="tr-section tr-families">
        {FAMILY_IDS.map((f) => {
          const list = RANKED.filter((x) => x.family === f);
          return (
            <button class="tr-family" style={{ '--c': `var(--emo-${FAMILIES[f].hue})` }} aria-pressed={family === f} onClick={() => setFamily(family === f ? 'all' : f)}>
              <b>{t(FAMILIES[f].name)}</b>
              <span class="tr-family-motto">{t(FAMILIES[f].motto)}</span>
              <span class="tr-family-about">{t(FAMILIES[f].about)}</span>
              <span class="tr-family-n">{list.length} · {t('strongest: {name}', { name: list[0].name })}</span>
            </button>
          );
        })}
      </section>

      <section class="tr-section" id="tr-all">
        <div class="tr-list-head">
          <div>
            <p class="tr-eyebrow">{family === 'all' ? t('All forty, strongest first') : t(FAMILIES[family as Family]?.motto ?? '')}</p>
            <h2 class="tr-h2">{family === 'all' ? t('The ranking') : t(FAMILIES[family as Family]?.name ?? '')}</h2>
          </div>
          {caughtTotal > 0 && mostCaught && (
            <p class="tr-caught-sum">{t('Caught {n} times · most: {name}', { n: caughtTotal, name: BY_ID.get(mostCaught[0])?.name ?? '' })}</p>
          )}
        </div>
        <div class="tr-controls">
          <label class="tr-search">
            <Icon name="search" size={17} />
            <input type="search" value={query} onInput={(e) => setQuery((e.target as HTMLInputElement).value)} placeholder={t('Search traps or thoughts')} aria-label={t('Search traps or thoughts')} />
          </label>
          <div class="seg compact tr-sort" role="radiogroup" aria-label={t('Sort')}>
            {([['power', t('Power')], ['pull', t('Pull')], ['name', t('A–Z')]] as [Sort, string][]).map(([v, l]) => (
              <button role="radio" aria-checked={sort === v} aria-selected={sort === v} onClick={() => setSort(v)}>{l}</button>
            ))}
          </div>
        </div>
        <div class="filters tr-chips">
          <button class="chip" aria-pressed={family === 'all'} onClick={() => setFamily('all')}>{t('All')}</button>
          {FAMILY_IDS.map((f) => (
            <button class="chip tr-chip" style={{ '--c': `var(--emo-${FAMILIES[f].hue})` }} aria-pressed={family === f} onClick={() => setFamily(f)}>{t(FAMILIES[f].name)}</button>
          ))}
        </div>

        <ol class="tr-list">
          {shown.map((x, i) => {
            const p = power(x);
            return (
              <li key={x.id} style={{ '--c': `var(--emo-${hueOf(x)})`, '--i': Math.min(i, 12) }}>
                <button class="tr-card" onClick={() => openTrap(x)}>
                  <span class="tr-rank" aria-hidden="true">{two(RANK.get(x.id)!)}</span>
                  <Inkblot seed={x.id} class="tr-card-ink" />
                  <span class="tr-card-main">
                    <span class="tr-card-top">
                      <span class="tr-fam">{t(FAMILIES[x.family].name)}</span>
                      {x.evidence === 'debated' && <span class="tr-debated">{t('debated')}</span>}
                      {caught[x.id] > 0 && <span class="tr-caught-n"><Icon name="eye" size={12} /> {caught[x.id]}</span>}
                    </span>
                    <span class="tr-name">{x.name}</span>
                    <span class="tr-line">{x.line}</span>
                    <span class="tr-meter" aria-hidden="true"><i style={{ width: `${p}%` }} /></span>
                  </span>
                  <span class="tr-power"><b>{p}</b><small>{t('power')}</small></span>
                </button>
              </li>
            );
          })}
        </ol>
        {!shown.length && <p class="empty-note">{t('No trap matches that. Which is, of course, exactly what a trap would want you to think.')}</p>}
      </section>

      <section class="tr-section tr-method">
        <p class="tr-eyebrow">{t('How power is scored')}</p>
        <h2 class="tr-h2">{t('Pull, reach and harm')}</h2>
        <p class="tr-p">{t('Each trap is rated from 1 to 10 on three things, and power is the weighted sum, out of 100. It’s a considered judgement drawn from the research, not a measurement: no study ranks biases against each other.')}</p>
        <div class="tr-method-grid">
          <div><b>{t('Pull')} ×{POWER.pull}</b><span>{t('How hard it is to resist, even knowing it’s there. It counts most: a trap you can walk out of once you see it is a weaker trap.')}</span></div>
          <div><b>{t('Reach')} ×{POWER.reach}</b><span>{t('How much of everyday life it touches, from what you buy to who you trust.')}</span></div>
          <div><b>{t('Harm')} ×{POWER.harm}</b><span>{t('What it costs when it wins: money, health, relationships, justice.')}</span></div>
        </div>
        <div class="tr-ev-key">
          {(Object.keys(EVIDENCE) as (keyof typeof EVIDENCE)[]).map((k) => (
            <p class={`tr-ev tr-ev-${k}`}><b>{t(EVIDENCE[k][0])}</b> {t(EVIDENCE[k][1])}</p>
          ))}
        </div>
      </section>

      <section class="tr-section tr-outro">
        <Inkblot seed="the last one" class="tr-outro-ink" />
        <p class="tr-outro-text">{t('Knowing about a trap doesn’t free you from it. The research is clear on that: the people who know most about biases fall for them about as often as everyone else, and are better at spotting them in others. What helps is slower thinking at the moments that matter, other people who will tell you when you’re wrong, and writing things down before you know how they turn out.')}</p>
        <button class="btn btn-quiet" onClick={() => openTrap(BY_ID.get('blind-spot')!)}>{t('Read the trap you’re in right now')}</button>
      </section>

      <Sheet open={!!open} onClose={() => setOpen(null)} title={current ? t('#{rank} of {n}', { rank: RANK.get(current.id)!, n: TRAPS.length }) : ''} label={current?.name} tall>
        <div ref={body}>
          {current && <TrapDetail key={current.id} x={current} caught={caught[current.id] ?? 0} onCaught={() => addCaught(current.id)} go={go} />}
        </div>
      </Sheet>
    </div>
  );
}
