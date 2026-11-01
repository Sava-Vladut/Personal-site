// A game's colour, taken from its Twitch box art: the vivid pixels averaged, then eased to a lightness that reads as a
// bar on both the light and the dark page. Twitch's image CDN allows reading them (Access-Control-Allow-Origin: *).
// Worked out once per cover and remembered on this device.
import { useEffect, useState } from 'preact/hooks';

const KEY = 'sr-art-colors';
const known = new Map<string, string | null>();
try {
  for (const [url, c] of Object.entries(JSON.parse(localStorage.getItem(KEY) || '{}') as Record<string, string>)) known.set(url, c);
} catch {}
const loading = new Set<string>();
const subs = new Set<() => void>();

function remember() {
  try {
    const out: Record<string, string> = {};
    for (const [url, c] of known) if (c) out[url] = c;
    localStorage.setItem(KEY, JSON.stringify(out));
  } catch {}
}

/** The colour of an image, or null when it's all greys. */
export function colorOfPixels(px: Uint8ClampedArray) {
  let r = 0, g = 0, b = 0, w = 0;
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] < 128) continue;
    const R = px[i], G = px[i + 1], B = px[i + 2];
    const max = Math.max(R, G, B), min = Math.min(R, G, B);
    const sat = max ? (max - min) / max : 0;
    // vivid, not too dark pixels count most: a cover's colour, not its black background
    const k = sat * sat * (max / 255) + 0.002;
    r += R * k; g += G * k; b += B * k; w += k;
  }
  if (!w) return null;
  [r, g, b] = [r / w / 255, g / w / 255, b / w / 255];
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2, dl = max - min;
  if (dl < 0.04) return null;
  const s = dl / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / dl + 6) % 6 : max === g ? (b - r) / dl + 2 : (r - g) / dl + 4;
  const hue = Math.round(h * 60);
  return `hsl(${hue} ${Math.round(Math.min(80, Math.max(42, s * 100)))}% ${Math.round(Math.min(62, Math.max(48, l * 100)))}%)`;
}

function load(url: string) {
  if (known.has(url) || loading.has(url) || typeof Image === 'undefined') return;
  loading.add(url);
  const img = new Image();
  img.crossOrigin = 'anonymous';
  img.decoding = 'async';
  const done = (c: string | null) => {
    loading.delete(url);
    known.set(url, c);
    remember();
    subs.forEach((f) => f());
  };
  img.onload = () => {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 13;
      canvas.height = 18;
      const x = canvas.getContext('2d', { willReadFrequently: true });
      if (!x) return done(null);
      x.drawImage(img, 0, 0, 13, 18);
      done(colorOfPixels(x.getImageData(0, 0, 13, 18).data));
    } catch {
      done(null);
    }
  };
  img.onerror = () => done(null);
  img.src = url;
}

/** Box art URL → its colour, for those worked out so far; the rest are worked out and the caller drawn again. */
export function useArtColors(urls: string[]) {
  const [, redraw] = useState(0);
  const list = urls.join('\n');
  useEffect(() => {
    const f = () => redraw((n) => n + 1);
    subs.add(f);
    for (const url of urls) load(url);
    return () => void subs.delete(f);
  }, [list]);
  const out = new Map<string, string>();
  for (const url of urls) {
    const c = known.get(url);
    if (c) out.set(url, c);
  }
  return out;
}
