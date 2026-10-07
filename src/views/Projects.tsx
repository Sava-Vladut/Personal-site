import { useEffect, useMemo, useState } from 'preact/hooks';
import { coreOf } from '../data/emotions';
import { addDays, diffDays, keyOf, shortDate, todayKey, weekday, WEEKDAYS } from '../lib/dates';
import { allTimes, buckets, connectGithub, githubStatus, languageShares, loadGithub, perDay, RANGE_DAYS, rangeStart, rhythm, since, streaks, useGithub, weekly, type Github, type Range, type Repo, type Step } from '../lib/github';
import { usePref } from '../lib/prefs';
import { navigate } from '../lib/router';
import { getProjects, getSettings, projectId, saveProject, toast, useProjects, type Project } from '../lib/store';
import { compact } from '../lib/twitch';
import { ActivityGrid, ago, CommitBars, CommitList, LanguageBars, RhythmCard, Spark, TodoItem, useAccent } from '../components/github';
import { CountUp, RevealStack } from '../components/charts';
import { Icon, Sprite, type UiName } from '../components/icons';
import { NavWheel } from '../components/NavWheel';
import { Sky } from '../components/Sky';
import { CloudTitle } from './Media';
import { GithubAccount, signInResult } from '../components/GithubSignIn';
import { LOCALE, count, t } from '../lib/i18n';
import '../styles/stats.css';
import '../styles/twitch.css';
import '../styles/github.css';

const RANGES: [Range, string][] = [['30', t('30 days')], ['90', t('90 days')], ['365', t('Year')], ['all', t('All')]];
const RANGE_IDS = RANGES.map((r) => r[0]);
const IN_RANGE: Record<Range, string> = {
  '30': t('in the last 30 days'), '90': t('in the last 90 days'), '365': t('in the last year'), all: t('since the first one'),
};
const BEFORE: Record<Range, string> = { '30': t('vs the 30 days before'), '90': t('vs the 90 days before'), '365': t('vs the year before'), all: '' };
const SORTS = ['recent', 'commits', 'name'] as const;
type Sort = (typeof SORTS)[number];
const SHOWN = 6;

const num = (n: number) => n.toLocaleString(LOCALE);
const signed = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '±') + Math.abs(n).toLocaleString(LOCALE);
/** Something to do, not yet done. */
const open = (p?: Project) => p?.todos.filter((x) => !x.done) ?? [];

/** Your GitHub repositories: what you've been building, when, in what, and what's left to do. `?at=todos|commits|list` opens it there. */
export function Projects({ query }: { query: URLSearchParams }) {
  useAccent();
  const { data, error, loading } = useGithub();
  const notes = useProjects();
  const [range, setRange] = usePref<Range>('gh-range', '90', RANGE_IDS);
  const at = query.get('at');

  // back from GitHub's sign-in
  useEffect(() => {
    const r = query.get('github');
    if (!r) return;
    toast(signInResult(r));
    navigate('projects', true);
  }, []);

  // the wheel can open the page at a section
  useEffect(() => {
    if (!data || !at) return;
    const timer = setTimeout(() => document.getElementById('pj-' + at)?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 120);
    return () => clearTimeout(timer);
  }, [!!data, at]);

  const total = data?.repos.reduce((s, r) => s + r.commits, 0) ?? 0;
  const stars = data?.repos.reduce((s, r) => s + r.stars, 0) ?? 0;
  const todo = notes.reduce((s, p) => s + open(p).length, 0);
  const newest = data?.repos.reduce((m, r) => Math.max(m, r.pushedAt), 0) ?? 0;

  return (
    <div class="page stats-page pj-page">
      <div class="journal-top stats-top pj-top" style={{ '--sky': 'var(--emo-calm-safety)' }}>
        <Sky world="calm-safety" letters="code" />
        <header class="page-head">
          <div class="row between">
            <CloudTitle text={t('Projects')} />
            <div class="row">
              {data?.profile && (
                <a class="icon-btn" href={data.profile.url} target="_blank" rel="noopener noreferrer" aria-label={t('Open on GitHub')} title={t('Open on GitHub')}>
                  <Icon name="brand-github" />
                </a>
              )}
              <NavWheel world="calm-safety" />
            </div>
          </div>
          <p class="subtitle pj-who">
            {data?.profile ? (
              <>
                {data.profile.avatar && <img class="pj-avatar" src={data.profile.avatar} alt="" width={20} height={20} loading="lazy" />}
                <b>@{data.profile.login}</b>
                {newest > 0 && <span> · {t('last push {when}', { when: ago(newest, data.now) })}</span>}
              </>
            ) : (
              t('Your GitHub projects, with notes and to-dos')
            )}
          </p>
          {data && <GithubAccount data={data} />}
        </header>

        {data && (
          <div class="media-stats pj-stats">
            {([[data.repos.length, t('projects')], [total, t('commits')], [stars, t('stars')], [todo, t('to-dos open')]] as [number, string][]).map(([value, label], i) => (
              <span class="media-stat" style={{ '--i': i }}>
                <b><CountUp value={value} /></b>
                <small>{label}</small>
              </span>
            ))}
          </div>
        )}

        {data && (
          <div class="seg tabs pj-range" role="tablist" aria-label={t('Time range')} style={{ '--at': RANGE_IDS.indexOf(range), '--tabs': RANGES.length }}>
            {RANGES.map(([id, name]) => (
              <button role="tab" aria-selected={range === id} onClick={() => setRange(id)}>{name}</button>
            ))}
          </div>
        )}
      </div>

      {!data ? (
        error ? (
          <div class="empty">
            <h2 class="title-s">{t('No projects')}</h2>
            <p>{t(error)}</p>
            <div class="row gap-s">
              <button class="btn btn-quiet" onClick={() => loadGithub(true)}><Icon name="refresh" size={18} /> {t('Try again')}</button>
              <SignInIfPossible />
            </div>
          </div>
        ) : (
          <p class="empty-note center">{loading ? t('Loading…') : ''}</p>
        )
      ) : (
        <Board key={range} data={data} range={range} notes={notes} total={total} />
      )}
    </div>
  );
}

