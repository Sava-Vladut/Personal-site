import type { ComponentChildren } from 'preact';
import { useLayoutEffect } from 'preact/hooks';
import { goBack } from '../lib/router';
import { keyOf, shortDate } from '../lib/dates';
import { hoursText, useGlops, type GlopsDay, type GlopsStats } from '../lib/glops';
import { barPath, ChartCard, CountUp, HeatLegend, RevealStack, TipRow, tipProps, useWidth, type Table } from '../components/charts';
import { Busy, evenTop, minuteBuckets, OnlineCard, Spread } from '../components/playerCharts';
import { PageHead } from '../components/PageHead';
import { Icon, type UiName } from '../components/icons';
import { Sky } from '../components/Sky';
import { LOCALE, t } from '../lib/i18n';
import '../styles/stats.css';
import '../styles/glops.css';

const num = (n: number) => n.toLocaleString(LOCALE);
const dateOf = (iso: string | null) => (iso ? shortDate(keyOf(new Date(iso))) : '—');

/** The page wears hope's green; charts and tooltips read the accent from the root. */
function useAccent() {
  useLayoutEffect(() => {
    const root = document.documentElement.style;
    root.setProperty('--accent', 'var(--emo-hope-interest)');
    return () => root.removeProperty('--accent');
  }, []);
}

export function Glops({ switcher }: { switcher?: ComponentChildren }) {
  useAccent();
  const { data, error, loading } = useGlops();

  return (
    <div class="page stats-page gl-page">
      <div class="journal-top stats-top" style={{ '--sky': 'var(--emo-hope-interest)' }}>
        <Sky world="hope-interest" />
        <PageHead
          title={switcher ? t('Game statistics') : t('Global Ops')}
          back={() => goBack()}
          subtitle={data ? t('Offline since {date}', { date: dateOf(data.now) }) : t('Global Ops is offline')}
        />
        {switcher}
      </div>

      {!data ? (
        error ? (
          <div class="empty fade-arrive-soft">
            <h2 class="title-s">{t('No player stats')}</h2>
            <p>{error}</p>
          </div>
        ) : (
          <p class="empty-note center loading-note">{loading ? t('Loading…') : ''}</p>
        )
      ) : (
        <Board data={data} />
      )}
    </div>
  );
}

