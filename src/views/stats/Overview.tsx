import { useMemo } from 'preact/hooks';
import { FEELINGS } from '../../data/emotions';
import { addDays, todayKey } from '../../lib/dates';
import { fmtMood, insights, pct, streaks, type RangeKey, type Stats as S } from '../../lib/stats';
import { useEntries } from '../../lib/store';
import { BalanceChart, ChartCard, PLEASANT, RevealStack, UNPLEASANT, LegendItem, WorldSplit, bucketLabel } from '../../components/charts';
import { INTENSITY } from '../../components/emotion';
import { Icon, Sprite } from '../../components/icons';
import { MoodSky } from './MoodSky';
import { Delta, RANGE_BEFORE, Tile } from './parts';
import { LOCALE, t } from '../../lib/i18n';

/** The range at a glance: your mood as a sky, what stands out, a few figures, and how pleasant it was. */
export function Overview({ s, range }: { s: S; range: RangeKey }) {
  const entries = useEntries();
  const { k, prev } = s;
  const st = useMemo(() => streaks(entries), [entries]);
  const notes = useMemo(() => insights(s, RANGE_BEFORE[range], entries), [s, entries]);
  const days = useMemo(() => new Set(entries.map((e) => e.date)), [entries]);
  const week = useMemo(() => Array.from({ length: 7 }, (_, i) => days.has(addDays(todayKey(), i - 6))), [days]);
  const p = k.pleasantShare;

  return (
    <RevealStack>
      <ChartCard
        wide
        title={t('Mood over time')}
        sub={s.step === 1
          ? t('Each cloud is a day, as high as your mood and in the colour of the world you felt most. The line is the 7-day average.')
          : t('Each cloud is a week, as high as your mood and in the colour of the world you felt most. The line is the 4-week average.')}
        table={{ head: [s.step === 1 ? t('Day') : t('Week'), t('Mood'), t('Average'), t('Entries')], rows: s.buckets.filter((b) => b.entries.length).map((b) => [bucketLabel(b, s.step), fmtMood(b.mood), fmtMood(b.rolling), b.entries.length]) }}
      >
        <MoodSky s={s} />
      </ChartCard>

      {notes.length > 0 && (
        <section class="card insights">
          <h3 class="chart-title"><Icon name="sparkles" size={16} /> {t('What stands out')}</h3>
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

      <div class="tiles">
        <Tile k={0} icon="star" label={t('Streak')} value={st.current} sub={t('longest {n}', { n: st.longest })} pips={week} />
        <Tile k={1} icon="mood-smile" label={t('Feelings named')} value={k.feelings} sub={t('of {n}', { n: FEELINGS.length })} delta={<Delta cur={k.feelings} prev={prev?.feelings} />} meter={k.feelings / FEELINGS.length} />
        <Tile k={2} icon="chart-bar" label={t('Intensity')} value={k.intensity === null ? '—' : k.intensity.toFixed(1)} sub={k.intensity ? INTENSITY[Math.round(k.intensity) - 1] : ''} delta={<Delta cur={k.intensity} prev={prev?.intensity} digits={1} />} pips={k.intensity ? Array.from({ length: 5 }, (_, i) => i < Math.round(k.intensity!)) : undefined} />
        <Tile k={3} icon="pencil" label={t('Words written')} value={k.words.toLocaleString(LOCALE)} delta={<Delta cur={k.words} prev={prev?.words} />} />
      </div>

      <ChartCard
        wide
        title={s.step === 1 ? t('Pleasant vs unpleasant per day') : t('Pleasant vs unpleasant per week')}
        legend={<><LegendItem color={PLEASANT} label={t('Pleasant')} /><LegendItem color={UNPLEASANT} label={t('Unpleasant')} /></>}
        table={{ head: [s.step === 1 ? t('Day') : t('Week'), t('Pleasant'), t('Unpleasant')], rows: s.buckets.filter((b) => b.pleasant || b.unpleasant).map((b) => [bucketLabel(b, s.step), b.pleasant, b.unpleasant]) }}
      >
        {p !== null && (
          <div class="split" aria-label={t('{a} pleasant, {b} unpleasant', { a: pct(p), b: pct(1 - p) })}>
            <WorldSplit cores={s.cores} total={s.occurrences} />
            <div class="split-labels">
              <span><b>{pct(1 - p)}</b> {t('unpleasant')}</span>
              <span><b>{pct(p)}</b> {t('pleasant')}</span>
            </div>
          </div>
        )}
        <BalanceChart buckets={s.buckets} step={s.step} />
      </ChartCard>
    </RevealStack>
  );
}
