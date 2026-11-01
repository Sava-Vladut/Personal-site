import type { ComponentChildren } from 'preact';
import { useLayoutEffect, useState } from 'preact/hooks';
import { goBack, navigate } from '../lib/router';
import { keyOf, shortDate } from '../lib/dates';
import { hoursText } from '../lib/glops';
import { cardOf, loadCardWars, SCENES, spaced, useCardWars, type CardWarsStats, type CwDay, type CwMatch, type Picked, type Rated } from '../lib/cardwars';
import { barPath, ChartCard, CountUp, HeatLegend, LegendItem, RevealStack, TipRow, tipProps, useWidth, type Table } from '../components/charts';
import { Busy, evenTop, minuteBuckets, OnlineCard, Spread } from '../components/playerCharts';
import { PageHead } from '../components/PageHead';
import { Icon, type UiName } from '../components/icons';
import { Sky } from '../components/Sky';
import { LOCALE, t } from '../lib/i18n';
import '../styles/stats.css';
import '../styles/glops.css';
import '../styles/cardwars.css';

const GAME = 'https://savavlad.com/cardwars/';

const TABS: [id: string, name: string][] = [['players', t('Players')], ['progress', t('Progress')], ['pvp', t('PvP')]];

const num = (n: number) => Math.round(n).toLocaleString(LOCALE);
const dec = (n: number) => n.toLocaleString(LOCALE, { maximumFractionDigits: 1 });
/** n of d as a whole percentage, or a dash when there's nothing to take it of. */
const share = (n: number, d: number) => (d > 0 ? `${Math.round((n / d) * 100)}%` : '—');
const dateOf = (iso: string | null) => (iso ? shortDate(keyOf(new Date(iso))) : '—');
const timeOf = (iso: string) => new Date(iso).toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit' });
/** "14:05" today, "3 Nov, 14:05" before. */
const whenOf = (iso: string) => (keyOf(new Date(iso)) === keyOf(new Date()) ? timeOf(iso) : `${dateOf(iso)}, ${timeOf(iso)}`);
/** Play time that may be under a minute: "under 1 min", "12 min", "3.5 h". */
const minText = (m: number) => (m > 0 && m < 1 ? t('under {time}', { time: t('{n} min', { n: 1 }) }) : hoursText(m));
const secText = (s: number) => (s < 90 ? t('{n} s', { n: Math.round(s) }) : t('{n} min', { n: Math.round(s / 60) }));

const SCENE_NAMES: Record<string, string> = {
  title: t('Title screen'), loading: t('Loading'), menu: t('Main menu'), map: t('World map'),
  decks: t('Deck building'), battle: t('Quest battles'), pvp: t('PvP'), other: t('Elsewhere'),
};
const sceneName = (id: string) => SCENE_NAMES[id] ?? spaced(id);
/** The game's scenes in their order, then any the relay knows and this page doesn't. */
const scenesOf = (by: Record<string, number>) => [...SCENES, ...Object.keys(by).filter((k) => !(SCENES as readonly string[]).includes(k)).sort()];

/** The quest lines: their names and how many quests each has (each gives up to 3 stars). */
const QUEST_LINES: Record<string, [name: string, quests: number]> = {
  main: [t('Story'), 180], fc: [t('Fionna & Cake'), 61], dungeon: [t('Dungeons'), 35], tcat: ['tcat', 35], deck_wars: [t('Deck Wars'), 20], elfisto: [t('El Fisto'), 8],
};
const CARD_TYPES: Record<string, string> = { Creature: t('Creature'), Spell: t('Spell'), Building: t('Building'), Hero: t('Hero') };

const MODES: Record<string, string> = { deck: t('My Deck'), random: t('Random Deck') };
const REASONS: [id: string, name: string, noContest?: boolean][] = [
  ['win', t('Played to a win')], ['concede', t('Conceded')], ['timeout', t('Ran out of time')], ['disconnect', t('Disconnected')],
  ['desync', t('Fell out of step'), true], ['disagree', t('Results disagreed'), true],
];
const reasonName = (id: string) => REASONS.find((r) => r[0] === id)?.[1] ?? spaced(id);

/** The page wears joy's yellow, Jake's; charts and tooltips read the accent from the root. */
function useAccent() {
  useLayoutEffect(() => {
    const root = document.documentElement.style;
    root.setProperty('--accent', 'var(--emo-joy)');
    return () => root.removeProperty('--accent');
  }, []);
}

