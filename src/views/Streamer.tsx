import { useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { goBack, navigate } from '../lib/router';
import { WEEKDAYS, formatDate, keyOf, shortDate, timeLabel } from '../lib/dates';
import { analyse, clock, forget, gameColors, hours, useChoices, useStreamer, type Analysis, type Choice, type Stream, type Streamer as Data } from '../lib/streamer';
import { compact } from '../lib/twitch';
import { ChartCard, CountUp, LegendItem, RevealStack, TipRow, tipProps, useWidth } from '../components/charts';
import { PageHead } from '../components/PageHead';
import { Icon, type UiName } from '../components/icons';
import { Sheet } from '../components/Sheet';
import { Sky } from '../components/Sky';
import { LOCALE, count, noun, t } from '../lib/i18n';
import '../styles/stats.css';
import '../styles/twitch.css';
import '../styles/streamer.css';

const DAY = 86_400_000;
const RANGES: [string, string, number | null][] = [['7', t('7 days'), 7], ['30', t('30 days'), 30], ['all', t('All'), null]];
const OTHER = 'color-mix(in oklab, var(--ink-3) 55%, var(--surface))';

const num = (n: number) => n.toLocaleString(LOCALE);
const day = (ms: number) => shortDate(keyOf(new Date(ms)));
const longDay = (ms: number) => formatDate(ms, { weekday: 'long', day: 'numeric', month: 'long' });

/** The page is Twitch purple, like Channel points; charts and tooltips read the accent from the root. */
function useAccent() {
  useLayoutEffect(() => {
    const root = document.documentElement.style;
    root.setProperty('--accent', 'var(--emo-fear)');
    return () => root.removeProperty('--accent');
  }, []);
}

/**
 * What a Twitch channel streams: the games and how long each, when it's live, how long its streams run and how
 * many watch. Pick one of the miner's channels or type any other.
 */
export function Streamer({ query }: { query: URLSearchParams }) {
  useAccent();
  const [again, setAgain] = useState(0);
  const choices = useChoices(again);
  const picked = query.get('channel')?.toLowerCase() || null;
  const login = picked ?? choices.data?.[0]?.login ?? null;
  const { data, error, loading } = useStreamer(login, again);
  const rangeId = RANGES.some((r) => r[0] === query.get('range')) ? query.get('range')! : '30';
  const [, , days] = RANGES.find((r) => r[0] === rangeId)!;
  const [typed, setTyped] = useState('');

  const go = (channel: string | null, range = rangeId) => {
    const q = new URLSearchParams();
    if (channel) q.set('channel', channel);
    if (range !== '30') q.set('range', range);
    const qs = q.toString();
    navigate(`streamer${qs ? '?' + qs : ''}`, true);
  };
  const find = (e: Event) => {
    e.preventDefault();
    const name = typed.trim().replace(/^@/, '').replace(/^https?:\/\/(www\.)?twitch\.tv\//i, '').replace(/\/.*$/, '').toLowerCase();
    if (!name) return;
    setTyped('');
    go(name);
  };
  const retry = () => {
    if (login) forget(login);
    setAgain((n) => n + 1);
  };

  // the typed channel joins the chips while it's shown, so it can be seen picked
  const list: Choice[] = choices.data ?? [];
  const chips = login && !list.some((c) => c.login === login) ? [...list, { login, name: data?.login === login ? data.name : login, live: null, mining: false }] : list;
  const shown = data && data.login === login ? data : null;

  return (
    <div class="page stats-page tw-page sr-page">
      <div class="journal-top stats-top" style={{ '--sky': 'var(--emo-fear)' }}>
        <Sky world="fear" letters="stream" />
        <PageHead
          title={t('Streamer stats')}
          back={() => goBack()}
          subtitle={shown ? <Status d={shown} /> : t('What a channel plays, when and for how long')}
        />
        <form class="sr-find" onSubmit={find} role="search">
          <label class="search">
            <Icon name="search" size={18} />
            <input
              type="search"
              value={typed}
              onInput={(e) => setTyped(e.currentTarget.value)}
              placeholder={t('Any Twitch channel')}
              aria-label={t('Any Twitch channel')}
              autocomplete="off"
              autocapitalize="off"
              spellcheck={false}
              enterKeyHint="search"
            />
          </label>
          <button class="btn btn-primary" disabled={!typed.trim()}>{t('Look up')}</button>
        </form>
        {chips.length > 0 && (
          <div class="chips filters scroll-x" role="toolbar" aria-label={t('Channel')}>
            {chips.map((c) => (
              <button class="chip" aria-pressed={c.login === login} onClick={() => go(c.login)} title={c.live ? t('Live: {game}', { game: c.live.game ?? '—' }) : undefined}>
                {c.live && <span class="tw-live" aria-label={t('live')} />}{c.name}
              </button>
            ))}
          </div>
        )}
        {shown && shown.streams.length > 0 && (
          <div class="seg tabs sr-range" role="tablist" aria-label={t('Time range')} style={{ '--at': RANGES.findIndex((r) => r[0] === rangeId), '--tabs': RANGES.length }}>
            {RANGES.map(([id, name]) => (
              <button role="tab" aria-selected={id === rangeId} onClick={() => go(login, id)}>{name}</button>
            ))}
          </div>
        )}
      </div>

      {shown ? (
        <Report key={shown.login + rangeId} d={shown} days={days} stale={loading} />
      ) : error ? (
        <div class="empty">
          <h2 class="title-s">{t('No stats for {name}', { name: login ?? '' })}</h2>
          <p>{error}</p>
          <button class="btn btn-quiet" onClick={retry}><Icon name="refresh" size={18} /> {t('Try again')}</button>
        </div>
      ) : !login && !choices.loading ? (
        <p class="empty-note center">{t('Type a channel to see what it streams.')}</p>
      ) : (
        <p class="empty-note center">{login ? t('Reading {name}’s streams…', { name: login }) : t('Loading…')}</p>
      )}
    </div>
  );
}

function Status({ d }: { d: Data }) {
  if (d.live) {
    return (
      <>
        <span class="tw-live" aria-hidden="true" />
        {d.live.game
          ? t('Live now: {game} for {n} viewers', { game: d.live.game, n: num(d.live.viewers) })
          : t('Live now for {n} viewers', { n: num(d.live.viewers) })}
      </>
    );
  }
  const last = d.streams.find((s) => !s.live);
  return <>{last ? t('{name} · last live {date}', { name: d.name, date: day(last.end) }) : d.name}</>;
}

function Report({ d, days, stale }: { d: Data; days: number | null; stale: boolean }) {
  const a = useMemo(() => analyse(d, days), [d, days]);
  const colors = useMemo(() => gameColors(d.streams), [d]);
  const [open, setOpen] = useState<Stream | null>(null);
  const colorOf = (g: string) => (colors.has(g) ? `var(--emo-${colors.get(g)})` : OTHER);
  const range = days ? t('the last {n} days', { n: days }) : t('since {date}', { date: day(a.from) });

  return (
    <div class={stale ? 'sr-stale' : ''}>
      <RevealStack>
        <Profile d={d} />

        {!d.streams.length ? (
          <section class="card sr-note">
            <p>{d.vodsMissing ? t('Twitch didn’t list this channel’s past streams just now. Try again in a minute.') : t('No past streams to read: this channel keeps no VODs.')}</p>
            {d.recordingSince && <p>{t('Streams are recorded here from now on, every 5 minutes while it’s live.')}</p>}
          </section>
        ) : !a.count ? (
          <section class="card sr-note"><p>{t('No streams in {range}. Try a longer range.', { range })}</p></section>
        ) : (
          <>
            <section class="card hero tw-hero">
              <div class="tile-label">{days ? t('Streamed in the last {n} days', { n: days }) : t('Streamed since {date}', { date: day(a.from) })}</div>
              <div class="hero-row">
                <span class="hero-num"><CountUp value={Math.round(a.total / 3_600_000)} /></span>
                <span class="hero-scale">{t('hours')}</span>
                <Icon name="brand-twitch" size={24} class="tw-mark sr-mark" />
              </div>
              <div class="tw-gains">
                <span><b>{a.count}</b> {noun(a.count, 'stream', 'streams')}</span>
                <span><b>{a.daysLive}</b> {t('of {n} days live', { n: a.span })}</span>
                <span><b>{a.games.length}</b> {noun(a.games.length, 'game', 'games')}</span>
              </div>
            </section>

            <div class="tiles">
              <Tile k={0} icon="clock" label={t('Average stream')} value={hours(a.average)} sub={t('{n} a day on average', { n: hours(a.total / a.span) })} />
              <Tile k={1} icon="flame" label={t('Longest stream')} value={a.longest ? hours(a.longest.end - a.longest.start) : '—'} sub={a.longest ? day(a.longest.start) : ''} />
              <Tile k={2} icon="sunrise" label={t('Usually goes live')} value={a.starts !== null ? clock(a.starts) : '—'} sub={a.ends !== null ? t('until about {time}', { time: clock(a.ends) }) : t('no set time')} />
            </div>

            <Games a={a} colorOf={colorOf} />
            <Hours a={a} colorOf={colorOf} colors={colors} d={d} />
            <When a={a} />
          </>
        )}

        <Audience d={d} a={a} />
        {d.streams.length > 0 && a.count > 0 && <Streams d={d} a={a} colorOf={colorOf} onOpen={setOpen} />}
        <Followers d={d} />

        <p class="sr-source">
          {t('From Twitch’s past broadcasts and their chapters (Twitch keeps them up to 60 days), TwitchTracker’s last 30 days and what this server records every 5 minutes. Times are yours.')}
        </p>
      </RevealStack>
      <StreamSheet d={d} s={open} colorOf={colorOf} onClose={() => setOpen(null)} />
    </div>
  );
}

function Profile({ d }: { d: Data }) {
  const role = d.partner ? t('Partner') : d.affiliate ? t('Affiliate') : null;
  const since = d.createdAt ? t('on Twitch since {year}', { year: new Date(d.createdAt).getFullYear() }) : null;
  return (
    <section class="card sr-profile">
      <div class="sr-who">
        {d.avatar ? <img class="sr-avatar" src={d.avatar} alt="" width={56} height={56} loading="lazy" /> : <span class="sr-avatar" />}
        <div class="sr-who-text">
          <h2 class="sr-name">{d.name}</h2>
          <p class="sr-meta">{[role, d.language, since, d.mining ? t('mined') : null].filter(Boolean).join(' · ')}</p>
        </div>
        <a class="icon-btn" href={`https://www.twitch.tv/${d.login}`} target="_blank" rel="noopener" aria-label={t('Open on Twitch')} title={t('Open on Twitch')}>
          <Icon name="external-link" size={18} />
        </a>
      </div>
      {d.followers !== null && (
        <div class="sr-followers">
          <b>{num(d.followers)}</b> {t('followers')}
          {d.summary?.followers != null && d.summary.followers !== 0 && (
            <span class={d.summary.followers > 0 ? 'up' : 'down'}>{d.summary.followers > 0 ? '+' : '−'}{num(Math.abs(d.summary.followers))} {t('in 30 days')}</span>
          )}
        </div>
      )}
      {d.live && (
        <div class="sr-live">
          {d.live.box && <img src={d.live.box} alt="" width={39} height={54} loading="lazy" />}
          <div class="sr-live-text">
            <span class="sr-live-head"><span class="tw-live" aria-hidden="true" />{t('Live for {time}', { time: hours(d.now - d.live.since) })}</span>
            <b>{d.live.game ?? t('No category')}</b>
            <small>{d.live.title}</small>
          </div>
          <span class="sr-live-n"><b>{compact(d.live.viewers)}</b><small>{t('watching')}</small></span>
        </div>
      )}
      {d.bio && <p class="sr-bio">{d.bio}</p>}
    </section>
  );
}

function Tile({ icon, label, value, sub, k }: { icon: UiName; label: string; value: string; sub: string; k: number }) {
  return (
    <div class="tile" style={{ '--k': k }}>
      <div class="tile-top">
        <span class="tile-ico"><Icon name={icon} size={14} stroke={2} /></span>
        <span class="tile-label">{label}</span>
      </div>
      <div class="tile-value small">{value}</div>
      <div class="tile-sub">{sub}</div>
    </div>
  );
}

/** Each game with the hours it got, biggest first. */
function Games({ a, colorOf }: { a: Analysis; colorOf: (g: string) => string }) {
  const [all, setAll] = useState(false);
  const rows = all ? a.games : a.games.slice(0, 8);
  const max = a.games[0]?.ms || 1;
  return (
    <section class="card tw-list sr-games">
      <h3 class="chart-title">{t('What they played')}</h3>
      <p class="chart-sub">{t('{n} by hours streamed', { n: count(a.games.length, 'game', 'games') })}</p>
      <ul>
        {rows.map((g, i) => (
          <li style={{ '--k': i, '--w': `${(g.ms / max) * 100}%`, '--c': colorOf(g.id) }}>
            {g.box ? <img class="sr-box" src={g.box} alt="" width={26} height={36} loading="lazy" /> : <span class="sr-box"><Icon name="device-gamepad-2" size={14} /></span>}
            <span class="sr-game">
              <b>{g.name}</b>
              <span class="sr-game-bar"><i /></span>
              <small>{t('{share} of the time · {streams}', { share: `${Math.round((g.ms / a.total) * 100)}%`, streams: count(g.streams, 'stream', 'streams') })}</small>
            </span>
            <span class="sr-game-h">{hours(g.ms)}</span>
          </li>
        ))}
      </ul>
      {a.games.length > 8 && (
        <button class="btn btn-quiet btn-s sr-more" onClick={() => setAll(!all)}>
          {all ? t('Show fewer') : t('Show all {n}', { n: a.games.length })}
        </button>
      )}
    </section>
  );
}

/** Hours live each day (or week), in the colours of the games. */
function Hours({ a, colorOf, colors, d }: { a: Analysis; colorOf: (g: string) => string; colors: Map<string, string>; d: Data }) {
  const [ref, W] = useWidth();
  const H = 170, L = 30, R = 4, T = 8, B = 22;
  const n = a.buckets.length;
  const pw = Math.max(0, W - L - R), ph = H - T - B;
  const maxH = Math.max(1, ...a.buckets.map((b) => b.ms / 3_600_000));
  const top = Math.max(2, Math.ceil(maxH / (maxH > 12 ? 4 : 2)) * (maxH > 12 ? 4 : 2));
  const y = (h: number) => T + ph - (h / top) * ph;
  const band = pw / Math.max(1, n);
  const bw = Math.max(2, Math.min(24, band - 2));
  const label = (b: (typeof a.buckets)[number]) => (a.weekly ? t('Week of {date}', { date: shortDate(b.key) }) : shortDate(b.key));
  const named = (g: string) => (g ? d.games[g]?.[0] ?? t('Unknown game') : t('No category'));
  // the legend: the coloured games that show up in this range, then the rest as one
  const present = new Set(a.buckets.flatMap((b) => [...b.games.keys()]));
  const legend = [...colors.keys()].filter((g) => present.has(g));
  const hasOther = [...present].some((g) => !colors.has(g));
  const ticks = n > 1 ? [0, Math.floor((n - 1) / 2), n - 1] : [0];

  return (
    <ChartCard
      title={a.weekly ? t('Hours each week') : t('Hours each day')}
      sub={t('Coloured by game')}
      legend={<>{legend.map((g) => <LegendItem color={colorOf(g)} label={named(g)} />)}{hasOther && <LegendItem color={colorOf('')} label={t('Other games')} />}</>}
      table={{
        head: [a.weekly ? t('Week') : t('Day'), t('Hours'), t('Games')],
        rows: a.buckets.filter((b) => b.ms).map((b) => [label(b), hours(b.ms), [...b.games].sort((x, y) => y[1] - x[1]).map(([g]) => named(g)).join(', ')]).reverse(),
      }}
    >
      <div ref={ref} class="chart">
        {W > 0 && (
          <svg width={W} height={H} role="img" aria-label={t('Hours streamed each day')}>
            {[0, top / 2, top].map((h) => (
              <>
                <line x1={L} x2={L + pw} y1={y(h)} y2={y(h)} class="grid" />
                <text x={L - 6} y={y(h) + 4} class="tick" text-anchor="end">{h}</text>
              </>
            ))}
            {a.buckets.map((b, i) => {
              const x = L + i * band + (band - bw) / 2;
              // biggest game at the bottom, each piece separated by a 2px gap
              const parts = [...b.games].sort((p, q) => q[1] - p[1]);
              let base = 0;
              return (
                <g class="sr-col" style={{ '--k': i }} {...tipProps(() => (
                  <>
                    <div class="tip-title">{label(b)}</div>
                    {b.ms ? parts.map(([g, ms]) => <TipRow value={hours(ms)} label={named(g)} color={colorOf(g)} />) : <span>{t('Not live')}</span>}
                  </>
                ), `${label(b)}: ${hours(b.ms)}`)}>
                  <rect x={L + i * band} y={T} width={band} height={ph} fill="transparent" />
                  {parts.map(([g, ms], j) => {
                    const h0 = base, h1 = base + ms / 3_600_000;
                    base = h1;
                    const yTop = y(h1), yBot = y(h0) - (j ? 2 : 0);
                    if (yBot - yTop < 0.75) return null;
                    const last = j === parts.length - 1;
                    const r = last ? Math.min(3, bw / 2, yBot - yTop) : 0;
                    return <path d={`M${x},${yBot}V${yTop + r}Q${x},${yTop} ${x + r},${yTop}H${x + bw - r}Q${x + bw},${yTop} ${x + bw},${yTop + r}V${yBot}Z`} fill={colorOf(g)} />;
                  })}
                </g>
              );
            })}
            {ticks.map((i) => (
              <text x={L + i * band + band / 2} y={H - 6} class="tick" text-anchor={i === 0 && n > 1 ? 'start' : i === n - 1 && n > 1 ? 'end' : 'middle'}>{shortDate(a.buckets[i].key)}</text>
            ))}
          </svg>
        )}
      </div>
    </ChartCard>
  );
}

/** How often they're live at each hour of each weekday, in the viewer's time. */
function When({ a }: { a: Analysis }) {
  const hoursRow = Array.from({ length: 24 }, (_, h) => h);
  const best = a.byWeekday.reduce((m, v, i) => (v > a.byWeekday[m] ? i : m), 0);
  return (
    <ChartCard
      title={t('When they’re live')}
      sub={t('In your time: the darker, the more often they’re live then')}
      table={{
        head: [t('Day'), t('Hours live on average'), t('Most often live')],
        rows: WEEKDAYS.map((w, i) => {
          const peak = a.often[i].reduce((m, v, h) => (v > a.often[i][m] ? h : m), 0);
          return [w, hours(a.byWeekday[i] * 3_600_000), a.often[i][peak] ? `${clock(peak * 60)} (${Math.round(a.often[i][peak] * 100)}%)` : '—'];
        }),
      }}
    >
      <div class="sr-heat" role="img" aria-label={t('How often they’re live at each hour')}>
        <span />
        {hoursRow.map((h) => <span class="tick-html">{h % 6 === 0 ? clock(h * 60).replace(/:00$/, '') : ''}</span>)}
        {WEEKDAYS.map((w, d) => (
          <>
            <span class="tick-html">{w}</span>
            {hoursRow.map((h) => {
              const v = a.often[d][h];
              return (
                <i
                  style={{ '--v': v.toFixed(3) }}
                  class={v ? '' : 'off'}
                  {...tipProps(() => (
                    <>
                      <div class="tip-title">{`${w} ${clock(h * 60)}–${clock(((h + 1) % 24) * 60)}`}</div>
                      <TipRow value={`${Math.round(v * 100)}%`} label={t('of the time live')} color="var(--accent)" />
                    </>
                  ), `${w} ${clock(h * 60)}: ${Math.round(v * 100)}%`)}
                />
              );
            })}
          </>
        ))}
      </div>
      <div class="sr-week">
        {WEEKDAYS.map((w, i) => (
          <span class={i === best && a.byWeekday[i] ? 'best' : ''} style={{ '--h': Math.min(1, a.byWeekday[i] / Math.max(1, ...a.byWeekday)).toFixed(3) }}>
            <i />
            <b>{a.byWeekday[i] >= 0.05 ? a.byWeekday[i].toFixed(1) : '0'}</b>
            <small>{w}</small>
          </span>
        ))}
      </div>
      <p class="chart-sub sr-week-note">{t('Hours live on an average day of the week')}</p>
    </ChartCard>
  );
}

/** How many watch: TwitchTracker's month, and what was recorded here per stream. */
function Audience({ d, a }: { d: Data; a: Analysis }) {
  const s = d.summary;
  const rec = a.streams.filter((x) => x.avg !== undefined).slice().reverse();
  if (!s && !rec.length && !d.recordingSince) return null;
  const v = a.viewers;
  return (
    <section class="card tw-list sr-audience">
      <h3 class="chart-title">{t('Audience')}</h3>
      {s ? (
        <>
          <p class="chart-sub">{t('The last 30 days, from TwitchTracker')}</p>
          <div class="sr-stats">
            <Stat label={t('Average viewers')} value={s.avg !== null ? num(s.avg) : '—'} />
            <Stat label={t('Peak viewers')} value={s.peak !== null ? num(s.peak) : '—'} />
            <Stat label={t('Hours watched')} value={s.hoursWatched !== null ? compact(s.hoursWatched) : '—'} />
            <Stat label={t('Rank on Twitch')} value={s.rank !== null ? `#${num(s.rank)}` : '—'} />
          </div>
        </>
      ) : (
        <p class="chart-sub">{t('TwitchTracker has no numbers for this channel right now.')}</p>
      )}
      {v && (
        <>
          <h4 class="sr-sub-title">{t('Recorded here')}</h4>
          <div class="sr-stats">
            <Stat label={t('Average viewers')} value={num(v.avg)} />
            <Stat label={t('Peak viewers')} value={num(v.peak)} />
            <Stat label={t('Hours watched')} value={compact(v.hoursWatched)} />
            <Stat label={t('Streams')} value={String(v.streams)} />
          </div>
          {rec.length > 1 && <ViewerBars streams={rec} />}
        </>
      )}
      {d.recordingSince && (
        <p class="sr-small">
          {t('Viewers are recorded here every 5 minutes while the channel is live, since {date}.', { date: day(d.recordingSince) })}
        </p>
      )}
    </section>
  );
}

const Stat = ({ label, value }: { label: string; value: string }) => (
  <div class="sr-stat"><b>{value}</b><small>{label}</small></div>
);

/** Average viewers of each recorded stream, oldest first. */
function ViewerBars({ streams }: { streams: Stream[] }) {
  const [ref, W] = useWidth();
  const H = 120, L = 38, R = 4, T = 8, B = 20;
  const n = streams.length;
  const pw = Math.max(0, W - L - R), ph = H - T - B;
  const max = Math.max(1, ...streams.map((s) => s.avg ?? 0));
  const y = (v: number) => T + ph - (v / max) * ph;
  const band = pw / n;
  const bw = Math.max(2, Math.min(24, band - 2));
  return (
    <div ref={ref} class="chart">
      {W > 0 && (
        <svg width={W} height={H} role="img" aria-label={t('Average viewers per stream')}>
          {[0, max / 2, max].map((v) => (
            <>
              <line x1={L} x2={L + pw} y1={y(v)} y2={y(v)} class="grid" />
              <text x={L - 6} y={y(v) + 4} class="tick" text-anchor="end">{compact(Math.round(v))}</text>
            </>
          ))}
          {streams.map((s, i) => {
            const x = L + i * band + (band - bw) / 2, top = y(s.avg!), r = Math.min(3, bw / 2, T + ph - top);
            return (
              <g class="sr-col" style={{ '--k': i }} {...tipProps(() => (
                <>
                  <div class="tip-title">{day(s.start)}</div>
                  <TipRow value={num(s.avg!)} label={t('average viewers')} color="var(--accent)" />
                  <TipRow value={num(s.peak ?? 0)} label={t('at the peak')} />
                </>
              ), `${day(s.start)}: ${num(s.avg!)}`)}>
                <rect x={L + i * band} y={T} width={band} height={ph} fill="transparent" />
                {T + ph - top > 0.75 && <path d={`M${x},${T + ph}V${top + r}Q${x},${top} ${x + r},${top}H${x + bw - r}Q${x + bw},${top} ${x + bw},${top + r}V${T + ph}Z`} class="sr-vbar" />}
              </g>
            );
          })}
          <text x={L} y={H - 4} class="tick" text-anchor="start">{day(streams[0].start)}</text>
          <text x={L + pw} y={H - 4} class="tick" text-anchor="end">{day(streams[n - 1].start)}</text>
        </svg>
      )}
    </div>
  );
}

/** Every stream in the range, newest first, each with its games as a strip; tap one for the whole of it. */
function Streams({ d, a, colorOf, onOpen }: { d: Data; a: Analysis; colorOf: (g: string) => string; onOpen: (s: Stream) => void }) {
  const [shown, setShown] = useState(15);
  return (
    <section class="card tw-list sr-streams">
      <h3 class="chart-title">{t('Streams')}</h3>
      <p class="chart-sub">{t('Tap one to see its games hour by hour')}</p>
      <ul>
        {a.streams.slice(0, shown).map((s, i) => {
          const len = Math.max(1, s.end - s.start);
          const games = [...new Set(s.segs.map((x) => x[0]))];
          return (
            <li style={{ '--k': Math.min(i, 12) }}>
              <button class="sr-stream" onClick={() => onOpen(s)}>
                <span class="sr-stream-top">
                  <b>{s.live && <span class="tw-live" aria-label={t('live')} />}{day(s.start)}</b>
                  <span>{timeLabel(s.start)}–{s.live ? t('now') : timeLabel(s.end)}</span>
                  <span class="sr-stream-len">{hours(len)}</span>
                </span>
                <span class="sr-strip" aria-hidden="true">
                  {s.segs.map(([g, , ms]) => <i style={{ flexGrow: ms / len, background: colorOf(g) }} />)}
                </span>
                <span class="sr-stream-games">
                  {games.slice(0, 3).map((g) => (g ? d.games[g]?.[0] ?? t('Unknown game') : t('No category'))).join(' · ')}
                  {games.length > 3 && ` · ${t('+{n} more', { n: games.length - 3 })}`}
                </span>
                {s.avg !== undefined && <span class="sr-stream-v"><Icon name="eye" size={14} /> {num(s.avg)}</span>}
              </button>
            </li>
          );
        })}
      </ul>
      {a.streams.length > shown && (
        <button class="btn btn-quiet btn-s sr-more" onClick={() => setShown(shown + 30)}>{t('Show {n} more', { n: Math.min(30, a.streams.length - shown) })}</button>
      )}
    </section>
  );
}

/** Followers as recorded here day by day; shown once there are a few days of them. */
const Followers = ({ d }: { d: Data }) => (d.followerDays.length >= 3 ? <FollowerChart pts={d.followerDays} /> : null);

function FollowerChart({ pts }: { pts: [number, number][] }) {
  const [ref, W] = useWidth();
  const H = 120, L = 46, R = 8, T = 10, B = 20;
  const lo = Math.min(...pts.map((p) => p[1])), hi = Math.max(...pts.map((p) => p[1]));
  const pad = Math.max(1, (hi - lo) * 0.1);
  const pw = Math.max(0, W - L - R), ph = H - T - B;
  const x0 = pts[0][0], x1 = pts[pts.length - 1][0];
  const x = (ms: number) => L + ((ms - x0) / (x1 - x0 || 1)) * pw;
  const y = (v: number) => T + (1 - (v - lo + pad) / (hi - lo + 2 * pad)) * ph;
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p[0]).toFixed(1)},${y(p[1]).toFixed(1)}`).join('');
  const change = pts[pts.length - 1][1] - pts[0][1];
  return (
    <ChartCard
      title={t('Followers')}
      sub={t('{sign}{n} since {date}', { sign: change >= 0 ? '+' : '−', n: num(Math.abs(change)), date: day(x0) })}
      table={{ head: [t('Day'), t('Followers')], rows: pts.map((p) => [day(p[0]), num(p[1])]).reverse() }}
    >
      <div ref={ref} class="chart">
        {W > 0 && (
          <svg width={W} height={H} role="img" aria-label={t('Followers over time')}>
            {[hi, lo].map((v) => (
              <>
                <line x1={L} x2={L + pw} y1={y(v)} y2={y(v)} class="grid" />
                <text x={L - 6} y={y(v) + 4} class="tick" text-anchor="end">{compact(v)}</text>
              </>
            ))}
            <path d={line} class="tw-line" pathLength={1} />
            {pts.map((p) => (
              <g class="tw-col" {...tipProps(() => (
                <>
                  <div class="tip-title">{day(p[0])}</div>
                  <TipRow value={num(p[1])} label={t('followers')} color="var(--accent)" />
                </>
              ), `${day(p[0])}: ${num(p[1])}`)}>
                <rect x={x(p[0]) - pw / pts.length / 2} y={T} width={pw / pts.length} height={ph} fill="transparent" />
                <line x1={x(p[0])} x2={x(p[0])} y1={T} y2={T + ph} class="tw-guide" />
              </g>
            ))}
            <text x={L} y={H - 4} class="tick" text-anchor="start">{day(x0)}</text>
            <text x={L + pw} y={H - 4} class="tick" text-anchor="end">{day(x1)}</text>
          </svg>
        )}
      </div>
    </ChartCard>
  );
}

/** One stream: its games along its length, each with when and how long, and its viewers when they were recorded. */
function StreamSheet({ d, s, colorOf, onClose }: { d: Data; s: Stream | null; colorOf: (g: string) => string; onClose: () => void }) {
  // the sheet keeps showing its stream while it slides away
  const last = useRef<Stream | null>(null);
  if (s) last.current = s;
  const x = s ?? last.current;
  return (
    <Sheet open={!!s} onClose={onClose} title={x ? longDay(x.start) : ''}>
      {x && <StreamDetail d={d} s={x} colorOf={colorOf} />}
    </Sheet>
  );
}

function StreamDetail({ d, s, colorOf }: { d: Data; s: Stream; colorOf: (g: string) => string }) {
  const len = Math.max(1, s.end - s.start);
  const named = (g: string) => (g ? d.games[g]?.[0] ?? t('Unknown game') : t('No category'));
  return (
    <div class="sr-detail">
      <p class="sr-detail-when">
        {s.live && <span class="tw-live" aria-hidden="true" />}
        {timeLabel(s.start)}–{s.live ? t('now') : timeLabel(s.end)} · <b>{hours(len)}</b>
        {s.end - s.start > DAY / 2 && keyOf(new Date(s.start)) !== keyOf(new Date(s.end)) && ` · ${t('ends {date}', { date: day(s.end) })}`}
      </p>
      {s.title && <p class="sr-detail-title">{s.title}</p>}
      <div class="sr-strip big" aria-hidden="true">
        {s.segs.map(([g, , ms]) => <i style={{ flexGrow: ms / len, background: colorOf(g) }} />)}
      </div>
      <ul class="sr-chapters">
        {s.segs.map(([g, at, ms]) => (
          <li>
            {g && d.games[g]?.[1] ? <img class="sr-box" src={d.games[g][1]!} alt="" width={26} height={36} loading="lazy" /> : <span class="sr-box" style={{ '--c': colorOf(g) }}><Icon name="device-gamepad-2" size={14} /></span>}
            <span class="sr-chapter-text">
              <b><i class="sr-dot" style={{ background: colorOf(g) }} />{named(g)}</b>
              <small>{timeLabel(s.start + at)}–{timeLabel(s.start + at + ms)}</small>
            </span>
            <span class="sr-game-h">{hours(ms)}</span>
          </li>
        ))}
      </ul>
      {s.curve && s.curve.length > 1 && <Curve s={s} />}
      {s.avg !== undefined && (
        <p class="sr-small">{t('{avg} watching on average, {peak} at the peak', { avg: num(s.avg), peak: num(s.peak ?? s.avg) })}</p>
      )}
      {s.vod && (
        <a class="btn btn-quiet sr-vod" href={`https://www.twitch.tv/videos/${s.vod}`} target="_blank" rel="noopener">
          <Icon name="player-play" size={18} /> {s.live ? t('Watch live') : t('Watch the VOD')}
        </a>
      )}
    </div>
  );
}