/** When there's nothing to show everyone, signing in may still show your own. */
function SignInIfPossible() {
  const [can, setCan] = useState(false);
  useEffect(() => void githubStatus().then((s) => setCan(s.configured && !s.connected), () => {}), []);
  return can ? <button class="btn btn-primary" onClick={() => connectGithub('#/projects')}><Icon name="brand-github" size={18} /> {t('Sign in with GitHub')}</button> : null;
}

function Board({ data, range, notes, total }: { data: Github; range: Range; notes: Project[]; total: number }) {
  const today = todayKey();
  const s = useMemo(() => {
    const all = allTimes(data.repos);
    const days = perDay(all);
    const firstDay = all.length ? keyOf(new Date(all[all.length - 1] * 1000)) : today;
    const from = rangeStart(range) || firstDay;
    const n = RANGE_DAYS[range];
    const shown = since(all, rangeStart(range));
    const before = n ? since(all, addDays(from, -n)).length - shown.length : null;
    const active = [...days.keys()].filter((k) => k >= from).length;
    const byDay = new Array(7).fill(0) as number[];
    for (const [k, v] of days) if (k >= from) byDay[weekday(k)] += v;
    const busiest = byDay.indexOf(Math.max(...byDay));
    const touched = data.repos.map((r) => ({ r, n: since(r.times, rangeStart(range)).length })).filter((x) => x.n).sort((a, b) => b.n - a.n);
    const span = diffDays(from, today) + 1;
    const step: Step = span <= 31 ? 'day' : span <= 400 ? 'week' : 'month';
    return {
      days, from, shown, before, active, span, busiest, busiestN: byDay[busiest], touched, step,
      streak: streaks(days),
      todayN: days.get(today) ?? 0,
      weekN: since(all, addDays(today, -6)).length,
      heat: rhythm(shown),
      bars: buckets(days, from, step, getSettings().weekStart),
      langs: languageShares(data.repos.filter((r) => !r.fork).map((r) => r.languages)),
    };
  }, [data, range]);

  return (
    <RevealStack>
      <section class="card hero tw-hero pj-hero">
        <div class="tile-label">{t('Commits')} {IN_RANGE[range]}</div>
        <div class="hero-row">
          <span class="hero-num"><CountUp value={s.shown.length} /></span>
          <Icon name="git-commit" size={28} class="tw-mark" />
        </div>
        <div class="tw-gains">
          <span class={s.todayN ? 'up' : ''}><b>{num(s.todayN)}</b> {t('today')}</span>
          <span class={s.weekN ? 'up' : ''}><b>{num(s.weekN)}</b> {t('this week')}</span>
          {s.before !== null && <span class={s.shown.length > s.before ? 'up' : s.shown.length < s.before ? 'down' : ''}><b>{signed(s.shown.length - s.before)}</b> {BEFORE[range]}</span>}
        </div>
      </section>

      <div class="tiles pj-tiles">
        <Tile k={0} icon="calendar-event" label={t('Active days')} value={num(s.active)} sub={range === 'all' ? t('since {date}', { date: shortDate(s.from) }) : t('of {n}', { n: s.span })} />
        <Tile k={1} icon="flame" label={t('Streak')} value={count(s.streak.current, 'day', 'days')} small sub={t('longest {n}', { n: count(s.streak.longest, 'day', 'days') })} />
        <Tile k={2} icon="clock" label={t('Busiest day')} value={s.busiestN ? WEEKDAYS[s.busiest] : '—'} small sub={s.busiestN ? count(s.busiestN, 'commit', 'commits') : t('Nothing yet')} />
        <Tile k={3} icon="folder" label={t('Projects worked on')} value={num(s.touched.length)} sub={s.touched[0] ? t('most: {name}', { name: s.touched[0].r.name }) : t('Nothing yet')} />
      </div>

      <ActivityGrid days={s.days} />

      <CommitBars
        rows={s.bars}
        step={s.step}
        title={t('Commits over time')}
        sub={s.step === 'day' ? t('Each day') : s.step === 'week' ? t('Each week') : t('Each month')}
      />

      <RhythmCard heat={s.heat} sub={t('Weekday and time of day, {range}', { range: IN_RANGE[range] })} />

      {s.langs.length > 0 && (
        <section class="card tw-list">
          <h3 class="chart-title">{t('Languages')}</h3>
          <p class="chart-sub">{t('How much of your code is in each')}</p>
          <LanguageBars rows={s.langs} />
        </section>
      )}

      <RepoList data={data} notes={notes} />
      <Todos data={data} notes={notes} />

      <section class="card tw-list pj-commit-card" id="pj-commits">
        <div class="tw-list-head">
          <h3 class="chart-title">{t('Every commit')}</h3>
          <span class="muted small">{count(total, 'commit', 'commits')}</span>
        </div>
        <CommitList repo={null} profile={data.profile} total={total} />
      </section>
    </RevealStack>
  );
}

