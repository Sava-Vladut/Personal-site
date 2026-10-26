import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { EMOTION } from '../data/emotions';
import { dayLabel, keyOf } from '../lib/dates';
import { ago, cachedRepo, cloneRepo, connectGithub, getGhRepo, getReadme, githubStatus, listClones, listCommits, repoFullName, useLoad, type CloneJob, type GhCommit, type GhRepo } from '../lib/github';
import { goBack } from '../lib/router';
import { MAX_PERSON_EMOTIONS, blankRepo, deleteRepo, getRepos, saveRepo, toast, useRepos, type Repo } from '../lib/store';
import { Stars } from '../components/books';
import { EmotionChip, EmotionPicker } from '../components/emotion';
import { Icon } from '../components/icons';
import { MentionText } from '../components/MentionText';
import { Readme } from '../components/Readme';
import { Sheet } from '../components/Sheet';
import { Sky } from '../components/Sky';
import { Spin, languageColor } from '../components/repos';
import { coreOf } from '../data/emotions';
import { t } from '../lib/i18n';
import { haptic } from '../lib/haptics';
import '../styles/repos.css';

/** What a repo's page keeps of GitHub's description, so the list can show it without asking. */
const factsOf = (g: GhRepo): Pick<Repo, 'name' | 'description' | 'language' | 'private' | 'url'> =>
  ({ name: repoFullName(g), description: g.description, language: g.language, private: g.private, url: g.url });

/** Why GitHub's answer didn't come, in a sentence. */
function Trouble({ error, status, what, onRetry }: { error: string; status?: number; what: string; onRetry: () => void }) {
  return (
    <div class="repo-trouble">
      <p class="muted small">{status === 401 ? t('Log in with GitHub to see {what}.', { what }) : error}</p>
      {status === 401 ? <button class="btn btn-primary btn-s" onClick={() => connectGithub()}>{t('Log in')}</button> : <button class="btn btn-quiet btn-s" onClick={onRetry}><Icon name="refresh" size={16} /> {t('Try again')}</button>}
    </div>
  );
}

