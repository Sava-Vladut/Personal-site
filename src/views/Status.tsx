import { useEffect, useState } from 'preact/hooks';
import { EMOTION, shortName } from '../data/emotions';
import { fmtTemp, weatherIcon, weatherName } from '../data/weather';
import { addDays, formatDate, keyOf, todayKey } from '../lib/dates';
import type { PublicCheckin } from '../lib/status';
import { END, countdownOn, parts, progress, useNow } from '../lib/countdown';
import type { Person } from '../lib/store';
import { INTENSITY, trail } from '../components/emotion';
import { Icon, Sprite } from '../components/icons';
import { Avatar } from '../components/people';
import { LOCALE, t } from '../lib/i18n';
import '../styles/shared.css';

type Public = { owner: string; checkin: PublicCheckin | null; updated: number; countdown?: boolean };
type State = Public | 'gone' | 'loading' | 'error';

async function read(token: string): Promise<Public | 'gone'> {
  const r = await fetch(`/api/status/${token}`, { cache: 'no-store' });
  if (r.status === 404) return 'gone';
  if (!r.ok) throw new Error();
  return r.json();
}

/** "12 min ago" (or '' once it's a day old). */
function ago(time: number) {
  const m = Math.max(0, Math.round((Date.now() - time) / 60_000));
  return m < 1 ? t('just now') : m < 60 ? t('{n} min ago', { n: m }) : m < 1440 ? t('{n} h ago', { n: Math.round(m / 60) }) : '';
}

/** "Today, 14:32" */
function at(time: number) {
  const day = keyOf(new Date(time));
  const clock = formatDate(time, { hour: '2-digit', minute: '2-digit' });
  const date = day === todayKey() ? t('Today') : day === addDays(todayKey(), -1) ? t('Yesterday') : formatDate(time, { weekday: 'short', day: 'numeric', month: 'short' });
  return `${date}, ${clock}`;
}

