// The weather and where you were, added to entries when Settings allow it. Weather comes from Open-Meteo (free, no key),
// place names from OpenStreetMap's Nominatim. They're only ever sent coordinates, never anything from the journal.
import { addDays, keyOf, todayKey } from './dates';
import { annotateEntries, getEntries, getSettings, normalizePlace, normalizeWeather, saveEntry, type Entry, type Place, type Weather } from './store';

const FORECAST = 'https://api.open-meteo.com/v1/forecast';
const ARCHIVE = 'https://archive-api.open-meteo.com/v1/archive';
const GEOCODE = 'https://geocoding-api.open-meteo.com/v1/search';
const REVERSE = 'https://nominatim.openstreetmap.org/reverse';
const PAST_DAYS = 60; // the forecast keeps about two months of past days; older ones come from the archive
const NOW_WINDOW = 2 * 3600_000; // an entry this close to now gets the weather as it is now
const samePlace = (a: Place | null | undefined, b: Place | null | undefined) =>
  a?.lat === b?.lat && a?.lon === b?.lon;

async function getJSON(url: string, init: RequestInit = {}) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 15_000);
  try {
    const res = await fetch(url, { ...init, signal: ctl.signal });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

/* ---------- where you are ---------- */

export function locate(): Promise<{ lat: number; lon: number }> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('unsupported'));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lon: p.coords.longitude }),
      reject,
      { enableHighAccuracy: false, maximumAge: 10 * 60_000, timeout: 15_000 },
    );
  });
}

export const locationError = (e: unknown) =>
  (e as GeolocationPositionError | null)?.code === 1
    ? 'Location is blocked for this site. Allow it in your browser’s settings.'
    : 'Couldn’t find where you are right now';

/** "Centru, Cluj-Napoca": the neighbourhood (or village) and the town. */
function nameOf(a: Record<string, string | undefined>) {
  const local = a.suburb ?? a.neighbourhood ?? a.quarter ?? a.city_district ?? a.village ?? a.hamlet;
  const town = a.city ?? a.town ?? a.village ?? a.municipality ?? a.county;
  const parts = [local, town].filter((x, i, all): x is string => !!x && all.indexOf(x) === i);
  return (parts.length ? parts.join(', ') : a.state ?? a.country ?? '').slice(0, 120);
}

const names = new Map<string, Promise<string>>();
let lastLookup = 0;

/** Asks OpenStreetMap what a place is called. At most one lookup a second, as its usage policy asks. */
export function placeName(lat: number, lon: number): Promise<string> {
  const key = `${lat.toFixed(3)},${lon.toFixed(3)}`;
  let p = names.get(key);
  if (!p) {
    const wait = Math.max(0, lastLookup + 1100 - Date.now());
    lastLookup = Date.now() + wait;
    p = new Promise<void>((r) => setTimeout(r, wait))
      .then(() => getJSON(`${REVERSE}?format=jsonv2&zoom=14&lat=${lat}&lon=${lon}&accept-language=${encodeURIComponent(navigator.language || 'en')}`, { referrerPolicy: 'strict-origin' }))
      .then((r) => nameOf(r?.address ?? {}));
    p.catch(() => names.delete(key));
    names.set(key, p);
  }
  return p;
}

/** Where you are now, rounded and named (the name is left empty if the lookup fails). */
export async function here(): Promise<Place> {
  const pos = await locate();
  const p = normalizePlace({ ...pos, name: '' })!;
  return { ...p, name: await placeName(p.lat, p.lon).catch(() => '') };
}

export interface FoundPlace extends Place { detail: string }

/** Towns and cities matching what's typed, for picking a home. */
export async function searchPlaces(q: string): Promise<FoundPlace[]> {
  const r = await getJSON(`${GEOCODE}?count=8&language=en&format=json&name=${encodeURIComponent(q)}`);
  const out: FoundPlace[] = [];
  for (const x of r?.results ?? []) {
    const p = normalizePlace({ lat: x.latitude, lon: x.longitude, name: x.name });
    if (p) out.push({ ...p, detail: [x.admin1, x.country].filter((s) => s && s !== x.name).join(', ') });
  }
  return out;
}

