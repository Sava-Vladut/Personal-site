import type { ComponentChildren } from 'preact';
import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import { goBack, navigate } from '../lib/router';
import { keyOf, shortDate } from '../lib/dates';
import { IDLE_EVERY, LIVE_EVERY, section, useGlopsDev, type Commit, type Deploy, type DevState, type Happening, type LogFile, type LogItem, type Session } from '../lib/glopsDev';
import { useGlops } from '../lib/glops';
import { Markdown } from '../components/Markdown';
import { PageHead } from '../components/PageHead';
import { Icon, type UiName } from '../components/icons';
import { LOCALE, count, t } from '../lib/i18n';
import '../styles/glopsdev.css';

const GAME = '/glops/';
const RECENT_SESSION = 2 * 3_600_000; // a session that stopped within this long still shows as an agent
const SHOWN = 30;

function ago(ms: number, now: number) {
  const s = (now - ms) / 1000;
  if (s < 90) return t('just now');
  if (s < 3600) return t('{n} min ago', { n: Math.round(s / 60) });
  if (s < 86400) return t('{n} h ago', { n: Math.round(s / 3600) });
  return shortDate(keyOf(new Date(ms)));
}

/** A time: the clock today, the day and the clock before that. */
function clock(ms: number, now: number) {
  const d = new Date(ms);
  const time = d.toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' });
  return keyOf(d) === keyOf(new Date(now)) ? time : `${shortDate(keyOf(d))} ${time}`;
}

const TOOL_ICON: Record<string, UiName> = { Bash: 'terminal-2', Edit: 'pencil', Write: 'pencil', MultiEdit: 'pencil', NotebookEdit: 'pencil', Read: 'file-text', Grep: 'search', Glob: 'folder', Agent: 'users', Task: 'users', Skill: 'sparkles' };
const DEPLOY: Record<Deploy['kind'], string> = {
  page: t('Page and game'),
  multiplayer: t('Servers and relay'),
  servers: t('Servers'),
  relay: t('Relay'),
  other: t('Other'),
};
const STATE: Record<Session['state'], string> = { working: t('Working'), waiting: t('Waiting for you'), idle: t('Idle') };
// each session wears a colour of its own, the same everywhere on the page
const HUES = ['hope-interest', 'calm-safety', 'joy', 'love-connection', 'fear', 'anger', 'shame-aversion', 'sadness'];
const hueOf = (id: string) => `var(--emo-${HUES[[...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % HUES.length]})`;
const noTrailer = (s: string) => s.replace(/\n*Co-Authored-By:.*$/gim, '').trim();
const dated = (i: LogItem) => [i.date && shortDate(i.date), i.time, i.when].filter(Boolean).join(' · ');

type Tab = 'activity' | 'code' | 'deploys' | 'notes';
const TABS: [Tab, string][] = [
  ['activity', t('Activity')],
  ['code', t('Code')],
  ['deploys', t('Deploys')],
  ['notes', t('Notes')],
];

/** The page is the colour of hope and interest, like the game's stats. */
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
  const [tab, setTab] = useState<Tab>('activity');
  const working = data?.sessions.filter((s) => s.state === 'working').length ?? 0;

  return (
    <div class="page gd-page">
      <PageHead
        title={t('Global Ops dev')}
        back={() => goBack()}
        actions={
          <a class="icon-btn" href={GAME} target="_blank" rel="noopener" aria-label={t('Play Global Ops')} title={t('Play Global Ops')}>
            <Icon name="player-play" />
          </a>
        }
        subtitle={!data ? null : working ? (
          <><span class="gd-live" aria-hidden="true" />{working === 1 ? t('An agent is working on it now') : t('{n} agents are working on it now', { n: working })}</>
        ) : data.lastWork ? t('Last worked on {when}', { when: ago(data.lastWork, now) }) : t('Nothing worked on yet')}
      />

      {!data ? (
        error ? (
          <div class="empty">
            <h2 class="title-s">{t('Nothing to show')}</h2>
            <p>{error}</p>
            <div class="gd-empty-btns">
              <button class="btn btn-quiet" onClick={refresh}><Icon name="refresh" size={18} /> {t('Try again')}</button>
              <button class="btn btn-quiet" onClick={() => navigate('settings')}><Icon name="settings" size={18} /> {t('Settings')}</button>
            </div>
          </div>
        ) : (
          <p class="empty-note center loading-note">{loading ? t('Loading…') : ''}</p>
        )
      ) : (
        <>
          <Facts data={data} />
          <div class="seg tabs gd-tabs" role="tablist" aria-label={t('Show')}>
            {TABS.map(([k, label]) => (
              <button role="tab" aria-selected={tab === k} onClick={() => setTab(k)} key={k}>{label}</button>
            ))}
          </div>
          <div class="gd-body fade-arrive-soft" key={tab}>
            {tab === 'activity' && <ActivityTab data={data} now={now} />}
            {tab === 'code' && <CodeTab data={data} now={now} />}
            {tab === 'deploys' && <DeploysTab data={data} now={now} />}
            {tab === 'notes' && <NotesTab data={data} now={now} />}
          </div>
          <p class="gd-foot">
            {error ? <><Icon name="alert-circle" size={14} /> {error} · </> : null}
            {t('Refreshes every {n} seconds', { n: (data.live ? LIVE_EVERY : IDLE_EVERY) / 1000 })}
            <button class="btn btn-quiet btn-s" onClick={refresh}><Icon name="refresh" size={16} /> {t('Refresh')}</button>
          </p>
        </>
      )}
    </div>
  );
}