function Board({ data }: { data: GlopsStats }) {
  const last = data.days.at(-1);
  const avg = data.sessions ? data.onlineMin / data.sessions : 0;
  return (
    <RevealStack>
      <section class="card gl-offline" role="status">
        <h3 class="chart-title">{t('Global Ops is offline')}</h3>
        <p>{t('The game and its servers were taken down on {date}. These are the final stats, from {since} to the end.', { date: dateOf(data.now), since: dateOf(data.since) })}</p>
      </section>

      <section class="card hero gl-hero">
        <div class="tile-label">{t('Players in total')}</div>
        <div class="hero-row">
          <span class="hero-num"><CountUp value={data.visitors} /></span>
          <img src="/games/glops.webp" alt="" class="gl-mark" decoding="async" />
        </div>
        <div class="gl-facts">
          <span><b>{num(data.peak.online.n)}</b> {t('the most ever')}</span>
        </div>
      </section>

      <div class="tiles">
        <Tile k={0} icon="trophy" label={t('Most online')} value={num(data.peak.online.n)} sub={dateOf(data.peak.online.at)} />
        <Tile k={1} icon="crown" label={t('Most in a match')} value={num(data.peak.playing.n)} sub={dateOf(data.peak.playing.at)} />
        <Tile k={2} icon="users" label={t('Visits')} value={num(data.sessions)} sub={t('{n} players', { n: num(data.visitors) })} />
        <Tile k={3} icon="clock" label={t('Hours played')} value={hoursText(data.playMin)} sub={t('{n} matches joined', { n: num(data.plays) })} />
        <Tile k={4} icon="hourglass" label={t('Average visit')} value={avg ? hoursText(avg) : '—'} sub={t('longest {time}', { time: data.longest.min ? hoursText(data.longest.min) : '—' })} />
        <Tile k={5} icon="calendar" label={t('Last day')} value={num(last?.visitors ?? 0)} sub={t('{n} new · {m} at once', { n: last?.new ?? 0, m: last?.peak ?? 0 })} />
      </div>

      <OnlineCard now={data.now} series={data.series} />
      <DaysCard days={data.days} now={data.now} />

      <ChartCard title={t('Busy hours')} sub={t('Hours played by day and time, in your time zone')} legend={<HeatLegend />}>
        <Busy week={data.week} />
      </ChartCard>

      <Spread
        title={t('How long people stay')}
        sub={t('Every visit since counting started')}
        counts={data.lengths.counts}
        name={minuteBuckets(data.lengths.bounds)}
        empty={t('Visits show up here once people leave the game.')}
      />

      <p class="gl-note">
        {t('Online means the game is open in a browser; in a match means playing on one of the servers. Players are told apart by a scrambled form of their address, never the address itself, and no names are kept.')}
      </p>
    </RevealStack>
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

/* ---------- players per day ---------- */

function DaysCard({ days, now }: { days: GlopsDay[]; now: string }) {
  const by = new Map(days.map((d) => [d.day, d]));
  const end = new Date(now);
  const shown: (GlopsDay & { none?: boolean })[] = [];
  for (let i = 29; i >= 0; i--) {
    const k = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate() - i)).toISOString().slice(0, 10);
    shown.push(by.get(k) ?? { day: k, peak: 0, playing: 0, visitors: 0, new: 0, sessions: 0, plays: 0, playMin: 0, none: true });
  }
  const table: Table = {
    head: [t('Day'), t('Players'), t('New'), t('Most at once'), t('Played')],
    rows: shown.filter((d) => !d.none).reverse().map((d) => [shortDate(d.day), d.visitors, d.new, d.peak, hoursText(d.playMin)]),
  };
  return (
    <ChartCard title={t('Players per day')} sub={t('The last 30 days')} table={table}>
      {table.rows.length ? <DayBars days={shown} /> : <p class="empty-note">{t('Nobody has played yet.')}</p>}
    </ChartCard>
  );
}

function DayBars({ days }: { days: (GlopsDay & { none?: boolean })[] }) {
  const [ref, W] = useWidth();
  const H = 150, L = 28, R = 4, T = 10, B = 24;
  const pw = Math.max(0, W - L - R), ph = H - T - B;
  const slot = pw / days.length, bw = Math.max(2, slot - 2);   // a 2px gap between bars
  const top = evenTop(Math.max(...days.map((d) => d.visitors)));
  const y = (v: number) => T + (1 - v / top) * ph;
  return (
    <div ref={ref} class="chart">
      {W > 0 && (
        <svg width={W} height={H} role="img" aria-label={t('Players per day')}>
          {[0, top / 2, top].map((v) => (
            <>
              <line x1={L} x2={L + pw} y1={y(v)} y2={y(v)} class="grid" />
              <text x={L - 8} y={y(v) + 4} class="tick" text-anchor="end">{v}</text>
            </>
          ))}
          {days.map((d, i) => (
            <g class="chart-mark" {...tipProps(() => (
              <>
                <div class="tip-title">{shortDate(d.day)}</div>
                {d.none ? <TipRow value="—" label={t('not counted')} /> : (
                  <>
                    <TipRow value={d.visitors} label={t('players')} color="var(--accent)" />
                    <TipRow value={d.new} label={t('new')} />
                    <TipRow value={d.peak} label={t('most at once')} />
                    <TipRow value={hoursText(d.playMin)} label={t('played')} />
                  </>
                )}
              </>
            ), `${shortDate(d.day)}: ${d.visitors} ${t('players')}`)}>
              <rect x={L + i * slot} y={T} width={slot} height={ph} fill="transparent" />
              {d.visitors > 0 && <path class="bar up" d={barPath(L + i * slot + 1, bw, y(0), y(d.visitors))} fill="var(--accent)" style={{ '--t': (i / days.length).toFixed(3) }} />}
            </g>
          ))}
          {[0, 10, 20, 29].map((i) => (
            <text x={L + (i + 0.5) * slot} y={H - 6} class="tick" text-anchor={i === 0 ? 'start' : i === 29 ? 'end' : 'middle'}>{shortDate(days[i].day)}</text>
          ))}
        </svg>
      )}
    </div>
  );
}
