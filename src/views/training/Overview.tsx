import type { ComponentChildren } from 'preact';
import { useMemo } from 'preact/hooks';
import { shortDate } from '../../lib/dates';
import { DEFAULT_BW, fmtPower, type WeighIn } from '../../lib/fitness';
import { averages, byDay, daysBetween, kindPower, streaks, totals, weekMet, weeks, weightSeries, whenHeat, within, type Done, type Range, type Week } from '../../lib/trainingStats';
import { ChartCard, HeatLegend, LegendItem, RevealStack, RhythmHeatmap } from '../../components/charts';
import { KIND_ICON, KIND_NAME, Power } from '../../components/fitness';
import { Icon, type UiName } from '../../components/icons';
import { PowerGauge, Rolling, useMedia } from '../../components/power';
import { Tile } from '../stats/parts';
import { count, LOCALE, rich, t } from '../../lib/i18n';
import { MET, PowerCalendar, PowerLegend, Split, TrendLine, UNMET, WeekBars } from './charts';
import { Delta, Feel, fmtKg, fmtMins, powerText } from './parts';

/** The range at a glance: the power week by week, the days trained, the streaks, a typical workout, when and on what. */
export function Overview({ all, list, range, weighIns, weekStart, today }: {
  all: Done[]; list: Done[]; range: Range; weighIns: WeighIn[]; weekStart: 0 | 1; today: string;
}) {
  const wk = useMemo(() => weeks(list, range, weekStart), [list, range, weekStart]);
  const st = useMemo(() => streaks(all, today, weekStart), [all, today, weekStart]);
  const days = useMemo(() => byDay(list), [list]);
  const when = useMemo(() => whenHeat(list), [list]);
  const kinds = useMemo(() => kindPower(list), [list]);
  const avg = useMemo(() => averages(totals(list)), [list]);
  const was = useMemo(() => (range.prev ? averages(totals(within(all, range.prev))) : null), [all, range]);
  const bw = useMemo(() => weightSeries(weighIns, all, range), [weighIns, all, range]);
  // a line of the default weight nobody gave says nothing
  const showBw = bw.length > 1 && bw.some((p) => p.logged || p.kg !== DEFAULT_BW);
  const metWeeks = wk.filter(weekMet).length;
  const trained = wk.filter((w) => w.workouts > 0).length;

  return (
    <RevealStack>
      {range.start <= today && today <= range.end && wk.length > 0 && <ThisWeek wk={wk} streak={st.weeks} />}

      <ChartCard
        wide
        title={t('Power per week')}
        sub={metWeeks
          ? t('Each bar is a week’s ⚡, deep when every target that week was met ({n} of {all} weeks). The dashed line is your average week.', { n: metWeeks, all: trained })
          : t('Each bar is a week’s ⚡. The dashed line is your average week.')}
        legend={<><LegendItem color={MET} label={t('Every target met')} /><LegendItem color={UNMET} label={t('Other weeks')} /></>}
        table={{ head: [t('Week'), t('Power'), t('Workouts'), t('Targets met')], rows: wk.filter((w) => w.workouts).map((w) => [shortDate(w.key), fmtPower(w.power), w.workouts, w.targeted ? `${w.met}/${w.targeted}` : '—']) }}
      >
        <WeekBars weeks={wk} />
      </ChartCard>

      <div class="tiles">
        <Tile k={0} icon="flame" label={t('Weeks in a row')} value={st.weeks} sub={t('longest {n}', { n: st.bestWeeks })} pips={st.lastWeeks} />
        <Tile k={1} icon="target" label={t('Targets in a row')} value={st.targets} sub={t('longest {n}', { n: st.bestTargets })} pips={st.lastTargets.length ? st.lastTargets : undefined} />
      </div>

      {avg && (
        <section class="card chart-card tr-typical">
          <header class="chart-head"><h3 class="chart-title">{t('A typical workout')}</h3></header>
          <ul class="tr-facts">
            <Fact k={0} icon="clock" value={fmtMins(avg.mins)} label={t('duration')} cur={avg.mins} prev={was?.mins} rel />
            <Fact k={1} icon="bolt" value={<Power value={avg.power} size={16} />} label={t('per workout')} cur={avg.power} prev={was?.power} rel />
            <Fact k={2} icon="activity" value={<Power value={avg.perMin} size={16} />} label={t('per minute')} cur={avg.perMin} prev={was?.perMin} rel />
            <Fact k={3} icon="list-details" value={avg.sets.toLocaleString(LOCALE, { maximumFractionDigits: 1 })} label={t('sets')} cur={avg.sets} prev={was?.sets} />
            {avg.feel !== null && <Fact k={4} icon="mood-smile" value={<><Feel value={avg.feel} size={20} /> {avg.feel.toLocaleString(LOCALE, { maximumFractionDigits: 1 })}</>} label={t('feel, of 5')} />}
          </ul>
        </section>
      )}

      <ChartCard
        title={t('Days you trained')}
        sub={t('{n} of {all} days, shaded by their ⚡', { n: days.size, all: daysBetween(range.start, range.end) + 1 })}
        legend={<PowerLegend />}
      >
        <PowerCalendar days={days} start={range.start} end={range.end} weekStart={weekStart} />
      </ChartCard>

      <ChartCard title={t('When you train')} sub={t('The day and the hour your workouts start')} legend={<HeatLegend />}>
        <RhythmHeatmap heat={when.heat} max={Math.max(1, when.max)} />
      </ChartCard>

      <ChartCard
        title={t('Where the power came from')}
        table={{ head: [t('Kind'), t('Power')], rows: (['weight', 'body', 'time', 'cardio'] as const).map((k) => [KIND_NAME[k], fmtPower(kinds[k])]) }}
      >
        <Split
          label={t('Power by kind of exercise')}
          empty={t('No power in this range yet.')}
          parts={(['weight', 'body', 'time', 'cardio'] as const).map((k, i) => ({
            key: k, name: KIND_NAME[k], icon: KIND_ICON[k], n: kinds[k], text: powerText(kinds[k]), color: ['var(--pos-a)', 'var(--accent)', 'var(--tr-pale)', 'var(--ink-3)'][i],
          }))}
        />
      </ChartCard>

      {showBw && (
        <ChartCard
          title={t('Body weight')}
          sub={bw.every((p) => p.logged)
            ? t('From {a} to {b}', { a: fmtKg(bw[0].kg), b: fmtKg(bw[bw.length - 1].kg) })
            : t('Weigh in on the Workout page for a truer line. Hollow dots are the weight a workout was done at.')}
          table={{ head: [t('Day'), t('Weight')], rows: bw.map((p) => [shortDate(p.day), fmtKg(p.kg)]) }}
        >
          <TrendLine points={bw.map((p) => ({ day: p.day, value: p.kg, hollow: !p.logged }))} format={fmtKg} label={t('Body weight')} unit={t('body weight')} />
        </ChartCard>
      )}
    </RevealStack>
  );
}

