// Periods: stretches of your music, named as an era and given a feeling. The wave shows how many songs joined your
// records over time (by Spotify's date added); dragging across it picks the songs of that stretch, and the periods
// you made lie on it as coloured bands, named underneath.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { coreOf } from '../data/emotions';
import { formatDate, keyOf, rangeLabel } from '../lib/dates';
import { navigate } from '../lib/router';
import { MAX_PERSON_EMOTIONS, addedAt, deletePeriod, getPeriods, savePeriod, toast, type Period, type Song } from '../lib/store';
import { count, LOCALE, t } from '../lib/i18n';
import { EmotionChip, EmotionPicker } from './emotion';
import { Icon } from './icons';
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

/** Periods placed in lanes under the wave so that ones that overlap don't cover each other. */
function lanesOf(items: { p: Period; span: Span }[]) {
  const ends: number[] = [];
  return [...items].sort((a, b) => a.span.start - b.span.start).map((x) => {
    let lane = ends.findIndex((e) => e < x.span.start);
    if (lane < 0) lane = ends.length;
    ends[lane] = x.span.end;
    return { ...x, lane };
  });
}

/**
 * Songs joining your records over time, as a wave. Drag across it to pick a stretch (`onPick` gets its first and last
 * moment); a tap picks the week under it. The periods lie on it as bands and are named underneath.
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
  const byId = useMemo(() => new Map(songs.map((s) => [s.id, s])), [songs]);

  const wave = useMemo(() => {
    const times = songs.map(addedAt);
    const now = Date.now();
    let lo = Math.min(...times);
    const hi = Math.max(now, ...times);
    if (hi - lo < 8 * WEEK) lo = hi - 8 * WEEK;
    const n = Math.min(120, Math.max(16, Math.ceil((hi - lo) / WEEK)));
    const step = (hi - lo) / n;
    const counts = new Array(n).fill(0);
    for (const at of times) counts[Math.min(n - 1, Math.floor((at - lo) / step))]++;
    const top = Math.max(1, ...counts);
    // a square root: one big day of adding doesn't flatten the rest
    const y = (c: number) => H - 6 - Math.sqrt(c / top) * (H - 18);
    const pts: [number, number][] = counts.map((c, i) => [((i + 0.5) / n) * W, y(c)]);
    pts.unshift([0, pts[0][1]]);
    pts.push([W, pts[pts.length - 1][1]]);
    const line = smooth(pts);
    return { lo, hi, n, step, counts, line, area: `${line} L${W},${H} L0,${H} Z` };
  }, [songs]);

  const x = (at: number) => ((at - wave.lo) / (wave.hi - wave.lo)) * 100;
  const at = (f: number) => wave.lo + Math.min(1, Math.max(0, f)) * (wave.hi - wave.lo);
  const placed = useMemo(() => lanesOf(periods.flatMap((p) => {
    const span = spanOf(p, byId);
    return span ? [{ p, span }] : [];
  })), [periods, byId]);
  const lanes = placed.reduce((n, x) => Math.max(n, x.lane + 1), 0);

  const frac = (e: PointerEvent) => {
    const r = plot.current!.getBoundingClientRect();
    return (e.clientX - r.left) / r.width;
  };
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
      // a tap: the period under it, else that week
      const t0 = at(a);
      const hit = placed.find((x) => t0 >= x.span.start - (wave.step / 2) && t0 <= x.span.end + wave.step / 2);
      if (hit && onOpen) return onOpen(hit.p);
      const i = Math.min(wave.n - 1, Math.floor(a * wave.n));
      return onPick(wave.lo + i * wave.step, wave.lo + (i + 1) * wave.step);
    }
    onPick(at(a), at(b));
  };

  const ticks = [0, 1 / 3, 2 / 3].map((f) => at(f));
  const shown = drag ? { start: at(Math.min(...drag)), end: at(Math.max(...drag)) } : picked;
  const readout = hover !== null && !drag
    ? `${formatDate(wave.lo + hover * wave.step, { day: 'numeric', month: 'short', year: 'numeric' })} · ${count(wave.counts[hover], 'song', 'songs')}`
    : shown ? spanLabel({ ...shown, n: 0 }) : '';

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
          {placed.map(({ p, span }) => (
            <rect class="wave-band" x={(x(span.start) / 100) * W - 2} width={Math.max(4, ((x(span.end) - x(span.start)) / 100) * W + 4)} y="0" height={H} style={{ fill: periodColor(p) }} />
          ))}
          <path d={wave.area} fill="url(#wave-fill)" />
          <path d={wave.line} class="wave-line" />
          {shown && <rect class="wave-pick" x={(x(shown.start) / 100) * W} width={Math.max(3, ((x(shown.end) - x(shown.start)) / 100) * W)} y="0" height={H} />}
          {hover !== null && !drag && <line class="wave-hover" x1={((hover + 0.5) / wave.n) * W} x2={((hover + 0.5) / wave.n) * W} y1="0" y2={H} />}
        </svg>
      </div>
      {lanes > 0 && (
        <div class="wave-lanes" style={{ height: `${lanes * 22}px` }}>
          {placed.map(({ p, span, lane }) => (
            <button
              class="wave-period"
              style={{ left: `${x(span.start)}%`, width: `max(10px, ${x(span.end) - x(span.start)}%)`, top: `${lane * 22}px`, '--c': periodColor(p), '--paint': periodPaint(p) }}
              onClick={() => onOpen?.(p)}
              disabled={!onOpen}
              title={`${periodName(p)} · ${spanLabel(span)}`}
            >
              <span>{periodName(p)}</span>
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
