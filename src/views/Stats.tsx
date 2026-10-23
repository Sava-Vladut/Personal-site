import { useLayoutEffect, useMemo, useState } from 'preact/hooks';
import { FEELINGS, shortName } from '../data/emotions';
import { goBack, navigate } from '../lib/router';
import { RANGES, computeStats, coreCounts, dex, fmtMood, skyWorlds, type RangeKey } from '../lib/stats';
import { useEntries, useSettings } from '../lib/store';
import { PageHead } from '../components/PageHead';
import { Sky } from '../components/Sky';
import { AsciiCloud } from '../components/cloud';
import { Scramble } from '../components/ascii';
import { Sprite } from '../components/icons';
import { Dex } from './stats/Dex';
import { Emotions } from './stats/Emotions';
import { Forecast } from './stats/Forecast';
import { Overview } from './stats/Overview';
import { Patterns } from './stats/Patterns';
import { Weather } from './stats/Weather';
import { Delta, RANGE_BEFORE, RANGE_PHRASE, Worlds } from './stats/parts';
import { usePref } from '../lib/prefs';
import '../styles/stats.css';
import { t } from '../lib/i18n';

const TABS = [['overview', t('Overview')], ['emotions', t('Emotions')], ['patterns', t('Patterns')], ['weather', t('Weather')], ['dex', t('Dex')]] as const;
type Tab = (typeof TABS)[number][0];

function loadRange(): RangeKey {
  try {
    const r = localStorage.getItem('mm-range') as RangeKey;
    if (RANGES.some((x) => x[0] === r)) return r;
  } catch {}
  return '30d';
}

/** The page takes the colour of the world you felt most; the charts and tooltips read it from the root. */
function useAccent(world: string | null) {
  useLayoutEffect(() => {
    const root = document.documentElement.style;
    root.setProperty('--accent', `var(--emo-${world ?? 'hope-interest'})`);
    return () => root.removeProperty('--accent');
  }, [world]);
}

/**
 * Your patterns, as a weather report: the sky up top is made of the worlds you felt, the reading on it is the range's
 * mood with a cloud of the world felt most, and under it each day of the range is a little column of weather.
 * Below, every part of the report is laid out like a day of the journal.
 */
export function Stats({ query }: { query: URLSearchParams }) {
  const entries = useEntries();
  const { weekStart } = useSettings();
  const [range, setRangeState] = useState<RangeKey>(loadRange);
  const [lastTab, setLastTab] = usePref<Tab>('stats-tab', 'overview', TABS.map((t) => t[0]));
  const tab = (TABS.some((t) => t[0] === query.get('tab')) ? query.get('tab') : lastTab) as Tab;
  const s = useMemo(() => computeStats(entries, range, weekStart), [entries, range, weekStart]);
  const found = useMemo(() => dex(entries), [entries]);
  const isDex = tab === 'dex';

  // the sky above is made of the worlds below it (all time, on the dex)
  const sky = useMemo(() => skyWorlds(isDex ? coreCounts(entries) : s.cores), [isDex, entries, s]);
  const lead = sky[0] ?? null;
  useAccent(lead);

  const setRange = (r: RangeKey) => {
    setRangeState(r);
    try {
      localStorage.setItem('mm-range', r);
    } catch {}
  };

  return (
    <Worlds.Provider value={sky}>
      <div class="page stats-page">
        <div class="journal-top stats-top" style={{ '--sky': `var(--emo-${lead ?? 'hope-interest'})` }}>
          <Sky world={lead} worlds={sky} />
          <PageHead
            title={t('Your patterns')}
            back={() => goBack()}
            subtitle={isDex ? t('Every feeling you have named, all time.') : lead ? <>{t('Mostly')} <b>{shortName(lead)}</b> {RANGE_PHRASE[range]}.</> : t('Your feelings, over time.')}
          />

          <div class="seg tabs" role="tablist" style={{ '--at': TABS.findIndex((t) => t[0] === tab), '--tabs': TABS.length }}>
            {TABS.map(([id, name]) => (
              <button role="tab" aria-selected={tab === id} onClick={() => { setLastTab(id); navigate('stats?tab=' + id, true); }}>{name}</button>
            ))}
          </div>

          {entries.length > 0 && (
            <div class="st-reading">
              <div class="st-reading-main">
                <div class="st-eyebrow">{isDex ? t('Feelings named · all time') : t('Average mood')}</div>
                <div class="st-big">
                  <span class="st-big-num"><Scramble value={isDex ? found.size : fmtMood(s.k.mood)} /></span>
                  <span class="st-scale">{isDex ? t('of {n}', { n: FEELINGS.length }) : t('on a scale from −5 to +5')}</span>
                </div>
                {!isDex && s.prev && s.prev.mood !== null && s.k.mood !== null && (
                  <div class="st-delta"><Delta cur={s.k.mood} prev={s.prev.mood} digits={1} /> {t('vs {before}', { before: RANGE_BEFORE[range] })}</div>
                )}
              </div>
              {lead && (
                <div class="st-mascot" title={t('Felt most: {world}', { world: shortName(lead) })}>
                  <AsciiCloud world={lead} seed={7} cols={14} rest />
                  <Sprite core={lead} size={30} idle />
                  <span>{shortName(lead)}</span>
                </div>
              )}
            </div>
          )}

          {!isDex && entries.length > 0 && s.k.entries > 0 && <Forecast key={range} s={s} />}

          {!isDex && (
            <div class="chips filters" role="toolbar" aria-label={t('Time range')}>
              {RANGES.map(([id, name]) => (
                <button class="chip" aria-pressed={range === id} onClick={() => setRange(id)}>{name}</button>
              ))}
            </div>
          )}
        </div>

        <div class="tab-panel" key={isDex ? tab : tab + range}>
          {!entries.length ? (
            <div class="empty">
              <h2 class="title-s">{t('No stats yet')}</h2>
              <p>{t('Check in or write a note with a feeling attached, and your patterns will start to show here.')}</p>
              <button class="btn btn-primary" onClick={() => navigate('tracker')}>{t('Check in now')}</button>
            </div>
          ) : isDex ? (
            <Dex found={found} />
          ) : !s.k.entries ? (
            <p class="empty-note center">{t('Nothing logged in this range. Try a longer one.')}</p>
          ) : tab === 'overview' ? (
            <Overview s={s} range={range} />
          ) : tab === 'emotions' ? (
            <Emotions s={s} range={range} />
          ) : tab === 'weather' ? (
            <Weather s={s} />
          ) : (
            <Patterns s={s} weekStart={weekStart} />
          )}
        </div>
      </div>
    </Worlds.Provider>
  );
}
