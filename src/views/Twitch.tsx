import { useEffect, useLayoutEffect, useMemo, useState } from 'preact/hooks';
import { goBack, navigate } from '../lib/router';
import { keyOf, shortDate } from '../lib/dates';
import { compact, loadPoints, usePoints, type Change, type Channel, type Points } from '../lib/twitch';
import { ChartCard, CountUp, RevealStack, TipRow, tipProps, useWidth } from '../components/charts';
import { Icon, type UiName } from '../components/icons';
import { Sky } from '../components/Sky';
import { ChannelsSheet } from '../components/TwitchChannels';
import { LOCALE, t } from '../lib/i18n';
import '../styles/stats.css';
import '../styles/twitch.css';

const DAY = 86_400_000;

/** Why points came or went, as the miner names it. */
const REASON: Record<string, [string, UiName]> = {
  Watch: [t('Watching'), 'player-play'],
  Claim: [t('Bonus claims'), 'gift'],
  'Watch Streak': [t('Watch streaks'), 'flame'],
  Raid: [t('Raids'), 'users'],
  'Weekly Rewards': [t('Weekly rewards'), 'calendar-event'],
  Prediction: [t('Predictions'), 'dice-5'],
  Refund: [t('Refunds'), 'refresh'],
  Spent: [t('Spent'), 'coins'],
};
const reason = (z: string): [string, UiName] => REASON[z] ?? [z, 'dots'];

const num = (n: number) => n.toLocaleString(LOCALE);
const signed = (n: number) => (n > 0 ? '+' : n < 0 ? '−' : '') + Math.abs(n).toLocaleString(LOCALE);

function ago(ms: number, now: number) {
  const s = (now - ms) / 1000;
  if (s < 90) return t('just now');
  if (s < 3600) return t('{n} min ago', { n: Math.round(s / 60) });
  if (s < 86400) return t('{n} h ago', { n: Math.round(s / 3600) });
  return shortDate(keyOf(new Date(ms)));
}

/** The page is Twitch purple; charts and tooltips read the accent from the root. */
function useAccent() {
  useLayoutEffect(() => {
    const root = document.documentElement.style;
    root.setProperty('--accent', 'var(--emo-fear)');
    return () => root.removeProperty('--accent');
  }, []);
}

