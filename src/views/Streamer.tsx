import type { ComponentChildren } from 'preact';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { goBack, navigate } from '../lib/router';
import { WEEKDAYS, formatDate, keyOf, shortDate, timeLabel } from '../lib/dates';
import { age, analyse, career, clock, forget, gameColors, hours, knownFrom, overTime, sullyUrl, sums, unitFor, useChoices, useStreamer, watchedIn, type Analysis, type Career, type Choice, type GameRow, type Period, type Stream, type Streamer as Data, type Unit } from '../lib/streamer';
import { compact } from '../lib/twitch';
import { ChartCard, CountUp, LegendItem, RevealStack, TipRow, barPath, hideTip, tipProps, useWidth } from '../components/charts';
import { PageHead } from '../components/PageHead';
import { Icon, type UiName } from '../components/icons';
import { Sheet } from '../components/Sheet';
import { Sky } from '../components/Sky';
import { LOCALE, count, noun, t } from '../lib/i18n';
import '../styles/stats.css';
import '../styles/twitch.css';
import '../styles/streamer.css';

const MIN = 60_000;
const HOUR = 3_600_000;
const DAY = 86_400_000;
/** [id, tab, name, the range in a sentence, the range before it, days] */
const RANGES: [string, string, string, string, string, number | null][] = [
  ['7', t('7D'), t('7 days'), t('the last 7 days'), t('vs the 7 days before'), 7],
  ['30', t('1M'), t('30 days'), t('the last 30 days'), t('vs the 30 days before'), 30],
  ['90', t('3M'), t('3 months'), t('the last 3 months'), t('vs the 3 months before'), 90],
  ['180', t('6M'), t('6 months'), t('the last 6 months'), t('vs the 6 months before'), 180],
  ['365', t('1Y'), t('1 year'), t('the last year'), t('vs the year before'), 365],
  ['1095', t('3Y'), t('3 years'), t('the last 3 years'), t('vs the 3 years before'), 1095],
  ['all', t('All'), t('All time'), '', '', null],
];
const OTHER = 'color-mix(in oklab, var(--ink-3) 55%, var(--surface))';

const num = (n: number) => n.toLocaleString(LOCALE);
const signed = (n: number) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${num(Math.abs(n))}`;
const day = (ms: number) => shortDate(keyOf(new Date(ms)));
const longDay = (ms: number) => formatDate(ms, { weekday: 'long', day: 'numeric', month: 'long' });
const fullDay = (ms: number) => formatDate(ms, { day: 'numeric', month: 'short', year: 'numeric' });
/** viewer-ms as hours watched, short */
const watchedH = (ms: number) => compact(Math.round(ms / HOUR));

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
        <Report key={shown.login} d={shown} rangeId={rangeId} onRange={(id) => go(login, id)} stale={loading} />
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

type Range = (typeof RANGES)[number];

function Report({ d, rangeId, onRange, stale }: { d: Data; rangeId: string; onRange: (id: string) => void; stale: boolean }) {
  const r = RANGES.find((x) => x[0] === rangeId)!;
  const days = r[5];
  const a = useMemo(() => analyse(d, days), [d, days]);
  const c = useMemo(() => career(d), [d]);
  const colors = useMemo(() => gameColors(d.streams, d.clips ?? []), [d]);
  const [open, setOpen] = useState<Stream | null>(null);
  const colorOf = (g: string) => (colors.has(g) ? `var(--emo-${colors.get(g)})` : OTHER);
  const range = days ? r[3] : t('since {date}', { date: day(a.from) });

  return (
    <div class={stale ? 'sr-stale' : ''}>
      <RevealStack>
        <Banner d={d} />
        <RangeBar d={d} r={r} from={a.from} onRange={onRange} />

        <OverTime key={`${rangeId}-${a.from}`} d={d} from={a.from} colorOf={colorOf} colors={colors} />

        {!d.streams.length ? (
          <section class="card sr-note">
            <p>{d.vodsMissing ? t('Twitch didn’t list this channel’s past streams just now. Try again in a minute.') : t('No past streams to read: this channel keeps no VODs.')}</p>
            {d.recordingSince && <p>{t('Streams are recorded here from now on, every 5 minutes while it’s live.')}</p>}
          </section>
        ) : (
          <Summary d={d} a={a} r={r} range={range} />
        )}

        {a.count > 0 && (
          <>
            <Games d={d} a={a} colorOf={colorOf} range={range} />
            <When a={a} />
          </>
        )}

        <Audience d={d} a={a} />
        <Followers d={d} from={a.from} />
        {d.streams.length > 0 && a.count > 0 && <Streams d={d} a={a} colorOf={colorOf} onOpen={setOpen} />}

        {c.clips.length > 0 && (
          <>
            <h2 class="sr-section wide">{t('Clips')}</h2>
            <CareerChart d={d} c={c} colorOf={colorOf} colors={colors} />
            <Eras d={d} c={c} colorOf={colorOf} />
            <Moments d={d} c={c} />
          </>
        )}

        <p class="sr-source">
          {t('From Twitch: the channel, its past broadcasts with their chapters and views (Twitch keeps them up to 60 days) and its 100 most-watched clips; TwitchTracker’s last 30 days; and what this server records every 5 minutes, kept for good. SullyGnome has every stream back to 2015 but asks not to be scraped, so it’s linked, not copied. Times are yours.')}
        </p>
      </RevealStack>
      <StreamSheet d={d} s={open} colorOf={colorOf} onClose={() => setOpen(null)} />
    </div>
  );
}

/** Who it is, and what the last month of it came to, hours first. */
function Banner({ d }: { d: Data }) {
  const role = d.partner ? t('Partner') : d.affiliate ? t('Affiliate') : null;
  const s = d.summary;
  const month = useMemo(() => sums(d, d.now - 30 * DAY, d.now), [d]);
  const gained = s?.followers ?? null;
  const streamedMs = s?.minutes != null ? s.minutes * MIN : month.ms;
  const watched = s?.hoursWatched ?? month.watched;
  const avg = s?.avg ?? month.avg;
  const peak = s?.peak ?? month.peak;
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
        {watched !== null && <Life label={t('Hours watched')} value={compact(watched)} sub={s?.hoursWatched != null ? t('in 30 days') : t('in 30 days, recorded here')} />}
        <Life label={t('Hours streamed')} value={hours(streamedMs)} sub={t('in 30 days')} />
        {avg !== null && <Life label={t('Average viewers')} value={num(avg)} sub={peak !== null ? t('{n} at the peak', { n: num(peak) }) : t('in 30 days')} />}
        {d.followers !== null && (
          <Life label={t('Followers')} value={compact(d.followers)}
            sub={gained ? <span class={gained > 0 ? 'up' : 'down'}>{gained > 0 ? '+' : '−'}{num(Math.abs(gained))} {t('in 30 days')}</span> : null} />
        )}
        {s?.rank != null && <Life label={t('Rank on Twitch')} value={`#${num(s.rank)}`} sub={t('over the last 30 days')} />}
        {d.createdAt && <Life label={t('On Twitch')} value={age(d.createdAt, d.now)} sub={t('since {date}', { date: fullDay(d.createdAt) })} />}
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