function Tile({ icon, label, value, sub, small, k }: { icon: UiName; label: string; value: string; sub: string; small?: boolean; k: number }) {
  return (
    <div class="tile" style={{ '--k': k }}>
      <div class="tile-top">
        <span class="tile-ico"><Icon name={icon} size={14} stroke={2} /></span>
        <span class="tile-label">{label}</span>
      </div>
      <div class={small ? 'tile-value small' : 'tile-value'}>{value}</div>
      <div class="tile-sub">{sub}</div>
    </div>
  );
}

/** Every repository, as a row: what it is, its last twelve weeks, how many commits and when it was last pushed to. */
function RepoList({ data, notes }: { data: Github; notes: Project[] }) {
  const [sort, setSort] = usePref<Sort>('gh-sort', 'recent', SORTS);
  const [all, setAll] = useState(false);
  const byId = useMemo(() => new Map(notes.map((p) => [p.id, p])), [notes]);
  const sorted = useMemo(() => {
    const list = [...data.repos];
    if (sort === 'commits') list.sort((a, b) => b.commits - a.commits || b.pushedAt - a.pushedAt);
    else if (sort === 'name') list.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    else list.sort((a, b) => b.pushedAt - a.pushedAt);
    return list;
  }, [data, sort]);
  const shown = all ? sorted : sorted.slice(0, SHOWN);
  return (
    <section class="card tw-list pj-list" id="pj-list">
      <div class="tw-list-head">
        <h3 class="chart-title">{t('Projects')}</h3>
        <div class="chips pj-sort" role="toolbar" aria-label={t('Sort')}>
          <button class="chip" aria-pressed={sort === 'recent'} onClick={() => setSort('recent')}>{t('Recent')}</button>
          <button class="chip" aria-pressed={sort === 'commits'} onClick={() => setSort('commits')}>{t('Commits')}</button>
          <button class="chip" aria-pressed={sort === 'name'} onClick={() => setSort('name')}>{t('A–Z')}</button>
        </div>
      </div>
      <ul key={sort}>
        {shown.map((r, i) => <RepoRow r={r} p={byId.get(projectId(r.name))} now={data.now} k={i} />)}
      </ul>
      {sorted.length > SHOWN && (
        <button class="pj-more" onClick={() => setAll(!all)} aria-expanded={all}>
          {all ? t('Show less') : t('Show all {n}', { n: sorted.length })}
          <Icon name="chevron-down" size={16} />
        </button>
      )}
    </section>
  );
}

