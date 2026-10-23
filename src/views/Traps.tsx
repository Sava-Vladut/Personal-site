import { useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { goBack, navigateAfterSheet } from '../lib/router';
import { usePref } from '../lib/prefs';
import { haptic } from '../lib/haptics';
import { t } from '../lib/i18n';
import { EVIDENCE, FAMILIES, POWER, REFLECT, TRAPS, power, type Family, type Trap } from '../data/traps';
import { PARTS, PRINCIPLES, type Principle } from '../data/principles';
import { Icon } from '../components/icons';
import { Mark } from '../components/Mark';
import { Sheet } from '../components/Sheet';
import { PageHead } from '../components/PageHead';
import { RevealStack } from '../components/charts';
import { Sky } from '../components/Sky';
import { Tile } from './stats/parts';
import '../styles/stats.css';
import '../styles/traps.css';

/*
 * Mind traps: forty cognitive biases, under Insights, on the same sky, cards and tiles as Stats.
 * Every trap wears its own mark, a small ink-and-paper drawing (data/marks.ts) on a tile in its family's colour.
 * The data and the scoring are in data/traps.ts.
 */

const RANKED = [...TRAPS].sort((a, b) => power(b) - power(a) || b.pull - a.pull);
const RANK = new Map(RANKED.map((x, i) => [x.id, i + 1]));
const BY_ID = new Map(TRAPS.map((x) => [x.id, x]));
const FAMILY_IDS = Object.keys(FAMILIES) as Family[];
const hueOf = (x: Trap) => FAMILIES[x.family].hue;
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** For each trap, the Carnegie principles that disarm it (Win friends), and how. */
const DISARMS = (() => {
  const by = new Map<string, { p: Principle; how: string }[]>();
  for (const p of PRINCIPLES) for (const { id, how } of p.traps) by.set(id, [...(by.get(id) ?? []), { p, how }]);
  return by;
})();

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

function TrapDetail({ x, caught, onCaught, go, openPrinciple }: { x: Trap; caught: number; onCaught: () => void; go: (id: string) => void; openPrinciple: (n: number) => void }) {
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
        <Mark id={x.id} hue={hueOf(x)} class="tr-d-ink" />
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
      <p class={`tr-ev tr-ev-${x.evidence}`}><Icon name={x.evidence === 'debated' ? 'alert-circle' : 'check'} size={14} /> <b>{t('Evidence: {level}', { level: t(ev) })}</b> {t(evAbout)}</p>

      <blockquote class="tr-d-tell">
        <small>{t('The thought that gives it away')}</small>
        {x.tell}
      </blockquote>

      <h3 class="tr-d-h">{t('What it is')}</h3>
      <p class="tr-d-p">{x.what}</p>
      <h3 class="tr-d-h">{t('Why your brain does it')}</h3>
      <p class="tr-d-p">{x.why}</p>

      <div class="tr-d-study">
        <p class="tr-d-study-k"><Icon name="info-circle" size={14} /> {t('The experiment')}</p>
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
      {!!DISARMS.get(x.id)?.length && (
        <>
          <h3 class="tr-d-h">{t('Principles that disarm it')}</h3>
          <div class="tr-links">
            {DISARMS.get(x.id)!.map(({ p, how }) => (
              <button class="tr-link" style={{ '--t': `var(--emo-${PARTS[p.part].hue})` }} onClick={() => openPrinciple(p.n)}>
                <span class="tr-link-top"><Icon name="heart-handshake" size={16} /> <b>{p.title}</b> <Icon name="arrow-up-right" size={14} class="tr-link-go" /></span>
                <span class="tr-link-how">{how}</span>
              </button>
            ))}
          </div>
        </>
      )}

      <div class="tr-d-fact">
        <p class="tr-d-study-k"><Icon name="sparkles" size={14} /> {t('Strange but true')}</p>
        <p>{x.fact}</p>
      </div>

      <button class="btn btn-quiet tr-caught" onClick={() => { haptic(10); onCaught(); }}>
        <Icon name="eye" size={18} />
        <span>{t('I caught myself in this one')}</span>
        {caught > 0 && <b>×{caught}</b>}
      </button>

      <h3 class="tr-d-h">{t('Related traps')}</h3>
      <div class="tr-kin">
        {x.kin.map((k) => BY_ID.get(k)).filter((k): k is Trap => !!k).map((k) => (
          <button class="tr-kin-chip" style={{ '--c': `var(--emo-${hueOf(k)})` }} onClick={() => go(k.id)}>
            <Mark id={k.id} hue={hueOf(k)} class="tr-kin-ink" />
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
const WORLD = 'sadness';

/** The page wears the wheel's blue for the mind; tiles and card titles read the accent from the root. */
function useAccent() {
  useLayoutEffect(() => {
    const root = document.documentElement.style;
    root.setProperty('--accent', `var(--emo-${WORLD})`);
    return () => root.removeProperty('--accent');
  }, []);
}

export function Traps({ query: params }: { query: URLSearchParams }) {
  useAccent();
  // ?open=<id> opens a trap straight away (the Laws of power and Win friends pages link here)
  const [open, setOpen] = useState<string | null>(() => (BY_ID.has(params.get('open') ?? '') ? params.get('open') : null));
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
  const picked = family === 'all' ? null : FAMILIES[family as Family];

  const openTrap = (x: Trap) => { haptic(5); setOpen(x.id); };
  const go = (id: string) => {
    setOpen(id);
    body.current?.closest('.sheet-body')?.scrollTo({ top: 0, behavior: reduced() ? 'auto' : 'smooth' });
  };
  const openPrinciple = (n: number) => { setOpen(null); navigateAfterSheet(`friends?open=${n}`); };
  // the sheet keeps showing the last trap while it slides away
  const last = useRef<Trap | null>(null);
  if (open) last.current = BY_ID.get(open) ?? null;
  const current = last.current;

  return (
    <div class="page stats-page traps-page">
      <div class="journal-top stats-top" style={{ '--sky': `var(--emo-${WORLD})` }}>
        <Sky world={WORLD} />
        <PageHead title={t('Mind traps')} back={() => goBack()} subtitle={t('40 ways your brain fools you, ranked by how hard they pull')} />
      </div>

      <RevealStack>
        <button class="card hero tr-today" style={{ '--c': `var(--emo-${hueOf(today)})` }} onClick={() => openTrap(today)}>
          <span class="tile-label">{t('Trap of the day')}</span>
          <span class="tr-today-row">
            <Mark id={today.id} hue={hueOf(today)} class="tr-today-ink" />
            <span class="tr-today-body">
              <span class="tr-today-name">{today.name}</span>
              <span class="tr-today-line">{today.line}</span>
            </span>
            <Gauge value={power(today)} size={56} />
          </span>
          <span class="tr-today-tell">{today.tell}</span>
        </button>

        <div class="tiles">
          <Tile k={0} icon="spiral" label={t('Traps')} value={TRAPS.length} sub={t('in {n} families', { n: FAMILY_IDS.length })} />
          <Tile k={1} icon="brain" label={t('Biases named')} value="180+" sub={t('so far, by psychologists')} />
          <Tile k={2} icon="users" label={t('Think they’re more biased')} value="1/661" sub={t('than the average person')} />
          <Tile k={3} icon="eye" label={t('Caught yourself')} value={caughtTotal} sub={mostCaught ? t('most: {name}', { name: BY_ID.get(mostCaught[0])?.name ?? '' }) : t('in none yet')} />
        </div>

        <section class="card chart-card">
          <header class="chart-head">
            <div>
              <h3 class="chart-title">{t('You have two minds')}</h3>
              <p class="chart-sub">{t('System 1 is fast and automatic, System 2 slow and careful. Nearly every trap below is System 1 answering a question that needed System 2. Answer these with your first instinct.')}</p>
            </div>
          </header>
          <div class="tr-crt">
            {REFLECT.map((r, i) => (
              <Quiz q={`${i + 1}. ${r.q}`} options={r.options} answer={r.answer} gut={r.gut} reveal={r.why} onAnswer={(right) => setScore((s) => { const n = [...s]; n[i] = right; return n; })} />
            ))}
          </div>
          {score.filter((x) => x != null).length === REFLECT.length && (
            <p class="tr-crt-score" role="status">
              <b>{t('You got {n} of 3.', { n: score.filter(Boolean).length })}</b>{' '}
              {t('In Shane Frederick’s 2005 study of 3,428 people, only 17% got all three; even at MIT, fewer than half did. The wrong answers aren’t random: almost everyone who misses picks the same one, the one that jumps out first.')}
            </p>
          )}
        </section>

        <section class="card chart-card">
          <header class="chart-head">
            <div>
              <h3 class="chart-title">{t('Where they pull from')}</h3>
              <p class="chart-sub">{t('Every trap by family and power')}</p>
            </div>
          </header>
          <PowerMap open={openTrap} />
        </section>
      </RevealStack>

      <section class="section" id="tr-all">
        <h2 class="section-title">{family === 'all' ? t('All forty, strongest first') : t(picked?.name ?? '')}</h2>
        <label class="search">
          <Icon name="search" size={18} />
          <input type="search" value={query} onInput={(e) => setQuery(e.currentTarget.value)} placeholder={t('Search traps or thoughts')} aria-label={t('Search traps or thoughts')} />
        </label>
        <div class="tr-controls">
          <div class="chips scroll-x tr-chips" role="toolbar" aria-label={t('Family')}>
            <button class="chip" aria-pressed={!picked} onClick={() => setFamily('all')}>{t('All')}</button>
            {FAMILY_IDS.map((f) => (
              <button class="chip tr-chip" style={{ '--c': `var(--emo-${FAMILIES[f].hue})` }} aria-pressed={family === f} onClick={() => setFamily(family === f ? 'all' : f)}>{t(FAMILIES[f].name)}</button>
            ))}
          </div>
          <div class="seg compact tr-sort" role="radiogroup" aria-label={t('Sort')}>
            {([['power', t('Power')], ['pull', t('Pull')], ['name', t('A–Z')]] as [Sort, string][]).map(([v, l]) => (
              <button role="radio" aria-checked={sort === v} aria-selected={sort === v} onClick={() => setSort(v)}>{l}</button>
            ))}
          </div>
        </div>
        {picked && <p class="muted small tr-family-about"><b>{t(picked.motto)}.</b> {t(picked.about)}</p>}

        <ol class="tr-list">
          {shown.map((x, i) => (
            <li key={x.id} style={{ '--c': `var(--emo-${hueOf(x)})`, '--i': Math.min(i, 4) }}>
              <button class="card tr-card" onClick={() => openTrap(x)}>
                <Mark id={x.id} hue={hueOf(x)} class="tr-card-ink" />
                <span class="tr-card-main">
                  <span class="tr-card-top">
                    #{RANK.get(x.id)} · {t(FAMILIES[x.family].name)}
                    {x.evidence === 'debated' && <span class="tr-debated">{t('debated')}</span>}
                    {caught[x.id] > 0 && <span class="tr-caught-n"><Icon name="eye" size={12} /> {caught[x.id]}</span>}
                  </span>
                  <span class="tr-name">{x.name}</span>
                  <span class="tr-line">{x.line}</span>
                </span>
                <span class="tr-power"><b>{power(x)}</b><small>{t('power')}</small></span>
              </button>
            </li>
          ))}
        </ol>
        {!shown.length && <p class="empty-note">{t('No trap matches that. Which is, of course, exactly what a trap would want you to think.')}</p>}
      </section>

      <section class="section">
        <h2 class="section-title">{t('How power is scored')}</h2>
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

      <section class="section tr-about">
        <p>{t('Knowing about a trap doesn’t free you from it, and neither does being clever: in study after study, people with higher cognitive ability fell for many biases about as often as everyone else, and were no better at seeing their own. Reading about them changes little. Practice with feedback does better: in 2015 a single training game cut several biases, and the effect was still there two months later. What helps most is slower thinking at the moments that matter, other people who will tell you when you’re wrong, and writing things down before you know how they turn out.')}</p>
        <button class="btn btn-quiet" onClick={() => openTrap(BY_ID.get('blind-spot')!)}><Icon name="eye" size={18} /> {t('Read the trap you’re in right now')}</button>
      </section>

      <Sheet open={!!open} onClose={() => setOpen(null)} title={current ? t('#{rank} of {n}', { rank: RANK.get(current.id)!, n: TRAPS.length }) : ''} label={current?.name} tall>
        <div ref={body}>
          {current && <TrapDetail key={current.id} x={current} caught={caught[current.id] ?? 0} onCaught={() => addCaught(current.id)} go={go} openPrinciple={openPrinciple} />}
        </div>
      </Sheet>
    </div>
  );
}