export function CardWars({ query }: { query: URLSearchParams }) {
  useAccent();
  const { data, error, loading } = useCardWars();
  const tab = TABS.find(([id]) => id === query.get('tab'))?.[0] ?? 'players';

  return (
    <div class="page stats-page gl-page cw-page">
      <div class="journal-top stats-top" style={{ '--sky': 'var(--emo-joy)' }}>
        <Sky world="joy" />
        <PageHead
          title={t('Card Wars')}
          back={() => goBack()}
          actions={
            <a class="icon-btn" href={GAME} target="_blank" rel="noopener" aria-label={t('Play Card Wars')} title={t('Play Card Wars')}>
              <Icon name="player-play" />
            </a>
          }
          subtitle={t('Who plays Card Wars, in a browser or on Windows')}
        />

        {data && (
          <div class="media-stats stats-figures cw-figures">
            <span class="stat" style={{ '--i': 0 }}>
              <b><span class={data.online.total ? 'gl-live' : 'gl-live idle'} aria-hidden="true" /><CountUp value={data.online.total} /></b>
              <small>{t('Online now')}</small>
            </span>
            <span class="stat" style={{ '--i': 1 }}>
              <b><CountUp value={data.online.inMatch} /></b>
              <small>{t('In a match now')}</small>
            </span>
            <span class="stat" style={{ '--i': 2 }}>
              <b>{dateOf(data.since || null)}</b>
              <small>{t('Counting since')}</small>
            </span>
          </div>
        )}

        <div class="seg tabs" role="tablist" style={{ '--at': TABS.findIndex(([id]) => id === tab), '--tabs': TABS.length }}>
          {TABS.map(([id, name]) => (
            <button role="tab" aria-selected={tab === id} onClick={() => navigate(id === 'players' ? 'cardwars' : 'cardwars?tab=' + id, true)}>{name}</button>
          ))}
        </div>
      </div>

      <div class="tab-panel" key={tab}>
        {!data ? (
          error ? (
            <div class="empty fade-arrive-soft">
              <h2 class="title-s">{t('No player stats')}</h2>
              <p>{error}</p>
              <button class="btn btn-quiet" onClick={() => loadCardWars(true)}><Icon name="refresh" size={18} /> {t('Try again')}</button>
            </div>
          ) : (
            <p class="empty-note center loading-note">{loading ? t('Loading…') : ''}</p>
          )
        ) : tab === 'progress' ? (
          <Progress data={data} />
        ) : tab === 'pvp' ? (
          <Pvp data={data} />
        ) : (
          <Players data={data} />
        )}
      </div>
    </div>
  );
}

function Tile({ icon, label, value, sub, k }: { icon: UiName; label: string; value: string; sub: string; k: number }) {
  return (
    <div class="tile" style={{ '--k': k }}>
      <div class="tile-top">
        <span class="tile-ico"><Icon name={icon} size={14} stroke={2} /></span>
        <span class="tile-label">{label}</span>
      </div>
      <div class="tile-value">{value}</div>
      <div class="tile-sub">{sub}</div>
    </div>
  );
}

/** Ranked rows with a bar each, like Stats' most felt, in the page's colour. */
function Ranked({ rows }: { rows: { key: string; label: ComponentChildren; value: ComponentChildren; w: number; tip: () => ComponentChildren; aria: string }[] }) {
  return (
    <ol class="ranked cw-ranked">
      {rows.map((r, i) => (
        <li key={r.key} style={{ '--k': i, '--c': 'var(--accent)', '--w': r.w }} {...tipProps(r.tip, r.aria)}>
          <span class="rk-top">
            <span class="rk-name">{r.label}</span>
            <span class="rk-n">{r.value}</span>
          </span>
          <span class="rk-bar">{r.w > 0 && <i />}</span>
        </li>
      ))}
    </ol>
  );
}

/** Shares of a whole as one bar, deep, pale and grey, with what each is under it. */
function SplitRow({ label, parts, format = num }: { label: string; parts: { name: string; n: number; color: string }[]; format?: (n: number) => string }) {
  const total = parts.reduce((a, p) => a + p.n, 0);
  const shown = parts.filter((p) => p.n > 0);
  return (
    <div class="cw-split">
      <div class="cw-split-head">
        <span>{label}</span>
        <b>{total ? format(total) : '—'}</b>
      </div>
      <div class="split-bar">
        {shown.length ? shown.map((p, i) => (
          <i style={{ flexGrow: p.n, background: p.color, '--k': i }} {...tipProps(() => <TipRow value={`${format(p.n)} · ${share(p.n, total)}`} label={p.name} color={p.color} />, `${p.name}: ${format(p.n)}`)} />
        )) : <i class="cw-split-none" />}
      </div>
      {total > 0 && (
        <div class="split-labels">
          {shown.map((p) => <span><b>{share(p.n, total)}</b> {p.name}</span>)}
        </div>
      )}
    </div>
  );
}

/* ================= Players ================= */