export function Twitch({ query }: { query: URLSearchParams }) {
  useAccent();
  const { data, error, loading } = usePoints();
  const pick = query.get('channel');
  const channel = data?.channels.find((c) => c.name === pick) ?? null;
  const at = query.get('at');
  const [editing, setEditing] = useState(false);

  // the wheel can open the page at a section
  useEffect(() => {
    if (!data || !at) return;
    document.getElementById('tw-' + at)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [!!data, at]);

  const select = (name: string | null) => navigate(name ? `twitch?channel=${encodeURIComponent(name)}` : 'twitch', true);
  const live = data?.channels.filter((c) => c.live) ?? [];

  return (
    <div class="page stats-page tw-page">
      <div class="journal-top stats-top" style={{ '--sky': 'var(--emo-fear)' }}>
        <Sky world="fear" letters="twitch" />
        <header class="page-head">
          <div class="row between tw-head-row">
            <button class="back-link stats-back" onClick={() => goBack()}><Icon name="chevron-left" size={18} /> {t('Back')}</button>
            <button class="btn btn-quiet btn-s tw-edit-btn" onClick={() => setEditing(true)}><Icon name="pencil" size={15} /> {t('Edit channels')}</button>
          </div>
          <h1 class="title">{t('Channel points')}</h1>
          <p class="subtitle">
            {!data ? t('From the points miner') : live.length ? (
              <><span class="tw-live" aria-hidden="true" /> {t('Watching {names} now', { names: live.map((c) => c.name).join(', ') })}</>
            ) : (
              t('{user} · last points {when}', { user: data.user, when: ago(Math.max(...data.channels.map((c) => c.lastAt)), data.now) })
            )}
          </p>
        </header>
        {data && data.channels.length > 1 && (
          <div class="chips filters scroll-x" role="toolbar" aria-label={t('Channel')}>
            <button class="chip" aria-pressed={!channel} onClick={() => select(null)}>{t('All channels')}</button>
            {data.channels.map((c) => (
              <button class="chip" aria-pressed={channel === c} onClick={() => select(c.name)}>
                {c.live && <span class="tw-live" aria-hidden="true" />}{c.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {!data ? (
        error ? (
          <div class="empty">
            <h2 class="title-s">{t('No channel points')}</h2>
            <p>{error}</p>
            <button class="btn btn-quiet" onClick={() => loadPoints(true)}><Icon name="refresh" size={18} /> {t('Try again')}</button>
          </div>
        ) : (
          <p class="empty-note center">{loading ? t('Loading…') : ''}</p>
        )
      ) : (
        <Board key={channel?.name ?? 'all'} data={data} channel={channel} onPick={select} onEdit={() => setEditing(true)} />
      )}
      <ChannelsSheet open={editing} onClose={() => setEditing(false)} />
    </div>
  );
}

function Board({ data, channel, onPick, onEdit }: { data: Points; channel: Channel | null; onPick: (name: string | null) => void; onEdit: () => void }) {
  const balance = channel ? channel.balance : data.total;
  const change = channel ? channel.change : data.change;
  const daily = channel ? channel.daily : data.daily;
  const reasons = channel ? channel.reasons : data.reasons;
  const recent = channel ? data.recent.filter((r) => r.channel === channel.name) : data.recent;
  const top = data.channels[0];

  return (
    <RevealStack>
      <section class="card hero tw-hero">
        <div class="tile-label">{channel ? t('Points on {channel}', { channel: channel.name }) : t('Points on every channel')}</div>
        <div class="hero-row">
          <span class="hero-num"><CountUp value={balance} /></span>
          <Icon name="brand-twitch" size={26} class="tw-mark" />
        </div>
        <Gains change={change} />
      </section>

      <div class="tiles">
        <Tile k={0} icon="trending-up" label={t('This month')} value={signed(change.month)} sub={t('{n} a day on average', { n: num(Math.round(change.month / 30)) })} />
        {channel ? (
          <Tile k={1} icon="clock" label={t('Last points')} value={ago(channel.lastAt, data.now)} small sub={t('following since {date}', { date: shortDate(keyOf(new Date(channel.firstAt))) })} />
        ) : (
          <Tile k={1} icon="broadcast" label={t('Channels')} value={String(data.channels.length)} sub={t('most on {channel}', { channel: top?.name ?? '—' })} />
        )}
        <Tile k={2} icon="flame" label={t('Watch streaks')} value={signed(reasons['Watch Streak'] ?? 0)} sub={t('in 30 days')} />
      </div>

      <ChartCard
        title={t('Balance')}
        sub={t('The last 90 days')}
        table={{ head: [t('Day'), t('Points')], rows: daily.map((v, i) => [shortDate(keyOf(new Date(data.start + i * DAY))), v === null ? '—' : num(v)]).filter((r) => r[1] !== '—').reverse() }}
      >
        <PointsChart daily={daily} start={data.start} />
      </ChartCard>

      <Reasons reasons={reasons} />

      {!channel && (
        <section class="card tw-list" id="tw-channels">
          <div class="tw-list-head">
            <h3 class="chart-title">{t('Channels')}</h3>
            <button class="btn btn-quiet btn-s" onClick={onEdit}><Icon name="pencil" size={15} /> {t('Edit')}</button>
          </div>
          <ul>
            {data.channels.map((c, i) => (
              <li style={{ '--k': i }}>
                <button class="tw-channel" onClick={() => onPick(c.name)}>
                  <span class="tw-ch-name">
                    {c.live && <span class="tw-live" aria-label={t('live')} />}
                    <b>{c.name}</b>
                    <small>{c.live ? t('watching now') : data.mining && !data.mining.includes(c.name) ? t('not mined any more') : ago(c.lastAt, data.now)}</small>
                  </span>
                  <Spark values={c.daily.slice(-30)} />
                  <span class="tw-ch-num">
                    <b>{compact(c.balance)}</b>
                    <small class={c.change.week > 0 ? 'up' : ''}>{signed(c.change.week)} {t('this week')}</small>
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section class="card tw-list" id="tw-recent">
        <h3 class="chart-title">{t('Lately')}</h3>
        {recent.length ? (
          <ul>
            {recent.slice(0, 15).map((r, i) => {
              const [name, icon] = reason(r.reason);
              return (
                <li class="tw-event" style={{ '--k': i }}>
                  <span class={`tw-ev-ico${r.delta < 0 ? ' down' : ''}`}><Icon name={icon} size={15} stroke={2} /></span>
                  <span class="tw-ev-text"><b>{name}</b>{!channel && <small>{r.channel}</small>}</span>
                  <span class="tw-ev-num">
                    <b class={r.delta < 0 ? 'down' : 'up'}>{signed(r.delta)}</b>
                    <small>{ago(r.at, data.now)}</small>
                  </span>
                </li>
              );
            })}
          </ul>
        ) : (
          <p class="empty-note">{t('Streaks, raids and spending will show up here.')}</p>
        )}
      </section>
    </RevealStack>
  );
}

function Gains({ change }: { change: Change }) {
  const rows: [string, number][] = [[t('today'), change.day], [t('this week'), change.week], [t('in 30 days'), change.month]];
  return (
    <div class="tw-gains">
      {rows.map(([label, v]) => (
        <span class={v > 0 ? 'up' : v < 0 ? 'down' : ''}><b>{signed(v)}</b> {label}</span>
      ))}
    </div>
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

/** What the points came from over 30 days, biggest first; spending is listed after, on its own. */
function Reasons({ reasons }: { reasons: Record<string, number> }) {
  const rows = Object.entries(reasons).filter(([, v]) => v).sort((a, b) => b[1] - a[1]);
  const max = Math.max(1, ...rows.map(([, v]) => Math.abs(v)));
  return (
    <section class="card tw-list">
      <h3 class="chart-title">{t('Where they came from')}</h3>
      <p class="chart-sub">{t('The last 30 days')}</p>
      {rows.length ? (
        <ul class="tw-bars">
          {rows.map(([z, v], i) => {
            const [name, icon] = reason(z);
            return (
              <li style={{ '--k': i, '--w': `${(Math.abs(v) / max) * 100}%` }} class={v < 0 ? 'down' : ''}>
                <span class="tw-bar-label"><Icon name={icon} size={15} stroke={2} /> {name}</span>
                <span class="tw-bar"><i /></span>
                <b>{signed(v)}</b>
              </li>
            );
          })}
        </ul>
      ) : (
        <p class="empty-note">{t('Nothing in the last 30 days.')}</p>
      )}
    </section>
  );
}

function PointsChart({ daily, start }: { daily: (number | null)[]; start: number }) {
  const [ref, W] = useWidth();
  const H = 190, L = 42, R = 8, T = 12, B = 24;
  const n = daily.length;
  const known = daily.filter((v): v is number => v !== null);
  const lo0 = Math.min(...known), hi0 = Math.max(...known);
  const pad = Math.max(1, (hi0 - lo0) * 0.08);
  const lo = Math.max(0, lo0 - pad), hi = hi0 + pad;
  const pw = Math.max(0, W - L - R), ph = H - T - B;
  const x = (i: number) => L + (n === 1 ? pw / 2 : (i / (n - 1)) * pw);
  const y = (v: number) => T + (1 - (v - lo) / (hi - lo || 1)) * ph;
  const first = daily.findIndex((v) => v !== null);
  const pts = useMemo(() => daily.map((v, i) => (v === null ? null : [x(i), y(v)] as const)), [daily, W]);
  const line = pts.reduce((d, p, i) => (p ? d + `${pts[i - 1] ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}` : d), '');
  const last = pts[n - 1];
  const area = first >= 0 && last ? `${line}L${last[0].toFixed(1)},${T + ph}L${x(first).toFixed(1)},${T + ph}Z` : '';
  const day = (i: number) => shortDate(keyOf(new Date(start + i * DAY)));
  const ticks = [0, Math.floor((n - 1) / 2), n - 1];
  const band = pw / Math.max(1, n - 1);

  return (
    <div ref={ref} class="chart">
      {W > 0 && known.length > 0 && (
        <svg width={W} height={H} role="img" aria-label={t('Channel points over the last 90 days')}>
          <defs>
            <linearGradient id="tw-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stop-color="var(--accent)" stop-opacity="0.28" />
              <stop offset="1" stop-color="var(--accent)" stop-opacity="0" />
            </linearGradient>
          </defs>
          {[hi0, (hi0 + lo0) / 2, lo0].map((v) => (
            <>
              <line x1={L} x2={L + pw} y1={y(v)} y2={y(v)} class="grid" />
              <text x={L - 8} y={y(v) + 4} class="tick" text-anchor="end">{compact(Math.round(v))}</text>
            </>
          ))}
          <path d={area} fill="url(#tw-fill)" class="tw-area" />
          <path d={line} class="tw-line" pathLength={1} />
          {last && <circle cx={last[0]} cy={last[1]} r={4} class="tw-dot" />}
          {pts.map((p, i) => p && (
            <g class="tw-col" {...tipProps(() => (
              <>
                <div class="tip-title">{day(i)}</div>
                <TipRow value={num(daily[i]!)} label={t('points')} color="var(--accent)" />
                {i > 0 && daily[i - 1] !== null && <TipRow value={signed(daily[i]! - daily[i - 1]!)} label={t('that day')} />}
              </>
            ), `${day(i)}: ${num(daily[i]!)}`)}>
              <rect x={p[0] - band / 2} y={T} width={band} height={ph} fill="transparent" />
              <line x1={p[0]} x2={p[0]} y1={T} y2={T + ph} class="tw-guide" />
            </g>
          ))}
          {ticks.map((i) => (
            <text x={x(i)} y={H - 6} class="tick" text-anchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}>{day(i)}</text>
          ))}
        </svg>
      )}
    </div>
  );
}

/** A channel's last month, as a small line. */
function Spark({ values }: { values: (number | null)[] }) {
  const known = values.filter((v): v is number => v !== null);
  if (known.length < 2) return <span class="tw-spark" />;
  const lo = Math.min(...known), hi = Math.max(...known);
  const W = 64, H = 22;
  let d = '';
  values.forEach((v, i) => {
    if (v === null) return;
    const px = (i / (values.length - 1)) * W, py = H - 2 - ((v - lo) / (hi - lo || 1)) * (H - 4);
    d += `${d ? 'L' : 'M'}${px.toFixed(1)},${py.toFixed(1)}`;
  });
  return (
    <svg class="tw-spark" width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
      <path d={d} />
    </svg>
  );
}
