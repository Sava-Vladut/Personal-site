import { useMemo, useState } from 'preact/hooks';
import { CHART_ORDER, CORE, EMOTION, FEELINGS, PICKER_ORDER, shortName } from '../data/emotions';
import { WEEKDAYS, shortDate } from '../lib/dates';
import { goBack, navigate } from '../lib/router';
import { RANGES, computeStats, dex, fmtMood, insights, pct, streaks, type RangeKey, type Stats as S } from '../lib/stats';
import { useEntries, useSettings } from '../lib/store';
import {
  BalanceChart, ChartCard, HBars, HeatLegend, IntensityChart, LegendItem, MixChart, MoodBars, MoodCalendar, MoodChart,
  RhythmHeatmap, Wheel, WorldLegend, bucketLabel,
} from '../components/charts';
import { INTENSITY, trail } from '../components/emotion';
import { Icon, Sprite } from '../components/icons';
import { Sheet } from '../components/Sheet';

const TABS = [['overview', 'Overview'], ['emotions', 'Emotions'], ['patterns', 'Patterns'], ['dex', 'Dex']] as const;
type Tab = (typeof TABS)[number][0];
const RANGE_NAME: Record<RangeKey, string> = { '7d': '7 days', '30d': '30 days', '90d': '90 days', '1y': 'year', all: 'period' };
const label = (id: string) => (EMOTION[id].depth === 0 ? shortName(id) : EMOTION[id].name);

function loadRange(): RangeKey {
  try {
    const r = localStorage.getItem('mm-range') as RangeKey;
    if (RANGES.some((x) => x[0] === r)) return r;
  } catch {}
  return '30d';
}

export function Stats({ query }: { query: URLSearchParams }) {
  const entries = useEntries();
  const { weekStart } = useSettings();
  const [range, setRangeState] = useState<RangeKey>(loadRange);
  const tab = (TABS.some((t) => t[0] === query.get('tab')) ? query.get('tab') : 'overview') as Tab;
  const s = useMemo(() => computeStats(entries, range, weekStart), [entries, range, weekStart]);

  const setRange = (r: RangeKey) => {
    setRangeState(r);
    try {
      localStorage.setItem('mm-range', r);
    } catch {}
  };

  return (
    <div class="page">
      <header class="page-head">
        <button class="back-link stats-back" onClick={() => goBack()}><Icon name="chevron-left" size={18} /> Back</button>
        <h1 class="title">Your patterns</h1>
      </header>

      <div class="seg tabs" role="tablist">
        {TABS.map(([id, name]) => (
          <button role="tab" aria-selected={tab === id} onClick={() => navigate('stats?tab=' + id, true)}>{name}</button>
        ))}
      </div>

      {tab !== 'dex' && (
        <div class="chips filters" role="toolbar" aria-label="Time range">
          {RANGES.map(([id, name]) => (
            <button class="chip" aria-pressed={range === id} onClick={() => setRange(id)}>{name}</button>
          ))}
          <span class="muted small range-note">{shortDate(s.start)} – {shortDate(s.end)}</span>
        </div>
      )}

      {!entries.length ? (
        <div class="empty">
          <h2 class="title-s">No stats yet</h2>
          <p>Check in or write a note with a feeling attached, and your patterns will start to show here.</p>
          <button class="btn btn-primary" onClick={() => navigate('tracker')}>Check in now</button>
        </div>
      ) : tab === 'dex' ? (
        <Dex />
      ) : !s.k.entries ? (
        <p class="empty-note center">Nothing logged in this range. Try a longer one.</p>
      ) : tab === 'overview' ? (
        <Overview s={s} range={range} />
      ) : tab === 'emotions' ? (
        <Emotions s={s} />
      ) : (
        <Patterns s={s} weekStart={weekStart} />
      )}
    </div>
  );
}

/* ---------- overview ---------- */

function Delta({ cur, prev, digits = 0, unit = '' }: { cur: number | null; prev: number | null | undefined; digits?: number; unit?: string }) {
  if (cur === null || prev === null || prev === undefined) return null;
  const d = cur - prev;
  if (Math.abs(d) < (digits ? 0.05 : 0.5)) return <span class="delta">no change</span>;
  return (
    <span class="delta">
      {d > 0 ? '↑' : '↓'} {Math.abs(d).toFixed(digits)}{unit}
    </span>
  );
}

function Tile({ label: l, value, sub, delta }: { label: string; value: string | number; sub?: string; delta?: preact.ComponentChildren }) {
  return (
    <div class="tile">
      <div class="tile-label">{l}</div>
      <div class="tile-value">{value}</div>
      <div class="tile-sub">{sub}{delta && sub ? ' · ' : ''}{delta}</div>
    </div>
  );
}

