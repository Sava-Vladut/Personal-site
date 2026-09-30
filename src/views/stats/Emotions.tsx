import { useMemo, useState } from 'preact/hooks';
import { CHART_ORDER, CORE, EMOTION, shortName } from '../../data/emotions';
import { shortDate } from '../../lib/dates';
import { pct, type Stats as S } from '../../lib/stats';
import { ChartCard, HBars, MixChart, RevealStack, WorldLegend, Wheel } from '../../components/charts';
import { trail } from '../../components/emotion';
import { Sprite } from '../../components/icons';
import { Tile, WorldChip, label } from './parts';

export function Emotions({ s }: { s: S }) {
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
    <RevealStack>
      <div class="tiles">
        <Tile k={0} icon="chart-donut-2" label="Variety" value={s.k.diversity === null ? '—' : Math.round(s.k.diversity)} sub="out of 100" meter={s.k.diversity === null ? undefined : s.k.diversity / 100} />
        <Tile k={1} icon="mood-plus" label="Distinct feelings" value={s.exact.length} sub="named at any level" />
      </div>

      <ChartCard
        title="Emotion wheel"
        sub="Worlds, zones and feelings. Darker means felt more often — tap a slice."
        table={{ head: ['Emotion', 'Level', 'Count'], rows: [...counts].filter(([, v]) => v).sort((a, b) => b[1] - a[1]).map(([id, v]) => [EMOTION[id].name, ['World', 'Zone', 'Feeling'][EMOTION[id].depth], v]) }}
      >
        <Wheel counts={counts} onSelect={setSel} selected={sel} />
        {e ? (
          <div class="wheel-detail" data-core={e.core} style={{ '--c': `var(--emo-${e.core})` }}>
            <div class="row gap-s"><span class="alive"><Sprite core={e.core} size={16} /></span><b>{e.name}</b><span class="muted small">{trail(e.id)}</span></div>
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
            {s.pairs.map((p, i) => (
              <li style={{ '--k': i }}>
                <WorldChip core={EMOTION[p.ids[0]].core}>{label(p.ids[0])}</WorldChip>
                <span class="link">+</span>
                <WorldChip core={EMOTION[p.ids[1]].core}>{label(p.ids[1])}</WorldChip>
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
            {s.transitions.map((t, i) => (
              <li style={{ '--k': i }}>
                <WorldChip core={t.from}>{shortName(t.from)}</WorldChip>
                <span class="link">→</span>
                <WorldChip core={t.to}>{shortName(t.to)}</WorldChip>
                <span class="count">{t.count}×</span>
              </li>
            ))}
          </ul>
        ) : (
          <p class="empty-note">Needs a few more entries in a row to spot a pattern.</p>
        )}
      </section>
    </RevealStack>
  );
}
