// The colours a note's words can be written in, and highlighted with. A note keeps them as a little HTML, the way
// Obsidian and most Markdown readers show coloured words: <span style="color:red">words</span> and
// <mark style="background:lightgreen">words</mark> (plain ==words== stays the yellow highlight). Only these names, in
// exactly that form, read as a colour; anything else stays the text it is. The names are CSS colours, so other apps
// show something close; this app draws each one from its theme's colours (styles/notes.css), in light and dark.

/** Font colours, by their CSS name. */
export const TEXT_COLORS = ['red', 'orange', 'green', 'blue', 'purple', 'gray'] as const;
export type TextColor = (typeof TEXT_COLORS)[number];

/** Highlight colours besides the yellow of ==words==, by their CSS name (light ones, so dark words read on them). */
export const HIGHLIGHTS = ['lightgreen', 'lightblue', 'pink', 'plum', 'lightsalmon', 'lightgray'] as const;
export type HighlightColor = (typeof HIGHLIGHTS)[number];

export const isTextColor = (c: unknown): c is TextColor => (TEXT_COLORS as readonly unknown[]).includes(c);
export const isHighlight = (c: unknown): c is HighlightColor => (HIGHLIGHTS as readonly unknown[]).includes(c);

/* ---------- other apps' colours, to the nearest of ours (pasting) ---------- */

const NAMED: Record<string, string> = {
  black: '000000', white: 'ffffff', red: 'ff0000', darkred: '8b0000', maroon: '800000', crimson: 'dc143c', orange: 'ffa500',
  darkorange: 'ff8c00', yellow: 'ffff00', gold: 'ffd700', olive: '808000', lime: '00ff00', green: '008000', darkgreen: '006400',
  lightgreen: '90ee90', teal: '008080', cyan: '00ffff', aqua: '00ffff', turquoise: '40e0d0', blue: '0000ff', navy: '000080',
  darkblue: '00008b', lightblue: 'add8e6', purple: '800080', violet: 'ee82ee', magenta: 'ff00ff', fuchsia: 'ff00ff',
  plum: 'dda0dd', pink: 'ffc0cb', lightsalmon: 'ffa07a', brown: 'a52a2a', gray: '808080', grey: '808080', silver: 'c0c0c0',
  lightgray: 'd3d3d3', lightgrey: 'd3d3d3', darkgray: 'a9a9a9', darkgrey: 'a9a9a9',
  // Word's highlighter names (mso-highlight)
  darkcyan: '008b8b', darkmagenta: '8b008b', darkyellow: '808000',
};

/** A CSS colour as [hue 0–360, saturation 0–1, lightness 0–1], or null (unknown, or see-through). */
export function hsl(css: string): [number, number, number] | null {
  const v = css.trim().toLowerCase();
  let r: number, g: number, b: number;
  const hex = (NAMED[v] ? '#' + NAMED[v] : v).match(/^#([0-9a-f]{3}|[0-9a-f]{6})$/);
  const rgb = v.match(/^rgba?\(\s*(\d+(?:\.\d+)?)[\s,]+(\d+(?:\.\d+)?)[\s,]+(\d+(?:\.\d+)?)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/);
  if (hex) {
    const h = hex[1].length === 3 ? [...hex[1]].map((c) => c + c).join('') : hex[1];
    [r, g, b] = [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16));
  } else if (rgb) {
    if (rgb[4] !== undefined && parseFloat(rgb[4]) === 0) return null;
    [r, g, b] = [rgb[1], rgb[2], rgb[3]].map(Number);
  } else return null;
  [r, g, b] = [r / 255, g / 255, b / 255];
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  const d = max - min;
  if (!d) return [0, 0, l];
  const s = d / (1 - Math.abs(2 * l - 1));
  const h = max === r ? ((g - b) / d + 6) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

/** Which family a hue is: red, orange, yellow, green, blue, purple or pink. */
const family = (h: number) =>
  h < 15 || h >= 345 ? 'red' : h < 40 ? 'orange' : h < 65 ? 'yellow' : h < 170 ? 'green' : h < 255 ? 'blue' : h < 300 ? 'purple' : 'pink';

/**
 * The font colour nearest a pasted one, or null: black, white and the near-black most pages write everything in are
 * the automatic colour, and yellow words can't be read on the page.
 */
export function textColorNear(css: string): TextColor | null {
  const c = hsl(css);
  if (!c) return null;
  const [h, s, l] = c;
  if (l < 0.15 || l > 0.9) return null;
  if (s < 0.2) return l >= 0.45 && l <= 0.7 ? 'gray' : null; // not the dark greys pages write their words in
  const f = family(h);
  return f === 'yellow' ? null : f === 'pink' ? (h < 330 ? 'purple' : 'red') : f;
}

/**
 * The highlight nearest a pasted background colour: null for the plain yellow one (yellow, and what doesn't come
 * near any of ours), false for none at all (white, see-through).
 */
export function highlightNear(css: string): HighlightColor | null | false {
  const c = hsl(css);
  if (!c) return /^(transparent|none|inherit|initial|unset|currentcolor)$/i.test(css.trim()) ? false : null;
  const [h, s, l] = c;
  if (l > 0.97) return false;
  if (s < 0.15) return l > 0.2 ? 'lightgray' : null;
  const f = family(h);
  return f === 'orange' ? 'lightsalmon' : f === 'yellow' ? null : f === 'green' ? 'lightgreen' : f === 'blue' ? 'lightblue' : f === 'purple' ? 'plum' : 'pink';
}