function Overview({ s, range }: { s: S; range: RangeKey }) {
  const entries = useEntries();
  const { k, prev } = s;
  const st = useMemo(() => streaks(entries), [entries]);
  const notes = useMemo(() => insights(s, RANGE_NAME[range], entries), [s, entries]);
  const p = k.pleasantShare;

  return (
    <div class="stack-l">
      <section class="card hero">
        <div class="tile-label">Average mood</div>
        <div class="hero-row">
          <span class="hero-num">{fmtMood(k.mood)}</span>
          <span class="hero-scale">on a scale from −5 to +5</span>
        </div>
        {prev && (
          <div class="tile-sub">
            <Delta cur={k.mood} prev={prev.mood} digits={1} /> {prev.mood !== null && k.mood !== null ? `vs the previous ${RANGE_NAME[range]}` : ''}
          </div>
        )}
        {p !== null && (
          <div class="split" aria-label={`${pct(p)} pleasant, ${pct(1 - p)} unpleasant`}>
            <div class="split-bar">
              {p > 0 && <i class="pos" style={{ flexGrow: p }} />}
              {p < 1 && <i class="neg" style={{ flexGrow: 1 - p }} />}
            </div>
            <div class="split-labels">
              <LegendItem color="var(--pos)" label={`${pct(p)} pleasant`} />
              <LegendItem color="var(--neg)" label={`${pct(1 - p)} unpleasant`} />
            </div>
          </div>
        )}
      </section>

      <div class="tiles">
        <Tile label="Entries" value={k.entries} sub={`${k.notes} notes · ${k.checkins} check-ins`} />
        <Tile label="Active days" value={k.activeDays} sub={`of ${s.span}`} delta={<Delta cur={k.activeDays} prev={prev?.activeDays} />} />
        <Tile label="Streak" value={st.current} sub={`longest ${st.longest}`} />
        <Tile label="Feelings named" value={k.feelings} sub={`of ${FEELINGS.length}`} delta={<Delta cur={k.feelings} prev={prev?.feelings} />} />
        <Tile label="Intensity" value={k.intensity === null ? '—' : k.intensity.toFixed(1)} sub={k.intensity ? INTENSITY[Math.round(k.intensity) - 1] : ''} delta={<Delta cur={k.intensity} prev={prev?.intensity} digits={1} />} />
        <Tile label="Words written" value={k.words.toLocaleString('en-GB')} delta={<Delta cur={k.words} prev={prev?.words} />} />
      </div>

      {notes.length > 0 && (
        <section class="card insights">
          <h3 class="chart-title"><Icon name="sparkles" size={16} /> What stands out</h3>
          <ul>{notes.map((n) => <li>{n}</li>)}</ul>
        </section>
      )}

      <ChartCard
        title="Mood over time"
        sub={`Each dot is a ${s.step === 1 ? 'day' : 'week'}; the line is the ${s.step === 1 ? '7-day' : '4-week'} average.`}
        table={{ head: [s.step === 1 ? 'Day' : 'Week', 'Mood', 'Average', 'Entries'], rows: s.buckets.filter((b) => b.entries.length).map((b) => [bucketLabel(b, s.step), fmtMood(b.mood), fmtMood(b.rolling), b.entries.length]) }}
      >
        <MoodChart buckets={s.buckets} step={s.step} />
      </ChartCard>

      <ChartCard
        title={`Pleasant vs unpleasant per ${s.step === 1 ? 'day' : 'week'}`}
        legend={<><LegendItem color="var(--pos)" label="Pleasant" /><LegendItem color="var(--neg)" label="Unpleasant" /></>}
        table={{ head: [s.step === 1 ? 'Day' : 'Week', 'Pleasant', 'Unpleasant'], rows: s.buckets.filter((b) => b.pleasant || b.unpleasant).map((b) => [bucketLabel(b, s.step), b.pleasant, b.unpleasant]) }}
      >
        <BalanceChart buckets={s.buckets} step={s.step} />
      </ChartCard>
    </div>
  );
}

/* ---------- emotions ---------- */

