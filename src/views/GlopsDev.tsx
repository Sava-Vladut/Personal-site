import type { ComponentChildren } from 'preact';
import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import { goBack, navigate } from '../lib/router';
import { keyOf, shortDate } from '../lib/dates';
import { IDLE_EVERY, LIVE_EVERY, section, useGlopsDev, type Build, type Commit, type Deploy, type DevState, type Happening, type LogFile, type LogItem, type Session } from '../lib/glopsDev';
import { useGlops } from '../lib/glops';
import { RevealStack } from '../components/charts';
import { Markdown } from '../components/Markdown';
import { PageHead } from '../components/PageHead';
import { Icon, type UiName } from '../components/icons';
import { Sky } from '../components/Sky';
import { LOCALE, count, t } from '../lib/i18n';
import '../styles/stats.css';
import '../styles/twitch.css';
import '../styles/glopsdev.css';

const GAME = '/glops/';
const RECENT_SESSION = 2 * 3_600_000; // a session that stopped within this long still shows under "Right now"

function ago(ms: number, now: number) {
  const s = (now - ms) / 1000;
  if (s < 90) return t('just now');
  if (s < 3600) return t('{n} min ago', { n: Math.round(s / 60) });
  if (s < 86400) return t('{n} h ago', { n: Math.round(s / 3600) });
  return shortDate(keyOf(new Date(ms)));
}

/** A time: the clock today, the day and the clock before that. */
function clock(ms: number, now: number, seconds = false) {
  const d = new Date(ms);
  const time = d.toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit', ...(seconds ? { second: '2-digit' } : {}) });
  return keyOf(d) === keyOf(new Date(now)) ? time : `${shortDate(keyOf(d))} ${time}`;
}

function span(min: number) {
  if (min < 60) return t('{n} min', { n: Math.max(1, min) });
  const h = Math.floor(min / 60), m = min % 60;
  return m ? t('{h} h {m} min', { h, m }) : t('{n} h', { n: h });
}

const TOOL_ICON: Record<string, UiName> = { Bash: 'terminal-2', Edit: 'pencil', Write: 'pencil', MultiEdit: 'pencil', NotebookEdit: 'pencil', Read: 'file-text', Grep: 'search', Glob: 'folder', Agent: 'users', Task: 'users', Skill: 'sparkles' };
const DEPLOY: Record<Deploy['kind'], [string, UiName]> = {
  page: [t('Page and game'), 'world'],
  multiplayer: [t('Servers and relay'), 'broadcast'],
  servers: [t('Servers'), 'broadcast'],
  relay: [t('Relay'), 'broadcast'],
  other: [t('Other'), 'upload'],
};
const STATE: Record<Session['state'], string> = { working: t('Working'), waiting: t('Waiting for you'), idle: t('Idle') };
// each session wears a colour of its own, the same everywhere on the page
const HUES = ['hope-interest', 'calm-safety', 'joy', 'love-connection', 'fear', 'anger', 'shame-aversion', 'sadness'];
const hueOf = (id: string) => `var(--emo-${HUES[[...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % HUES.length]})`;
const noTrailer = (s: string) => s.replace(/\n*Co-Authored-By:.*$/gim, '').trim();

type Tab = 'now' | 'agents' | 'code' | 'deploys' | 'log';
const TABS: [Tab, string, UiName][] = [
  ['now', t('Now'), 'clock'],
  ['agents', t('Agents'), 'users'],
  ['code', t('Code'), 'git-branch'],
  ['deploys', t('Deploys'), 'upload'],
  ['log', t('Log'), 'notebook'],
];

/** The page is the colour of hope and interest, like the game's stats; charts read the accent from the root. */
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
  useLayoutEffect(() => {
    setNow(Date.now() + skew);
    const id = setInterval(() => setNow(Date.now() + skew), 15_000);
    return () => clearInterval(id);
  }, [skew]);
  return now;
}

