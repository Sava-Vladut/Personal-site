// Making one note public. The journal stays on your devices; a note you share is copied to the server as plain text and
// pictures, and anyone with its link (/s/<token>) can read it. Each note is its own decision: nothing is shared until
// you turn it on for that note, the admin password is needed to do it, and "Stop sharing" deletes the public copy.
// The note remembers its link and a fingerprint of what was published, so it can tell when it has changed since.
import { photoBlob } from './photos';
import { toast, type Entry, type Share, type WebImage } from './store';
import { t } from './i18n';

/** What the public page shows: the words and pictures of a note, and the day. Feelings, people, place, weather and music stay private. */
export interface PublicNote {
  title: string;
  text: string;
  date: string;
  dateEnd: string | null;
  images: WebImage[];
  photos: { id: string; w: number; h: number }[];
  cover: Entry['cover'];
}

/** Tags written in the text, as the plain words they stand for: @[Ana] → Ana, [[note:id|Title]] → Title, ♪[Song] → ♪ Song. */
export function plainTags(text: string) {
  return text
    .replace(/@\[(?:person:[^\]|\n]+\|)?([^\]\n]+)\]/g, '$1')
    .replace(/♪\[(?:song:[^\]|\n]+\|)?([^\]\n]+)\]/g, '♪ $1')
    .replace(/\[\[(?!(?:photo|image|album):)(?:[^\]|\n]+\|)?([^\]\n]+)\]\]/g, '$1');
}

export function publicNote(e: Entry): PublicNote {
  return {
    title: e.title.trim(),
    text: plainTags(e.text),
    date: e.date,
    dateEnd: e.dateEnd,
    images: e.images,
    photos: e.photos.map(({ id, w, h }) => ({ id, w, h })),
    cover: e.cover,
  };
}

/** A short fingerprint of what would be published, to tell whether the public copy is still the note. */
export function fingerprint(note: PublicNote) {
  const s = JSON.stringify(note);
  let a = 0xdeadbeef, b = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    a = Math.imul(a ^ c, 2654435761);
    b = Math.imul(b ^ c, 1597334677);
  }
  a = Math.imul(a ^ (a >>> 16), 2246822507) ^ Math.imul(b ^ (b >>> 13), 3266489909);
  b = Math.imul(b ^ (b >>> 16), 2246822507) ^ Math.imul(a ^ (a >>> 13), 3266489909);
  return (4294967296 * (2097151 & b) + (a >>> 0)).toString(36);
}

/** Whether the note has changed since it was made public. */
export const changedSince = (e: Entry) => !!e.share && e.share.hash !== fingerprint(publicNote(e));

export const shareUrl = (token: string) => `${location.origin}/s/${token}`;

export interface SharedItem { token: string; title: string; date: string; dateEnd: string | null; shared: number; excerpt: string }

async function call<T>(method: string, path: string, body?: BodyInit | object, type?: string): Promise<T> {
  let r: Response;
  const raw = body instanceof Blob;
  try {
    r = await fetch('/api/share' + path, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': raw ? type! : 'application/json' },
      body: body === undefined ? undefined : raw ? body : JSON.stringify(body),
    });
  } catch {
    throw new Error(t('Couldn’t reach the server. Check your connection.'));
  }
  if (r.status === 204) return undefined as T;
  const out = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(out.error || t('Something went wrong on the server.')), { status: r.status });
  return out;
}

/** Makes the note public (or brings its public copy up to date) and returns what the note should remember. */
export async function publish(e: Entry): Promise<Share> {
  const note = publicNote(e);
  let result: { token: string; missing: string[] } | null = null;
  let created = false;
  if (e.share) {
    try {
      result = await call('PUT', '/' + e.share.token, note);
    } catch (error) {
      // the server no longer has it (its data was cleared): publish it again under a new link
      if ((error as { status?: number }).status !== 404) throw error;
    }
  }
  if (!result) {
    result = await call('POST', '', note);
    created = true;
  }
  const { token, missing } = result!;
  try {
    for (const id of missing) {
      const blob = await photoBlob(id);
      if (blob) await call('PUT', `/${token}/${id}`, blob, blob.type || 'image/webp');
    }
  } catch (error) {
    if (created) await unpublish(token).catch(() => {});
    throw error;
  }
  return { token, hash: fingerprint(note) };
}

/** Takes the public copy down: the link stops working at once. */
export const unpublish = (token: string) => call<void>('DELETE', '/' + token);

export const listShared = () => call<{ notes: SharedItem[] }>('GET', '').then((r) => r.notes);

/** After a public note is deleted from the journal, its public copy goes too. */
export function takeDown(e: Entry | null | undefined) {
  if (!e?.share) return;
  unpublish(e.share.token).catch(() => toast(t('The note is gone, but its public link is still up. Stop sharing it in Settings.')));
}

/** The public note as the server has it (the public page; no sign-in). */
export async function readShared(token: string): Promise<PublicNote & { shared: number } | 'gone'> {
  let r: Response;
  try {
    r = await fetch(`/api/share/${token}`, { cache: 'no-store' });
  } catch {
    throw new Error(t('Couldn’t reach the server. Check your connection.'));
  }
  if (r.status === 404) return 'gone';
  if (!r.ok) throw new Error(t('Something went wrong on the server.'));
  return r.json();
}
