import { useMemo, useState } from 'preact/hooks';
import { CHART_ORDER, CORE, EMOTION, shortName } from '../../data/emotions';
import { shortDate } from '../../lib/dates';
import { pct, type Stats as S } from '../../lib/stats';
import { ChartCard, HBars, MixChart, RevealStack, WorldLegend, Wheel } from '../../components/charts';
import { trail } from '../../components/emotion';
import { Sprite } from '../../components/icons';
import { Tile, WorldChip, label } from './parts';
import { t } from '../../lib/i18n';

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
        <Tile k={0} icon="chart-donut-2" label={t('Variety')} value={s.k.diversity === null ? '—' : Math.round(s.k.diversity)} sub={t('out of 100')} meter={s.k.diversity === null ? undefined : s.k.diversity / 100} />
        <Tile k={1} icon="mood-plus" label={t('Distinct feelings')} value={s.exact.length} sub={t('named at any level')} />
      </div>

      <ChartCard
        title={t('Emotion wheel')}
        sub={t('Worlds, zones and feelings. Darker means felt more often — tap a slice.')}
        table={{ head: [t('Emotion'), t('Level'), t('Count')], rows: [...counts].filter(([, v]) => v).sort((a, b) => b[1] - a[1]).map(([id, v]) => [EMOTION[id].name, [t('World'), t('Zone'), t('Feeling')][EMOTION[id].depth], v]) }}
      >
        <Wheel counts={counts} onSelect={setSel} selected={sel} />
        {e ? (
          <div class="wheel-detail" data-core={e.core} style={{ '--c': `var(--emo-${e.core})` }}>
            <div class="row gap-s"><Sprite core={e.core} size={16} idle /><b>{e.name}</b><span class="muted small">{trail(e.id)}</span></div>
            <p class="definition">{e.def}</p>
            <p class="muted small">
              {t('{n}× in this period', { n: counts.get(e.id) ?? 0 })}
              {e.depth === 0 && coreTotal ? ' · ' + t('{share} of all feelings', { share: pct((counts.get(e.id) ?? 0) / coreTotal) }) : ''}
            </p>
          </div>
        ) : (
          <p class="hint center">{t('Inner ring: worlds · middle: zones · outer: specific feelings')}</p>
        )}
      </ChartCard>

      <ChartCard title={t('Worlds')} sub={t('Every feeling also counts toward its world.')} table={{ head: [t('World'), t('Count'), t('Share')], rows: s.cores.map((c) => [CORE[c.id].name, c.count, pct(coreTotal ? c.count / coreTotal : 0)]) }}>
        <HBars total={coreTotal} rows={[...s.cores].sort((a, b) => b.count - a.count).map((c) => ({ id: c.id, label: shortName(c.id), count: c.count, core: c.id }))} />
      </ChartCard>

      {s.exact.length > 0 && (
        <ChartCard title={t('Top feelings')} table={{ head: [t('Feeling'), t('World'), t('Count')], rows: s.exact.map((x) => [label(x.id), shortName(EMOTION[x.id].core), x.count]) }}>
          <HBars total={s.occurrences} rows={s.exact.slice(0, 8).map((x) => ({ id: x.id, label: label(x.id), count: x.count, core: EMOTION[x.id].core }))} />
        </ChartCard>
      )}

      <ChartCard
        title={t('Emotion mix over time')}
        sub={t('Share of each world.')}
        legend={<WorldLegend />}
        table={{ head: [t('From'), ...CHART_ORDER.map(shortName)], rows: s.buckets.filter((b) => b.entries.length).map((b) => [shortDate(b.key), ...CHART_ORDER.map((id) => b.cores[id] ?? 0)]) }}
      >
        <MixChart buckets={s.buckets} step={s.step} />
      </ChartCard>

      <section class="card chart-card">
        <h3 class="chart-title">{t('Often together')}</h3>
        <p class="chart-sub">{t('Feelings you named in the same entry.')}</p>
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
          <p class="empty-note">{t('Add more than one feeling to a note to see which ones travel together.')}</p>
        )}
      </section>

      <section class="card chart-card">
        <h3 class="chart-title">{t('What comes next')}</h3>
        <p class="chart-sub">{t('How one world tends to lead to another, entry to entry.')}</p>
        {s.transitions.length ? (
          <ul class="pairs">
            {s.transitions.map((x, i) => (
              <li style={{ '--k': i }}>
                <WorldChip core={x.from}>{shortName(x.from)}</WorldChip>
                <span class="link">→</span>
                <WorldChip core={x.to}>{shortName(x.to)}</WorldChip>
                <span class="count">{x.count}×</span>
              </li>
            ))}
          </ul>
        ) : (
          <p class="empty-note">{t('Needs a few more entries in a row to spot a pattern.')}</p>
        )}
      </section>
    </RevealStack>
  );
}