/** The range every card below reads: a week up to all time, and the same stretch on SullyGnome. */
function RangeBar({ d, r, from, onRange }: { d: Data; r: Range; from: number; onRange: (id: string) => void }) {
  return (
    <section class="card sr-rangebar wide">
      <div class="seg tabs compact sr-range" role="tablist" aria-label={t('Time range')} style={{ '--at': RANGES.indexOf(r), '--tabs': RANGES.length }}>
        {RANGES.map(([id, tab, name]) => <button role="tab" aria-selected={id === r[0]} aria-label={name} title={name} onClick={() => onRange(id)}>{tab}</button>)}
      </div>
      <p class="sr-range-text">
        <span>{r[5] ? t('{from} – today', { from: fullDay(from) }) : t('Everything known, since {date}', { date: fullDay(from) })}</span>
        <a class="sr-sully" href={sullyUrl(d.login, r[5] ? from : d.now - 365 * DAY, d.now, d.now)} target="_blank" rel="noopener">
          {t('On SullyGnome')} <Icon name="external-link" size={14} />
        </a>
      </p>
    </section>
  );
}

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
      title={t('Most-clipped years')}
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
      <h3 class="chart-title">{t('Games in their top clips')}</h3>
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
      <h3 class="chart-title">{t('Biggest clips')}</h3>
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

type Metric = 'hours' | 'watched' | 'avg' | 'peak' | 'streams' | 'views' | 'gained';
const METRICS: [Metric, string][] = [
  ['hours', t('Hours streamed')], ['watched', t('Hours watched')], ['avg', t('Avg viewers')], ['peak', t('Peak viewers')],
  ['streams', t('Streams')], ['views', t('VOD views')], ['gained', t('Followers gained')],
];
/** the closest a zoom goes */
const MIN_SPAN = 2 * DAY;

