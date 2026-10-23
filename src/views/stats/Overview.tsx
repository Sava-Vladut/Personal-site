import { useMemo } from 'preact/hooks';
import { FEELINGS } from '../../data/emotions';
import { addDays, todayKey } from '../../lib/dates';
import { fmtMood, insights, pct, streaks, type RangeKey, type Stats as S } from '../../lib/stats';
import { useEntries } from '../../lib/store';
import { BalanceChart, LegendItem, MoodChart, PLEASANT, RevealStack, UNPLEASANT, WorldSplit, bucketLabel } from '../../components/charts';
import { INTENSITY } from '../../components/emotion';
import { Delta, RANGE_BEFORE, Readout, Section, Story, leadWorld } from './parts';
import { count, t } from '../../lib/i18n';

export function Overview({ s, range }: { s: S; range: RangeKey }) {
  const entries = useEntries();
  const { k, prev } = s;
  const st = useMemo(() => streaks(entries), [entries]);
  const notes = useMemo(() => insights(s, RANGE_BEFORE[range], entries), [s, entries]);
  const days = useMemo(() => new Set(entries.map((e) => e.date)), [entries]);
  const week = useMemo(() => Array.from({ length: 7 }, (_, i) => days.has(addDays(todayKey(), i - 6))), [days]);
  const p = k.pleasantShare;
  const lead = leadWorld(s);

  return (
    <RevealStack>
      {notes.length > 0 && <Story title={t('What stands out')} notes={notes} />}

      <div class="st-readouts">
        <Readout k={0} label={t('Entries')} value={k.entries} sub={`${count(k.notes, 'note', 'notes')} · ${count(k.checkins, 'check-in', 'check-ins')}`} />
        <Readout k={1} label={t('Active days')} value={k.activeDays} sub={t('of {n}', { n: s.span })} delta={<Delta cur={k.activeDays} prev={prev?.activeDays} />} meter={k.activeDays / s.span} />
        <Readout k={2} label={t('Streak')} value={st.current} sub={t('longest {n}', { n: st.longest })} marks={week} />
        <Readout k={3} label={t('Feelings named')} value={k.feelings} sub={t('of {n}', { n: FEELINGS.length })} delta={<Delta cur={k.feelings} prev={prev?.feelings} />} meter={k.feelings / FEELINGS.length} />
        <Readout k={4} label={t('Intensity')} value={k.intensity === null ? '—' : k.intensity.toFixed(1)} sub={k.intensity ? INTENSITY[Math.round(k.intensity) - 1] : ''} delta={<Delta cur={k.intensity} prev={prev?.intensity} digits={1} />} marks={k.intensity ? Array.from({ length: 5 }, (_, i) => i < Math.round(k.intensity!)) : undefined} />
        <Readout k={5} label={t('Words written')} value={k.words} delta={<Delta cur={k.words} prev={prev?.words} />} />
      </div>

      <Section
        title={t('Mood over time')}
        world={lead}
        sub={s.step === 1 ? t('Each dot is a day, in the colour of the world you felt most; the line is the 7-day average.') : t('Each dot is a week, in the colour of the world you felt most; the line is the 4-week average.')}
        table={{ head: [s.step === 1 ? t('Day') : t('Week'), t('Mood'), t('Average'), t('Entries')], rows: s.buckets.filter((b) => b.entries.length).map((b) => [bucketLabel(b, s.step), fmtMood(b.mood), fmtMood(b.rolling), b.entries.length]) }}
      >
        <MoodChart buckets={s.buckets} step={s.step} world={lead} />
      </Section>

      <Section
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
      </Section>
    </RevealStack>
  );
}
