import type { RefObject } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import { goBack } from '../lib/router';
import { fileSize, fileUrl, fold, helpUrl, listDocs, pageImage, pageInfo, searchDocs, terms, type Doc, type PageHit, type PageInfo } from '../lib/library';
import { Icon } from '../components/icons';
import { Snippet, amount } from './Library';
import { t } from '../lib/i18n';
import '../styles/library.css';

/* ---------- zooming a page: pinch, drag, double-tap, ctrl/trackpad wheel ---------- */

interface Zoom { s: number; x: number; y: number }
const FLAT: Zoom = { s: 1, x: 0, y: 0 };
const MAX_ZOOM = 5;
type Pt = { x: number; y: number };

/**
 * A page you can zoom like a photo. `x`/`y` move the page's centre from the stage's centre, so the point of the page
 * under a finger stays under it while zooming. With the page not zoomed, a swipe turns it and a tap says where it landed.
 */
function useZoom(stage: RefObject<HTMLDivElement>, sheet: RefObject<HTMLElement>, on: { tap: (fx: number) => void; swipe: (dir: 1 | -1) => void }, active: boolean) {
  const [z, setZ] = useState<Zoom>(FLAT);
  const zr = useRef(z);
  zr.current = z;
  const cb = useRef(on);
  cb.current = on;

  const clamp = (n: Zoom): Zoom => {
    const el = stage.current, sh = sheet.current;
    const s = Math.min(MAX_ZOOM, Math.max(1, n.s));
    if (!el || !sh || s <= 1.001) return FLAT;
    const mx = Math.max(0, (sh.offsetWidth * s - el.clientWidth) / 2), my = Math.max(0, (sh.offsetHeight * s - el.clientHeight) / 2);
    return { s, x: Math.min(mx, Math.max(-mx, n.x)), y: Math.min(my, Math.max(-my, n.y)) };
  };
  /** Zooms `from` to scale `s` so the page point that was at `at0` ends up at `at` (both from the stage's centre). */
  const zoomAt = (from: Zoom, s: number, at0: Pt, at: Pt) => {
    const k = Math.min(MAX_ZOOM, Math.max(1, s)) / from.s;
    return clamp({ s: from.s * k, x: at.x - (at0.x - from.x) * k, y: at.y - (at0.y - from.y) * k });
  };
  const rel = (p: Pt): Pt => {
    const r = stage.current!.getBoundingClientRect();
    return { x: p.x - r.left - r.width / 2, y: p.y - r.top - r.height / 2 };
  };

  useEffect(() => {
    const el = stage.current;
    if (!el || !active) return;
    const pts = new Map<number, Pt>();
    let g: { z: Zoom; mid: Pt; dist: number; p0: Pt; t: number; moved: boolean; multi: boolean } | null = null;
    let lastTap = { t: 0, x: 0, y: 0 };
    let tapTimer = 0;
    const mid = (): Pt => {
      const a = [...pts.values()];
      return a.length > 1 ? { x: (a[0].x + a[1].x) / 2, y: (a[0].y + a[1].y) / 2 } : a[0];
    };
    const dist = () => {
      const a = [...pts.values()];
      return a.length > 1 ? Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) : 0;
    };
    const begin = () => {
      const m = mid();
      g = { z: zr.current, mid: rel(m), dist: dist(), p0: m, t: g?.t ?? performance.now(), moved: g?.moved ?? false, multi: (g?.multi ?? false) || pts.size > 1 };
    };
    const down = (e: PointerEvent) => {
      if (e.pointerType === 'mouse' && e.button !== 0) return;
      if (!pts.size) g = null;
      el.setPointerCapture(e.pointerId);
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      el.dataset.live = '';
      begin();
    };
    const move = (e: PointerEvent) => {
      if (!pts.has(e.pointerId) || !g) return;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const m = mid();
      if (Math.hypot(m.x - g.p0.x, m.y - g.p0.y) > 8) g.moved = true;
      if (pts.size > 1) setZ(zoomAt(g.z, (g.z.s * dist()) / (g.dist || 1), g.mid, rel(m)));
      else if (g.z.s > 1) setZ(clamp({ s: g.z.s, x: g.z.x + m.x - g.p0.x, y: g.z.y + m.y - g.p0.y }));
    };
    const up = (e: PointerEvent) => {
      const p = pts.get(e.pointerId);
      if (!p || !g) return;
      pts.delete(e.pointerId);
      if (pts.size) return begin(); // a finger still down carries on moving the page from here
      delete el.dataset.live;
      const done = g;
      g = null;
      if (done.multi || e.type === 'pointercancel') return;
      const dx = p.x - done.p0.x, dy = p.y - done.p0.y;
      if (!done.moved && performance.now() - done.t < 400) {
        const now = performance.now();
        if (now - lastTap.t < 300 && Math.hypot(p.x - lastTap.x, p.y - lastTap.y) < 40) {
          clearTimeout(tapTimer);
          lastTap.t = 0;
          const at = rel(p);
          setZ(zr.current.s > 1 ? FLAT : zoomAt(zr.current, 2.5, at, at));
          return;
        }
        lastTap = { t: now, x: p.x, y: p.y };
        const r = el.getBoundingClientRect();
        const fx = (p.x - r.left) / r.width;
        tapTimer = window.setTimeout(() => cb.current.tap(fx), 260);
        return;
      }
      if (done.z.s === 1 && Math.abs(dx) > 50 && Math.abs(dx) > Math.abs(dy) * 1.4) cb.current.swipe(dx < 0 ? 1 : -1);
    };
    const wheel = (e: WheelEvent) => {
      const cur = zr.current;
      if (e.ctrlKey) {
        // a trackpad pinch, or ctrl + the mouse wheel
        e.preventDefault();
        const at = rel({ x: e.clientX, y: e.clientY });
        setZ(zoomAt(cur, cur.s * Math.exp(-Math.max(-40, Math.min(40, e.deltaY)) / 80), at, at));
      } else if (cur.s > 1) {
        e.preventDefault();
        setZ(clamp({ s: cur.s, x: cur.x - e.deltaX, y: cur.y - e.deltaY }));
      }
    };
    el.addEventListener('pointerdown', down);
    el.addEventListener('pointermove', move);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
    el.addEventListener('wheel', wheel, { passive: false });
    return () => {
      clearTimeout(tapTimer);
      el.removeEventListener('pointerdown', down);
      el.removeEventListener('pointermove', move);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      el.removeEventListener('wheel', wheel);
    };
  }, [active]);

  // a turned or resized screen keeps the page inside it
  useEffect(() => {
    const el = stage.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setZ((cur) => clamp(cur)));
    ro.observe(el);
    return () => ro.disconnect();
  }, [active]);

  return {
    z,
    reset: () => setZ(FLAT),
    by: (k: number) => setZ((cur) => zoomAt(cur, cur.s * k, { x: 0, y: 0 }, { x: 0, y: 0 })),
  };
}

