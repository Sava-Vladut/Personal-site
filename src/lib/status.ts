// The public status: one link (/status/<token>) that always shows your latest check-in, for anyone who has it. It's off
// until turned on, needs the admin password, and shows the feeling, how strong it was and when; the check-in's note only
// when "Show the note" is on. While it's on, each device that's signed in sends the newest check-in it knows of whenever
// that changes. Stopping deletes it from the server, and turning it on again makes a new link.
import { EMOTION, shortName } from '../data/emotions';
import { getDeleted, getEntries, observable, onEntries, type Entry } from './store';
import { plainTags } from './share';
import { t } from './i18n';

/** A check-in as the public page shows it. */
export interface PublicCheckin { emotion: string; name: string; intensity: number; time: number; text?: string }
/** What the server keeps: the same, with the entry it came from. */
type Published = PublicCheckin & { id: string };

/** The status as this device knows it: off (token null), on, or not known yet / unreachable (null). */
export interface Status { token: string | null; note: boolean; checkin: Published | null }

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
export function publicCheckin(e: Entry, note: boolean): Published {
  const id = e.emotions[0];
  const em = EMOTION[id];
  const text = note ? plainTags(e.text).trim() : '';
  return { id: e.id, emotion: id, name: em.depth === 0 ? shortName(id) : em.name, intensity: e.intensity, time: e.time, ...(text && { text }) };
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
  if (r.status === 204) return { token: null, note: false, checkin: null };
  const out = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(out.error || t('Something went wrong on the server.'));
  return { token: out.token ?? null, note: out.note === true, checkin: out.checkin ?? null };
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

const send = async (note: boolean) => {
  const latest = latestCheckin();
  const s = await call('PUT', { note, checkin: latest && publicCheckin(latest, note) });
  status$.set(s);
  return s;
};

/** Turns the status on (or changes whether it shows the note), with the newest check-in. */
export const shareStatus = (note: boolean) => send(note);

/** Takes the status down: its link stops working at once. */
export async function stopStatus() {
  status$.set(await call('DELETE'));
}

const same = (a: Published | null, b: Published | null) => JSON.stringify(a) === JSON.stringify(b);

/** Whether this device should replace what the status shows with its own newest check-in. */
function shouldSend(s: Status) {
  if (!s.token) return false;
  const latest = latestCheckin();
  const mine = latest && publicCheckin(latest, s.note);
  if (same(mine, s.checkin)) return false;
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
      await send(s.note);
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
