import { useEffect, useRef, useState } from 'preact/hooks';
import { fmtTemp, weatherIcon, weatherName } from '../data/weather';
import { here, locationError, searchPlaces, type FoundPlace } from '../lib/weather';
import type { Entry, Place, Weather } from '../lib/store';
import { Icon } from './icons';
import { Sheet } from './Sheet';

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
  [weatherName(w.code), fmtTemp(w.temp), `${hours(w.daylight)} of daylight`, w.dark === undefined ? '' : w.dark ? 'after dark' : ''].filter(Boolean).join(' · ');

export const placeLabel = (p: Place) => p.name || `${p.lat.toFixed(3)}, ${p.lon.toFixed(3)}`;

/** Pick a home: where you are now, or a town found by name. */
export function HomeSheet({ open, onClose, onPick }: { open: boolean; onClose: () => void; onPick: (p: Place) => void }) {
  const [q, setQ] = useState('');
  const [found, setFound] = useState<FoundPlace[]>([]);
  const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState('');
  const asked = useRef(0);
  const located = useRef(0);

  useEffect(() => {
    if (open) setQ(''), setFound([]), setError('');
    setLocating(false);
    return () => { located.current++; };
  }, [open]);

  useEffect(() => {
    const term = q.trim();
    const n = ++asked.current;
    if (!open || term.length < 2) return setFound([]), setBusy(false);
    setBusy(true);
    const t = setTimeout(() => {
      searchPlaces(term)
        .then((list) => n === asked.current && (setFound(list), setError('')))
        .catch(() => n === asked.current && setError('Couldn’t search right now. Check your connection.'))
        .finally(() => n === asked.current && setBusy(false));
    }, 300);
    return () => { clearTimeout(t); asked.current++; };
  }, [q, open]);

  const useHere = async () => {
    const n = ++located.current;
    setLocating(true);
    setError('');
    try {
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
    <Sheet open={open} onClose={onClose} title={<span class="row gap-s"><Icon name="home" /> Home</span>} label="Home">
      <p class="hint">Used for the weather when an entry has no place saved, and to fill in the weather for older entries.</p>
      <button class="person-pick" onClick={useHere} disabled={locating}>
        <span class="avatar new" style={{ width: 36, height: 36 }}><Icon name="current-location" size={18} /></span>
        <span class="person-pick-main">
          <span class="person-pick-name">{locating ? 'Finding you…' : 'Where I am now'}</span>
          <span class="person-pick-sub">Uses your location once</span>
        </span>
      </button>
      <form class="search home-search" onSubmit={(e) => e.preventDefault()}>
        <Icon name="search" size={18} />
        <input type="search" placeholder="Search for a town or city" value={q} onInput={(e) => setQ(e.currentTarget.value)} aria-label="Search for a town or city" enterkeyhint="search" />
      </form>
      {error && <p class="hint danger" role="alert">{error}</p>}
      <div class="person-picks">
        {found.map((p) => (
          <button class="person-pick" onClick={() => { onPick({ lat: p.lat, lon: p.lon, name: p.name }); onClose(); }}>
            <span class="avatar new" style={{ width: 36, height: 36 }}><Icon name="map-pin" size={18} /></span>
            <span class="person-pick-main">
              <span class="person-pick-name">{p.name}</span>
              {p.detail && <span class="person-pick-sub">{p.detail}</span>}
            </span>
          </button>
        ))}
        {!busy && q.trim().length >= 2 && !found.length && !error && <p class="empty-note center">No places match “{q.trim()}”.</p>}
      </div>
      <p class="credit">Place search from Open-Meteo.</p>
    </Sheet>
  );
}