function Emotions({ s }: { s: S }) {
  const [sel, setSel] = useState<string | null>(null);
  const counts = useMemo(() => {
    const m = new Map<string, number>();
    s.cores.forEach((c) => m.set(c.id, c.count));
    s.families.forEach((v, id) => m.set(id, v));
    s.exact.forEach((x) => EMOTION[x.id].depth === 2 && m.set(x.id, x.count));
    return m;
  }, [s]);
  const e = sel ? EMOTION[sel] : null;
  const coreTotal = s.occurrences;

  return (
    <div class="stack-l">
      <div class="tiles">
        <Tile label="Variety" value={s.k.diversity === null ? '—' : Math.round(s.k.diversity)} sub="out of 100" />
        <Tile label="Distinct feelings" value={s.exact.length} sub="named at any level" />
      </div>

      <ChartCard
        title="Emotion wheel"
        sub="Worlds, zones and feelings. Darker means felt more often — tap a slice."
        table={{ head: ['Emotion', 'Level', 'Count'], rows: [...counts].filter(([, v]) => v).sort((a, b) => b[1] - a[1]).map(([id, v]) => [EMOTION[id].name, ['World', 'Zone', 'Feeling'][EMOTION[id].depth], v]) }}
      >
        <Wheel counts={counts} onSelect={setSel} selected={sel} />
        {e ? (
          <div class="wheel-detail" style={{ '--c': `var(--emo-${e.core})` }}>
            <div class="row gap-s"><Sprite core={e.core} size={16} /><b>{e.name}</b><span class="muted small">{trail(e.id)}</span></div>
            <p class="definition">{e.def}</p>
            <p class="muted small">
              {counts.get(e.id) ?? 0}× in this period
              {e.depth === 0 && coreTotal ? ` · ${pct((counts.get(e.id) ?? 0) / coreTotal)} of all feelings` : ''}
            </p>
          </div>
        ) : (
          <p class="hint center">Inner ring: worlds · middle: zones · outer: specific feelings</p>
        )}
      </ChartCard>

      <ChartCard title="Worlds" sub="Every feeling also counts toward its world." table={{ head: ['World', 'Count', 'Share'], rows: s.cores.map((c) => [CORE[c.id].name, c.count, pct(coreTotal ? c.count / coreTotal : 0)]) }}>
        <HBars total={coreTotal} rows={[...s.cores].sort((a, b) => b.count - a.count).map((c) => ({ id: c.id, label: shortName(c.id), count: c.count, core: c.id }))} />
      </ChartCard>

      {s.exact.length > 0 && (
        <ChartCard title="Top feelings" table={{ head: ['Feeling', 'World', 'Count'], rows: s.exact.map((x) => [label(x.id), shortName(EMOTION[x.id].core), x.count]) }}>
          <HBars total={s.occurrences} rows={s.exact.slice(0, 8).map((x) => ({ id: x.id, label: label(x.id), count: x.count, core: EMOTION[x.id].core }))} />
        </ChartCard>
      )}

      <ChartCard
        title="Emotion mix over time"
        sub="Share of each world."
        legend={<WorldLegend />}
        table={{ head: ['From', ...CHART_ORDER.map(shortName)], rows: s.buckets.filter((b) => b.entries.length).map((b) => [shortDate(b.key), ...CHART_ORDER.map((id) => b.cores[id] ?? 0)]) }}
      >
        <MixChart buckets={s.buckets} step={s.step} />
      </ChartCard>

      <section class="card chart-card">
        <h3 class="chart-title">Often together</h3>
        <p class="chart-sub">Feelings you named in the same entry.</p>
        {s.pairs.length ? (
          <ul class="pairs">
            {s.pairs.map((p) => (
              <li>
                <span><Sprite core={EMOTION[p.ids[0]].core} size={12} /> {label(p.ids[0])}</span>
                <span class="muted">+</span>
                <span><Sprite core={EMOTION[p.ids[1]].core} size={12} /> {label(p.ids[1])}</span>
                <span class="count">{p.count}×</span>
              </li>
            ))}
          </ul>
        ) : (
          <p class="empty-note">Add more than one feeling to a note to see which ones travel together.</p>
        )}
      </section>

      <section class="card chart-card">
        <h3 class="chart-title">What comes next</h3>
        <p class="chart-sub">How one world tends to lead to another, entry to entry.</p>
        {s.transitions.length ? (
          <ul class="pairs">
            {s.transitions.map((t) => (
              <li>
                <span><Sprite core={t.from} size={12} /> {shortName(t.from)}</span>
                <span class="muted">→</span>
                <span><Sprite core={t.to} size={12} /> {shortName(t.to)}</span>
                <span class="count">{t.count}×</span>
              </li>
            ))}
          </ul>
        ) : (
          <p class="empty-note">Needs a few more entries in a row to spot a pattern.</p>
        )}
      </section>
    </div>
  );
}

/* ---------- patterns ---------- */

