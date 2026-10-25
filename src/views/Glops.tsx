import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { goBack } from '../lib/router';
import { keyOf, shortDate } from '../lib/dates';
import { IDLE_EVERY, LIVE_EVERY, section, useGlops, type Build, type Commit, type Happening, type LogFile, type LogItem, type Progress } from '../lib/glops';
import { RevealStack } from '../components/charts';
import { Markdown } from '../components/Markdown';
import { PageHead } from '../components/PageHead';
import { Icon, type UiName } from '../components/icons';
import { Sky } from '../components/Sky';
import { LOCALE, count, t } from '../lib/i18n';
import '../styles/stats.css';
import '../styles/twitch.css';
import '../styles/glops.css';

const PLAY_URL = 'https://savavlad.com/glops/';

function ago(ms: number, now: number) {
  const s = (now - ms) / 1000;
  if (s < 90) return t('just now');
  if (s < 3600) return t('{n} min ago', { n: Math.round(s / 60) });
  if (s < 86400) return t('{n} h ago', { n: Math.round(s / 3600) });
  return shortDate(keyOf(new Date(ms)));
}

/** A log line's time: the clock today, the day and the clock before that. */
function clock(ms: number, now: number) {
  const d = new Date(ms);
  const time = d.toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  return keyOf(d) === keyOf(new Date(now)) ? time : `${shortDate(keyOf(d))} ${time}`;
}

const TOOL_ICON: Record<string, UiName> = { Bash: 'terminal-2', Edit: 'pencil', Write: 'pencil', MultiEdit: 'pencil', NotebookEdit: 'pencil', Read: 'file-text', Grep: 'search', Glob: 'folder', Agent: 'users', Task: 'users' };
const BUILD: Record<Build['name'], [string, UiName]> = {
  native: [t('Native build'), 'terminal-2'],
  browser: [t('Browser build'), 'world'],
  deployed: [t('Deployed'), 'upload'],
};

/** The page is the colour of hope and interest; charts and tooltips read the accent from the root. */
function useAccent() {
  useLayoutEffect(() => {
    const root = document.documentElement.style;
    root.setProperty('--accent', 'var(--emo-hope-interest)');
    return () => root.removeProperty('--accent');
  }, []);
}

/** Now, by the server's clock, ticking so "2 min ago" stays true between fetches. */
function useNow(skew: number) {
  const [now, setNow] = useState(() => Date.now() + skew);
  useEffect(() => {
    setNow(Date.now() + skew);
    const id = setInterval(() => setNow(Date.now() + skew), 15_000);
    return () => clearInterval(id);
  }, [skew]);
  return now;
}

export function Glops() {
  useAccent();
  const { data, error, loading, skew, refresh } = useGlops();
  const now = useNow(skew);

  return (
    <div class="page stats-page gl-page">
      <div class="journal-top stats-top" style={{ '--sky': 'var(--emo-hope-interest)' }}>
        <Sky world="hope-interest" letters="repos" />
        <PageHead
          title={t('Global Ops port')}
          back={() => goBack()}
          actions={
            <a class="icon-btn" href={PLAY_URL} target="_blank" rel="noopener noreferrer" aria-label={t('Play it')} title={t('Play it')}>
              <Icon name="player-play" />
            </a>
          }
          subtitle={!data ? t('Global Operations (2002), running in the browser') : data.live ? (
            <><span class="tw-live" aria-hidden="true" /> {t('Being worked on now · last change {when}', { when: ago(data.lastWork!, now) })}</>
          ) : data.lastWork ? (
            t('Last worked on {when}', { when: ago(data.lastWork, now) })
          ) : t('Nothing worked on yet')}
        />
      </div>

      {!data ? (
        error ? (
          <div class="empty">
            <h2 class="title-s">{t('No progress to show')}</h2>
            <p>{error}</p>
            <button class="btn btn-quiet" onClick={refresh}><Icon name="refresh" size={18} /> {t('Try again')}</button>
          </div>
        ) : (
          <p class="empty-note center loading-note">{loading ? t('Loading…') : ''}</p>
        )
      ) : (
        <Board data={data} now={now} error={error} onRefresh={refresh} />
      )}
    </div>
  );
}

