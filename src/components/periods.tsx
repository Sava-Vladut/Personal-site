// Periods: stretches of your music, named as an era and given a feeling. The wave shows how many songs joined your
// records over time (by Spotify's date added); dragging across it picks the songs of that stretch, and the periods
// you made lie on it as coloured bands, named underneath.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { coreOf } from '../data/emotions';
import { formatDate, keyOf, rangeLabel } from '../lib/dates';
import { navigate } from '../lib/router';
import { MAX_PERSON_EMOTIONS, addedAt, deletePeriod, getPeriods, savePeriod, toast, type Period, type Song } from '../lib/store';
import { count, LOCALE, t } from '../lib/i18n';
import { EmotionChip, EmotionPicker } from './emotion';
import { Icon, Sprite } from './icons';
import { smallArt } from './music';
import { Sheet } from './Sheet';

const DAY = 864e5;
const WEEK = 7 * DAY;

/* ---------- Spotify's own way of saying when and how long ---------- */

const relative = new Intl.RelativeTimeFormat(LOCALE, { numeric: 'auto' });
/** "3 days ago", "2 weeks ago", then the date, as Spotify's "Date added" column says it. */
export function addedLabel(ms: number, now = Date.now()) {
  const ago = now - ms;
  if (ago < 3600e3) return relative.format(-Math.max(1, Math.round(ago / 60e3)), 'minute');
  if (ago < DAY) return relative.format(-Math.round(ago / 3600e3), 'hour');
  if (ago < WEEK) return relative.format(-Math.round(ago / DAY), 'day');
  if (ago < 4 * WEEK) return relative.format(-Math.round(ago / WEEK), 'week');
  return formatDate(ms, { day: 'numeric', month: 'short', year: 'numeric' });
}
/** 3:07, or 1:02:44 */
export function duration(ms?: number) {
  if (!ms) return '';
  const s = Math.round(ms / 1000);
  const mm = Math.floor(s / 60) % 60, h = Math.floor(s / 3600);
  return `${h ? `${h}:${String(mm).padStart(2, '0')}` : mm}:${String(s % 60).padStart(2, '0')}`;
}

/* ---------- a period's span and colour ---------- */

export interface Span { start: number; end: number; n: number }
/**
 * When a period's songs joined, first to last, and how many of them are still in your records. Picked as a stretch of
 * the wave, it spans at least that stretch: from the day you dragged from, not from its first song.
 */
export function spanOf(p: Pick<Period, 'songs'> & Partial<Pick<Period, 'start' | 'end'>>, byId: Map<string, Song>): Span | null {
  let start = p.start ?? Infinity, end = p.end ?? -Infinity, n = 0;
  for (const id of p.songs) {
    const s = byId.get(id);
    if (!s) continue;
    const at = addedAt(s);
    if (at < start) start = at;
    if (at > end) end = at;
    n++;
  }
  return n ? { start, end, n } : null;
}
export const spanLabel = (s: Span) => rangeLabel(keyOf(new Date(s.start)), keyOf(new Date(s.end)));
/** Its main feeling's colour, or the page's own. */
export const periodColor = (p: Pick<Period, 'emotions'>) => (p.emotions[0] ? `var(--emo-${coreOf(p.emotions[0]).id})` : 'var(--accent, var(--emo-hope-interest))');
export const periodName = (p: Pick<Period, 'name'>) => p.name.trim() || t('Untitled period');

/** A gradient of a period's feelings, for its band and its card. */
export const periodPaint = (p: Pick<Period, 'emotions'>) =>
  p.emotions.length > 1 ? `linear-gradient(90deg, ${p.emotions.map((e) => `var(--emo-${coreOf(e).id})`).join(', ')})` : periodColor(p);

/* ---------- the wave ---------- */

const W = 1000;
const H = 120;

/** A smooth line through the points (Catmull-Rom as Béziers). */
function smooth(pts: [number, number][]) {
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const [p0, p1, p2, p3] = [pts[i - 1] ?? pts[i], pts[i], pts[i + 1], pts[i + 2] ?? pts[i + 1]];
    d += ` C${p1[0] + (p2[0] - p0[0]) / 6},${p1[1] + (p2[1] - p0[1]) / 6} ${p2[0] - (p3[0] - p1[0]) / 6},${p2[1] - (p3[1] - p1[1]) / 6} ${p2[0]},${p2[1]}`;
  }
  return d;
}

