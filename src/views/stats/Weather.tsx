import { useContext, useMemo } from 'preact/hooks';
import { coreOf } from '../../data/emotions';
import { fmtTemp } from '../../data/weather';
import { navigate } from '../../lib/router';
import { fmtMood, pct, weatherInsights, weatherStats, type Stats as S } from '../../lib/stats';
import { useSettings } from '../../lib/store';
import { MoodRows, RevealStack } from '../../components/charts';
import { AsciiCloud, type Weather as Sky } from '../../components/AsciiCloud';
import { Icon } from '../../components/icons';
import { PlaceMap, type Pin } from '../../components/PlaceMap';
import { Readout, Section, Story, Worlds } from './parts';
import { count, t } from '../../lib/i18n';

const hours = (h: number | null) => (h === null ? '—' : `${h.toFixed(1)} h`);

/** Each kind of sky, drawn as the journal's little clouds draw the weather. */
const SKY: Record<string, Sky> = { clear: 'sun', rain: 'rain', storm: 'storm' };

export function Weather({ s }: { s: S }) {
  const settings = useSettings();
  const lead = useContext(Worlds)[0] ?? 'calm-safety';
  const cloud = (id: string, seed: number, cols = 9) => <AsciiCloud world={lead} weather={SKY[id] ?? 'drift'} seed={seed} cols={cols} rest />;
  const w = useMemo(() => weatherStats(s.list), [s]);
  const notes = useMemo(() => weatherInsights(w), [w]);
  const pins = useMemo<Pin[]>(
    () => s.list.filter((e) => e.place).map((e) => ({ id: e.id, lat: e.place!.lat, lon: e.place!.lon, core: e.emotions[0] ? coreOf(e.emotions[0]).id : null })),
    [s],
  );

  const why = !settings.weather
    ? t('Turn on Weather in Settings to see how the sky, the temperature and the length of the day go with your mood.')
    : !settings.home && !settings.places
      ? t('Set your home in Settings, so the weather can be added to your entries.')
      : t('The weather is being added to your entries. It needs a connection, so check back in a moment.');

  if (!w.covered && !w.located)
    return (
      <div class="card weather-empty">
        <span class="weather-empty-ico"><Icon name="haze" size={26} /></span>
        <h2 class="title-s">{t('No weather yet')}</h2>
        <p>{why}</p>
        <button class="btn btn-primary" onClick={() => navigate('settings')}>{t('Open Settings')}</button>
      </div>
    );

  const common = [...w.sky].sort((a, b) => b.entries - a.entries)[0];
  const skyRows = w.sky.filter((g) => g.n > 0);

  return (
    <RevealStack>
      {w.covered ? (
        <div class="st-readouts">
          <Readout k={0} label={t('Most common sky')} small value={common.name} lead={cloud(common.id, 3, 12)} sub={t('{share} of entries', { share: pct(common.entries / w.covered) })} />
          <Readout k={1} label={t('Temperature')} value={w.temp === null ? '—' : fmtTemp(w.temp)} sub={t('on average')} />
          <Readout k={2} label={t('Daylight')} value={hours(w.daylight)} sub={t('a day, on average')} meter={w.daylight === null ? undefined : w.daylight / 24} />
          <Readout k={3} label={t('Places')} value={w.places.length} sub={t('{n} of {count}', { n: w.located, count: count(w.total, 'entry', 'entries') })} meter={w.total ? w.located / w.total : 0} />
        </div>
      ) : (
        <button class="card weather-hint" onClick={() => navigate('settings')}>
          <Icon name="haze" size={20} />
          <span class="grow">{why}</span>
          <Icon name="chevron-right" size={18} />
        </button>
      )}

      {notes.length > 0 && <Story title={t('What stands out')} notes={notes} />}

      {skyRows.length > 0 && (
        <Section
          title={t('Mood by weather')}
          sub={t('Your average mood under each kind of sky.')}
          table={{ head: [t('Sky'), t('Mood'), t('Entries')], rows: skyRows.map((g) => [g.name, fmtMood(g.mood), g.n]) }}
        >
          <MoodRows rows={skyRows.map((g, i) => ({ label: g.name, lead: cloud(g.id, i * 5), mood: g.mood, n: g.n }))} />
        </Section>
      )}

      {w.temps.length > 0 && (
        <Section
          title={t('Mood by temperature')}
          sub={t('The temperature when you wrote, or the day’s high.')}
          table={{ head: [t('Temperature'), t('Mood'), t('Entries')], rows: w.temps.map((b) => [b.name, fmtMood(b.mood), b.n]) }}
        >
          <MoodRows rows={w.temps.map((b) => ({ label: b.name, mood: b.mood, n: b.n }))} />
        </Section>
      )}

      {w.light.length > 0 && (
        <Section
          title={t('Mood by daylight')}
          sub={t('Hours between sunrise and sunset on the day.')}
          table={{ head: [t('Daylight'), t('Mood'), t('Entries')], rows: w.light.map((b) => [b.name, fmtMood(b.mood), b.n]) }}
        >
          <MoodRows rows={w.light.map((b) => ({ label: b.name, mood: b.mood, n: b.n }))} />
        </Section>
      )}

      {w.dark.some((d) => d.n > 0) && (
        <Section
          title={t('Daylight or dark')}
          sub={t('Whether the sun was up when you checked in.')}
          table={{ head: [t('When'), t('Mood'), t('Entries')], rows: w.dark.map((d) => [d.name, fmtMood(d.mood), d.n]) }}
        >
          <MoodRows rows={w.dark.map((d, i) => (i ? { label: d.name, icon: 'moon', mood: d.mood, n: d.n } : { label: d.name, lead: cloud('clear', 11), mood: d.mood, n: d.n }))} />
        </Section>
      )}

      {w.places.length > 0 && (
        <Section
          title={t('Places')}
          sub={t('Where you wrote, in the colour of what you felt there.')}
          table={{ head: [t('Place'), t('Mood'), t('Entries')], rows: w.places.map((p) => [p.name, fmtMood(p.mood), p.n]) }}
        >
          <PlaceMap pins={pins} still onTap={() => navigate('map')} class="map-preview" />
          <MoodRows rows={w.places.slice(0, 8).map((p) => ({ label: p.name, core: p.core, mood: p.mood, n: p.n }))} />
          <button class="btn btn-quiet block map-open" onClick={() => navigate('map')}><Icon name="map" size={18} /> {t('Open the map')}</button>
        </Section>
      )}
    </RevealStack>
  );
}
