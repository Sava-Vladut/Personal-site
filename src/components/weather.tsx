import { useEffect, useRef, useState } from 'preact/hooks';
import { fmtTemp, weatherIcon, weatherName } from '../data/weather';
import { here, locate, locationError, placeName, searchPlaces, type FoundPlace } from '../lib/weather';
import { getSettings, normalizePlace, type Entry, type Place, type Weather } from '../lib/store';
import { Icon } from './icons';
import { PlaceMap } from './PlaceMap';
import { Sheet } from './Sheet';
import { t } from '../lib/i18n';

/** The entry's weather, if it's for the entry's own day. */
export const weatherOf = (e: Entry): Weather | null => (e.weather && e.weather.day === e.date ? e.weather : null);

/** "☀ 21°": the sky as an icon and the temperature. */
export function WeatherMark({ w, size = 13 }: { w: Weather; size?: number }) {
  const name = weatherName(w.code);
  return (
    <span class="wx" title={`${name}, ${fmtTemp(w.temp)}`} aria-label={`${name}, ${fmtTemp(w.temp)}`}>
      <Icon name={weatherIcon(w.code, w.dark)} size={size} />{fmtTemp(w.temp)}
    </span>
  );
}

const hours = (h: number) => {
  const m = Math.round(h * 60);
  return `${Math.floor(m / 60)} h${m % 60 ? ` ${m % 60} min` : ''}`;
};

/** "Partly cloudy · 21° · 12 h 20 min of daylight · after dark" */
export const weatherLine = (w: Weather) =>
  [weatherName(w.code), fmtTemp(w.temp), t('{hours} of daylight', { hours: hours(w.daylight) }), w.dark === undefined ? '' : w.dark ? t('after dark') : ''].filter(Boolean).join(' · ');

export const placeLabel = (p: Place) => p.name || `${p.lat.toFixed(3)}, ${p.lon.toFixed(3)}`;

/** Latitude and longitude typed or pasted as "46.77, 23.59" (a map app's copied position, or "46.77 N 23.59 E"). */
export function parseCoords(q: string): { lat: number; lon: number } | null {
  const m = /^\s*(-?\d{1,3}(?:[.,]\d+)?)\s*°?\s*([NS])?\s*[,;\s]\s*(-?\d{1,3}(?:[.,]\d+)?)\s*°?\s*([EW])?\s*$/i.exec(q);
  if (!m) return null;
  const lat = parseFloat(m[1].replace(',', '.')) * (m[2]?.toUpperCase() === 'S' ? -1 : 1);
  const lon = parseFloat(m[3].replace(',', '.')) * (m[4]?.toUpperCase() === 'W' ? -1 : 1);
  const p = normalizePlace({ lat, lon, name: '' });
  return p && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 ? { lat: p.lat, lon: p.lon } : null;
}

type Spot = { lat: number; lon: number };

/**
 * Pick a place: where you are now, a town found by name, exact coordinates, or a pin dropped on the map.
 * On the map, the others move the pin instead of picking, so it can be set just so. Used for the home and for a note's place.
 */
