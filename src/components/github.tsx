// The pieces the GitHub pages share: a scrolling list of commits that loads more as you reach its end, a small
// line of weekly commits, the languages as bars, commits over time as bars, and a grid of every day's commits.
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { addDays, dayLabel, keyOf, shortDate, startOfWeek, timeLabel, todayKey, WEEKDAYS } from '../lib/dates';
import { commitPage, commitUrl, type Bucket, type Commit, type Profile, type Step } from '../lib/github';
import { getSettings, type Todo } from '../lib/store';
import { ChartCard, HeatLegend, RhythmHeatmap, TipRow, tipProps, useWidth } from './charts';
import { Icon } from './icons';
import { LOCALE, count, t } from '../lib/i18n';

const num = (n: number) => n.toLocaleString(LOCALE);

/** The page wears GitHub green; charts and tooltips read the accent from the root. */
export function useAccent(world = 'calm-safety') {
  useLayoutEffect(() => {
    const root = document.documentElement.style;
    root.setProperty('--accent', `var(--emo-${world})`);
    return () => root.removeProperty('--accent');
  }, [world]);
}

/** "just now", "5 min ago", "3 h ago", "2 days ago", then the date. */
export function ago(ms: number, now = Date.now()) {
  const s = (now - ms) / 1000;
  if (s < 90) return t('just now');
  if (s < 3600) return t('{n} min ago', { n: Math.round(s / 60) });
  if (s < 86400) return t('{n} h ago', { n: Math.round(s / 3600) });
  if (s < 7 * 86400) return t('{n} ago', { n: count(Math.round(s / 86400), 'day', 'days') });
  return shortDate(keyOf(new Date(ms)));
}

/**
 * Commits, newest first, under a heading for each day; it loads the next page as you scroll near the end.
 * `repo`: one project's, or null for every project's.
 */
export function CommitList({ repo, profile, total }: { repo: string | null; profile: Profile | null; total: number }) {
  const [list, setList] = useState<Commit[]>([]);
  const [next, setNext] = useState<number | null>(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const box = useRef<HTMLDivElement>(null);
  const end = useRef<HTMLDivElement>(null);
  const loading = useRef(false);
  const alive = useRef(true);
  useEffect(() => () => void (alive.current = false), []);

  const more = async () => {
    if (loading.current || next === null) return;
    loading.current = true;
    setBusy(true);
    try {
      const p = await commitPage(repo, next);
      if (!alive.current) return;
      setList((l) => [...l, ...p.commits]);
      setNext(p.next);
      setError('');
    } catch (e) {
      if (alive.current) setError(t((e as Error).message));
    } finally {
      loading.current = false;
      if (alive.current) setBusy(false);
    }
  };
  const latest = useRef(more);
  latest.current = more;

  // the end of the list coming near (or still in view after a page) asks for the next page
  useEffect(() => {
    if (next === null || error || !box.current || !end.current) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && latest.current(), { root: box.current, rootMargin: '0px 0px 200px 0px' });
    io.observe(end.current);
    return () => io.disconnect();
  }, [list.length, next, error]);

  const groups = useMemo(() => {
    const out: [string, Commit[], number][] = [];
    list.forEach((c, i) => {
      const k = keyOf(new Date(c.at));
      const last = out[out.length - 1];
      if (last && last[0] === k) last[1].push(c);
      else out.push([k, [c], i]);
    });
    return out;
  }, [list]);

  return (
    <div class="pj-commits" ref={box} tabIndex={0} aria-label={t('Commits')}>
      {groups.map(([day, cs, first]) => (
        <section class="pj-day">
          <h4 class="pj-day-head">
            <span>{dayLabel(day)}</span>
            <small>{count(cs.length, 'commit', 'commits')}</small>
          </h4>
          <ol>
            {cs.map((c, i) => (
              <li style={{ '--k': Math.min(12, (first + i) % 40) }}>
                <a class="pj-commit" href={commitUrl(profile, c)} target="_blank" rel="noopener noreferrer">
                  <span class="pj-commit-dot" aria-hidden="true" />
                  <span class="pj-commit-text">
                    <b>{c.m || t('(no message)')}</b>
                    <small>
                      {!repo && <span class="pj-commit-repo">{c.repo}</span>}
                      <code>{c.sha.slice(0, 7)}</code>
                      <span>{timeLabel(c.at)}</span>
                    </small>
                  </span>
                </a>
              </li>
            ))}
          </ol>
        </section>
      ))}
      <div ref={end} class="pj-commits-end">
        {error ? (
          <button class="btn btn-quiet btn-s" onClick={() => { setError(''); void more(); }}><Icon name="refresh" size={15} /> {t('Try again')}</button>
        ) : busy || next !== null ? (
          <span class="pj-loading"><Icon name="loader-2" size={16} /> {t('Loading…')}</span>
        ) : list.length ? (
          t('That’s all {n}', { n: num(total || list.length) })
        ) : (
          t('No commits yet.')
        )}
      </div>
    </div>
  );
}

