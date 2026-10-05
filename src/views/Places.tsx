import { useMemo, useState } from 'preact/hooks';
import { EMOTION, coreOf, shortName } from '../data/emotions';
import { dayLabel, rangeLabel, timeLabel } from '../lib/dates';
import { plainText } from '../lib/body';
import { previewOf } from '../lib/markdown';
import { goBack, navigate, navigateAfterSheet } from '../lib/router';
import { useEntries, useSettings, type Entry } from '../lib/store';
import { Icon, NoteIcon, Sprite } from '../components/icons';
import { PlaceMap, type Pin } from '../components/PlaceMap';
import { Sheet } from '../components/Sheet';
import { WeatherMark, placeLabel, weatherOf } from '../components/weather';

/** Every entry saved with a place, on a map. `?focus=<entry id>` opens it close in on that entry. */
export function MapView({ query }: { query: URLSearchParams }) {
  const entries = useEntries();
  const { places } = useSettings();
  const located = useMemo(() => entries.filter((e) => e.place), [entries]);
  const pins = useMemo<Pin[]>(
    () => {
      // on the heat map, recent and strong feelings burn brighter; older ones linger, fainter
      const now = Date.now();
      return located.map((e) => ({
        id: e.id, lat: e.place!.lat, lon: e.place!.lon, core: e.emotions[0] ? coreOf(e.emotions[0]).id : null,
        weight: (0.35 + 0.65 * Math.exp(-Math.max(0, now - e.time) / (60 * 86_400_000))) * (0.6 + e.intensity * 0.12),
      }));
    },
    [located],
  );
  const focus = located.find((e) => e.id === query.get('focus'))?.place ?? null;
  const [open, setOpen] = useState<string[] | null>(null);
  const shown = open ? located.filter((e) => open.includes(e.id)) : [];

  // the sheet's title: the name most of its entries share
  const names = new Map<string, number>();
  shown.forEach((e) => names.set(placeLabel(e.place!), (names.get(placeLabel(e.place!)) ?? 0) + 1));
  const title = [...names].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '';

  return (
    <div class="map-page">
      <PlaceMap pins={pins} focus={focus} onOpen={setOpen} remember={focus ? undefined : 'map'} heat />
      <div class="map-bar">
        <button class="glass glass-btn round" onClick={() => goBack('stats?tab=weather')} aria-label="Back"><Icon name="arrow-left" /></button>
        <div class="glass map-title">
          <b>Your map</b>
          <span>{located.length} {located.length === 1 ? 'entry' : 'entries'} with a place</span>
        </div>
      </div>
      {!located.length && (
        <div class="map-empty card">
          <h2 class="title-s">No places yet</h2>
          <p>{places ? 'Entries you write from now on will show up here, where you wrote them.' : 'Turn on Places in Settings, and the entries you write will show up here, where you wrote them.'}</p>
          {!places && <button class="btn btn-primary" onClick={() => navigate('settings')}>Open Settings</button>}
        </div>
      )}
      <Sheet open={!!open} onClose={() => setOpen(null)} title={<span class="row gap-s"><Icon name="map-pin" /> {title}</span>} label={title}>
        <div class="spot-list">
          {shown.map((e) => <SpotRow e={e} onGo={() => { navigateAfterSheet('note/' + e.id); setOpen(null); }} />)}
        </div>
      </Sheet>
    </div>
  );
}

function SpotRow({ e, onGo }: { e: Entry; onGo: () => void }) {
  const em = e.emotions[0] ? EMOTION[e.emotions[0]] : null;
  const { heading, preview } = previewOf(plainText(e.text), e.title, 80);
  const feeling = em ? (em.depth === 0 ? shortName(em.id) : em.name) : '';
  const title = e.kind === 'checkin' ? feeling || 'Check-in' : heading || 'Untitled';
  const sub = e.kind === 'checkin' ? preview : [feeling, preview].filter(Boolean).join(' · ');
  const w = weatherOf(e);
  return (
    <button class="spot-row" onClick={onGo}>
      <span class="spot-ico">
        {e.kind === 'checkin' && em ? <Sprite core={em.core} size={16} /> : e.icon ? <NoteIcon id={e.icon} size={20} /> : <Icon name="notebook" size={18} />}
      </span>
      <span class="spot-main">
        <span class="spot-title">{title}</span>
        <span class="spot-sub">{sub || (e.kind === 'checkin' ? 'Check-in' : 'Note')}</span>
      </span>
      <span class="spot-when">
        {w && <WeatherMark w={w} />} {e.dateEnd ? rangeLabel(e.date, e.dateEnd) : `${dayLabel(e.date)} · ${timeLabel(e.time)}`}
      </span>
    </button>
  );
}