function Board({ data, now, error, onRefresh }: { data: Progress; now: number; error: string | null; onRefresh: () => void }) {
  const milestones = section(data, /^milestones$/i)?.items?.filter((i) => i.done !== undefined) ?? [];
  const status = section(data, /^status$/i)?.items ?? [];
  const next = section(data, /^next$/i)?.items ?? [];
  const latest = status.find((i) => i.date) ?? status[0];
  const done = milestones.filter((m) => m.done).length;
  const notes = data.log.sections.filter((s) => s.title && !/^(milestones|status|next)$/i.test(s.title));
  const intro = data.log.sections.find((s) => !s.title)?.body;

  return (
    <RevealStack>
      <section class="card hero gl-hero">
        <div class="tile-label">{milestones.length ? t('Milestones') : t('Latest')}</div>
        {milestones.length > 0 && (
          <>
            <div class="hero-row">
              <span class="hero-num">{done}<small>/{milestones.length}</small></span>
              <span class="hero-scale">{t('{pct}% of the way', { pct: Math.round((done / milestones.length) * 100) })}</span>
            </div>
            <div class="gl-meter" role="meter" aria-valuemin={0} aria-valuemax={milestones.length} aria-valuenow={done} aria-label={t('Milestones reached')}>
              {milestones.map((m, i) => <i class={m.done ? 'on' : ''} style={{ '--k': i }} title={m.text} />)}
            </div>
          </>
        )}
        {latest && (
          <div class="gl-latest">
            {latest.date && <span class="gl-date">{shortDate(latest.date)}{latest.when ? ` · ${latest.when}` : ''}</span>}
            <Markdown text={latest.text} class="gl-md" />
          </div>
        )}
        {intro && <Markdown text={intro} class="gl-md gl-goal" />}
      </section>

      <div class="tiles gl-tiles">
        {data.builds.map((b, k) => {
          const [label, icon] = BUILD[b.name];
          return (
            <div class="tile" style={{ '--k': k }}>
              <div class="tile-top"><span class="tile-ico"><Icon name={icon} size={14} stroke={2} /></span><span class="tile-label">{label}</span></div>
              <div class="tile-value small">{b.at ? ago(b.at, now) : '—'}</div>
              <div class="tile-sub">{b.at ? clock(b.at, now) : t('not built yet')}</div>
            </div>
          );
        })}
        <div class="tile" style={{ '--k': 3 }}>
          <div class="tile-top"><span class="tile-ico"><Icon name="git-commit" size={14} stroke={2} /></span><span class="tile-label">{t('Commits')}</span></div>
          <div class="tile-value small">{data.commits.length}</div>
          <div class="tile-sub">{data.commits[0] ? t('last {when}', { when: ago(data.commits[0].at, now) }) : t('none yet')}</div>
        </div>
      </div>

      <Activity events={data.activity} live={data.live} now={now} />

      {data.changes.length > 0 && (
        <section class="card tw-list gl-list">
          <h3 class="chart-title">{t('Not committed yet')}</h3>
          <p class="chart-sub">
            {count(data.changes.length, 'file', 'files')} · <b class="up">+{data.changes.reduce((s, c) => s + c.added, 0)}</b>{' '}
            <b class="down">−{data.changes.reduce((s, c) => s + c.removed, 0)}</b>
          </p>
          <ul>
            {data.changes.map((c, i) => (
              <li class="gl-file" style={{ '--k': i }} key={c.path}>
                <span class={`gl-state is-${c.state}`}>{c.state === 'new' ? t('new') : c.state === 'deleted' ? t('gone') : c.state === 'added' ? t('added') : t('changed')}</span>
                <code class="gl-path">{c.path}</code>
                <span class="gl-diff"><b class="up">+{c.added}</b> <b class="down">−{c.removed}</b></span>
                <small>{c.at ? ago(c.at, now) : ''}</small>
              </li>
            ))}
          </ul>
        </section>
      )}

      {milestones.length > 0 && (
        <section class="card tw-list gl-list">
          <h3 class="chart-title">{t('Milestones')}</h3>
          <ul class="gl-checks">
            {milestones.map((m, i) => (
              <li class={m.done ? 'is-done' : ''} style={{ '--k': i }}>
                <Icon name={m.done ? 'circle-check' : 'circle-dashed'} size={18} stroke={2} />
                <Markdown text={m.text} class="gl-md" />
              </li>
            ))}
          </ul>
        </section>
      )}

      {next.length > 0 && (
        <section class="card tw-list gl-list">
          <h3 class="chart-title">{t('Next up')}</h3>
          <ul class="gl-checks">
            {next.map((n, i) => (
              <li style={{ '--k': i }}>
                <Icon name="point" size={18} stroke={2} />
                <Markdown text={n.text} class="gl-md" />
              </li>
            ))}
          </ul>
        </section>
      )}

      {status.length > 0 && <Timeline items={status} at={data.log.at} now={now} />}

      {data.commits.length > 0 && <Commits commits={data.commits} now={now} />}

      {data.logs.length > 0 && <Logs logs={data.logs} now={now} />}

      {data.shots.length > 0 && (
        <section class="card tw-list gl-list">
          <h3 class="chart-title">{t('Screenshots')}</h3>
          <p class="chart-sub">{t('The newest from the browser test runs')}</p>
          <div class="gl-shots">
            {data.shots.map((s) => (
              <a href={`/api/glops/shots/${encodeURIComponent(s.name)}?v=${s.at}`} target="_blank" rel="noopener noreferrer" key={s.name + s.at}>
                <img src={`/api/glops/shots/${encodeURIComponent(s.name)}?v=${s.at}`} alt={s.name} loading="lazy" decoding="async" />
                <small>{s.name} · {ago(s.at, now)}</small>
              </a>
            ))}
          </div>
        </section>
      )}

      {notes.length > 0 && (
        <section class="card tw-list gl-list">
          <h3 class="chart-title">{t('Porting notes')}</h3>
          <p class="chart-sub">{t('From PORTING_LOG.md, updated {when}', { when: data.log.at ? ago(data.log.at, now) : '—' })}</p>
          {notes.map((s) => (
            <details class="gl-note" key={s.title}>
              <summary>{s.title}</summary>
              <Markdown text={s.body} class="gl-md" />
            </details>
          ))}
        </section>
      )}

      <p class="gl-foot">
        {error ? <><Icon name="alert-circle" size={15} /> {error} · </> : null}
        {data.live
          ? t('Refreshes every {n} seconds while the port is being worked on.', { n: LIVE_EVERY / 1000 })
          : t('Refreshes every {n} seconds; faster once work starts.', { n: IDLE_EVERY / 1000 })}{' '}
        <button class="btn btn-quiet btn-s" onClick={onRefresh}><Icon name="refresh" size={15} /> {t('Refresh')}</button>
      </p>
    </RevealStack>
  );
}

