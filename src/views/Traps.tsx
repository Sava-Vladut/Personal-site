import { useMemo, useRef, useState } from 'preact/hooks';
import { goBack, navigateAfterSheet } from '../lib/router';
import { usePref } from '../lib/prefs';
import { haptic } from '../lib/haptics';
import { t } from '../lib/i18n';
import { toast } from '../lib/store';
import { EVIDENCE, FAMILIES, POWER, REFLECT, TRAPS, power, type Family, type Trap } from '../data/traps';
import { PARTS, PRINCIPLES, type Principle } from '../data/principles';
import { LAWS, REALMS, type Law } from '../data/laws';
import { Sheet } from '../components/Sheet';
import { PageHead } from '../components/PageHead';
import { LearnShare, SharedEntry, ShareButton, onSharedLink, type ShareTarget } from '../components/LearnShare';
import { Sky } from '../components/Sky';
import { SortChip } from '../components/collection';
import { Aside, Caption, DetailHead, GroupHead, Ico, LinkRow, Meter, Option, Row, Tally, Today, jumpTop, useLocal } from '../components/learn';
import '../styles/stats.css';
import '../styles/traps.css';

/*
 * Mind traps: forty cognitive biases, under Insights. The Learn layout (components/learn.tsx, styles/learn.css): a sky
 * with three figures and the search, then a feature column (the trap of the day, the power map, the two-minds quiz)
 * and every trap in groups of compact rows. Every trap wears its own mark (data/marks.ts) in its family's colour.
 * The data and the scoring are in data/traps.ts; this page's own CSS (styles/traps.css) is only the map and the gauge.
 */

const RANKED = [...TRAPS].sort((a, b) => power(b) - power(a) || b.pull - a.pull);
const RANK = new Map(RANKED.map((x, i) => [x.id, i + 1]));
const BY_ID = new Map(TRAPS.map((x) => [x.id, x]));
const FAMILY_IDS = Object.keys(FAMILIES) as Family[];
const hueOf = (x: Trap) => FAMILIES[x.family].hue;
const WORLD = 'sadness';

/** For each trap, the Win friends principles that disarm it (Win friends), and how. */
const DISARMS = (() => {
  const by = new Map<string, { p: Principle; how: string }[]>();
  for (const p of PRINCIPLES) for (const { id, how } of p.traps) by.set(id, [...(by.get(id) ?? []), { p, how }]);
  return by;
})();

/** For each trap, the laws of power that spring it (Laws of power), and how. */
const SPRUNG_BY = (() => {
  const by = new Map<string, { law: Law; how: string }[]>();
  for (const law of LAWS) for (const { id, how } of law.traps) by.set(id, [...(by.get(id) ?? []), { law, how }]);
  return by;
})();

/* ---------- small pieces ---------- */

/** Power out of 100 as a ring. `draw` fills it once after the sheet has landed; on the page it simply shows. */
function Gauge({ value, hue, size = 76, draw }: { value: number; hue: string; size?: number; draw?: boolean }) {
  const r = 30, c = 2 * Math.PI * r;
  return (
    <svg class={`tr-gauge${draw ? ' is-draw' : ''}`} width={size} height={size} viewBox="0 0 76 76" style={{ '--c': `var(--emo-${hue})` }} role="img" aria-label={`${t('Power')} ${value}`}>
      <circle cx="38" cy="38" r={r} class="tr-gauge-track" />
      <circle cx="38" cy="38" r={r} class="tr-gauge-fill" transform="rotate(-90 38 38)" style={{ strokeDasharray: `${(c * value) / 100} ${c}` }} />
      <text x="38" y="38" class="tr-gauge-num" text-anchor="middle" dominant-baseline="central">{value}</text>
    </svg>
  );
}

