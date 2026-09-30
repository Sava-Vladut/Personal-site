import { WEEKDAYS, shortDate } from '../../lib/dates';
import { shortName } from '../../data/emotions';
import { fmtMood, type Stats as S } from '../../lib/stats';
import { ChartCard, HeatLegend, IntensityChart, LegendItem, MoodBars, MoodCalendar, PLEASANT, RevealStack, RhythmHeatmap, UNPLEASANT, WorldLegend } from '../../components/charts';
import { INTENSITY } from '../../components/emotion';

export function Patterns({ s, weekStart }: { s: S; weekStart: 0 | 1 }) {
  return (
    <RevealStack>
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
        legend={<><LegendItem color={PLEASANT} label="Pleasant" /><LegendItem color={UNPLEASANT} label="Unpleasant" /></>}
        table={{ head: ['Level', 'Pleasant', 'Unpleasant'], rows: s.intensity.map((r) => [`${r.level} · ${INTENSITY[r.level - 1]}`, r.pleasant, r.unpleasant]) }}
      >
        <IntensityChart rows={s.intensity} />
      </ChartCard>
    </RevealStack>
  );
}
