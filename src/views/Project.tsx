import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { EMOTION, coreOf } from '../data/emotions';
import { DAY, diffDays, keyOf, shortDate, todayKey } from '../lib/dates';
import { buckets, languageShares, perDay, rhythm, streaks, useGithub, type Step } from '../lib/github';
import { goBack } from '../lib/router';
import { MAX_PERSON_EMOTIONS, MAX_TODOS, blankProject, getProjects, getSettings, projectId, saveProject, toast, uid, type Project, type Todo } from '../lib/store';
import { ActivityGrid, ago, CommitBars, CommitList, LanguageBars, RhythmCard, TodoItem, useAccent } from '../components/github';
import { CountUp, RevealStack } from '../components/charts';
import { EmotionChip, EmotionPicker } from '../components/emotion';
import { Icon } from '../components/icons';
import { MentionText } from '../components/MentionText';
import { Sheet } from '../components/Sheet';
import { Sky } from '../components/Sky';
import { CloudTitle } from './Media';
import { LOCALE, count, t } from '../lib/i18n';
import '../styles/stats.css';
import '../styles/twitch.css';
import '../styles/github.css';

const num = (n: number) => n.toLocaleString(LOCALE);

/** One repository: how it makes you feel, your notes and to-dos, and its commits. */
export function ProjectView({ name }: { name: string }) {
  const { data, error } = useGithub();
  const repo = data?.repos.find((r) => r.name.toLowerCase() === name.toLowerCase()) ?? null;
  const [draft, setDraft] = useState<Project>(() => getProjects().find((p) => p.id === projectId(name)) ?? blankProject(name));
  const [picking, setPicking] = useState(false);
  const [status, setStatus] = useState('');
  const dirty = useRef(false);
  const alive = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const latest = useRef(draft);
  latest.current = draft;

  const flush = async () => {
    clearTimeout(timer.current);
    if (!dirty.current) return true;
    dirty.current = false;
    try {
      await saveProject(latest.current);
      if (alive.current && !dirty.current) setStatus(t('Saved'));
      return true;
    } catch {
      dirty.current = true;
      if (alive.current) setStatus(t('Couldn’t save'));
      toast(t('Couldn’t save that. Try again.'));
      return false;
    }
  };

  const update = (patch: Partial<Project>) => {
    // GitHub spells the name; keep it its way
    latest.current = { ...latest.current, ...(repo && latest.current.repo !== repo.name ? { repo: repo.name } : {}), ...patch };
    setDraft(latest.current);
    dirty.current = true;
    setStatus('');
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, 500);
  };

  useEffect(() => {
    const hide = () => document.visibilityState === 'hidden' && flush();
    document.addEventListener('visibilitychange', hide);
    return () => {
      alive.current = false;
      document.removeEventListener('visibilitychange', hide);
      void flush();
    };
  }, []);

  const world = draft.emotions[0] ? coreOf(draft.emotions[0])?.id ?? 'calm-safety' : 'calm-safety';
  useAccent(world);

  const addEmotion = (eid: string) => {
    const list = draft.emotions.filter((x) => x !== eid && !eid.startsWith(x + '/') && !x.startsWith(eid + '/'));
    update({ emotions: [...list, eid].slice(-MAX_PERSON_EMOTIONS) });
    setPicking(false);
  };

  const s = useMemo(() => {
    if (!repo) return null;
    const days = perDay(repo.times);
    const today = todayKey();
    const firstDay = repo.times.length ? keyOf(new Date(repo.times[repo.times.length - 1] * 1000)) : today;
    // from the first commit: by day for a young project, by week, then by month for an old one
    const span = diffDays(firstDay, today) + 1;
    const step: Step = span <= 31 ? 'day' : span <= 200 ? 'week' : 'month';
    return {
      days,
      firstDay,
      active: days.size,
      streak: streaks(days),
      bars: buckets(days, firstDay, step, getSettings().weekStart),
      step,
      // the year's grid only when there's something in it
      lately: repo.times.some((x) => x * 1000 > Date.now() - 371 * DAY),
      heat: rhythm(repo.times),
      langs: languageShares([repo.languages]),
    };
  }, [repo]);

  const left = draft.todos.filter((x) => !x.done);
  const done = draft.todos.filter((x) => x.done).sort((a, b) => b.done! - a.done!);

  return (
    <div class="page stats-page pj-page pj-project">
      <div class="journal-top stats-top pj-top" style={{ '--sky': `var(--emo-${world})` }}>
        <Sky world={world} letters="code" />
        <header class="page-head">
          <div class="row between tw-head-row">
            <button class="back-link stats-back" onClick={() => flush().then(() => goBack('projects'))}><Icon name="chevron-left" size={18} /> {t('Back')}</button>
            <span class="pj-status" aria-live="polite">{status}</span>
            {repo && (
              <a class="btn btn-quiet btn-s tw-edit-btn" href={repo.url} target="_blank" rel="noopener noreferrer">
                <Icon name="brand-github" size={15} /> GitHub
              </a>
            )}
          </div>
          <CloudTitle text={repo?.name ?? draft.repo} />
          <p class="subtitle">{repo ? repo.description || t('No description') : data ? t('This project isn’t on GitHub any more, or it’s private.') : error ? t(error) : t('Loading…')}</p>
          {repo && (
            <div class="pj-facts">
              {repo.language && <span><Icon name="code" size={14} stroke={2} />{repo.language}</span>}
              <span><Icon name="star" size={14} stroke={2} />{num(repo.stars)}</span>
              <span><Icon name="git-fork" size={14} stroke={2} />{num(repo.forks)}</span>
              <span><Icon name="clock" size={14} stroke={2} />{t('pushed {when}', { when: ago(repo.pushedAt, data!.now) })}</span>
              {repo.fork && <span class="pj-tag">{t('fork')}</span>}
              {repo.archived && <span class="pj-tag">{t('archived')}</span>}
              {repo.homepage && (
                <a href={repo.homepage} target="_blank" rel="noopener noreferrer"><Icon name="external-link" size={14} stroke={2} />{repo.homepage.replace(/^https?:\/\//, '').replace(/\/$/, '')}</a>
              )}
            </div>
          )}
        </header>
        {repo && s && (
          <div class="media-stats pj-stats">
            {([[repo.commits, t('commits')], [s.active, t('active days')], [s.streak.longest, t('longest streak')], [left.length, t('to-dos open')]] as [number, string][]).map(([value, label], i) => (
              <span class="media-stat" style={{ '--i': i }}>
                <b><CountUp value={value} /></b>
                <small>{label}</small>
              </span>
            ))}
          </div>
        )}
      </div>

      <div class="stack-l pj-mine">
        <section class="card pj-mind">
          <div class="eyebrow">{t('How it makes you feel')}</div>
          <div class="meta person-meta">
            {draft.emotions.map((eid) => <EmotionChip id={eid} onRemove={() => update({ emotions: draft.emotions.filter((x) => x !== eid) })} />)}
            {draft.emotions.length < MAX_PERSON_EMOTIONS && (
              <button class="chip" onClick={() => setPicking(true)}>
                <Icon name="mood-plus" size={16} /> {draft.emotions.length ? t('Add') : t('Add a feeling')}
              </button>
            )}
          </div>
          {draft.emotions.length === 1 && EMOTION[draft.emotions[0]]?.depth === 2 && <p class="definition">{EMOTION[draft.emotions[0]].def}</p>}
          <div class="eyebrow pj-notes-label">{t('Notes')}</div>
          <MentionText
            class="body-input pj-notes"
            placeholder={t('What it’s for, ideas, what you learned, what’s next…')}
            value={draft.text}
            onChange={(text) => update({ text })}
            label={t('Notes')}
          />
        </section>

        <Todos left={left} done={done} count={draft.todos.length} onChange={(change) => update({ todos: change(latest.current.todos) })} />
      </div>

      {repo && s && (
        <RevealStack key={repo.name}>
          {s.lately && <ActivityGrid days={s.days} />}
          <CommitBars
            rows={s.bars}
            step={s.step}
            title={t('Commits over time')}
            sub={t('{each} since {date}', { each: s.step === 'day' ? t('Each day') : s.step === 'week' ? t('Each week') : t('Each month'), date: shortDate(s.firstDay) })}
          />
          <section class="card tw-list pj-commit-card" id="pj-commits">
            <div class="tw-list-head">
              <h3 class="chart-title">{t('Commits')}</h3>
              <span class="muted small">{count(repo.commits, 'commit', 'commits')}</span>
            </div>
            <CommitList repo={repo.name} profile={data!.profile} total={repo.commits} />
          </section>
          <RhythmCard heat={s.heat} sub={t('Weekday and time of day, every commit')} />
          {s.langs.length > 0 && (
            <section class="card tw-list">
              <h3 class="chart-title">{t('Languages')}</h3>
              <p class="chart-sub">{t('How much of its code is in each')}</p>
              <LanguageBars rows={s.langs} />
            </section>
          )}
        </RevealStack>
      )}

      <Sheet open={picking} onClose={() => setPicking(false)} title={t('How does it make you feel?')}>
        <EmotionPicker onPick={addEmotion} selected={draft.emotions} />
      </Sheet>
    </div>
  );
}

/** The project's to-dos: a bar of how many are done, a line to add one, what's open, and what's done folded away. */
function Todos({ left, done, count: n, onChange }: { left: Todo[]; done: Todo[]; count: number; onChange: (change: (todos: Todo[]) => Todo[]) => void }) {
  const [text, setText] = useState('');
  const [showDone, setShowDone] = useState(false);
  const total = left.length + done.length;
  const add = (e: Event) => {
    e.preventDefault();
    const words = text.trim();
    if (!words) return;
    if (n >= MAX_TODOS) return toast(t('That’s as many to-dos as a project can hold.'));
    onChange((all) => [...all, { id: uid(), text: words.slice(0, 500), done: null, created: Date.now() }]);
    setText('');
  };
  // changes apply to the latest list, so a to-do ticked a moment ago and words typed since both stay
  const set = (id: string, patch: Partial<Todo>) => onChange((all) => all.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const remove = (id: string) => onChange((all) => all.filter((x) => x.id !== id));
  return (
    <section class="card tw-list pj-todo-card" id="pj-todos">
      <div class="tw-list-head">
        <h3 class="chart-title">{t('To-dos')}</h3>
        {total > 0 && <span class="muted small">{t('{done} of {total} done', { done: num(done.length), total: num(total) })}</span>}
      </div>
      {total > 0 && (
        <div class="tile-meter pj-progress" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done.length} aria-label={t('To-dos done')}>
          <i style={{ width: `${(done.length / total) * 100}%` }} />
        </div>
      )}
      {left.length > 0 && (
        <ul class="pj-todo-list">
          {left.map((x, i) => <TodoItem key={x.id} x={x} k={i} linger onToggle={() => set(x.id, { done: Date.now() })} onText={(v) => set(x.id, { text: v })} onRemove={() => remove(x.id)} />)}
        </ul>
      )}
      <form class="pj-todo-add" onSubmit={add}>
        <span class="pj-check ghost" aria-hidden="true"><Icon name="plus" size={13} stroke={2.5} /></span>
        <input class="pj-todo-text" placeholder={t('Add a to-do')} value={text} maxLength={500} onInput={(e) => setText(e.currentTarget.value)} aria-label={t('Add a to-do')} enterKeyHint="done" />
        {text.trim() && <button class="btn btn-quiet btn-s" type="submit">{t('Add')}</button>}
      </form>
      {done.length > 0 && (
        <>
          <button class="pj-more" onClick={() => setShowDone(!showDone)} aria-expanded={showDone}>
            {t('Done · {n}', { n: num(done.length) })}
            <Icon name="chevron-down" size={16} />
          </button>
          {showDone && (
            <ul class="pj-todo-list pj-done-list">
              {done.map((x, i) => <TodoItem key={x.id} x={x} k={i} onToggle={() => set(x.id, { done: null })} onRemove={() => remove(x.id)} />)}
            </ul>
          )}
        </>
      )}
    </section>
  );
}
