import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { goBack, navigateAfterSheet } from '../lib/router';
import { usePref } from '../lib/prefs';
import { haptic } from '../lib/haptics';
import { t } from '../lib/i18n';
import { LAWS, REALMS, type Law, type Realm } from '../data/laws';
import { FAMILIES, TRAPS, type Trap } from '../data/traps';
import { PARTS, PRINCIPLES, type Principle } from '../data/principles';
import { Sheet } from '../components/Sheet';
import { PageHead } from '../components/PageHead';
import { LearnShare, ShareButton, type ShareTarget } from '../components/LearnShare';
import { Sky } from '../components/Sky';
import { SortChip } from '../components/collection';
import { Aside, Caption, DetailHead, GroupHead, Ico, LinkRow, Meter, Option, Row, Tally, Today, jumpTop, playIcon, shuffle, useLocal } from '../components/learn';
import '../styles/stats.css';
import '../styles/laws.css';

/*
 * The 48 Laws of Power, under Insights, laid out like the other Learn pages (components/learn.tsx): a sky with three
 * figures and the search, then a feature column (the law of the day, the shadow map, a game and the mind traps the
 * laws spring) and every law in its arena, in compact rows. Each law opens to its history, its psychology, the mind
 * traps it springs (linked to the Mind traps page), how to see it coming and Carnegie's answer to it. The data is in
 * data/laws.
 */

const BY_N = new Map(LAWS.map((x) => [x.n, x]));
const TRAP_BY_ID = new Map(TRAPS.map((x) => [x.id, x]));
const REALM_IDS = Object.keys(REALMS) as Realm[];
const hueOf = (x: Law) => REALMS[x.realm].hue;
const WORLD = 'anger';
const LEVERS = new Set(LAWS.flatMap((x) => x.levers.map((l) => l.name.toLowerCase()))).size;

/** For each law, the Carnegie principles that answer it (Win friends), and how. */
const ANSWERS = (() => {
  const by = new Map<number, { p: Principle; how: string }[]>();
  for (const p of PRINCIPLES) for (const { n, how } of p.laws) by.set(n, [...(by.get(n) ?? []), { p, how }]);
  return by;
})();

/** Every mind trap the laws spring, most-sprung first, with the laws that spring it. */
const SPRUNG = (() => {
  const by = new Map<string, Law[]>();
  for (const x of LAWS) for (const { id } of x.traps) if (TRAP_BY_ID.has(id)) by.set(id, [...(by.get(id) ?? []), x]);
  return [...by.entries()].map(([id, laws]) => ({ trap: TRAP_BY_ID.get(id)!, laws })).sort((a, b) => b.laws.length - a.laws.length);
})();

/* ---------- the shadow map ---------- */

/** Every law by how manipulative it is against how often it plays out in ordinary life. */
function ShadowMap({ open }: { open: (x: Law) => void }) {
  const [hot, setHot] = useState<number | null>(null);
  const W = 400, H = 300, P = 32;
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
    [P + 6, P + 16, t('Dark arts'), 'start'],
    [W - P - 6, P + 16, t('Everyday manipulation'), 'end'],
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
        {quads.map(([x, y, label, anchor]) => <text x={x} y={y} text-anchor={anchor} class="lw-map-quad">{label}</text>)}
        <text x={W / 2} y={H - 10} text-anchor="middle" class="lw-map-label">{t('How often it plays out')} →</text>
        <text x={14} y={H / 2} text-anchor="middle" class="lw-map-label" transform={`rotate(-90 14 ${H / 2})`}>{t('How dark it is')} →</text>
        {focus && (
          <g class="lw-map-kin" style={{ '--c': `var(--emo-${hueOf(focus)})` }}>
            {focus.kin.map((k) => {
              const a = dots.find((d) => d.x.n === focus.n)!, b = dots.find((d) => d.x.n === k);
              return b && <line x1={a.px} y1={a.py} x2={b.px} y2={b.py} />;
            })}
          </g>
        )}
        {dots.map(({ x, px, py }) => (
          <g
            class={`lw-dot${hot === x.n ? ' hot' : ''}${focus && focus.kin.includes(x.n) ? ' kin' : ''}`}
            style={{ '--c': `var(--emo-${hueOf(x)})` }}
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
            <text x={px} y={py - 12} text-anchor="middle" class="lw-dot-n">{x.n}</text>
          </g>
        ))}
      </svg>
      <Caption
        title={focus ? `${focus.n}. ${focus.title}` : undefined}
        sub={focus ? t('Darkness {d} · everyday {e} · tap to open', { d: focus.dark, e: focus.everyday }) : undefined}
        idle={t('Up is darker, right is more common. The top right is what you most need to recognise.')}
      />
    </div>
  );
}