/** A project's last weeks, as small bars. */
export function Spark({ values, label }: { values: number[]; label: string }) {
  const max = Math.max(1, ...values);
  const W = 4, G = 2, H = 22;
  return (
    <svg class="pj-spark" width={values.length * (W + G) - G} height={H} viewBox={`0 0 ${values.length * (W + G) - G} ${H}`} role="img" aria-label={label}>
      {values.map((v, i) => {
        const h = v ? Math.max(3, (v / max) * H) : 2;
        return <rect x={i * (W + G)} y={H - h} width={W} height={h} rx={1.5} class={v ? '' : 'none'} style={{ '--k': i }} />;
      })}
    </svg>
  );
}

/** Languages by how much code is in each, biggest first. */
export function LanguageBars({ rows, limit = 6 }: { rows: { name: string; bytes: number; share: number }[]; limit?: number }) {
  const shown = rows.slice(0, limit);
  const rest = rows.slice(limit).reduce((s, r) => s + r.share, 0);
  const list = rest > 0 ? [...shown, { name: t('Other'), bytes: 0, share: rest }] : shown;
  const max = Math.max(...list.map((r) => r.share), 0.0001);
  return (
    <ul class="tw-bars pj-langs">
      {list.map((r, i) => (
        <li style={{ '--k': i, '--w': `${(r.share / max) * 100}%` }}>
          <span class="tw-bar-label"><Icon name="code" size={15} stroke={2} /> {r.name}</span>
          <span class="tw-bar"><i /></span>
          <b>{r.share >= 0.1 ? Math.round(r.share * 100) : (r.share * 100).toFixed(1)}%</b>
        </li>
      ))}
    </ul>
  );
}

const MONTH = (k: string) => new Date(+k.slice(0, 4), +k.slice(5, 7) - 1, 1).toLocaleDateString(LOCALE, { month: 'short', year: '2-digit' });
/** What a bucket's bar is called: the day, the week it starts, or the month. */
export const bucketName = (b: Bucket, step: Step) =>
  step === 'day' ? shortDate(b.key) : step === 'week' ? t('Week of {date}', { date: shortDate(b.key) }) : MONTH(b.key);

/** Commits per day, week or month, as bars. */
export function CommitBars({ rows, step, title, sub }: { rows: Bucket[]; step: Step; title: string; sub: string }) {
  return (
    <ChartCard title={title} sub={sub} table={{ head: [step === 'month' ? t('Month') : step === 'week' ? t('Week') : t('Day'), t('Commits')], rows: rows.filter((r) => r.n).map((r) => [bucketName(r, step), r.n]).reverse() }}>
      <Bars rows={rows} step={step} label={`${title}: ${sub}`} />
    </ChartCard>
  );
}

