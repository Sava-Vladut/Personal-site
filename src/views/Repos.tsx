import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { coreOf } from '../data/emotions';
import { navigate } from '../lib/router';
import { ago, connectGithub, forgetRepos, getReadme, githubStatus, listGhRepos, repoFullName, useLoad, type GhRepo } from '../lib/github';
import { watchView } from '../lib/inView';
import { readmeExcerpt } from '../components/Readme';
import { usePref } from '../lib/prefs';
import { repoIdOf, useReady, useRepos, type Repo } from '../lib/store';
import { CountUp } from '../components/charts';
import { CloudTitle, feltWorlds } from '../components/cloud';
import { EmotionChip } from '../components/emotion';
import { Icon } from '../components/icons';
import { NavWheel } from '../components/NavWheel';
import { Sky } from '../components/Sky';
import { Stars } from '../components/books';
import { Spin, languageColor } from '../components/repos';
import { noun, t } from '../lib/i18n';
import '../styles/repos.css';

type Filter = 'all' | 'journaled' | 'public' | 'private';
const FILTERS: Filter[] = ['all', 'journaled', 'public', 'private'];

// with nothing felt yet: the cool of a terminal at night, and a spark of orange
const QUIET = ['calm-safety', 'sadness', 'hope-interest'];

/** A repo as the list shows it: what GitHub says now, and what you've written about it. */
interface Row { id: string; name: string; description: string; language: string; private: boolean; pushed: string; saved: Repo | null }

const journaled = (r: Repo | null) => !!r && (r.rating > 0 || r.emotions.length > 0 || r.text.trim() !== '');

function RepoRow({ row, last, i, connected }: { row: Row; last: boolean; i: number; connected: boolean }) {
  const card = useRef<HTMLButtonElement>(null);
  const [excerpt, setExcerpt] = useState('');
  useEffect(() => {
    if (!connected || !card.current) return;
    let alive = true;
    let started = false;
    const load = (visible: boolean) => {
      if (!visible || started) return;
      started = true;
      getReadme(row.id.slice(2)).then(({ text }) => {
        if (alive) setExcerpt(text ? readmeExcerpt(text) : '');
      }).catch(() => {}); // A preview is optional; the repo page offers retry and sign-in.
    };
    const stop = typeof IntersectionObserver === 'undefined' ? (load(true), () => {}) : watchView(card.current, load);
    return () => { alive = false; stop(); };
  }, [row.id, connected]);
  const r = row.saved;
  const [owner, name] = row.name.includes('/') ? [row.name.slice(0, row.name.indexOf('/') + 1), row.name.slice(row.name.indexOf('/') + 1)] : ['', row.name];
  const main = r?.emotions[0] ? coreOf(r.emotions[0]).id : null;
  return (
    <li class={`repo-item${last ? ' is-last' : ''}${main ? ' is-felt' : ''}`} style={{ '--i': Math.min(i, 14), '--c': main ? `var(--emo-${main})` : undefined }}>
      <span class="repo-branch" aria-hidden="true">{last ? '└─' : '├─'}</span>
      <button ref={card} class="repo-card card" onClick={() => navigate('repo/' + row.id)}>
        <span class="repo-line">
          <span class="repo-name"><small>{owner}</small>{name}</span>
          {row.private && <Icon name="lock" size={14} />}
          {r && r.rating > 0 && <Stars value={r.rating} size={13} />}
        </span>
        {row.description && <span class="repo-desc">{row.description}</span>}
        <span class="repo-meta">
          {row.language && <span class="repo-lang"><i style={{ background: languageColor(row.language) }} />{row.language}</span>}
          {row.pushed && <span>{ago(row.pushed)}</span>}
          {r?.emotions.slice(0, 3).map((id, k) => <EmotionChip id={id} size="sm" idle="view" delay={(r.created + k * 380) % 1300} />)}
        </span>
        {excerpt && <span class="repo-readme"><span class="repo-readme-label">README.md</span><span class="repo-readme-text">{excerpt}</span></span>}
      </button>
    </li>
  );
}