/**
 * Where time falls across the wave, as knots of a piecewise-linear map (time → 0–1). Each period's stretch is widened
 * to at least `min` of the width, so a few weeks stay visible on a wave of years; the rest of time shares what's left,
 * evenly. With no periods, it's a straight line.
 */
function warpOf(lo: number, hi: number, spans: Span[], min: number): [number, number][] {
  const parts = spans.map((s): [number, number] => {
    let a = Math.max(lo, s.start), b = Math.min(hi, s.end);
    if (b - a < DAY) [a, b] = [Math.max(lo, (a + b) / 2 - DAY / 2), Math.min(hi, (a + b) / 2 + DAY / 2)];
    return [a, b];
  }).filter(([a, b]) => b > a).sort((p, q) => p[0] - q[0]);
  // periods that overlap are widened as one
  const joined: [number, number][] = [];
  for (const [a, b] of parts) {
    const last = joined[joined.length - 1];
    if (last && a <= last[1]) last[1] = Math.max(last[1], b);
    else joined.push([a, b]);
  }
  if (!joined.length) return [[lo, 0], [hi, 1]];
  min = Math.min(min, 0.6 / joined.length);
  // widen the stretches too short for `min`; squeezing the rest can make more of them too short, so go again
  const wide = new Set<number>();
  let scale = 1 / (hi - lo);
  for (let grew = true; grew;) {
    grew = false;
    const rest = hi - lo - [...wide].reduce((sum, i) => sum + joined[i][1] - joined[i][0], 0);
    if (rest <= 0) return [[lo, 0], [hi, 1]];
    scale = (1 - wide.size * min) / rest;
    joined.forEach(([a, b], i) => {
      if (!wide.has(i) && (b - a) * scale < min) { wide.add(i); grew = true; }
    });
  }
  const knots: [number, number][] = [[lo, 0]];
  let f = 0, t0 = lo;
  joined.forEach(([a, b], i) => {
    if (a > t0) knots.push([a, (f += (a - t0) * scale)]);
    knots.push([b, (f += wide.has(i) ? min : (b - a) * scale)]);
    t0 = b;
  });
  if (hi > t0) knots.push([hi, 1]);
  knots[knots.length - 1][1] = 1;
  return knots;
}
/** Along the knots from one side's value to the other's (`from` 0: time to across, 1: across to time). */
function along(knots: [number, number][], v: number, from: 0 | 1) {
  const to = 1 - from;
  if (v <= knots[0][from]) return knots[0][to];
  for (let i = 1; i < knots.length; i++) {
    const [p, q] = [knots[i - 1], knots[i]];
    if (v <= q[from]) return q[from] === p[from] ? q[to] : p[to] + ((v - p[from]) / (q[from] - p[from])) * (q[to] - p[to]);
  }
  return knots[knots.length - 1][to];
}
/** How many of the sorted times come before `at`. */
function before(times: number[], at: number) {
  let a = 0, b = times.length;
  while (a < b) {
    const m = (a + b) >> 1;
    if (times[m] < at) a = m + 1;
    else b = m;
  }
  return a;
}

/** A name's widest pill, the gap between pills and a lane's height. */
const PILL = 180;
const GAP = 4;
const LANE = 22;
/** The feelings of a period, a sprite each (its first two worlds). */
const coresOf = (p: Period) => [...new Set(p.emotions.map((e) => coreOf(e)?.id).filter(Boolean))].slice(0, 2) as string[];

/**
 * Each period's name under the wave: as wide as its band or its name, whichever is wider, centred on the band and
 * kept inside the wave, in the first lane where it clears the names before it, so names never cover each other.
 */
function pillsOf<T extends { a: number; b: number }>(items: T[], width: number, need: (x: T) => number) {
  const ends: number[] = [];
  return items.map((x) => {
    const w = Math.min(width, Math.max((x.b - x.a) * width, Math.min(PILL, need(x))));
    return { ...x, w, left: Math.min(width - w, Math.max(0, ((x.a + x.b) / 2) * width - w / 2)) };
  }).sort((m, n) => m.left - n.left).map((x) => {
    let lane = ends.findIndex((e) => e + GAP <= x.left);
    if (lane < 0) lane = ends.length;
    ends[lane] = x.left + x.w;
    return { ...x, lane };
  });
}

/**
 * Songs joining your records over time, as a wave. Drag across it to pick a stretch (`onPick` gets its first and last
 * moment); a tap picks the stretch under it. The periods lie on it as bands, widened when short so they stay readable
 * on a wave of years, with their feelings riding the line, and are named underneath.
 */