function Bars({ rows, step, label }: { rows: Bucket[]; step: Step; label: string }) {
  const [ref, W] = useWidth();
  const H = 150, L = 26, R = 4, T = 10, B = 22;
  const n = rows.length;
  const max = Math.max(1, ...rows.map((r) => r.n));
  const top = max <= 4 ? max : Math.ceil(max / 4) * 4;
  const pw = Math.max(0, W - L - R), ph = H - T - B;
  const band = pw / Math.max(1, n);
  const bw = Math.max(1.5, Math.min(22, band - (band > 6 ? 2 : 0.8)));
  const y = (v: number) => T + ph - (v / top) * ph;
  const ticks = n > 1 ? [0, Math.floor((n - 1) / 2), n - 1] : [0];
  const tick = (i: number) => (step === 'month' ? MONTH(rows[i].key) : shortDate(rows[i].key));
  return (
    <div ref={ref} class="chart">
      {W > 0 && (
        <svg width={W} height={H} role="img" aria-label={label}>
          {[top, top / 2, 0].map((v) => (
            <>
              <line x1={L} x2={L + pw} y1={y(v)} y2={y(v)} class="grid" />
              <text x={L - 6} y={y(v) + 4} class="tick" text-anchor="end">{Number.isInteger(v) ? v : ''}</text>
            </>
          ))}
          {rows.map((r, i) => {
            const x = L + i * band + (band - bw) / 2;
            const h = r.n ? Math.max(2, (r.n / top) * ph) : 0;
            return (
              <g class="mark pj-bar" style={{ '--t': (n > 1 ? i / (n - 1) : 0).toFixed(3) }} {...tipProps(() => (
                <>
                  <div class="tip-title">{bucketName(r, step)}</div>
                  <TipRow value={num(r.n)} label={r.n === 1 ? t('commit') : t('commits')} color="var(--accent)" />
                </>
              ), `${bucketName(r, step)}: ${r.n}`)}>
                <rect x={L + i * band} y={T} width={band} height={ph} fill="transparent" />
                {h > 0 && <rect x={x} y={T + ph - h} width={bw} height={h} rx={Math.min(4, bw / 2)} class="pj-bar-fill" />}
              </g>
            );
          })}
          {ticks.map((i) => (
            <text x={L + i * band + band / 2} y={H - 6} class="tick" text-anchor={i === 0 && n > 1 ? 'start' : i === n - 1 && n > 1 ? 'end' : 'middle'}>{tick(i)}</text>
          ))}
        </svg>
      )}
    </div>
  );
}

/**
 * Every day's commits as a grid, a column a week, as many weeks as fit the card (up to a year), today at the right.
 */
export function ActivityGrid({ days }: { days: Map<string, number> }) {
  const today = todayKey();
  const yearAgo = addDays(today, -370);
  return (
    <ChartCard
      title={t('Activity')}
      sub={t('Each square is a day')}
      legend={<HeatLegend />}
      table={{ head: [t('Day'), t('Commits')], rows: [...days].filter(([k]) => k >= yearAgo && k <= today).sort((a, b) => (a[0] < b[0] ? 1 : -1)).map(([k, v]) => [shortDate(k), v]) }}
    >
      <Grid days={days} />
    </ChartCard>
  );
}