export function GlopsDev() {
  useAccent();
  const { data, error, loading, skew, refresh } = useGlopsDev();
  const now = useNow(skew);
  const [tab, setTab] = useState<Tab>('now');
  const working = data?.sessions.filter((s) => s.state === 'working').length ?? 0;

  return (
    <div class="page stats-page ops-page">
      <div class="journal-top stats-top" style={{ '--sky': 'var(--emo-hope-interest)' }}>
        <Sky world="hope-interest" letters="repos" />
        <PageHead
          title={t('Global Ops dev')}
          back={() => goBack()}
          actions={
            <a class="icon-btn" href={GAME} target="_blank" rel="noopener" aria-label={t('Play Global Ops')} title={t('Play Global Ops')}>
              <Icon name="player-play" />
            </a>
          }
          subtitle={!data ? t('The game’s development: agents, commits and deploys') : working ? (
            <><span class="tw-live" aria-hidden="true" /> {working === 1 ? t('An agent is working on it now') : t('{n} agents are working on it now', { n: working })}</>
          ) : data.lastWork ? (
            t('Last worked on {when}', { when: ago(data.lastWork, now) })
          ) : t('Nothing worked on yet')}
        />
        {data && (
          <div class="seg tabs ops-tabs" role="tablist" aria-label={t('Show')} style={{ '--at': TABS.findIndex(([k]) => k === tab), '--tabs': TABS.length }}>
            {TABS.map(([k, label, icon]) => (
              <button role="tab" aria-selected={tab === k} onClick={() => setTab(k)} key={k}>
                <Icon name={icon} size={16} /> <span>{label}</span>
                {k === 'agents' && working > 0 && <span class="ops-badge">{working}</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {!data ? (
        error ? (
          <div class="empty">
            <h2 class="title-s">{t('Nothing to show')}</h2>
            <p>{error}</p>
            <div class="ops-empty-btns">
              <button class="btn btn-quiet" onClick={refresh}><Icon name="refresh" size={18} /> {t('Try again')}</button>
              <button class="btn btn-quiet" onClick={() => navigate('settings')}><Icon name="settings" size={18} /> {t('Settings')}</button>
            </div>
          </div>
        ) : (
          <p class="empty-note center loading-note">{loading ? t('Loading…') : ''}</p>
        )
      ) : (
        <RevealStack key={tab}>
          {tab === 'now' && <NowTab data={data} now={now} onTab={setTab} />}
          {tab === 'agents' && <AgentsTab data={data} now={now} />}
          {tab === 'code' && <CodeTab data={data} now={now} />}
          {tab === 'deploys' && <DeploysTab data={data} now={now} />}
          {tab === 'log' && <LogTab data={data} now={now} />}
          <p class="ops-foot">
            {error ? <><Icon name="alert-circle" size={14} /> {error} · </> : null}
            {data.live
              ? t('Refreshes every {n} seconds while the game is being worked on.', { n: LIVE_EVERY / 1000 })
              : t('Refreshes every {n} seconds; faster once work starts.', { n: IDLE_EVERY / 1000 })}{' '}
            <button class="btn btn-quiet btn-s" onClick={refresh}><Icon name="refresh" size={16} /> {t('Refresh')}</button>
          </p>
        </RevealStack>
      )}
    </div>
  );
}

/* ---------------- Now: what's going on, at a glance ---------------- */

function NowTab({ data, now, onTab }: { data: DevState; now: number; onTab: (t: Tab) => void }) {
  const active = data.sessions.filter((s) => s.state === 'working' || now - s.last < RECENT_SESSION);
  const head = data.commits[0];
  const deploy = data.deploys[0];
  const next = section(data, /^next$/i)?.items ?? [];
  const status = section(data, /^status$/i)?.items ?? [];
  const latest = status.find((i) => i.date);
  const added = data.changes.reduce((s, c) => s + c.added, 0), removed = data.changes.reduce((s, c) => s + c.removed, 0);

  return (
    <>
      <section class="card ops-now">
        <div class="tw-list-head">
          <h3 class="chart-title">{active.some((s) => s.state === 'working') && <span class="tw-live" aria-hidden="true" />}{t('Right now')}</h3>
          {data.sessions.length > 0 && <button class="btn btn-quiet btn-s" onClick={() => onTab('agents')}>{t('All agents')}</button>}
        </div>
        {active.length ? (
          <ul class="ops-agents">
            {active.map((s) => <AgentRow s={s} now={now} key={s.id} />)}
          </ul>
        ) : (
          <p class="empty-note">{data.lastWork ? t('No agent is working on the game. The last change was {when}.', { when: ago(data.lastWork, now) }) : t('No agent has worked on the game yet.')}</p>
        )}
      </section>

      <div class="tiles ops-tiles">
        <Tile k={0} icon="git-commit" label={t('Latest commit')} value={head ? <code>{head.hash}</code> : '—'}
          sub={head ? `${ago(head.at, now)} · ${head.subject}` : t('none yet')} onClick={() => onTab('code')} />
        <Tile k={1} icon="upload" label={t('Last deploy')} value={deploy ? ago(deploy.at, now) : '—'}
          sub={deploy ? (deploy.title || deploy.topic || DEPLOY[deploy.kind][0]) : t('none yet')} onClick={() => onTab('deploys')} />
        <Tile k={2} icon="pencil" label={t('Not committed')} value={String(data.changes.length)}
          sub={data.changes.length ? <><b class="up">+{added}</b> <b class="down">−{removed}</b> · {count(data.changes.length, 'file', 'files')}</> : t('everything is committed')} onClick={() => onTab('code')} />
        <Tile k={3} icon="git-branch" label={t('Waiting to deploy')} value={String(data.undeployed)}
          sub={data.undeployed ? t('commits with code since the last deploy') : t('the live game is up to date')} onClick={() => onTab('deploys')} />
        <PushedTile data={data} />
        <GameTile />
      </div>

      {latest && (
        <section class="card tw-list ops-list">
          <h3 class="chart-title">{t('Latest from the log')}</h3>
          <p class="chart-sub">{dated(latest)}</p>
          <Markdown text={latest.text} class="ops-md" />
        </section>
      )}

      {data.changes.length > 0 && <Changes data={data} now={now} />}

      {next.length > 0 && (
        <section class="card tw-list ops-list">
          <h3 class="chart-title">{t('Next up')}</h3>
          <p class="chart-sub">{t('From the port log’s Next section')}</p>
          <ul class="ops-checks">
            {next.map((n, i) => (
              <li style={{ '--k': i }}>
                <Icon name="point" size={18} stroke={2} />
                <Markdown text={n.text} class="ops-md" />
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function Tile({ k, icon, label, value, sub, onClick }: { k: number; icon: UiName; label: string; value: ComponentChildren; sub: ComponentChildren; onClick?: () => void }) {
  const body = (
    <>
      <div class="tile-top"><span class="tile-ico"><Icon name={icon} size={14} stroke={2} /></span><span class="tile-label">{label}</span></div>
      <div class="tile-value small">{value}</div>
      <div class="tile-sub ops-clip">{sub}</div>
    </>
  );
  return onClick ? <button class="tile ops-tile" style={{ '--k': k }} onClick={onClick}>{body}</button> : <div class="tile" style={{ '--k': k }}>{body}</div>;
}

function PushedTile({ data }: { data: DevState }) {
  const r = data.repo;
  const value = !r ? '—' : !r.upstream ? t('Not pushed') : r.ahead ? t('{n} to push', { n: r.ahead }) : t('Pushed');
  const sub = !r ? t('git isn’t readable') : `${r.branch}${r.upstream ? ` → ${r.upstream}` : ''}${r.behind ? ` · ${t('{n} behind', { n: r.behind })}` : ''}`;
  return <Tile k={4} icon="git-branch" label={t('GitHub')} value={value} sub={sub} />;
}

/** The live game, from the relay's public stats (the same as the Global Ops page under Insights). */
function GameTile() {
  const { data } = useGlops();
  return (
    <Tile k={5} icon="device-gamepad-2" label={t('Live game')} value={data ? t('{n} of 4 servers', { n: data.servers.length }) : '—'}
      sub={data ? t('{n} online · {m} in a match', { n: data.online, m: data.playing }) : t('the relay isn’t answering')}
      onClick={() => navigate('glops')} />
  );
}

function dated(i: LogItem) {
  return [i.date && shortDate(i.date), i.time, i.when].filter(Boolean).join(' · ');
}

/* ---------------- Agents: every session lately, what it was asked, said and did ---------------- */

function AgentRow({ s, now, open }: { s: Session; now: number; open?: boolean }) {
  const prompt = s.prompts[0];
  return (
    <li class={`ops-agent is-${s.state}`} style={{ '--hue': hueOf(s.id) }}>
      <div class="ops-agent-top">
        <span class="ops-dot" aria-hidden="true" />
        <b>{t('Agent {id}', { id: s.id.slice(0, 4) })}</b>
        <span class={`ops-pill is-${s.state}`}>{STATE[s.state]}</span>
        <small>{ago(s.last, now)}</small>
      </div>
      {prompt && <p class="ops-ask"><Icon name="message" size={14} /> {prompt.text}</p>}
      {s.state === 'working' && s.action && (
        <p class="ops-doing"><Icon name={TOOL_ICON[s.action.tool] ?? 'dots'} size={14} stroke={2} /> {s.action.text || s.action.tool}</p>
      )}
      {s.state !== 'working' && s.reply && <p class={`ops-reply${open ? ' is-open' : ''}`}>{s.reply}</p>}
      <p class="ops-meta">
        {t('{n} tool calls', { n: s.tools })} · {t('{n} edits', { n: s.edits })} · {t('{n} commands', { n: s.commands })} · {span(s.minutes)}
      </p>
    </li>
  );
}

function AgentsTab({ data, now }: { data: DevState; now: number }) {
  const [only, setOnly] = useState<string | null>(null);
  return (
    <>
      <section class="card tw-list ops-list">
        <h3 class="chart-title">{t('Agents')}</h3>
        <p class="chart-sub">{t('Every session that worked on the game in the last 3 days. Tap one to see what it did.')}</p>
        {data.sessions.length ? (
          <ul class="ops-agents">
            {data.sessions.map((s) => <SessionCard s={s} now={now} events={data.activity.filter((e) => e.s === s.id)} key={s.id} />)}
          </ul>
        ) : (
          <p class="empty-note">{t('Each command and edit an agent makes to the game shows up here as it happens.')}</p>
        )}
      </section>
      <Activity events={data.activity} sessions={data.sessions} only={only} onOnly={setOnly} live={data.live} now={now} />
    </>
  );
}

function SessionCard({ s, now, events }: { s: Session; now: number; events: Happening[] }) {
  return (
    <li class={`ops-agent ops-session is-${s.state}`} style={{ '--hue': hueOf(s.id) }}>
      <details>
        <summary>
          <div class="ops-agent-top">
            <span class="ops-dot" aria-hidden="true" />
            <b>{t('Agent {id}', { id: s.id.slice(0, 4) })}</b>
            <span class={`ops-pill is-${s.state}`}>{STATE[s.state]}</span>
            <small>{ago(s.last, now)}</small>
          </div>
          {s.prompts[0] ? <p class="ops-ask"><Icon name="message" size={14} /> {s.prompts[0].text}</p>
            : s.action && <p class="ops-doing"><Icon name={TOOL_ICON[s.action.tool] ?? 'dots'} size={14} stroke={2} /> {s.action.text || s.action.tool}</p>}
          <p class="ops-meta">
            {clock(s.first, now)} – {clock(s.last, now)} · {span(s.minutes)} · {t('{n} tool calls', { n: s.tools })} · {t('{n} edits', { n: s.edits })}
          </p>
        </summary>
        <div class="ops-session-body">
          {s.reply && (
            <>
              <h4>{t('What it last said')} <small>{s.replyAt ? clock(s.replyAt, now) : ''}</small></h4>
              <p class="ops-reply is-open">{s.reply}</p>
            </>
          )}
          {s.prompts.length > 1 && (
            <>
              <h4>{t('What it was asked')}</h4>
              <ul class="ops-asks">{s.prompts.map((p) => <li key={p.t}><time>{clock(p.t, now)}</time> {p.text}</li>)}</ul>
            </>
          )}
          {s.files.length > 0 && (
            <>
              <h4>{t('Files it edited most')}</h4>
              <ul class="ops-asks">{s.files.map((f) => <li key={f.path}><code>{f.path}</code> <small>×{f.n}</small></li>)}</ul>
            </>
          )}
          <h4>{t('What it did')}</h4>
          {events.length ? <Feed events={events.slice(0, 60)} now={now} /> : <p class="empty-note">{t('Nothing lately.')}</p>}
        </div>
      </details>
    </li>
  );
}

/** What sessions did to the game, newest first. */
function Activity({ events, sessions, only, onOnly, live, now }: { events: Happening[]; sessions: Session[]; only: string | null; onOnly: (s: string | null) => void; live: boolean; now: number }) {
  const [all, setAll] = useState(false);
  const mine = only ? events.filter((e) => e.s === only) : events;
  const shown = all ? mine : mine.slice(0, 40);
  const ids = sessions.slice(0, 8).map((s) => s.id);
  return (
    <section class="card tw-list ops-list">
      <div class="tw-list-head">
        <h3 class="chart-title">{live && <span class="tw-live" aria-hidden="true" />}{t('Live activity')}</h3>
        {mine.length > 40 && <button class="btn btn-quiet btn-s" onClick={() => setAll(!all)}>{all ? t('Fewer') : t('All {n}', { n: mine.length })}</button>}
      </div>
      {ids.length > 1 && (
        <div class="ops-chips" role="group" aria-label={t('Show one agent')}>
          <button class={!only ? 'on' : ''} aria-pressed={!only} onClick={() => onOnly(null)}>{t('All')}</button>
          {ids.map((id) => (
            <button class={only === id ? 'on' : ''} aria-pressed={only === id} style={{ '--hue': hueOf(id) }} onClick={() => onOnly(only === id ? null : id)} key={id}>
              <span class="ops-dot" aria-hidden="true" /> {id.slice(0, 4)}
            </button>
          ))}
        </div>
      )}
      {shown.length ? <Feed events={shown} now={now} who /> : <p class="empty-note">{t('Nothing lately.')}</p>}
    </section>
  );
}

function Feed({ events, now, who }: { events: Happening[]; now: number; who?: boolean }) {
  return (
    <ol class="ops-feed" aria-live="polite">
      {events.map((e) => (
        <li key={`${e.t}-${e.s}-${e.ev}-${e.tool}`} class={`is-${e.ev}`} style={{ '--hue': hueOf(e.s) }}>
          <time>{clock(e.t, now, true)}</time>
          <span class="ops-tool">
            {who && <span class="ops-dot" aria-hidden="true" title={e.s} />}
            <Icon name={e.ev === 'stop' ? 'player-pause' : e.ev === 'prompt' ? 'message' : TOOL_ICON[e.tool] ?? 'dots'} size={14} stroke={2} />
            {' '}{e.ev === 'stop' ? t('Done') : e.ev === 'prompt' ? t('Asked') : e.tool}
          </span>
          <span class="ops-what" title={e.text}>{e.ev === 'stop' ? (e.text || t('the turn ended')) : e.text}</span>
        </li>
      ))}
    </ol>
  );
}

/* ---------------- Code: git ---------------- */

function CodeTab({ data, now }: { data: DevState; now: number }) {
  const r = data.repo;
  return (
    <>
      {r && (
        <section class="card tw-list ops-list">
          <div class="tw-list-head">
            <h3 class="chart-title">{t('Repository')}</h3>
            {r.github && <a class="btn btn-quiet btn-s" href={`https://github.com/${r.github}`} target="_blank" rel="noopener noreferrer"><Icon name="brand-github" size={16} /> GitHub</a>}
          </div>
          <p class="chart-sub">
            {t('On {branch}', { branch: r.branch })} · {!r.upstream ? t('not pushed anywhere') : r.ahead || r.behind
              ? [r.ahead && t('{n} to push', { n: r.ahead }), r.behind && t('{n} behind', { n: r.behind })].filter(Boolean).join(' · ')
              : t('in step with {upstream}', { upstream: r.upstream })}
          </p>
          <ul>
            {r.branches.map((b, i) => (
              <li class="ops-file" style={{ '--k': i }} key={b.name}>
                <span class={`ops-state${b.name === r.branch ? ' is-added' : ''}`}>{b.name}</span>
                <span class="ops-path">{b.subject}</span>
                <code class="ops-diff">{b.hash}</code>
                <small>{ago(b.at, now)}</small>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Changes data={data} now={now} />

      {data.commits.length > 0 && <Commits commits={data.commits} now={now} />}

      {data.touched.length > 0 && (
        <section class="card tw-list ops-list">
          <h3 class="chart-title">{t('Touched today')}</h3>
          <p class="chart-sub">{t('The port’s files changed in the last day, committed or not')}</p>
          <ul>
            {data.touched.map((f, i) => (
              <li class="ops-file ops-touched" style={{ '--k': i }} key={f.path}>
                <code class="ops-path">{f.path}</code>
                <small>{ago(f.at, now)}</small>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function Changes({ data, now }: { data: DevState; now: number }) {
  return (
    <section class="card tw-list ops-list">
      <h3 class="chart-title">{t('Not committed yet')}</h3>
      {data.changes.length ? (
        <>
          <p class="chart-sub">
            {count(data.changes.length, 'file', 'files')} · <b class="up">+{data.changes.reduce((s, c) => s + c.added, 0)}</b>{' '}
            <b class="down">−{data.changes.reduce((s, c) => s + c.removed, 0)}</b> · {t('an agent may still be on it')}
          </p>
          <ul>
            {data.changes.map((c, i) => (
              <li class="ops-file" style={{ '--k': i }} key={c.path}>
                <span class={`ops-state is-${c.state}`}>{c.state === 'new' ? t('new') : c.state === 'deleted' ? t('gone') : c.state === 'added' ? t('added') : t('changed')}</span>
                <code class="ops-path">{c.path}</code>
                <span class="ops-diff"><b class="up">+{c.added}</b> <b class="down">−{c.removed}</b></span>
                <small>{c.at ? ago(c.at, now) : ''}</small>
              </li>
            ))}
          </ul>
        </>
      ) : <p class="chart-sub">{t('Everything is committed.')}</p>}
    </section>
  );
}

function Commits({ commits, now }: { commits: Commit[]; now: number }) {
  return (
    <section class="card tw-list ops-list">
      <h3 class="chart-title">{t('Commits')}</h3>
      <p class="chart-sub">{t('The latest {n}; tap one for its message and files', { n: commits.length })}</p>
      <ul>
        {commits.map((c, i) => {
          const body = noTrailer(c.body);
          const waiting = !c.live && c.code;
          return (
            <li class="ops-commit" style={{ '--k': i }} key={c.hash}>
              <details>
                <summary>
                  <code>{c.hash}</code>
                  <span class="ops-subject">{c.subject}{waiting && <span class="ops-pill is-working">{t('not deployed')}</span>}</span>
                  <small>{ago(c.at, now)} · {count(c.files, 'file', 'files')} · <b class="up">+{c.added}</b> <b class="down">−{c.removed}</b></small>
                </summary>
                {body ? <p class="ops-body">{body}</p> : null}
                {c.paths.length > 0 && (
                  <ul class="ops-paths">
                    {c.paths.map((f) => <li key={f.path}><code>{f.path}</code> <span class="ops-diff"><b class="up">+{f.added}</b> <b class="down">−{f.removed}</b></span></li>)}
                    {c.files > c.paths.length && <li class="muted">{t('and {n} more', { n: c.files - c.paths.length })}</li>}
                  </ul>
                )}
              </details>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/* ---------------- Deploys: what went live, and the builds ---------------- */

function DeploysTab({ data, now }: { data: DevState; now: number }) {
  const live = data.builds.filter((b) => !b.dir);
  const built = data.builds.filter((b) => b.dir);
  const LIVE: Record<string, [string, UiName]> = { deployed: [t('Game build live'), 'device-gamepad-2'], page: [t('Page live'), 'world'] };
  return (
    <>
      <div class="tiles ops-tiles">
        {live.map((b, k) => (
          <Tile k={k} icon={LIVE[b.name]?.[1] ?? 'upload'} label={LIVE[b.name]?.[0] ?? b.name} value={b.at ? ago(b.at, now) : '—'} sub={b.at ? clock(b.at, now) : t('not deployed')} />
        ))}
        <Tile k={2} icon="git-commit" label={t('Waiting to deploy')} value={String(data.undeployed)} sub={data.undeployed ? t('commits with code since the last deploy') : t('the live game is up to date')} />
        <Tile k={3} icon="upload" label={t('Deploys')} value={String(data.deploys.length)} sub={data.deploys.at(-1) ? t('since {date}', { date: shortDate(keyOf(new Date(data.deploys.at(-1)!.at))) }) : ''} />
      </div>

      <section class="card tw-list ops-list">
        <h3 class="chart-title">{t('Deploys')}</h3>
        <p class="chart-sub">{t('Each one backs up what was live first; its note is from the port log')}</p>
        {data.deploys.length ? (
          <ol class="ops-timeline">
            {data.deploys.map((d, i) => (
              <li style={{ '--k': i }} key={d.name}>
                <span class="ops-date">{clock(d.at, now)} · {ago(d.at, now)}</span>
                <div class="ops-deploy-head">
                  <span class="ops-state"><Icon name={DEPLOY[d.kind][1]} size={12} stroke={2} /> {DEPLOY[d.kind][0]}</span>
                  <b>{d.title || d.topic || t('Untitled')}</b>
                </div>
                {d.note ? (
                  <details class="ops-more">
                    <summary>{t('What went live')}</summary>
                    <Markdown text={d.note} class="ops-md" />
                  </details>
                ) : null}
                <small class="ops-backup"><code>backups/{d.name}</code></small>
              </li>
            ))}
          </ol>
        ) : <p class="empty-note">{t('Nothing deployed yet.')}</p>}
      </section>

      {built.length > 0 && <Builds builds={built} now={now} />}
    </>
  );
}

function Builds({ builds, now }: { builds: Build[]; now: number }) {
  return (
    <section class="card tw-list ops-list">
      <h3 class="chart-title">{t('Builds')}</h3>
      <p class="chart-sub">{t('Every build folder’s newest build; agents keep their own')}</p>
      <ul>
        {builds.map((b, i) => (
          <li class="ops-file" style={{ '--k': i }} key={`${b.dir}-${b.name}`}>
            <span class="ops-state">{b.name === 'native' ? t('native') : t('browser')}</span>
            <code class="ops-path">recomp/{b.dir}</code>
            <span class="ops-diff">{b.at ? clock(b.at, now) : ''}</span>
            <small>{b.at ? ago(b.at, now) : ''}</small>
          </li>
        ))}
      </ul>
    </section>
  );
}

/* ---------------- Log: PORTING_LOG.md, logs and screenshots ---------------- */

function LogTab({ data, now }: { data: DevState; now: number }) {
  const milestones = section(data, /^milestones$/i)?.items?.filter((i) => i.done !== undefined) ?? [];
  const status = section(data, /^status$/i)?.items ?? [];
  const notes = data.log.sections.filter((s) => s.title && !/^(milestones|status|next)$/i.test(s.title));
  const done = milestones.filter((m) => m.done).length;
  const [all, setAll] = useState(false);

  return (
    <>
      {milestones.length > 0 && (
        <section class="card tw-list ops-list">
          <h3 class="chart-title">{t('Milestones')}</h3>
          <p class="chart-sub">{t('{n} of {m} done', { n: done, m: milestones.length })}</p>
          <div class="ops-meter" role="meter" aria-valuemin={0} aria-valuemax={milestones.length} aria-valuenow={done} aria-label={t('Milestones')}>
            {milestones.map((m, i) => <i class={m.done ? 'on' : ''} style={{ '--k': i }} title={m.text} />)}
          </div>
          <ul class="ops-checks">
            {milestones.map((m, i) => (
              <li class={m.done ? 'is-done' : ''} style={{ '--k': i }}>
                <Icon name={m.done ? 'circle-check' : 'circle-dashed'} size={18} stroke={2} />
                <Markdown text={m.text} class="ops-md" />
              </li>
            ))}
          </ul>
        </section>
      )}

      {status.length > 0 && (
        <section class="card tw-list ops-list">
          <div class="tw-list-head">
            <h3 class="chart-title">{t('Progress log')}</h3>
            {status.length > 8 && <button class="btn btn-quiet btn-s" onClick={() => setAll(!all)}>{all ? t('Fewer') : t('All {n}', { n: status.length })}</button>}
          </div>
          {data.log.at && <p class="chart-sub">{t('From PORTING_LOG.md, updated {when}', { when: ago(data.log.at, now) })}</p>}
          <ol class="ops-timeline">
            {(all ? status : status.slice(0, 8)).map((it, i) => (
              <li style={{ '--k': i }}>
                {it.date && <span class="ops-date">{dated(it)}</span>}
                <Markdown text={it.text} class="ops-md" />
              </li>
            ))}
          </ol>
        </section>
      )}

      {data.logs.length > 0 && (
        <section class="card tw-list ops-list">
          <h3 class="chart-title">{t('Logs')}</h3>
          <p class="chart-sub">{t('The last lines of the newest logs')}</p>
          {data.logs.map((l, i) => <LogTail key={l.path} log={l} open={i === 0} now={now} />)}
        </section>
      )}

      {data.shots.length > 0 && (
        <section class="card tw-list ops-list">
          <h3 class="chart-title">{t('Screenshots')}</h3>
          <p class="chart-sub">{t('The newest from the test runs')}</p>
          <div class="ops-shots">
            {data.shots.map((s) => (
              <a href={`/api/glops-dev/shots/${encodeURIComponent(s.name)}?v=${s.at}`} target="_blank" rel="noopener noreferrer" key={s.name + s.at}>
                <img src={`/api/glops-dev/shots/${encodeURIComponent(s.name)}?v=${s.at}`} alt={s.name} loading="lazy" decoding="async" />
                <small>{s.name} · {ago(s.at, now)}</small>
              </a>
            ))}
          </div>
        </section>
      )}

      {notes.length > 0 && (
        <section class="card tw-list ops-list">
          <h3 class="chart-title">{t('Porting notes')}</h3>
          <p class="chart-sub">{t('The rest of PORTING_LOG.md')}</p>
          {notes.map((s) => (
            <details class="ops-note" key={s.title}>
              <summary>{s.title}</summary>
              <Markdown text={s.body} class="ops-md" />
            </details>
          ))}
        </section>
      )}
    </>
  );
}

/** A log's last lines, scrolled to its end (and kept there as lines come in, unless you scrolled up). */
function LogTail({ log, open, now }: { log: LogFile; open: boolean; now: number }) {
  const pre = useRef<HTMLPreElement>(null);
  const pinned = useRef(true);
  useLayoutEffect(() => {
    const el = pre.current;
    if (el && pinned.current) el.scrollTop = el.scrollHeight;
  }, [log.lines.join('\n')]);
  return (
    <details class="ops-note ops-log" open={open} onToggle={() => pre.current && (pre.current.scrollTop = pre.current.scrollHeight)}>
      <summary><code>{log.path}</code> <small>{ago(log.at, now)}</small></summary>
      <pre ref={pre} onScroll={(e) => {
        const el = e.currentTarget;
        pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
      }}>{log.lines.join('\n')}</pre>
    </details>
  );
}
