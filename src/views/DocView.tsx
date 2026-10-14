import { useEffect, useMemo, useState } from 'preact/hooks';
import { goBack } from '../lib/router';
import { fileSize, fileUrl, listDocs, pageImage, pageInfo, searchDocs, type Doc, type PageHit, type PageInfo } from '../lib/library';
import { PageHead } from '../components/PageHead';
import { Icon } from '../components/icons';
import { Snippet } from './Library';
import { noun, t } from '../lib/i18n';
import '../styles/library.css';

/** One PDF, a page at a time, with the words you searched for marked on the page. */
export function DocView({ id, query }: { id: string; query: URLSearchParams }) {
  const [doc, setDoc] = useState<Doc | null>(null);
  const [error, setError] = useState('');
  const [page, setPage] = useState(() => Math.max(1, Number(query.get('p')) || 1));
  const [q, setQ] = useState(query.get('q') ?? '');
  const [hits, setHits] = useState<PageHit[] | null>(null);
  const [info, setInfo] = useState<PageInfo | null>(null);
  const [drawn, setDrawn] = useState('');
  const [typed, setTyped] = useState(String(page));

  useEffect(() => {
    listDocs().then((lib) => {
      const d = lib.docs.find((x) => x.id === id);
      if (d) setDoc(d);
      else setError(t('That document isn’t here any more.'));
    }, (e: Error) => setError(e.message));
  }, [id]);

  const last = doc?.pages ?? 1;
  const go = (n: number) => setPage(Math.min(Math.max(1, Math.round(n) || 1), last));

  // where you are stays in the address, so the back button and a reload come back to it
  useEffect(() => {
    setTyped(String(page));
    history.replaceState(history.state, '', `#/doc/${id}?p=${page}${q.trim() ? '&q=' + encodeURIComponent(q.trim()) : ''}`);
  }, [id, page, q]);

  // the pages the search is on, to step through
  useEffect(() => {
    if (!q.trim()) return setHits(null);
    const stop = new AbortController();
    const timer = setTimeout(() => {
      searchDocs(q.trim(), id, stop.signal).then((f) => setHits(f.results[0]?.pages ?? []), () => {});
    }, 220);
    return () => { clearTimeout(timer); stop.abort(); };
  }, [id, q]);

  // the page's shape, and where the words are on it
  useEffect(() => {
    if (!doc) return;
    const stop = new AbortController();
    const timer = setTimeout(() => {
      pageInfo(id, page, q.trim(), stop.signal).then(setInfo, () => {});
    }, info?.page === page ? 220 : 0);
    // the next page is likely next
    if (page < last) new Image().src = pageImage(id, page + 1);
    return () => { clearTimeout(timer); stop.abort(); };
  }, [doc, page, q]);

  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'ArrowRight' || e.key === 'PageDown') go(page + 1);
      else if (e.key === 'ArrowLeft' || e.key === 'PageUp') go(page - 1);
      else return;
      e.preventDefault();
    };
    addEventListener('keydown', key);
    return () => removeEventListener('keydown', key);
  }, [page, last]);

  const at = hits ? hits.findIndex((h) => h.page === page) : -1;
  const prevHit = hits ? [...hits].reverse().find((h) => h.page < page) : undefined;
  const nextHit = hits?.find((h) => h.page > page);
  const here = at >= 0 ? hits![at] : null;
  const src = pageImage(id, page);
  const ratio = info?.page === page ? info.ratio : doc?.ratio ?? 1.414;
  const boxes = useMemo(() => (info?.page === page ? info.boxes : []), [info, page]);

  return (
    <div class="page doc-page">
      <PageHead
        title={doc?.title ?? t('Docs')}
        subtitle={doc && `${doc.folder ? doc.folder.split('/').pop() + ' · ' : ''}${doc.pages} ${noun(doc.pages, 'page', 'pages')} · ${fileSize(doc.size)}`}
        back={() => goBack(q.trim() ? `library?q=${encodeURIComponent(q.trim())}` : 'library')}
        actions={doc && (
          <a class="icon-btn" href={`${fileUrl(id)}#page=${page}`} target="_blank" rel="noopener" aria-label={t('Open the PDF')} title={t('Open the PDF')}>
            <Icon name="external-link" />
          </a>
        )}
      />

      {error && <div class="empty"><p>{error}</p></div>}

      {doc && (
        <>
          <div class="doc-bar">
            <label class="search">
              <Icon name="search" size={18} />
              <input type="search" placeholder={t('Search this document')} value={q} onInput={(e) => setQ(e.currentTarget.value)} aria-label={t('Search this document')} enterKeyHint="search"
                onKeyDown={(e) => { if (e.key === 'Enter' && hits?.length) { const n = nextHit ?? hits[0]; go(n.page); } }} />
            </label>
            {hits && (
              <div class="doc-hitnav">
                <button class="icon-btn small" disabled={!prevHit} onClick={() => prevHit && go(prevHit.page)} aria-label={t('Previous match')} title={t('Previous match')}><Icon name="arrow-up" size={18} /></button>
                <span class="doc-hitnav-count">
                  {hits.length ? (at >= 0 ? t('{n} of {total}', { n: at + 1, total: hits.length }) : `${hits.length} ${noun(hits.length, 'page', 'pages')}`) : t('No matches')}
                </span>
                <button class="icon-btn small" disabled={!nextHit} onClick={() => nextHit && go(nextHit.page)} aria-label={t('Next match')} title={t('Next match')}><Icon name="arrow-down" size={18} /></button>
              </div>
            )}
          </div>

          {here && <p class="doc-snippet"><Snippet runs={here.snippet} /></p>}

          <figure class={`doc-sheet${drawn === src ? ' is-drawn' : ''}`} style={{ aspectRatio: `1 / ${ratio}` }}>
            <img key={src} src={src} alt={t('Page {n}', { n: page })} onLoad={() => setDrawn(src)} />
            {drawn === src && boxes.map(([x, y, w, h]) => (
              <mark class="doc-mark" style={{ left: `${x * 100}%`, top: `${y * 100}%`, width: `${w * 100}%`, height: `${h * 100}%` }} />
            ))}
            <button class="doc-turn is-prev" onClick={() => go(page - 1)} disabled={page <= 1} aria-label={t('Previous page')} />
            <button class="doc-turn is-next" onClick={() => go(page + 1)} disabled={page >= last} aria-label={t('Next page')} />
          </figure>

          <nav class="doc-pager" aria-label={t('Pages')}>
            <button class="icon-btn" onClick={() => go(page - 1)} disabled={page <= 1} aria-label={t('Previous page')}><Icon name="chevron-left" /></button>
            <form class="doc-pager-at" onSubmit={(e) => { e.preventDefault(); go(Number(typed)); }}>
              <input type="text" inputMode="numeric" value={typed} onInput={(e) => setTyped(e.currentTarget.value.replace(/\D/g, ''))} onBlur={() => go(Number(typed))} aria-label={t('Page')} />
              <span>/ {last}</span>
            </form>
            <button class="icon-btn" onClick={() => go(page + 1)} disabled={page >= last} aria-label={t('Next page')}><Icon name="chevron-right" /></button>
          </nav>
        </>
      )}
    </div>
  );
}
