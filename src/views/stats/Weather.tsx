import { useMemo } from 'preact/hooks';
import { coreOf } from '../../data/emotions';
import { fmtTemp } from '../../data/weather';
import { navigate } from '../../lib/router';
import { fmtMood, pct, weatherInsights, weatherStats, type Stats as S } from '../../lib/stats';
import { useSettings } from '../../lib/store';
import { ChartCard, MoodRows, RevealStack } from '../../components/charts';
import { Icon, Sprite } from '../../components/icons';
import { PlaceMap, type Pin } from '../../components/PlaceMap';
import { Tile } from './parts';

const hours = (h: number | null) => (h === null ? '—' : `${h.toFixed(1)} h`);

export function Weather({ s }: { s: S }) {
  const settings = useSettings();
  const w = useMemo(() => weatherStats(s.list), [s]);
  const notes = useMemo(() => weatherInsights(w), [w]);
  const pins = useMemo<Pin[]>(
    () => s.list.filter((e) => e.place).map((e) => ({ id: e.id, lat: e.place!.lat, lon: e.place!.lon, core: e.emotions[0] ? coreOf(e.emotions[0]).id : null })),
    [s],
  );

  const why = !settings.weather
    ? 'Turn on Weather in Settings to see how the sky, the temperature and the length of the day go with your mood.'
    : !settings.home && !settings.places
      ? 'Set your home in Settings, so the weather can be added to your entries.'
      : 'The weather is being added to your entries. It needs a connection, so check back in a moment.';

  if (!w.covered && !w.located)
    return (
      <div class="card weather-empty">
        <span class="weather-empty-ico"><Icon name="haze" size={26} /></span>
        <h2 class="title-s">No weather yet</h2>
        <p>{why}</p>
        <button class="btn btn-primary" onClick={() => navigate('settings')}>Open Settings</button>
      </div>
    );

  const common = [...w.sky].sort((a, b) => b.entries - a.entries)[0];
  const skyRows = w.sky.filter((g) => g.n > 0);

  return (
    <RevealStack>
      {w.covered ? (
        <div class="tiles">
          <Tile k={0} icon={common.icon} label="Most common sky" small value={common.name} sub={`${pct(common.entries / w.covered)} of entries`} />
          <Tile k={1} icon="temperature" label="Temperature" value={w.temp === null ? '—' : fmtTemp(w.temp)} sub="on average" />
          <Tile k={2} icon="sunrise" label="Daylight" value={hours(w.daylight)} sub="a day, on average" />
          <Tile k={3} icon="map-pin" label="Places" value={w.places.length} sub={`${w.located} of ${w.total} entries`} meter={w.total ? w.located / w.total : 0} />
        </div>
      ) : (
        <button class="card weather-hint" onClick={() => navigate('settings')}>
          <Icon name="haze" size={20} />
          <span class="grow">{why}</span>
          <Icon name="chevron-right" size={18} />
        </button>
      )}

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

      {skyRows.length > 0 && (
        <ChartCard
          title="Mood by weather"
          sub="Your average mood under each kind of sky."
          table={{ head: ['Sky', 'Mood', 'Entries'], rows: skyRows.map((g) => [g.name, fmtMood(g.mood), g.n]) }}
        >
          <MoodRows rows={skyRows.map((g) => ({ label: g.name, icon: g.icon, mood: g.mood, n: g.n }))} />
        </ChartCard>
      )}

      {w.temps.length > 0 && (
        <ChartCard
          title="Mood by temperature"
          sub="The temperature when you wrote, or the day’s high."
          table={{ head: ['Temperature', 'Mood', 'Entries'], rows: w.temps.map((b) => [b.name, fmtMood(b.mood), b.n]) }}
        >
          <MoodRows rows={w.temps.map((b) => ({ label: b.name, mood: b.mood, n: b.n }))} />
        </ChartCard>
      )}

      {w.light.length > 0 && (
        <ChartCard
          title="Mood by daylight"
          sub="Hours between sunrise and sunset on the day."
          table={{ head: ['Daylight', 'Mood', 'Entries'], rows: w.light.map((b) => [b.name, fmtMood(b.mood), b.n]) }}
        >
          <MoodRows rows={w.light.map((b) => ({ label: b.name, mood: b.mood, n: b.n }))} />
        </ChartCard>
      )}

      {w.dark.some((d) => d.n > 0) && (
        <ChartCard
          title="Daylight or dark"
          sub="Whether the sun was up when you checked in."
          table={{ head: ['When', 'Mood', 'Entries'], rows: w.dark.map((d) => [d.name, fmtMood(d.mood), d.n]) }}
        >
          <MoodRows rows={w.dark.map((d, i) => ({ label: d.name, icon: i ? 'moon' : 'sun', mood: d.mood, n: d.n }))} />
        </ChartCard>
      )}

      {w.places.length > 0 && (
        <ChartCard
          title="Places"
          sub="Where you wrote, in the colour of what you felt there."
          table={{ head: ['Place', 'Mood', 'Entries'], rows: w.places.map((p) => [p.name, fmtMood(p.mood), p.n]) }}
        >
          <PlaceMap pins={pins} still onTap={() => navigate('map')} class="map-preview" />
          <MoodRows rows={w.places.slice(0, 8).map((p) => ({ label: p.name, core: p.core, mood: p.mood, n: p.n }))} />
          <button class="btn btn-quiet block map-open" onClick={() => navigate('map')}><Icon name="map" size={18} /> Open the map</button>
        </ChartCard>
      )}
    </RevealStack>
  );
}
