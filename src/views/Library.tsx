import { useEffect, useMemo, useState } from 'preact/hooks';
import { navigate } from '../lib/router';
import { fileSize, fold, listDocs, pageImage, searchDocs, type Doc, type Found, type Library as Lib, type Run } from '../lib/library';
import { CountUp } from '../components/charts';
import { PageHead } from '../components/PageHead';
import { Icon } from '../components/icons';
import { Sky } from '../components/Sky';
import { count, noun, t } from '../lib/i18n';
import '../styles/library.css';

const docLink = (id: string, page?: number, q?: string) =>
  `doc/${id}${page || q ? '?' : ''}${[page && `p=${page}`, q && `q=${encodeURIComponent(q)}`].filter(Boolean).join('&')}`;

export function Snippet({ runs }: { runs: Run[] }) {
  return <>{runs.map(([text, hit]) => (hit ? <mark>{text}</mark> : text))}</>;
}

/** "235 pages", or for a help file "58 topics". */
export const amount = (d: Doc) => d.kind === 'help' ? count(d.pages, 'topic', 'topics') : count(d.pages, 'page', 'pages');

function Cover({ doc, i }: { doc: Doc; i: number }) {
  const [shown, setShown] = useState(false);
  return (
    <li style={{ '--i': Math.min(i, 14) }}>
      <button class="doc-cover" onClick={() => navigate(docLink(doc.id))}>
        {doc.kind === 'help' ? (
          <span class="doc-cover-page is-help" style={{ aspectRatio: '1 / 1.3' }}>
            <Icon name="help" size={30} />
            <small>{doc.topics?.[0]}</small>
          </span>
        ) : (
          <span class={`doc-cover-page${shown ? ' is-shown' : ''}`} style={{ aspectRatio: `1 / ${Math.min(Math.max(doc.ratio ?? 1.414, 0.5), 1.6)}` }}>
            <img src={pageImage(doc.id, 1)} alt="" loading="lazy" decoding="async" onLoad={() => setShown(true)} />
          </span>
        )}
        <span class="doc-cover-title">{doc.title}</span>
        <span class="doc-cover-meta">{amount(doc)} · {fileSize(doc.size)}</span>
      </button>
    </li>
  );
}