/** Everything known in the range, a day, week or month at a time, one measure at a time, to zoom into and pan along. */
function OverTime({ d, from, colorOf, colors }: { d: Data; from: number; colorOf: (g: string) => string; colors: Map<string, string> }) {
  const to = d.now;
  const [metric, setMetric] = useState<Metric>('hours');
  const [view, setView] = useState<[number, number]>([from, to]);
  const [a, b] = view;
  const unit = unitFor(b - a);
  const ps = useMemo(() => overTime(d, a, b, unit), [d, a, b, unit]);
  const known = useMemo(() => knownFrom(d), [d]);
  const whole = b - a >= to - from - 1;

  /** A stretch kept inside the range and no shorter than MIN_SPAN, its middle kept where it can be. */
  const fit = (na: number, nb: number): [number, number] => {
    const full = to - from;
    const span = Math.min(full, Math.max(Math.min(MIN_SPAN, full), nb - na));
    const start = Math.max(from, Math.min((na + nb) / 2 - span / 2, to - span));
    return [start, start + span];
  };
  const zoom = (k: number, at = (a + b) / 2) => setView(fit(at - (at - a) * k, at + (b - at) * k));
  const pan = (k: number) => setView(fit(a + (b - a) * k, b + (b - a) * k));

  const named = (g: string) => (g ? d.games[g]?.[0] ?? t('Unknown game') : t('No category'));
  const label = (p: Period) =>
    unit === 'month' ? formatDate(p.start, { month: 'long', year: 'numeric' }) : unit === 'week' ? t('Week of {date}', { date: day(p.start) }) : longDay(p.start);
  const value = (p: Period) => (metric === 'hours' ? p.ms / HOUR : metric === 'streams' ? p.streams : p[metric]);
  const fmt = (v: number) =>
    metric === 'hours' ? hours(v * HOUR) : metric === 'gained' ? signed(v) : metric === 'watched' || metric === 'views' ? compact(v) : num(v);
  const shown = ps.filter((p) => p.end > a && p.start < b);
  const known_ = shown.map(value).filter((v): v is number => v !== null);
  const units = { day: t('Each day'), week: t('Each week'), month: t('Each month') };

  return (
    <ChartCard
      wide
      title={t('Channel performance over time')}
      sub={`${units[unit]} · ${day(a)} – ${day(b)}`}
      table={{
        head: [unit === 'month' ? t('Month') : unit === 'week' ? t('Week') : t('Day'), t('Hours'), t('Streams'), t('Hours watched'), t('Avg viewers'), t('Peak'), t('VOD views'), t('Followers gained'), t('Rank')],
        rows: shown.map((p) => [label(p), p.ms ? hours(p.ms) : '—', p.streams || '—', p.watched !== null ? num(p.watched) : '—', p.avg !== null ? num(p.avg) : '—',
          p.peak !== null ? num(p.peak) : '—', p.views !== null ? num(p.views) : '—', p.gained !== null ? signed(p.gained) : '—', p.rank !== null ? `#${num(p.rank)}` : '—']).reverse(),
      }}
    >
      <div class="chips sr-metric scroll-x" role="tablist" aria-label={t('Measure')}>
        {METRICS.map(([id, name]) => <button class="chip" role="tab" aria-selected={id === metric} aria-pressed={id === metric} onClick={() => setMetric(id)}>{name}</button>)}
      </div>
      <div class="sr-zoombar">
        <span class="sr-zoom-hint">{whole ? t('Drag across the chart to zoom in') : t('{a} – {b}', { a: fullDay(a), b: fullDay(b) })}</span>
        <span class="sr-zoom-btns">
          <button class="icon-btn small" onClick={() => pan(-0.5)} disabled={a <= from} aria-label={t('Earlier')} title={t('Earlier')}><Icon name="chevron-left" size={18} /></button>
          <button class="icon-btn small" onClick={() => pan(0.5)} disabled={b >= to} aria-label={t('Later')} title={t('Later')}><Icon name="chevron-right" size={18} /></button>
          <button class="icon-btn small" onClick={() => zoom(2)} disabled={whole} aria-label={t('Zoom out')} title={t('Zoom out')}><Icon name="zoom-out" size={18} /></button>
          <button class="icon-btn small" onClick={() => zoom(0.5)} disabled={b - a <= MIN_SPAN} aria-label={t('Zoom in')} title={t('Zoom in')}><Icon name="zoom-in" size={18} /></button>
          <button class="icon-btn small" onClick={() => setView([from, to])} disabled={whole} aria-label={t('Show the whole range')} title={t('Show the whole range')}><Icon name="arrow-back-up" size={18} /></button>
        </span>
      </div>
      <ZoomPlot view={view} unit={unit} ps={ps} metric={metric} value={value} fmt={fmt} label={label} known={known}
        colorOf={colorOf} named={named} onView={(na, nb) => setView(fit(na, nb))} onZoom={zoom} onReset={() => setView([from, to])} empty={!known_.length} />
      {!whole && <Overview d={d} from={from} to={to} view={view} onView={(na, nb) => setView(fit(na, nb))} />}
      {metric === 'hours' && (
        <div class="legend">
          {[...colors.keys()].filter((g) => shown.some((p) => p.games.has(g))).map((g) => <LegendItem color={colorOf(g)} label={named(g)} />)}
        </div>
      )}
      <p class="sr-small">
        {known !== null && a < known
          ? t('Nothing is known here before {date}: Twitch keeps past streams for 60 days, and this server keeps everything since.', { date: fullDay(known) }) + ' '
          : ''}
        <a class="sr-sully" href={sullyUrl(d.login, a, b, d.now)} target="_blank" rel="noopener">{t('This stretch on SullyGnome')} <Icon name="external-link" size={14} /></a>
      </p>
    </ChartCard>
  );
}