function Players({ data }: { data: CardWarsStats }) {
  const { totals, peak } = data;
  const today = data.days.at(-1)?.day === data.now.slice(0, 10) ? data.days.at(-1)! : null;
  const avg = totals.sessions ? totals.playMin / totals.sessions : 0;
  return (
    <RevealStack>
      <RightNow data={data} />

      <div class="tiles eight">
        <Tile k={0} icon="users" label={t('Players')} value={num(totals.players)} sub={t('{n} came back another day', { n: num(totals.returning) })} />
        <Tile k={1} icon="calendar" label={t('Active this week')} value={num(totals.active7)} sub={t('{n} in 30 days', { n: num(totals.active30) })} />
        <Tile k={2} icon="player-play" label={t('Sessions')} value={num(totals.sessions)} sub={avg ? t('about {time} each', { time: minText(avg) }) : t('{n} today', { n: num(today?.sessions ?? 0) })} />
        <Tile k={3} icon="clock" label={t('Hours played')} value={hoursText(totals.playMin)} sub={t('longest {time}', { time: data.longest.n ? hoursText(data.longest.n) : '—' })} />
        <Tile k={4} icon="swords" label={t('PvP matches')} value={num(totals.matches)} sub={t('{n} PvP players', { n: num(totals.pvpPlayers) })} />
        <Tile k={5} icon="cards" label={t('Quest battles')} value={num(totals.questBattles)} sub={t('{n} today', { n: num(today?.questBattles ?? 0) })} />
        <Tile k={6} icon="trophy" label={t('Most online')} value={num(peak.online.n)} sub={dateOf(peak.online.at)} />
        <Tile k={7} icon="crown" label={t('Most in a match')} value={num(peak.inMatch.n)} sub={dateOf(peak.inMatch.at)} />
      </div>

      <OnlineCard now={data.now} series={data.series} wide />
      <DaysCard days={data.days} now={data.now} />

      <ChartCard title={t('Busy hours')} sub={t('Hours played by day and time, in your time zone')} legend={<HeatLegend />}>
        <Busy week={data.week} />
      </ChartCard>

      <Spread
        title={t('How long people play')}
        sub={t('Every session since counting started')}
        counts={data.lengths.counts}
        name={minuteBuckets(data.lengths.bounds)}
        empty={t('Sessions show up here once people close the game.')}
      />

      <ScenesCard sceneMin={data.sceneMin} />
      <PlatformsCard data={data} />

      <p class="gl-note wide">
        {t('Online means the game is open, in a browser or on Windows, and checking in each minute; in a match means playing someone in PvP. Players are told apart by their game profile, and times are time played.')}
        {' '}<a href={GAME} target="_blank" rel="noopener">savavlad.com/cardwars</a>
      </p>
    </RevealStack>
  );
}

/** Who's on now: where they are in the game, what they play it on, and who's waiting for a match. */
function RightNow({ data }: { data: CardWarsStats }) {
  const { online, peak } = data;
  const scenes = scenesOf(online.scenes).map((id) => [id, online.scenes[id] ?? 0] as const).filter(([, n]) => n > 0);
  const facts: [n: number, label: string][] = [
    [online.matches, t('live matches')],
    [online.queued, t('waiting for a quick match')],
    [online.rooms, t('private rooms open')],
    [online.web, t('in a browser')],
    [online.windows, t('on Windows')],
  ];
  return (
    <section class="card gl-list cw-now wide">
      <h3 class="chart-title">{t('Right now')}</h3>
      {online.total ? (
        <>
          <ul class="cw-scenes" aria-label={t('Where they are')}>
            {scenes.map(([id, n], i) => <li style={{ '--k': i }}><b>{n}</b> {sceneName(id)}</li>)}
          </ul>
          <dl class="cw-facts">
            {facts.map(([n, label], i) => (
              <div style={{ '--k': i }} class={n ? '' : 'none'}>
                <dt>{num(n)}</dt>
                <dd>{label}</dd>
              </div>
            ))}
          </dl>
        </>
      ) : (
        <p class="empty-note">
          {peak.online.n
            ? t('Nobody’s playing right now. The most at once was {n}, on {date}.', { n: num(peak.online.n), date: dateOf(peak.online.at) })
            : t('Nobody’s playing right now.')}
        </p>
      )}
    </section>
  );
}

/* ---------- every day ---------- */

const METRICS: [id: string, name: string][] = [['players', t('Players')], ['time', t('Time played')], ['battles', t('Battles')]];
type Shown = CwDay & { none?: boolean };

function DaysCard({ days, now }: { days: CwDay[]; now: string }) {
  const [metric, setMetric] = useState('players');
  const by = new Map(days.map((d) => [d.day, d]));
  const end = new Date(now);
  const shown: Shown[] = [];
  for (let i = 29; i >= 0; i--) {
    const k = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate() - i)).toISOString().slice(0, 10);
    shown.push(by.get(k) ?? { day: k, players: 0, new: 0, sessions: 0, playMin: 0, peak: 0, peakInMatch: 0, matches: 0, pvpPlayers: 0, questBattles: 0, none: true });
  }
  const table: Table = {
    head: [t('Day'), t('Players'), t('New'), t('Sessions'), t('Played'), t('Most at once'), t('Quest battles'), t('PvP matches')],
    rows: [...days].reverse().map((d) => [shortDate(d.day), d.players, d.new, d.sessions, hoursText(d.playMin), d.peak, d.questBattles, d.matches]),
  };
  // play time in minutes until there's two hours of it on a day, then in hours
  const inHours = Math.max(...shown.map((d) => d.playMin)) >= 120;
  const series: { label: string; color: string; of: (d: CwDay) => number; text?: (d: CwDay) => string }[] =
    metric === 'players' ? [
      { label: t('Came back'), color: 'var(--gl-playing)', of: (d) => Math.max(0, d.players - d.new) },
      { label: t('New'), color: 'var(--gl-online)', of: (d) => Math.min(d.new, d.players) },
    ] : metric === 'time' ? [
      { label: inHours ? t('Hours played') : t('Minutes played'), color: 'var(--gl-playing)', of: (d) => (inHours ? d.playMin / 60 : d.playMin), text: (d) => hoursText(d.playMin) },
    ] : [
      { label: t('Quest battles'), color: 'var(--gl-playing)', of: (d) => d.questBattles },
      { label: t('PvP matches'), color: 'var(--gl-online)', of: (d) => d.matches },
    ];
  return (
    <ChartCard
      title={t('Every day')}
      sub={t('The last 30 days, by the UTC day')}
      table={table}
      wide
      legend={<>{series.map((s) => <LegendItem color={s.color} label={s.label} />)}</>}
    >
      <div class="seg tabs gl-range" role="tablist" aria-label={t('What to show')} style={{ '--at': METRICS.findIndex(([id]) => id === metric), '--tabs': METRICS.length }}>
        {METRICS.map(([id, name]) => <button role="tab" aria-selected={id === metric} onClick={() => setMetric(id)}>{name}</button>)}
      </div>
      {days.length ? <DayBars key={metric} days={shown} series={series} /> : <p class="empty-note">{t('Nobody has played yet.')}</p>}
    </ChartCard>
  );
}