/* ---------- the weather ---------- */

const minutes = (iso: unknown) => {
  const m = typeof iso === 'string' ? /T(\d\d):(\d\d)/.exec(iso) : null;
  return m ? +m[1] * 60 + +m[2] : null;
};

/** Whether it was dark at an entry's time, when its clock time belongs to its day and the sun rose and set that day. */
function darkAt(e: Entry, rise: number | null, set: number | null) {
  const d = new Date(e.time);
  const own = keyOf(d) === e.date;
  if (!own || rise === null || set === null || rise >= set) return {};
  const m = d.getHours() * 60 + d.getMinutes();
  return { dark: m < rise || m >= set };
}

const at = (lat: number, lon: number) => `latitude=${lat}&longitude=${lon}`;

async function weatherNow(p: { lat: number; lon: number }, e: Entry): Promise<Weather> {
  const r = await getJSON(`${FORECAST}?${at(p.lat, p.lon)}&current=temperature_2m,weather_code,is_day&daily=daylight_duration&timezone=auto&forecast_days=1`);
  const c = r?.current;
  const w = normalizeWeather({ day: e.date, code: c?.weather_code, temp: c?.temperature_2m, daylight: (r?.daily?.daylight_duration?.[0] ?? 0) / 3600, dark: c?.is_day === 0 });
  if (!w) throw new Error('No weather');
  return w;
}

interface Day { code: number; temp: number; daylight: number; rise: number | null; set: number | null }

/** Each day's weather at one place: the recent ones from the forecast, older ones (and any it's missing) from the archive. */
async function daysAt(p: { lat: number; lon: number }, days: string[]) {
  const cutoff = addDays(todayKey(), -(PAST_DAYS - 2)); // a day's margin either side for time zones
  const daily = 'daily=weather_code,temperature_2m_max,daylight_duration,sunrise,sunset&timezone=auto';
  const out = new Map<string, Day>();
  const read = (r: any) => {
    const d = r?.daily;
    (d?.time ?? []).forEach((k: string, i: number) => {
      const code = d.weather_code?.[i], temp = d.temperature_2m_max?.[i];
      if (typeof code !== 'number' || typeof temp !== 'number') return;
      out.set(k, { code, temp, daylight: (d.daylight_duration?.[i] ?? 0) / 3600, rise: minutes(d.sunrise?.[i]), set: minutes(d.sunset?.[i]) });
    });
  };
  if (days.some((d) => d >= cutoff)) read(await getJSON(`${FORECAST}?${at(p.lat, p.lon)}&${daily}&past_days=${PAST_DAYS}&forecast_days=1`));
  const rest = days.filter((d) => !out.has(d)).sort();
  // what the archive can't give yet waits for the next try; what the forecast gave is kept either way
  if (rest.length) read(await getJSON(`${ARCHIVE}?${at(p.lat, p.lon)}&${daily}&start_date=${rest[0]}&end_date=${rest[rest.length - 1]}`).catch(() => (out.size ? null : Promise.reject())));
  return out;
}

/* ---------- adding them to entries ---------- */

/** Where you are and the weather there, for an entry about right now. Null when Settings don't ask for either. */
export async function contextNow(e: Entry): Promise<Partial<Entry> | null> {
  const s = getSettings();
  if ((!s.weather && !s.places) || e.date !== todayKey() || Math.abs(Date.now() - e.time) > NOW_WINDOW) return null;
  const patch: Partial<Entry> = {};
  if (s.places && !e.place) patch.place = await here().catch(() => undefined);
  const spot = patch.place ?? e.place ?? s.home;
  if (s.weather && spot) patch.weather = await weatherNow(spot, e).catch(() => undefined);
  const current = getSettings();
  if (!current.places) delete patch.place;
  if (!current.weather || !samePlace(spot, patch.place ?? e.place ?? current.home)) delete patch.weather;
  if (!patch.place) delete patch.place;
  if (!patch.weather) delete patch.weather;
  return Object.keys(patch).length ? patch : null;
}