/** A stream's viewers over its length. */
function Curve({ s }: { s: Stream }) {
  const [ref, W] = useWidth();
  const pts = s.curve!;
  const H = 110, L = 38, R = 6, T = 8, B = 18;
  const pw = Math.max(0, W - L - R), ph = H - T - B;
  const span = Math.max(1, (s.end - s.start) / 60_000);
  const max = Math.max(1, ...pts.map((p) => p[1]));
  const x = (m: number) => L + Math.min(1, m / span) * pw;
  const y = (v: number) => T + ph - (v / max) * ph;
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p[0]).toFixed(1)},${y(p[1]).toFixed(1)}`).join('');
  return (
    <div ref={ref} class="chart sr-curve">
      {W > 0 && (
        <svg width={W} height={H} role="img" aria-label={t('Viewers during the stream')}>
          {[0, max].map((v) => (
            <>
              <line x1={L} x2={L + pw} y1={y(v)} y2={y(v)} class="grid" />
              <text x={L - 6} y={y(v) + 4} class="tick" text-anchor="end">{compact(Math.round(v))}</text>
            </>
          ))}
          <path d={line} class="tw-line" pathLength={1} />
          {pts.map((p) => (
            <g class="tw-col" {...tipProps(() => (
              <>
                <div class="tip-title">{timeLabel(s.start + p[0] * 60_000)}</div>
                <TipRow value={num(p[1])} label={t('watching')} color="var(--accent)" />
              </>
            ), `${timeLabel(s.start + p[0] * 60_000)}: ${num(p[1])}`)}>
              <rect x={x(p[0]) - pw / pts.length / 2} y={T} width={pw / pts.length} height={ph} fill="transparent" />
              <line x1={x(p[0])} x2={x(p[0])} y1={T} y2={T + ph} class="tw-guide" />
            </g>
          ))}
          <text x={L} y={H - 3} class="tick" text-anchor="start">{timeLabel(s.start)}</text>
          <text x={L + pw} y={H - 3} class="tick" text-anchor="end">{timeLabel(s.end)}</text>
        </svg>
      )}
    </div>
  );
}