/** A bar per day, its series stacked from the deep one at the base, with a 2px gap between them. */
function DayBars({ days, series }: { days: Shown[]; series: { label: string; color: string; of: (d: CwDay) => number; text?: (d: CwDay) => string }[] }) {
  const [ref, W] = useWidth();
  const H = 150, L = 28, R = 4, T = 10, B = 24;
  const pw = Math.max(0, W - L - R), ph = H - T - B;
  const slot = pw / days.length, bw = Math.max(2, Math.min(24, slot - 2));
  const sum = (d: CwDay) => series.reduce((a, s) => a + s.of(d), 0);
  const top = evenTop(Math.ceil(Math.max(...days.map(sum))));
  const y = (v: number) => T + (1 - v / top) * ph;
  return (
    <div ref={ref} class="chart">
      {W > 0 && (
        <svg width={W} height={H} role="img" aria-label={series.map((s) => s.label).join(', ')}>
          {[0, top / 2, top].map((v) => (
            <>
              <line x1={L} x2={L + pw} y1={y(v)} y2={y(v)} class="grid" />
              <text x={L - 8} y={y(v) + 4} class="tick" text-anchor="end">{v}</text>
            </>
          ))}
          {days.map((d, i) => {
            const x = L + i * slot + (slot - bw) / 2;
            const vals = series.map((s) => s.of(d));
            const last = vals.reduce((at, v, j) => (v > 0 ? j : at), -1);
            let base = 0;
            return (
              <g class="chart-mark" {...tipProps(() => (
                <>
                  <div class="tip-title">{shortDate(d.day)}</div>
                  {d.none ? <TipRow value="—" label={t('not counted')} /> : series.map((s) => <TipRow value={s.text ? s.text(d) : num(s.of(d))} label={s.label} color={s.color} />)}
                </>
              ), `${shortDate(d.day)}: ${series.map((s) => `${s.text ? s.text(d) : num(s.of(d))} ${s.label}`).join(', ')}`)}>
                <rect x={L + i * slot} y={T} width={slot} height={ph} fill="transparent" />
                {vals.map((v, j) => {
                  if (v <= 0) return null;
                  const from = y(base) - (base > 0 ? 2 : 0), to = y((base += v));
                  if (from - to < 1) return null;
                  const path = j === last ? barPath(x, bw, from, to) : `M${x},${from}V${to}H${x + bw}V${from}Z`;
                  return <path class="bar up" d={path} fill={series[j].color} style={{ '--t': (i / days.length).toFixed(3) }} />;
                })}
              </g>
            );
          })}
          {[0, 10, 20, 29].map((i) => (
            <text x={L + (i + 0.5) * slot} y={H - 6} class="tick" text-anchor={i === 0 ? 'start' : i === 29 ? 'end' : 'middle'}>{shortDate(days[i].day)}</text>
          ))}
        </svg>
      )}
    </div>
  );
}

/* ---------- where the time goes, and on what ---------- */

function ScenesCard({ sceneMin }: { sceneMin: Record<string, number> }) {
  const rows = scenesOf(sceneMin).map((id) => ({ id, min: sceneMin[id] ?? 0 })).filter((r) => r.min > 0).sort((a, b) => b.min - a.min);
  const total = rows.reduce((a, r) => a + r.min, 0);
  const max = rows[0]?.min ?? 0;
  return (
    <ChartCard
      title={t('Where the time goes')}
      sub={t('Time spent in each part of the game')}
      table={{ head: [t('Where'), t('Time'), t('Share')], rows: rows.map((r) => [sceneName(r.id), hoursText(r.min), share(r.min, total)]) }}
    >
      {rows.length ? (
        <Ranked rows={rows.map((r) => ({
          key: r.id,
          label: sceneName(r.id),
          value: <><b>{hoursText(r.min)}</b> <small>{share(r.min, total)}</small></>,
          w: r.min / max,
          tip: () => <TipRow value={`${hoursText(r.min)} · ${share(r.min, total)}`} label={sceneName(r.id)} color="var(--accent)" />,
          aria: `${sceneName(r.id)}: ${hoursText(r.min)}`,
        }))} />
      ) : (
        <p class="empty-note">{t('Time shows up here once people play.')}</p>
      )}
    </ChartCard>
  );
}

