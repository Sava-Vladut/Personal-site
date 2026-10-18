import { useLayoutEffect } from 'preact/hooks';
import { goBack } from '../lib/router';
import { END, START, parts, progress, useNow } from '../lib/countdown';
import { RevealStack } from '../components/charts';
import { PageHead } from '../components/PageHead';
import { Icon, type UiName } from '../components/icons';
import { Sky } from '../components/Sky';
import { LOCALE, t } from '../lib/i18n';
import '../styles/stats.css';
import '../styles/countdown.css';

const WORLD = 'calm-safety';
const when = new Intl.DateTimeFormat(LOCALE, { weekday: 'short', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
const short = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const pad = (n: number) => String(n).padStart(2, '0');

/** The page wears the countdown's colour; charts and tiles read the accent from the root. */
function useAccent() {
  useLayoutEffect(() => {
    const root = document.documentElement.style;
    root.setProperty('--accent', `var(--emo-${WORLD})`);
    return () => root.removeProperty('--accent');
  }, []);
}

export function Countdown() {
  useAccent();
  const now = useNow(1000);
  const done = now >= END;
  const p = progress(now);
  const left = parts(END - now);
  const gone = parts(Math.min(now, END) - START);
  const total = parts(END - START);

  return (
    <div class="page stats-page cd-page">
      <div class="journal-top stats-top" style={{ '--sky': `var(--emo-${WORLD})` }}>
        <Sky world={WORLD} />
        <PageHead
          title={t('Countdown')}
          back={() => goBack()}
          subtitle={t('From {start} to {end}', { start: when.format(START), end: when.format(END) })}
        />
      </div>

      <RevealStack>
        <section class={`card hero cd-hero${done ? ' done' : ''}`}>
          <div class="tile-label">{done ? t('The countdown is over') : t('Time left')}</div>
          <Ring p={p} label={done ? '✓' : String(left.d)} sub={done ? t('Done') : left.d === 1 ? t('day') : t('days')} />
          <div class="cd-clock" role="timer" aria-live="off" aria-label={t('{d} days, {h} hours, {m} minutes and {s} seconds left', { d: left.d, h: left.h, m: left.m, s: left.s })}>
            <Unit n={left.d} label={t('days')} />
            <Unit n={left.h} label={t('hours')} />
            <Unit n={left.m} label={t('min')} />
            <Unit n={left.s} label={t('sec')} />
          </div>
          <div class="cd-bar" aria-hidden="true"><i style={{ transform: `scaleX(${p})` }} /></div>
          <div class="split-labels">
            <span>{t('{n}% through', { n: Math.floor(p * 100) })}</span>
            <span><b>{total.d}</b> {t('days in all')}</span>
          </div>
        </section>

        <div class="tiles">
          <Tile k={0} icon="clock" label={t('Began')} value={short.format(START)} sub={t('{d} d {h} h ago', { d: gone.d, h: gone.h })} />
          <Tile k={1} icon="hourglass" label={t('Gone by')} value={`${gone.d} d ${pad(gone.h)} h`} sub={t('{n}% of the way', { n: Math.floor(p * 100) })} />
          <Tile k={2} icon="calendar-event" label={t('Ends')} value={short.format(END)} sub={done ? t('It’s over') : t('in {d} d {h} h', { d: left.d, h: left.h })} />
        </div>
      </RevealStack>
    </div>
  );
}

/** A ring that fills as the time goes by, with the days left in the middle. */
function Ring({ p, label, sub }: { p: number; label: string; sub: string }) {
  const r = 52, len = 2 * Math.PI * r;
  return (
    <div class="cd-ring" aria-hidden="true">
      <svg viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={r} class="cd-track" />
        <circle cx="60" cy="60" r={r} class="cd-fill" style={{ strokeDasharray: len, strokeDashoffset: len * (1 - p) }} />
      </svg>
      <div class="cd-ring-text">
        <b>{label}</b>
        <span>{sub}</span>
      </div>
    </div>
  );
}

function Unit({ n, label }: { n: number; label: string }) {
  return (
    <div class="cd-unit">
      <b key={n}>{pad(n)}</b>
      <span>{label}</span>
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
      <div class="tile-value small">{value}</div>
      <div class="tile-sub">{sub}</div>
    </div>
  );
}