/** What sessions did to the port, newest first; the ones that came in since the last look slide in. */
function Activity({ events, live, now }: { events: Happening[]; live: boolean; now: number }) {
  const [all, setAll] = useState(false);
  const shown = all ? events : events.slice(0, 25);
  return (
    <section class="card tw-list gl-list">
      <div class="tw-list-head">
        <h3 class="chart-title">{live && <span class="tw-live" aria-hidden="true" />}{t('Live activity')}</h3>
        {events.length > 25 && <button class="btn btn-quiet btn-s" onClick={() => setAll(!all)}>{all ? t('Fewer') : t('All {n}', { n: events.length })}</button>}
      </div>
      {events.length ? (
        <ol class="gl-feed" aria-live="polite">
          {shown.map((e) => (
            <li key={`${e.t}-${e.s}-${e.tool}`} class={e.ev === 'stop' ? 'is-stop' : ''}>
              <time>{clock(e.t, now)}</time>
              <span class="gl-tool"><Icon name={e.ev === 'stop' ? 'player-pause' : TOOL_ICON[e.tool] ?? 'dots'} size={14} stroke={2} /> {e.ev === 'stop' ? t('Paused') : e.tool}</span>
              <span class="gl-what">{e.ev === 'stop' ? t('the session stopped for now') : e.text}</span>
            </li>
          ))}
        </ol>
      ) : (
        <p class="empty-note">{t('Each command and edit made to the port shows up here as it happens, once the activity hook is on.')}</p>
      )}
    </section>
  );
}

function Timeline({ items, at, now }: { items: LogItem[]; at: number | null; now: number }) {
  return (
    <section class="card tw-list gl-list">
      <h3 class="chart-title">{t('Progress log')}</h3>
      {at && <p class="chart-sub">{t('Updated {when}', { when: ago(at, now) })}</p>}
      <ol class="gl-timeline">
        {items.map((it, i) => (
          <li style={{ '--k': i }}>
            {it.date && <span class="gl-date">{shortDate(it.date)}{it.when ? ` · ${it.when}` : ''}</span>}
            <Markdown text={it.text} class="gl-md" />
          </li>
        ))}
      </ol>
    </section>
  );
}

function Commits({ commits, now }: { commits: Commit[]; now: number }) {
  return (
    <section class="card tw-list gl-list">
      <h3 class="chart-title">{t('Commits')}</h3>
      <ul>
        {commits.map((c, i) => {
          const body = c.body.replace(/\n*Co-Authored-By:.*$/gim, '').trim();
          return (
            <li class="gl-commit" style={{ '--k': i }} key={c.hash}>
              <details>
                <summary>
                  <code>{c.hash}</code>
                  <span class="gl-subject">{c.subject}</span>
                  <small>{ago(c.at, now)} · {count(c.files, 'file', 'files')} · <b class="up">+{c.added}</b> <b class="down">−{c.removed}</b></small>
                </summary>
                {body ? <p class="gl-body">{body}</p> : <p class="gl-body muted">{t('No description.')}</p>}
              </details>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** The newest logs, the most recent open, each scrolled to its end (and kept there as lines come in, unless you scrolled up). */
function Logs({ logs, now }: { logs: LogFile[]; now: number }) {
  return (
    <section class="card tw-list gl-list">
      <h3 class="chart-title">{t('Logs')}</h3>
      <p class="chart-sub">{t('The last lines of the newest logs')}</p>
      {logs.map((l, i) => <LogTail key={l.path} log={l} open={i === 0} now={now} />)}
    </section>
  );
}

function LogTail({ log, open, now }: { log: LogFile; open: boolean; now: number }) {
  const pre = useRef<HTMLPreElement>(null);
  const pinned = useRef(true);
  useLayoutEffect(() => {
    const el = pre.current;
    if (el && pinned.current) el.scrollTop = el.scrollHeight;
  }, [log.lines.join('\n')]);
  return (
    <details class="gl-note gl-log" open={open} onToggle={() => pre.current && (pre.current.scrollTop = pre.current.scrollHeight)}>
      <summary><code>{log.path}</code> <small>{ago(log.at, now)}</small></summary>
      <pre ref={pre} onScroll={(e) => {
        const el = e.currentTarget;
        pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
      }}>{log.lines.join('\n')}</pre>
    </details>
  );
}
