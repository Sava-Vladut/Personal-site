// Insights › Workouts: every workout you finished and what it adds up to. The numbers come from lib/trainingStats.ts;
// each tab is a file in views/training/. The page wears the Workout place's colour (hope's), so the charts and the
// tooltips read it from the root as Stats' do.
import { useLayoutEffect, useMemo, useState } from 'preact/hooks';
import { shortDate, todayKey } from '../lib/dates';
import { goBack, navigate } from '../lib/router';
import { useSettings, useWeighIns, useWorkouts } from '../lib/store';
import { usePref } from '../lib/prefs';
import { finished, metShare, moveStats, rangeOf, recordBreaks, RANGE_KEYS, totals, within, type RangeKey } from '../lib/trainingStats';
import { PageHead } from '../components/PageHead';
import { Sky } from '../components/Sky';
import { CountUp } from '../components/charts';
import { Icon, type UiName } from '../components/icons';
import { Bests } from './training/Bests';
import { ExerciseSheet } from './training/ExerciseSheet';
import { Exercises } from './training/Exercises';
import { History } from './training/History';
import { Muscles } from './training/Muscles';
import { Overview } from './training/Overview';
import { WorkoutSheet } from './training/WorkoutSheet';
import { Delta } from './training/parts';
import { t } from '../lib/i18n';
import '../styles/stats.css';
import '../styles/training.css';

const TABS = [
  ['overview', t('Overview'), 'chart-bar'], ['muscles', t('Muscles'), 'body-scan'], ['exercises', t('Exercises'), 'barbell'],
  ['history', t('History'), 'history'], ['bests', t('Bests'), 'trophy'],
] as const satisfies readonly (readonly [string, string, UiName])[];
type Tab = (typeof TABS)[number][0];
const TAB_IDS = TABS.map((x) => x[0]);
/** The tabs that look at a stretch of time; the rest are everything you've done. */
const RANGED: Tab[] = ['overview', 'muscles'];

const RANGE_NAME: Record<RangeKey, string> = { '4w': t('4 weeks'), '3m': t('3 months'), '1y': t('Year'), all: t('All time') };

function useAccent() {
  useLayoutEffect(() => {
    const root = document.documentElement.style;
    root.setProperty('--accent', 'var(--emo-hope-interest)');
    return () => root.removeProperty('--accent');
  }, []);
}