function PlatformsCard({ data }: { data: CardWarsStats }) {
  const { players, minutes } = data.platforms;
  const web = { name: t('Browser'), color: 'var(--gl-playing)' }, win = { name: t('Windows'), color: 'var(--gl-online)' };
  const versions = Object.entries(data.versions).filter(([, n]) => n > 0).sort(([a], [b]) => b.localeCompare(a, undefined, { numeric: true }));
  const vmax = Math.max(1, ...versions.map(([, n]) => n));
  return (
    <ChartCard
      title={t('Browser or Windows')}
      sub={t('Who plays where, and for how long')}
      table={{
        head: [t('Where'), t('Players'), t('Played')],
        rows: [[web.name, players.web ?? 0, hoursText(minutes.web ?? 0)], [win.name, players.windows ?? 0, hoursText(minutes.windows ?? 0)], [t('Not known'), players.unknown ?? 0, '—']],
      }}
    >
      <div class="cw-splits">
        <SplitRow label={t('Players')} parts={[{ ...web, n: players.web ?? 0 }, { ...win, n: players.windows ?? 0 }, { name: t('not known yet'), color: 'var(--surface-3)', n: players.unknown ?? 0 }]} />
        <SplitRow label={t('Time played')} parts={[{ ...web, n: minutes.web ?? 0 }, { ...win, n: minutes.windows ?? 0 }]} format={hoursText} />
      </div>
      {versions.length > 0 && (
        <>
          <h4 class="cw-subhead">{t('Game versions, last 30 days')}</h4>
          <Ranked rows={versions.map(([v, n]) => ({
            key: v,
            label: v,
            value: <><b>{num(n)}</b> <small>{n === 1 ? t('player') : t('players')}</small></>,
            w: n / vmax,
            tip: () => <TipRow value={num(n)} label={t('players on {version}', { version: v })} color="var(--accent)" />,
            aria: `${v}: ${n}`,
          }))} />
        </>
      )}
    </ChartCard>
  );
}

/* ================= Progress ================= */

function Progress({ data }: { data: CardWarsStats }) {
  const p = data.progress;
  const stars = Object.values(p.stars).reduce((a, s) => a + (s.avg || 0), 0);
  const seen = p.players > 0;
  return (
    <RevealStack>
      <div class="tiles four">
        <Tile k={0} icon="users" label={t('Saves seen')} value={num(p.players)} sub={t('of {n} active in 30 days', { n: num(data.totals.active30) })} />
        <Tile k={1} icon="map" label={t('Quests done')} value={seen ? dec(p.quests.avg) : '—'} sub={t('per player, on average')} />
        <Tile k={2} icon="star" label={t('Stars')} value={seen ? dec(stars) : '—'} sub={t('per player, on average')} />
        <Tile k={3} icon="trophy" label={t('PvP win rate')} value={seen ? `${Math.round(p.pvpWinRate)}%` : '—'} sub={t('from their saves')} />
      </div>

      <StarsCard data={data} />

      <Spread
        title={t('Quests done')}
        sub={t('Quests with at least one star, per player')}
        counts={p.quests.counts}
        name={questBuckets(p.quests.bounds)}
        empty={t('Shows once a player’s game sends its save.')}
      />

      <Wealth data={data} />

      <p class="gl-note wide">{t('From the players active in the last 30 days whose game sent its save.')}</p>
    </RevealStack>
  );
}

/** "none", "1–9 quests", …, "150 or more" */
function questBuckets(bounds: number[]) {
  return (i: number) => (i === 0 ? t('none yet') : i === bounds.length ? t('{n} or more', { n: bounds[i - 1] }) : t('{n} quests', { n: `${bounds[i - 1]}–${bounds[i] - 1}` }));
}

function StarsCard({ data }: { data: CardWarsStats }) {
  const known = Object.keys(QUEST_LINES);
  const rows = Object.entries(data.progress.stars)
    .sort(([a], [b]) => (known.indexOf(a) + 1 || 99) - (known.indexOf(b) + 1 || 99) || a.localeCompare(b))
    .map(([id, s]) => {
      const line = QUEST_LINES[id];
      // a line this page doesn't know: as many quests as its best player's stars need, one at least
      const cap = line ? line[1] * 3 : Math.max(3, Math.ceil((s.max || 0) / 3) * 3);
      return { id, name: line?.[0] ?? id, cap, ...s };
    });
  return (
    <ChartCard
      title={t('Stars by quest line')}
      sub={t('The average player’s stars, of all there are to win')}
      table={{ head: [t('Quest line'), t('Players'), t('Average'), t('Best'), t('Of')], rows: rows.map((r) => [r.name, r.players, dec(r.avg), r.max, r.cap]) }}
    >
      {rows.length ? (
        <Ranked rows={rows.map((r) => ({
          key: r.id,
          label: r.name,
          value: <><b>{dec(r.avg)}</b> <small>/ {num(r.cap)}</small></>,
          w: Math.min(1, r.avg / r.cap),
          tip: () => (
            <>
              <div class="tip-title">{r.name}</div>
              <TipRow value={dec(r.avg)} label={t('stars on average')} color="var(--accent)" />
              <TipRow value={num(r.max)} label={t('the most anyone has')} />
              <TipRow value={num(r.players)} label={t('players with a star')} />
            </>
          ),
          aria: `${r.name}: ${dec(r.avg)} / ${r.cap}`,
        }))} />
      ) : (
        <p class="empty-note">{t('Shows once a player’s game sends its save.')}</p>
      )}
    </ChartCard>
  );
}

