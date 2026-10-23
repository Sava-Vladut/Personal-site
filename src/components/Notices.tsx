// The bar under the date (a widget on the journal's panel): what today is waiting on, a line each. Lines that need
// you come first and glow, with a dot that breathes, until you see to them; the rest are just news.
import type { ComponentChildren, FunctionComponent } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import type { Release } from '../data/changelog';
import { EMOTION, shortName } from '../data/emotions';
import { useNow } from '../lib/countdown';
import { timeLabel, todayKey } from '../lib/dates';
import { count, LOCALE, t } from '../lib/i18n';
import { dayMood } from '../lib/mood';
import { navigate } from '../lib/router';
import { useSongs, type Entry } from '../lib/store';
import { usePoints } from '../lib/twitch';
import { Icon, Sprite, type UiName } from './icons';
import { streakOf, type DayPick } from './SongOfDay';

/** How long after a check-in the bar asks for the next one. */
const CHECKIN_EVERY = 2 * 3600_000;
/** The last version whose news you've opened, on this device. */
const SEEN = 'mm-seen-version';

/** "1h 20m", "45m": a stretch of time, to the minute. */
function spanLabel(ms: number) {
  const m = Math.max(1, Math.round(ms / 60_000));
  if (m < 60) return t('{m}m', { m });
  return m % 60 ? t('{h}h {m}m', { h: Math.floor(m / 60), m: m % 60 }) : t('{h}h', { h: m / 60 });
}

const feltName = (id: string) => {
  const em = EMOTION[id];
  return em.depth === 0 ? shortName(em.id) : em.name;
};

export type News = ReturnType<typeof useNews>;

/**
 * The newest release, and its sheet once asked for: both load after the journal, so its first paint stays light. The
 * sheet is drawn outside the day's panel (by Journal, like the song picker), where the panel can't clip it.
 */
export function useNews() {
  const [latest, setLatest] = useState<Release | null>(null);
  const [seen, setSeen] = useState(() => {
    try { return localStorage.getItem(SEEN); } catch { return null; }
  });
  const [Sheet, setSheet] = useState<FunctionComponent<{ open: boolean; onClose: () => void }> | null>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    import('../data/changelog').then((m) => setLatest(m.CHANGELOG[0]), () => {});
  }, []);
  const show = () => {
    if (!latest) return;
    try { localStorage.setItem(SEEN, latest.version); } catch {}
    import('./Changelog').then((m) => {
      setSheet(() => m.ChangelogSheet);
      setOpen(true);
    }, () => {});
  };
  // the line stays while the sheet is open, so it doesn't jump away under your finger
  const fresh = !!latest && (latest.version !== seen || open);
  const sheet = Sheet && <Sheet open={open} onClose={() => { setOpen(false); setSeen(latest?.version ?? null); }} />;
  return { latest: fresh ? latest : null, show, sheet };
}

function Notice({ c, icon, title, sub, due, onClick }: {
  c: string; icon: ComponentChildren; title: ComponentChildren; sub: ComponentChildren; due?: boolean; onClick: () => void;
}) {
  return (
    <button class={due ? 'notice due' : 'notice'} style={{ '--c': c }} onClick={onClick}>
      <span class="notice-ico">{icon}</span>
      <span class="notice-main"><b>{title}</b><small>{sub}</small></span>
      {due && <i class="notice-dot" aria-hidden="true" />}
      <Icon name="chevron-right" size={16} />
    </button>
  );
}

const ico = (name: UiName) => <Icon name={name} size={18} />;

/**
 * A nudge to pick today's song while it's unpicked (with the run you'd keep going), the next check-in every couple of hours while
 * you're up (a ring round the last feeling fills until it's due), a nudge in the evening to write about the day, the
 * Twitch channels the miner is watching live, and the news after the app updates.
 */