export function MusicWave({ songs, periods, picked, onPick, onOpen }: {
  songs: Song[];
  periods: Period[];
  /** the stretch the picked songs span, shown on the wave */
  picked?: Span | null;
  onPick?: (from: number, to: number) => void;
  onOpen?: (p: Period) => void;
}) {
  const plot = useRef<HTMLDivElement>(null);
  // where the drag began and is now (0–1 across), drawn from `drag`; `dragging` holds the same at once, as events come
  // in faster than the wave redraws
  const [drag, setDrag] = useState<[number, number] | null>(null);
  const dragging = useRef<[number, number] | null>(null);
  const [hover, setHover] = useState<number | null>(null);
  // the period whose name is pointed at or focused
  const [lit, setLit] = useState<string | null>(null);
  const [width, setWidth] = useState(0);
  // each name's own width, measured once drawn (a guess until then)
  const [textW, setTextW] = useState<Record<string, number>>({});
  const names = useRef(new Map<string, HTMLSpanElement>());
  const byId = useMemo(() => new Map(songs.map((s) => [s.id, s])), [songs]);

  useEffect(() => {
    const el = plot.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const range = useMemo(() => {
    const times = songs.map(addedAt).sort((a, b) => a - b);
    let lo = times[0];
    const hi = Math.max(Date.now(), times[times.length - 1]);
    if (hi - lo < 8 * WEEK) lo = hi - 8 * WEEK;
    const n = Math.min(120, Math.max(16, Math.ceil((hi - lo) / WEEK)));
    return { times, lo, hi, n, step: (hi - lo) / n };
  }, [songs]);
  const spans = useMemo(() => periods.flatMap((p) => {
    const span = spanOf(p, byId);
    return span ? [{ p, span }] : [];
  }), [periods, byId]);
  // a short period gets at least 5% of the wave, and never less than a readable 44px
  const knots = useMemo(() => warpOf(range.lo, range.hi, spans.map((x) => x.span), Math.max(0.05, 44 / (width || 900))), [range, spans, width]);
  const across = (at: number) => along(knots, at, 0);
  const at = (f: number) => along(knots, Math.min(1, Math.max(0, f)), 1);
  const x = (ms: number) => across(ms) * 100;

  const wave = useMemo(() => {
    const { times, n, step, hi } = range;
    // the wave is cut into even slices across; a widened stretch has shorter slices of time, so it shows finer detail
    const from = Array.from({ length: n + 1 }, (_, i) => along(knots, i / n, 1));
    const counts = from.slice(0, n).map((a, i) => before(times, i === n - 1 ? hi + 1 : from[i + 1]) - before(times, a));
    // how fast songs joined around each slice (per even step), over at least a week, so short slices aren't spiky
    const rates = from.slice(0, n).map((a, i) => {
      const w = Math.max(from[i + 1] - a, Math.min(WEEK, step)), c = (a + from[i + 1]) / 2;
      return ((before(times, c + w / 2) - before(times, c - w / 2)) / w) * step;
    });
    const top = Math.max(1, ...rates);
    // a square root: one big day of adding doesn't flatten the rest
    const ys = rates.map((r) => H - 6 - Math.sqrt(r / top) * (H - 18));
    const pts: [number, number][] = ys.map((y, i) => [((i + 0.5) / n) * W, y]);
    pts.unshift([0, pts[0][1]]);
    pts.push([W, pts[pts.length - 1][1]]);
    const line = smooth(pts);
    return { n, from, counts, ys, line, area: `${line} L${W},${H} L0,${H} Z` };
  }, [range, knots]);

  // where each period lies across (0–1), and its name's pill under the wave
  const bands = spans.map((s) => ({ ...s, a: across(s.span.start), b: across(s.span.end), cores: coresOf(s.p) }));
  const pills = pillsOf(bands, width || 900, (x) => (textW[x.p.id] ?? periodName(x.p).length * 6.5) + 14 + x.cores.length * 15);
  const lanes = pills.reduce((n, x) => Math.max(n, x.lane + 1), 0);
  useLayoutEffect(() => {
    const next: Record<string, number> = {};
    let changed = false;
    for (const [id, el] of names.current) {
      next[id] = el.scrollWidth;
      if (Math.abs((textW[id] ?? -1) - next[id]) > 0.5) changed = true;
    }
    if (changed) setTextW(next);
  });

  const frac = (e: PointerEvent) => {
    const r = plot.current!.getBoundingClientRect();
    return (e.clientX - r.left) / r.width;
  };
  // the period under a point across, with a little room either side for a thumb
  const bandAt = (f: number) => bands.find((x) => f >= x.a - 0.006 && f <= x.b + 0.006);
  const down = (e: PointerEvent) => {
    if (!onPick || e.button !== 0) return;
    plot.current!.setPointerCapture(e.pointerId);
    const f = frac(e);
    dragging.current = [f, f];
    setDrag([f, f]);
  };
  const move = (e: PointerEvent) => {
    const f = frac(e);
    if (dragging.current) setDrag((dragging.current = [dragging.current[0], f]));
    setHover(Math.min(wave.n - 1, Math.max(0, Math.floor(f * wave.n))));
  };
  const up = (e: PointerEvent) => {
    const d = dragging.current;
    dragging.current = null;
    setDrag(null);
    if (!d || !onPick) return;
    // the end is where the pointer let go, not where the wave last drew it
    const f = Math.min(1, Math.max(0, frac(e)));
    const a0 = Math.min(1, Math.max(0, d[0]));
    const [a, b] = [Math.min(a0, f), Math.max(a0, f)];
    if (b - a < 0.01) {
      // a tap: the period under it, else that slice of the wave
      const hit = bandAt(a);
      if (hit && onOpen) return onOpen(hit.p);
      const i = Math.min(wave.n - 1, Math.floor(a * wave.n));
      return onPick(wave.from[i], wave.from[i + 1]);
    }
    onPick(at(a), at(b));
  };

  const ticks = [0, 1 / 3, 2 / 3].map((f) => at(f));
  const shown = drag ? { start: at(Math.min(...drag)), end: at(Math.max(...drag)) } : picked;
  const under = hover !== null && !drag ? bandAt((hover + 0.5) / wave.n) : undefined;
  const pointed = lit ? bands.find((x) => x.p.id === lit) : undefined;
  const readout = pointed && !drag
    ? `${periodName(pointed.p)} · ${spanLabel(pointed.span)}`
    : hover !== null && !drag
      ? [under && periodName(under.p), formatDate(wave.from[hover], { day: 'numeric', month: 'short', year: 'numeric' }), count(wave.counts[hover], 'song', 'songs')].filter(Boolean).join(' · ')
      : shown ? spanLabel({ ...shown, n: 0 }) : '';
  const isLit = (p: Period) => p.id === lit || p.id === under?.p.id;

  return (
    <div class="wave">
      <div class="wave-readout" aria-live="polite">{readout}</div>
      <div
        ref={plot}
        class={`wave-plot${onPick ? ' is-live' : ''}`}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={() => { dragging.current = null; setDrag(null); }}
        onPointerLeave={() => setHover(null)}
        role={onPick ? 'img' : undefined}
        aria-label={t('Songs added over time. Drag across it to pick a period.')}
      >
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
          <defs>
            <linearGradient id="wave-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stop-color="var(--wave)" stop-opacity="0.55" />
              <stop offset="1" stop-color="var(--wave)" stop-opacity="0.04" />
            </linearGradient>
          </defs>
          {bands.map(({ p, a, b }) => (
            <rect class={`wave-band${isLit(p) ? ' is-lit' : ''}`} x={a * W} width={Math.max(4, (b - a) * W)} y="0" height={H} style={{ fill: periodColor(p) }} />
          ))}
          <path d={wave.area} fill="url(#wave-fill)" />
          <path d={wave.line} class="wave-line" />
          {shown && <rect class="wave-pick" x={(x(shown.start) / 100) * W} width={Math.max(3, ((x(shown.end) - x(shown.start)) / 100) * W)} y="0" height={H} />}
          {hover !== null && !drag && <line class="wave-hover" x1={((hover + 0.5) / wave.n) * W} x2={((hover + 0.5) / wave.n) * W} y1="0" y2={H} />}
        </svg>
        {bands.map(({ p, a, b, cores }) => {
          if (!cores.length) return null;
          // its feelings ride the line, just above the wave at the band's middle
          const y = wave.ys[Math.min(wave.n - 1, Math.floor(((a + b) / 2) * wave.n))];
          return (
            <span class={`wave-emo${isLit(p) ? ' is-lit' : ''}`} style={{ left: `${((a + b) / 2) * 100}%`, top: `max(4px, calc(${(y / H) * 100}% - 22px))` }} aria-hidden="true">
              {cores.map((c, i) => <Sprite core={c} size={16} idle={isLit(p)} delay={i * 180} />)}
            </span>
          );
        })}
      </div>
      {lanes > 0 && (
        <div class="wave-lanes" style={{ height: `${lanes * LANE}px` }}>
          {pills.map(({ p, span, a, b, cores, left, w, lane }) => (
            <button
              class={`wave-period${isLit(p) ? ' is-lit' : ''}`}
              style={{
                left: `${left}px`, width: `${w}px`, top: `${lane * LANE}px`, '--c': periodColor(p), '--paint': periodPaint(p),
                // the band's own stretch, marked along the pill's foot when the name is wider than the band
                '--from': `${a * (width || 900) - left}px`, '--span': `${Math.max(4, (b - a) * (width || 900))}px`,
              }}
              onClick={() => onOpen?.(p)}
              onPointerEnter={() => setLit(p.id)}
              onPointerLeave={() => setLit(null)}
              onFocus={() => setLit(p.id)}
              onBlur={() => setLit(null)}
              disabled={!onOpen}
              title={`${periodName(p)} · ${spanLabel(span)}`}
              aria-label={`${periodName(p)}, ${spanLabel(span)}`}
            >
              {cores.map((c) => <Sprite core={c} size={11} />)}
              <span ref={(el) => { if (el) names.current.set(p.id, el); else names.current.delete(p.id); }}>{periodName(p)}</span>
            </button>
          ))}
        </div>
      )}
      <div class="wave-axis" aria-hidden="true">
        {ticks.map((ms) => <span>{formatDate(ms, { month: 'short', year: 'numeric' })}</span>)}
        <span>{t('Now')}</span>
      </div>
    </div>
  );
}

/* ---------- a period: made from picked songs, or opened to change ---------- */

/** A few of its covers, overlapping. */
export const Covers = ({ songs, n = 4 }: { songs: Song[]; n?: number }) => (
  <span class="period-covers" aria-hidden="true">
    {songs.slice(0, n).map((s) => (s.music.image ? <img src={smallArt(s.music.image)} alt="" loading="lazy" referrerpolicy="no-referrer" /> : <i />))}
  </span>
);

/**
 * Names a period, says how it felt and what that time was like. `period` is a new one (from the picked songs) or one
 * you made; `onShow` lists its songs on the page.
 */
export function PeriodSheet({ period, songs, onClose, onSaved, onShow }: {
  period: Period | null;
  songs: Song[];
  onClose: () => void;
  onSaved?: () => void;
  onShow?: (p: Period) => void;
}) {
  const [draft, setDraft] = useState<Period | null>(period);
  const [picking, setPicking] = useState(false);
  const isNew = useRef(false);
  useEffect(() => {
    if (!period) return;
    setDraft(period);
    setPicking(false);
    isNew.current = !getPeriods().some((x) => x.id === period.id);
  }, [period?.id]);

  const byId = useMemo(() => new Map(songs.map((s) => [s.id, s])), [songs]);
  if (!draft) return <Sheet open={false} onClose={onClose}>{null}</Sheet>;
  const list = draft.songs.map((id) => byId.get(id)).filter((s): s is Song => !!s).sort((a, b) => addedAt(b) - addedAt(a));
  const span = spanOf(draft, byId);
  const update = (patch: Partial<Period>) => setDraft({ ...draft, ...patch });

  const save = async () => {
    try {
      await savePeriod({ ...draft, name: draft.name.trim() });
      toast(isNew.current ? t('Period saved') : t('Period updated'));
      onSaved?.();
      onClose();
    } catch {
      toast(t('Couldn’t save this period. Try again.'));
    }
  };
  const remove = async () => {
    const gone = await deletePeriod(draft.id);
    onClose();
    if (gone) toast(t('Period deleted'), { label: t('Undo'), run: () => savePeriod(gone) });
  };
  const addEmotion = (eid: string) => {
    const kept = draft.emotions.filter((x) => x !== eid && !eid.startsWith(x + '/') && !x.startsWith(eid + '/'));
    update({ emotions: [...kept, eid].slice(-MAX_PERSON_EMOTIONS) });
    setPicking(false);
  };

  return (
    <Sheet
      open={!!period}
      onClose={onClose}
      tall
      class="period-sheet"
      label={t('Period')}
      title={picking ? t('How did this time feel?') : isNew.current ? t('New period') : periodName(draft)}
      footer={picking ? (
        <button class="btn btn-quiet grow" onClick={() => setPicking(false)}>{t('Back')}</button>
      ) : (
        <>
          {!isNew.current && <button class="btn btn-quiet" onClick={remove} aria-label={t('Delete period')}><Icon name="trash" size={18} /></button>}
          <button class="btn btn-primary grow" onClick={save} disabled={!list.length}>{isNew.current ? t('Save period') : t('Save')}</button>
        </>
      )}
    >
      {picking ? (
        <EmotionPicker onPick={addEmotion} selected={draft.emotions} />
      ) : (
        <div class="period-form" style={{ '--c': periodColor(draft), '--paint': periodPaint(draft) }}>
          <div class="period-hero">
            <Covers songs={list} />
            <span class="period-hero-text">
              <b>{count(list.length, 'song', 'songs')}</b>
              {span && <span>{spanLabel(span)}</span>}
            </span>
          </div>

          <label class="field-label" for="period-name">{t('What was this era?')}</label>
          <input
            id="period-name"
            class="input"
            value={draft.name}
            maxLength={120}
            autofocus={isNew.current}
            placeholder={t('The summer of…, Getting over it, First year in the city…')}
            onInput={(e) => update({ name: e.currentTarget.value })}
          />

          <div class="field-label">{t('How it felt')}</div>
          <div class="meta person-meta">
            {draft.emotions.map((eid) => <EmotionChip id={eid} onRemove={() => update({ emotions: draft.emotions.filter((x) => x !== eid) })} />)}
            {draft.emotions.length < MAX_PERSON_EMOTIONS && (
              <button class="chip" onClick={() => setPicking(true)}>
                <Icon name="mood-plus" size={16} /> {draft.emotions.length ? t('Add') : t('Add a feeling')}
              </button>
            )}
          </div>

          <label class="field-label" for="period-text">{t('What was going on')}</label>
          <textarea
            id="period-text"
            class="input period-text"
            rows={4}
            value={draft.text}
            placeholder={t('Where you were, who was around, why these songs…')}
            onInput={(e) => update({ text: e.currentTarget.value })}
          />

          <div class="row between period-songs-head">
            <div class="field-label">{t('Songs')}</div>
            {!isNew.current && onShow && <button class="btn btn-quiet btn-s" onClick={() => { onShow(draft); onClose(); }}><Icon name="list" size={16} /> {t('Show in your records')}</button>}
          </div>
          <div class="tracks period-songs">
            {list.map((s) => (
              <div key={s.id} class="track">
                <span class="period-song-art">{s.music.image && <img src={smallArt(s.music.image)} alt="" loading="lazy" referrerpolicy="no-referrer" />}</span>
                <button class="track-main" onClick={() => { onClose(); navigate('song/' + s.id); }}>
                  <span class="track-title">{s.music.title}</span>
                  <span class="track-sub">{s.music.sub} · {addedLabel(addedAt(s))}</span>
                </button>
                <button class="icon-btn" onClick={() => update({ songs: draft.songs.filter((x) => x !== s.id) })} aria-label={`${t('Take out of the period')}: ${s.music.title}`} title={t('Take out of the period')}>
                  <Icon name="x" size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </Sheet>
  );
}

/** Your periods, newest first, as cards you open. */
export function PeriodList({ periods, songs, onOpen }: { periods: Period[]; songs: Song[]; onOpen: (p: Period) => void }) {
  const byId = useMemo(() => new Map(songs.map((s) => [s.id, s])), [songs]);
  const items = useMemo(() => periods
    .map((p) => ({ p, span: spanOf(p, byId), list: p.songs.map((id) => byId.get(id)).filter((s): s is Song => !!s) }))
    .sort((a, b) => (b.span?.end ?? 0) - (a.span?.end ?? 0)), [periods, byId]);
  return (
    <div class="period-list" role="list">
      {items.map(({ p, span, list }) => (
        <button role="listitem" class="period-card" style={{ '--c': periodColor(p), '--paint': periodPaint(p) }} onClick={() => onOpen(p)}>
          <Covers songs={list} n={3} />
          <span class="period-card-text">
            <b>{periodName(p)}</b>
            <span>{span ? `${spanLabel(span)} · ${count(span.n, 'song', 'songs')}` : t('No songs left')}</span>
          </span>
        </button>
      ))}
    </div>
  );
}