/** The PDFs in docs/ on the server: browse them by folder, or search every page at once. */
export function Library({ query }: { query: URLSearchParams }) {
  const [lib, setLib] = useState<Lib | null>(null);
  const [error, setError] = useState('');
  const [q, setQ] = useState(query.get('q') ?? '');
  const [found, setFound] = useState<Found | null>(null);
  const [searching, setSearching] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const load = (fresh = false) => {
    setError('');
    setRefreshing(fresh);
    listDocs(fresh).then(setLib, (e: Error) => setError(e.message)).finally(() => setRefreshing(false));
  };
  useEffect(() => load(), []);

  // the search stays in the address, so coming back from a page finds it again
  useEffect(() => {
    history.replaceState(history.state, '', '#/library' + (q.trim() ? '?q=' + encodeURIComponent(q.trim()) : ''));
    if (!q.trim()) return setFound(null);
    const stop = new AbortController();
    setSearching(true);
    const timer = setTimeout(() => {
      searchDocs(q.trim(), undefined, stop.signal)
        .then((f) => { setFound(f); setError(''); }, (e: Error) => e.name !== 'AbortError' && setError(e.message))
        .finally(() => !stop.signal.aborted && setSearching(false));
    }, 220);
    return () => { clearTimeout(timer); stop.abort(); };
  }, [q]);

  const folders = useMemo(() => {
    const out = new Map<string, Doc[]>();
    for (const d of lib?.docs ?? []) out.set(d.folder, [...(out.get(d.folder) ?? []), d]);
    return [...out];
  }, [lib]);
  const named = useMemo(() => {
    const words = fold(q).split(/\s+/).filter(Boolean);
    return words.length ? (lib?.docs ?? []).filter((d) => words.every((w) => fold(d.title).includes(w))) : [];
  }, [lib, q]);

  const stats: [number, string][] = lib ? [[lib.docs.length, noun(lib.docs.length, 'document', 'documents')], [lib.pages, noun(lib.pages, 'page', 'pages')], [folders.length, noun(folders.length, 'folder', 'folders')]] : [];

  return (
    <div class="page media-page docs-page">
      <div class="journal-top media-top" style={{ '--sky': 'var(--emo-fear)' }}>
        <Sky world="fear" letters="docs" />
        <PageHead
          title={t('Docs')}
          subtitle={!lib?.docs.length ? t('Your PDFs, every page searchable.') : undefined}
          wheel world="fear"
          actions={lib && (
            <button class="icon-btn" onClick={() => load(true)} aria-label={t('Look for new files')} title={t('Look for new files')} disabled={refreshing}>
              <Icon name={refreshing ? 'loader-2' : 'refresh'} class={refreshing ? 'docs-spin' : undefined} />
            </button>
          )}
        />
        {stats.length > 0 && (
          <div class="media-stats">
            {stats.map(([value, label], i) => (
              <span class="stat" style={{ '--i': i }}>
                <b><CountUp value={value} /></b>
                <small>{label}</small>
              </span>
            ))}
          </div>
        )}
        {lib && lib.docs.length > 0 && (
          <label class="search">
            <Icon name={searching ? 'loader-2' : 'search'} size={18} class={searching ? 'docs-spin' : undefined} />
            <input type="search" placeholder={t('Search every page')} value={q} onInput={(e) => setQ(e.currentTarget.value)} aria-label={t('Search every page')} enterKeyHint="search" />
          </label>
        )}
      </div>

      <div class="media-panel">
        {error && (
          <div class="empty">
            <p>{error}</p>
            <button class="btn btn-quiet" onClick={() => load()}><Icon name="refresh" size={18} /> {t('Try again')}</button>
          </div>
        )}
        {!lib && !error && <p class="docs-wait muted"><Icon name="loader-2" class="docs-spin" size={18} /> {t('Reading the documents…')}</p>}
        {lib && !lib.docs.length && (
          <div class="empty"><h2 class="title-s">{t('No documents yet')}</h2><p>{t('PDFs put in the docs folder on the server show up here.')}</p></div>
        )}

        {lib && !q.trim() && folders.map(([folder, docs]) => (
          <section class="section">
            <h2 class="section-title"><Icon name="books" size={18} /> {folder.split('/').pop() || t('Documents')}</h2>
            <ul class="doc-grid">{docs.map((d, i) => <Cover key={d.id} doc={d} i={i} />)}</ul>
          </section>
        ))}

        {q.trim() && named.length > 0 && (
          <section class="section">
            <h2 class="section-title">{t('Documents')}</h2>
            <ul class="doc-names">
              {named.map((d) => (
                <li><button class="doc-name" onClick={() => navigate(docLink(d.id))}><Icon name="file-text" size={18} /> <span>{d.title}</span> <small>{amount(d)}</small></button></li>
              ))}
            </ul>
          </section>
        )}

        {q.trim() && found && (
          found.results.length ? (
            <>
              <p class="docs-count muted small">{t('{pages} in {docs}', { pages: count(found.pages, 'page', 'pages'), docs: count(found.results.length, 'document', 'documents') })}</p>
              {found.results.map((r) => (
                <section class="section doc-hits" key={r.doc.id}>
                  <button class="doc-hits-head" onClick={() => navigate(docLink(r.doc.id, r.pages[0]?.page, q.trim()))}>
                    <Icon name="file-text" size={18} />
                    <span class="doc-hits-title">{r.doc.title}</span>
                    <span class="badge">{r.count}</span>
                  </button>
                  <ol class="hit-list">
                    {r.pages.map((h) => (
                      <li>
                        <button class="hit" onClick={() => navigate(docLink(r.doc.id, h.page, q.trim()))}>
                          <span class={`hit-page${r.doc.kind === 'help' ? ' is-topic' : ''}`}>{r.doc.kind === 'help' ? r.doc.topics?.[h.page - 1] : t('p. {n}', { n: h.page })}</span>
                          <span class="hit-text"><Snippet runs={h.snippet} /></span>
                        </button>
                      </li>
                    ))}
                  </ol>
                  {r.more > 0 && (
                    <button class="btn btn-quiet btn-s hit-more" onClick={() => navigate(docLink(r.doc.id, r.pages[r.pages.length - 1].page, q.trim()))}>
                      {t('{pages} more in this document', { pages: count(r.more, 'page', 'pages') })}
                    </button>
                  )}
                </section>
              ))}
            </>
          ) : !searching && !named.length && <p class="empty-note center">{t('Nothing found. Try fewer or shorter words.')}</p>
        )}
      </div>
    </div>
  );
}