export function HomeSheet({ open, onClose, onPick, kind = 'home', current }: {
  open: boolean;
  onClose: () => void;
  onPick: (p: Place) => void;
  kind?: 'home' | 'place';
  /** the place picked now, where the map starts */
  current?: Place | null;
}) {
  const [q, setQ] = useState('');
  const [onMap, setOnMap] = useState(false);
  const [pin, setPin] = useState<Spot | null>(null);
  // where the map is centred: a new one (a found town, where you are) remounts it there
  const [view, setView] = useState<{ at: (Spot & { z: number }) | null; n: number }>({ at: null, n: 0 });
  const [found, setFound] = useState<FoundPlace[]>([]);
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState('');
  const asked = useRef(0);
  const located = useRef(0);

  useEffect(() => {
    if (open) setQ(''), setFound([]), setError(''), setOnMap(false);
    setLocating(false);
    return () => { located.current++; };
  }, [open]);

  useEffect(() => {
    const term = q.trim();
    const n = ++asked.current;
    if (!open || term.length < 2) return setFound([]), setBusy(false);
    setBusy(true);
    const timer = setTimeout(() => {
      searchPlaces(term)
        .then((list) => n === asked.current && (setFound(list), setError('')))
        .catch(() => n === asked.current && setError(t('Couldn’t search right now. Check your connection.')))
        .finally(() => n === asked.current && setBusy(false));
    }, 300);
    return () => { clearTimeout(timer); asked.current++; };
  }, [q, open]);

  const coords = parseCoords(q);
  const movePin = (to: Spot, z = 15) => {
    setPin(to);
    setView((v) => ({ at: { ...to, z }, n: v.n + 1 }));
    setQ('');
  };
  const openMap = () => {
    const start = current ?? getSettings().home;
    setPin(current ? { lat: current.lat, lon: current.lon } : null);
    setView((v) => ({ at: start ? { lat: start.lat, lon: start.lon, z: current ? 15 : 12 } : null, n: v.n + 1 }));
    setQ('');
    setError('');
    setOnMap(true);
  };
  /** Names a spot and picks it. */
  const pickSpot = async (spot: Spot) => {
    const p = normalizePlace({ ...spot, name: '' });
    if (!p) return;
    const n = ++located.current;
    setLocating(true);
    setError('');
    const name = await placeName(p.lat, p.lon).catch(() => '');
    if (n !== located.current) return;
    setLocating(false);
    onPick({ ...p, name });
    onClose();
  };
  const useCoords = () => coords && (onMap ? movePin(coords) : pickSpot(coords));

  const useHere = async () => {
    const n = ++located.current;
    setLocating(true);
    setError('');
    try {
      if (onMap) {
        const spot = await locate();
        if (n === located.current) movePin(spot);
        return;
      }
      const place = await here();
      if (n !== located.current) return;
      onPick(place);
      onClose();
    } catch (e) {
      if (n === located.current) setError(locationError(e));
    } finally {
      if (n === located.current) setLocating(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      tall={onMap}
      title={<span class="row gap-s"><Icon name={kind === 'home' ? 'home' : 'map-pin'} /> {kind === 'home' ? t('Home') : t('Place')}</span>}
      label={kind === 'home' ? t('Home') : t('Place')}
      footer={onMap ? (
        <>
          <span class="foot-note">{pin ? `${pin.lat.toFixed(3)}, ${pin.lon.toFixed(3)}` : t('Tap the map to put the pin there')}</span>
          <button class="btn btn-primary" disabled={!pin || locating} onClick={() => pin && pickSpot(pin)}>{locating ? t('Finding it…') : t('Use this place')}</button>
        </>
      ) : undefined}
    >
      {onMap && <button class="back-link" onClick={() => setOnMap(false)}><Icon name="chevron-left" size={18} /> {t('Back')}</button>}
      {kind === 'home' && !onMap && <p class="hint">{t('Used for the weather when an entry has no place saved, and to fill in the weather for older entries.')}</p>}
      <button class="person-pick" onClick={useHere} disabled={locating}>
        <span class="avatar new" style={{ width: 36, height: 36 }}><Icon name="current-location" size={18} /></span>
        <span class="person-pick-main">
          <span class="person-pick-name">{locating ? t('Finding you…') : t('Where I am now')}</span>
          <span class="person-pick-sub">{t('Uses your location once')}</span>
        </span>
      </button>
      {!onMap && (
        <button class="person-pick" onClick={openMap}>
          <span class="avatar new" style={{ width: 36, height: 36 }}><Icon name="map" size={18} /></span>
          <span class="person-pick-main">
            <span class="person-pick-name">{t('Pick on the map')}</span>
            <span class="person-pick-sub">{t('Put a pin exactly where it was')}</span>
          </span>
        </button>
      )}
      <form class="search home-search" onSubmit={(e) => e.preventDefault()}>
        <Icon name="search" size={18} />
        <input type="search" placeholder={t('Search for a town or city, or type coordinates')} value={q} onInput={(e) => setQ(e.currentTarget.value)} aria-label={t('Search for a town or city, or type coordinates')} enterkeyhint="search" />
      </form>
      {error && <p class="hint danger" role="alert">{error}</p>}
      <div class="person-picks">
        {coords && (
          <button class="person-pick" onClick={useCoords} disabled={locating}>
            <span class="avatar new" style={{ width: 36, height: 36 }}><Icon name="map-pin" size={18} /></span>
            <span class="person-pick-main">
              <span class="person-pick-name">{t('Use these coordinates')}</span>
              <span class="person-pick-sub">{coords.lat.toFixed(3)}, {coords.lon.toFixed(3)}</span>
            </span>
          </button>
        )}
        {found.map((p) => (
          <button class="person-pick" onClick={() => (onMap ? movePin(p, 13) : (onPick({ lat: p.lat, lon: p.lon, name: p.name }), onClose()))}>
            <span class="avatar new" style={{ width: 36, height: 36 }}><Icon name="map-pin" size={18} /></span>
            <span class="person-pick-main">
              <span class="person-pick-name">{p.name}</span>
              {p.detail && <span class="person-pick-sub">{p.detail}</span>}
            </span>
          </button>
        ))}
        {!busy && q.trim().length >= 2 && !found.length && !coords && !error && <p class="empty-note center">{t('No places match “{q}”.', { q: q.trim() })}</p>}
      </div>
      {onMap && <PlaceMap key={view.n} pins={[]} focus={view.at} marker={pin} onMarker={setPin} class="place-map" />}
      <p class="credit">{t('Place search from Open-Meteo.')}</p>
    </Sheet>
  );
}