/**
 * The bars, laid out by time so they move with the zoom: drag across to zoom into a stretch, pinch or Ctrl+scroll to
 * zoom around a point, scroll sideways to pan, double-click to see the whole range again.
 */
function ZoomPlot({ view, unit, ps, metric, value, fmt, label, known, colorOf, named, onView, onZoom, onReset, empty }: {
  view: [number, number]; unit: Unit; ps: Period[]; metric: Metric; value: (p: Period) => number | null; fmt: (v: number) => string; label: (p: Period) => string;
  known: number | null; colorOf: (g: string) => string; named: (g: string) => string; onView: (a: number, b: number) => void;
  onZoom: (k: number, at: number) => void; onReset: () => void; empty: boolean;
}) {
  const [ref, W] = useWidth();
  const [a, b] = view;
  const H = 230, L = 46, R = 6, T = 10, B = 22;
  const pw = Math.max(0, W - L - R), ph = H - T - B;
  const x = (ms: number) => L + ((ms - a) / (b - a)) * pw;
  const msAt = (px: number) => a + ((px - L) / (pw || 1)) * (b - a);
  const clip = useMemo(() => `sr-clip-${Math.random().toString(36).slice(2)}`, []);

  const vals = ps.map(value);
  const inView = vals.filter((v, i): v is number => v !== null && ps[i].end > a && ps[i].start < b);
  const hi = Math.max(metric === 'gained' ? 0 : 1, ...inView), lo = Math.min(0, ...inView);
  const y = (v: number) => T + ((hi - v) / (hi - lo || 1)) * ph;

  // what a drag or a pinch is doing
  const gesture = useRef<{ pts: Map<number, number>; x0: number; brushing: boolean; pinch: { d0: number; at: number; span: number } | null }>({ pts: new Map(), x0: 0, brushing: false, pinch: null });
  const [brush, setBrush] = useState<[number, number] | null>(null);
  const px = (e: MouseEvent) => e.clientX - (ref.current?.getBoundingClientRect().left ?? 0);
  const down = (e: PointerEvent) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    const g = gesture.current;
    g.pts.set(e.pointerId, px(e));
    if (g.pts.size === 2) {
      const [p, q] = [...g.pts.values()];
      g.pinch = { d0: Math.max(10, Math.abs(p - q)), at: msAt((p + q) / 2), span: b - a };
      g.brushing = false;
      setBrush(null);
      ref.current?.setPointerCapture(e.pointerId);
    } else if (g.pts.size === 1) {
      g.x0 = px(e);
      g.brushing = false;
      g.pinch = null;
    }
  };
  const move = (e: PointerEvent) => {
    const g = gesture.current;
    if (!g.pts.has(e.pointerId)) return;
    const at = px(e);
    g.pts.set(e.pointerId, at);
    if (g.pinch && g.pts.size === 2) {
      const [p, q] = [...g.pts.values()];
      const span = g.pinch.span * (g.pinch.d0 / Math.max(10, Math.abs(p - q)));
      const start = g.pinch.at - (((p + q) / 2 - L) / (pw || 1)) * span;
      onView(start, start + span);
      return;
    }
    if (!g.brushing && Math.abs(at - g.x0) > 6) {
      g.brushing = true;
      hideTip();
      ref.current?.setPointerCapture(e.pointerId);
    }
    if (g.brushing) setBrush([g.x0, at]);
  };
  const up = (e: PointerEvent) => {
    const g = gesture.current;
    if (!g.pts.delete(e.pointerId)) return;
    if (g.brushing) {
      const end = px(e);
      const l = Math.max(L, Math.min(g.x0, end)), r = Math.min(L + pw, Math.max(g.x0, end));
      if (r - l > 8) onView(msAt(l), msAt(r));
    }
    if (!g.pts.size) g.pinch = null;
    g.brushing = false;
    setBrush(null);
  };

  // the wheel: Ctrl (and a trackpad's pinch, which comes as Ctrl) zooms, sideways pans, plain scrolling scrolls the page
  const wheel = useRef<(e: WheelEvent) => void>(() => {});
  wheel.current = (e) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      onZoom(Math.exp(Math.max(-1, Math.min(1, e.deltaY * 0.01))), msAt(px(e)));
    } else if (Math.abs(e.deltaX) > Math.abs(e.deltaY) * 1.5) {
      e.preventDefault();
      const k = (e.deltaX / (pw || 1)) * (b - a);
      onView(a + k, b + k);
    }
  };
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const f = (e: WheelEvent) => wheel.current(e);
    el.addEventListener('wheel', f, { passive: false });
    return () => el.removeEventListener('wheel', f);
  }, []);

  // ticks on whole days, weeks or months, about 90px apart
  const starts = ps.map((p) => p.start).filter((ms) => ms >= a && ms <= b);
  const every = Math.max(1, Math.ceil(starts.length / Math.max(2, Math.floor(pw / 90))));
  // the stretch before anything is known, shaded
  const knownX = known === null ? L + pw : Math.min(L + pw, Math.max(L, x(known)));
  const tick = (ms: number) => (unit === 'month' ? formatDate(ms, { month: 'short', year: '2-digit' }) : day(ms));
  const gap = (p: Period) => Math.min(4, (x(p.end) - x(p.start)) * 0.2);

  return (
    <div ref={ref} class="chart sr-zoom" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onDblClick={onReset}>
      {W > 0 && (
        <svg width={W} height={H} role="img" aria-label={t('Channel performance over time')}>
          <defs><clipPath id={clip}><rect x={L} y={0} width={pw} height={H} /></clipPath></defs>
          {[hi, (hi + lo) / 2, lo].map((v) => (
            <>
              <line x1={L} x2={L + pw} y1={y(v)} y2={y(v)} class="grid" />
              <text x={L - 6} y={y(v) + 4} class="tick" text-anchor="end">{metric === 'hours' ? Math.round(v) : compact(Math.round(v))}</text>
            </>
          ))}
          <g clip-path={`url(#${clip})`}>
            {knownX > L && <rect x={L} y={T} width={knownX - L} height={ph} class="sr-before" />}
            {ps.map((p, i) => {
              const v = vals[i];
              const x0 = x(p.start) + gap(p) / 2, w = Math.max(1, x(p.end) - x(p.start) - gap(p));
              const parts = metric === 'hours' ? [...p.games].sort((m, n) => n[1] - m[1]) : [];
              const r = Math.min(4, w / 2);
              let base = 0;
              return (
                <g class="sr-col" style={{ '--k': Math.min(i, 60) }} {...tipProps(() => (
                  <>
                    <div class="tip-title">{label(p)}</div>
                    <TipRow value={p.ms ? hours(p.ms) : '—'} label={t('streamed')} color={metric === 'hours' ? 'var(--accent)' : undefined} />
                    <TipRow value={p.streams} label={noun(p.streams, 'stream', 'streams')} color={metric === 'streams' ? 'var(--accent)' : undefined} />
                    {p.watched !== null && <TipRow value={compact(p.watched)} label={t('hours watched')} color={metric === 'watched' ? 'var(--accent)' : undefined} />}
                    {p.avg !== null && <TipRow value={num(p.avg)} label={t('average viewers')} color={metric === 'avg' ? 'var(--accent)' : undefined} />}
                    {p.peak !== null && <TipRow value={num(p.peak)} label={t('at the peak')} color={metric === 'peak' ? 'var(--accent)' : undefined} />}
                    {p.views !== null && <TipRow value={compact(p.views)} label={t('VOD views')} color={metric === 'views' ? 'var(--accent)' : undefined} />}
                    {p.gained !== null && <TipRow value={signed(p.gained)} label={t('followers')} color={metric === 'gained' ? 'var(--accent)' : undefined} />}
                    {p.rank !== null && <TipRow value={`#${num(p.rank)}`} label={t('rank')} />}
                    {metric === 'hours' && [...p.games].sort((m, n) => n[1] - m[1]).slice(0, 4).map(([g, ms]) => <TipRow value={hours(ms)} label={named(g)} color={colorOf(g)} />)}
                  </>
                ), `${label(p)}: ${v !== null ? fmt(v) : '—'}`)}>
                  <rect x={x(p.start)} y={T} width={Math.max(1, x(p.end) - x(p.start))} height={ph} fill="transparent" />
                  {metric === 'hours'
                    ? parts.map(([g, ms], j) => {
                        const h0 = base, h1 = base + ms / HOUR;
                        base = h1;
                        const yTop = y(h1), yBot = y(h0) - (j && w > 3 ? 1.5 : 0);
                        if (yBot - yTop < 0.75) return null;
                        const rr = j === parts.length - 1 ? Math.min(r, yBot - yTop) : 0;
                        return <path d={`M${x0},${yBot}V${yTop + rr}Q${x0},${yTop} ${x0 + rr},${yTop}H${x0 + w - rr}Q${x0 + w},${yTop} ${x0 + w},${yTop + rr}V${yBot}Z`} fill={colorOf(g)} />;
                      })
                    : v !== null && Math.abs(y(v) - y(0)) > 0.75 && <path d={barPath(x0, w, y(0), y(v))} class={v < 0 ? 'sr-vbar down' : 'sr-vbar'} />}
                </g>
              );
            })}
            {brush && <rect x={Math.max(L, Math.min(...brush))} y={T} width={Math.min(L + pw, Math.max(...brush)) - Math.max(L, Math.min(...brush))} height={ph} class="sr-brush" />}
          </g>
          {lo < 0 && <line x1={L} x2={L + pw} y1={y(0)} y2={y(0)} class="sr-zero" />}
          {empty && <text x={L + pw / 2} y={T + ph / 2} class="tick" text-anchor="middle">{t('Nothing known for this in this stretch')}</text>}
          {starts.map((ms, i) => {
            if (i % every) return null;
            const tx = unit === 'month' ? x(ms) : x(ms + DAY / 2);
            if (tx < L - 1 || tx > L + pw + 1) return null;
            return <text x={tx} y={H - 6} class="tick" text-anchor={tx < L + 24 ? 'start' : tx > L + pw - 24 ? 'end' : 'middle'}>{tick(ms)}</text>;
          })}
        </svg>
      )}
    </div>
  );
}