/** One question. The options never move: what the answer means appears under them. */
function Quiz({ q, options, answer, reveal, gut, onAnswer }: { q: string; options: string[]; answer?: number; reveal: string; gut?: number; onAnswer?: (right: boolean) => void }) {
  const [picked, setPicked] = useState<number | null>(null);
  const pick = (i: number) => {
    if (picked != null) return;
    haptic(answer == null || i === answer ? 6 : 14);
    setPicked(i);
    onAnswer?.(answer == null || i === answer);
  };
  const state = (i: number) =>
    picked == null ? 'idle' : answer == null ? (i === picked ? 'picked' : 'idle') : i === answer ? 'right' : i === picked ? 'wrong' : 'idle';
  return (
    <div class="lrn-quiz">
      <p class="lrn-q">{q}</p>
      <div class="lrn-opts">
        {options.map((o, i) => (
          <Option index={i} label={o} state={state(i)} disabled={picked != null && state(i) === 'idle'} pressed={picked === i} onClick={() => pick(i)} />
        ))}
      </div>
      <div aria-live="polite">
        {picked != null && (
          <p class="lrn-verdict">
            {answer != null && <b class={picked === answer ? 'is-right' : 'is-wrong'}>{picked === answer ? t('Right.') : picked === gut ? t('That’s the gut answer.') : t('Not quite.')}</b>}
            {answer != null && ' '}{reveal}
          </p>
        )}
      </div>
    </div>
  );
}

/** The power of a trap at a row's end. */
const PowerNum = ({ x }: { x: Trap }) => <span class="lrn-num"><b>{power(x)}</b><small>{t('power')}</small></span>;

/* ---------- the power map ---------- */

// The map's geometry, in the SVG's units: the centre, the radius for a power, and the ring the family names sit on.
const C = 200;
const rOf = (p: number) => 24 + (100 - p) * 3.4;
const SPOKE = 176;
const LABEL = 192;
const SPAN = 360 / FAMILY_IDS.length;
const at = (r: number, a: number) => [C + r * Math.sin((a * Math.PI) / 180), C - r * Math.cos((a * Math.PI) / 180)];
const STARS = (() => {
  const out: { x: Trap; px: number; py: number }[] = [];
  FAMILY_IDS.forEach((f, fi) => {
    const list = RANKED.filter((x) => x.family === f);
    list.forEach((x, i) => {
      const [px, py] = at(rOf(power(x)), fi * SPAN + SPAN * ((i + 0.5) / list.length));
      out.push({ x, px, py });
    });
  });
  return out;
})();
const WHERE = new Map(STARS.map((s) => [s.x.id, s]));

