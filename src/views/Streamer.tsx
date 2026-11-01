import type { ComponentChildren } from 'preact';
import { useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { goBack, navigate } from '../lib/router';
import { WEEKDAYS, formatDate, keyOf, shortDate, timeLabel } from '../lib/dates';
import { age, analyse, career, clock, forget, gameColors, hours, overTime, sums, useChoices, useStreamer, type Analysis, type Career, type Choice, type Period, type Stream, type Streamer as Data } from '../lib/streamer';
import { compact } from '../lib/twitch';
import { ChartCard, CountUp, LegendItem, RevealStack, TipRow, barPath, tipProps, useWidth } from '../components/charts';
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
const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${num(Math.abs(n))}`;
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
          subtitle={shown ? <Status d={shown} /> : t('A channel’s whole career, and what it plays, when and for how long')}
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
          <div class="chips filters scroll-x fade-arrive-soft" role="toolbar" aria-label={t('Channel')}>
            {chips.map((c) => (
              <button class="chip" aria-pressed={c.login === login} onClick={() => go(c.login)} title={c.live ? t('Live: {game}', { game: c.live.game ?? '—' }) : undefined}>
                {c.live && <span class="tw-live" aria-label={t('live')} />}{c.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {shown ? (
        <Report key={shown.login} d={shown} days={days} rangeId={rangeId} onRange={(id) => go(login, id)} stale={loading} />
      ) : error ? (
        <div class="empty">
          <h2 class="title-s">{t('No stats for {name}', { name: login ?? '' })}</h2>
          <p>{error}</p>
          <button class="btn btn-quiet" onClick={retry}><Icon name="refresh" size={18} /> {t('Try again')}</button>
        </div>
      ) : !login && !choices.loading ? (
        <p class="empty-note center">{t('Type a channel to see what it streams.')}</p>
      ) : (
        <p class="empty-note center loading-note">{login ? t('Reading {name}’s streams…', { name: login }) : t('Loading…')}</p>
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

function Report({ d, days, rangeId, onRange, stale }: { d: Data; days: number | null; rangeId: string; onRange: (id: string) => void; stale: boolean }) {
  const a = useMemo(() => analyse(d, days), [d, days]);
  const c = useMemo(() => career(d), [d]);
  const colors = useMemo(() => gameColors(d.streams, d.clips ?? []), [d]);
  const [open, setOpen] = useState<Stream | null>(null);
  const colorOf = (g: string) => (colors.has(g) ? `var(--emo-${colors.get(g)})` : OTHER);
  const range = days ? t('the last {n} days', { n: days }) : t('since {date}', { date: day(a.from) });

  return (
    <div class={stale ? 'sr-stale' : ''}>
      <RevealStack>
        <Banner d={d} c={c} />

        {c.clips.length > 0 && (
          <>
            <CareerChart d={d} c={c} colorOf={colorOf} colors={colors} />
            <Eras d={d} c={c} colorOf={colorOf} />
            <Moments d={d} c={c} />
          </>
        )}

        <OverTime d={d} colorOf={colorOf} colors={colors} />

        {!d.streams.length ? (
          <section class="card sr-note">
            <p>{d.vodsMissing ? t('Twitch didn’t list this channel’s past streams just now. Try again in a minute.') : t('No past streams to read: this channel keeps no VODs.')}</p>
            {d.recordingSince && <p>{t('Streams are recorded here from now on, every 5 minutes while it’s live.')}</p>}
          </section>
        ) : (
          <Summary d={d} a={a} days={days} rangeId={rangeId} onRange={onRange} range={range} />
        )}

        {a.count > 0 && (
          <>
            <Games a={a} colorOf={colorOf} />
            <When a={a} />
            <Hours a={a} colorOf={colorOf} colors={colors} d={d} />
          </>
        )}

        <Audience d={d} a={a} />
        <Followers d={d} />
        {d.streams.length > 0 && a.count > 0 && <Streams d={d} a={a} colorOf={colorOf} onOpen={setOpen} />}

        <p class="sr-source">
          {t('From Twitch: the channel, its past broadcasts and their chapters (Twitch keeps them up to 60 days) and its 100 most-watched clips; TwitchTracker’s last 30 days; and what this server records every 5 minutes, kept for good. Times are yours.')}
        </p>
      </RevealStack>
      <StreamSheet d={d} s={open} colorOf={colorOf} onClose={() => setOpen(null)} />
    </div>
  );
}

/** Who it is, and what the whole of their time on Twitch comes to. */
function Banner({ d, c }: { d: Data; c: Career }) {
  const role = d.partner ? t('Partner') : d.affiliate ? t('Affiliate') : null;
  const rank = d.summary?.rank ?? null;
  const gained = d.summary?.followers ?? null;
  return (
    <section class="card sr-banner">
      <div class="sr-who">
        {d.avatar ? <img class="sr-avatar" src={d.avatar} alt="" width={64} height={64} loading="lazy" /> : <span class="sr-avatar" />}
        <div class="sr-who-text">
          <h2 class="sr-name">{d.name}</h2>
          <p class="sr-meta">{[role, d.language?.toUpperCase(), d.mining ? t('mined') : null].filter(Boolean).join(' · ')}</p>
        </div>
        <a class="icon-btn" href={`https://www.twitch.tv/${d.login}`} target="_blank" rel="noopener" aria-label={t('Open on Twitch')} title={t('Open on Twitch')}>
          <Icon name="external-link" size={18} />
        </a>
      </div>
      <div class="sr-life">
        {d.followers !== null && (
          <Life label={t('Followers')} value={num(d.followers)}
            sub={gained ? <span class={gained > 0 ? 'up' : 'down'}>{gained > 0 ? '+' : '−'}{num(Math.abs(gained))} {t('in 30 days')}</span> : null} />
        )}
        {d.createdAt && <Life label={t('On Twitch')} value={age(d.createdAt, d.now)} sub={t('since {date}', { date: formatDate(d.createdAt, { day: 'numeric', month: 'short', year: 'numeric' }) })} />}
        {rank !== null && <Life label={t('Rank on Twitch')} value={`#${num(rank)}`} sub={t('over the last 30 days')} />}
        {c.clips.length > 0 && <Life label={t('Top clip views')} value={compact(c.views)} sub={t('across their {n} most-watched clips', { n: c.clips.length })} />}
      </div>
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

const Life = ({ label, value, sub }: { label: string; value: string; sub: ComponentChildren }) => (
  <div class="sr-life-item">
    <small>{label}</small>
    <b>{value}</b>
    {sub && <span>{sub}</span>}
  </div>
);

/** Each year since the channel was made, with the views of the biggest clips made that year, in the colours of their games. */
function CareerChart({ d, c, colorOf, colors }: { d: Data; c: Career; colorOf: (g: string) => string; colors: Map<string, string> }) {
  const [ref, W] = useWidth();
  const H = 200, L = 40, R = 4, T = 14, B = 22;
  const n = c.years.length;
  const pw = Math.max(0, W - L - R), ph = H - T - B;
  const max = Math.max(1, ...c.years.map((y) => y.views));
  const y = (v: number) => T + ph - (v / max) * ph;
  const band = pw / Math.max(1, n);
  const bw = Math.max(4, Math.min(28, band - 6));
  const named = (g: string) => (g ? d.games[g]?.[0] ?? t('Unknown game') : t('No category'));
  const present = new Set(c.clips.map((x) => x.game));
  const legend = [...colors.keys()].filter((g) => present.has(g));
  const hasOther = [...present].some((g) => !colors.has(g));
  // Twitch added clips in 2016: the years before can't have any
  const before = c.years.findIndex((x) => x.year >= 2016);
  const every = band < 34 ? 2 : 1;
  const joined = d.createdAt ? c.years.findIndex((x) => x.year === new Date(d.createdAt!).getFullYear()) : -1;
  const top = c.clips[0];

  return (
    <ChartCard
      wide
      title={t('Career on Twitch')}
      sub={t('Views of their {n} most-watched clips, by the year each was made', { n: c.clips.length })}
      legend={<>{legend.map((g) => <LegendItem color={colorOf(g)} label={named(g)} />)}{hasOther && <LegendItem color={colorOf('')} label={t('Other games')} />}</>}
      table={{
        head: [t('Year'), t('Clip views'), t('Clips'), t('Biggest game')],
        rows: c.years.map((x) => [x.year, x.views ? num(x.views) : '—', x.clips || '—', x.clips ? named([...x.games].sort((p, q) => q[1] - p[1])[0][0]) : '—']).reverse(),
      }}
    >
      <div class="sr-career-facts">
        {c.best && <Fact label={t('Biggest year')} value={String(c.best.year)} sub={t('{n} of the top clips', { n: c.best.clips })} />}
        {top && <Fact label={t('Most-watched clip')} value={compact(top.views)} sub={`${named(top.game)} · ${new Date(top.at).getFullYear()}`} />}
        {c.eras[0] && <Fact label={t('Defining game')} value={c.eras[0].name} sub={t('{share} of the clip views', { share: `${Math.round((c.eras[0].views / (c.views || 1)) * 100)}%` })} />}
        <Fact label={t('Clipped years')} value={String(c.years.filter((x) => x.clips).length)} sub={t('of {n} on Twitch', { n: n - Math.max(0, joined) })} />
      </div>
      <div ref={ref} class="chart">
        {W > 0 && (
          <svg width={W} height={H} role="img" aria-label={t('Clip views each year')}>
            {before > 0 && (
              <>
                <rect x={L} y={T} width={before * band} height={ph} class="sr-before" />
                {before * band > 70 && <text x={L + (before * band) / 2} y={T + ph / 2} class="tick" text-anchor="middle">{t('before clips')}</text>}
              </>
            )}
            {[0, max / 2, max].map((v) => (
              <>
                <line x1={L} x2={L + pw} y1={y(v)} y2={y(v)} class="grid" />
                <text x={L - 6} y={y(v) + 4} class="tick" text-anchor="end">{compact(Math.round(v))}</text>
              </>
            ))}
            {c.years.map((yr, i) => {
              const x = L + i * band + (band - bw) / 2;
              const parts = [...yr.games].sort((p, q) => q[1] - p[1]);
              let base = 0;
              return (
                <g class="sr-col" style={{ '--k': i }} {...tipProps(() => (
                  <>
                    <div class="tip-title">{yr.year}</div>
                    {yr.clips ? (
                      <>
                        <TipRow value={num(yr.views)} label={t('clip views')} />
                        {parts.slice(0, 4).map(([g, v]) => <TipRow value={compact(v)} label={named(g)} color={colorOf(g)} />)}
                      </>
                    ) : <span>{yr.year < 2016 ? t('Before Twitch had clips') : t('None of the top clips')}</span>}
                  </>
                ), `${yr.year}: ${num(yr.views)}`)}>
                  <rect x={L + i * band} y={T} width={band} height={ph} fill="transparent" />
                  {parts.map(([g, v], j) => {
                    const h0 = base, h1 = base + v;
                    base = h1;
                    const yTop = y(h1), yBot = y(h0) - (j ? 2 : 0);
                    if (yBot - yTop < 0.75) return null;
                    const r = j === parts.length - 1 ? Math.min(4, bw / 2, yBot - yTop) : 0;
                    return <path d={`M${x},${yBot}V${yTop + r}Q${x},${yTop} ${x + r},${yTop}H${x + bw - r}Q${x + bw},${yTop} ${x + bw},${yTop + r}V${yBot}Z`} fill={colorOf(g)} />;
                  })}
                </g>
              );
            })}
            {joined >= 0 && <circle cx={L + joined * band + band / 2} cy={T + ph} r={4} class="sr-joined"><title>{t('Joined Twitch')}</title></circle>}
            {c.years.map((yr, i) => (i % every === 0 || i === n - 1) && (
              <text x={L + i * band + band / 2} y={H - 5} class={i === joined ? 'tick sr-tick-strong' : 'tick'} text-anchor="middle">{every > 1 ? `’${String(yr.year).slice(2)}` : yr.year}</text>
            ))}
          </svg>
        )}
      </div>
    </ChartCard>
  );
}

const Fact = ({ label, value, sub }: { label: string; value: string; sub: string }) => (
  <div class="sr-fact"><small>{label}</small><b>{value}</b><span>{sub}</span></div>
);

/** The games the biggest clips came from, each on a line across the career with a dot for every clip. */
function Eras({ d, c, colorOf }: { d: Data; c: Career; colorOf: (g: string) => string }) {
  const [all, setAll] = useState(false);
  const rows = all ? c.eras : c.eras.slice(0, 7);
  const span = Math.max(1, d.now - c.start);
  const maxViews = c.clips[0]?.views || 1;
  const pos = (ms: number) => `${(((ms - c.start) / span) * 100).toFixed(2)}%`;
  const year = (ms: number) => new Date(ms).getFullYear();
  const first = year(c.start), last = year(d.now);
  return (
    <section class="card tw-list sr-eras">
      <h3 class="chart-title">{t('The games of their career')}</h3>
      <p class="chart-sub">{t('Where their biggest clips came from, and when')}</p>
      <ul>
        {rows.map((e, i) => (
          <li style={{ '--k': i, '--c': colorOf(e.id) }}>
            {e.box ? <img class="sr-box" src={e.box} alt="" width={26} height={36} loading="lazy" /> : <span class="sr-box"><Icon name="device-gamepad-2" size={14} /></span>}
            <span class="sr-game">
              <b>{e.name}</b>
              <span class="sr-track" aria-hidden="true">
                <i class="sr-span" style={{ left: pos(e.first), width: `max(2px, calc(${pos(e.last)} - ${pos(e.first)}))` }} />
                {e.clips.map((x) => <i class="sr-pip" style={{ left: pos(x.at), '--s': (0.45 + 0.55 * Math.sqrt(x.views / maxViews)).toFixed(2) }} />)}
              </span>
              <small>
                {count(e.clips.length, 'clip', 'clips')} · {year(e.first) === year(e.last) ? year(e.first) : `${year(e.first)}–${year(e.last)}`}
              </small>
            </span>
            <span class="sr-game-h">{compact(e.views)}</span>
          </li>
        ))}
      </ul>
      <div class="sr-track-axis" aria-hidden="true"><span>{first}</span><span>{Math.round((first + last) / 2)}</span><span>{last}</span></div>
      {c.eras.length > 7 && (
        <button class="btn btn-quiet btn-s sr-more" onClick={() => setAll(!all)}>
          {all ? t('Show fewer') : t('Show all {n}', { n: c.eras.length })}
        </button>
      )}
    </section>
  );
}

/** The most-watched clips of all time. */
function Moments({ d, c }: { d: Data; c: Career }) {
  const [shown, setShown] = useState(5);
  const named = (g: string) => (g ? d.games[g]?.[0] ?? t('Unknown game') : t('No category'));
  const len = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  return (
    <section class="card tw-list sr-moments">
      <h3 class="chart-title">{t('Biggest moments')}</h3>
      <p class="chart-sub">{t('Their most-watched clips of all time')}</p>
      <ol>
        {c.clips.slice(0, shown).map((x, i) => (
          <li style={{ '--k': Math.min(i, 12) }}>
            <a class="sr-clip" href={`https://www.twitch.tv/${d.login}/clip/${x.slug}`} target="_blank" rel="noopener">
              <span class="sr-thumb">
                {x.thumb && <img src={x.thumb} alt="" width={96} height={54} loading="lazy" />}
                <em>{i + 1}</em>
                {x.secs > 0 && <small>{len(x.secs)}</small>}
              </span>
              <span class="sr-clip-text">
                <b>{x.title || t('Untitled clip')}</b>
                <small>{named(x.game)} · {formatDate(x.at, { month: 'short', year: 'numeric' })}</small>
              </span>
              <span class="sr-clip-v"><Icon name="eye" size={14} /> {compact(x.views)}</span>
            </a>
          </li>
        ))}
      </ol>
      {c.clips.length > shown && (
        <button class="btn btn-quiet btn-s sr-more" onClick={() => setShown(shown + 10)}>{t('Show {n} more', { n: Math.min(10, c.clips.length - shown) })}</button>
      )}
    </section>
  );
}

type Metric = 'hours' | 'avg' | 'peak' | 'gained';
const METRICS: [Metric, string][] = [['hours', t('Hours')], ['avg', t('Avg viewers')], ['peak', t('Peak')], ['gained', t('Followers')]];

/** Everything known of the channel, a month (or a week) at a time, one measure at a time. */
function OverTime({ d, colorOf, colors }: { d: Data; colorOf: (g: string) => string; colors: Map<string, string> }) {
  const o = useMemo(() => overTime(d), [d]);
  return o && o.periods.length >= 2 ? <OverTimeChart d={d} o={o} colorOf={colorOf} colors={colors} /> : null;
}

function OverTimeChart({ d, o, colorOf, colors }: { d: Data; o: NonNullable<ReturnType<typeof overTime>>; colorOf: (g: string) => string; colors: Map<string, string> }) {
  const [metric, setMetric] = useState<Metric>('hours');
  const [ref, W] = useWidth();
  const ps = o.periods;
  const label = (p: Period) => (o.monthly ? formatDate(p.start, { month: 'short', year: 'numeric' }) : t('Week of {date}', { date: day(p.start) }));
  const short = (p: Period) => (o.monthly ? formatDate(p.start, { month: 'short' }) : day(p.start));
  const value = (p: Period) => (metric === 'hours' ? p.ms / 3_600_000 : p[metric]);
  const vals = ps.map(value);
  const known = vals.filter((v): v is number => v !== null);
  const named = (g: string) => (g ? d.games[g]?.[0] ?? t('Unknown game') : t('No category'));
  const fmt = (v: number) => (metric === 'hours' ? hours(v * 3_600_000) : metric === 'gained' ? signed(v) : num(v));

  const H = 190, L = 44, R = 4, T = 10, B = 22;
  const pw = Math.max(0, W - L - R), ph = H - T - B;
  const hi = Math.max(metric === 'gained' ? 0 : 1, ...known), lo = Math.min(0, ...known);
  const y = (v: number) => T + ((hi - v) / (hi - lo || 1)) * ph;
  const band = pw / ps.length;
  const bw = Math.max(3, Math.min(24, band - 4));
  const ticks = ps.length > 1 ? [0, Math.floor((ps.length - 1) / 2), ps.length - 1] : [0];
  const since = formatDate(o.from, { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <ChartCard
      wide
      title={t('Channel performance over time')}
      sub={o.monthly ? t('Each month since {date}', { date: since }) : t('Each week since {date}', { date: since })}
      table={{
        head: [o.monthly ? t('Month') : t('Week'), t('Hours'), t('Streams'), t('Avg viewers'), t('Peak'), t('Followers gained'), t('Rank')],
        rows: ps.map((p) => [label(p), p.ms ? hours(p.ms) : '—', p.streams || '—', p.avg !== null ? num(p.avg) : '—', p.peak !== null ? num(p.peak) : '—',
          p.gained !== null ? signed(p.gained) : '—', p.rank !== null ? `#${num(p.rank)}` : '—']).reverse(),
      }}
    >
      <div class="seg tabs compact sr-metric" role="tablist" aria-label={t('Measure')} style={{ '--at': METRICS.findIndex((m) => m[0] === metric), '--tabs': METRICS.length }}>
        {METRICS.map(([id, name]) => <button role="tab" aria-selected={id === metric} onClick={() => setMetric(id)}>{name}</button>)}
      </div>
      <div ref={ref} class="chart">
        {W > 0 && (known.length ? (
          <svg width={W} height={H} role="img" aria-label={t('Channel performance over time')}>
            {[hi, (hi + lo) / 2, lo].map((v) => (
              <>
                <line x1={L} x2={L + pw} y1={y(v)} y2={y(v)} class="grid" />
                <text x={L - 6} y={y(v) + 4} class="tick" text-anchor="end">{metric === 'hours' ? Math.round(v) : compact(Math.round(v))}</text>
              </>
            ))}
            {ps.map((p, i) => {
              const v = vals[i];
              const x = L + i * band + (band - bw) / 2;
              const parts = metric === 'hours' ? [...p.games].sort((a, b) => b[1] - a[1]) : [];
              let base = 0;
              return (
                <g class="sr-col" style={{ '--k': i }} {...tipProps(() => (
                  <>
                    <div class="tip-title">{label(p)}</div>
                    <TipRow value={p.ms ? hours(p.ms) : '—'} label={t('streamed')} color={metric === 'hours' ? 'var(--accent)' : undefined} />
                    <TipRow value={p.streams} label={noun(p.streams, 'stream', 'streams')} />
                    {p.avg !== null && <TipRow value={num(p.avg)} label={t('average viewers')} color={metric === 'avg' ? 'var(--accent)' : undefined} />}
                    {p.peak !== null && <TipRow value={num(p.peak)} label={t('at the peak')} color={metric === 'peak' ? 'var(--accent)' : undefined} />}
                    {p.gained !== null && <TipRow value={signed(p.gained)} label={t('followers')} color={metric === 'gained' ? 'var(--accent)' : undefined} />}
                    {p.rank !== null && <TipRow value={`#${num(p.rank)}`} label={t('rank')} />}
                  </>
                ), `${label(p)}: ${v !== null ? fmt(v) : '—'}`)}>
                  <rect x={L + i * band} y={T} width={band} height={ph} fill="transparent" />
                  {metric === 'hours'
                    ? parts.map(([g, ms], j) => {
                        const h0 = base, h1 = base + ms / 3_600_000;
                        base = h1;
                        const yTop = y(h1), yBot = y(h0) - (j ? 2 : 0);
                        if (yBot - yTop < 0.75) return null;
                        const r = j === parts.length - 1 ? Math.min(4, bw / 2, yBot - yTop) : 0;
                        return <path d={`M${x},${yBot}V${yTop + r}Q${x},${yTop} ${x + r},${yTop}H${x + bw - r}Q${x + bw},${yTop} ${x + bw},${yTop + r}V${yBot}Z`} fill={colorOf(g)} />;
                      })
                    : v !== null && Math.abs(y(v) - y(0)) > 0.75 && (
                        <path d={barPath(x, bw, y(0), y(v))} class={v < 0 ? 'sr-vbar down' : 'sr-vbar'} />
                      )}
                </g>
              );
            })}
            {lo < 0 && <line x1={L} x2={L + pw} y1={y(0)} y2={y(0)} class="sr-zero" />}
            {ticks.map((i) => (
              <text x={L + i * band + band / 2} y={H - 6} class="tick" text-anchor={i === 0 && ps.length > 1 ? 'start' : i === ps.length - 1 && ps.length > 1 ? 'end' : 'middle'}>{short(ps[i])}</text>
            ))}
          </svg>
        ) : (
          <p class="empty-note sr-empty-chart">{metric === 'gained' ? t('Follower counts are kept here from {date}.', { date: d.recordingSince ? day(d.recordingSince) : '—' }) : t('Viewers are recorded here from {date}.', { date: d.recordingSince ? day(d.recordingSince) : '—' })}</p>
        ))}
      </div>
      {metric === 'hours' && (
        <div class="legend">
          {[...colors.keys()].filter((g) => ps.some((p) => p.games.has(g))).map((g) => <LegendItem color={colorOf(g)} label={named(g)} />)}
        </div>
      )}
      <p class="sr-small">{t('Twitch keeps past streams for 60 days; everything since is kept on this server, so this fills in month by month.')}</p>
    </ChartCard>
  );
}

/** The range at a glance: the four big numbers set against the range before, then how the streams run. */
function Summary({ d, a, days, rangeId, onRange, range }: { d: Data; a: Analysis; days: number | null; rangeId: string; onRange: (id: string) => void; range: string }) {
  const s = d.summary;
  const cur = useMemo(() => sums(d, a.from, d.now), [d, a.from]);
  const prev = useMemo(() => (days ? sums(d, a.from - days * DAY, a.from) : null), [d, a.from, days]);
  // TwitchTracker's month covers the 30-day range better than what's been recorded here so far
  const tt = days === 30 && s;
  const avg = tt && s.avg !== null ? s.avg : cur.avg;
  const peak = tt && s.peak !== null ? s.peak : cur.peak;
  const gained = tt && s.followers !== null ? s.followers : cur.gained;
  const change = (now: number | null, then: number | null, ok: boolean) => (ok && now !== null && then ? (now - then) / then : null);
  const vs = days ? t('vs the {n} days before', { n: days }) : '';
  const recordedBoth = !!prev?.recorded && !tt;
  return (
    <section class="card sr-summary">
      <header class="sr-summary-head">
        <div>
          <h3 class="chart-title">{t('Performance summary')}</h3>
          <p class="chart-sub">{days ? t('Streamed in the last {n} days', { n: days }) : t('Streamed since {date}', { date: day(a.from) })}</p>
        </div>
        <div class="seg tabs compact sr-range" role="tablist" aria-label={t('Time range')} style={{ '--at': RANGES.findIndex((r) => r[0] === rangeId), '--tabs': RANGES.length }}>
          {RANGES.map(([id, name]) => <button role="tab" aria-selected={id === rangeId} onClick={() => onRange(id)}>{name}</button>)}
        </div>
      </header>
      {!a.count ? (
        <p class="sr-small">{t('No streams in {range}. Try a longer range.', { range })}</p>
      ) : (
        <>
          <div class="sr-kpis">
            <Kpi k={0} label={t('Hours streamed')} value={<CountUp value={Math.round(a.total / 3_600_000)} />} delta={change(a.total, prev?.ms ?? null, !!prev?.whole)} vs={vs} />
            <Kpi k={1} label={t('Average viewers')} value={avg !== null ? <CountUp value={avg} /> : '—'} delta={change(cur.avg, prev?.avg ?? null, recordedBoth)} vs={vs} foot={tt && s.avg !== null ? t('TwitchTracker') : cur.avg !== null ? t('recorded here') : t('not recorded yet')} />
            <Kpi k={2} label={t('Peak viewers')} value={peak !== null ? <CountUp value={peak} /> : '—'} delta={change(cur.peak, prev?.peak ?? null, recordedBoth)} vs={vs} foot={tt && s.peak !== null ? t('TwitchTracker') : cur.peak !== null ? t('recorded here') : t('not recorded yet')} />
            <Kpi k={3} label={t('Followers gained')} value={gained !== null ? signed(gained) : '—'} tone={gained !== null && gained < 0 ? 'down' : undefined} foot={tt && s.followers !== null ? t('TwitchTracker') : gained !== null ? t('recorded here') : t('not recorded yet')} />
          </div>
          <div class="sr-facts">
            <Mini icon="brand-twitch" label={t('Streams')} value={String(a.count)} sub={t('{n} of {days} days live', { n: a.daysLive, days: a.span })} />
            <Mini icon="device-gamepad-2" label={t('Games')} value={String(a.games.length)} sub={a.games[0]?.name ?? ''} />
            <Mini icon="clock" label={t('Average stream')} value={hours(a.average)} sub={t('{n} a day on average', { n: hours(a.total / a.span) })} />
            <Mini icon="flame" label={t('Longest stream')} value={a.longest ? hours(a.longest.end - a.longest.start) : '—'} sub={a.longest ? day(a.longest.start) : ''} />
            <Mini icon="sunrise" label={t('Usually goes live')} value={a.starts !== null ? clock(a.starts) : '—'} sub={a.ends !== null ? t('until about {time}', { time: clock(a.ends) }) : t('no set time')} />
            {a.viewers && <Mini icon="eye" label={t('Hours watched')} value={compact(a.viewers.hoursWatched)} sub={t('over {n} recorded', { n: count(a.viewers.streams, 'stream', 'streams') })} />}
          </div>
        </>
      )}
    </section>
  );
}

function Kpi({ label, value, delta, vs, foot, tone, k }: { label: string; value: ComponentChildren; delta?: number | null; vs?: string; foot?: string; tone?: 'down'; k: number }) {
  const pct = delta != null ? Math.round(delta * 100) : null;
  return (
    <div class="sr-kpi" style={{ '--k': k }}>
      <small>{label}</small>
      <b class={tone}>{value}</b>
      <span>
        {pct !== null && <em class={pct > 0 ? 'up' : pct < 0 ? 'down' : ''} title={vs}>{pct > 0 ? '▲' : pct < 0 ? '▼' : ''} {Math.abs(pct)}%</em>}
        {foot ?? (pct !== null ? vs : '')}
      </span>
    </div>
  );
}

function Mini({ icon, label, value, sub }: { icon: UiName; label: string; value: string; sub: string }) {
  return (
    <div class="sr-mini">
      <span class="tile-ico"><Icon name={icon} size={14} stroke={2} /></span>
      <span class="sr-mini-text">
        <small>{label}</small>
        <b>{value}</b>
        <span>{sub}</span>
      </span>
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
      wide
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
    <section class="card tw-list sr-streams wide">
      <h3 class="chart-title">{t('Recent streams')}</h3>
      <p class="chart-sub">{t('{n} in {range} · tap one to see its games hour by hour', { n: count(a.streams.length, 'stream', 'streams'), range: a.span <= 31 ? t('the last {n} days', { n: a.span }) : t('since {date}', { date: day(a.from) }) })}</p>
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
