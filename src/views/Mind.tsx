import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { usePref } from '../lib/prefs';
import { coreOf } from '../data/emotions';
import { plainText } from '../lib/body';
import { DAY } from '../lib/dates';
import { goBack, navigate } from '../lib/router';
import { usePeople, useReady, type Entry, type Person } from '../lib/store';
import { Icon } from '../components/icons';
import { Avatar } from '../components/people';
import { CountUp } from '../components/charts';
import { Sky } from '../components/Sky';
import { lastSeen, useMoments } from './People';
import { count, rich, t } from '../lib/i18n';

type Range = 'month' | 'year' | 'all';
const RANGES: [Range, string, number][] = [
  ['month', t('30 days'), 30],
  ['year', t('12 months'), 365],
  ['all', t('All time'), 0],
];

interface Share {
  p: Person;
  weight: number;         // moments, each counted by how strong its feeling was (1–5; 3 when no feeling is logged)
  count: number;          // moments they're tagged in, within the range
  share: number;          // 0–1 of all tagged moments in the range
  core: string | null;    // the colour: the main feeling they bring, else the one felt most with them
  last: Entry | undefined;
}

/** The world of feeling that colours someone: the one you picked for them, else the one you log most around them. */
function coreFor(p: Person, all: Entry[]) {
  if (p.emotions[0]) return coreOf(p.emotions[0])?.id ?? null;
  const n = new Map<string, number>();
  for (const e of all) for (const id of e.emotions) { const c = coreOf(id)?.id; if (c) n.set(c, (n.get(c) ?? 0) + 1); }
  return [...n].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
}

const pctOf = (x: number) => (x > 0 && x < 0.01 ? '<1%' : Math.round(x * 100) + '%');

/** "a third of your thoughts", "almost half of your thoughts"… */
function portion(x: number) {
  if (x >= 0.97) return t('all of your thoughts');
  if (x >= 0.7) return t('most of your thoughts');
  if (x >= 0.55) return t('over half of your thoughts');
  if (x >= 0.45) return t('about half of your thoughts');
  if (x >= 0.38) return t('almost half of your thoughts');
  if (x >= 0.3) return t('about a third of your thoughts');
  if (x >= 0.22) return t('about a quarter of your thoughts');
  return t('{pct} of your thoughts', { pct: pctOf(x) });
}

/** How a feeling world sounds when it's about someone you keep thinking of. */
const HOLD: Record<string, string> = {
  joy: t('and they bring you joy'),
  'hope-interest': t('and they give you hope'),
  'love-connection': t('and you hold them with love'),
  'calm-safety': t('and they feel like home'),
  sadness: t('and they weigh on your heart'),
  fear: t('and they bring some worry with them'),
  anger: t('and it stirs up frustration'),
  'shame-aversion': t('and it comes with mixed feelings'),
};

/** The last thing written in a moment, trimmed to a line or two. */
function snippet(e: Entry) {
  const s = (plainText(e.text) || e.title).replace(/\s+/g, ' ').trim();
  return s.length > 110 ? s.slice(0, 107).replace(/\s+\S*$/, '') + '…' : s;
}

/**
 * The colours of a sky, in proportion to how much of your mind each feeling world holds. Eight slots, biggest
 * first and spread out, so that any few clouds picked from the front still look like the whole.
 */
function skyMix(shares: Share[]) {
  const by = new Map<string, number>();
  for (const x of shares) if (x.core && x.count) by.set(x.core, (by.get(x.core) ?? 0) + x.share);
  const seats = new Map<string, number>();
  const out: string[] = [];
  for (let i = 0; i < 8 && by.size; i++) {
    let best = '', score = -1;
    for (const [core, share] of by) {
      const v = share / ((seats.get(core) ?? 0) + 1);
      if (v > score) { score = v; best = core; }
    }
    seats.set(best, (seats.get(best) ?? 0) + 1);
    out.push(best);
  }
  return out;
}

