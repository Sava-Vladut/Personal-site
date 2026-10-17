import { useEffect, useState } from 'preact/hooks';
import { EMOTION, shortName } from '../data/emotions';
import { addDays, formatDate, keyOf, todayKey } from '../lib/dates';
import type { PublicCheckin } from '../lib/status';
import { INTENSITY, trail } from '../components/emotion';
import { Sprite } from '../components/icons';
import { t } from '../lib/i18n';
import '../styles/shared.css';

type Public = { checkin: PublicCheckin | null; updated: number };
type State = Public | 'gone' | 'loading' | 'error';

async function read(token: string): Promise<Public | 'gone'> {
  const r = await fetch(`/api/status/${token}`, { cache: 'no-store' });
  if (r.status === 404) return 'gone';
  if (!r.ok) throw new Error();
  return r.json();
}

/** "12 min ago", and the day and time it was. */
function when(time: number) {
  const m = Math.max(0, Math.round((Date.now() - time) / 60_000));
  const ago = m < 1 ? t('just now') : m < 60 ? t('{n} min ago', { n: m }) : m < 1440 ? t('{n} h ago', { n: Math.round(m / 60) }) : '';
  const day = keyOf(new Date(time));
  const clock = formatDate(time, { hour: '2-digit', minute: '2-digit' });
  const date = day === todayKey() ? t('Today') : day === addDays(todayKey(), -1) ? t('Yesterday') : formatDate(time, { weekday: 'short', day: 'numeric', month: 'short' });
  return [ago, `${date}, ${clock}`].filter(Boolean).join(' · ');
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

  const c = typeof state === 'object' ? state.checkin : null;
  const em = c ? EMOTION[c.emotion] : null;
  useEffect(() => {
    document.title = em ? t('Status: {name}', { name: em.depth === 0 ? shortName(em.id) : em.name }) : t('Status');
  }, [em]);

  if (typeof state === 'string' || !em || !c) {
    const title = state === 'gone' ? t('This status isn’t shared') : state === 'error' ? t('Couldn’t load this status') : state === 'loading' ? t('Loading…') : t('No check-in yet');
    return (
      <main class="app route-shared">
        <div class="page shared">
          <div class="empty">
            <h2 class="title-s">{title}</h2>
            {state === 'gone' && <p>{t('The link may have been stopped, or it was typed wrong.')}</p>}
            {state === 'error' && <><p>{t('Check your connection and try again.')}</p><button class="btn" onClick={() => location.reload()}>{t('Try again')}</button></>}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main class="app route-shared">
      <article class="page shared status-page">
        <div class="status-label">{t('How I’m feeling')}</div>
        <section class="card status-card" style={{ '--c': `var(--emo-${em.core})`, '--k': c.intensity }}>
          <span class="status-sprite"><Sprite core={em.core} size={44} idle /></span>
          <h1 class="status-name">{em.depth === 0 ? shortName(em.id) : em.name}</h1>
          {em.depth > 0 && <div class="status-trail">{trail(em.id)}</div>}
          <div class="status-meter" role="img" aria-label={INTENSITY[c.intensity - 1]}>
            {[1, 2, 3, 4, 5].map((n) => <i class={n <= c.intensity ? 'on' : ''} />)}
            <span>{INTENSITY[c.intensity - 1]}</span>
          </div>
          {c.text && <blockquote class="status-note">{c.text}</blockquote>}
          <div class="status-when">{when(c.time)}</div>
        </section>
        <footer class="shared-foot">{t('Shared from My Mind')}</footer>
      </article>
    </main>
  );
}
