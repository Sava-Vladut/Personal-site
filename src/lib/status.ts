// The public status: one link (/status/<token>) that always shows your latest check-in, for anyone who has it. It's off
// until turned on, needs the admin password, and shows the feeling, how strong it was and when; the check-in's note, the
// people you were thinking of (by name), the place's name and the weather only when each is chosen (Status.show), and
// your name above it if you gave one; the countdown too, while it lasts, if chosen. While it's on, each device that's signed in sends the newest check-in it knows of
// whenever that changes. Stopping deletes it from the server, and turning it on again makes a new link.
import { EMOTION, shortName } from '../data/emotions';
import { getDeleted, getEntries, observable, onEntries, type Entry } from './store';
import { detailsOf, plainTags, type PublicDetails } from './share';
import { t, type Lang } from './i18n';

/** A check-in as the public page shows it. */
export interface PublicCheckin {
  emotion: string;
  name: string;
  intensity: number;
  time: number;
  text?: string;
  details?: Pick<PublicDetails, 'people' | 'place' | 'weather'>;
}
/** What the server keeps: the same, with the entry it came from. */
type Published = PublicCheckin & { id: string };

/** Which of a check-in's details the public page shows, and whether the countdown (lib/countdown.ts) shows under it. */
export interface Show { note: boolean; people: boolean; place: boolean; weather: boolean; countdown: boolean }
export const SHOW_NONE: Show = { note: false, people: false, place: false, weather: false, countdown: false };

/** The status as this device knows it: off (token null), on, or not known yet / unreachable (null). lang: the page's language, or '' for each reader's own. */
export interface Status { token: string | null; show: Show; owner: string; lang: Lang | ''; checkin: Published | null }

const status$ = observable<Status | null>(null);
const error$ = observable('');
export const useStatus = status$.use;
export const useStatusError = error$.use;

export const statusUrl = (token: string) => `${location.origin}/status/${token}`;

/** The newest check-in that names a feeling. */
export function latestCheckin(entries: Entry[] = getEntries()): Entry | null {
  let best: Entry | null = null;
  for (const e of entries) if (e.kind === 'checkin' && EMOTION[e.emotions[0]] && (!best || e.time > best.time)) best = e;
  return best;
}

/** What the public page would show for this check-in. */
export function publicCheckin(e: Entry, show: Show): Published {
  const id = e.emotions[0];
  const em = EMOTION[id];
  const text = show.note ? plainTags(e.text).trim() : '';
  const details = detailsOf(e, (['people', 'place', 'weather'] as const).filter((k) => show[k]));
  return {
    id: e.id, emotion: id, name: em.depth === 0 ? shortName(id) : em.name, intensity: e.intensity, time: e.time,
    ...(text && { text }), ...(details && { details }),
  };
}

async function call(method: string, body?: object): Promise<Status> {
  let r: Response;
  try {
    r = await fetch('/api/status', {
      method,
      cache: 'no-store',
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new Error(t('Couldn’t reach the server. Check your connection.'));
  }
  if (r.status === 204) return { token: null, show: SHOW_NONE, owner: '', lang: '', checkin: null };
  const out = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(out.error || t('Something went wrong on the server.'));
  return { token: out.token ?? null, show: { ...SHOW_NONE, ...out.show }, owner: out.owner ?? '', lang: out.lang === 'en' || out.lang === 'ro' ? out.lang : '', checkin: out.checkin ?? null };
}

/** Asks the server whether the status is on, and what it shows. */
export async function loadStatus() {
  try {
    status$.set(await call('GET'));
    error$.set('');
  } catch (e) {
    error$.set((e as Error).message);
  }
}

/** What was last sent, so a check-in the server tidied up (a rounded temperature…) isn't sent again and again. */
let lastSent = '';
const send = async (show: Show, owner: string, lang: Lang | '') => {
  const latest = latestCheckin();
  const checkin = latest && publicCheckin(latest, show);
  const s = await call('PUT', { show, owner, lang, checkin });
  lastSent = JSON.stringify(checkin);
  status$.set(s);
  return s;
};

/** Turns the status on, or changes what it shows, the name above it or its language, with the newest check-in. */
export const shareStatus = (show: Show, owner: string, lang: Lang | '') => send(show, owner, lang);

/** Takes the status down: its link stops working at once. */
export async function stopStatus() {
  status$.set(await call('DELETE'));
}

const same = (a: Published | null, b: Published | null) => JSON.stringify(a) === JSON.stringify(b);

/** Whether this device should replace what the status shows with its own newest check-in. */
function shouldSend(s: Status) {
  if (!s.token) return false;
  const latest = latestCheckin();
  const mine = latest && publicCheckin(latest, s.show);
  if (same(mine, s.checkin) || JSON.stringify(mine) === lastSent) return false;
  // A device that hasn't synced yet mustn't roll the status back to an older check-in: only when the one shown was
  // deleted here, or edited here (then it's the newest one this device knows of, or was moved earlier), does it go back.
  const shown = s.checkin;
  if (shown && (!mine || mine.time < shown.time)) return shown.id in getDeleted() || getEntries().some((e) => e.id === shown.id);
  return true;
}

let timer: ReturnType<typeof setTimeout> | undefined;
let sending = false;
function check() {
  clearTimeout(timer);
  timer = setTimeout(async () => {
    const s = status$.get();
    if (!s || sending || !shouldSend(s)) return;
    sending = true;
    let sent = false;
    try {
      await send(s.show, s.owner, s.lang);
      sent = true;
    } catch {
      // tried again with the next change, or the next time the app opens
    } finally {
      sending = false;
    }
    if (sent) check(); // a check-in logged while this was on its way
  }, 1500);
}

/** On a signed-in device: learns whether the status is on, then keeps it showing the newest check-in. */
export function initStatus() {
  void loadStatus().then(check);
  onEntries(check);
}
