import { useEffect, useLayoutEffect, useState } from 'preact/hooks';
import { goBack } from '../lib/router';
import { countdownName, parts, progress, removeCountdown, saveCountdown, useCountdowns, useNow, type Countdown as C } from '../lib/countdown';
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
  // the ones still to come or counting down, ending soonest first; then the ones over, the latest first
  const live = all.filter((c) => c.end > now).sort((a, b) => a.end - b.end);
  const over = all.filter((c) => c.end <= now).sort((a, b) => b.end - a.end);

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

/** One countdown, ticking: its name, a ring with the days left, the clock and how far along it is. The only one going gets tiles too. */
function Running({ c, solo, onEdit }: { c: C; solo: boolean; onEdit: () => void }) {
  const now = useNow(1000);
  const done = now >= c.end;
  const p = progress(c, now);
  const left = parts(c.end - now);
  const gone = parts(Math.max(0, Math.min(now, c.end) - c.start));
  const total = parts(c.end - c.start);
  const name = countdownName(c);
  return (
    <>
      <section class={`card hero cd-hero${done ? ' done' : ''}`}>
        <div class="cd-head">
          <h2 class="cd-name">{name}</h2>
          <button class="icon-btn" onClick={onEdit} aria-label={t('Change {name}', { name })} title={t('Change {name}', { name })}><Icon name="pencil" size={18} /></button>
        </div>
        <div class="tile-label">{done ? t('The countdown is over') : now < c.start ? t('Starts {when}', { when: when.format(c.start) }) : t('Time left')}</div>
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
        {!solo && <p class="muted small cd-dates">{t('From {start} to {end}', { start: short.format(c.start), end: short.format(c.end) })}</p>}
        {done && <button class="btn btn-quiet" onClick={onEdit}><Icon name="pencil" size={18} /> {t('Set new dates')}</button>}
      </section>

      {solo && (
        <div class="tiles">
          <Tile k={0} icon="clock" label={t('Began')} value={short.format(c.start)} sub={now < c.start ? t('Not yet') : t('{d} d {h} h ago', { d: gone.d, h: gone.h })} />
          <Tile k={1} icon="hourglass" label={t('Gone by')} value={`${gone.d} d ${pad(gone.h)} h`} sub={t('{n}% of the way', { n: Math.floor(p * 100) })} />
          <Tile k={2} icon="calendar-event" label={t('Ends')} value={short.format(c.end)} sub={done ? t('It’s over') : t('in {d} d {h} h', { d: left.d, h: left.h })} />
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
      <div class="key-date-form">
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
        <p class={ok && !error ? 'muted small' : 'share-error'} role={error ? 'alert' : undefined}>
          {error || (ok ? t('It counts down on every device you’re signed in on. The one ending soonest shows next to the wheel.') : t('The countdown has to end after it starts.'))}
        </p>
      </div>
    </Sheet>
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
