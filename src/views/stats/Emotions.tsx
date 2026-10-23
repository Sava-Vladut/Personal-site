import { useMemo, useState } from 'preact/hooks';
import { CHART_ORDER, CORE, EMOTION, PICKER_ORDER, shortName } from '../../data/emotions';
import { shortDate } from '../../lib/dates';
import { ZONES, readBrain, regionLine, shiftLine } from '../../lib/brain';
import { pct, type RangeKey, type Stats as S } from '../../lib/stats';
import { useEntries } from '../../lib/store';
import { BrainCanvas } from '../../components/Brain';
import { ChartCard, HBars, MixChart, RevealStack, WorldLegend, Wheel } from '../../components/charts';
import { trail } from '../../components/emotion';
import { Sprite } from '../../components/icons';
import { Tile, WorldChip, label, leadWorld } from './parts';
import { t } from '../../lib/i18n';

export function Emotions({ s, range }: { s: S; range: RangeKey }) {
  const entries = useEntries();
  const [sel, setSel] = useState<string | null>(null);
  const [part, setPart] = useState<string | null>(null);
  // the brain, lit by the same stretch as the rest of the page
  const brain = useMemo(() => readBrain(entries, s.span, s.end, range !== 'all'), [entries, s, range]);
  const world = part ?? brain.lead ?? leadWorld(s) ?? 'hope-interest';
  const region = brain.regions[world];
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
      <section class="card brain st-brain" style={{ '--c': `var(--emo-${world})` }}>
        <div class="brain-head">
          <h3 class="brain-title">{t('Where it lives')}</h3>
          <div class="muted small">{t('Each world lights its own part of the brain, brighter the more you felt it. Tap a part.')}</div>
        </div>
        <div class="brain-stage"><BrainCanvas brain={brain} selected={world} onPick={setPart} /></div>
        <div class="brain-zones" role="radiogroup" aria-label={t('Regions')}>
          {PICKER_ORDER.map((id) => (
            <button
              class="brain-zone" style={{ '--c': `var(--emo-${id})`, '--lit': brain.regions[id].level }}
              role="radio" aria-checked={world === id} onClick={() => setPart(id)} title={ZONES[id].name}
            >
              <Sprite core={id} size={14} idle={world === id} />
              <span class="brain-zone-name">{shortName(id)}</span>
              <i class="brain-zone-lit" />
            </button>
          ))}
        </div>
        <div class="brain-detail">
          <div class="brain-detail-head"><Sprite core={world} size={18} idle /> <b>{ZONES[world].name}</b></div>
          <p class="brain-role">{ZONES[world].role}</p>
          <p class="brain-line">{regionLine(region, brain.span)}</p>
          {shiftLine(region, brain.span) && <p class="brain-shift muted small">{shiftLine(region, brain.span)}</p>}
        </div>
      </section>

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