/** Adds place and weather to an entry that's already saved (a check-in), unless it's been deleted since. */
export async function addContext(e: Entry) {
  const patch = await contextNow(e).catch(() => null);
  const cur = getEntries().find((x) => x.id === e.id);
  if (patch && cur && cur.date === e.date && cur.time === e.time && samePlace(cur.place, e.place)) {
    if (!patch.place && cur.weather && !needsWeather(cur)) delete patch.weather;
    // Weather by itself is an annotation, so a lookup cannot outrank a real edit during sync.
    if (patch.place) await saveEntry({ ...cur, ...patch });
    else if (patch.weather) await annotateEntries(new Map([[cur.id, patch]]));
  }
  if (!patch?.weather) fillWeather();
}

export const needsWeather = (e: Entry) => !e.weather || e.weather.day !== e.date;

let filling: Promise<number> | null = null;

/**
 * Fills in the weather for entries that don't have it yet, or were moved to another day: at the place saved with
 * them, else at home. Looks up names for places saved while offline. Returns how many entries got their weather.
 */
export function fillWeather(): Promise<number> {
  return (filling ??= fill().catch(() => 0).finally(() => (filling = null)));
}

async function fill() {
  const s = getSettings();
  if (!s.weather && !s.places) return 0;
  const today = todayKey();
  let filled = 0;

  if (s.weather) {
    // entries at nearby spots (about 10 km) share one lookup
    const groups = new Map<string, { at: { lat: number; lon: number }; list: Entry[] }>();
    for (const e of getEntries()) {
      const spot = e.place ?? s.home;
      if (!spot || e.date > today || !needsWeather(e)) continue;
      const key = `${spot.lat.toFixed(1)},${spot.lon.toFixed(1)}`;
      const g = groups.get(key) ?? { at: spot, list: [] };
      g.list.push(e);
      groups.set(key, g);
    }
    for (const g of [...groups.values()].sort((a, b) => b.list.length - a.list.length).slice(0, 8)) {
      const days = await daysAt(g.at, [...new Set(g.list.map((e) => e.date))]).catch(() => null);
      if (!days) continue;
      const patches = new Map<string, Partial<Entry>>();
      for (const e of g.list) {
        const d = days.get(e.date);
        const weather = d && normalizeWeather({ day: e.date, code: d.code, temp: d.temp, daylight: d.daylight, ...darkAt(e, d.rise, d.set) });
        if (weather) patches.set(e.id, { weather });
      }
      // only entries still waiting on the same day: one written, synced or moved meanwhile keeps its own
      const current = new Map(getEntries().map((e) => [e.id, e]));
      const original = new Map(g.list.map((e) => [e.id, e]));
      const settings = getSettings();
      for (const [id, p] of [...patches]) {
        const cur = current.get(id);
        const before = original.get(id)!;
        if (!settings.weather || !cur || !needsWeather(cur) || cur.date !== p.weather!.day || cur.time !== before.time ||
          !samePlace(cur.place ?? settings.home, before.place ?? s.home)) patches.delete(id);
      }
      await annotateEntries(patches);
      filled += patches.size;
    }
  }

  const unnamed = getSettings().places ? getEntries().filter((e) => e.place && !e.place.name).slice(0, 5) : [];
  for (const e of unnamed) {
    const name = await placeName(e.place!.lat, e.place!.lon).catch(() => '');
    const cur = getEntries().find((x) => x.id === e.id);
    if (getSettings().places && name && cur?.place && !cur.place.name && samePlace(cur.place, e.place))
      await annotateEntries(new Map([[e.id, { place: { ...cur.place, name } }]]));
  }
  return filled;
}

/**
 * Fills in what's missing once the app has settled, whenever the connection comes back, and when the app is opened
 * again (entries synced from another device may be waiting), at most every ten minutes.
 */
export function startWeather() {
  let last = 0;
  const go = () => {
    if (Date.now() - last < 10 * 60_000) return;
    last = Date.now();
    void fillWeather();
  };
  setTimeout(go, 3000);
  addEventListener('online', () => ((last = 0), go()));
  document.addEventListener('visibilitychange', () => document.visibilityState === 'visible' && go());
}
