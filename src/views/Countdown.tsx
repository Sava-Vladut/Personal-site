import { useEffect, useId, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { goBack } from '../lib/router';
import { biggest, biggestText, countdownName, parts, progress, removeCountdown, saveCountdown, unitWord, useCountdowns, useNow, type Countdown as C } from '../lib/countdown';
import { toast } from '../lib/store';
import { RevealStack } from '../components/charts';
import { PageHead } from '../components/PageHead';
import { Icon, type UiName } from '../components/icons';
import { Sheet } from '../components/Sheet';
import { Sky } from '../components/Sky';
import { LOCALE, count, t } from '../lib/i18n';
import '../styles/stats.css';
import '../styles/countdown.css';
import '../styles/shared.css'; // .share-error

const WORLD = 'calm-safety';
const when = new Intl.DateTimeFormat(LOCALE, { weekday: 'short', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
const short = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const pad = (n: number) => String(n).padStart(2, '0');
/** A span, short, in its two biggest units: "3 d 05 h", "5 h 20 min", "4 min 09 s". */
function span(ms: number) {
  const x = parts(ms);
  return x.d ? t('{d} d {h} h', { d: x.d, h: pad(x.h) }) : x.h ? t('{h} h {m} min', { h: x.h, m: pad(x.m) }) : t('{m} min {s} s', { m: x.m, s: pad(x.s) });
}
/** How long one ended stays up top, celebrated, before it joins the ones over. */
const JUST = 15 * 60_000;
/** The lengths the sheet offers in a tap. */
const LENGTHS = [3_600_000, 86_400_000, 7 * 86_400_000, 30 * 86_400_000];
/** A time as a datetime-local input wants it, in this device's time. */
const localInput = (ms: number) => new Date(ms - new Date(ms).getTimezoneOffset() * 60000).toISOString().slice(0, 16);

/** The page wears the countdown's colour; charts and tiles read the accent from the root. */
function useAccent() {
  useLayoutEffect(() => {
    const root = document.documentElement.style;
    root.setProperty('--accent', `var(--emo-${WORLD})`);
    return () => root.removeProperty('--accent');
  }, []);
}

/** The countdowns' page, under Insights: how long each has left, where new ones start, and where each is changed or removed. */
export function Countdown() {
  useAccent();
  const all = useCountdowns();
  const now = useNow(60_000);
  const [sheet, setSheet] = useState<{ open: boolean; value: C | null }>({ open: false, value: null });
  const edit = (value: C | null) => setSheet({ open: true, value });
  // the ones still to come or counting down (and one that's only just ended), ending soonest first; then the ones over, the latest first
  const live = all.filter((c) => c.end > now - JUST).sort((a, b) => a.end - b.end);
  const over = all.filter((c) => c.end <= now - JUST).sort((a, b) => b.end - a.end);

  return (
    <div class="page stats-page cd-page">
      <div class="journal-top stats-top" style={{ '--sky': `var(--emo-${WORLD})` }}>
        <Sky world={WORLD} />
        <PageHead
          title={t('Countdowns')}
          back={() => goBack()}
          subtitle={live.length ? count(live.length, 'countdown running', 'countdowns running') : t('Count the days to something, and change when')}
          actions={<button class="glass glass-btn round" onClick={() => edit(null)} aria-label={t('New countdown')} title={t('New countdown')}><Icon name="plus" /></button>}
        />
      </div>

      {all.length ? (
        <RevealStack>
          {live.map((c) => <Running key={c.id} c={c} solo={live.length === 1} onEdit={() => edit(c)} />)}
          {over.length > 0 && (
            <section class="section cd-over">
              <h2 class="section-title">{t('Over')}</h2>
              <div class="card list">
                {over.map((c) => (
                  <button key={c.id} class="list-row action" onClick={() => edit(c)} aria-label={t('Change {name}', { name: countdownName(c) })}>
                    <span>
                      <span>{countdownName(c)}</span>
                      <span class="muted small cd-over-when">{t('Ended {when}', { when: short.format(c.end) })}</span>
                    </span>
                    <Icon name="pencil" size={18} />
                  </button>
                ))}
              </div>
            </section>
          )}
        </RevealStack>
      ) : (
        <div class="empty">
          <h2 class="title-s">{t('No countdown')}</h2>
          <p>{t('Pick when it starts and ends. You can have as many going as you like.')}</p>
          <button class="btn btn-primary" onClick={() => edit(null)}><Icon name="plus" size={18} /> {t('New countdown')}</button>
        </div>
      )}
      <CountdownSheet open={sheet.open} value={sheet.value} onClose={() => setSheet((s) => ({ ...s, open: false }))} />
    </div>
  );
}

/**
 * One countdown, ticking: its name, the dial with what's left, the clock and how far along it is. The only one going gets
 * tiles too. It turns warmer in its last hour, red and beating in its last minute, and bursts when it ends.
 */
function Running({ c, solo, onEdit }: { c: C; solo: boolean; onEdit: () => void }) {
  const now = useNow(1000);
  const done = now >= c.end;
  const p = progress(c, now);
  // rounded up, as a countdown reads: it shows 1 second until it's over
  const ms = done ? 0 : Math.ceil((c.end - now) / 1000) * 1000;
  const left = parts(ms);
  const gone = Math.max(0, Math.min(now, c.end) - c.start);
  const total = biggest(c.end - c.start);
  const name = countdownName(c);
  const phase = done ? ' done' : ms <= 10_000 ? ' is-near is-last is-final' : ms <= 60_000 ? ' is-near is-last' : ms <= 3_600_000 ? ' is-near' : '';
  // a buzz on a phone when it ends while you watch
  const watching = useRef(!done);
  useEffect(() => {
    if (done && watching.current) navigator.vibrate?.([90, 60, 90, 60, 240]);
  }, [done]);
  return (
    <>
      <section class={`card hero cd-hero${phase}`}>
        <div class="cd-head">
          <h2 class="cd-name">{name}</h2>
          <button class="icon-btn" onClick={onEdit} aria-label={t('Change {name}', { name })} title={t('Change {name}', { name })}><Icon name="pencil" size={18} /></button>
        </div>
        <div class="tile-label">
          {done ? t('The countdown is over') : now < c.start ? t('Starts {when}', { when: when.format(c.start) }) : ms <= 60_000 ? t('Final seconds') : t('Time left')}
        </div>
        <Dial p={p} ms={ms} done={done} />
        {!done && (
          <div class="cd-clock" role="timer" aria-live="off" aria-label={t('{d} days, {h} hours, {m} minutes and {s} seconds left', { d: left.d, h: left.h, m: left.m, s: left.s })}>
            {left.d > 0 && <Unit n={left.d} label={t('days')} />}
            <Unit n={left.h} label={t('hours')} />
            <Unit n={left.m} label={t('min')} />
            <Unit n={left.s} label={t('sec')} hot />
          </div>
        )}
        <div class="cd-bar" aria-hidden="true"><i style={{ transform: `scaleX(${p})` }} /></div>
        <div class="split-labels">
          <span>{t('{n}% through', { n: Math.floor(p * 100) })}</span>
          <span><b>{total.n}</b> {unitWord(total.n, total.unit)} {t('in all')}</span>
        </div>
        {!solo && <p class="muted small cd-dates">{t('From {start} to {end}', { start: short.format(c.start), end: short.format(c.end) })}</p>}
        {done && <button class="btn btn-quiet" onClick={onEdit}><Icon name="pencil" size={18} /> {t('Set new dates')}</button>}
      </section>

      {solo && (
        <div class="tiles">
          <Tile k={0} icon="clock" label={t('Began')} value={short.format(c.start)} sub={now < c.start ? t('Not yet') : t('{span} ago', { span: span(gone) })} />
          <Tile k={1} icon="hourglass" label={t('Gone by')} value={span(gone)} sub={t('{n}% of the way', { n: Math.floor(p * 100) })} />
          <Tile k={2} icon="calendar-event" label={t('Ends')} value={short.format(c.end)} sub={done ? t('It’s over') : t('in {span}', { span: span(ms) })} />
        </div>
      )}
    </>
  );
}

/** Starts a countdown or changes one: a name, when it starts and when it ends. Removing it is here too. */
function CountdownSheet({ open, value, onClose }: { open: boolean; value: C | null; onClose: () => void }) {
  const [name, setName] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!open) return;
    // an ended one starts afresh from now; one still running keeps its dates
    const fresh = !value || value.end <= Date.now();
    const now = new Date();
    now.setSeconds(0, 0);
    setName(value?.name ?? '');
    setStart(localInput(fresh ? now.getTime() : value.start));
    setEnd(localInput(fresh ? now.getTime() + 7 * 86_400_000 : value.end));
    setError('');
  }, [open]);

  const s = new Date(start).getTime(), e = new Date(end).getTime();
  const ok = Number.isFinite(s) && Number.isFinite(e) && e > s;
  const run = async (work: () => Promise<void>, done: string) => {
    setBusy(true);
    setError('');
    try {
      await work();
      toast(done);
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };
  const save = () => ok && run(() => saveCountdown({ ...(value && { id: value.id }), name: name.trim(), start: s, end: e }), value ? t('Countdown changed') : t('Countdown started'));
  // gone at once, with Undo (as a book, a person or a song is): the same countdown comes back by its id
  const remove = async () => {
    if (!value) return;
    const { id, name: was, start: from, end: to } = value;
    setBusy(true);
    setError('');
    try {
      await removeCountdown(id);
      toast(t('Countdown removed'), { label: t('Undo'), run: () => saveCountdown({ id, name: was, start: from, end: to }) });
      onClose();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={value ? t('Change the countdown') : t('New countdown')}
      footer={
        <div class="row gap-s">
          {value && <button class="btn btn-quiet danger" onClick={remove} disabled={busy}><Icon name="trash" size={18} /> {t('Remove')}</button>}
          <button class="btn btn-primary grow" onClick={save} disabled={!ok || busy}>{value ? t('Save') : t('Start')}</button>
        </div>
      }
    >
      <div class="key-date-form cd-form">
        <label class="cd-field">
          <span class="field-label">{t('Name')} <span class="muted">· {t('optional')}</span></span>
          <input class="input" value={name} maxLength={60} placeholder={t('Countdown')} onInput={(ev) => setName(ev.currentTarget.value)} />
        </label>
        <label class="cd-field">
          <span class="field-label">{t('Starts')}</span>
          <input class="input" type="datetime-local" value={start} onInput={(ev) => setStart(ev.currentTarget.value)} />
        </label>
        <label class="cd-field">
          <span class="field-label">{t('Ends')}</span>
          <input class="input" type="datetime-local" value={end} min={start} onInput={(ev) => setEnd(ev.currentTarget.value)} aria-invalid={!ok} />
        </label>
        <div class="chips cd-lengths" role="group" aria-label={t('How long it lasts')}>
          {LENGTHS.map((len) => (
            <button key={len} type="button" class="chip" aria-pressed={ok && e - s === len} disabled={!Number.isFinite(s)} onClick={() => setEnd(localInput(s + len))}>
              {biggestText(len)}
            </button>
          ))}
        </div>
        <p class={ok && !error ? 'muted small' : 'share-error'} role={error ? 'alert' : undefined}>
          {error || (ok ? t('Lasts {span}.', { span: span(e - s) }) + ' ' + t('It counts down on every device you’re signed in on. The one ending soonest shows next to the wheel.') : t('The countdown has to end after it starts.'))}
        </p>
      </div>
    </Sheet>
  );
}

/** The dial's sixty ticks, one a second, every fifth longer. */
const TICKS = Array.from({ length: 60 }, (_, i) => {
  const a = (i / 60) * 2 * Math.PI, long = i % 5 === 0;
  const r1 = long ? 89 : 92, r2 = 97;
  return { i, x1: 100 + r1 * Math.cos(a), y1: 100 + r1 * Math.sin(a), x2: 100 + r2 * Math.cos(a), y2: 100 + r2 * Math.sin(a), long };
});
/** The rays it bursts into when it ends. */
const RAYS = Array.from({ length: 16 }, (_, k) => k);

/**
 * The dial: a pie of the time gone by under a thick ring that fills, a hand at its edge, a dot sweeping the seconds round
 * the ticks, and what's left in the middle, in its biggest unit (hours under a day, never "0 days"). Each part that moves
 * is its own box, turned whole.
 */
function Dial({ p, ms, done }: { p: number; ms: number; done: boolean }) {
  const id = useId();
  const { n, unit } = biggest(ms);
  const secs = ms / 1000;
  // clockwise, reaching the top as each minute runs out; a jump (the tab was away) doesn't spin round to catch up
  const sweep = -secs * 6;
  const was = useRef(sweep);
  const glide = Math.abs(sweep - was.current) <= 12;
  was.current = sweep;
  const r = 80, len = 2 * Math.PI * r;
  const final = !done && secs <= 10;
  return (
    <div class="cd-ring" style={{ '--p': p }} aria-hidden="true">
      <div class="cd-glow" />
      <div class="cd-pie" />
      <svg class="cd-dial" viewBox="0 0 200 200">
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" class="cd-stop-a" />
            <stop offset="1" class="cd-stop-b" />
          </linearGradient>
        </defs>
        {TICKS.map((k) => <line key={k.i} x1={k.x1} y1={k.y1} x2={k.x2} y2={k.y2} class={`cd-tickmark${k.long ? ' long' : ''}${k.i / 60 < p ? ' on' : ''}`} />)}
        <circle cx="100" cy="100" r={r} class="cd-track" />
        <circle cx="100" cy="100" r={r} class="cd-fill" stroke={`url(#${id})`} style={{ '--len': len, strokeDasharray: len, strokeDashoffset: len * (1 - p) }} />
      </svg>
      {p > 0 && <div class="cd-hand" style={{ transform: `rotate(${p}turn)` }}><i /></div>}
      {!done && <div class={`cd-sweep${glide ? '' : ' jump'}`} style={{ transform: `rotate(${sweep}deg)` }}><i /></div>}
      {final && <span key={secs} class="cd-wave" />}
      {done && <div class="cd-burst">{RAYS.map((k) => <span key={k} style={{ '--k': k }}><i /></span>)}</div>}
      <div class="cd-hub">
        <b key={done ? 'done' : unit === 's' ? secs : n + unit}>{done ? '✓' : n}</b>
        <span>{done ? t('Done') : unitWord(n, unit)}</span>
      </div>
    </div>
  );
}

function Unit({ n, label, hot }: { n: number; label: string; hot?: boolean }) {
  return (
    <div class={`cd-unit${hot ? ' hot' : ''}`}>
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