/* ---------- name the move ---------- */

function deal(not?: number) {
  const pool = LAWS.filter((x) => x.n !== not);
  const law = pool[Math.floor(Math.random() * pool.length)];
  // the wrong answers come from other arenas when possible, so the game turns on the move, not the colour
  const others = shuffle(LAWS.filter((x) => x.n !== law.n && x.realm !== law.realm)).slice(0, 3);
  return { law, options: shuffle([law, ...others]) };
}

/**
 * A modern scene, four laws to pick from. Nothing changes size when you answer or deal the next one: the scene keeps
 * room for its longest, the verdict comes into a slot under the options that's always there, and the foot (the running
 * score, both buttons) is laid out from the start.
 */
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
  const won = picked === round.law.n;
  return (
    <div class="lrn-quiz">
      <p class="lrn-q lw-scene">{round.law.scenario}</p>
      <div class="lrn-opts">
        {round.options.map((x, i) => {
          const state = picked == null ? 'idle' : x.n === round.law.n ? 'right' : picked === x.n ? 'wrong' : 'idle';
          return (
            <Option
              index={i}
              label={x.title}
              state={state}
              disabled={picked != null && state === 'idle'}
              pressed={picked === x.n}
              onClick={() => pick(x.n)}
            />
          );
        })}
      </div>
      <div class="lw-verdict" role="status">
        {picked != null && (
          <p class="lrn-verdict">
            <b class={won ? 'is-right' : 'is-wrong'}>{won ? t('Right.') : t('It was law {n}.', { n: round.law.n })}</b> {round.law.line}
          </p>
        )}
      </div>
      <div class="lrn-quiz-foot">
        <p class="lrn-score">{score.played > 0 ? `${t('{right} of {played}', score)}${score.streak > 2 ? ` · ${t('{n} in a row', { n: score.streak })}` : ''}` : ''}</p>
        {/* always laid out (hidden until you answer), so the card keeps its height between rounds */}
        <div class="lw-game-actions" style={picked == null ? { visibility: 'hidden' } : undefined}>
          <button class="btn btn-quiet btn-s" onClick={() => open(round.law)}>{t('Read the law')}</button>
          <button class="btn btn-primary btn-s" onClick={next}>{t('Next move')} <Ico name="chevron-right" size={16} /></button>
        </div>
      </div>
    </div>
  );
}

/* ---------- what you've seen ---------- */

/** On this device: how often you've seen each law played on you, and caught yourself playing it. */
type Seen = Record<number, { on?: number; by?: number }>;

/* ---------- one law, opened ---------- */

type Lens = 'player' | 'target';
const LENSES: Lens[] = ['player', 'target'];