/** Someone's latest check-in, read by anyone with the link. No journal, no sign-in: this page never touches the reader's storage. */
export function Status({ token }: { token: string }) {
  const [state, setState] = useState<State>('loading');
  const [, tick] = useState(0);
  useEffect(() => {
    let alive = true;
    const load = (quiet: boolean) => {
      if (!quiet) setState('loading');
      read(token).then((s) => alive && setState(s), () => alive && !quiet && setState('error'));
    };
    load(false);
    // a status changes: look again every minute while it's open, and when it's come back to
    const every = setInterval(() => document.visibilityState === 'visible' && load(true), 60_000);
    const back = () => document.visibilityState === 'visible' && load(true);
    document.addEventListener('visibilitychange', back);
    return () => {
      alive = false;
      clearInterval(every);
      document.removeEventListener('visibilitychange', back);
    };
  }, [token]);
  // "12 min ago" keeps counting between loads
  useEffect(() => {
    const id = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(id);
  }, []);

  const owner = typeof state === 'object' ? state.owner : '';
  const c = typeof state === 'object' ? state.checkin : null;
  const em = c ? EMOTION[c.emotion] : null;
  const feeling = em ? (em.depth === 0 ? shortName(em.id) : em.name) : '';
  useEffect(() => {
    document.title = [owner, feeling].filter(Boolean).join(' · ') || t('Status');
  }, [owner, feeling]);
  // the phone's bars take the feeling's colour too
  useEffect(() => {
    if (!em) return;
    const meta = document.querySelector('meta[name="theme-color"]');
    const before = meta?.getAttribute('content');
    const color = getComputedStyle(document.documentElement).getPropertyValue(`--emo-${em.core}`).trim();
    if (meta && color) meta.setAttribute('content', color);
    return () => void (before && meta?.setAttribute('content', before));
  }, [em?.core]);

  if (typeof state === 'string' || !em || !c) {
    const title = state === 'gone' ? t('This status isn’t shared') : state === 'error' ? t('Couldn’t load this status') : state === 'loading' ? '' : t('No check-in yet');
    return (
      <main class="app route-shared route-status">
        <div class="status-view is-empty">
          {state === 'loading' ? <span class="status-loading" aria-label={t('Loading…')} /> : (
            <div class="empty">
              <h2 class="title-s">{title}</h2>
              {state === 'gone' && <p>{t('The link may have been stopped, or it was typed wrong.')}</p>}
              {state === 'error' && <><p>{t('Check your connection and try again.')}</p><button class="btn" onClick={() => location.reload()}>{t('Try again')}</button></>}
              {typeof state === 'object' && <p>{owner ? t('{name} hasn’t checked in yet. This page shows the next one by itself.', { name: owner }) : t('This page shows the next check-in by itself.')}</p>}
            </div>
          )}
          {typeof state === 'object' && state.countdown && countdownOn() && <Countdown />}
        </div>
      </main>
    );
  }

  const d = c.details;
  const fresh = Date.now() - c.time < 3_600_000;
  const since = ago(c.time);

  return (
    <main class="app route-shared route-status" style={{ '--c': `var(--emo-${em.core})` }}>
      <div class="status-glow" aria-hidden="true" />
      <article class="status-view">
        <header class="status-top">
          <span class="status-who">{owner || t('My status')}</span>
          <span class={`status-ago${fresh ? ' is-fresh' : ''}`}>
            <i aria-hidden="true" />
            {since || at(c.time)}
          </span>
        </header>

        <section class="status-hero">
          <div class="status-orb"><Sprite core={em.core} size={68} idle /></div>
          <p class="status-kicker">{owner ? t('{name} is feeling', { name: owner }) : t('I’m feeling')}</p>
          <h1 class="status-name">{feeling}</h1>
          {em.depth > 0 && <p class="status-trail">{trail(em.id)}</p>}
          <div class="status-meter" role="img" aria-label={t('Intensity: {level}', { level: INTENSITY[c.intensity - 1] })}>
            <span class="status-bars">{[1, 2, 3, 4, 5].map((n) => <i class={n <= c.intensity ? 'on' : ''} />)}</span>
            <span class="status-level">{INTENSITY[c.intensity - 1]}</span>
          </div>
          <p class="status-def">{em.def}</p>
        </section>

        {c.text && (
          <figure class="status-card status-quote">
            <span class="status-quote-mark" aria-hidden="true">“</span>
            <blockquote>{c.text}</blockquote>
          </figure>
        )}

        {d?.people && (
          <section class="status-card">
            <h2 class="status-card-title"><Icon name="heart" size={15} /> {t('Thinking of')}</h2>
            <div class="status-people">
              {d.people.map((p, i) => (
                <span key={i} class="status-person">
                  <Avatar p={{ name: p.name, icon: p.icon, emotions: [] } as unknown as Person} size={30} />
                  <span>{p.name}</span>
                </span>
              ))}
            </div>
          </section>
        )}

        {(d?.place || d?.weather) && (
          <div class="status-context">
            {d.place && <span class="status-pill"><Icon name="map-pin" size={16} /> {d.place.name}</span>}
            {d.weather && (
              <span class="status-pill">
                <Icon name={weatherIcon(d.weather.code, d.weather.dark)} size={16} /> {fmtTemp(d.weather.temp)} · {weatherName(d.weather.code)}
              </span>
            )}
          </div>
        )}

        {state.countdown && countdownOn() && <Countdown />}

        <footer class="status-foot">
          <span>{since ? at(c.time) : t('Checked in {when}', { when: at(c.time) })}</span>
          <span class="status-brand">{t('Updates by itself · My Mind')}</span>
        </footer>
      </article>
    </main>
  );
}

const pad = (n: number) => String(n).padStart(2, '0');
const until = new Intl.DateTimeFormat(LOCALE, { weekday: 'short', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });

/** The app's countdown (lib/countdown.ts), ticking live, when the status chose to show it. Gone by itself on 1 November. */
function Countdown() {
  const now = useNow(1000);
  if (!countdownOn(now)) return null;
  const done = now >= END;
  const left = parts(END - now);
  const p = progress(now);
  const units: [number, string][] = [[left.d, t('days')], [left.h, t('hours')], [left.m, t('min')], [left.s, t('sec')]];
  return (
    <section class="status-card status-countdown">
      <h2 class="status-card-title"><Icon name="hourglass" size={15} /> {t('Countdown')}</h2>
      {done ? (
        <p class="status-cd-done">{t('The countdown is over')}</p>
      ) : (
        <div class="status-cd-clock" role="timer" aria-label={t('{d} days, {h} hours, {m} minutes and {s} seconds left', { d: left.d, h: left.h, m: left.m, s: left.s })}>
          {units.map(([n, label]) => (
            <span class="status-cd-unit" aria-hidden="true">
              <b>{pad(n)}</b>
              <span>{label}</span>
            </span>
          ))}
        </div>
      )}
      <div class="status-cd-bar" aria-hidden="true"><i style={{ transform: `scaleX(${p})` }} /></div>
      <p class="status-cd-sub">
        <span>{t('{n}% through', { n: Math.floor(p * 100) })}</span>
        <span>{t('Until {when}', { when: until.format(END) })}</span>
      </p>
    </section>
  );
}