export function Training({ query }: { id: string; query: URLSearchParams }) {
  useAccent();
  const workouts = useWorkouts();
  const weighIns = useWeighIns();
  const { weekStart } = useSettings();
  const [lastTab, setLastTab] = usePref<Tab>('training-tab', 'overview', TAB_IDS);
  const [range, setRange] = usePref<RangeKey>('training-range', '3m', RANGE_KEYS);
  // a workout to open from the start: a tap on one of the Workout page's recent ones
  const [openW, setOpenW] = useState<string | null>(() => query.get('w'));
  const [openM, setOpenM] = useState<string | null>(null);
  const tab = (TAB_IDS.includes(query.get('tab') as Tab) ? query.get('tab') : lastTab) as Tab;
  const today = todayKey();

  const all = useMemo(() => finished(workouts), [workouts]);
  const live = useMemo(() => workouts.find((w) => w.end === null) ?? null, [workouts]);
  const moves = useMemo(() => moveStats(all), [all]);
  const records = useMemo(() => recordBreaks(all), [all]);
  const ranged = RANGED.includes(tab);
  const span = useMemo(() => rangeOf(ranged ? range : 'all', today, weekStart, all.at(-1)?.day ?? null), [ranged, range, today, weekStart, all]);
  const list = useMemo(() => within(all, span), [all, span]);
  const now = useMemo(() => totals(list), [list]);
  const was = useMemo(() => (span.prev ? totals(within(all, span.prev)) : null), [all, span]);
  const met = metShare(now), metBefore = was ? metShare(was) : null;

  const openWorkout = all.find((d) => d.w.id === openW) ?? null;
  const openMove = moves.find((m) => m.move.id === openM) ?? null;

  return (
    <div class="page stats-page tr-page">
      <div class="journal-top stats-top" style={{ '--sky': 'var(--emo-hope-interest)' }}>
        <Sky world="hope-interest" />
        <PageHead
          title={t('Workouts')}
          back={() => goBack()}
          actions={
            <button class="icon-btn" onClick={() => navigate('workout')} aria-label={t('Go to Workout')} title={t('Go to Workout')}>
              <Icon name="barbell" />
            </button>
          }
          subtitle={t('Your power, muscles and bests, workout by workout')}
        />

        {all.length > 0 && (
          <div class="media-stats stats-figures tr-top-figures">
            <span class="stat" style={{ '--i': 0 }}>
              <b><CountUp value={now.workouts} />{was && <em class="stat-aside"><Delta cur={now.workouts} prev={was.workouts} /></em>}</b>
              <small>{t('Workouts')}</small>
            </span>
            <span class="stat" style={{ '--i': 1 }}>
              <b><Icon name="bolt" size={14} class="tr-bolt" /><CountUp value={Math.round(now.power)} />{was && <em class="stat-aside"><Delta cur={now.power} prev={was.power} rel /></em>}</b>
              <small>{t('Power')}</small>
            </span>
            <span class="stat" style={{ '--i': 2 }}>
              <b>{met === null ? '—' : <CountUp value={`${Math.round(met * 100)}%`} />}{met !== null && metBefore !== null && <em class="stat-aside"><Delta cur={met * 100} prev={metBefore * 100} unit="%" /></em>}</b>
              <small>{t('Targets met')}</small>
            </span>
          </div>
        )}

        <div class="seg tabs tr-tabs" role="tablist" style={{ '--at': TAB_IDS.indexOf(tab), '--tabs': TABS.length }}>
          {TABS.map(([id, name, icon]) => (
            <button role="tab" aria-selected={tab === id} onClick={() => { setLastTab(id); navigate('training?tab=' + id, true); }}>
              <Icon name={icon} size={16} /><span>{name}</span>
            </button>
          ))}
        </div>

        {ranged && all.length > 0 && (
          <div class="chips filters fade-arrive-soft" role="toolbar" aria-label={t('Time range')}>
            {RANGE_KEYS.map((id) => (
              <button class="chip" aria-pressed={range === id} onClick={() => setRange(id)}>{RANGE_NAME[id]}</button>
            ))}
            <span class="muted small range-note">{shortDate(span.start)} – {shortDate(span.end)}</span>
          </div>
        )}
      </div>

      <div class="tab-panel" key={ranged ? tab + range : tab}>
        {!all.length ? (
          <div class="empty">
            <h2 class="title-s">{t('No workouts yet')}</h2>
            <p>{t('Finish a workout and its power, muscles and bests will show up here.')}</p>
            <button class="btn btn-primary" onClick={() => navigate('workout')}>{t('Start a workout')}</button>
          </div>
        ) : ranged && !list.length ? (
          <div class="empty-note center">
            <p>{t('No workouts in this range. Try a longer one.')}</p>
            <button class="btn btn-quiet" onClick={() => setRange('all')}>{t('Show all time')}</button>
          </div>
        ) : tab === 'muscles' ? (
          <Muscles all={all} list={list} today={today} onMove={setOpenM} />
        ) : tab === 'exercises' ? (
          <Exercises moves={moves} onOpen={setOpenM} />
        ) : tab === 'history' ? (
          <History all={all} live={live} records={records} onOpen={setOpenW} />
        ) : tab === 'bests' ? (
          <Bests all={all} moves={moves} weekStart={weekStart} today={today} onWorkout={setOpenW} onMove={setOpenM} />
        ) : (
          <Overview all={all} list={list} range={span} weighIns={weighIns} weekStart={weekStart} today={today} />
        )}
      </div>

      <ExerciseSheet m={openMove} onClose={() => setOpenM(null)} onWorkout={setOpenW} />
      <WorkoutSheet d={openWorkout} records={openW ? records.get(openW) ?? 0 : 0} onClose={() => setOpenW(null)} onMove={setOpenM} />
    </div>
  );
}