/* ---------- a help topic: marking the search's words inside its frame ---------- */

const TOPIC_STYLE = `
  html { -webkit-text-size-adjust: 100%; }
  body { margin: 0 auto !important; padding: 18px 18px 40px; max-width: 860px; font: 16px/1.6 system-ui, -apple-system, 'Segoe UI', sans-serif !important; color: #222; background: #fff; overflow-wrap: break-word; }
  img { max-width: 100%; height: auto; }
  table { max-width: 100%; }
  mark[data-mm] { background: #ffd76a; color: inherit; border-radius: 2px; box-shadow: 0 0 0 2px #ffd76a; }
`;

function markWords(d: Document, words: string[]) {
  for (const m of d.querySelectorAll('mark[data-mm]')) m.replaceWith(...m.childNodes);
  d.body?.normalize();
  if (!d.body || !words.length) return null;
  const walker = d.createTreeWalker(d.body, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  while (walker.nextNode()) nodes.push(walker.currentNode as Text);
  let first: HTMLElement | null = null;
  for (const node of nodes) {
    const text = node.data;
    let folded = '';
    const at: number[] = [];
    for (let i = 0; i < text.length; i++) {
      const f = fold(text[i]);
      folded += f;
      for (let k = 0; k < f.length; k++) at.push(i);
    }
    at.push(text.length);
    const spans: [number, number][] = [];
    for (const w of words) for (let i = folded.indexOf(w); i !== -1; i = folded.indexOf(w, i + w.length)) spans.push([at[i], at[i + w.length - 1] + 1]);
    if (!spans.length) continue;
    spans.sort((a, b) => a[0] - b[0]);
    const frag = d.createDocumentFragment();
    let pos = 0;
    for (const [a, b] of spans) {
      if (a < pos) continue;
      frag.append(text.slice(pos, a));
      const m = d.createElement('mark');
      m.dataset.mm = '';
      m.textContent = text.slice(a, b);
      frag.append(m);
      first ??= m;
      pos = b;
    }
    frag.append(text.slice(pos));
    node.replaceWith(frag);
  }
  return first;
}

const wide = () => matchMedia('(min-width: 1024px)').matches;

/** One document: a PDF a page at a time (zoomable, the search's words marked on it), or a help file a topic at a time. */
export function DocView({ id, query }: { id: string; query: URLSearchParams }) {
  const [doc, setDoc] = useState<Doc | null>(null);
  const [error, setError] = useState('');
  const [page, setPage] = useState(() => Math.max(1, Number(query.get('p')) || 1));
  const [q, setQ] = useState(query.get('q') ?? '');
  const [searching, setSearching] = useState(() => !!query.get('q'));
  const [hits, setHits] = useState<PageHit[] | null>(null);
  const [info, setInfo] = useState<PageInfo | null>(null);
  const [drawn, setDrawn] = useState('');
  const [sharp, setSharp] = useState('');
  const [typed, setTyped] = useState(String(page));
  const [full, setFull] = useState(false);
  const [bare, setBare] = useState(false);
  const [toc, setToc] = useState(wide);
  const root = useRef<HTMLDivElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const sheet = useRef<HTMLElement>(null);
  const frame = useRef<HTMLIFrameElement>(null);
  const framePath = useRef('');
  const [frameSrc, setFrameSrc] = useState('');

  useEffect(() => {
    listDocs().then((lib) => {
      const d = lib.docs.find((x) => x.id === id);
      if (d) setDoc(d);
      else setError(t('That document isn’t here any more.'));
    }, (e: Error) => setError(e.message));
  }, [id]);

  const help = doc?.kind === 'help';
  const last = doc?.pages ?? 1;
  const go = (n: number) => setPage(Math.min(Math.max(1, Math.round(n) || 1), last));
  const zoom = useZoom(stage, sheet, {
    tap: (fx) => (fx < 0.22 ? go(page - 1) : fx > 0.78 ? go(page + 1) : full && setBare((b) => !b)),
    swipe: (dir) => go(page + dir),
  }, !!doc && !help);

  // where you are stays in the address, so the back button and a reload come back to it
  useEffect(() => {
    setTyped(String(page));
    history.replaceState(history.state, '', `#/doc/${id}?p=${page}${q.trim() ? '&q=' + encodeURIComponent(q.trim()) : ''}`);
  }, [id, page, q]);

  useEffect(() => zoom.reset(), [page]);

  // the pages the search is on, to step through
  useEffect(() => {
    if (!q.trim()) return setHits(null);
    const stop = new AbortController();
    const timer = setTimeout(() => {
      searchDocs(q.trim(), id, stop.signal).then((f) => setHits(f.results[0]?.pages ?? []), () => {});
    }, 220);
    return () => { clearTimeout(timer); stop.abort(); };
  }, [id, q]);

  // a PDF page's shape, and where the words are on it
  useEffect(() => {
    if (!doc || help) return;
    const stop = new AbortController();
    const timer = setTimeout(() => {
      pageInfo(id, page, q.trim(), stop.signal).then(setInfo, () => {});
    }, info?.page === page ? 220 : 0);
    if (page < last) new Image().src = pageImage(id, page + 1); // the next page is likely next
    return () => { clearTimeout(timer); stop.abort(); };
  }, [doc, page, q]);

  // a help topic opens in the frame, unless the frame went there itself by a link
  useEffect(() => {
    const file = doc?.files?.[page - 1];
    if (help && file && framePath.current !== file.toLowerCase()) setFrameSrc(helpUrl(id, file));
  }, [doc, page]);
  // and its words are marked once you stop typing
  useEffect(() => {
    if (!help) return;
    const timer = setTimeout(() => {
      const d = frame.current?.contentDocument;
      if (d?.body) markWords(d, terms(q))?.scrollIntoView({ block: 'center' });
    }, 220);
    return () => clearTimeout(timer);
  }, [q]);

  const onFrameLoad = () => {
    const f = frame.current;
    const d = f?.contentDocument;
    if (!d || !doc?.files) return;
    let path = '';
    try {
      path = decodeURIComponent(f!.contentWindow!.location.pathname.split('/files/')[1] ?? '').toLowerCase();
    } catch {}
    framePath.current = path;
    const i = doc.files.findIndex((x) => x.toLowerCase() === path);
    if (i >= 0 && i + 1 !== page) setPage(i + 1);
    const style = d.createElement('style');
    style.textContent = TOPIC_STYLE;
    d.head?.append(style);
    markWords(d, terms(q))?.scrollIntoView({ block: 'center' });
  };

  // fullscreen: the browser's own where it has one (not iPhone Safari), else the reader just covers the page
  const toggleFull = () => {
    const next = !full;
    setFull(next);
    setBare(false);
    if (next) root.current?.requestFullscreen?.().catch(() => {});
    else if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
  };
  useEffect(() => {
    const change = () => !document.fullscreenElement && setFull(false);
    document.addEventListener('fullscreenchange', change);
    return () => {
      document.removeEventListener('fullscreenchange', change);
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    };
  }, []);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') go(page + 1);
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') go(page - 1);
      else if (e.key === 'Escape' && full && !document.fullscreenElement) setFull(false);
      else if (e.key === 'f') toggleFull();
      else return;
      e.preventDefault();
    };
    addEventListener('keydown', key);
    return () => removeEventListener('keydown', key);
  }, [page, last, full]);

  const at = hits ? hits.findIndex((h) => h.page === page) : -1;
  const prevHit = hits ? [...hits].reverse().find((h) => h.page < page) : undefined;
  const nextHit = hits?.find((h) => h.page > page);
  const here = at >= 0 ? hits![at] : null;
  const src = pageImage(id, page);
  const ratio = info?.page === page ? info.ratio : doc?.ratio ?? 1.414;
  const boxes = info?.page === page ? info.boxes : [];
  // sharper pages once you zoom in far enough to see the difference
  const zoomSrc = pageImage(id, page, true);
  useEffect(() => {
    if (zoom.z.s >= 1.6) setSharp(zoomSrc);
  }, [zoom.z.s >= 1.6, zoomSrc]);
  const back = () => goBack(q.trim() ? `library?q=${encodeURIComponent(q.trim())}` : 'library');
  const label = help ? t('Topic') : t('Page');

  return (
    <div ref={root} class={`page doc-page${full ? ' is-full' : ''}${bare ? ' is-bare' : ''}${help ? ' is-help' : ''}`}>
      <header class="doc-top">
        <button class="glass glass-btn round" onClick={back} aria-label={t('Back')}><Icon name="arrow-left" /></button>
        <div class="doc-heading">
          <h1 class="doc-title">{doc?.title ?? t('Docs')}</h1>
          {doc && <p class="doc-sub">{help ? doc.topics?.[page - 1] : `${amount(doc)} · ${fileSize(doc.size)}`}</p>}
        </div>
        {doc && (
          <div class="doc-actions">
            {help && <button class="icon-btn" aria-pressed={toc} onClick={() => setToc(!toc)} aria-label={t('Contents')} title={t('Contents')}><Icon name="list-tree" /></button>}
            <button class="icon-btn" aria-pressed={searching} onClick={() => { setSearching(!searching); if (searching) setQ(''); }} aria-label={t('Search this document')} title={t('Search this document')}><Icon name="search" /></button>
            <button class="icon-btn" onClick={toggleFull} aria-label={full ? t('Leave full screen') : t('Full screen')} title={full ? t('Leave full screen') : t('Full screen')}><Icon name={full ? 'minimize' : 'maximize'} /></button>
            {help ? (
              <a class="icon-btn doc-wide-only" href={fileUrl(id)} download aria-label={t('Download the help file')} title={t('Download the help file')}><Icon name="download" /></a>
            ) : (
              <a class="icon-btn doc-wide-only" href={`${fileUrl(id)}#page=${page}`} target="_blank" rel="noopener" aria-label={t('Open the PDF')} title={t('Open the PDF')}><Icon name="external-link" /></a>
            )}
          </div>
        )}
      </header>

      {doc && searching && (
        <div class="doc-bar">
          <label class="search">
            <Icon name="search" size={18} />
            <input type="search" autoFocus={!q} placeholder={t('Search this document')} value={q} onInput={(e) => setQ(e.currentTarget.value)} aria-label={t('Search this document')} enterKeyHint="search"
              onKeyDown={(e) => { if (e.key === 'Enter' && hits?.length) go((nextHit ?? hits[0]).page); }} />
          </label>
          {hits && (
            <div class="doc-hitnav">
              <button class="icon-btn small" disabled={!prevHit} onClick={() => prevHit && go(prevHit.page)} aria-label={t('Previous match')} title={t('Previous match')}><Icon name="arrow-up" size={18} /></button>
              <span class="doc-hitnav-count">
                {hits.length ? (at >= 0 ? t('{n} of {total}', { n: at + 1, total: hits.length }) : amount({ ...doc, pages: hits.length })) : t('No matches')}
              </span>
              <button class="icon-btn small" disabled={!nextHit} onClick={() => nextHit && go(nextHit.page)} aria-label={t('Next match')} title={t('Next match')}><Icon name="arrow-down" size={18} /></button>
            </div>
          )}
          {here && !help && <p class="doc-snippet"><Snippet runs={here.snippet} /></p>}
        </div>
      )}

      {error && <div class="empty"><p>{error}</p></div>}

      {doc && (
        <div class="doc-body">
          {help && toc && (
            <nav class="doc-toc" aria-label={t('Contents')}>
              <ol>
                {doc.toc!.map(([title, depth, topic]) => (
                  <li style={{ '--d': Math.min(depth, 5) }}>
                    {topic ? (
                      <button class="doc-toc-item" aria-current={topic === page ? 'page' : undefined} onClick={() => { go(topic); if (!wide()) setToc(false); }}>{title}</button>
                    ) : <span class="doc-toc-head">{title}</span>}
                  </li>
                ))}
              </ol>
            </nav>
          )}
          <div ref={stage} class="doc-stage">
            {help ? (
              frameSrc && <iframe ref={frame} src={frameSrc} title={doc.topics?.[page - 1] ?? doc.title} sandbox="allow-same-origin" onLoad={onFrameLoad} />
            ) : (
              <div class="doc-zoom" style={{ transform: `translate(${zoom.z.x}px, ${zoom.z.y}px) scale(${zoom.z.s})` }}>
                <figure ref={sheet} class={`doc-sheet${drawn === src ? ' is-drawn' : ''}`} style={{ '--ratio': ratio }}>
                  <img key={src} src={src} alt={t('Page {n}', { n: page })} draggable={false} onLoad={() => setDrawn(src)} />
                  {sharp === zoomSrc && <img key={zoomSrc} class="doc-sharp" src={zoomSrc} alt="" draggable={false} onLoad={(e) => e.currentTarget.classList.add('is-in')} />}
                  {drawn === src && boxes.map(([x, y, w, h]) => (
                    <mark class="doc-mark" style={{ left: `${x * 100}%`, top: `${y * 100}%`, width: `${w * 100}%`, height: `${h * 100}%` }} />
                  ))}
                </figure>
              </div>
            )}
          </div>
        </div>
      )}

      {doc && (
        <nav class="doc-pager" aria-label={help ? t('Topics') : t('Pages')}>
          <button class="icon-btn" onClick={() => go(page - 1)} disabled={page <= 1} aria-label={help ? t('Previous topic') : t('Previous page')}><Icon name="chevron-left" /></button>
          <form class="doc-pager-at" onSubmit={(e) => { e.preventDefault(); go(Number(typed)); }}>
            <input type="text" inputMode="numeric" value={typed} onInput={(e) => setTyped(e.currentTarget.value.replace(/\D/g, ''))} onBlur={() => go(Number(typed))} aria-label={label} />
            <span>/ {last}</span>
          </form>
          <button class="icon-btn" onClick={() => go(page + 1)} disabled={page >= last} aria-label={help ? t('Next topic') : t('Next page')}><Icon name="chevron-right" /></button>
          {!help && (
            <span class="doc-zoom-btns">
              <button class="icon-btn small" onClick={() => zoom.by(1 / 1.5)} disabled={zoom.z.s <= 1} aria-label={t('Zoom out')} title={t('Zoom out')}><Icon name="zoom-out" size={18} /></button>
              <button class="icon-btn small" onClick={() => zoom.by(1.5)} disabled={zoom.z.s >= MAX_ZOOM} aria-label={t('Zoom in')} title={t('Zoom in')}><Icon name="zoom-in" size={18} /></button>
            </span>
          )}
        </nav>
      )}
    </div>
  );
}