/* ---------------- the four numbers that say where things stand ---------------- */

function Facts({ data }: { data: DevState }) {
  const { data: game } = useGlops();
  const r = data.repo;
  const facts: { value: number | null; label: string; onClick?: () => void }[] = [
    { value: data.changes.length, label: t('Uncommitted') },
    { value: r ? r.ahead : null, label: t('To push') },
    { value: data.undeployed, label: t('To deploy') },
    { value: game ? game.online : null, label: t('Online now'), onClick: () => navigate('glops') },
  ];
  return (
    <dl class="card gd-facts">
      {facts.map((f) => {
        const body = <><dd class={f.value ? 'on' : ''}>{f.value ?? '—'}</dd><dt>{f.label}</dt></>;
        return f.onClick ? <button class="gd-fact" onClick={f.onClick} key={f.label}>{body}</button> : <div class="gd-fact" key={f.label}>{body}</div>;
      })}
    </dl>
  );
}

/* ---------------- Activity: who is on it, then everything that happened ---------------- */

type Row =
  | { k: 'tool'; t: number; s: string; tool: string; text: string; n: number }
  | { k: 'prompt'; t: number; s: string; text: string }
  | { k: 'stop'; t: number; s: string; text: string }
  | { k: 'commit'; t: number; c: Commit }
  | { k: 'deploy'; t: number; d: Deploy };

/** What agents did, with commits and deploys among it, newest first; a run of the same tool by one agent is one row. */
function timeline(data: DevState, only: string | null): Row[] {
  const rows: Row[] = [];
  data.activity.forEach((e: Happening) => {
    if (only && e.s !== only) return;
    const prev = rows.at(-1);
    if (e.ev === 'tool') {
      if (prev?.k === 'tool' && prev.s === e.s && prev.tool === e.tool) prev.n++;
      else rows.push({ k: 'tool', t: e.t, s: e.s, tool: e.tool, text: e.text, n: 1 });
    } else if (e.ev === 'prompt') rows.push({ k: 'prompt', t: e.t, s: e.s, text: e.text });
    else rows.push({ k: 'stop', t: e.t, s: e.s, text: e.text });
  });
  if (!only) {
    data.commits.forEach((c) => rows.push({ k: 'commit', t: c.at, c }));
    data.deploys.forEach((d) => rows.push({ k: 'deploy', t: d.at, d }));
  }
  return rows.sort((a, b) => b.t - a.t);
}