/**
 * This week against your usual one, at the top while the range runs to today: a ring of this week's ⚡ that fills to
 * your usual week (the average of the weeks you trained before it, in the range) and laps past it, a notch where last
 * week came to, what's left to beat it, and the weeks in a row.
 */
function ThisWeek({ wk, streak }: { wk: Week[]; streak: number }) {
  const big = useMedia('(min-width: 1024px)');
  const now = wk[wk.length - 1];
  const before = wk.slice(0, -1).filter((w) => w.workouts > 0);
  const usual = before.length ? before.reduce((a, w) => a + w.power, 0) / before.length : 0;
  const last = wk.length > 1 ? wk[wk.length - 2].power : 0;
  const above = usual > 0 && now.power >= usual;
  return (
    <section class={`card wide tr-hero${above ? ' is-above' : ''}`}>
      <PowerGauge
        value={now.power}
        target={usual}
        scale={Math.max(now.power, 1)}
        ghost={last}
        size={big ? 'l' : 'm'}
        label={`${t('This week')}: ${powerText(now.power)}${usual > 0 ? ` · ${t('Your usual week')}: ${powerText(usual)}` : ''}`}
      >
        <b class="tr-hero-n"><Rolling value={now.power} from={0} ms={900} /></b>
        <Icon name="bolt" size={big ? 18 : 14} class="tr-hero-bolt" />
      </PowerGauge>
      <div class="tr-hero-text">
        <p class="tr-hero-eyebrow">{t('This week')}</p>
        {usual <= 0 ? (
          <p class="tr-hero-line">{t('No usual week yet: keep going')}</p>
        ) : above ? (
          <p class="tr-hero-line is-above"><Icon name="trending-up" size={20} /><b class="tr-hero-head">{t('Above your usual')}</b></p>
        ) : (
          <p class="tr-hero-line">{rich('{p} ⚡ to beat your usual', { p: <b class="tr-hero-big"><Rolling value={usual - now.power} from={0} ms={900} /></b> })}</p>
        )}
        {(usual > 0 || last > 0) && (
          <ul class="tr-hero-keys">
            {usual > 0 && <li><i class="tr-key-usual" />{t('Your usual week')} <b>{powerText(usual)}</b></li>}
            {last > 0 && <li><i class="tr-key-last" />{t('Last week')} <b>{powerText(last)}</b></li>}
          </ul>
        )}
        {streak > 0 && (
          <p class="tr-hero-streak"><span class="pw-flicker"><Icon name="flame" size={16} /></span>{count(streak, 'week in a row', 'weeks in a row')}</p>
        )}
      </div>
    </section>
  );
}

/** One figure of a typical workout: an icon, the figure, what it is, and how it changed since the range before. */
function Fact({ icon, value, label, cur, prev, rel, k }: {
  icon: UiName; value: ComponentChildren; label: string; cur?: number; prev?: number; rel?: boolean; k: number;
}) {
  const change = cur !== undefined && prev !== undefined && (!rel || prev > 0);
  return (
    <li style={{ '--k': k }}>
      <span class="tile-ico"><Icon name={icon} size={14} stroke={2} /></span>
      <b class="tr-fact-value">{value}</b>
      <span class="tr-fact-label">{label}{change && <> · <Delta cur={cur} prev={prev} rel={rel} /></>}</span>
    </li>
  );
}