export function Notices({ entries, picker, news }: { entries: Entry[]; picker: DayPick; news: News }) {
  const now = useNow(60_000);
  const songs = useSongs();
  const { data: points } = usePoints();
  const today = todayKey();
  const hour = new Date(now).getHours();
  // no nudges through the night
  const awake = hour >= 8 && hour < 23;
  const todays = entries.filter((e) => e.date === today);
  const last = todays.find((e) => e.kind === 'checkin' && e.emotions.length);
  const em = last ? EMOTION[last.emotions[0]] : null;
  const since = last ? now - last.time : Infinity;
  const rows: { key: string; due: boolean; node: ComponentChildren }[] = [];

  // today's song only while it's still to pick
  if (songs.length && awake && !songs.some((s) => s.days.includes(today))) {
    const streak = streakOf(new Set(songs.flatMap((s) => s.days)), today);
    rows.push({ key: 'song', due: true, node: (
      <Notice c="var(--emo-sadness)" icon={ico('music')} title={t('Pick today’s song')} due onClick={() => picker.open(today)}
        sub={streak > 1 ? t('Keep your {n}-day run going', { n: streak }) : t('The day doesn’t have a record yet')} />
    ) });
  }

  if (em && since < CHECKIN_EVERY) {
    const r = 16.5, len = 2 * Math.PI * r;
    rows.push({ key: 'checkin', due: false, node: (
      <Notice c={`var(--emo-${em.core})`} onClick={() => navigate('tracker')}
        icon={<>
          <svg class="notice-ring" viewBox="0 0 36 36" aria-hidden="true">
            <circle cx="18" cy="18" r={r} class="notice-track" />
            <circle cx="18" cy="18" r={r} class="notice-fill" style={{ strokeDasharray: len, strokeDashoffset: len * (1 - since / CHECKIN_EVERY) }} />
          </svg>
          <Sprite core={em.core} size={14} />
        </>}
        title={t('Next check-in in {time}', { time: spanLabel(CHECKIN_EVERY - since) })}
        sub={t('Last felt {name} at {time}', { name: feltName(em.id), time: timeLabel(last!.time) })} />
    ) });
  } else if (awake) {
    rows.push({ key: 'checkin', due: true, node: (
      <Notice c={em ? `var(--emo-${em.core})` : 'var(--emo-joy)'} icon={ico('mood-plus')} title={t('Time to check in')} due onClick={() => navigate('tracker')}
        sub={em ? t('{time} since {name}', { time: spanLabel(since), name: feltName(em.id) }) : t('Nothing yet today')} />
    ) });
  }

  // the evening: the day's been felt but not written about
  if (hour >= 20 && awake && !todays.some((e) => e.kind === 'note')) {
    const mood = dayMood(todays);
    const checkins = todays.filter((e) => e.kind === 'checkin').length;
    rows.push({ key: 'note', due: true, node: (
      <Notice c={mood ? `var(--emo-${mood.worlds[0]})` : 'var(--emo-calm-safety)'} icon={ico('pencil')} title={t('Write about today')} due onClick={() => navigate('note/new')}
        sub={[mood?.word, checkins ? count(checkins, 'check-in', 'check-ins') : t('A few lines before the day ends')].filter(Boolean).join(' · ')} />
    ) });
  }

  const live = points?.channels.filter((c) => c.live) ?? [];
  if (points && live.length) {
    rows.push({ key: 'live', due: false, node: (
      <Notice c="var(--emo-fear)" icon={<><Icon name="brand-twitch" size={18} /><i class="notice-live" aria-hidden="true" /></>} onClick={() => navigate('twitch')}
        title={t('{names} live now', { names: live.map((c) => c.name).join(', ') })}
        sub={t('{n} channel points today', { n: `${points.change.day > 0 ? '+' : ''}${points.change.day.toLocaleString(LOCALE)}` })} />
    ) });
  }

  if (news.latest) {
    rows.push({ key: 'news', due: false, node: (
      <Notice c="var(--emo-hope-interest)" icon={ico('sparkles')} onClick={news.show}
        title={t('Updated to {v}', { v: news.latest.version })} sub={news.latest.changes[0]} />
    ) });
  }

  // what needs you first; the order otherwise stays put
  rows.sort((a, b) => +b.due - +a.due);
  return rows.length ? <div class="notices card fade-arrive">{rows.map((r) => <div key={r.key} class="notice-slot">{r.node}</div>)}</div> : null;
}
