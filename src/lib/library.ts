// Docs: the PDFs and help files kept on the server (server/library.js), searched page by page (a help file's pages are
// its topics). Only the signed-in admin can read them.
import { t } from './i18n';

export interface Doc {
  id: string;
  kind: 'pdf' | 'help';
  title: string;
  /** the folder it sits in under docs/, '' at the top */
  folder: string;
  pages: number;
  size: number;
  /** a PDF's: height ÷ width of its first page */
  ratio?: number;
  /** a help file's: each topic's title and where it is in the file */
  topics?: string[];
  files?: string[];
  /** a help file's contents: [title, depth, topic (1-based) or 0 for a heading] */
  toc?: [string, number, number][];
}
export interface Library { docs: Doc[]; pages: number }

/** A piece of a page's text: [text, whether it's a match]. */
export type Run = [string, boolean];
export interface PageHit { page: number; hits: number; snippet: Run[] }
export interface DocHits { doc: Doc; hits: number; count: number; more: number; pages: PageHit[] }
export interface Found { results: DocHits[]; pages: number }
export interface PageInfo { page: number; ratio: number; boxes: [number, number, number, number][] }

const base = '/api/library';

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  let r: Response;
  try {
    r = await fetch(base + path, { signal, cache: 'no-store' });
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    throw new Error(t('Couldn’t reach the server. Check your connection.'));
  }
  const out = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(r.status === 403 ? t('Sign in to the site to read the docs.') : out.error || t('Something went wrong on the server.')), { status: r.status });
  return out as T;
}

let listed: Promise<Library> | null = null;
/** The documents, fetched once per visit to the app (fresh: look for new files now). */
export function listDocs(fresh = false) {
  if (!listed || fresh) {
    listed = get<Library>(fresh ? '?fresh=1' : '');
    listed.catch(() => (listed = null));
  }
  return listed;
}

export const searchDocs = (q: string, doc?: string, signal?: AbortSignal) =>
  get<Found>(`/search?q=${encodeURIComponent(q)}${doc ? `&doc=${doc}` : ''}`, signal);

export const pageInfo = (doc: string, page: number, q: string, signal?: AbortSignal) =>
  get<PageInfo>(`/${doc}/page/${page}?q=${encodeURIComponent(q)}`, signal);

/** v: the server's drawing of pages, so a browser doesn't keep showing ones drawn before (v2: pages drawn with fonts). */
export const pageImage = (doc: string, page: number, zoom = false) => `${base}/${doc}/page/${page}/image?v=2${zoom ? '&size=zoom' : ''}`;
export const helpUrl = (doc: string, file: string) => `${base}/${doc}/files/${file.split('/').map(encodeURIComponent).join('/')}`;
export const fileUrl = (doc: string) => `${base}/${doc}/file`;

/** 1 234 567 bytes → "1.2 MB". */
export function fileSize(n: number) {
  return n >= 1e6 ? `${(n / 1e6).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1e3))} KB`;
}

/** Lowercase, without accents (Romanian ș, ț, ă, î, â match s, t, a, i): how the server compares too. */
export const fold = (s: string) => s.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase();

/** The words of a search, as the server reads them: "quoted words" stay together. */
export function terms(q: string) {
  const out: string[] = [];
  for (const m of q.matchAll(/"([^"]+)"|(\S+)/g)) {
    const w = fold((m[1] ?? m[2]).replace(/\s+/g, ' ').trim());
    if (w && !out.includes(w)) out.push(w);
  }
  return out.slice(0, 8);
}