function Grid({ days }: { days: Map<string, number> }) {
  const [ref, W] = useWidth();
  const weekStart = getSettings().weekStart;
  const CELL = 15; // a cell and its gap
  const weeks = Math.max(8, Math.min(53, Math.floor((W - 26) / CELL)));
  const today = todayKey();
  const first = addDays(startOfWeek(today, weekStart), -(weeks - 1) * 7);
  const cols = useMemo(() => Array.from({ length: weeks }, (_, w) => Array.from({ length: 7 }, (_, d) => addDays(first, w * 7 + d))), [first, weeks]);
  const max = Math.max(1, ...cols.flat().map((k) => days.get(k) ?? 0));
  const step = (v: number) => (v === 0 ? 0 : Math.min(5, Math.ceil((v / max) * 5)));
  const total = cols.flat().reduce((s, k) => s + (days.get(k) ?? 0), 0);
  const names = weekStart === 1 ? WEEKDAYS : [WEEKDAYS[6], ...WEEKDAYS.slice(0, 6)];
  // a month's name over the week it starts in, when there's room for it
  const months = cols.map((c, i) => (i > 0 && c[0].slice(5, 7) !== cols[i - 1][0].slice(5, 7) && i < weeks - 1 ? new Date(+c[0].slice(0, 4), +c[0].slice(5, 7) - 1, 1).toLocaleDateString(LOCALE, { month: 'short' }) : ''));
  return (
    <div ref={ref} class="pj-grid-wrap">
      {W > 0 && (
        <>
          <div class="pj-grid" style={{ '--weeks': weeks }}>
            <span />
            {months.map((m, i) => <span class="tick-html pj-month" style={{ gridColumn: i + 2, gridRow: 1 }}>{m}</span>)}
            {names.map((name, d) => (
              <>
                <span class="tick-html left" style={{ gridColumn: 1, gridRow: d + 2 }}>{d % 2 === 0 ? name.slice(0, 2) : ''}</span>
                {cols.map((c, w) => {
                  const k = c[d];
                  if (k > today) return <span class="pj-cell later" style={{ gridColumn: w + 2, gridRow: d + 2 }} />;
                  const v = days.get(k) ?? 0;
                  return (
                    <span
                      class={`heat-cell pj-cell s${step(v)}`}
                      style={{ gridColumn: w + 2, gridRow: d + 2, '--t': ((w * 7 + d) / (weeks * 7)).toFixed(3) }}
                      {...tipProps(() => <TipRow value={num(v)} label={`${v === 1 ? t('commit') : t('commits')} · ${dayLabel(k)}`} color="var(--accent)" />, `${dayLabel(k)}: ${v}`)}
                    />
                  );
                })}
              </>
            ))}
          </div>
          <p class="pj-grid-note">{t('{n} in the last {weeks} weeks', { n: count(total, 'commit', 'commits'), weeks })}</p>
        </>
      )}
    </div>
  );
}

/** When the commits were made: weekday by time of day. */
export function RhythmCard({ heat, sub }: { heat: number[][]; sub: string }) {
  const max = Math.max(1, ...heat.flat());
  return (
    <ChartCard
      title={t('When you code')}
      sub={sub}
      legend={<HeatLegend />}
      table={{ head: [t('Day'), '0–6h', '6–12h', '12–18h', '18–24h'], rows: heat.map((r, d) => [WEEKDAYS[d], r[0] + r[1], r[2] + r[3], r[4] + r[5], r[6] + r[7]]) }}
    >
      <RhythmHeatmap heat={heat} max={max} />
    </ChartCard>
  );
}

/**
 * A to-do with its box to tick. Ticked in a list that only shows what's open, it stays a moment, crossed out,
 * before it goes (`linger`). With `onText` its words can be changed in place; emptied, it's removed.
 */
export function TodoItem({ x, onToggle, onText, onRemove, linger, k = 0 }: {
  x: Todo;
  onToggle: () => void;
  onText?: (text: string) => void;
  onRemove?: () => void;
  linger?: boolean;
  k?: number;
}) {
  const [ticked, setTicked] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => clearTimeout(timer.current), []);
  const done = !!x.done || ticked;
  const toggle = () => {
    if (!linger || x.done) return onToggle();
    if (ticked) {
      clearTimeout(timer.current);
      return setTicked(false);
    }
    setTicked(true);
    timer.current = setTimeout(onToggle, 650);
  };
  return (
    <li class={`pj-todo${done ? ' is-done' : ''}`} style={{ '--k': k }}>
      <button class="pj-check" role="checkbox" aria-checked={done} aria-label={done ? t('Mark as not done') : t('Mark as done')} onClick={toggle}>
        <Icon name="check" size={13} stroke={3} />
      </button>
      {onText ? (
        <input
          class="pj-todo-text"
          value={x.text}
          maxLength={500}
          aria-label={t('To-do')}
          onInput={(e) => onText(e.currentTarget.value)}
          onBlur={(e) => !e.currentTarget.value.trim() && onRemove?.()}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        />
      ) : (
        <span class="pj-todo-text">{x.text}</span>
      )}
      {onRemove && (
        <button class="icon-btn small pj-todo-x" aria-label={t('Remove')} onClick={onRemove}><Icon name="x" size={15} /></button>
      )}
    </li>
  );
}