function ActivityTab({ data, now }: { data: DevState; now: number }) {
  const [only, setOnly] = useState<string | null>(null);
  const [all, setAll] = useState(false);
  const agents = data.sessions.filter((s) => s.state === 'working' || now - s.last < RECENT_SESSION);
  const rows = timeline(data, only);
  const shown = all ? rows : rows.slice(0, SHOWN);
  const ids = data.sessions.slice(0, 8).map((s) => s.id);

  return (
    <>
      <Block title={<>{t('Agents')}</>}>
        {agents.length ? (
          <ul class="gd-agents">{agents.map((s) => <Agent s={s} now={now} key={s.id} />)}</ul>
        ) : <p class="gd-none">{t('No agent is working on the game.')}</p>}
      </Block>

      <Block title={<>{data.live && <span class="gd-live" aria-hidden="true" />}{t('Timeline')}</>}>
        {ids.length > 1 && (
          <div class="chips" role="group" aria-label={t('Show one agent')}>
            <button class="chip" aria-pressed={!only} onClick={() => setOnly(null)}>{t('All')}</button>
            {ids.map((id) => (
              <button class="chip" aria-pressed={only === id} style={{ '--hue': hueOf(id) }} onClick={() => setOnly(only === id ? null : id)} key={id}>
                <span class="gd-dot" aria-hidden="true" />{id.slice(0, 4)}
              </button>
            ))}
          </div>
        )}
        {shown.length ? (
          <ol class="gd-feed" aria-live="polite" style={{ '--gd-t': shown.some((r) => keyOf(new Date(r.t)) !== keyOf(new Date(now))) ? '96px' : '40px' }}>
            {shown.map((r) => <FeedRow r={r} now={now} key={`${r.t}-${r.k}-${'s' in r ? r.s : ''}-${r.k === 'tool' ? r.tool : ''}`} />)}
          </ol>
        ) : <p class="gd-none">{t('Nothing lately.')}</p>}
        {rows.length > SHOWN && <More all={all} total={rows.length} onClick={() => setAll(!all)} />}
      </Block>
    </>
  );
}

function Agent({ s, now }: { s: Session; now: number }) {
  const doing = s.state === 'working' && s.action ? s.action.text || s.action.tool : null;
  const line = doing ?? s.prompts[0]?.text ?? s.reply;
  return (
    <li class={`gd-agent is-${s.state}`} style={{ '--hue': hueOf(s.id) }}>
      <details>
        <summary>
          <span class="gd-dot" aria-hidden="true" />
          <b>{s.id.slice(0, 4)}</b>
          <span class="gd-state">{STATE[s.state]}</span>
          <small>{ago(s.last, now)}</small>
          {line && (
            <span class="gd-line">
              {doing && s.action && <Icon name={TOOL_ICON[s.action.tool] ?? 'dots'} size={14} stroke={2} />}
              {line}
            </span>
          )}
        </summary>
        <div class="gd-detail">
          {s.prompts[0] && doing && <Detail label={t('Asked')}>{s.prompts[0].text}</Detail>}
          {s.reply && <Detail label={t('Said')}>{s.reply}</Detail>}
          {s.prompts.length > 1 && <Detail label={t('Earlier asks')}>{s.prompts.slice(1).map((p) => p.text).join('\n\n')}</Detail>}
          {s.files.length > 0 && (
            <Detail label={t('Edited most')}>
              <ul>{s.files.map((f) => <li key={f.path}><code>{f.path}</code> <small>×{f.n}</small></li>)}</ul>
            </Detail>
          )}
          <p class="gd-meta">
            {clock(s.first, now)} – {clock(s.last, now)} · {t('{n} tool calls', { n: s.tools })} · {t('{n} edits', { n: s.edits })}
          </p>
        </div>
      </details>
    </li>
  );
}

/** A titled block of the page: the title, then its rows on one card. */
function Block({ title, children }: { title: ComponentChildren; children: ComponentChildren }) {
  return (
    <section class="section">
      <h2 class="section-title">{title}</h2>
      <div class="card gd-card">{children}</div>
    </section>
  );
}

function More({ all, total, onClick }: { all: boolean; total: number; onClick: () => void }) {
  return <button class="btn btn-quiet btn-s gd-more" onClick={onClick}>{all ? t('Fewer') : t('All {n}', { n: total })}</button>;
}

function Detail({ label, children }: { label: string; children: ComponentChildren }) {
  return <div class="gd-d"><h3>{label}</h3><div>{children}</div></div>;
}

function FeedRow({ r, now }: { r: Row; now: number }) {
  if (r.k === 'commit') {
    return (
      <li class="gd-row is-commit">
        <time>{clock(r.t, now)}</time>
        <Icon name="git-commit" size={16} stroke={2} />
        <span class="gd-what"><b>{r.c.subject}</b> <code>{r.c.hash}</code></span>
      </li>
    );
  }
  if (r.k === 'deploy') {
    return (
      <li class="gd-row is-deploy">
        <time>{clock(r.t, now)}</time>
        <Icon name="upload" size={16} stroke={2} />
        <span class="gd-what"><b>{t('Deployed')}</b> {r.d.title || r.d.topic || DEPLOY[r.d.kind]}</span>
      </li>
    );
  }
  const icon: UiName = r.k === 'stop' ? 'player-pause' : r.k === 'prompt' ? 'message' : TOOL_ICON[r.tool] ?? 'dots';
  return (
    <li class={`gd-row is-${r.k}`} style={{ '--hue': hueOf(r.s) }}>
      <time>{clock(r.t, now)}</time>
      <span class="gd-ico"><Icon name={icon} size={16} stroke={2} /></span>
      <span class="gd-what" title={r.k === 'stop' ? undefined : r.text}>
        {r.k === 'stop' ? t('Done') : r.k === 'prompt' ? r.text : <><b>{r.tool}</b> {r.text}</>}
        {r.k === 'tool' && r.n > 1 && <small> ×{r.n}</small>}
      </span>
    </li>
  );
}

