import { useMemo, useState } from 'preact/hooks';
import { navigate } from '../../lib/router';
import { fmtMood, placeInsights, weatherStats, type Stats as S } from '../../lib/stats';
import { useSettings } from '../../lib/store';
import { ChartCard, MoodRows, RevealStack } from '../../components/charts';
import { Icon, Sprite } from '../../components/icons';
import { PlaceMap } from '../../components/PlaceMap';
import { SpotSheet, heatPins } from '../Places';
import { Tile } from './parts';
import { count, t } from '../../lib/i18n';

/** Kilometres between two points, along the ground. */
function km(a: { lat: number; lon: number }, b: { lat: number; lon: number }) {
  const r = Math.PI / 180;
  const h = Math.sin(((b.lat - a.lat) * r) / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(((b.lon - a.lon) * r) / 2) ** 2;
  return 12_742 * Math.asin(Math.sqrt(h));
}
const fmtKm = (d: number) => (d < 10 ? `${d.toFixed(1)} km` : `${Math.round(d).toLocaleString()} km`);

/** Where you wrote, in the range: the heat map you can move around, and how each place went. */
export function MapTab({ s }: { s: S }) {
  const settings = useSettings();
  const w = useMemo(() => weatherStats(s.list), [s]);
  const notes = useMemo(() => placeInsights(w), [w]);
  const located = useMemo(() => s.list.filter((e) => e.place), [s]);
  const pins = useMemo(() => heatPins(located), [located]);
  const [open, setOpen] = useState<string[] | null>(null);

  if (!located.length)
    return (
      <div class="card weather-empty">
        <span class="weather-empty-ico"><Icon name="map-pin" size={26} /></span>
        <h2 class="title-s">{t('No places yet')}</h2>
        <p>{settings.places ? t('Entries you write from now on will show up here, where you wrote them.') : t('Turn on Places in Settings, and the entries you write will show up here, where you wrote them.')}</p>
        {!settings.places && <button class="btn btn-primary" onClick={() => navigate('settings')}>{t('Open Settings')}</button>}
      </div>
    );

  const top = w.places[0];
  const best = w.places.filter((p) => p.n >= 2 && p.mood !== null).sort((a, b) => b.mood! - a.mood!)[0];
  const far = w.places.reduce((a, p) => (km(top, p) > km(top, a) ? p : a), top);

  return (
    <>
      <RevealStack>
        <div class="tiles">
          <Tile k={0} icon="map-pins" label={t('Places')} value={w.places.length} sub={t('{n} of {count}', { n: w.located, count: count(w.total, 'entry', 'entries') })} meter={w.located / w.total} />
          <Tile k={1} icon="home" label={t('Most often')} small value={top.name} sub={count(top.n, 'entry', 'entries')} />
          <Tile k={2} icon="star" label={t('Felt best')} small value={best?.name ?? '—'} sub={best ? t('{mood} on average', { mood: fmtMood(best.mood) }) : t('needs 2 entries in a place')} />
          <Tile k={3} icon="current-location" label={t('Farthest out')} value={far === top ? '—' : fmtKm(km(top, far))} sub={far === top ? t('all in one place') : t('{place}, from {home}', { place: far.name, home: top.name })} />
        </div>

        <section class="card chart-card wide st-map">
          <header class="chart-head">
            <div>
              <h3 class="chart-title">{t('Your map')}</h3>
              <p class="chart-sub">{t('Where you wrote, glowing brighter where it was recent and strong. Tap a spot to see what you wrote there.')}</p>
            </div>
            <button class="icon-btn small" aria-label={t('Full screen')} title={t('Full screen')} onClick={() => navigate('map')}>
              <Icon name="maximize" size={18} />
            </button>
          </header>
          <PlaceMap pins={pins} onOpen={setOpen} heat class="st-map-view" />
        </section>

        {notes.length > 0 && (
          <section class="card insights">
            <h3 class="chart-title"><Icon name="sparkles" size={16} /> {t('What stands out')}</h3>
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

        <ChartCard
          title={t('Places')}
          sub={t('Your average mood in each place, in the colour of what you felt there.')}
          table={{ head: [t('Place'), t('Mood'), t('Entries')], rows: w.places.map((p) => [p.name, fmtMood(p.mood), p.n]) }}
        >
          <MoodRows rows={w.places.slice(0, 12).map((p) => ({ label: p.name, core: p.core, mood: p.mood, n: p.n }))} />
        </ChartCard>
      </RevealStack>
      <SpotSheet ids={open} located={located} onClose={() => setOpen(null)} />
    </>
  );
}