export function Mind() {
  const people = usePeople();
  const ready = useReady();
  const moments = useMoments();
  const [range, setRange] = usePref<Range>('mind-range', 'all', RANGES.map(([r]) => r));
  const [picked, setPicked] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);

  const shares = useMemo<Share[]>(() => {
    const days = RANGES.find((r) => r[0] === range)![2];
    const since = days ? Date.now() - days * DAY : -Infinity;
    const list = people.map((p) => {
      const all = moments.get(p.id) ?? [];
      const inRange = all.filter((e) => e.time >= since);
      const weight = inRange.reduce((n, e) => n + (e.emotions.length ? e.intensity : 3), 0);
      return { p, count: inRange.length, weight, share: 0, core: coreFor(p, all), last: inRange[0] };
    });
    const total = list.reduce((s, x) => s + x.weight, 0);
    for (const x of list) x.share = total ? x.weight / total : 0;
    return list.sort((a, b) => b.weight - a.weight || (b.last?.time ?? 0) - (a.last?.time ?? 0) || a.p.name.localeCompare(b.p.name));
  }, [people, moments, range]);

  const total = shares.reduce((s, x) => s + x.count, 0);
  // the sky above the wheel is made of the people below it
  const worlds = useMemo(() => skyMix(shares), [shares]);
  const topWorld = worlds[0] ?? null;

  const byId = new Map(shares.map((x) => [x.p.id, x]));
  const sel = picked ? byId.get(picked) : undefined;
  const focus = hover ?? sel?.p.id ?? null;
  const top = shares[0];

  return (
    <div class="page mind-page">
      {/* the same sky as the journal, its clouds coloured by the people you think of most */}
      <div class="journal-top mind-top" style={topWorld ? { '--sky': `var(--emo-${topWorld})` } : undefined}>
        <Sky world={topWorld} worlds={worlds} />
        <header class="page-head">
          <button class="back-link stats-back" onClick={() => goBack('people')}><Icon name="chevron-left" size={18} /> {t('People')}</button>
          <h1 class="title">{t('What’s on your mind')}</h1>
          <p class="subtitle">{t('Who takes up your thoughts, by how often you tag them in notes and check-ins, and how strongly you feel it.')}</p>
        </header>

        {people.length > 0 && (
          <div class="chips filters" role="toolbar" aria-label={t('Time range')}>
            {RANGES.map(([id, name]) => (
              <button class="chip" aria-pressed={range === id} onClick={() => { setRange(id); setPicked(null); }}>{name}</button>
            ))}
          </div>
        )}

        {people.length > 0 && <Wheel key={range} shares={shares.filter((x) => x.count)} focus={focus} picked={picked} onPick={setPicked} onHover={setHover} />}
      </div>

      {ready && !people.length && (
        <div class="empty">
          <h2 class="title-s">{t('An empty mind, for now')}</h2>
          <p>{t('Add the people who matter to you and tag them in notes and check-ins. The ones you think of most get the biggest slice of the wheel.')}</p>
          <button class="btn btn-primary" onClick={() => navigate('person/new')}><Icon name="user-plus" size={18} /> {t('Add a person')}</button>
        </div>
      )}

      {people.length > 0 && (
        sel ? (
          <div class="mind-card card" key={sel.p.id} style={{ '--c': sel.core ? `var(--emo-${sel.core})` : 'var(--ink-3)' }}>
            <Avatar p={sel.p} size={48} />
            <div class="mind-card-main">
              <div class="mind-card-name">{sel.p.name || t('Unnamed')}</div>
              <div class="mind-card-sub">
                {sel.count ? `${count(sel.count, 'moment', 'moments')} · ${t('last {date}', { date: lastSeen(sel.last!.date) })}` : t('Not in your notes lately')}
              </div>
              {sel.last && snippet(sel.last) && <q class="mind-card-quote">{snippet(sel.last)}</q>}
            </div>
            <div class="mind-card-pct">{pctOf(sel.share)}</div>
            <button class="icon-btn" onClick={() => navigate('person/' + sel.p.id)} aria-label={t('Open {name}', { name: sel.p.name })} title={t('Open')}><Icon name="chevron-right" /></button>
          </div>
        ) : (
          <p class="mind-summary">
            {total && top ? (
              <>
                {rich('{name} takes up {portion}{when}{hold}.', {
                  name: <b>{top.p.name || t('Unnamed')}</b>,
                  portion: portion(top.share),
                  when: range === 'all' ? '' : range === 'month' ? t(' this past month') : t(' this past year'),
                  hold: top.core ? `, ${HOLD[top.core]}` : '',
                })}
              </>
            ) : range === 'all' ? (
              t('Tag people in notes and check-ins, and the ones you think of most will fill the wheel.')
            ) : (
              t('No one tagged in this stretch of time. Try a longer range.')
            )}
          </p>
        )
      )}

      {total > 0 && (
        <section class="section">
          <h2 class="section-title">{t('Share of mind')}</h2>
          <div class="card list mind-list">
            {shares.map((x) => (
              <button
                class={`list-row action mind-row${focus === x.p.id ? ' on' : ''}`}
                style={{ '--c': x.core ? `var(--emo-${x.core})` : 'var(--ink-3)', '--w': x.share / (top?.share || 1) }}
                onClick={() => navigate('person/' + x.p.id)}
                onPointerEnter={(e) => e.pointerType === 'mouse' && setHover(x.p.id)}
                onPointerLeave={() => setHover(null)}
              >
                <Avatar p={x.p} size={34} />
                <span class="mind-row-main">
                  <span class="mind-row-name">{x.p.name || t('Unnamed')}</span>
                  <span class="mind-bar"><i /></span>
                </span>
                <span class="mind-row-pct">{x.count ? pctOf(x.share) : '—'}</span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

/* ---------- the wheel ---------- */

const SIZE = 320, C = SIZE / 2, R = 116, HOLE = 78, POP = 7;
const colorOf = (x: Share) => (x.core ? `var(--emo-${x.core})` : 'var(--ink-3)');
const at = (a: number, r: number) => [C + Math.sin(a) * r, C - Math.cos(a) * r] as const; // 0 = twelve o'clock, clockwise
const f = (n: number) => n.toFixed(2);

/** A ring segment from angle a0 to a1 (radians, clockwise from the top). */
function arc(a0: number, a1: number) {
  if (a1 - a0 >= Math.PI * 2 - 1e-6) {
    // a whole ring: two halves, since one arc can't start and end on the same point
    return `M${C} ${C - R}A${R} ${R} 0 1 1 ${C} ${C + R}A${R} ${R} 0 1 1 ${C} ${C - R}ZM${C} ${C - HOLE}A${HOLE} ${HOLE} 0 1 0 ${C} ${C + HOLE}A${HOLE} ${HOLE} 0 1 0 ${C} ${C - HOLE}Z`;
  }
  const big = a1 - a0 > Math.PI ? 1 : 0;
  const [x0, y0] = at(a0, R), [x1, y1] = at(a1, R), [x2, y2] = at(a1, HOLE), [x3, y3] = at(a0, HOLE);
  return `M${f(x0)} ${f(y0)}A${R} ${R} 0 ${big} 1 ${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}A${HOLE} ${HOLE} 0 ${big} 0 ${f(x3)} ${f(y3)}Z`;
}

/** Everyone you thought of in the range, as slices of one wheel; the biggest start at twelve o'clock. */
function Wheel({ shares, focus, picked, onPick, onHover }: {
  shares: Share[];
  focus: string | null;
  picked: string | null;
  onPick: (id: string | null) => void;
  onHover: (id: string | null) => void;
}) {
  const slices = useMemo(() => {
    let a = 0;
    return shares.map((x) => {
      const a0 = a, a1 = (a += x.share * Math.PI * 2), mid = (a0 + a1) / 2;
      return { x, d: arc(a0, a1), mid, big: a1 - a0 };
    });
  }, [shares]);
  const hero = shares.find((x) => x.p.id === focus) ?? shares[0];
  const toggle = (id: string) => onPick(picked === id ? null : id);
  const box = useRef<HTMLElement>(null);
  const [swept, setSwept] = useState(false);

  // the intro sweep is the only thing that needs the mask; once it is done the ring is painted without it
  useEffect(() => {
    const t = setTimeout(() => setSwept(true), 1300);
    return () => clearTimeout(t);
  }, []);

  // the slow motion rests while the wheel is scrolled out of sight
  useEffect(() => {
    const el = box.current;
    if (!el || !('IntersectionObserver' in window)) return;
    const io = new IntersectionObserver(([e]) => el.toggleAttribute('data-idle', !e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <figure class="wheel" ref={box} data-focus={focus ? '' : undefined} style={{ '--aura': hero ? colorOf(hero) : 'var(--ink-3)' }}>
      <svg class="wheel-art" viewBox={`0 0 ${SIZE} ${SIZE}`} role="group" aria-label={t('Share of your thoughts, by person')}>
        <defs>
          <mask id="wheel-sweep" maskUnits="userSpaceOnUse" x="0" y="0" width={SIZE} height={SIZE}>
            <circle class="wheel-sweep" cx={C} cy={C} r={(R + HOLE) / 2} pathLength={1} transform={`rotate(-90 ${C} ${C})`} />
          </mask>
        </defs>
        {!slices.length && <circle class="wheel-track" cx={C} cy={C} r={(R + HOLE) / 2} />}
        <g mask={swept ? undefined : 'url(#wheel-sweep)'}>
          {slices.map(({ x, d, mid }, i) => (
            // the group carries the heartbeat and the path the slow breathing, so the two never fight over one property
            <g key={x.p.id} class={hero?.p.id === x.p.id ? 'wheel-beat' : undefined}>
              <path
                class={`wheel-slice${focus === x.p.id ? ' on' : ''}`}
                d={d}
                style={{ '--c': colorOf(x), '--i': i, '--dx': `${f(Math.sin(mid) * POP)}px`, '--dy': `${f(-Math.cos(mid) * POP)}px` }}
                role="button"
                tabIndex={0}
                aria-label={`${x.p.name || t('Unnamed')}: ${pctOf(x.share)}, ${count(x.count, 'moment', 'moments')}`}
                aria-pressed={picked === x.p.id}
                onClick={() => toggle(x.p.id)}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), toggle(x.p.id))}
                onPointerEnter={(e) => e.pointerType === 'mouse' && onHover(x.p.id)}
                onPointerLeave={() => onHover(null)}
                onFocus={() => onHover(x.p.id)}
                onBlur={() => onHover(null)}
              />
            </g>
          ))}
        </g>
      </svg>
      {/* a soft light drifting around the ring, lit on one side and shaded on the other, on the compositor alone */}
      <div class="wheel-shine" aria-hidden="true" />

      {/* the people with the biggest slices sit just outside the wheel, next to their slice */}
      {slices.map(({ x, mid, big }, i) => {
        if (big < 0.34 || i > 9) return null;
        const [lx, ly] = at(mid, R + 21);
        return (
          <button
            class={`wheel-face${focus === x.p.id ? ' on' : ''}`}
            style={{ left: `${(lx / SIZE) * 100}%`, top: `${(ly / SIZE) * 100}%`, '--i': i, '--c': colorOf(x) }}
            onClick={() => toggle(x.p.id)}
            onPointerEnter={(e) => e.pointerType === 'mouse' && onHover(x.p.id)}
            onPointerLeave={() => onHover(null)}
            tabIndex={-1}
            aria-hidden="true"
          >
            <Avatar p={x.p} size={30} />
          </button>
        );
      })}

      {hero ? (
        <div class="wheel-hub" aria-live="polite">
          <span class="wheel-pct"><CountUp value={pctOf(hero.share)} /></span>
          <span class="wheel-name" key={hero.p.id}>{hero.p.name || t('Unnamed')}</span>
          <span class="wheel-sub" key={`${hero.p.id}:n`}>{count(hero.count, 'moment', 'moments')}</span>
        </div>
      ) : (
        <div class="wheel-hub"><span class="wheel-sub">{t('No one yet')}</span></div>
      )}
    </figure>
  );
}
