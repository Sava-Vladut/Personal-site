// Liquid-glass refraction: bends whatever is behind a glass surface near its rim, like a thick lens.
// Only Chromium accepts SVG filters inside `backdrop-filter`, so elsewhere the surface stays plain
// frosted glass (glass.css). The displacement map is drawn at the element's exact size, so the rim
// band keeps its width on any shape — capsule, circle or card.
import { useLayoutEffect } from 'preact/hooks';

const brands = (navigator as Navigator & { userAgentData?: { brands: { brand: string }[] } }).userAgentData?.brands;
const SUPPORTED = !!brands?.some((b) => b.brand === 'Chromium');
const NS = 'http://www.w3.org/2000/svg';
let defs: SVGSVGElement | null = null;
let count = 0;

function host() {
  if (!defs) {
    defs = document.createElementNS(NS, 'svg');
    defs.setAttribute('aria-hidden', 'true');
    defs.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none';
    document.body.appendChild(defs);
  }
  return defs;
}

/** Red = horizontal push, green = vertical push, neutral grey in the middle so only the rim bends. */
function displacementMap(w: number, h: number, radius: number, band: number) {
  const svg =
    `<svg xmlns="${NS}" width="${w}" height="${h}">` +
    `<defs><linearGradient id="x"><stop offset="0" stop-color="#f00"/><stop offset="1" stop-color="#000"/></linearGradient>` +
    `<linearGradient id="y" x2="0" y2="1"><stop offset="0" stop-color="#0f0"/><stop offset="1" stop-color="#000"/></linearGradient>` +
    `<filter id="b"><feGaussianBlur stdDeviation="${(band / 2.2).toFixed(1)}"/></filter></defs>` +
    `<rect width="${w}" height="${h}" fill="url(#x)"/>` +
    `<rect width="${w}" height="${h}" fill="url(#y)" style="mix-blend-mode:screen"/>` +
    `<rect x="${band}" y="${band}" width="${Math.max(0, w - 2 * band)}" height="${Math.max(0, h - 2 * band)}" ` +
    `rx="${Math.max(0, radius - band)}" fill="rgb(128,128,0)" filter="url(#b)"/></svg>`;
  return 'data:image/svg+xml,' + encodeURIComponent(svg);
}

/**
 * Adds refraction to a glass element (none at strength 0). `strength` is the largest shift in px at the very edge;
 * `blur` is the frost kept on top (less than plain glass, since the bending already reads as glass).
 */
export function useLens(ref: { current: HTMLElement | null }, { strength = 22, blur = 5 } = {}) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!SUPPORTED || !el || !strength || matchMedia('(prefers-reduced-transparency: reduce)').matches) return;
    const id = `mm-lens-${++count}`;
    const filter = document.createElementNS(NS, 'filter');
    filter.id = id;
    filter.setAttribute('filterUnits', 'userSpaceOnUse');
    filter.setAttribute('color-interpolation-filters', 'sRGB');
    const img = document.createElementNS(NS, 'feImage');
    img.setAttribute('preserveAspectRatio', 'none');
    img.setAttribute('result', 'map');
    const disp = document.createElementNS(NS, 'feDisplacementMap');
    disp.setAttribute('in', 'SourceGraphic');
    disp.setAttribute('in2', 'map');
    disp.setAttribute('scale', String(strength * 2));
    disp.setAttribute('xChannelSelector', 'R');
    disp.setAttribute('yChannelSelector', 'G');
    filter.append(img, disp);
    host().appendChild(filter);

    let lastMap = '';
    const draw = () => {
      const w = Math.round(el.offsetWidth), h = Math.round(el.offsetHeight);
      if (!w || !h) return;
      const radius = Math.min(parseFloat(getComputedStyle(el).borderTopLeftRadius) || 0, w / 2, h / 2);
      const band = Math.min(16, h * 0.3, w * 0.3);
      const mapKey = `${w}:${h}:${radius}`;
      if (mapKey === lastMap) return;
      lastMap = mapKey;
      for (const [k, v] of [['x', 0], ['y', 0], ['width', w], ['height', h]] as const) {
        filter.setAttribute(k, String(v));
        img.setAttribute(k, String(v));
      }
      img.setAttribute('href', displacementMap(w, h, radius, band));
    };
    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(el);
    el.style.setProperty('--lens', `url(#${id})`);
    el.style.setProperty('--glass-blur', `${blur}px`);
    el.classList.add('lensed');
    return () => {
      ro.disconnect();
      filter.remove();
      el.style.removeProperty('--lens');
      el.style.removeProperty('--glass-blur');
      el.classList.remove('lensed');
    };
  }, [ref, strength, blur]);
}