/** The whole range in miniature with the zoomed stretch picked out: drag it along, or tap to jump there. */
function Overview({ d, from, to, view, onView }: { d: Data; from: number; to: number; view: [number, number]; onView: (a: number, b: number) => void }) {
  const [ref, W] = useWidth();
  const ps = useMemo(() => overTime(d, from, to, unitFor(to - from)), [d, from, to]);
  const H = 34, L = 46, R = 6;
  const pw = Math.max(0, W - L - R);
  const x = (ms: number) => L + ((ms - from) / (to - from)) * pw;
  const msAt = (px: number) => from + ((px - L) / (pw || 1)) * (to - from);
  const max = Math.max(1, ...ps.map((p) => p.ms));
  const [a, b] = view;
  const grab = useRef<number | null>(null);
  const at = (e: PointerEvent) => msAt(e.clientX - (ref.current?.getBoundingClientRect().left ?? 0));
  const down = (e: PointerEvent) => {
    const ms = at(e);
    // inside the window it's held where it was taken; outside, the window jumps to centre there
    grab.current = ms >= a && ms <= b ? ms - a : (b - a) / 2;
    ref.current?.setPointerCapture(e.pointerId);
    if (!(ms >= a && ms <= b)) onView(ms - grab.current, ms - grab.current + (b - a));
  };
  const move = (e: PointerEvent) => {
    if (grab.current === null) return;
    const start = at(e) - grab.current;
    onView(start, start + (b - a));
  };
  const up = () => void (grab.current = null);
  return (
    <div ref={ref} class="sr-overview" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} aria-hidden="true">
      {W > 0 && (
        <svg width={W} height={H}>
          {ps.map((p) => {
            const h = (p.ms / max) * (H - 6);
            return h > 0.5 && <rect x={x(Math.max(from, p.start)) + 0.5} y={H - 3 - h} width={Math.max(1, x(Math.min(to, p.end)) - x(Math.max(from, p.start)) - 1)} height={h} class="sr-ov-bar" />;
          })}
          <rect x={x(a)} y={1} width={Math.max(4, x(b) - x(a))} height={H - 2} rx={5} class="sr-ov-win" />
          <text x={L - 6} y={H / 2 + 4} class="tick" text-anchor="end">{t('All')}</text>
        </svg>
      )}
    </div>
  );
}

