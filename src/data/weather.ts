// WMO weather codes, as Open-Meteo reports them, in words and in the groups the stats compare.
import type { UiName as IconName } from '../components/icons';

export type SkyGroup = 'clear' | 'partly' | 'overcast' | 'fog' | 'rain' | 'snow' | 'storm';

export const SKY_GROUPS: { id: SkyGroup; name: string; icon: IconName }[] = [
  { id: 'clear', name: 'Clear', icon: 'sun' },
  { id: 'partly', name: 'Partly cloudy', icon: 'haze' },
  { id: 'overcast', name: 'Overcast', icon: 'cloud' },
  { id: 'fog', name: 'Fog', icon: 'mist' },
  { id: 'rain', name: 'Rain', icon: 'cloud-rain' },
  { id: 'snow', name: 'Snow', icon: 'cloud-snow' },
  { id: 'storm', name: 'Thunderstorm', icon: 'cloud-storm' },
];

const NAMES: Record<number, string> = {
  0: 'Clear', 1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast', 45: 'Fog', 48: 'Freezing fog',
  51: 'Light drizzle', 53: 'Drizzle', 55: 'Heavy drizzle', 56: 'Freezing drizzle', 57: 'Freezing drizzle',
  61: 'Light rain', 63: 'Rain', 65: 'Heavy rain', 66: 'Freezing rain', 67: 'Freezing rain',
  71: 'Light snow', 73: 'Snow', 75: 'Heavy snow', 77: 'Snow grains',
  80: 'Light showers', 81: 'Showers', 82: 'Heavy showers', 85: 'Snow showers', 86: 'Heavy snow showers',
  95: 'Thunderstorm', 96: 'Thunderstorm with hail', 99: 'Thunderstorm with hail',
};

export function skyGroup(code: number): SkyGroup {
  if (code <= 1) return 'clear';
  if (code === 2) return 'partly';
  if (code === 3) return 'overcast';
  if (code === 45 || code === 48) return 'fog';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if (code >= 95) return 'storm';
  return 'rain';
}

export const weatherName = (code: number) => NAMES[code] ?? SKY_GROUPS.find((g) => g.id === skyGroup(code))!.name;

/** A clear or partly cloudy sky after dark shows the moon. */
export function weatherIcon(code: number, dark?: boolean): IconName {
  const g = skyGroup(code);
  if (dark && g === 'clear') return 'moon';
  if (dark && g === 'partly') return 'cloud';
  return SKY_GROUPS.find((x) => x.id === g)!.icon;
}

export const fmtTemp = (t: number) => `${Math.round(t) === 0 ? 0 : Math.round(t)}°`;
