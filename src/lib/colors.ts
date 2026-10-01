// The colour of a picture, for things drawn in it: a book's spine takes its cover's colour. Pictures are read through
// a tiny canvas (Open Library and Spotify both allow it), and the answers are kept so each is only worked out once.
import { useEffect, useState } from 'preact/hooks';

const KEY = 'mm-colors';
const MAX = 600;

let saved: Record<string, string> = Object.create(null);
try {
  const raw = JSON.parse(localStorage.getItem(KEY) || '{}');
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const [url, value] of Object.entries(raw).slice(-MAX)) {
      if (typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value)) saved[url] = value;
    }
  }
} catch {}
const pending = new Map<string, Promise<string | null>>();
let writeTimer: ReturnType<typeof setTimeout> | undefined;

function remember(url: string, hex: string) {
  saved[url] = hex;
  const keys = Object.keys(saved);
  if (keys.length > MAX) keys.slice(0, keys.length - MAX).forEach((k) => delete saved[k]);
  clearTimeout(writeTimer);
  writeTimer = setTimeout(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(saved));
    } catch {}
  }, 500);
}

const hex = (r: number, g: number, b: number) => '#' + [r, g, b].map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');

function rgbToHsl(r: number, g: number, b: number) {
  r /= 255, g /= 255, b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h / 6, s, l];
}
function hslToRgb(h: number, s: number, l: number) {
  const f = (n: number) => {
    const k = (n + h * 12) % 12;
    return 255 * (l - s * Math.min(l, 1 - l) * Math.max(-1, Math.min(k - 3, 9 - k, 1)));
  };
  return [f(0), f(8), f(4)];
}

/**
 * The colour a picture reads as: the most common hue among its livelier pixels (a plain average turns everything
 * brown), kept within the range a dyed cloth could be.
 */
function dominant(data: Uint8ClampedArray) {
  type Sum = { w: number; r: number; g: number; b: number };
  const buckets: Sum[] = Array.from({ length: 18 }, () => ({ w: 0, r: 0, g: 0, b: 0 }));
  const all: Sum = { w: 0, r: 0, g: 0, b: 0 };
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    const [r, g, b] = [data[i], data[i + 1], data[i + 2]];
    all.w++, all.r += r, all.g += g, all.b += b;
    const [h, s, l] = rgbToHsl(r, g, b);
    if (s < 0.25 || l < 0.12 || l > 0.9) continue;
    const x = buckets[Math.round(h * 18) % 18]; // livelier pixels count for more
    x.w += s, x.r += r * s, x.g += g * s, x.b += b * s;
  }
  const best = buckets.reduce((a, b) => (b.w > a.w ? b : a));
  const src = best.w > all.w * 0.08 ? best : all; // a picture that's mostly grey stays grey
  if (!src.w) return null;
  const [h, s, l] = rgbToHsl(src.r / src.w, src.g / src.w, src.b / src.w);
  const [r, g, b] = hslToRgb(h, Math.min(s, 0.62), Math.min(0.62, Math.max(0.2, l)));
  return hex(r, g, b);
}

/** The colour of the picture at `url`, or null if it can't be read. */
export function colorOf(url: string): Promise<string | null> {
  if (saved[url]) return Promise.resolve(saved[url]);
  let p = pending.get(url);
  if (!p) {
    p = new Promise<string | null>((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.referrerPolicy = 'no-referrer';
      img.onload = () => {
        try {
          const c = document.createElement('canvas');
          c.width = 16;
          c.height = 24;
          const ctx = c.getContext('2d', { willReadFrequently: true })!;
          ctx.drawImage(img, 0, 0, c.width, c.height);
          const out = dominant(ctx.getImageData(0, 0, c.width, c.height).data);
          if (out) remember(url, out);
          resolve(out);
        } catch {
          resolve(null);
        }
      };
      img.onerror = () => resolve(null);
      img.src = url;
    }).finally(() => pending.delete(url));
    pending.set(url, p);
  }
  return p;
}

/** The colour of a picture, once known (straight away if it was worked out before). */
export function useColor(url: string | null | undefined) {
  const [c, setC] = useState(() => (url ? saved[url] ?? null : null));
  useEffect(() => {
    if (!url) return setC(null);
    if (saved[url]) return setC(saved[url]);
    setC(null);
    let live = true;
    colorOf(url).then((x) => live && setC(x));
    return () => void (live = false);
  }, [url]);
  return c;
}

/** Whether light or dark ink reads better on a colour. */
export function isLight(hexColor: string) {
  const n = parseInt(hexColor.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.32;
}

/** A small stable number for a string, for choosing among a few looks. */
export function hashOf(s: string) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}
