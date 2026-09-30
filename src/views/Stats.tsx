import { useLayoutEffect, useMemo, useState } from 'preact/hooks';
import { shortName } from '../data/emotions';
import { shortDate } from '../lib/dates';
import { goBack, navigate } from '../lib/router';
import { RANGES, computeStats, coreCounts, skyWorlds, type RangeKey } from '../lib/stats';
import { useEntries, useSettings } from '../lib/store';
import { Icon } from '../components/icons';
import { Sky } from '../components/Sky';
import { Dex } from './stats/Dex';
import { Emotions } from './stats/Emotions';
import { Overview } from './stats/Overview';
import { Patterns } from './stats/Patterns';
import { Weather } from './stats/Weather';
import { RANGE_PHRASE } from './stats/parts';
import '../styles/stats.css';

const TABS = [['overview', 'Overview'], ['emotions', 'Emotions'], ['patterns', 'Patterns'], ['weather', 'Weather'], ['dex', 'Dex']] as const;
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
  const tab = (TABS.some((t) => t[0] === query.get('tab')) ? query.get('tab') : 'overview') as Tab;
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
        <header class="page-head">
          <button class="back-link stats-back" onClick={() => goBack()}><Icon name="chevron-left" size={18} /> Back</button>
          <h1 class="title">Your patterns</h1>
          <p class="subtitle">
            {tab === 'dex' ? 'Every feeling you have named, all time.' : lead ? <>Mostly <b>{shortName(lead)}</b> {RANGE_PHRASE[range]}.</> : 'Your feelings, over time.'}
          </p>
        </header>

        <div class="seg tabs" role="tablist" style={{ '--at': TABS.findIndex((t) => t[0] === tab), '--tabs': TABS.length }}>
          {TABS.map(([id, name]) => (
            <button role="tab" aria-selected={tab === id} onClick={() => navigate('stats?tab=' + id, true)}>{name}</button>
          ))}
        </div>

        {tab !== 'dex' && (
          <div class="chips filters" role="toolbar" aria-label="Time range">
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
            <h2 class="title-s">No stats yet</h2>
            <p>Check in or write a note with a feeling attached, and your patterns will start to show here.</p>
            <button class="btn btn-primary" onClick={() => navigate('tracker')}>Check in now</button>
          </div>
        ) : tab === 'dex' ? (
          <Dex />
        ) : !s.k.entries ? (
          <p class="empty-note center">Nothing logged in this range. Try a longer one.</p>
        ) : tab === 'overview' ? (
          <Overview s={s} range={range} />
        ) : tab === 'emotions' ? (
          <Emotions s={s} />
        ) : tab === 'weather' ? (
          <Weather s={s} />
        ) : (
          <Patterns s={s} weekStart={weekStart} />
        )}
      </div>
    </div>
  );
}