/** Your GitHub repos, listed like a directory under a sky of code: rate them, say how they feel, and keep what you learn. */
export function Repos() {
  const saved = useRepos();
  const ready = useReady();
  const [filter, setFilter] = usePref<Filter>('repos-filter', 'all', FILTERS);
  const [searching, setSearching] = useState(false);
  const [q, setQ] = useState('');
  const [revision, setRevision] = useState(0);
  const live = useLoad(async () => {
    const status = await githubStatus();
    return { status, items: status.connected ? await listGhRepos() : ([] as GhRepo[]) };
  }, 0);
  const status = live.data?.status;
  const items = live.data?.items;

  const rows = useMemo(() => {
    const byId = new Map(saved.map((r) => [r.id, r]));
    const out: Row[] = (items ?? []).map((g) => {
      const id = repoIdOf(g.id);
      return { id, name: repoFullName(g), description: g.description, language: g.language, private: g.private, pushed: g.pushed, saved: byId.get(id) ?? null };
    });
    // repos you've written about that GitHub didn't list (not signed in, or gone from your account) stay, as you left them
    const seen = new Set(out.map((r) => r.id));
    for (const r of saved) if (!seen.has(r.id) && (items === undefined || journaled(r))) out.push({ id: r.id, name: r.name, description: r.description, language: r.language, private: r.private, pushed: '', saved: r });
    return out;
  }, [saved, items]);

  const shown = useMemo(() => {
    const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
    const list = rows.filter((r) =>
      (filter === 'all' || (filter === 'journaled' ? journaled(r.saved) : filter === 'private' ? r.private : !r.private))
      && words.every((w) => `${r.name} ${r.description} ${r.language}`.toLowerCase().includes(w)));
    if (filter === 'journaled') list.sort((a, b) => (b.saved?.updated ?? 0) - (a.saved?.updated ?? 0));
    return list;
  }, [rows, filter, q]);

  const worlds = useMemo(() => feltWorlds(saved, QUIET), [saved]);
  const connected = !!status?.connected;
  const stats: [number, string][] = rows.length
    ? [[rows.length, t('repos')], ...(connected ? [[rows.filter((r) => r.private).length, t('private')] as [number, string]] : []), [rows.filter((r) => journaled(r.saved)).length, t('journaled')]]
    : [];

  const refresh = () => { forgetRepos(); setRevision((n) => n + 1); live.reload(); };

  return (
    <div class="page media-page repos-page">
      <div class="journal-top media-top" style={{ '--sky': `var(--emo-${worlds[0]})` }}>
        <Sky world={worlds[0]} worlds={worlds} letters="repos" />
        <header class="page-head">
          <div class="row between">
            <CloudTitle text={t('Your repos')} />
            <div class="row">
              {rows.length > 0 && (
                <button class="icon-btn" aria-pressed={searching} aria-label={t('Search your repos')} title={t('Search')} onClick={() => { setSearching(!searching); if (searching) setQ(''); }}>
                  <Icon name="search" />
                </button>
              )}
              {connected && (
                <button class="icon-btn" onClick={refresh} aria-label={t('Reload from GitHub')} title={t('Reload from GitHub')} disabled={live.loading}>
                  <Icon name="refresh" />
                </button>
              )}
              <NavWheel world={worlds[0]} />
            </div>
          </div>
          {!rows.length && <p class="subtitle">{t('Rate the things you build, say how they make you feel, and read their story in commits.')}</p>}
        </header>

        {stats.length > 0 && (
          <div class="media-stats">
            {stats.map(([value, label], i) => (
              <span class="media-stat" style={{ '--i': i }}>
                <b><CountUp value={value} /></b>
                <small>{label}</small>
              </span>
            ))}
          </div>
        )}

        {rows.length > 0 && (
          <div class="chips scroll-x filters media-filters" role="toolbar" aria-label={t('Filter repos')}>
            {FILTERS.filter((f) => connected || f === 'all' || f === 'journaled').map((f) => (
              <button class="chip" aria-pressed={filter === f} onClick={() => setFilter(f)}>
                {{ all: t('All'), journaled: t('Journaled'), public: t('Public'), private: t('Private') }[f]}
              </button>
            ))}
          </div>
        )}

        {searching && rows.length > 0 && (
          <label class="search">
            <Icon name="search" size={18} />
            <input type="search" autoFocus placeholder={t('Search your repos')} value={q} onInput={(e) => setQ(e.currentTarget.value)} aria-label={t('Search your repos')} />
          </label>
        )}
      </div>

      <div class="media-panel">
        {live.loading && !items && <p class="repo-wait"><Spin /> {t('Reading your repos from GitHub…')}</p>}
        {live.error && !live.loading && (
          <div class="empty">
            <p>{live.error}</p>
            <button class="btn btn-quiet" onClick={refresh}><Icon name="refresh" size={18} /> {t('Try again')}</button>
          </div>
        )}

        {!live.loading && !connected && (
          <div class="card repo-connect">
            <div class="row gap-s"><Icon name="brand-github" size={20} /> <b>{t('Bring in your GitHub repos')}</b></div>
            <p class="muted small">{status?.offline
              ? t('The app’s server isn’t running, so GitHub isn’t available.')
              : !status?.configured ? t('GitHub login isn’t set up on this server.')
              : t('Log in with GitHub to list your public and private repos here.')}</p>
            {status?.configured && <button class="btn btn-primary" onClick={connectGithub}>{t('Log in')}</button>}
          </div>
        )}

        {ready && connected && items && !rows.length && (
          <div class="empty"><h2 class="title-s">{t('No repos yet')}</h2><p>{t('Repos you own on GitHub show up here.')}</p></div>
        )}
        {rows.length > 0 && !shown.length && <p class="empty-note center">{filter === 'journaled' && !q.trim() ? t('Nothing journaled yet. Open a repo to rate it or say how it feels.') : t('No repos match.')}</p>}

        {shown.length > 0 && (
          <ol class="repo-tree" key={filter + q}>
            {shown.map((row, i) => <RepoRow key={`${row.id}:${revision}`} row={row} last={i === shown.length - 1} i={i} connected={connected} />)}
          </ol>
        )}
        {shown.length > 0 && <p class="repo-count muted small">{shown.length} {noun(shown.length, 'repo', 'repos')}</p>}
      </div>
    </div>
  );
}