function Wealth({ data }: { data: CardWarsStats }) {
  const p = data.progress;
  const rows: [icon: UiName, name: string, s: { avg: number; median: number; max: number }][] = [
    ['coins', t('Coins'), p.coins], ['diamond', t('Gems'), p.gems], ['medal', t('Trophies'), p.trophies],
  ];
  return (
    <section class="card gl-list">
      <h3 class="chart-title">{t('Coins, gems and trophies')}</h3>
      <p class="chart-sub">{t('What players have saved up')}</p>
      {p.players ? (
        <table class="cw-wealth">
          <thead><tr><th /><th>{t('Average')}</th><th>{t('Median')}</th><th>{t('Most')}</th></tr></thead>
          <tbody>
            {rows.map(([icon, name, s], i) => (
              <tr style={{ '--k': i }}>
                <th scope="row"><Icon name={icon} size={16} /> {name}</th>
                <td><b>{num(s.avg)}</b></td>
                <td>{num(s.median)}</td>
                <td>{num(s.max)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p class="empty-note">{t('Shows once a player’s game sends its save.')}</p>
      )}
    </section>
  );
}

/* ================= PvP ================= */

function Pvp({ data }: { data: CardWarsStats }) {
  const v = data.pvp;
  return (
    <RevealStack>
      <div class="tiles six">
        <Tile k={0} icon="swords" label={t('Matches')} value={num(v.matches.total)} sub={t('{n} live now', { n: num(data.online.matches) })} />
        <Tile k={1} icon="users" label={t('PvP players')} value={num(data.totals.pvpPlayers)} sub={t('{n} waiting now', { n: num(data.online.queued) })} />
        <Tile k={2} icon="hourglass" label={t('Average match')} value={v.decided ? minText(v.avgMinutes) : '—'} sub={v.decided ? t('{n} turns', { n: dec(v.avgTurns) }) : '—'} />
        <Tile k={3} icon="dice-5" label={t('First seat wins')} value={share(v.firstSeatWins, v.decided)} sub={t('of {n} with a winner', { n: num(v.decided) })} />
        <Tile k={4} icon="clock" label={t('Quick match wait')} value={v.via.queue ? secText(v.avgQueueSec) : '—'} sub={t('{n} quick matches', { n: num(v.via.queue ?? 0) })} />
        <Tile k={5} icon="world" label={t('Private rooms')} value={num(v.rooms.created)} sub={t('{n} joined · {m} expired', { n: num(v.rooms.joined), m: num(v.rooms.expired) })} />
      </div>

      <HowPlayed data={data} />
      <HowEnded data={data} />
      <FirstSeat data={data} />

      <Spread
        title={t('Match length')}
        sub={t('Every finished match')}
        counts={v.durations.counts}
        name={minuteBuckets(v.durations.bounds)}
        empty={t('No matches have finished yet.')}
      />

      <Levels data={data} />
      <Picks title={t('Heroes')} sub={t('Most picked in My Deck matches, and how they did')} rows={v.leaders} hero />
      <Picks title={t('Cards')} sub={t('The cards most decks had in My Deck matches')} rows={v.cards} />
      <Board title={t('My Deck leaderboard')} rows={v.leaderboards.deck} />
      <Board title={t('Random Deck leaderboard')} rows={v.leaderboards.random} />
      <Recent matches={v.recent} />

      <p class="gl-note wide">
        {t('My Deck: players bring their own decks. Random Deck: both are dealt decks at one random hero level. Matches that fell out of step or whose results disagreed are no contest.')}
      </p>
    </RevealStack>
  );
}

function HowPlayed({ data }: { data: CardWarsStats }) {
  const { matches, via } = data.pvp;
  const deep = 'var(--gl-playing)', pale = 'var(--gl-online)';
  const empty = !matches.deck && !matches.random && !via.queue && !via.room;
  return (
    <ChartCard
      title={t('How matches are played')}
      sub={t('Finished matches by mode, and how players met')}
      table={{ head: [t('What'), t('Matches')], rows: [[MODES.deck, matches.deck], [MODES.random, matches.random], [t('Quick match'), via.queue ?? 0], [t('Private room'), via.room ?? 0]] }}
    >
      {empty ? <p class="empty-note">{t('No matches have finished yet.')}</p> : (
        <div class="cw-splits">
          <SplitRow label={t('Mode')} parts={[{ name: MODES.deck, color: deep, n: matches.deck }, { name: MODES.random, color: pale, n: matches.random }]} />
          <SplitRow label={t('Way in')} parts={[{ name: t('Quick match'), color: deep, n: via.queue ?? 0 }, { name: t('Private room'), color: pale, n: via.room ?? 0 }]} />
        </div>
      )}
    </ChartCard>
  );
}

function HowEnded({ data }: { data: CardWarsStats }) {
  const by = data.pvp.reasons;
  const ids = [...REASONS.map((r) => r[0]), ...Object.keys(by).filter((k) => !REASONS.some((r) => r[0] === k)).sort()];
  const rows = ids.map((id) => ({ id, n: by[id] ?? 0 })).filter((r) => r.n > 0);
  const total = rows.reduce((a, r) => a + r.n, 0);
  const max = Math.max(1, ...rows.map((r) => r.n));
  return (
    <ChartCard
      title={t('How matches end')}
      sub={t('Every finished match')}
      table={{ head: [t('Ending'), t('Matches'), t('Share')], rows: rows.map((r) => [reasonName(r.id), r.n, share(r.n, total)]) }}
    >
      {rows.length ? (
        <Ranked rows={rows.map((r) => ({
          key: r.id,
          label: <>{reasonName(r.id)}{REASONS.find((x) => x[0] === r.id)?.[2] && <span class="cw-tag">{t('no contest')}</span>}</>,
          value: <><b>{num(r.n)}</b> <small>{share(r.n, total)}</small></>,
          w: r.n / max,
          tip: () => <TipRow value={`${num(r.n)} · ${share(r.n, total)}`} label={reasonName(r.id)} color="var(--accent)" />,
          aria: `${reasonName(r.id)}: ${r.n}`,
        }))} />
      ) : (
        <p class="empty-note">{t('No matches have finished yet.')}</p>
      )}
    </ChartCard>
  );
}

/** A balance check: of the matches with a winner, how many went to who played first. Even is half. */
function FirstSeat({ data }: { data: CardWarsStats }) {
  const { decided, firstSeatWins } = data.pvp;
  const p = decided ? firstSeatWins / decided : 0;
  return (
    <section class="card gl-list cw-balance">
      <h3 class="chart-title">{t('Who goes first')}</h3>
      <p class="chart-sub">{t('A balance check: an even game gives the first seat half the wins')}</p>
      {decided ? (
        <>
          <div class="cw-scale" style={{ '--p': p }} {...tipProps(() => <TipRow value={`${num(firstSeatWins)} / ${num(decided)}`} label={t('won by who went first')} color="var(--accent)" />, `${share(firstSeatWins, decided)} ${t('won by who went first')}`)}>
            <span class="cw-scale-track"><i /></span>
            <span class="cw-scale-even" aria-hidden="true" />
          </div>
          <div class="split-labels">
            <span><b>{share(firstSeatWins, decided)}</b> {t('first seat')}</span>
            <span><b>{share(decided - firstSeatWins, decided)}</b> {t('second seat')}</span>
          </div>
        </>
      ) : (
        <p class="empty-note">{t('Shows once matches have a winner.')}</p>
      )}
    </section>
  );
}

function Levels({ data }: { data: CardWarsStats }) {
  const levels = [...data.pvp.levels].filter((l) => l.matches > 0).sort((a, b) => a.level - b.level);
  const max = Math.max(1, ...levels.map((l) => l.matches));
  return (
    <ChartCard
      title={t('Random Deck levels')}
      sub={t('Matches at each hero level, and how often the first seat won')}
      table={{ head: [t('Level'), t('Matches'), t('With a winner'), t('First seat won')], rows: levels.map((l) => [l.level, l.matches, l.decided, share(l.firstSeatWins, l.decided)]) }}
    >
      {levels.length ? (
        <Ranked rows={levels.map((l) => ({
          key: String(l.level),
          label: t('Level {n}', { n: l.level }),
          value: <><b>{num(l.matches)}</b> <small>{t('first seat {p}', { p: share(l.firstSeatWins, l.decided) })}</small></>,
          w: l.matches / max,
          tip: () => (
            <>
              <div class="tip-title">{t('Level {n}', { n: l.level })}</div>
              <TipRow value={num(l.matches)} label={t('matches')} color="var(--accent)" />
              <TipRow value={share(l.firstSeatWins, l.decided)} label={t('won by who went first')} />
            </>
          ),
          aria: `${t('Level {n}', { n: l.level })}: ${l.matches}`,
        }))} />
      ) : (
        <p class="empty-note">{t('No Random Deck matches yet.')}</p>
      )}
    </ChartCard>
  );
}

/** The heroes or cards picked most, with how often they won (of the matches that had a winner). */
function Picks({ title, sub, rows, hero }: { title: string; sub: string; rows: Picked[]; hero?: boolean }) {
  const [all, setAll] = useState(false);
  const FEW = 10;
  const max = Math.max(1, ...rows.map((r) => r.picks));
  const shown = all ? rows : rows.slice(0, FEW);
  const won = (r: Picked) => (r.decided ? t('{p} won', { p: share(r.wins, r.decided) }) : t('no result yet'));
  return (
    <ChartCard
      title={title}
      sub={sub}
      table={{ head: [hero ? t('Hero') : t('Card'), t('Picked'), t('With a winner'), t('Won')], rows: rows.map((r) => [cardOf(r.id).name, r.picks, r.decided, share(r.wins, r.decided)]) }}
    >
      {rows.length ? (
        <>
          <Ranked rows={shown.map((r) => {
            const { type, name } = cardOf(r.id);
            return {
              key: r.id,
              label: <>{!hero && type && <span class="cw-tag">{CARD_TYPES[type] ?? type}</span>}{name}</>,
              value: <><b>{num(r.picks)}</b> <small>{won(r)}</small></>,
              w: r.picks / max,
              tip: () => (
                <>
                  <div class="tip-title">{name}</div>
                  <TipRow value={num(r.picks)} label={hero ? t('times picked') : t('decks had it')} color="var(--accent)" />
                  <TipRow value={`${num(r.wins)} / ${num(r.decided)}`} label={t('won, of the matches with a winner')} />
                </>
              ),
              aria: `${name}: ${r.picks}, ${won(r)}`,
            };
          })} />
          {rows.length > FEW && (
            <button class="btn btn-quiet cw-more" onClick={() => setAll(!all)}>
              <Icon name={all ? 'chevron-up' : 'chevron-down'} size={16} /> {all ? t('Show fewer') : t('Show all {n}', { n: rows.length })}
            </button>
          )}
        </>
      ) : (
        <p class="empty-note">{t('Shows once My Deck matches are played.')}</p>
      )}
    </ChartCard>
  );
}

function Board({ title, rows }: { title: string; rows: Rated[] }) {
  return (
    <section class="card gl-list">
      <h3 class="chart-title">{title}</h3>
      <p class="chart-sub">{t('The top ten by rating')}</p>
      {rows.length ? (
        <ol class="cw-board">
          {rows.map((r, i) => (
            <li style={{ '--k': i }}>
              <span class="cw-rank">{i + 1}</span>
              <span class="cw-name">{r.name}</span>
              <span class="cw-wl">{t('{w} won · {l} lost', { w: num(r.wins), l: num(r.losses) })}</span>
              <b class="cw-rating">{num(r.rating)}</b>
            </li>
          ))}
        </ol>
      ) : (
        <p class="empty-note">{t('Nobody is ranked yet.')}</p>
      )}
    </section>
  );
}

function Recent({ matches }: { matches: CwMatch[] }) {
  const [all, setAll] = useState(false);
  const FEW = 8;
  const shown = all ? matches : matches.slice(0, FEW);
  return (
    <section class="card gl-list cw-recent wide">
      <h3 class="chart-title">{t('Recent matches')}</h3>
      <p class="chart-sub">{t('The last {n} to finish, newest first', { n: 30 })}</p>
      {matches.length ? (
        <>
          <ul>
            {shown.map((m, i) => <MatchRow m={m} k={i} />)}
          </ul>
          {matches.length > FEW && (
            <button class="btn btn-quiet cw-more" onClick={() => setAll(!all)}>
              <Icon name={all ? 'chevron-up' : 'chevron-down'} size={16} /> {all ? t('Show fewer') : t('Show all {n}', { n: matches.length })}
            </button>
          )}
        </>
      ) : (
        <p class="empty-note">{t('No PvP matches yet. They show up here as they finish.')}</p>
      )}
    </section>
  );
}

function MatchRow({ m, k }: { m: CwMatch; k: number }) {
  const mode = m.mode === 'random' ? t('Random Deck, level {n}', { n: m.level }) : MODES[m.mode] ?? spaced(m.mode);
  const contest = m.winner === 0 || m.winner === 1;
  return (
    <li class="cw-match" style={{ '--k': k }}>
      <div class="cw-vs">
        {m.players.map((p, seat) => (
          <>
            {seat === 1 && <span class="cw-vs-word">{t('vs')}</span>}
            <span class={contest && m.winner === seat ? 'cw-side won' : 'cw-side'}>
              {contest && m.winner === seat && <Icon name="crown" size={14} stroke={2} />}
              <b>{p.name || t('Someone')}</b>
              {p.leader && <small>{cardOf(p.leader).name}</small>}
              <small class="cw-rt" title={t('Rating after the match')}>{num(p.rating)}</small>
            </span>
          </>
        ))}
      </div>
      <div class="cw-meta">
        <span>{m.at ? whenOf(m.at) : '—'}</span>
        <span>{mode}</span>
        <span>{reasonName(m.reason)}{!contest && <span class="cw-tag">{t('no contest')}</span>}</span>
        <span>{minText(m.minutes)} · {t('{n} turns', { n: num(m.turns) })}</span>
        {m.players[m.firstSeat] && <span>{t('{name} went first', { name: m.players[m.firstSeat].name || t('Someone') })}</span>}
      </div>
    </li>
  );
}
