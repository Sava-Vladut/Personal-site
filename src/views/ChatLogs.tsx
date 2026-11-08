import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { goBack, navigate } from '../lib/router';
import { WEEKDAYS, addDays, formatDate, keyOf, monthLabel, parseKey, shortDate, startOfWeek, timeLabel, todayKey } from '../lib/dates';
import { cleanLogin, loadEmotes, loadMonth, lookup, recentPairs, rememberPair, search, sourceName, unwatch, useLoad, useYearDays, watch, watchList, type Line, type Lookup, type Pair, type WatchList } from '../lib/chatlogs';
import type { Emotes } from '../lib/emotes';
import { signIn, signOut } from '../lib/auth';
import { ChartCard, HeatLegend, RevealStack, TipRow, tipProps } from '../components/charts';
import { ChatText } from '../components/ChatText';
import { PageHead } from '../components/PageHead';
import { Icon } from '../components/icons';
import { Sheet } from '../components/Sheet';
import { Sky } from '../components/Sky';
import { LOCALE, noun, t } from '../lib/i18n';
import '../styles/stats.css';
import '../styles/twitch.css';
import '../styles/streamer.css';
import '../styles/chatlogs.css';

const num = (n: number) => n.toLocaleString(LOCALE);
const monthName = (ym: string) => monthLabel(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1);
const longDay = (k: string) => formatDate(parseKey(k), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const DAYS_SHOWN = 7;

function useAccent() {
  useLayoutEffect(() => {
    const root = document.documentElement.style;
    root.setProperty('--accent', 'var(--emo-fear)');
    return () => root.removeProperty('--accent');
  }, []);
}

/**
 * Chat logs: type a channel and a user, and see everything they wrote there, month by month, with a year of it in
 * days like GitHub's activity. The server asks every public log archive, the last day of chat, and the channels it
 * records itself.
 */
export function ChatLogs({ query }: { query: URLSearchParams }) {
  useAccent();
  const channel = cleanLogin(query.get('channel') ?? '');
  const user = cleanLogin(query.get('user') ?? '');
  const [typedChannel, setTypedChannel] = useState(channel);
  const [typedUser, setTypedUser] = useState(user);
  const [recent, setRecent] = useState<Pair[]>(recentPairs);
  const [again, setAgain] = useState(0);
  const [sheet, setSheet] = useState<string | null>(null); // the channels-recorded sheet, with a channel to add typed in
  const key = channel && user ? `${channel}|${user}|${again}` : null;
  const look = useLoad(key, () => lookup(channel, user, again > 0));

  useEffect(() => { setTypedChannel(channel); setTypedUser(user); }, [channel, user]);
  useEffect(() => { if (look.data) setRecent(rememberPair({ channel, user })); }, [look.data]);

  const go = (c: string, u: string) => navigate(`chatlogs?channel=${c}&user=${u}`, true);
  const find = (e: Event) => {
    e.preventDefault();
    const c = cleanLogin(typedChannel), u = cleanLogin(typedUser);
    if (c && u) go(c, u);
  };
  const data = look.data && look.data.channel.login === channel && look.data.user.login === user ? look.data : null;

  return (
    <div class="page stats-page tw-page sr-page cl-page">
      <div class="journal-top stats-top" style={{ '--sky': 'var(--emo-fear)' }}>
        <Sky world="fear" letters="chat" />
        <PageHead
          title={t('Chat logs')}
          back={() => goBack()}
          actions={
            <button class="icon-btn" onClick={() => setSheet('')} aria-label={t('Channels recorded here')} title={t('Channels recorded here')}>
              <Icon name="broadcast" />
            </button>
          }
          subtitle={data ? t('{user} in {channel}’s chat', { user: data.user.name, channel: data.channel.name }) : t('Everything someone wrote in a Twitch channel’s chat')}
        />
        <form class="cl-find" onSubmit={find} role="search">
          <label class="search">
            <Icon name="brand-twitch" size={18} />
            <input
              value={typedChannel}
              onInput={(e) => setTypedChannel(e.currentTarget.value)}
              placeholder={t('Channel')}
              aria-label={t('Channel')}
              autocomplete="off"
              autocapitalize="off"
              spellcheck={false}
              enterKeyHint="next"
            />
          </label>
          <label class="search">
            <Icon name="user" size={18} />
            <input
              value={typedUser}
              onInput={(e) => setTypedUser(e.currentTarget.value)}
              placeholder={t('User')}
              aria-label={t('User')}
              autocomplete="off"
              autocapitalize="off"
              spellcheck={false}
              enterKeyHint="search"
            />
          </label>
          <button class="btn btn-primary" disabled={!cleanLogin(typedChannel) || !cleanLogin(typedUser)}>{t('Look up')}</button>
        </form>
        {recent.length > 0 && (
          <div class="chips filters scroll-x fade-arrive-soft" role="toolbar" aria-label={t('Recent lookups')}>
            {recent.map((p) => (
              <button class="chip" aria-pressed={p.channel === channel && p.user === user} onClick={() => go(p.channel, p.user)}>
                {t('{user} in {channel}', { user: p.user, channel: p.channel })}
              </button>
            ))}
          </div>
        )}
      </div>

      {data ? (
        <Report key={`${channel}|${user}`} d={data} query={query} onRecord={() => setSheet(channel)} onRefresh={() => setAgain((n) => n + 1)} refreshing={look.loading} />
      ) : look.error ? (
        <div class="empty">
          <h2 class="title-s">{t('Couldn’t look that up')}</h2>
          <p>{look.error}</p>
          <button class="btn btn-quiet" onClick={() => setAgain((n) => n + 1)}><Icon name="refresh" size={18} /> {t('Try again')}</button>
        </div>
      ) : key ? (
        <p class="empty-note center loading-note">{t('Asking the log archives about {user} in {channel}…', { user, channel })}</p>
      ) : (
        <section class="card sr-note cl-intro">
          <p>{t('Type a channel and a user to see what they wrote in its chat.')}</p>
          <p>{t('Logs come from the public Twitch log archives, the last 24 hours of any channel’s chat, and the channels recorded here. Small channels that no archive covers can be recorded here from now on.')}</p>
        </section>
      )}

      <RecordedSheet open={sheet !== null} add={sheet ?? ''} onClose={() => setSheet(null)} onChange={() => setAgain((n) => n + 1)} />
    </div>
  );
}

/* ---------- one user in one channel ---------- */

function Report({ d, query, onRecord, onRefresh, refreshing }: { d: Lookup; query: URLSearchParams; onRecord: () => void; onRefresh: () => void; refreshing: boolean }) {
  const years = useMemo(() => [...new Set(d.months.map((m) => Number(m.slice(0, 4))))].sort((a, b) => b - a), [d.months]);
  const qYear = Number(query.get('year'));
  const year = years.includes(qYear) ? qYear : years[0] ?? new Date().getFullYear();
  const inYear = d.months.filter((m) => m.startsWith(`${year}-`));
  const qMonth = query.get('month') ?? '';
  const month = d.months.includes(qMonth) ? qMonth : inYear.at(-1) ?? d.months.at(-1) ?? '';
  const day = /^\d{4}-\d{2}-\d{2}$/.test(query.get('day') ?? '') ? query.get('day')! : null;

  const set = (o: { year?: number; month?: string; day?: string | null }) => {
    const q = new URLSearchParams({ channel: d.channel.login, user: d.user.login });
    const y = o.year ?? year;
    if (y !== years[0]) q.set('year', String(y));
    const m = o.month ?? (o.year ? '' : month);
    if (m) q.set('month', m);
    const dd = o.day === undefined ? day : o.day;
    if (dd) q.set('day', dd);
    navigate(`chatlogs?${q}`, true);
  };

  // the channel's emotes load beside everything else; lines show as words until they're there
  const emotes = useLoad(d.channel.id, () => loadEmotes(d.channel.id)).data;
  const first = d.months[0];
  return (
    <RevealStack>
      <Banner d={d} onRefresh={onRefresh} refreshing={refreshing} />
      {!d.months.length ? (
        <section class="card sr-note">
          <p><b>{t('No logs of {user} in {channel} yet.', { user: d.user.name, channel: d.channel.name })}</b></p>
          {d.optedOut ? (
            <p>{t('{user} asked the log archives not to keep their messages.', { user: d.user.name })}</p>
          ) : d.recorded ? (
            <p>{t('This channel is recorded here since {date}, and they haven’t written in it since.', { date: shortDate(keyOf(new Date(d.recorded.since))) })}</p>
          ) : (
            <>
              <p>{t('None of the public log archives keep this channel’s chat, and they haven’t written in it in the last 24 hours.')}</p>
              <p><button class="btn btn-quiet" onClick={onRecord}><Icon name="broadcast" size={18} /> {t('Record this channel from now on')}</button></p>
            </>
          )}
        </section>
      ) : (
        <>
          <Activity d={d} year={year} years={years} day={day} onYear={(y) => set({ year: y, day: null })} onDay={(k) => set({ month: k.slice(0, 7), day: k === day ? null : k })} />
          <Messages key={`${month}|${day}`} d={d} emotes={emotes} month={month} day={day} year={year} onMonth={(m) => set({ year: Number(m.slice(0, 4)), month: m, day: null })} onAll={() => set({ day: null })} />
          <p class="sr-small cl-foot">
            {t('Logged since {date}.', { date: monthName(first) })}{' '}
            {!d.recorded && <button class="link small" onClick={onRecord}>{t('Record this channel here too')}</button>}
          </p>
        </>
      )}
    </RevealStack>
  );
}

function Banner({ d, onRefresh, refreshing }: { d: Lookup; onRefresh: () => void; refreshing: boolean }) {
  const sources = [
    ...d.sources.map((s) => ({ name: s.host, href: `https://${s.host}/?channel=${d.channel.login}&username=${d.user.login}`, n: s.months.length })),
    ...(d.recorded ? [{ name: sourceName('here'), href: null, n: null }] : []),
    ...(d.lately ? [{ name: sourceName('lately'), href: null, n: null }] : []),
  ];
  return (
    <section class="card sr-banner cl-banner">
      <div class="sr-who">
        {d.user.logo ? <img class="sr-avatar" src={d.user.logo} width={64} height={64} alt="" /> : <span class="sr-avatar" />}
        <div class="sr-who-text">
          <h2 class="sr-name">{d.user.name}</h2>
          <p class="sr-meta">
            {t('in {channel}’s chat', { channel: d.channel.name })}
            {d.user.banned && <> · <span class="cl-banned">{t('banned from Twitch')}</span></>}
          </p>
        </div>
        <button class="icon-btn" onClick={onRefresh} disabled={refreshing} aria-label={t('Look again')} title={t('Look again')}>
          <Icon name="refresh" />
        </button>
      </div>
      <div class="sr-life">
        <div class="sr-life-item"><small>{t('Months')}</small><b>{num(d.months.length)}</b><span>{d.months.length ? `${monthName(d.months[0])} – ${monthName(d.months.at(-1)!)}` : '—'}</span></div>
        <div class="sr-life-item"><small>{t('Sources')}</small><b>{num(sources.length)}</b><span>{t('of {n} archives asked', { n: 18 })}</span></div>
      </div>
      {sources.length > 0 && (
        <div class="cl-sources">
          {sources.map((s) => s.href ? (
            <a class="chip" href={s.href} target="_blank" rel="noopener noreferrer" title={t('Open in {name}', { name: s.name })}>
              {s.name}{s.n ? <small>{num(s.n)}</small> : null}
            </a>
          ) : <span class="chip">{s.name}</span>)}
        </div>
      )}
    </section>
  );
}

/* ---------- the year in days, GitHub style ---------- */

function Activity({ d, year, years, day, onYear, onDay }: { d: Lookup; year: number; years: number[]; day: string | null; onYear: (y: number) => void; onDay: (k: string) => void }) {
  const a = useYearDays(d.channel.login, d.user.login, year, d.months);
  const scroller = useRef<HTMLDivElement>(null);
  const today = todayKey();
  const start = `${year}-01-01`;
  const end = year === new Date().getFullYear() ? today : `${year}-12-31`;
  const first = startOfWeek(start, 1);
  const weeks = Math.ceil((Math.round((parseKey(end).getTime() - parseKey(first).getTime()) / 864e5) + 1) / 7);
  const days = a.days;
  const reading = a.waiting.size > 0;

  // five shades by the days' own spread, so a quiet chatter's busy day still looks busy
  const cuts = useMemo(() => {
    const v = Object.values(days).filter((n) => n > 0).sort((x, y) => x - y);
    if (!v.length) return [1, 1, 1, 1];
    return [0.2, 0.4, 0.6, 0.8].map((q) => v[Math.min(v.length - 1, Math.floor(q * v.length))]);
  }, [days]);
  const level = (n: number) => (n <= 0 ? 0 : 1 + cuts.filter((c) => n > c).length);

  const stats = useMemo(() => {
    const keys = Object.keys(days).filter((k) => days[k] > 0).sort();
    let best = 0, run = 0, prev = '';
    for (const k of keys) {
      run = prev && addDays(prev, 1) === k ? run + 1 : 1;
      best = Math.max(best, run);
      prev = k;
    }
    const busiest = keys.reduce((b, k) => (days[k] > (days[b] ?? 0) ? k : b), keys[0] ?? '');
    return { active: keys.length, best, busiest };
  }, [days]);

  // the newest weeks are what's wanted first: on a phone the grid starts scrolled to its end
  useLayoutEffect(() => {
    const el = scroller.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, [year]);

  return (
    <ChartCard
      wide
      title={t('Activity')}
      sub={reading ? t('Reading {year}… {done} of {n} months', { year, done: a.done, n: a.of }) : t('{n} in {year}', { n: `${num(a.total)} ${noun(a.total, 'message', 'messages')}`, year })}
      legend={<HeatLegend />}
    >
      {years.length > 1 && (
        <div class="chips cl-years" role="toolbar" aria-label={t('Year')}>
          {years.map((y) => <button class="chip" aria-pressed={y === year} onClick={() => onYear(y)}>{y}</button>)}
        </div>
      )}
      <div class="cl-heat" ref={scroller}>
        <div class="cl-heat-in" style={{ '--weeks': weeks }}>
          <span />
          {Array.from({ length: weeks }, (_, w) => {
            const k = addDays(first, w * 7);
            const sunday = addDays(k, 6);
            const label = w === 0 ? (k.startsWith(`${year}-`) ? k : start) : sunday.slice(8) <= '07' ? sunday : null;
            return <span class="cl-heat-month">{label ? formatDate(parseKey(label), { month: 'short' }) : ''}</span>;
          })}
          {[0, 1, 2, 3, 4, 5, 6].map((row) => (
            <>
              <span class="tick-html left cl-heat-day">{row % 2 === 0 ? WEEKDAYS[row].slice(0, 3) : ''}</span>
              {Array.from({ length: weeks }, (_, w) => {
                const k = addDays(first, w * 7 + row);
                if (k < start || k > end) return <span class="cl-cell out" />;
                const n = days[k] ?? 0;
                return (
                  <button
                    class={`heat-cell cl-cell s${level(n)}${a.waiting.has(k.slice(0, 7)) ? ' wait' : ''}`}
                    style={{ '--t': (w / weeks).toFixed(3) }}
                    aria-pressed={k === day}
                    disabled={!n}
                    onClick={() => onDay(k)}
                    {...tipProps(() => (
                      <>
                        <div class="tip-title">{longDay(k)}</div>
                        <TipRow value={n ? num(n) : t('none')} label={noun(n, 'message', 'messages')} />
                      </>
                    ), `${longDay(k)}: ${n}`)}
                  />
                );
              })}
            </>
          ))}
        </div>
      </div>
      {a.error && <p class="hint danger">{a.error}</p>}
      {!reading && stats.active > 0 && (
        <div class="cl-facts">
          <span><b>{num(stats.active)}</b> {noun(stats.active, 'day', 'days')} {t('with messages')}</span>
          <span><b>{num(stats.best)}</b> {t('days in a row at most')}</span>
          {stats.busiest && <span>{t('Busiest: {date}', { date: shortDate(stats.busiest) })} · <b>{num(days[stats.busiest])}</b></span>}
        </div>
      )}
    </ChartCard>
  );
}

/* ---------- the lines ---------- */

function Messages({ d, emotes, month, day, year, onMonth, onAll }: { d: Lookup; emotes: Emotes | null; month: string; day: string | null; year: number; onMonth: (m: string) => void; onAll: () => void }) {
  const m = useLoad(month ? `${d.channel.id}|${d.user.id}|${month}` : null, () => loadMonth(d.channel.login, d.user.login, month));
  const [typed, setTyped] = useState('');
  const [asked, setAsked] = useState('');
  const found = useLoad(asked ? `${d.channel.id}|${d.user.id}|${year}|${asked}` : null, () => search(d.channel.login, d.user.login, year, asked));
  const [shown, setShown] = useState(DAYS_SHOWN);
  const i = d.months.indexOf(month);
  const prev = i > 0 ? d.months[i - 1] : null;
  const next = i >= 0 && i < d.months.length - 1 ? d.months[i + 1] : null;

  const lines: Line[] | null = asked ? found.data?.messages ?? null : m.data?.messages ?? null;
  // by day, newest day first, each day's newest line on top
  const groups = useMemo(() => {
    const by = new Map<string, Line[]>();
    for (const x of lines ?? []) {
      const k = keyOf(new Date(x.t));
      if (day && !asked && k !== day) continue;
      if (!by.has(k)) by.set(k, []);
      by.get(k)!.push(x);
    }
    for (const list of by.values()) list.sort((a, b) => b.t - a.t);
    return [...by].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [lines, day, asked]);

  const submit = (e: Event) => {
    e.preventDefault();
    setAsked(typed.trim());
    setShown(DAYS_SHOWN);
  };
  const clear = () => { setTyped(''); setAsked(''); };
  const loading = asked ? found.loading : m.loading;
  const error = asked ? found.error : m.error;
  const total = asked ? found.data?.messages.length ?? 0 : day ? groups[0]?.[1].length ?? 0 : m.data?.total ?? 0;

  return (
    <section class="card chart-card wide cl-log">
      <header class="chart-head cl-log-head">
        <div>
          <h3 class="chart-title">{asked ? t('“{q}” in {year}', { q: asked, year }) : day ? longDay(day) : month ? monthName(month) : t('Messages')}</h3>
          <p class="chart-sub">
            {loading && !lines ? t('Loading…') : `${num(total)} ${noun(total, 'message', 'messages')}`}
            {asked && found.data?.more ? ` · ${t('the newest {n}', { n: num(500) })}` : ''}
            {!asked && m.data && m.data.total > m.data.messages.length ? ` · ${t('the newest {n}', { n: num(m.data.messages.length) })}` : ''}
          </p>
        </div>
        {!asked && (
          <div class="cl-month-nav">
            <button class="icon-btn small" disabled={!prev} onClick={() => prev && onMonth(prev)} aria-label={t('Earlier month')} title={prev ? monthName(prev) : undefined}><Icon name="chevron-left" size={18} /></button>
            <button class="icon-btn small" disabled={!next} onClick={() => next && onMonth(next)} aria-label={t('Later month')} title={next ? monthName(next) : undefined}><Icon name="chevron-right" size={18} /></button>
          </div>
        )}
      </header>
      <form class="cl-search" onSubmit={submit} role="search">
        <label class="search">
          <Icon name="search" size={18} />
          <input
            type="search"
            value={typed}
            onInput={(e) => { setTyped(e.currentTarget.value); if (!e.currentTarget.value) setAsked(''); }}
            placeholder={t('Search their messages in {year}', { year })}
            aria-label={t('Search their messages in {year}', { year })}
            autocomplete="off"
            enterKeyHint="search"
          />
        </label>
      </form>
      {(asked || day) && (
        <div class="chips cl-filters">
          {asked && <button class="chip" onClick={clear}><Icon name="x" size={14} /> {t('Clear search')}</button>}
          {day && !asked && <button class="chip" onClick={onAll}><Icon name="x" size={14} /> {t('Show all of {month}', { month: monthName(month) })}</button>}
        </div>
      )}
      {error ? (
        <p class="hint danger">{error}</p>
      ) : !lines ? (
        <div class="cl-ghosts" aria-hidden="true">{[70, 45, 85, 60, 35].map((w) => <span class="ghost" style={{ width: `${w}%` }} />)}</div>
      ) : !groups.length ? (
        <p class="empty-note">{asked ? t('Nothing they wrote in {year} has “{q}” in it.', { year, q: asked }) : t('Nothing on this day.')}</p>
      ) : (
        <div class={loading ? 'sr-stale' : ''}>
          {groups.slice(0, shown).map(([k, list]) => (
            <div class="cl-day" key={k}>
              <h4 class="cl-day-head">{longDay(k)} <small>{num(list.length)}</small></h4>
              <ol class="cl-lines">
                {list.map((x) => (
                  <li class={`cl-line k-${x.k}`}>
                    <time dateTime={new Date(x.t).toISOString()}>{timeLabel(x.t)}</time>
                    {x.k === 'ban' ? (
                      <span class="cl-text">{x.m.startsWith('timed out') ? t('Timed out for {n}', { n: x.m.replace(/^timed out for /, '') }) : t('Banned')}</span>
                    ) : (
                      <span class="cl-text">{x.k === 'me' || x.k === 'sub' ? <i><ChatText text={x.m} own={x.e} emotes={emotes} /></i> : <ChatText text={x.m} own={x.e} emotes={emotes} />}</span>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          ))}
          {groups.length > shown && (
            <button class="btn btn-quiet cl-more" onClick={() => setShown(shown + DAYS_SHOWN)}>
              {t('Show {n} more days', { n: Math.min(DAYS_SHOWN, groups.length - shown) })}
            </button>
          )}
          {!asked && !day && m.data && m.data.sources.length > 0 && (
            <p class="sr-small cl-from">{t('From {sources}', { sources: m.data.sources.map(sourceName).join(', ') })}</p>
          )}
        </div>
      )}
    </section>
  );
}

/* ---------- channels recorded on this server ---------- */

function size(bytes: number) {
  if (bytes < 1024 * 1024) return `${num(Math.max(1, Math.round(bytes / 1024)))} KB`;
  return `${(bytes / 1024 / 1024).toLocaleString(LOCALE, { maximumFractionDigits: 1 })} MB`;
}

function RecordedSheet({ open, add, onClose, onChange }: { open: boolean; add: string; onClose: () => void; onChange: () => void }) {
  const [list, setList] = useState<WatchList | null>(null);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    setError('');
    setName(add);
    setPassword('');
    watchList().then(setList, (e: Error) => setError(e.message));
  }, [open, add]);

  const run = async (work: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    setError('');
    try { await work(); } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  };
  const login = (e?: Event) => {
    e?.preventDefault();
    if (password) run(async () => { await signIn(password); setPassword(''); setList(await watchList()); });
  };
  const addIt = (e?: Event) => {
    e?.preventDefault();
    const c = cleanLogin(name);
    if (!c) return setError(t('“{name}” isn’t a Twitch channel name.', { name: name.trim() }));
    run(async () => { setList(await watch(c)); setName(''); onChange(); });
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={<span class="row gap-s"><Icon name="broadcast" /> {t('Channels recorded here')}</span>}
      label={t('Channels recorded here')}
      footer={list && !list.admin ? (
        <button class="btn btn-primary" onClick={() => login()} disabled={busy || !password}>{busy ? t('Signing in…') : t('Sign in')}</button>
      ) : undefined}
    >
      <p class="hint">{t('This server reads these channels’ chat around the clock, without a Twitch account, and keeps every line. That’s how a small channel no archive covers gets logged, from the moment it’s added. What’s recorded stays when a channel is removed.')}</p>
      {list && (
        <p class="hint cl-state">
          <span class={list.connected ? 'cl-dot on' : 'cl-dot'} aria-hidden="true" />
          {list.watched.length === 0 ? t('No channels yet.') : list.connected ? t('Connected to Twitch chat') : t('Connecting to Twitch chat…')}
        </p>
      )}
      {list && list.watched.length > 0 && (
        <ol class="tw-edit cl-watched fade-rows-soft">
          {list.watched.map((w) => (
            <li key={w.login}>
              <span class="tw-edit-name">
                <b>{w.name}</b>
                <small>
                  {t('since {date}', { date: shortDate(keyOf(new Date(w.since))) })} · {t('{n} today', { n: num(w.today) })} · {w.bytes ? size(w.bytes) : t('nothing yet')}
                </small>
              </span>
              {list.admin && (
                <button class="icon-btn small" disabled={busy} onClick={() => run(async () => { setList(await unwatch(w.login, true)); onChange(); })} aria-label={t('Stop recording {name}', { name: w.name })}>
                  <Icon name="trash" size={16} />
                </button>
              )}
            </li>
          ))}
        </ol>
      )}
      {list?.admin ? (
        <>
          <form class="tw-edit-add" onSubmit={addIt}>
            <input
              class="input"
              value={name}
              onInput={(e) => setName(e.currentTarget.value)}
              placeholder={t('Channel name or link')}
              aria-label={t('Channel to record')}
              autocomplete="off"
              autocapitalize="none"
              spellcheck={false}
              enterkeyhint="done"
            />
            <button class="btn btn-quiet" type="submit" disabled={busy || !name.trim() || list.watched.length >= list.max}><Icon name="plus" size={18} /> {t('Add')}</button>
          </form>
          <button class="link small muted tw-signout" onClick={() => run(async () => { await signOut(); setList(await watchList()); })}>{t('Sign out on this device')}</button>
        </>
      ) : list ? (
        <>
          <p class="hint">{t('Enter the admin password to add or remove channels. This device stays signed in.')}</p>
          <form onSubmit={login}>
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
          </form>
        </>
      ) : null}
      {error && <p class="hint danger fade-arrive-soft" role="alert">{error}</p>}
    </Sheet>
  );
}