/** Every trap as a star: its family's slice of the circle, and the stronger it pulls, the nearer the centre. */
function PowerMap({ open }: { open: (x: Trap) => void }) {
  const [hot, setHot] = useState<string | null>(null);
  const focus = hot ? BY_ID.get(hot)! : null;
  return (
    <div class="tr-map">
      <svg viewBox="-24 10 448 396" role="group" aria-label={t('Every trap by family and power')}>
        {[90, 80, 70, 60].map((p) => (
          <g class="tr-map-ring">
            <circle cx={C} cy={C} r={rOf(p)} />
            <text x={C + 4} y={C - rOf(p) - 4}>{p}</text>
          </g>
        ))}
        {FAMILY_IDS.map((f, fi) => {
          const [x1, y1] = at(SPOKE, fi * SPAN);
          const [lx, ly] = at(LABEL, (fi + 0.5) * SPAN);
          return (
            <g style={{ '--c': `var(--emo-${FAMILIES[f].hue})` }}>
              <line x1={C} y1={C} x2={x1} y2={y1} class="tr-map-spoke" />
              <text x={lx} y={ly} class="tr-map-family" text-anchor="middle" dominant-baseline="central">{t(FAMILIES[f].name)}</text>
            </g>
          );
        })}
        {focus && (
          <g class="tr-map-kin" style={{ '--c': `var(--emo-${hueOf(focus)})` }}>
            {focus.kin.map((k) => {
              const a = WHERE.get(focus.id)!, b = WHERE.get(k);
              return b && <path d={`M${a.px} ${a.py}Q${C} ${C} ${b.px} ${b.py}`} />;
            })}
          </g>
        )}
        {STARS.map(({ x, px, py }) => (
          <g
            class={`tr-star${hot === x.id ? ' is-hot' : ''}${focus && focus.kin.includes(x.id) ? ' is-kin' : ''}`}
            style={{ '--c': `var(--emo-${hueOf(x)})` }}
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
          <text x={C} y={C} text-anchor="middle" dominant-baseline="central">{focus ? power(focus) : '∞'}</text>
        </g>
      </svg>
      <Caption
        title={focus?.name}
        sub={focus ? t('#{rank} · {family} · tap to open', { rank: RANK.get(focus.id)!, family: t(FAMILIES[focus.family].name) }) : undefined}
        idle={t('The nearer the centre, the harder it pulls. Bigger stars reach further into everyday life.')}
      />
    </div>
  );
}

/* ---------- one trap, opened ---------- */

function TrapDetail({ x, caught, onCaught, go, openPrinciple, openLaw, onShare }: {
  x: Trap;
  caught: number;
  onCaught: () => void;
  /** Left out on a shared link, with the links they follow: only what was shared shows. */
  go?: (id: string) => void;
  openPrinciple?: (n: number) => void;
  openLaw?: (n: number) => void;
  onShare?: () => void;
}) {
  const hue = hueOf(x);
  const [ev, evAbout] = EVIDENCE[x.evidence];
  const meters: [string, number, string][] = [
    [t('Pull'), x.pull, t('How hard it is to resist, even knowing it’s there')],
    [t('Reach'), x.reach, t('How much of everyday life it touches')],
    [t('Harm'), x.harm, t('What it costs when it wins')],
  ];
  const disarms = DISARMS.get(x.id) ?? [];
  const laws = SPRUNG_BY.get(x.id) ?? [];
  const kin = x.kin.map((k) => BY_ID.get(k)).filter((k): k is Trap => !!k);
  return (
    <article class="lrn-detail" key={x.id}>
      <DetailHead id={x.id} hue={hue} kicker={`${t(FAMILIES[x.family].name)} · ${t(FAMILIES[x.family].motto)}`} title={x.name} line={x.line} onShare={onShare}>
        {x.aka && <p>{t('also called')} {x.aka}</p>}
      </DetailHead>

      <div class="lrn-meters tr-power">
        <Gauge value={power(x)} hue={hue} draw />
        <div class="tr-power-meters">
          {meters.map(([label, v, about]) => <Meter label={label} value={v} about={about} />)}
        </div>
        <p class="tr-ev">
          <Ico name={x.evidence === 'debated' ? 'alert-circle' : 'check'} size={14} arrive />
          <span><b>{t('Evidence: {level}', { level: t(ev) })}</b> {t(evAbout)}</span>
        </p>
      </div>

      <blockquote class="lrn-quote">
        <small>{t('The thought that gives it away')}</small>
        {x.tell}
      </blockquote>

      <section class="lrn-d-sec">
        <h3 class="lrn-d-h">{t('What it is')}</h3>
        <p class="lrn-d-p">{x.what}</p>
      </section>

      <section class="lrn-d-sec">
        <h3 class="lrn-d-h">{t('Why your brain does it')}</h3>
        <p class="lrn-d-p">{x.why}</p>
        <Aside icon="info-circle" label={t('The experiment')} title={x.study.title} who={x.study.who}>
          <p>{x.study.text}</p>
        </Aside>
      </section>

      {x.test && (
        <section class="lrn-d-sec">
          <h3 class="lrn-d-h">{t('Try it on yourself')}</h3>
          <Quiz {...x.test} />
        </section>
      )}

      <section class="lrn-d-sec">
        <h3 class="lrn-d-h">{t('Where it gets you')}</h3>
        <ul class="lrn-list">{x.life.map((l) => <li>{l}</li>)}</ul>
      </section>

      <section class="lrn-d-sec">
        <h3 class="lrn-d-h">{t('How to get out')}</h3>
        <ol class="lrn-list is-steps">{x.escape.map((l) => <li>{l}</li>)}</ol>
      </section>

      {openPrinciple && disarms.length > 0 && (
        <section class="lrn-d-sec">
          <h3 class="lrn-d-h">{t('Principles that disarm it')}</h3>
          <div class="lrn-links">
            {disarms.map(({ p, how }) => (
              <LinkRow hue={PARTS[p.part].hue} id={p.id} kicker={t('Principle {n}', { n: p.n })} title={p.title} how={how} onClick={() => openPrinciple(p.n)} />
            ))}
          </div>
        </section>
      )}

      {openLaw && laws.length > 0 && (
        <section class="lrn-d-sec">
          <h3 class="lrn-d-h">{t('Laws of power')}</h3>
          <div class="lrn-links">
            {laws.map(({ law, how }) => (
              <LinkRow hue={REALMS[law.realm].hue} id={law.id} kicker={t('Law {n}', { n: law.n })} title={law.title} how={how} onClick={() => openLaw(law.n)} />
            ))}
          </div>
        </section>
      )}

      <Aside icon="sparkles" label={t('Strange but true')}>
        <p>{x.fact}</p>
      </Aside>

      <div class="lrn-actions">
        <Tally icon="eye" label={t('I caught myself in this one')} n={caught} onClick={() => { haptic(10); onCaught(); }} />
      </div>

      {go && kin.length > 0 && (
        <section class="lrn-d-sec">
          <h3 class="lrn-d-h">{t('Related traps')}</h3>
          <ol class="lrn-rows">
            {kin.map((k) => (
              <Row id={k.id} hue={hueOf(k)} title={k.name} sub={k.line} end={<PowerNum x={k} />} onClick={() => go(k.id)} />
            ))}
          </ol>
        </section>
      )}
    </article>
  );
}

/* ---------- the page ---------- */

type Sort = 'family' | 'power' | 'name';
const SORTS: Sort[] = ['family', 'power', 'name'];

export function Traps({ query: params }: { query: URLSearchParams }) {
  // ?open=<id> opens a trap straight away (the Laws of power and Win friends pages link here)
  const [open, setOpen] = useState<string | null>(() => (BY_ID.has(params.get('open') ?? '') ? params.get('open') : null));
  const [sharing, setSharing] = useState<ShareTarget | null>(null);
  // a shared link to one trap shows just that trap, as a page
  const [solo] = useState(() => onSharedLink && open !== null);
  const [family, setFamily] = usePref<string>('traps-family', 'all', ['all', ...FAMILY_IDS]);
  const [sort, setSort] = usePref<Sort>('traps-sort', 'family', SORTS);
  const [query, setQuery] = useState('');
  // how often you've caught yourself in each trap, on this device
  const [caught, setCaught] = useLocal<Record<string, number>>('mm-traps-caught', {});
  // counted at once, with Undo for a slip of the finger
  const addCaught = (id: string) => {
    setCaught({ ...caught, [id]: (caught[id] ?? 0) + 1 });
    toast(t('Counted'), { label: t('Undo'), run: () => setCaught((c) => ({ ...c, [id]: Math.max(0, (c[id] ?? 0) - 1) })) });
  };
  const [score, setScore] = useState<boolean[]>([]);
  const body = useRef<HTMLDivElement>(null);

  const today = RANKED[Math.floor((Date.now() - new Date().getTimezoneOffset() * 60_000) / 86_400_000) % RANKED.length];
  const picked = family === 'all' ? null : FAMILIES[family as Family];
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = RANKED.filter((x) => (family === 'all' || x.family === family) && (!q || `${x.name} ${x.aka ?? ''} ${x.line} ${x.tell}`.toLowerCase().includes(q)));
    if (sort === 'name') list.sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }, [family, sort, query]);
  const caughtTotal = Object.values(caught).reduce((s, n) => s + n, 0);
  const mostCaught = Object.entries(caught).sort((a, b) => b[1] - a[1])[0];
  const answered = score.filter((x) => x != null).length;
  const blindSpot = BY_ID.get('blind-spot')!;

  const openTrap = (x: Trap) => { haptic(5); setOpen(x.id); };
  const go = (id: string) => { jumpTop(body.current); setOpen(id); };
  const openPrinciple = (n: number) => { setOpen(null); navigateAfterSheet(`friends?open=${n}`); };
  const openLaw = (n: number) => { setOpen(null); navigateAfterSheet(`laws?open=${n}`); };
  // the sheet keeps showing the last trap while it slides away
  const last = useRef<Trap | null>(null);
  if (open) last.current = BY_ID.get(open) ?? null;
  const current = last.current;

  const row = (x: Trap, ranked: boolean) => {
    const n = caught[x.id] ?? 0;
    return (
      <Row
        key={x.id}
        id={x.id}
        hue={hueOf(x)}
        title={x.name}
        sub={x.line}
        rank={ranked ? RANK.get(x.id) : undefined}
        top={
          <>
            {ranked ? t(FAMILIES[x.family].name) : sort === 'name' ? `#${RANK.get(x.id)} · ${t(FAMILIES[x.family].name)}` : `#${RANK.get(x.id)}`}
            {n > 0 && <span class="tr-caught"><Ico name="eye" size={12} />{n}</span>}
          </>
        }
        badge={x.evidence === 'debated' ? t('debated') : undefined}
        end={<PowerNum x={x} />}
        onClick={() => openTrap(x)}
      />
    );
  };

  // by family: one group each; by power or by name: one group, the whole (filtered) list
  const groups =
    sort === 'family'
      ? FAMILY_IDS.map((f) => ({ key: f, f, list: shown.filter((x) => x.family === f) })).filter((g) => g.list.length)
      : shown.length ? [{ key: sort, f: picked ? (family as Family) : null, list: shown }] : [];

  if (solo && current) {
    return (
      <SharedEntry world={WORLD} page="traps-page" title={t('Mind traps')} rank={t('#{rank} of {n}', { rank: RANK.get(current.id)!, n: TRAPS.length })} onShare={() => setSharing({ path: `traps?open=${current.id}`, title: current.name })}>
        <TrapDetail x={current} caught={caught[current.id] ?? 0} onCaught={() => addCaught(current.id)} />
        <LearnShare target={sharing} onClose={() => setSharing(null)} />
      </SharedEntry>
    );
  }

  return (
    <div class="page lrn-page traps-page" style={{ '--accent': `var(--emo-${WORLD})` }}>
      <div class="journal-top lrn-top" style={{ '--sky': `var(--emo-${WORLD})` }}>
        <Sky world={WORLD} />
        <PageHead title={t('Mind traps')} back={onSharedLink ? undefined : () => goBack()} actions={<ShareButton onClick={() => setSharing({ path: 'traps', title: t('Mind traps') })} />} subtitle={t('40 ways your brain fools you, ranked by how hard they pull')} />
        <div class="media-stats stats-figures">
          <span class="stat" style={{ '--i': 0 }} title={t('in {n} families', { n: FAMILY_IDS.length })}>
            <b>{TRAPS.length}</b>
            <small>{t('Traps')}</small>
          </span>
          <span class="stat" style={{ '--i': 1 }} title={t('so far, by psychologists')}>
            <b>180+</b>
            <small>{t('Biases named')}</small>
          </span>
          <span class="stat" style={{ '--i': 2 }} title={mostCaught ? t('most: {name}', { name: BY_ID.get(mostCaught[0])?.name ?? '' }) : t('in none yet')}>
            <b>{caughtTotal}</b>
            <small>{t('Caught yourself')}</small>
          </span>
        </div>
        <label class="search">
          <Ico name="search" size={18} />
          <input type="search" value={query} onInput={(e) => setQuery(e.currentTarget.value)} placeholder={t('Search traps or thoughts')} aria-label={t('Search traps or thoughts')} />
        </label>
      </div>

      <div class="lrn">
        <div class="lrn-side">
          <Today
            kicker={t('Trap of the day')}
            id={today.id}
            hue={hueOf(today)}
            title={today.name}
            line={today.line}
            aside={<Gauge value={power(today)} hue={hueOf(today)} size={56} />}
            footLabel={t('The thought that gives it away')}
            foot={today.tell}
            onClick={() => openTrap(today)}
          />

          <section class="card lrn-card">
            <header class="lrn-card-head">
              <h2 class="lrn-card-title">{t('Where they pull from')}</h2>
              <p class="lrn-card-sub">{t('Every trap by family and power')}</p>
            </header>
            <PowerMap open={openTrap} />
          </section>

          <section class="card lrn-card">
            <header class="lrn-card-head">
              <h2 class="lrn-card-title">{t('You have two minds')}</h2>
              <p class="lrn-card-sub">{t('System 1 is fast and automatic, System 2 slow and careful. Nearly every trap below is System 1 answering a question that needed System 2. Answer these with your first instinct.')}</p>
            </header>
            {REFLECT.map((r, i) => (
              <Quiz q={`${i + 1}. ${r.q}`} options={r.options} answer={r.answer} gut={r.gut} reveal={r.why} onAnswer={(right) => setScore((s) => { const n = [...s]; n[i] = right; return n; })} />
            ))}
            <div class="lrn-quiz-foot">
              <p class="lrn-score" aria-live="polite">{answered === REFLECT.length ? t('You got {n} of 3.', { n: score.filter(Boolean).length }) : ''}</p>
            </div>
            {answered === REFLECT.length && (
              <p class="lrn-verdict">{t('In Shane Frederick’s 2005 study of 3,428 people, only 17% got all three; even at MIT, fewer than half did. The wrong answers aren’t random: almost everyone who misses picks the same one, the one that jumps out first.')}</p>
            )}
          </section>
        </div>

        <div class="lrn-main">
          <div>
            <div class="lrn-head">
              <div class="chips scroll-x lrn-chips" role="toolbar" aria-label={t('Family')}>
                <button class="chip" aria-pressed={!picked} onClick={() => setFamily('all')}>{t('All')}</button>
                {FAMILY_IDS.map((f) => (
                  <button class="chip lrn-chip" style={{ '--c': `var(--emo-${FAMILIES[f].hue})` }} aria-pressed={family === f} onClick={() => setFamily(family === f ? 'all' : f)}>
                    <i class="lrn-dot" aria-hidden="true" />
                    {t(FAMILIES[f].name)}
                  </button>
                ))}
              </div>
              <SortChip<Sort> sort={sort} onSort={setSort} options={[['family', t('Family')], ['power', t('Power')], ['name', t('A–Z')]]} />
            </div>

            {groups.length ? (
              <div class="lrn-groups">
                {groups.map(({ key, f, list }) => (
                  <section class="lrn-group" key={key}>
                    <GroupHead
                      hue={f ? FAMILIES[f].hue : undefined}
                      title={f ? t(FAMILIES[f].name) : query.trim() ? t('Traps') : sort === 'power' ? t('All forty, strongest first') : t('Traps')}
                      motto={f ? t(FAMILIES[f].motto) : undefined}
                      about={f && picked ? t(FAMILIES[f].about) : undefined}
                      count={list.length}
                    />
                    <ol class="lrn-rows">{list.map((x) => row(x, sort === 'power'))}</ol>
                  </section>
                ))}
              </div>
            ) : (
              <p class="empty-note">{t('No trap matches that. Which is, of course, exactly what a trap would want you to think.')}</p>
            )}
          </div>

          <section class="card lrn-card">
            <header class="lrn-card-head">
              <h2 class="lrn-card-title">{t('How power is scored')}</h2>
            </header>
            <p>{t('Each trap is rated from 1 to 10 on three things, and power is the weighted sum, out of 100. It’s a considered judgement drawn from the research, not a measurement: no study ranks biases against each other.')}</p>
            <ul class="lrn-list">
              <li><b>{t('Pull')} ×{POWER.pull}</b>. {t('How hard it is to resist, even knowing it’s there. It counts most: a trap you can walk out of once you see it is a weaker trap.')}</li>
              <li><b>{t('Reach')} ×{POWER.reach}</b>. {t('How much of everyday life it touches, from what you buy to who you trust.')}</li>
              <li><b>{t('Harm')} ×{POWER.harm}</b>. {t('What it costs when it wins: money, health, relationships, justice.')}</li>
            </ul>
            <ul class="lrn-list">
              {(Object.keys(EVIDENCE) as (keyof typeof EVIDENCE)[]).map((k) => (
                <li><b>{t('Evidence: {level}', { level: t(EVIDENCE[k][0]) })}</b>. {t(EVIDENCE[k][1])}</li>
              ))}
            </ul>
          </section>

          <section class="card lrn-card">
            <p>{t('Knowing about a trap doesn’t free you from it, and neither does being clever: in study after study, people with higher cognitive ability fell for many biases about as often as everyone else, and were no better at seeing their own. Reading about them changes little. Practice with feedback does better: in 2015 a single training game cut several biases, and the effect was still there two months later. What helps most is slower thinking at the moments that matter, other people who will tell you when you’re wrong, and writing things down before you know how they turn out.')}</p>
            <div class="lrn-links">
              <LinkRow
                hue={hueOf(blindSpot)}
                id={blindSpot.id}
                kicker={`1/661 · ${t('Think they’re more biased')} ${t('than the average person')}`}
                title={t('Read the trap you’re in right now')}
                how={blindSpot.name}
                onClick={() => openTrap(blindSpot)}
              />
            </div>
          </section>
        </div>
      </div>

      <Sheet open={!!open} onClose={() => setOpen(null)} title={current ? t('#{rank} of {n}', { rank: RANK.get(current.id)!, n: TRAPS.length }) : ''} label={current?.name} tall>
        <div ref={body}>
          {current && (
            <TrapDetail
              x={current}
              onShare={() => setSharing({ path: `traps?open=${current.id}`, title: current.name })}
              caught={caught[current.id] ?? 0}
              onCaught={() => addCaught(current.id)}
              go={go}
              openPrinciple={onSharedLink ? undefined : openPrinciple}
              openLaw={onSharedLink ? undefined : openLaw}
            />
          )}
        </div>
      </Sheet>
      <LearnShare target={sharing} onClose={() => setSharing(null)} />
    </div>
  );
}