function RepoRow({ r, p, now, k }: { r: Repo; p?: Project; now: number; k: number }) {
  const main = p?.emotions[0] ? coreOf(p.emotions[0])?.id : null;
  const todo = open(p).length;
  const weeks = weekly(r.times, 12, now);
  return (
    <li style={{ '--k': k }}>
      <button class="pj-row" onClick={() => navigate('project/' + encodeURIComponent(r.name))} style={main ? { '--c': `var(--emo-${main})` } : undefined}>
        <span class="pj-row-main">
          <span class="pj-row-name">
            {main && <Sprite core={main} size={13} />}
            <b>{r.name}</b>
            {r.fork && <span class="pj-tag">{t('fork')}</span>}
            {r.archived && <span class="pj-tag">{t('archived')}</span>}
            {r.private && <span class="pj-tag pj-private"><Icon name="lock" size={11} stroke={2.2} />{t('private')}</span>}
          </span>
          <small class="pj-row-desc">{r.description || r.last?.m || t('No description')}</small>
          <span class="pj-row-meta">
            {r.language && <span><Icon name="code" size={13} stroke={2} />{r.language}</span>}
            {r.stars > 0 && <span><Icon name="star" size={13} stroke={2} />{num(r.stars)}</span>}
            {todo > 0 && <span class="pj-meta-todo"><Icon name="list-check" size={13} stroke={2} />{num(todo)}</span>}
          </span>
        </span>
        <Spark values={weeks} label={t('{n} in the last 12 weeks', { n: count(weeks.reduce((a, b) => a + b, 0), 'commit', 'commits') })} />
        <span class="tw-ch-num pj-row-num">
          <b>{compact(r.commits)}</b>
          <small>{ago(r.pushedAt, now)}</small>
        </span>
      </button>
    </li>
  );
}

/** What's left to do, across every project, ticked off from here. */
function Todos({ data, notes }: { data: Github; notes: Project[] }) {
  const order = new Map(data.repos.map((r, i) => [projectId(r.name), i]));
  const groups = notes
    .filter((p) => open(p).length)
    .sort((a, b) => (order.get(a.id) ?? 999) - (order.get(b.id) ?? 999));
  const left = groups.reduce((s, p) => s + open(p).length, 0);
  const done = notes.reduce((s, p) => s + p.todos.filter((x) => x.done).length, 0);
  // the latest copy, so ticking two in a row keeps both
  const tick = (pid: string, id: string) => {
    const p = getProjects().find((x) => x.id === pid);
    if (p) saveProject({ ...p, todos: p.todos.map((x) => (x.id === id ? { ...x, done: Date.now() } : x)) }).catch(() => toast(t('Couldn’t save that. Try again.')));
  };
  let k = 0;
  return (
    <section class="card tw-list pj-todos" id="pj-todos">
      <div class="tw-list-head">
        <h3 class="chart-title">{t('To-dos')}</h3>
        {left + done > 0 && <span class="muted small">{t('{open} open · {done} done', { open: num(left), done: num(done) })}</span>}
      </div>
      {groups.length ? (
        groups.map((p) => (
          <div class="pj-todo-group">
            <a class="pj-todo-repo" href={'#/project/' + encodeURIComponent(p.repo)} onClick={(e) => { e.preventDefault(); navigate('project/' + encodeURIComponent(p.repo)); }}>
              {p.repo} <Icon name="chevron-right" size={14} />
            </a>
            <ul class="pj-todo-list">
              {open(p).map((x) => <TodoItem key={x.id} x={x} linger k={k++} onToggle={() => tick(p.id, x.id)} />)}
            </ul>
          </div>
        ))
      ) : (
        <p class="empty-note">{done ? t('All done. Open a project to add more.') : t('Open a project to write down what’s left to do.')}</p>
      )}
    </section>
  );
}
