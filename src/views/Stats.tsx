import { useLayoutEffect, useMemo, useState } from 'preact/hooks';
import { shortName } from '../data/emotions';
import { shortDate } from '../lib/dates';
import { goBack, navigate } from '../lib/router';
import { RANGES, computeStats, coreCounts, fmtMood, skyWorlds, type RangeKey } from '../lib/stats';
import { useEntries, useSettings } from '../lib/store';
import { PageHead } from '../components/PageHead';
import { Sky } from '../components/Sky';
import { Dex } from './stats/Dex';
import { Emotions } from './stats/Emotions';
import { Overview } from './stats/Overview';
import { Patterns } from './stats/Patterns';
import { Weather } from './stats/Weather';
import { Delta, RANGE_PHRASE } from './stats/parts';
import { CountUp } from '../components/charts';
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

export function Stats({ query }: { query: URLSearchParams }) {
  const entries = useEntries();
  const { weekStart } = useSettings();
  const [range, setRangeState] = useState<RangeKey>(loadRange);
  const [lastTab, setLastTab] = usePref<Tab>('stats-tab', 'overview', TABS.map((t) => t[0]));
  const tab = (TABS.some((t) => t[0] === query.get('tab')) ? query.get('tab') : lastTab) as Tab;
  const s = useMemo(() => computeStats(entries, range, weekStart), [entries, range, weekStart]);

  // the sky above is made of the worlds below it (all time, on the dex)
  const sky = useMemo(() => skyWorlds(tab === 'dex' ? coreCounts(entries) : s.cores), [tab, entries, s]);
  const lead = sky[0] ?? null;
  useAccent(lead);

  const setRange = (r: RangeKey) => {
    setRangeState(r);
    try {
      localStorage.setItem('mm-range', r);
    } catch {}
  };

  return (
    <div class="page stats-page">
      <div class="journal-top stats-top" style={{ '--sky': `var(--emo-${lead ?? 'hope-interest'})` }}>
        <Sky world={lead} worlds={sky} />
        <PageHead
          title={t('Your patterns')}
          back={() => goBack()}
          subtitle={tab === 'dex' ? t('Every feeling you have named, all time.') : lead ? <>{t('Mostly')} <b>{shortName(lead)}</b> {RANGE_PHRASE[range]}.</> : t('Your feelings, over time.')}
        />

        {/* the range in three figures, on the sky like the records' */}
        {tab !== 'dex' && s.k.entries > 0 && (
          <div class="media-stats stats-figures">
            <span class="stat" style={{ '--i': 0 }}>
              <b><CountUp value={fmtMood(s.k.mood)} />{s.prev && s.prev.mood !== null && s.k.mood !== null && <em class="stat-aside"><Delta cur={s.k.mood} prev={s.prev.mood} digits={1} /></em>}</b>
              <small>{t('Average mood')}</small>
            </span>
            <span class="stat" style={{ '--i': 1 }}>
              <b><CountUp value={s.k.entries} /></b>
              <small>{t('Entries')}</small>
            </span>
            <span class="stat" style={{ '--i': 2 }}>
              <b><CountUp value={s.k.activeDays} /><em class="stat-aside">/{s.span}</em></b>
              <small>{t('Active days')}</small>
            </span>
          </div>
        )}

        <div class="seg tabs" role="tablist" style={{ '--at': TABS.findIndex((t) => t[0] === tab), '--tabs': TABS.length }}>
          {TABS.map(([id, name]) => (
            <button role="tab" aria-selected={tab === id} onClick={() => { setLastTab(id); navigate('stats?tab=' + id, true); }}>{name}</button>
          ))}
        </div>

        {tab !== 'dex' && (
          <div class="chips filters" role="toolbar" aria-label={t('Time range')}>
            {RANGES.map(([id, name]) => (
              <button class="chip" aria-pressed={range === id} onClick={() => setRange(id)}>{name}</button>
            ))}
            <span class="muted small range-note">{shortDate(s.start)} – {shortDate(s.end)}</span>
          </div>
        )}
      </div>

      <div class="tab-panel" key={tab === 'dex' ? tab : tab + range}>
        {!entries.length ? (
          <div class="empty">
            <h2 class="title-s">{t('No stats yet')}</h2>
            <p>{t('Check in or write a note with a feeling attached, and your patterns will start to show here.')}</p>
            <button class="btn btn-primary" onClick={() => navigate('tracker')}>{t('Check in now')}</button>
          </div>
        ) : tab === 'dex' ? (
          <Dex />
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
  );
}