/** The range at a glance: six big numbers set against the range before, then how the streams run. */
function Summary({ d, a, r, range }: { d: Data; a: Analysis; r: Range; range: string }) {
  const days = r[5];
  const s = d.summary;
  const cur = useMemo(() => sums(d, a.from, d.now), [d, a.from]);
  const prev = useMemo(() => (days ? sums(d, a.from - days * DAY, a.from) : null), [d, a.from, days]);
  // TwitchTracker's month covers the 30-day range better than what's been recorded here so far
  const tt = days === 30 && s;
  const avg = tt && s.avg !== null ? s.avg : cur.avg;
  const peak = tt && s.peak !== null ? s.peak : cur.peak;
  const gained = tt && s.followers !== null ? s.followers : cur.gained;
  const watched = tt && s.hoursWatched !== null ? s.hoursWatched : cur.watched;
  const change = (now: number | null, then: number | null, ok: boolean) => (ok && now !== null && then ? (now - then) / then : null);
  const vs = r[4];
  const recordedBoth = !!prev?.recorded && !tt;
  const source = (ttHas: boolean, mine: boolean) => (tt && ttHas ? t('TwitchTracker') : mine ? t('recorded here') : t('not recorded yet'));
  const hoursLive = a.total / HOUR;
  return (
    <section class="card sr-summary">
      <header class="sr-summary-head">
        <div>
          <h3 class="chart-title">{t('Performance summary')}</h3>
          <p class="chart-sub">{t('Streamed in {range}', { range })}</p>
        </div>
      </header>
      {!a.count ? (
        <p class="sr-small">{t('No streams in {range}. Try a longer range.', { range })}</p>
      ) : (
        <>
          <div class="sr-kpis">
            <Kpi k={0} label={t('Hours streamed')} value={<CountUp value={Math.round(hoursLive)} />} delta={change(a.total, prev?.ms ?? null, !!prev?.whole)} vs={vs} />
            <Kpi k={1} label={t('Hours watched')} value={watched !== null ? compact(watched) : '—'} delta={change(cur.watched, prev?.watched ?? null, recordedBoth)} vs={vs} foot={tt && s.hoursWatched !== null ? t('TwitchTracker') : cur.watched !== null ? t('recorded streams only') : t('not recorded yet')} />
            <Kpi k={2} label={t('Average viewers')} value={avg !== null ? <CountUp value={avg} /> : '—'} delta={change(cur.avg, prev?.avg ?? null, recordedBoth)} vs={vs} foot={source(s?.avg != null, cur.avg !== null)} />
            <Kpi k={3} label={t('Peak viewers')} value={peak !== null ? <CountUp value={peak} /> : '—'} delta={change(cur.peak, prev?.peak ?? null, recordedBoth)} vs={vs} foot={source(s?.peak != null, cur.peak !== null)} />
            <Kpi k={4} label={t('Followers gained')} value={gained !== null ? signed(gained) : '—'} tone={gained !== null && gained < 0 ? 'down' : undefined} foot={source(s?.followers != null, gained !== null)} />
            <Kpi k={5} label={t('Streams')} value={<CountUp value={a.count} />} delta={change(cur.streams, prev?.streams ?? null, !!prev?.whole)} vs={vs} />
          </div>
          <div class="sr-facts">
            <Mini icon="calendar" label={t('Days live')} value={t('{n} of {days}', { n: a.daysLive, days: a.span })} sub={a.streak > 1 ? t('{n} days in a row at most', { n: a.streak }) : t('{n} a day on average', { n: hours(a.total / a.span) })} />
            <Mini icon="device-gamepad-2" label={t('Games')} value={String(a.games.length)} sub={t('{n} a stream on average', { n: a.perStream.toFixed(1) })} />
            <Mini icon="clock" label={t('Average stream')} value={hours(a.average)} sub={t('{n} a day on average', { n: hours(a.total / a.span) })} />
            <Mini icon="flame" label={t('Longest stream')} value={a.longest ? hours(a.longest.end - a.longest.start) : '—'} sub={a.longest ? day(a.longest.start) : ''} />
            <Mini icon="hourglass" label={t('Longest break')} value={a.gap ? hours(a.gap.ms) : '—'} sub={a.gap ? `${day(a.gap.from)} – ${day(a.gap.to)}` : t('none in this range')} />
            <Mini icon="sunrise" label={t('Usually goes live')} value={a.starts !== null ? clock(a.starts) : '—'} sub={a.ends !== null ? t('until about {time}', { time: clock(a.ends) }) : t('no set time')} />
            <Mini icon="user-plus" label={t('Followers per hour live')} value={gained !== null && hoursLive >= 1 ? signed(Math.round(gained / hoursLive)) : '—'} sub={gained !== null ? t('over {n}', { n: hours(a.total) }) : t('not recorded yet')} />
            <Mini icon="player-play" label={t('VOD views')} value={a.vodViews ? compact(a.vodViews.views) : '—'} sub={a.vodViews ? t('over {n} still on Twitch', { n: count(a.vodViews.vods, 'VOD', 'VODs') }) : t('no VODs left on Twitch')} />
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

type GameSort = 'ms' | 'watched' | 'avg';
const GAME_SORTS: [GameSort, string][] = [['ms', t('Hours streamed')], ['watched', t('Hours watched')], ['avg', t('Avg viewers')]];

/** Each game with the hours it got and how many watched it, on a line across the range with a dot each time it was played. */
function Games({ d, a, colorOf, range }: { d: Data; a: Analysis; colorOf: (g: string) => string; range: string }) {
  const [all, setAll] = useState(false);
  const [by, setBy] = useState<GameSort>('ms');
  const avgOf = (g: GameRow) => (g.recMs ? g.watched / g.recMs : null);
  const key = (g: GameRow) => (by === 'ms' ? g.ms : by === 'watched' ? (g.recMs ? g.watched : -1) : avgOf(g) ?? -1);
  const sorted = useMemo(() => a.games.slice().sort((p, q) => key(q) - key(p) || q.ms - p.ms), [a, by]);
  const rows = all ? sorted : sorted.slice(0, 10);
  const max = Math.max(1, key(sorted[0]));
  const counted = a.games.some((g) => g.recMs);
  const span = Math.max(1, d.now - a.from);
  const pos = (ms: number) => `${(((ms - a.from) / span) * 100).toFixed(2)}%`;
  const longest = Math.max(1, ...a.games.flatMap((g) => g.hits.map((h) => h[1])));
  const right = (g: GameRow) => (by === 'ms' ? hours(g.ms) : by === 'watched' ? (g.recMs ? watchedH(g.watched) : '—') : avgOf(g) !== null ? num(Math.round(avgOf(g)!)) : '—');
  return (
    <section class="card tw-list sr-games wide">
      <header class="sr-games-head">
        <div>
          <h3 class="chart-title">{t('What they played')}</h3>
          <p class="chart-sub">{t('{n} in {range}', { n: count(a.games.length, 'game', 'games'), range })}</p>
        </div>
        {counted && (
          <div class="seg tabs compact" role="tablist" aria-label={t('Sort by')} style={{ '--at': GAME_SORTS.findIndex((s) => s[0] === by), '--tabs': GAME_SORTS.length }}>
            {GAME_SORTS.map(([id, name]) => <button role="tab" aria-selected={id === by} onClick={() => setBy(id)}>{name}</button>)}
          </div>
        )}
      </header>
      <ul>
        {rows.map((g, i) => {
          const avg = avgOf(g);
          return (
            <li style={{ '--k': i, '--w': `${(Math.max(0, key(g)) / max) * 100}%`, '--c': colorOf(g.id) }}>
              {g.box ? <img class="sr-box" src={g.box} alt="" width={26} height={36} loading="lazy" /> : <span class="sr-box"><Icon name="device-gamepad-2" size={14} /></span>}
              <span class="sr-game">
                <b>{g.name}</b>
                <span class="sr-game-bar"><i /></span>
                <span class="sr-track" aria-hidden="true">
                  <i class="sr-span" style={{ left: pos(g.first), width: `max(2px, calc(${pos(g.last)} - ${pos(g.first)}))` }} />
                  {g.hits.map(([at, ms]) => <i class="sr-pip" style={{ left: pos(at), '--s': (0.35 + 0.65 * Math.sqrt(ms / longest)).toFixed(2) }} />)}
                </span>
                <small>
                  {[
                    t('{share} of the time', { share: `${Math.round((g.ms / (a.total || 1)) * 100)}%` }),
                    by === 'ms' ? null : hours(g.ms),
                    count(g.streams, 'stream', 'streams'),
                    by !== 'watched' && g.recMs ? t('{n} hours watched', { n: watchedH(g.watched) }) : null,
                    by !== 'avg' && avg !== null ? t('{n} watching', { n: num(Math.round(avg)) }) : null,
                    g.first < g.last - DAY ? `${day(g.first)} – ${day(g.last)}` : day(g.first),
                  ].filter(Boolean).join(' · ')}
                </small>
              </span>
              <span class="sr-game-h">{right(g)}</span>
            </li>
          );
        })}
      </ul>
      <div class="sr-track-axis" aria-hidden="true"><span>{day(a.from)}</span><span>{day(a.from + span / 2)}</span><span>{day(d.now)}</span></div>
      {a.games.length > 10 && (
        <button class="btn btn-quiet btn-s sr-more" onClick={() => setAll(!all)}>
          {all ? t('Show fewer') : t('Show all {n}', { n: a.games.length })}
        </button>
      )}
      {counted && <p class="sr-small">{t('Hours watched and viewers count the streams recorded here, shared out along each stream’s viewer line.')}</p>}
    </section>
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
                {s.avg !== undefined ? <span class="sr-stream-v" title={t('average viewers')}><Icon name="eye" size={14} /> {num(s.avg)}</span>
                  : s.views !== undefined && <span class="sr-stream-v" title={t('VOD views')}><Icon name="player-play" size={14} /> {compact(s.views)}</span>}
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

/** Followers as recorded here day by day, over the range; shown once there are a few days of them. */
function Followers({ d, from }: { d: Data; from: number }) {
  const pts = useMemo(() => d.followerDays.filter(([at]) => at >= from - DAY), [d, from]);
  return pts.length >= 3 ? <FollowerChart pts={pts} /> : null;
}

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
        <p class="sr-small">
          {t('{avg} watching on average, {peak} at the peak', { avg: num(s.avg), peak: num(s.peak ?? s.avg) })}
          {' · '}{t('{n} hours watched', { n: watchedH(watchedIn(s, s.start, s.end) ?? 0) })}
        </p>
      )}
      {s.views !== undefined && <p class="sr-small">{t('{n} views of the VOD', { n: num(s.views) })}</p>}
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
