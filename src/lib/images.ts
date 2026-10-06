// Image search through Openverse (openverse.org): openly licensed images, no key needed.
// The browser calls it directly; anonymous use is limited to 20 searches a minute and 200 a day per IP.
import type { WebImage } from './store';
import { t } from './i18n';

const API = 'https://api.openverse.org/v1/images/';
const PAGE = 20; // the most Openverse gives without a key

export interface Page { items: WebImage[]; next?: number }

const LICENSE: Record<string, string> = { cc0: 'CC0', pdm: t('Public domain') };
const license = (l: string, v?: string) => LICENSE[l] ?? `CC ${l.toUpperCase()}${v && v !== 'N/A' ? ' ' + v : ''}`;

export async function searchImages(q: string, page = 1): Promise<Page> {
  let res: Response;
  try {
    res = await fetch(`${API}?q=${encodeURIComponent(q.trim())}&page=${page}&page_size=${PAGE}`);
  } catch {
    throw new Error(t('Can’t reach Openverse. Check your connection.'));
  }
  if (res.status === 429) throw new Error(t('Too many searches for now — wait a minute and try again.'));
  if (!res.ok) throw new Error(t('Image search failed ({status})', { status: res.status }));
  const body = await res.json();
  const items: WebImage[] = (body.results ?? [])
    .filter((r: any) => /^https:\/\/[^\]\s]+$/.test(r.url)) // the url is kept in the note's text, so no ] or spaces
    .map((r: any) => ({
      url: r.url,
      thumb: /^https:\/\//.test(r.thumbnail) ? r.thumbnail : undefined,
      w: r.width || undefined,
      h: r.height || undefined,
      link: /^https:\/\//.test(r.foreign_landing_url) ? r.foreign_landing_url : undefined,
      title: r.title || undefined,
      credit: [r.creator, r.license && license(r.license, r.license_version)].filter(Boolean).join(' · ') || undefined,
    }));
  // Without a key Openverse stops after 240 results.
  return { items, next: page < (body.page_count ?? 0) && page * PAGE < 240 ? page + 1 : undefined };
}

/** The small version for grids and cards, or the full image. Older notes hold Pinterest images, sized by path. */
export function imageSrc(img: WebImage, size: 'thumb' | 'full') {
  if (/^https:\/\/i\.pinimg\.com\//.test(img.url)) return img.url.replace(/i\.pinimg\.com\/(\d+x|originals)\//, `i.pinimg.com/${size === 'thumb' ? 474 : 736}x/`);
  return size === 'thumb' ? img.thumb ?? img.url : img.url;
}