function LawDetail({ x, lens, onLens, seen, onSeen, go, openTrap, openPrinciple, onShare }: {
  x: Law;
  lens: Lens;
  onLens: (l: Lens) => void;
  seen: { on?: number; by?: number };
  onSeen: (k: 'on' | 'by') => void;
  go: (n: number) => void;
  openTrap: (id: string) => void;
  openPrinciple: (n: number) => void;
  onShare: () => void;
}) {
  const realm = REALMS[x.realm];
  const traps = x.traps.map((s) => ({ ...s, trap: TRAP_BY_ID.get(s.id) })).filter((s): s is typeof s & { trap: Trap } => !!s.trap);
  const answers = ANSWERS.get(x.n) ?? [];
  const kin = x.kin.map((k) => BY_N.get(k)).filter((k): k is Law => !!k);

  const law = (
    <section class="lrn-d-sec">
      <h3 class="lrn-d-h">{t('The law')}</h3>
      <p class="lrn-d-p">{x.gist}</p>
      <Aside icon="book" label={t('From history')} title={x.scene.who} who={x.scene.when}>{x.scene.text}</Aside>
    </section>
  );
  const why = (
    <section class="lrn-d-sec">
      <h3 class="lrn-d-h">{t('Why it works')}</h3>
      <p class="lrn-d-p">{x.mind}</p>
      <div class="lw-sub">
        <p class="kicker">{t('The levers it pulls')}</p>
        <ul class="lrn-list">{x.levers.map((l) => <li><b>{l.name}</b>. {l.text}</li>)}</ul>
      </div>
      <Aside icon="info-circle" label={t('The experiment')} title={x.study.title} who={x.study.who}>{x.study.text}</Aside>
      {traps.length > 0 && (
        <div class="lw-sub">
          <p class="kicker">{t('The mind traps it springs')}</p>
          <div class="lrn-links">
            {traps.map(({ trap, how }) => (
              <LinkRow hue={FAMILIES[trap.family].hue} id={trap.id} kicker={t('Mind trap')} title={trap.name} how={how} onClick={() => openTrap(trap.id)} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
  const onYou = (
    <section class="lrn-d-sec">
      <h3 class="lrn-d-h">{t('When it’s played on you')}</h3>
      <div class="lw-sub">
        <p class="kicker">{t('Where you’ll meet it today')}</p>
        <ul class="lrn-list">{x.today.map((l) => <li>{l}</li>)}</ul>
      </div>
      <div class="lw-sub">
        <p class="kicker">{t('The signs')}</p>
        <ul class="lrn-list">{x.signs.map((l) => <li>{l}</li>)}</ul>
      </div>
      <div class="lw-sub">
        <p class="kicker">{t('Your defence')}</p>
        <ol class="lrn-list is-steps">{x.defense.map((l) => <li>{l}</li>)}</ol>
      </div>
    </section>
  );

  return (
    <article class="lrn-detail" key={x.n}>
      <DetailHead id={x.id} hue={hueOf(x)} kicker={`${t('Law {n}', { n: x.n })} · ${t(realm.name)}`} title={x.title} line={x.line} onShare={onShare} />

      <div class="lrn-meters">
        <Meter label={t('Darkness')} value={x.dark} about={t('How manipulative it is')} />
        <Meter label={t('Everyday')} value={x.everyday} about={t('How often it plays out in ordinary life')} />
      </div>

      {/* the lens: read the law as the one playing it (the law first) or as its target (the defence first) */}
      <div class="lrn-d-sec">
        <div class="seg tabs" role="tablist" aria-label={t('Read as')} style={{ '--at': LENSES.indexOf(lens), '--tabs': LENSES.length }}>
          <button role="tab" aria-selected={lens === 'player'} onClick={() => onLens('player')}><Ico name="crown" size={16} /> {t('As the player')}</button>
          <button role="tab" aria-selected={lens === 'target'} onClick={() => onLens('target')}><Ico name="eye" size={16} /> {t('As the target')}</button>
        </div>
      </div>

      {lens === 'player' ? <>{law}{why}{onYou}</> : <>{onYou}{law}{why}</>}

      <div class="lrn-pair">
        <Aside icon="moon" label={t('The shadow side')}>{x.shadow}</Aside>
        <Aside icon="heart" label={t('The honest version')}>{x.honest}</Aside>
      </div>

      {answers.length > 0 && (
        <section class="lrn-d-sec">
          <h3 class="lrn-d-h">{t('Carnegie’s answer')}</h3>
          <div class="lrn-links">
            {answers.map(({ p, how }) => (
              <LinkRow hue={PARTS[p.part].hue} id={p.id} kicker={t('Principle {n}', { n: p.n })} title={p.title} how={how} onClick={() => openPrinciple(p.n)} />
            ))}
          </div>
        </section>
      )}

      <section class="lrn-d-sec">
        <blockquote class="lrn-quote">
          <small>{t('A question to sit with')}</small>
          {x.question}
        </blockquote>
        <div class="lrn-actions">
          <Tally icon="eye" label={t('Played on me')} n={seen.on ?? 0} onClick={() => { haptic(10); onSeen('on'); }} />
          <Tally icon="crown" label={t('I played it')} n={seen.by ?? 0} onClick={() => { haptic(10); onSeen('by'); }} />
        </div>
      </section>

      {kin.length > 0 && (
        <section class="lrn-d-sec">
          <h3 class="lrn-d-h">{t('Related laws')}</h3>
          <ol class="lrn-rows">
            {kin.map((k) => (
              <Row id={k.id} hue={hueOf(k)} top={`${t('Law {n}', { n: k.n })} · ${t(REALMS[k.realm].name)}`} title={k.title} onClick={() => go(k.n)} />
            ))}
          </ol>
        </section>
      )}
    </article>
  );
}

/* ---------- the page ---------- */

type Sort = 'arena' | 'n' | 'dark';
const SORTS: Sort[] = ['arena', 'n', 'dark'];

export function Laws({ query: params }: { query: URLSearchParams }) {
  const [open, setOpen] = useState<number | null>(() => Number(params.get('open')) || null);
  const [sharing, setSharing] = useState<ShareTarget | null>(null);
  const [realm, setRealm] = usePref<string>('laws-realm', 'all', ['all', ...REALM_IDS]);
  const [sort, setSort] = usePref<Sort>('laws-sort', 'arena', SORTS);
  const [lens, setLens] = usePref<Lens>('laws-lens', 'player', LENSES);
  const [query, setQuery] = useState('');
  const [seen, setSeen] = useLocal<Seen>('mm-laws-seen', {});
  const addSeen = (n: number, k: 'on' | 'by') => setSeen({ ...seen, [n]: { ...seen[n], [k]: (seen[n]?.[k] ?? 0) + 1 } });
  const body = useRef<HTMLDivElement>(null);

  const today = LAWS[Math.floor((Date.now() - new Date().getTimezoneOffset() * 60_000) / 86_400_000) % LAWS.length];
  const picked = realm === 'all' ? null : (realm as Realm);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = LAWS.filter((x) => (!picked || x.realm === picked) && (!q || `${x.n} ${x.title} ${x.line} ${x.gist} ${x.signs.join(' ')} ${x.levers.map((l) => l.name).join(' ')}`.toLowerCase().includes(q)));
    if (sort === 'dark') list.sort((a, b) => b.dark - a.dark || a.n - b.n);
    return list;
  }, [picked, sort, query]);
  // by arena: a group for each arena with a law in it; otherwise one group (the picked arena's, or all of them)
  const groups = useMemo(() => {
    if (sort === 'arena') return REALM_IDS.map((r) => ({ realm: r as Realm | null, laws: shown.filter((x) => x.realm === r) })).filter((g) => g.laws.length);
    return shown.length ? [{ realm: picked, laws: shown }] : [];
  }, [shown, sort, picked]);
  const seenOn = Object.values(seen).reduce((s, v) => s + (v.on ?? 0), 0);
  const seenBy = Object.values(seen).reduce((s, v) => s + (v.by ?? 0), 0);

  const openLaw = (x: Law) => { haptic(5); setOpen(x.n); };
  // to another law inside the sheet: back to its top at once, in the same tick, so the new one starts at its head
  const go = (n: number) => { jumpTop(body.current); setOpen(n); };
  const openTrap = (id: string) => { setOpen(null); navigateAfterSheet(`traps?open=${id}`); };
  const openPrinciple = (n: number) => { setOpen(null); navigateAfterSheet(`friends?open=${n}`); };
  // the sheet keeps showing the last law while it slides away
  const last = useRef<Law | null>(null);
  if (open) last.current = BY_N.get(open) ?? null;
  const current = last.current;

  // a link to a law that doesn't exist opens nothing
  useEffect(() => { if (open && !BY_N.has(open)) setOpen(null); }, [open]);

  const search = t('Search laws, signs or levers');
  const top = SPRUNG.slice(0, 6);

  return (
    <div class="page lrn-page laws-page" style={{ '--accent': `var(--emo-${WORLD})` }}>
      <div class="journal-top lrn-top" style={{ '--sky': `var(--emo-${WORLD})` }}>
        <Sky world={WORLD} />
        <PageHead title={t('Laws of power')} back={() => goBack()} actions={<ShareButton onClick={() => setSharing({ path: 'laws', title: t('Laws of power') })} />} subtitle={t('Robert Greene’s 48 laws: the history, the psychology and how to see them coming')} />
        <div class="media-stats stats-figures">
          <span class="stat" style={{ '--i': 0 }}>
            <b>{LAWS.length}</b>
            <small>{t('in {n} arenas', { n: REALM_IDS.length })}</small>
          </span>
          <span class="stat" style={{ '--i': 1 }}>
            <b>{LEVERS}</b>
            <small>{t('Levers')} {t('from psychology')}</small>
          </span>
          <span class="stat" style={{ '--i': 2 }}>
            <b>{seenOn}{seenBy > 0 && <em class="stat-aside">{t('played yourself {n}', { n: seenBy })}</em>}</b>
            <small>{t('Played on you')}</small>
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
            kicker={t('Law of the day')}
            id={today.id}
            hue={hueOf(today)}
            title={today.title}
            line={today.line}
            footLabel={t('A question to sit with')}
            foot={today.question}
            onClick={() => openLaw(today)}
          />

          <section class="card lrn-card">
            <header class="lrn-card-head">
              <h3 class="lrn-card-title">{t('How dark, how common')}</h3>
              <p class="lrn-card-sub">{t('Every law by darkness and how often it plays out')}</p>
            </header>
            <ShadowMap open={openLaw} />
          </section>

          <section class="card lrn-card">
            <header class="lrn-card-head">
              <h3 class="lrn-card-title">{t('Name the move')}</h3>
              <p class="lrn-card-sub">{t('Which law is being played?')}</p>
            </header>
            <NameTheMove open={openLaw} />
          </section>

          <section class="card lrn-card">
            <header class="lrn-card-head">
              <h3 class="lrn-card-title">{t('The mind traps they spring')} <span class="lrn-count">{SPRUNG.length}</span></h3>
              <p class="lrn-card-sub">{t('The biases the laws lean on most. Tap one to read it in Mind traps.')}</p>
            </header>
            <ol class="ranked lw-sprung">
              {top.map(({ trap, laws }, i) => (
                <li style={{ '--k': i, '--c': `var(--emo-${FAMILIES[trap.family].hue})`, '--w': laws.length / top[0].laws.length }}>
                  <button onClick={() => openTrap(trap.id)} title={laws.map((x) => x.n).join(', ')}>
                    <span class="rk-top">
                      <i class="lrn-dot" aria-hidden="true" />
                      <span class="rk-name">{trap.name}</span>
                      <span class="rk-n"><b>{laws.length}</b></span>
                    </span>
                    <span class="rk-bar"><i /></span>
                  </button>
                </li>
              ))}
            </ol>
          </section>

          <section class="card lrn-card lw-about">
            <p>{t('Greene wrote the book without morals on purpose: these are the moves, as courtiers, generals and con artists have made them for centuries. Most people who read it aren’t would-be kings, they’re people who kept losing a game they didn’t know was being played. So each law here also has its shadow side, an honest version, and the signs that someone is playing it on you.')}</p>
            <button class="btn btn-quiet" onClick={(e) => { playIcon(e); openLaw(LAWS[Math.floor(Math.random() * LAWS.length)]); }}><Ico name="dice-5" size={18} /> {t('Draw a law at random')}</button>
          </section>
        </div>

        <div class="lrn-main">
          <section aria-label={t('All 48 laws')}>
            <div class="lrn-head">
              <div class="chips scroll-x lrn-chips" role="toolbar" aria-label={t('Arena')}>
                <button class="chip" aria-pressed={!picked} onClick={() => setRealm('all')}>{t('All')}</button>
                {REALM_IDS.map((r) => (
                  <button class="chip lrn-chip" style={{ '--c': `var(--emo-${REALMS[r].hue})` }} aria-pressed={realm === r} onClick={() => setRealm(realm === r ? 'all' : r)}>
                    <i class="lrn-dot" aria-hidden="true" />
                    {t(REALMS[r].name)}
                  </button>
                ))}
              </div>
              <SortChip sort={sort} onSort={setSort} options={[['arena', t('Arena')], ['n', t('In order')], ['dark', t('Darkest')]]} />
            </div>

            <div class="lrn-groups">
              {groups.map((g) => {
                const info = g.realm ? REALMS[g.realm] : null;
                return (
                  <section class="lrn-group" key={g.realm ?? 'all'}>
                    <GroupHead
                      hue={info?.hue}
                      title={info ? t(info.name) : sort === 'dark' ? t('Darkest') : t('All 48 laws')}
                      motto={info ? t(info.motto) : undefined}
                      about={info && picked ? t(info.about) : undefined}
                      count={g.laws.length}
                    />
                    <ol class="lrn-rows">
                      {g.laws.map((x, i) => {
                        const s = seen[x.n];
                        return (
                          <Row
                            key={x.n}
                            id={x.id}
                            hue={hueOf(x)}
                            rank={sort === 'dark' ? i + 1 : undefined}
                            top={sort === 'arena' || picked ? t('Law {n}', { n: x.n }) : `${t('Law {n}', { n: x.n })} · ${t(REALMS[x.realm].name)}`}
                            badge={s?.on || s?.by ? (
                              <>
                                {!!s.on && <><Ico name="eye" size={12} />{s.on}</>}
                                {!!s.by && <><Ico name="crown" size={12} />{s.by}</>}
                              </>
                            ) : undefined}
                            title={x.title}
                            sub={x.line}
                            end={<span class="lrn-num" title={t('Darkness {d} of 10', { d: x.dark })}><b>{x.dark}</b><small>{t('dark')}</small></span>}
                            onClick={() => openLaw(x)}
                          />
                        );
                      })}
                    </ol>
                  </section>
                );
              })}
            </div>
            {!shown.length && <p class="empty-note">{t('No law matches that. Saying less than necessary, perhaps.')}</p>}
          </section>
        </div>
      </div>

      <Sheet open={!!open} onClose={() => setOpen(null)} title={current ? t('Law {n} of 48', { n: current.n }) : ''} label={current?.title} tall>
        <div ref={body}>
          {current && (
            <LawDetail
              x={current}
              onShare={() => setSharing({ path: `laws?open=${current.n}`, title: current.title })}
              lens={lens}
              onLens={setLens}
              seen={seen[current.n] ?? {}}
              onSeen={(k) => addSeen(current.n, k)}
              go={go}
              openTrap={openTrap}
              openPrinciple={openPrinciple}
            />
          )}
        </div>
      </Sheet>
      <LearnShare target={sharing} onClose={() => setSharing(null)} />
    </div>
  );
}
