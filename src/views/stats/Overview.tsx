import { useMemo } from 'preact/hooks';
import { FEELINGS, shortName } from '../../data/emotions';
import { addDays, todayKey } from '../../lib/dates';
import { fmtMood, insights, pct, streaks, type RangeKey, type Stats as S } from '../../lib/stats';
import { useEntries } from '../../lib/store';
import { BalanceChart, ChartCard, CountUp, MoodChart, PLEASANT, RevealStack, UNPLEASANT, LegendItem, WorldSplit, bucketLabel } from '../../components/charts';
import { INTENSITY } from '../../components/emotion';
import { Icon, Sprite } from '../../components/icons';
import { Delta, RANGE_NAME, Tile, leadWorld } from './parts';

export function Overview({ s, range }: { s: S; range: RangeKey }) {
  const entries = useEntries();
  const { k, prev } = s;
  const st = useMemo(() => streaks(entries), [entries]);
  const notes = useMemo(() => insights(s, RANGE_NAME[range], entries), [s, entries]);
  const days = useMemo(() => new Set(entries.map((e) => e.date)), [entries]);
  const week = useMemo(() => Array.from({ length: 7 }, (_, i) => days.has(addDays(todayKey(), i - 6))), [days]);
  const p = k.pleasantShare;
  const lead = leadWorld(s);

  return (
    <RevealStack>
      <section class="card hero" data-core={lead ?? undefined}>
        <div class="hero-main">
          <div>
            <div class="tile-label">Average mood</div>
            <div class="hero-row">
              <span class="hero-num"><CountUp value={fmtMood(k.mood)} /></span>
              <span class="hero-scale">on a scale from −5 to +5</span>
            </div>
            {prev && (
              <div class="tile-sub">
                <Delta cur={k.mood} prev={prev.mood} digits={1} /> {prev.mood !== null && k.mood !== null ? `vs the previous ${RANGE_NAME[range]}` : ''}
              </div>
            )}
          </div>
          {lead && (
            <div class="mascot" title={`Felt most: ${shortName(lead)}`}>
              <Sprite core={lead} size={38} idle />
              <span>{shortName(lead)}</span>
            </div>
          )}
        </div>
        {p !== null && (
          <div class="split" aria-label={`${pct(p)} pleasant, ${pct(1 - p)} unpleasant`}>
            <WorldSplit cores={s.cores} total={s.occurrences} />
            <div class="split-labels">
              <span><b>{pct(1 - p)}</b> unpleasant</span>
              <span><b>{pct(p)}</b> pleasant</span>
            </div>
          </div>
        )}
      </section>

      <div class="tiles">
        <Tile k={0} icon="notebook" label="Entries" value={k.entries} sub={`${k.notes} notes · ${k.checkins} check-ins`} />
        <Tile k={1} icon="calendar-event" label="Active days" value={k.activeDays} sub={`of ${s.span}`} delta={<Delta cur={k.activeDays} prev={prev?.activeDays} />} meter={k.activeDays / s.span} />
        <Tile k={2} icon="star" label="Streak" value={st.current} sub={`longest ${st.longest}`} pips={week} />
        <Tile k={3} icon="mood-smile" label="Feelings named" value={k.feelings} sub={`of ${FEELINGS.length}`} delta={<Delta cur={k.feelings} prev={prev?.feelings} />} meter={k.feelings / FEELINGS.length} />
        <Tile k={4} icon="chart-bar" label="Intensity" value={k.intensity === null ? '—' : k.intensity.toFixed(1)} sub={k.intensity ? INTENSITY[Math.round(k.intensity) - 1] : ''} delta={<Delta cur={k.intensity} prev={prev?.intensity} digits={1} />} pips={k.intensity ? Array.from({ length: 5 }, (_, i) => i < Math.round(k.intensity!)) : undefined} />
        <Tile k={5} icon="pencil" label="Words written" value={k.words.toLocaleString('en-GB')} delta={<Delta cur={k.words} prev={prev?.words} />} />
      </div>

      {notes.length > 0 && (
        <section class="card insights">
          <h3 class="chart-title"><Icon name="sparkles" size={16} /> What stands out</h3>
          <ul>
            {notes.map((n, i) => (
              <li style={{ '--k': i, ...(n.core ? { '--c': `var(--emo-${n.core})` } : {}) }} class={n.core ? 'tinted' : ''}>
                <span class="ins-ico">{n.core ? <Sprite core={n.core} size={13} /> : <Icon name="sparkles" size={13} />}</span>
                <span>{n.text}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <ChartCard
        title="Mood over time"
        sub={`Each dot is a ${s.step === 1 ? 'day' : 'week'}, in the colour of the world you felt most; the line is the ${s.step === 1 ? '7-day' : '4-week'} average.`}
        table={{ head: [s.step === 1 ? 'Day' : 'Week', 'Mood', 'Average', 'Entries'], rows: s.buckets.filter((b) => b.entries.length).map((b) => [bucketLabel(b, s.step), fmtMood(b.mood), fmtMood(b.rolling), b.entries.length]) }}
      >
        <MoodChart buckets={s.buckets} step={s.step} />
      </ChartCard>

      <ChartCard
        title={`Pleasant vs unpleasant per ${s.step === 1 ? 'day' : 'week'}`}
        legend={<><LegendItem color={PLEASANT} label="Pleasant" /><LegendItem color={UNPLEASANT} label="Unpleasant" /></>}
        table={{ head: [s.step === 1 ? 'Day' : 'Week', 'Pleasant', 'Unpleasant'], rows: s.buckets.filter((b) => b.pleasant || b.unpleasant).map((b) => [bucketLabel(b, s.step), b.pleasant, b.unpleasant]) }}
      >
        <BalanceChart buckets={s.buckets} step={s.step} />
      </ChartCard>
    </RevealStack>
  );
}
