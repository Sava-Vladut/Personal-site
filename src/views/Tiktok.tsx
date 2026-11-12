import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { createPortal } from 'preact/compat';
import { goBack, navigate } from '../lib/router';
import { signIn } from '../lib/auth';
import { formatDate, monthLabel, monthShort } from '../lib/dates';
import { LOCALE, t } from '../lib/i18n';
import { LIB, access, cachedLibrary, fold, knownOpen, loadLibrary, loadStars, saveStar, starSet, type Access, type Library, type Rec } from '../lib/tiktok';
import { PageHead } from '../components/PageHead';
import { SortChip } from '../components/collection';
import { Icon } from '../components/icons';
import { Sky } from '../components/Sky';
import { Player, type PlayerApi } from './tiktok/Player';
import { Download } from './tiktok/Download';
import '../styles/stats.css';
import '../styles/tiktok.css';

const WORLD = 'love-connection';

/**
 * Saved TikToks: the favorites downloaded by the TikTok downloader (github.com/Sava-Vladut/tiktok-favorites-viewer),
 * which runs in its own container on the server and is reached through /api/tiktok/, only for the signed-in admin.
 * #/tiktok is the library (search, years and months, a grid by month, the player); #/tiktok/download adds an export
 * and runs the downloader.
 */
export function Tiktok({ id, query }: { id?: string; query: URLSearchParams }) {
  const [state, setState] = useState<Access | 'checking'>(knownOpen() ? 'open' : 'checking');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useLayoutEffect(() => {
    const root = document.documentElement.style;
    root.setProperty('--accent', `var(--emo-${WORLD})`);
    return () => root.removeProperty('--accent');
  }, []);
  useEffect(() => { if (state === 'checking') void access().then(setState); }, [state]);

  const login = async (e: Event) => {
    e.preventDefault();
    if (!password || busy) return;
    setBusy(true);
    setError('');
    try {
      await signIn(password);
      setPassword('');
      setState(await access());
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (state === 'open') return id === 'download' ? <Download /> : <Videos query={query} />;

  return (
    <div class="page stats-page tt-page">
      <div class="journal-top stats-top" style={{ '--sky': `var(--emo-${WORLD})` }}>
        <Sky world={WORLD} />
        <PageHead title={t('Saved TikToks')} back={() => goBack()} />
      </div>
      {state === 'checking' ? (
        <p class="empty-note center loading-note">{t('Loading…')}</p>
      ) : state === 'locked' ? (
        <div class="empty fade-arrive-soft">
          <h2 class="title-s">{t('Saved TikToks are private')}</h2>
          <p>{t('Enter the admin password to see and download them. This device stays signed in.')}</p>
          <form class="tt-login" onSubmit={login}>
            <input
              class="input"
              type="password"
              value={password}
              onInput={(e) => setPassword(e.currentTarget.value)}
              placeholder={t('Admin password')}
              aria-label={t('Admin password')}
              autocomplete="current-password"
              enterkeyhint="go"
            />
            <button class="btn btn-primary" type="submit" disabled={busy || !password}>{busy ? t('Signing in…') : t('Sign in')}</button>
          </form>
          {error && <p class="hint danger fade-arrive-soft" role="alert">{error}</p>}
        </div>
      ) : (
        <div class="empty fade-arrive-soft">
          <h2 class="title-s">{t('The TikTok downloader isn’t running')}</h2>
          <p>{t('It runs in its own container on the server. Try again in a minute.')}</p>
          <button class="btn btn-quiet" onClick={() => setState('checking')}><Icon name="refresh" size={18} /> {t('Try again')}</button>
        </div>
      )}
    </div>
  );
}

/* ======================= the library ======================= */

type Sort = 'new' | 'old' | 'views' | 'shuffle';
interface Filters { q: string; y: number; m: number; sort: Sort; fav: boolean }
const SORTS: [Sort, string][] = [['new', t('Newest')], ['old', t('Oldest')], ['views', t('Most viewed')], ['shuffle', t('Shuffle')]];
const num = new Intl.NumberFormat(LOCALE);
const pad = (n: number) => String(n).padStart(2, '0');
const fmtDur = (s: number) => { const n = Math.max(0, Math.round(s)); return `${Math.floor(n / 60)}:${pad(n % 60)}`; };
const hash32 = (s: string, seed: number) => { let h = seed | 0; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 2654435761); return (h ^ (h >>> 15)) >>> 0; };

function readFilters(q: URLSearchParams): Filters {
  const s = q.get('s') as Sort;
  return {
    q: q.get('q') ?? '',
    y: Number(q.get('y')) || 0,
    m: Math.min(12, Math.max(0, Number(q.get('m')) || 0)),
    sort: SORTS.some(([k]) => k === s) ? s : 'new',
    fav: q.get('f') === '1',
  };
}
function filtersQuery(f: Filters) {
  const p = new URLSearchParams();
  if (f.q.trim()) p.set('q', f.q.trim());
  if (f.y) p.set('y', String(f.y));
  if (f.m) p.set('m', String(f.m));
  if (f.sort !== 'new') p.set('s', f.sort);
  if (f.fav) p.set('f', '1');
  return p.toString();
}

function Videos({ query }: { query: URLSearchParams }) {
  const [lib, setLib] = useState<Library | null>(cachedLibrary);
  const [failed, setFailed] = useState('');
  const [f, setF] = useState<Filters>(() => readFilters(query));
  const [typed, setTyped] = useState(f.q);
  const [focused, setFocused] = useState(false);
  const [seed, setSeed] = useState(1);
  const [starsVer, setStarsVer] = useState(0); // the stars changed: redraw the marks
  const [listVer, setListVer] = useState(0); // ...and the Starred list may change too (not while the player is open)
  const [again, setAgain] = useState(0);
  const player = useRef<PlayerApi | null>(null);
  const pageEl = useRef<HTMLDivElement>(null), barEl = useRef<HTMLDivElement>(null), gridEl = useRef<HTMLDivElement>(null);
  const searchEl = useRef<HTMLInputElement>(null), yearsEl = useRef<HTMLDivElement>(null), monthsEl = useRef<HTMLDivElement>(null);
  const written = useRef(query.toString());
  const want = useRef(query.get('v') ?? ''); // a video to open as soon as the list is there (#/tiktok?v=…)
  const focusRec = useRef<string>(''); // the card to bring into view after the player closes
  const stars = starSet();

  // the catalog, and the stars beside it; coming back shows the copy from before at once and checks for new videos
  useEffect(() => {
    let live = true;
    const had = cachedLibrary();
    loadLibrary(!!had).then((l) => {
      if (!live) return;
      if (!had || l.all.length !== had.all.length || l.hidden !== had.hidden) { if (!player.current?.isOpen()) setLib(l); }
      setFailed('');
    }, (e: Error) => { if (live && !had) setFailed(e.message); });
    void loadStars().then(() => { if (live) { setStarsVer((n) => n + 1); if (!player.current?.isOpen()) setListVer((n) => n + 1); } });
    return () => { live = false; };
  }, [again]);

  // the address follows the filters, so a reload or going back keeps them
  useEffect(() => {
    const qs = filtersQuery(f);
    if (qs === written.current) return;
    written.current = qs;
    const write = () => {
      if (history.state?.mmSheet) { addEventListener('popstate', write, { once: true }); return; } // the player's entry is still closing
      history.replaceState(history.state, '', '#/tiktok' + (qs ? '?' + qs : ''));
    };
    write();
  }, [f]);
  // ...and the filters follow the address when something else changes it (the download page's "tap to watch")
  useEffect(() => {
    const qs = query.toString();
    if (qs === written.current) return;
    const next = readFilters(query);
    want.current = query.get('v') ?? '';
    written.current = filtersQuery(next);
    if (want.current) history.replaceState(history.state, '', '#/tiktok' + (written.current ? '?' + written.current : ''));
    setF(next);
    setTyped(next.q);
  }, [query]);

  const view = useMemo(() => {
    if (!lib) return null;
    const toks = fold(f.q).split(/\s+/).filter(Boolean);
    const base = f.fav ? lib.all.filter((r) => stars.has(r.id)) : lib.all;
    const byText = toks.length ? base.filter((r) => toks.every((w) => r.hay.includes(w))) : base;
    const byYear = f.y ? byText.filter((r) => r.yr === f.y) : byText;
    const results = (f.m ? byYear.filter((r) => r.mon === f.m - 1) : byYear).slice();
    if (f.sort === 'new') results.sort((a, b) => b.t - a.t);
    else if (f.sort === 'old') results.sort((a, b) => a.t - b.t);
    else if (f.sort === 'views') results.sort((a, b) => (b.v.views || 0) - (a.v.views || 0));
    else results.sort((a, b) => hash32(a.id, seed) - hash32(b.id, seed));
    const years = new Map<number, number>();
    for (const r of byText) years.set(r.yr, (years.get(r.yr) || 0) + 1);
    if (f.y && !years.has(f.y)) years.set(f.y, 0);
    const months = new Array<number>(12).fill(0);
    for (const r of byYear) months[r.mon]++;
    return { results, years: [...years].sort((a, b) => b[0] - a[0]), months, all: byText.length };
  }, [lib, f, seed, listVer]);
  const results = view?.results ?? [];
  const starredN = useMemo(() => (lib ? lib.all.reduce((n, r) => n + (stars.has(r.id) ? 1 : 0), 0) : 0), [lib, starsVer]);

  // a video asked for by the address opens once the list is in
  useEffect(() => {
    if (!view || !want.current) return;
    const i = results.findIndex((r) => r.id === want.current);
    want.current = '';
    if (i >= 0) { stopPreview(); player.current?.open(i); }
  }, [view]);

  // the bar's height, for the month headings that stick under it
  useLayoutEffect(() => {
    const bar = barEl.current, page = pageEl.current;
    if (!bar || !page) return;
    const ro = new ResizeObserver(() => page.style.setProperty('--tt-bar-h', bar.offsetHeight + 'px'));
    ro.observe(bar);
    return () => ro.disconnect();
  }, [!!lib]);
  // keep the chosen year and month in sight when their row scrolls sideways
  useLayoutEffect(() => {
    for (const row of [yearsEl.current, monthsEl.current]) {
      const on = row?.querySelector<HTMLElement>('[aria-pressed="true"]');
      if (row && on && row.scrollWidth > row.clientWidth) row.scrollLeft = Math.max(0, on.offsetLeft - row.offsetLeft - (row.clientWidth - on.offsetWidth) / 2);
    }
  }, [f.y, f.m, !!view]);
  // after the player closes: the card it was on comes into view, with the focus on it (once the Starred list has
  // dropped what was unstarred, when that changed; otherwise straight away)
  const bringBack = () => {
    if (!focusRec.current) return;
    const card = gridEl.current?.querySelector<HTMLElement>(`.tt-card[data-id="${focusRec.current}"]`);
    focusRec.current = '';
    if (card) { card.scrollIntoView({ block: 'nearest' }); card.focus({ preventScroll: true }); }
  };
  useEffect(() => { bringBack(); }, [listVer]);

  const change = (patch: Partial<Filters>, keepScroll = false) => {
    setF((old) => ({ ...old, ...patch }));
    if (!keepScroll) scrollTo({ top: 0 });
  };
  const typing = useRef(0);
  const onType = (q: string) => {
    setTyped(q);
    clearTimeout(typing.current);
    typing.current = window.setTimeout(() => change({ q }), 110);
  };
  const setQuery = (q: string) => { clearTimeout(typing.current); setTyped(q); change({ q }); };
  const clearAll = () => { clearTimeout(typing.current); setTyped(''); change({ q: '', y: 0, m: 0, fav: false }); };

  // '/' finds, wherever the focus is
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.ctrlKey || e.metaKey || e.altKey || player.current?.isOpen()) return;
      const el = document.activeElement;
      if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) return;
      e.preventDefault();
      searchEl.current?.focus();
      searchEl.current?.select();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // while typing, offer the people and hashtags that match the last word
  const suggest = useMemo(() => {
    const last = typed.split(/\s+/).pop() || '';
    const kind = last[0] === '@' ? 'a' : last[0] === '#' ? 't' : '';
    const word = fold(kind ? last.slice(1) : last);
    if (!lib || word.length < 2 || !focused) return [];
    const pick = (map: Map<string, number>, sign: string, max: number) => [...map]
      .filter(([k]) => fold(k).includes(word) && sign + fold(k) !== fold(last))
      .sort((a, b) => (Number(fold(b[0]).startsWith(word)) - Number(fold(a[0]).startsWith(word))) || b[1] - a[1])
      .slice(0, max)
      .map(([k, n]) => [sign + k, n] as const);
    return [...(kind !== 't' ? pick(lib.authors, '@', 4) : []), ...(kind !== 'a' ? pick(lib.tags, '#', 6) : [])];
  }, [typed, focused, lib]);
  const pickSuggestion = (s: string) => {
    const words = typed.split(/\s+/);
    words[words.length - 1] = s;
    setQuery(words.join(' ') + ' ');
    searchEl.current?.blur();
  };

  /* ---------- preview: rest the mouse on a card, or press and hold it, and the video plays in it, muted ---------- */
  const pv = useRef({ el: null as HTMLVideoElement | null, card: null as HTMLElement | null, timer: 0, hold: null as null | { x: number; y: number }, endedAt: 0 }).current;
  function startPreview(card: HTMLElement) {
    if (pv.card === card || player.current?.isOpen() || !card.isConnected) return;
    stopPreview();
    const r = results[Number(card.dataset.i)];
    if (!r) return;
    if (!pv.el) { // one muted element for every preview; muted video may always play on its own
      const v = pv.el = document.createElement('video');
      v.className = 'tt-pv';
      v.muted = true; v.loop = true; v.playsInline = true; v.preload = 'auto';
      v.setAttribute('muted', ''); v.setAttribute('playsinline', '');
      v.addEventListener('playing', () => v.classList.add('on'));
    }
    pv.card = card;
    card.appendChild(pv.el);
    pv.el.src = LIB + r.v.file;
    pv.el.play().catch(() => {});
  }
  function stopPreview() {
    clearTimeout(pv.timer);
    if (!pv.card || !pv.el) return;
    const v = pv.el;
    v.pause(); v.classList.remove('on'); v.removeAttribute('src'); v.load(); v.remove(); // stops the download too
    pv.card = null;
  }
  useEffect(() => stopPreview, [results]);
  const cardOf = (e: Event) => (e.target as Element).closest<HTMLElement>('.tt-card');
  const grid = {
    onClick(e: MouseEvent) {
      if (Date.now() - pv.endedAt < 500) return; // letting go of a press-and-hold preview doesn't open the player
      const card = cardOf(e);
      if (card) { stopPreview(); player.current?.open(Number(card.dataset.i)); }
    },
    // mouse: after a short rest on the card, so sweeping across the grid doesn't start a dozen videos
    onPointerOver(e: PointerEvent) {
      if (e.pointerType !== 'mouse') return;
      const card = cardOf(e);
      if (!card || card === pv.card) return;
      clearTimeout(pv.timer);
      pv.timer = window.setTimeout(() => startPreview(card), 250);
    },
    onPointerOut(e: PointerEvent) {
      if (e.pointerType !== 'mouse') return;
      const card = cardOf(e);
      if (!card || card.contains(e.relatedTarget as Node)) return;
      clearTimeout(pv.timer);
      if (pv.card === card) stopPreview();
    },
    // finger or pen: press and hold; moving (scrolling) cancels it, letting go stops it
    onPointerDown(e: PointerEvent) {
      if (e.pointerType === 'mouse') return;
      const card = cardOf(e);
      if (!card) return;
      pv.hold = { x: e.clientX, y: e.clientY };
      clearTimeout(pv.timer);
      pv.timer = window.setTimeout(() => startPreview(card), 300);
    },
    onPointerMove(e: PointerEvent) {
      if (pv.hold && !pv.card && Math.hypot(e.clientX - pv.hold.x, e.clientY - pv.hold.y) > 10) { pv.hold = null; clearTimeout(pv.timer); }
    },
    onPointerUp: () => endHold(),
    onPointerCancel: () => endHold(),
    onContextMenu(e: Event) { if (pv.hold || pv.card) e.preventDefault(); }, // no "save image" menu on a long press
  };
  function endHold() {
    if (!pv.hold) return;
    pv.hold = null;
    clearTimeout(pv.timer);
    if (pv.card) { pv.endedAt = Date.now(); stopPreview(); }
  }

  const onStar = (id: string, on: boolean) => {
    const saving = saveStar(id, on); // changes the set at once; puts it back if the server didn't keep it
    setStarsVer((n) => n + 1);
    if (!player.current?.isOpen()) setListVer((n) => n + 1);
    return saving.catch((e) => { setStarsVer((n) => n + 1); throw e; });
  };
  const onClosed = (rec: Rec | null, starsChanged: boolean) => {
    focusRec.current = rec?.id ?? '';
    // videos unstarred while watching leave the Starred list now, not mid-swipe
    if (starsChanged) setListVer((n) => n + 1);
    else requestAnimationFrame(bringBack);
  };
  const onFind = (q: string) => { clearTimeout(typing.current); setTyped(q); change({ q, y: 0, m: 0 }); };

  const dated = f.sort === 'new' || f.sort === 'old';
  const cards = useMemo(() => {
    const card = (r: Rec, i: number) => {
      const who = r.user ? '@' + r.user : '';
      return (
        <button
          type="button"
          key={r.id}
          class={'tt-card' + (stars.has(r.id) ? ' is-starred' : '')}
          data-i={i}
          data-id={r.id}
          aria-label={t('{who}, saved {date}', { who: who || t('Video'), date: formatDate(r.t, { day: 'numeric', month: 'short', year: 'numeric' }) }) + (r.cap ? '. ' + r.cap.slice(0, 80) : '')}
          title={r.cap.slice(0, 140)}
        >
          {r.v.thumb && <img loading="lazy" decoding="async" alt="" src={LIB + r.v.thumb} />}
          <span class="tt-card-u">{who}</span>
          <span class="tt-card-d">{r.v.duration ? fmtDur(r.v.duration) : ''}</span>
        </button>
      );
    };
    if (!dated) return <div class="tt-cards">{results.map(card)}</div>;
    const out = [];
    for (let i = 0; i < results.length;) {
      const { yr, mon } = results[i];
      const start = i;
      while (i < results.length && results[i].yr === yr && results[i].mon === mon) i++;
      out.push(
        <section class="tt-month" key={`${yr}-${mon}`}>
          <h2 class="tt-month-head">{monthLabel(yr, mon)}<small>{num.format(i - start)}</small></h2>
          <div class="tt-cards">{results.slice(start, i).map((r, k) => card(r, start + k))}</div>
        </section>,
      );
    }
    return out;
  }, [results, starsVer, dated]);

  const subtitle = lib
    ? t('{n} videos · {s} starred', { n: num.format(lib.all.length), s: num.format(starredN) })
    : t('Your favorite TikToks, downloaded onto the server and watched here');

  return (
    <div class="page stats-page tt-page" ref={pageEl}>
      <div class="journal-top stats-top tt-top" style={{ '--sky': `var(--emo-${WORLD})` }}>
        <Sky world={WORLD} />
        <PageHead
          title={t('Saved TikToks')}
          back={() => goBack()}
          subtitle={subtitle}
          actions={
            <button class="icon-btn" onClick={() => navigate('tiktok/download')} aria-label={t('Download more videos')} title={t('Download more videos')}>
              <Icon name="download" />
            </button>
          }
        />
      </div>

      {failed ? (
        <div class="empty fade-arrive-soft">
          {failed === 'no-library' ? (
            <>
              <h2 class="title-s">{t('No videos yet')}</h2>
              <p>{t('Add your TikTok export and the server downloads your favorites.')}</p>
              <button class="btn btn-primary" onClick={() => navigate('tiktok/download')}><Icon name="download" size={18} /> {t('Download')}</button>
            </>
          ) : (
            <>
              <h2 class="title-s">{t('Couldn’t load your videos')}</h2>
              <p>{t('The downloader didn’t send the list ({why}). Try again in a minute.', { why: failed })}</p>
              <button class="btn btn-quiet" onClick={() => { setFailed(''); setAgain((n) => n + 1); }}><Icon name="refresh" size={18} /> {t('Try again')}</button>
            </>
          )}
        </div>
      ) : !lib || !view ? (
        <div class="tt-cards tt-ghosts" aria-hidden="true">
          {Array.from({ length: 12 }, (_, i) => <span class="ghost" key={i} />)}
        </div>
      ) : (
        <>
          <div class="tt-bar" ref={barEl}>
            <div class="tt-bar-row">
              <label class="search tt-search">
                <Icon name="search" size={18} />
                <input
                  ref={searchEl}
                  type="search"
                  value={typed}
                  onInput={(e) => onType(e.currentTarget.value)}
                  onFocus={() => setFocused(true)}
                  onBlur={() => setTimeout(() => setFocused(false), 150)} // let a tap on a suggestion land first
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') e.currentTarget.blur();
                    if (e.key === 'Escape') { if (typed) setQuery(''); else e.currentTarget.blur(); }
                  }}
                  placeholder={t('Search captions, people, #tags, dates')}
                  aria-label={t('Search saved videos')}
                  autocomplete="off"
                  autocapitalize="off"
                  autocorrect="off"
                  spellcheck={false}
                  enterkeyhint="search"
                />
                {typed && (
                  <button type="button" class="icon-btn small" onClick={() => { setQuery(''); searchEl.current?.focus(); }} aria-label={t('Clear search')}>
                    <Icon name="x" size={16} />
                  </button>
                )}
              </label>
              <button type="button" class="btn btn-primary tt-random" onClick={() => { stopPreview(); player.current?.random(); }} disabled={!results.length} title={t('Play these videos in random order')}>
                <Icon name="arrows-shuffle" size={18} />
                <span>{t('Random')}</span>
              </button>
            </div>

            {suggest.length > 0 && (
              <div class="tt-chips tt-suggest" role="toolbar" aria-label={t('People and hashtags')} onPointerDown={(e) => e.preventDefault()}>
                {suggest.map(([s, n]) => (
                  <button type="button" class="chip" key={s} onClick={() => pickSuggestion(s)}>{s}<small>{num.format(n)}</small></button>
                ))}
              </div>
            )}

            <div class="tt-bar-row">
              <div class="tt-chips" ref={yearsEl} role="toolbar" aria-label={t('Years')}>
                <button type="button" class="chip tt-fav" aria-pressed={f.fav} onClick={() => change({ fav: !f.fav, y: 0, m: 0 })} title={t('Show only the videos you starred')}>
                  <Icon name="star" size={16} />
                  {t('Starred')}
                  <small>{num.format(starredN)}</small>
                </button>
                <span class="tt-gap" aria-hidden="true" />
                <button type="button" class="chip" aria-pressed={!f.y} onClick={() => change({ y: 0, m: 0 })}>{t('All')}<small>{num.format(view.all)}</small></button>
                {view.years.map(([y, n]) => (
                  <button type="button" class="chip" key={y} aria-pressed={f.y === y} onClick={() => change({ y: f.y === y ? 0 : y, m: 0 })}>{y}<small>{num.format(n)}</small></button>
                ))}
              </div>
              <SortChip<Sort> sort={f.sort} options={SORTS} onSort={(s) => { if (s === 'shuffle') setSeed((Math.random() * 2 ** 31) | 0); change({ sort: s }); }} />
            </div>

            {f.y > 0 && (
              <div class="tt-chips" ref={monthsEl} role="toolbar" aria-label={t('Months')}>
                {view.months.map((n, i) => (n || f.m === i + 1) ? (
                  <button type="button" class="chip" key={i} aria-pressed={f.m === i + 1} onClick={() => change({ m: f.m === i + 1 ? 0 : i + 1 })}>
                    {monthShort(f.y, i)}<small>{num.format(n)}</small>
                  </button>
                ) : null)}
              </div>
            )}
          </div>

          {!results.length ? (
            f.fav && !starredN ? (
              <div class="empty fade-arrive-soft">
                <h2 class="title-s">{t('No starred videos yet')}</h2>
                <p>{t('Open a video and tap the star at the top to keep it here.')}</p>
                <button class="btn btn-quiet" onClick={clearAll}>{t('Show everything')}</button>
              </div>
            ) : lib.all.length ? (
              <div class="empty-note center fade-arrive-soft">
                <p>{t('Nothing matches. Try fewer words, or another year.')}</p>
                <button class="btn btn-quiet" onClick={clearAll}>{t('Clear filters')}</button>
              </div>
            ) : (
              <div class="empty fade-arrive-soft">
                <h2 class="title-s">{t('No downloaded videos yet')}</h2>
                <p>{t('Add your TikTok export and the server downloads your favorites.')}</p>
                <button class="btn btn-primary" onClick={() => navigate('tiktok/download')}><Icon name="download" size={18} /> {t('Download')}</button>
              </div>
            )
          ) : (
            <div class="tt-grid" ref={gridEl} {...grid}>{cards}</div>
          )}
          {lib.hidden > 0 && <p class="tt-foot">{t('{n} favorites aren’t downloaded and are hidden.', { n: num.format(lib.hidden) })}</p>}
        </>
      )}

      {/* on the body, so the page's own entrance (a transform) never moves the full-screen player */}
      {createPortal(<Player api={player} list={results} stars={stars} starsVer={starsVer} onStar={onStar} onFind={onFind} onClosed={onClosed} />, document.body)}
    </div>
  );
}
