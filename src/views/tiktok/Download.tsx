import { useEffect, useRef, useState } from 'preact/hooks';
import { goBack, navigate } from '../../lib/router';
import { LOCALE, t } from '../../lib/i18n';
import { LIB, call, type Status } from '../../lib/tiktok';
import { PageHead } from '../../components/PageHead';
import { Icon } from '../../components/icons';
import { Select } from '../../components/Select';

const AUTO_KEY = 'saved-tiktoks.autostart';
const num = new Intl.NumberFormat(LOCALE);
type Opts = Status['settings'];

function eta(sec: number) {
  if (sec < 90) return t('about a minute');
  if (sec < 3600) return t('about {n} min', { n: Math.round(sec / 60) });
  return t('about {n} h', { n: (sec / 3600).toLocaleString(LOCALE, { maximumFractionDigits: 1 }) });
}

/**
 * The download page (#/tiktok/download): add a TikTok export (the .zip, or Favorite Videos.txt and Like List.txt), then
 * start or stop the downloader on the server and watch it go. The downloader keeps going with the page closed.
 */
export function Download() {
  const [st, setSt] = useState<Status | null>(null);
  const [down, setDown] = useState(false); // the downloader isn't answering
  const [busy, setBusy] = useState(false); // an upload or a button press is on its way
  const [startError, setStartError] = useState('');
  const [runError, setRunError] = useState('');
  const [upload, setUpload] = useState<{ text: string; bad: boolean } | null>(null);
  const [over, setOver] = useState(false);
  const [more, setMore] = useState(false);
  const [auto, setAuto] = useState(() => { try { return localStorage.getItem(AUTO_KEY) !== '0'; } catch { return true; } });
  const timer = useRef(0);
  const fileEl = useRef<HTMLInputElement>(null);
  const latest = useRef<Status | null>(null);
  latest.current = st;

  async function poll() {
    clearTimeout(timer.current);
    try {
      const s = (await call('api/status')) as Status;
      setSt(s);
      latest.current = s;
      setDown(false);
    } catch {
      setDown(true);
    }
    timer.current = window.setTimeout(poll, latest.current && latest.current.state !== 'idle' ? 1500 : 4000);
  }
  useEffect(() => {
    void poll();
    const onVisible = () => { if (!document.hidden) void poll(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearTimeout(timer.current); document.removeEventListener('visibilitychange', onVisible); };
  }, []);

  async function start() {
    const r = await call('api/start', latest.current?.settings ?? {});
    setStartError(r.ok ? '' : String(r.error || ''));
    await poll();
  }
  async function press() {
    if (busy || !st) return;
    setBusy(true);
    setRunError('');
    try {
      if (st.state === 'running' || (st.state === 'external' && st.can_stop)) {
        const r = await call('api/stop', {});
        if (!r.ok) setRunError(String(r.error || ''));
        await poll();
      } else await start();
    } catch (e) {
      setRunError((e as Error).message);
    }
    setBusy(false);
  }
  async function setOpt(patch: Partial<Opts>) {
    if (!st) return;
    const next = { ...st.settings, ...patch };
    setSt({ ...st, settings: next }); // the switch moves at once
    try { setSt((await call('api/settings', next)) as Status); } catch { /* the next poll shows what the server has */ }
  }
  const setAutoStart = (on: boolean) => {
    setAuto(on);
    try { localStorage.setItem(AUTO_KEY, on ? '1' : '0'); } catch { /* private mode */ }
  };

  async function send(files: File[]) {
    if (!files.length || busy) return;
    setBusy(true);
    const lines: string[] = [];
    let newFav = 0, newLike = 0, failed = false;
    for (const f of files) {
      setUpload({ text: t('Reading {file}…', { file: f.name }), bad: false });
      try {
        const r = await call('api/upload?name=' + encodeURIComponent(f.name), f);
        if (!r.ok) { lines.push(`${f.name}: ${r.error}`); failed = true; continue; }
        newFav += r.new_favorites;
        newLike += r.new_likes;
        for (const n of r.files as { file: string; videos: number; kind: string }[]) lines.push(`${n.file}: ${num.format(n.videos)} ${n.kind}`);
      } catch (e) {
        lines.push(`${f.name}: ${(e as Error).message}`);
        failed = true;
      }
    }
    const added = newFav && newLike ? t('Added {a} new favorites and {b} new likes.', { a: num.format(newFav), b: num.format(newLike) })
      : newFav ? t('Added {a} new favorites.', { a: num.format(newFav) })
      : newLike ? t('Added {b} new likes.', { b: num.format(newLike) })
      : failed && !lines.some((l) => / (favorites|likes)$/.test(l)) ? ''
      : t('Nothing new: you already have every video in it.');
    setUpload({ text: [lines.join('\n'), added].filter(Boolean).join('\n'), bad: failed });
    await poll();
    // carry on by itself when there is something to fetch
    const s = latest.current;
    if (auto && s && s.state === 'idle' && s.library.waiting > 0) {
      try { await start(); } catch (e) { setRunError((e as Error).message); }
    }
    setBusy(false);
  }

  // a file dropped anywhere on the page
  useEffect(() => {
    const onOver = (e: DragEvent) => { e.preventDefault(); setOver(true); };
    const onLeave = (e: DragEvent) => { if (!e.relatedTarget) setOver(false); };
    const onDrop = (e: DragEvent) => { e.preventDefault(); setOver(false); void send([...(e.dataTransfer?.files ?? [])]); };
    addEventListener('dragover', onOver);
    addEventListener('dragleave', onLeave);
    addEventListener('drop', onDrop);
    return () => { removeEventListener('dragover', onOver); removeEventListener('dragleave', onLeave); removeEventListener('drop', onDrop); };
  });

  /* ---------- what to say about the downloader ---------- */
  let state = t('Checking…'), sub = '', label = t('Start download'), enabled = false, stop = false;
  if (down) {
    state = t('Server not reachable');
    sub = t('The downloader’s container isn’t answering. Try again in a minute.');
  } else if (st) {
    const L = st.library, run = st.run, set = st.settings;
    enabled = true;
    const todo = L.waiting + (set.retry_failed ? L.failed : 0);
    if (st.state === 'running') {
      state = t('Downloading');
      stop = true;
      label = t('Stop');
      if (run && run.todo) {
        sub = t('{a} of {b} this run', { a: num.format(run.finished), b: num.format(run.todo) });
        const took = st.now - run.started_at;
        if (run.finished >= 3 && run.finished < run.todo) sub += ' · ' + t('{time} left', { time: eta(took / run.finished * (run.todo - run.finished)) });
      } else sub = run && run.todo === 0 ? t('nothing new to fetch') : t('getting ready…');
    } else if (st.state === 'stopping') {
      state = t('Stopping');
      sub = t('finishing the videos in progress');
      label = t('Stopping…');
      enabled = false;
    } else if (st.state === 'external') {
      state = t('Downloading in another window');
      if (st.can_stop) { stop = true; label = t('Stop'); sub = t('started outside this page'); }
      else { label = t('Running elsewhere'); enabled = false; sub = t('started outside this page; close its window to stop it'); }
    } else {
      if (todo > 0) {
        state = L.waiting ? t('Ready') : t('Some failed');
        sub = L.waiting ? t('{n} waiting to download', { n: num.format(L.waiting) }) : t('{n} to try again', { n: num.format(L.failed) });
        label = L.waiting ? t('Start download') : t('Retry failed');
      } else {
        state = L.total ? t('Everything is saved') : t('No videos listed yet');
        sub = L.total ? '' : t('Add your TikTok export above.');
        label = t('Nothing to download');
        enabled = false;
      }
      if (run && run.ended_at) {
        const bits = [t('saved {n}', { n: num.format(run.downloaded) })];
        if (run.failed) bits.push(t('{n} failed', { n: num.format(run.failed) }));
        if (run.unavailable) bits.push(t('{n} deleted', { n: num.format(run.unavailable) }));
        sub = t('Last run: {what}', { what: bits.join(', ') }) + (sub ? ` · ${sub}` : '');
      }
    }
  }
  const run = st?.run;
  const failedRun = !!(run && run.ended_at && run.exit_code !== 0 && run.exit_code !== 130);
  const why = runError || startError || (failedRun ? run!.message || st!.log[st!.log.length - 1] || '' : '');
  const going = !!st && st.state !== 'idle';
  const L = st?.library;
  const total = Math.max(1, L?.total ?? 1);
  const set = st?.settings;

  return (
    <div class="page tt-page tt-dl">
      <PageHead title={t('Download')} back={() => goBack('tiktok')} subtitle={t('Add your TikTok export and the server downloads your favorites, even with this page closed.')} />

      <section class={'card tt-drop' + (over ? ' is-over' : '')}>
        <h2 class="section-title">{t('Add a TikTok export')}</h2>
        <p>{t('Drop the export’s .zip here, or just Favorite Videos.txt and Like List.txt. Videos you already have are skipped.')}</p>
        <button type="button" class="btn btn-quiet" onClick={() => fileEl.current?.click()} disabled={busy}><Icon name="upload" size={18} /> {t('Choose files')}</button>
        <input
          ref={fileEl}
          type="file"
          multiple
          hidden
          accept=".zip,.txt,.json,application/zip,text/plain,application/json"
          onChange={(e) => { const input = e.currentTarget; void send([...(input.files ?? [])]); input.value = ''; }}
        />
        {upload && <p class={'tt-msg fade-arrive-soft' + (upload.bad ? ' is-bad' : '')} role="status">{upload.text}</p>}
      </section>

      <section class={'card tt-run' + (going ? ' is-going' : '')}>
        <div class="tt-run-head">
          <div class="tt-run-state">
            <b>{state}</b>
            {sub && <span>{sub}</span>}
          </div>
          {!down && (
            <button type="button" class={'btn ' + (stop ? 'btn-quiet' : 'btn-primary')} onClick={press} disabled={!enabled || busy}>
              {stop ? <Icon name="player-stop" size={18} /> : <Icon name="download" size={18} />} {label}
            </button>
          )}
          {down && <button type="button" class="btn btn-quiet" onClick={() => void poll()}><Icon name="refresh" size={18} /> {t('Try again')}</button>}
        </div>
        <div class="tt-meter" role="img" aria-label={L ? t('{a} of {b} saved', { a: num.format(L.downloaded), b: num.format(L.total) }) : t('Download progress')}>
          {L && <>
            <i class="ok" style={{ width: (L.downloaded / total) * 100 + '%' }} />
            <i class="fail" style={{ width: (L.failed / total) * 100 + '%' }} />
            <i class="gone" style={{ width: (L.unavailable / total) * 100 + '%' }} />
          </>}
        </div>
        <dl class="tt-nums">
          <div><dt><i class="ok" />{t('Saved')}</dt><dd>{L ? num.format(L.downloaded) : '–'}{L && <small> / {num.format(L.total)}</small>}</dd></div>
          <div><dt>{t('Waiting')}</dt><dd>{L ? num.format(L.waiting) : '–'}</dd></div>
          <div><dt><i class="fail" />{t('Failed')}</dt><dd>{L ? num.format(L.failed) : '–'}</dd></div>
          <div><dt><i class="gone" />{t('Deleted')}</dt><dd>{L ? num.format(L.unavailable) : '–'}</dd></div>
        </dl>
        {why && <p class="tt-msg is-bad fade-arrive-soft">{why}</p>}
      </section>

      {set && (
        <section class="section">
          <h2 class="section-title">{t('Options')}</h2>
          <div class="card list">
            <label class="list-row">
              <div>
                <div>{t('Also download my likes')}</div>
                <div class="muted small">{st!.sources.likes ? t('{n} more videos', { n: num.format(st!.sources.likes_only) }) : t('Add Like List.txt first')}</div>
              </div>
              <button class="switch" role="switch" aria-checked={set.include_likes} aria-label={t('Also download my likes')} onClick={() => void setOpt({ include_likes: !set.include_likes })} />
            </label>
            <label class="list-row">
              <div>{t('Start downloading right after an upload')}</div>
              <button class="switch" role="switch" aria-checked={auto} aria-label={t('Start downloading right after an upload')} onClick={() => setAutoStart(!auto)} />
            </label>
            <button type="button" class="list-row action" onClick={() => setMore(!more)} aria-expanded={more}>
              <span>{t('More options')}</span>
              <Icon name={more ? 'chevron-up' : 'chevron-down'} size={16} />
            </button>
            {more && <>
              <label class="list-row fade-arrive-soft">
                <div>{t('Try the failed ones again')}</div>
                <button class="switch" role="switch" aria-checked={set.retry_failed} aria-label={t('Try the failed ones again')} onClick={() => void setOpt({ retry_failed: !set.retry_failed })} />
              </label>
              <label class="list-row fade-arrive-soft">
                <div>
                  <div>{t('Look like a normal browser to TikTok')}</div>
                  <div class="muted small">{t('Needs curl_cffi; TikTok refuses downloads without it')}</div>
                </div>
                <button class="switch" role="switch" aria-checked={set.impersonate} aria-label={t('Look like a normal browser to TikTok')} onClick={() => void setOpt({ impersonate: !set.impersonate })} />
              </label>
              <label class="list-row fade-arrive-soft">
                <div>{t('Videos at once')}</div>
                <Select class="tt-select" label={t('Videos at once')} value={String(set.workers)} onChange={(v) => void setOpt({ workers: Number(v) })} options={[1, 2, 3, 4].map((n) => ({ value: String(n), label: String(n) }))} />
              </label>
              <label class="list-row fade-arrive-soft">
                <div>
                  <div>{t('Use my TikTok login from')}</div>
                  <div class="muted small">{t('For age-restricted or private videos')}</div>
                </div>
                <Select class="tt-select" label={t('Use my TikTok login from')} value={set.cookies_browser} onChange={(v) => void setOpt({ cookies_browser: v })} options={[
                  { value: '', label: t('Nobody') },
                  { value: 'firefox', label: 'Firefox' },
                  { value: 'edge', label: 'Edge' },
                  { value: 'chrome', label: 'Chrome' },
                ]} />
              </label>
            </>}
          </div>
        </section>
      )}

      {st && st.events.length > 0 && (
        <section class="section">
          <h2 class="section-title">{t('This run')}</h2>
          <div class="card list tt-feed">
            {st.events.slice().reverse().map((e) => e.kind === 'ok' ? (
              <button type="button" class="list-row action" key={'ok' + e.id} onClick={() => navigate('tiktok?v=' + e.id)}>
                <img alt="" loading="lazy" src={`${LIB}thumbs/${e.id}.jpg`} onError={(ev) => { ev.currentTarget.style.visibility = 'hidden'; }} />
                <span class="grow"><b>{t('Saved')}</b><small>{t('Tap to watch')}</small></span>
                <Icon name="player-play" size={16} />
              </button>
            ) : (
              <a class="list-row action is-bad" key={e.kind + e.id} href={`https://www.tiktok.com/@_/video/${e.id}`} target="_blank" rel="noopener noreferrer">
                <span class="tt-feed-x"><Icon name={e.kind === 'gone' ? 'eye-off' : 'alert-circle'} size={16} /></span>
                <span class="grow"><b>{e.kind === 'gone' ? t('Deleted or private') : t('Download failed')}</b><small>{e.error || ''}</small></span>
                <Icon name="external-link" size={16} />
              </a>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