/** The commit history as `git log --graph` draws it: a rail of stars down the left, a heading for each day. */
function CommitLog({ id }: { id: string }) {
  const [items, setItems] = useState<GhCommit[]>([]);
  const [next, setNext] = useState<number | undefined>(1);
  const [state, setState] = useState<{ loading: boolean; error: string | null; status?: number }>({ loading: true, error: null });
  const [open, setOpen] = useState<string | null>(null);
  const [round, setRound] = useState(0);
  const batch = useRef(0);

  const more = (page: number) => {
    setState({ loading: true, error: null });
    listCommits(id, page).then(
      (r) => { batch.current = items.length; setItems((x) => (page === 1 ? r.items : [...x, ...r.items])); setNext(r.next); setState({ loading: false, error: null }); },
      (e: Error & { status?: number }) => setState({ loading: false, error: e.message, status: e.status }),
    );
  };
  useEffect(() => { setItems([]); batch.current = 0; more(1); }, [id, round]);

  // every day gets one heading, with its commits under it
  const days = useMemo(() => {
    const out: [string, GhCommit[]][] = [];
    for (const c of items) {
      const day = c.date ? keyOf(new Date(c.date)) : '';
      const last = out[out.length - 1];
      if (last && last[0] === day) last[1].push(c);
      else out.push([day, [c]]);
    }
    return out;
  }, [items]);

  let n = -1;
  return (
    <div class="gitlog">
      {days.map(([day, list]) => (
        <section class="gl-day">
          {day && <h3 class="gl-date"><span>{dayLabel(day)}</span></h3>}
          <ol>
            {list.map((c) => {
              const [first, ...rest] = c.message.split('\n');
              const body = rest.join('\n').trim();
              const merge = /^Merge /.test(first);
              const index = ++n;
              return (
                <li class="gl-commit" style={{ '--i': Math.max(0, index - batch.current) }}>
                  <span class="gl-node" aria-hidden="true">{merge ? '◆' : '*'}</span>
                  <div class="gl-main">
                    {body ? (
                      <button class="gl-msg" aria-expanded={open === c.sha} onClick={() => setOpen(open === c.sha ? null : c.sha)}>
                        {first} <span class="gl-more" aria-hidden="true">{open === c.sha ? '−' : '…'}</span>
                      </button>
                    ) : <span class="gl-msg">{first}</span>}
                    {open === c.sha && <pre class="gl-body">{body}</pre>}
                    <div class="gl-meta">
                      {c.url ? <a href={c.url} target="_blank" rel="noopener noreferrer"><code>{c.sha.slice(0, 7)}</code></a> : <code>{c.sha.slice(0, 7)}</code>}
                      {c.author && <span>{c.author}</span>}
                      {c.date && <span>{ago(c.date)}</span>}
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        </section>
      ))}
      {state.loading && <p class="repo-wait loading-note">{t('Reading the commits…')}</p>}
      {state.error && <Trouble error={state.error} status={state.status} what={t('its commits')} onRetry={() => (items.length ? more(next ?? 1) : setRound((r) => r + 1))} />}
      {!state.loading && !state.error && !items.length && <p class="empty-note">{t('No commits yet.')}</p>}
      {!state.loading && next && items.length > 0 && <button class="btn btn-quiet gl-load" onClick={() => more(next)}>{t('Older commits')}</button>}
      {!state.loading && !next && items.length > 0 && <p class="gl-end" aria-hidden="true">— {t('the first commit')} —</p>}
    </div>
  );
}

/** The README in a frame like a terminal window: a few lines tall until you ask for the rest. */
function ReadmeFrame({ id, base }: { id: string; base: { repo: string; branch: string; private: boolean } }) {
  const readme = useLoad(() => getReadme(id), id);
  const [whole, setWhole] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  const [tall, setTall] = useState(false);
  // tall enough to need the button? Pictures arriving later can change that, so keep watching its size
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const measure = () => setTall(el.scrollHeight > 460);
    measure();
    if (typeof ResizeObserver === 'undefined') return;
    const watch = new ResizeObserver(measure);
    watch.observe(el.firstElementChild ?? el);
    return () => watch.disconnect();
  }, [readme.data]);
  return (
    <div class="rd-frame">
      <div class="rd-bar" aria-hidden="true"><i /><i /><i /><span>README.md</span></div>
      {readme.loading && <p class="repo-wait loading-note">{t('Reading the README…')}</p>}
      {readme.error && <Trouble error={readme.error} status={readme.status} what={t('its README')} onRetry={readme.reload} />}
      {readme.data && (readme.data.text === null || !readme.data.text.trim()) && <p class="empty-note">{t('This repo has no README.')}</p>}
      {readme.data?.text?.trim() && (
        <>
          <div ref={box} class={`rd-scroll fade-arrive-soft${tall && !whole ? ' is-clipped' : ''}`}><Readme text={readme.data.text} base={base} /></div>
          {tall && <button class="rd-expand" aria-expanded={whole} onClick={() => setWhole(!whole)}>{whole ? t('Show less') : t('Show the whole README')}</button>}
        </>
      )}
    </div>
  );
}

/** For the site's owner only: copies the repo onto the server with git clone, and follows it until it's done. */
function CloneToServer({ id }: { id: string }) {
  const [can, setCan] = useState(false);
  const [job, setJob] = useState<CloneJob | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const find = () => listClones().then((r) => { const j = r.items.find((x) => String(x.id) === id); if (j) setJob(j); }, () => {});

  useEffect(() => {
    let live = true;
    setJob(null);
    setError('');
    githubStatus().then((s) => { if (live && s.canClone) { setCan(true); find(); } });
    return () => { live = false; };
  }, [id]);

  // a clone in progress is checked on every couple of seconds
  useEffect(() => {
    if (job?.state !== 'running') return;
    const timer = setInterval(() => !document.hidden && find(), 2000);
    return () => clearInterval(timer);
  }, [job?.state, id]);

  if (!can) return null;
  const start = async () => {
    setBusy(true);
    setError('');
    try { setJob(await cloneRepo(id)); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  };
  const running = busy || job?.state === 'running';
  return (
    <div class="repo-clone">
      {job?.state !== 'done' && (
        <button class="btn btn-quiet btn-s" onClick={start} disabled={running}>
          {running ? <><Spin /> {t('Cloning onto the server…')}</> : <><Icon name="download" size={16} /> {job?.state === 'failed' ? t('Try the clone again') : t('Clone to the server')}</>}
        </button>
      )}
      {job?.state === 'done' && <p class="muted small"><Icon name="check" size={14} /> {t('Cloned to {path}', { path: job.path })}</p>}
      {(error || (job?.state === 'failed' && job.error)) && <p class="muted small">{error || t(job!.error!)}</p>}
    </div>
  );
}

type Open = null | 'emotion';

export function RepoView({ id }: { id: string }) {
  const number = id.slice(2);
  const meta = useLoad(() => getGhRepo(number), id, cachedRepo(number));
  const gh = meta.data;
  const [draft, setDraft] = useState<Repo | null>(() => getRepos().find((r) => r.id === id) ?? null);
  const [open, setOpen] = useState<Open>(null);
  const dirty = useRef(false);
  const alive = useRef(true);
  const removing = useRef(false);
  const leaving = useRef(false);
  const saveRequest = useRef(0);
  const pendingSave = useRef<Promise<boolean> | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const latest = useRef(draft);
  latest.current = draft;
  const meta$ = useRef(gh);
  meta$.current = gh;
  const saved = useRepos().some((r) => r.id === id);

  // a repo you haven't written about yet has no record: it gets one with your first edit
  useEffect(() => {
    if (!latest.current && gh) { latest.current = blankRepo({ id, ...factsOf(gh) }); setDraft(latest.current); }
  }, [gh]);

  const flush = () => {
    clearTimeout(timer.current);
    const d = latest.current;
    if (removing.current || !d) return Promise.resolve(false);
    if (!dirty.current) return pendingSave.current ?? Promise.resolve(true);
    dirty.current = false;
    const request = ++saveRequest.current;
    const saving = saveRepo(d).then(() => true).catch(() => {
      if (!removing.current && request === saveRequest.current) {
        dirty.current = true;
        toast(t('Couldn’t save this repo. Try again.'));
      }
      return false;
    }).finally(() => {
      if (pendingSave.current === saving) pendingSave.current = null;
    });
    pendingSave.current = saving;
    return saving;
  };

  const update = (patch: Partial<Repo>) => {
    if (removing.current || !latest.current) return;
    // what GitHub says now (a rename, a new description) is kept along with your edit
    latest.current = { ...latest.current, ...(meta$.current ? factsOf(meta$.current) : {}), ...patch };
    setDraft(latest.current);
    dirty.current = true;
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, 500);
  };

  useEffect(() => {
    const hide = () => document.visibilityState === 'hidden' && flush();
    document.addEventListener('visibilitychange', hide);
    return () => {
      alive.current = false;
      document.removeEventListener('visibilitychange', hide);
      flush();
    };
  }, []);

  const name = gh ? repoFullName(gh) : draft?.name ?? '';
  const [owner, short] = name.includes('/') ? [name.slice(0, name.indexOf('/') + 1), name.slice(name.indexOf('/') + 1)] : ['', name];
  const description = gh?.description ?? draft?.description ?? '';
  const language = gh?.language ?? draft?.language ?? '';
  const isPrivate = gh?.private ?? draft?.private ?? false;
  const url = gh?.url || draft?.url || '';
  const main = draft?.emotions[0] ? coreOf(draft.emotions[0]).id : null;
  const worlds = useMemo(() => (draft?.emotions.length ? [...new Set(draft.emotions.map((e) => coreOf(e).id))] : ['calm-safety', 'sadness', 'hope-interest']), [draft?.emotions.join()]);

  // keyed apart from the repo's page, so the page arrives with its own entrance instead of snapping in over the wait
  if (!draft)
    return (
      <div class="page" key="wait">
        <div class="empty">
          {meta.loading ? <p class="repo-wait loading-note">{t('Reading the repo from GitHub…')}</p> : (
            <>
              <h2 class="title-s">{t('This repo isn’t available')}</h2>
              <p>{meta.status === 401 ? t('Log in with GitHub to open it.') : meta.status === 404 ? t('It may have been deleted, renamed or made private.') : meta.error}</p>
              {meta.status === 401 && <button class="btn btn-primary" onClick={() => connectGithub()}>{t('Log in')}</button>}
            </>
          )}
          <button class="btn btn-quiet" onClick={() => goBack('repos')}>{t('Back to repos')}</button>
        </div>
      </div>
    );

  const remove = async () => {
    if (removing.current) return;
    haptic(12);
    clearTimeout(timer.current);
    removing.current = true;
    dirty.current = false;
    await pendingSave.current;
    try {
      const removed = await deleteRepo(draft.id);
      if (alive.current) goBack('repos');
      if (removed) toast(t('Repo removed from your journal'), { label: t('Undo'), run: () => saveRepo(removed) });
    } catch {
      removing.current = false;
      dirty.current = true;
      toast(t('Couldn’t remove this repo. Try again.'));
    }
  };

  const done = async () => {
    if (leaving.current) return;
    leaving.current = true;
    await flush();
    if (!dirty.current && alive.current && !removing.current) goBack('repos');
    else leaving.current = false;
  };

  const addEmotion = (eid: string) => {
    const list = draft.emotions.filter((x) => x !== eid && !eid.startsWith(x + '/') && !x.startsWith(eid + '/'));
    update({ emotions: [...list, eid].slice(-MAX_PERSON_EMOTIONS) });
    setOpen(null);
  };

  return (
    <div class="page editor repo-page" key="repo">
      <div class="editor-bar">
        <button class="glass glass-btn round" onClick={done} aria-label={t('Back')}><Icon name="arrow-left" /></button>
        <span class="grow" />
        {saved && <button class="glass glass-btn round" onClick={remove} aria-label={t('Remove from journal')}><Icon name="trash" /></button>}
        <button class="glass glass-btn tinted" onClick={done}>{t('Done')}</button>
      </div>

      <div class="repo-head card" style={{ '--c': main ? `var(--emo-${main})` : undefined }}>
        <span class="person-clouds" aria-hidden="true"><Sky worlds={worlds} letters="repos" small /></span>
        <div class="repo-facts">
          <span class="repo-vis">{isPrivate ? <><Icon name="lock" size={14} /> {t('Private')}</> : t('Public')}</span>
          {language && <span class="repo-lang"><i style={{ background: languageColor(language) }} />{language}</span>}
          {gh && gh.stars > 0 && <span><Icon name="star" size={13} /> {gh.stars}</span>}
          {gh?.fork && <span>{t('Fork')}</span>}
          {gh?.archived && <span>{t('Archived')}</span>}
          {gh?.pushed && <span>{t('pushed {when}', { when: ago(gh.pushed) })}</span>}
        </div>
        <h1 class="repo-title"><small>{owner}</small>{short}</h1>
        {description && <p class="repo-about">{description}</p>}
        {url && <a class="repo-open" href={url} target="_blank" rel="noopener noreferrer"><Icon name="external-link" size={15} /> {t('Open on GitHub')}</a>}
        <CloneToServer id={number} />
        <Stars value={draft.rating} onChange={(rating) => update({ rating })} size={24} />
      </div>

      <div class="eyebrow person-label">{t('How working on it feels')}</div>
      <div class="meta person-meta">
        {draft.emotions.map((eid) => <EmotionChip id={eid} onRemove={() => update({ emotions: draft.emotions.filter((x) => x !== eid) })} />)}
        {draft.emotions.length < MAX_PERSON_EMOTIONS && (
          <button class="chip" onClick={() => setOpen('emotion')}>
            <Icon name="mood-plus" size={16} /> {draft.emotions.length ? t('Add') : t('Add a feeling')}
          </button>
        )}
      </div>
      {draft.emotions.length === 1 && EMOTION[draft.emotions[0]]?.depth === 2 && <p class="definition">{EMOTION[draft.emotions[0]].def}</p>}

      <MentionText
        class="body-input person-text"
        placeholder={t('Your thoughts: what it is, what you built, what you learned, what you’d do differently…')}
        value={draft.text}
        onChange={(text) => update({ text })}
        label={t('Your thoughts')}
      />

      <section class="section">
        <h2 class="section-title row gap-s"><Icon name="git-commit" size={16} /> {t('Commits')}</h2>
        <CommitLog id={number} />
      </section>

      <section class="section">
        <h2 class="section-title">README</h2>
        <ReadmeFrame id={number} base={{ repo: name, branch: gh?.branch ?? 'HEAD', private: isPrivate }} />
      </section>

      <Sheet open={open === 'emotion'} onClose={() => setOpen(null)} title={t('How does it feel?')}>
        <EmotionPicker onPick={addEmotion} selected={draft.emotions} />
      </Sheet>
    </div>
  );
}