function Patterns({ s, weekStart }: { s: S; weekStart: 0 | 1 }) {
  return (
    <div class="stack-l">
      <ChartCard
        title="Calendar"
        sub="Each day takes the colour of the world you felt most."
        legend={<WorldLegend />}
        table={{ head: ['Day', 'Most felt', 'Entries', 'Mood'], rows: [...s.calendar].sort((a, b) => (a[0] < b[0] ? 1 : -1)).map(([k, d]) => [shortDate(k), d.core ? shortName(d.core) : '—', d.n, fmtMood(d.mood)]) }}
      >
        <MoodCalendar calendar={s.calendar} start={s.start} end={s.end} weekStart={weekStart} />
      </ChartCard>

      <ChartCard
        title="When you check in"
        sub="Entries by weekday and time of day."
        legend={<HeatLegend />}
        table={{ head: ['Day', '0–6h', '6–12h', '12–18h', '18–24h'], rows: s.heat.map((r, d) => [WEEKDAYS[d], r[0] + r[1], r[2] + r[3], r[4] + r[5], r[6] + r[7]]) }}
      >
        <RhythmHeatmap heat={s.heat} max={s.heatMax} />
      </ChartCard>

      <ChartCard
        title="Mood by weekday"
        table={{ head: ['Day', 'Mood', 'Entries'], rows: s.weekdays.map((w) => [w.day, fmtMood(w.mood), w.n]) }}
      >
        <MoodBars rows={s.weekdays.map((w) => ({ label: w.day, mood: w.mood, n: w.n }))} />
      </ChartCard>

      <ChartCard
        title="Mood by time of day"
        sub="Morning 5–12 · Afternoon 12–17 · Evening 17–22 · Night"
        table={{ head: ['Time', 'Mood', 'Entries'], rows: s.dayparts.map((d) => [d.name, fmtMood(d.mood), d.n]) }}
      >
        <MoodBars rows={s.dayparts.map((d) => ({ label: d.name, mood: d.mood, n: d.n }))} />
      </ChartCard>

      <ChartCard
        title="Intensity"
        sub="How strongly you felt things, 1 (barely) to 5 (intense)."
        legend={<><LegendItem color="var(--pos)" label="Pleasant" /><LegendItem color="var(--neg)" label="Unpleasant" /></>}
        table={{ head: ['Level', 'Pleasant', 'Unpleasant'], rows: s.intensity.map((r) => [`${r.level} · ${INTENSITY[r.level - 1]}`, r.pleasant, r.unpleasant]) }}
      >
        <IntensityChart rows={s.intensity} />
      </ChartCard>
    </div>
  );
}

/* ---------- dex: every feeling you've named, all time ---------- */

function Dex() {
  const entries = useEntries();
  const found = useMemo(() => dex(entries), [entries]);
  const [open, setOpen] = useState<string | null>(null);
  const e = open ? EMOTION[open] : null;
  const info = open ? found.get(open) : null;

  return (
    <div class="stack-l">
      <section class="card hero">
        <div class="tile-label">Feelings named · all time</div>
        <div class="hero-row">
          <span class="hero-num">{found.size}</span>
          <span class="hero-scale">of {FEELINGS.length}</span>
        </div>
        <div class="meter"><i style={{ width: `${(found.size / FEELINGS.length) * 100}%` }} /></div>
        <p class="muted small">Each specific feeling you log fills a slot. Tap one to read it again.</p>
      </section>
      {PICKER_ORDER.map((c) => (
        <section class="dex-world">
          <h3 class="dex-title"><Sprite core={c} size={14} /> {CORE[c].name}</h3>
          <div class="dex-slots">
            {CORE[c].families.flatMap((f) => f.feelings).map((x) =>
              found.has(x.id) ? (
                <button class="dex-slot found" style={{ '--c': `var(--emo-${c})` }} onClick={() => setOpen(x.id)}>
                  <span>{x.name}</span>
                  <span class="dex-count">{found.get(x.id)!.count}×</span>
                </button>
              ) : (
                <button class="dex-slot" aria-label={`Not found yet — check in with ${CORE[c].name}`} onClick={() => navigate('tracker?world=' + c)}>???</button>
              ),
            )}
          </div>
        </section>
      ))}
      <Sheet open={!!open} onClose={() => setOpen(null)} title={e?.name ?? ''}>
        {e && info && (
          <div class="stack">
            <div class="row gap-s"><Sprite core={e.core} size={18} /><span class="muted">{trail(e.id)}</span></div>
            <p class="definition big">{e.def}</p>
            <p class="muted small">Named {info.count} {info.count === 1 ? 'time' : 'times'} · first on {shortDate(info.first)}</p>
          </div>
        )}
      </Sheet>
    </div>
  );
}