/* ---------------- Code: what isn't committed, then the commits ---------------- */

function CodeTab({ data, now }: { data: DevState; now: number }) {
  const r = data.repo;
  const added = data.changes.reduce((s, c) => s + c.added, 0), removed = data.changes.reduce((s, c) => s + c.removed, 0);
  return (
    <>
      {r && (
        <p class="gd-repo gd-wide">
          <Icon name="git-branch" size={16} stroke={2} />
          <b>{r.branch}</b>
          <span>{!r.upstream ? t('not pushed anywhere') : r.ahead || r.behind
            ? [r.ahead && t('{n} to push', { n: r.ahead }), r.behind && t('{n} behind', { n: r.behind })].filter(Boolean).join(' · ')
            : t('Pushed')}</span>
          {r.github && <a class="btn btn-quiet btn-s" href={`https://github.com/${r.github}`} target="_blank" rel="noopener noreferrer"><Icon name="brand-github" size={16} /> GitHub</a>}
        </p>
      )}

      <Block title={<>{t('Uncommitted')}{data.changes.length > 0 && <small><i class="gd-add">+{added}</i> <i class="gd-del">−{removed}</i></small>}</>}>
        {data.changes.length ? (
          <ul class="gd-files">
            {data.changes.map((c) => (
              <li key={c.path}>
                <span class={`gd-tag is-${c.state}`}>{c.state === 'new' ? t('new') : c.state === 'deleted' ? t('gone') : c.state === 'added' ? t('added') : t('changed')}</span>
                <code>{c.path}</code>
                <span class="gd-num"><i class="gd-add">+{c.added}</i> <i class="gd-del">−{c.removed}</i></span>
              </li>
            ))}
          </ul>
        ) : <p class="gd-none">{t('Everything is committed.')}</p>}
      </Block>

      <Block title={<>{t('Commits')}</>}>
        {data.commits.length ? (
          <ul class="gd-commits">
            {data.commits.map((c) => {
              const body = noTrailer(c.body);
              return (
                <li key={c.hash}>
                  <details>
                    <summary>
                      <span class="gd-subject">{c.subject}{!c.live && c.code && <span class="gd-state is-working">{t('not deployed')}</span>}</span>
                      <small><code>{c.hash}</code> · {ago(c.at, now)} · {count(c.files, 'file', 'files')} · <i class="gd-add">+{c.added}</i> <i class="gd-del">−{c.removed}</i></small>
                    </summary>
                    <div class="gd-detail">
                      {body && <p class="gd-body-text">{body}</p>}
                      {c.paths.length > 0 && (
                        <ul class="gd-paths">
                          {c.paths.map((f) => <li key={f.path}><code>{f.path}</code><span class="gd-num"><i class="gd-add">+{f.added}</i> <i class="gd-del">−{f.removed}</i></span></li>)}
                          {c.files > c.paths.length && <li class="gd-none">{t('and {n} more', { n: c.files - c.paths.length })}</li>}
                        </ul>
                      )}
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
        ) : <p class="gd-none">{t('none yet')}</p>}
      </Block>
    </>
  );
}

/* ---------------- Deploys ---------------- */

function DeploysTab({ data, now }: { data: DevState; now: number }) {
  const LIVE: Record<string, string> = { deployed: t('Game build live'), page: t('Page live') };
  const live = data.builds.filter((b) => !b.dir && b.at);
  return (
    <>
      {live.length > 0 && (
        <ul class="gd-live-list gd-wide">
          {live.map((b) => <li key={b.name}><span>{LIVE[b.name] ?? b.name}</span><b>{ago(b.at!, now)}</b></li>)}
        </ul>
      )}
      <Block title={<>{t('Deploys')}</>}>
        {data.deploys.length ? (
          <ol class="gd-timeline">
            {data.deploys.map((d) => (
              <li key={d.name}>
                <time>{clock(d.at, now)}</time>
                <div class="gd-deploy">
                  <b>{d.title || d.topic || t('Untitled')}</b>
                  <span class="gd-tag">{DEPLOY[d.kind]}</span>
                </div>
                {d.note && (
                  <details class="gd-more-note">
                    <summary>{t('What went live')}</summary>
                    <Markdown text={d.note} class="gd-md" />
                  </details>
                )}
              </li>
            ))}
          </ol>
        ) : <p class="gd-none">{t('Nothing deployed yet.')}</p>}
      </Block>
    </>
  );
}

/* ---------------- Notes: PORTING_LOG.md, logs and screenshots ---------------- */

function NotesTab({ data, now }: { data: DevState; now: number }) {
  const milestones = section(data, /^milestones$/i)?.items?.filter((i) => i.done !== undefined) ?? [];
  const status = section(data, /^status$/i)?.items ?? [];
  const next = section(data, /^next$/i)?.items ?? [];
  const notes = data.log.sections.filter((s) => s.title && !/^(milestones|status|next)$/i.test(s.title));
  const done = milestones.filter((m) => m.done).length;
  const [all, setAll] = useState(false);
  const empty = !milestones.length && !status.length && !next.length && !data.logs.length && !data.shots.length && !notes.length;

  return (
    <>
      {empty && <p class="gd-none">{t('Nothing here yet.')}</p>}

      {milestones.length > 0 && (
        <Block title={<>{t('Milestones')}<small>{t('{n} of {m} done', { n: done, m: milestones.length })}</small></>}>
          <div class="meter gd-meter" role="meter" aria-valuemin={0} aria-valuemax={milestones.length} aria-valuenow={done} aria-label={t('Milestones')}>
            <i style={{ width: `${(done / milestones.length) * 100}%` }} />
          </div>
          <ul class="gd-checks">
            {milestones.map((m) => (
              <li class={m.done ? 'is-done' : ''}>
                <Icon name={m.done ? 'circle-check' : 'circle-dashed'} size={18} stroke={2} />
                <Markdown text={m.text} class="gd-md" />
              </li>
            ))}
          </ul>
        </Block>
      )}

      {next.length > 0 && (
        <Block title={<>{t('Next up')}</>}>
          <ul class="gd-checks">
            {next.map((n) => (
              <li><Icon name="point" size={18} stroke={2} /><Markdown text={n.text} class="gd-md" /></li>
            ))}
          </ul>
        </Block>
      )}

      {status.length > 0 && (
        <Block title={<>{t('Progress log')}{data.log.at && <small>{ago(data.log.at, now)}</small>}</>}>
          <ol class="gd-timeline">
            {(all ? status : status.slice(0, 6)).map((it) => (
              <li>
                {it.date && <time>{dated(it)}</time>}
                <Markdown text={it.text} class="gd-md" />
              </li>
            ))}
          </ol>
          {status.length > 6 && <More all={all} total={status.length} onClick={() => setAll(!all)} />}
        </Block>
      )}

      {data.logs.length > 0 && (
        <Block title={<>{t('Logs')}</>}>
          {data.logs.map((l, i) => <LogTail key={l.path} log={l} open={i === 0} now={now} />)}
        </Block>
      )}

      {data.shots.length > 0 && (
        <Block title={<>{t('Screenshots')}</>}>
          <div class="gd-shots">
            {data.shots.map((s) => (
              <a href={`/api/glops-dev/shots/${encodeURIComponent(s.name)}?v=${s.at}`} target="_blank" rel="noopener noreferrer" key={s.name + s.at}>
                <img src={`/api/glops-dev/shots/${encodeURIComponent(s.name)}?v=${s.at}`} alt={s.name} loading="lazy" decoding="async" />
                <small>{s.name} · {ago(s.at, now)}</small>
              </a>
            ))}
          </div>
        </Block>
      )}

      {notes.length > 0 && (
        <Block title={<>{t('Porting notes')}</>}>
          {notes.map((s) => (
            <details class="gd-fold" key={s.title}>
              <summary>{s.title}</summary>
              <Markdown text={s.body} class="gd-md" />
            </details>
          ))}
        </Block>
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
    <details class="gd-fold gd-log" open={open} onToggle={() => pre.current && (pre.current.scrollTop = pre.current.scrollHeight)}>
      <summary><code>{log.path}</code> <small>{ago(log.at, now)}</small></summary>
      <pre ref={pre} onScroll={(e) => {
        const el = e.currentTarget;
        pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 24;
      }}>{log.lines.join('\n')}</pre>
    </details>
  );
}
