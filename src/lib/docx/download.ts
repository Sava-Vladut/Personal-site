// Download as Word (.docx): the note's pictures read as the app shows them (photos from this device's IndexedDB, web
// images from their address), turned into a format Word reads where they aren't one, then the file made
// (./document.ts) and saved. Loaded only when asked for (a dynamic import), so the app doesn't carry it.
import { itemKey, itemsOf, parseBody, type Item } from '../body';
import { formatDate, parseKey } from '../dates';
import { lang, t } from '../i18n';
import { imageSrc } from '../images';
import { photoBlob } from '../photos';
import type { Entry } from '../store';
import { buildDocx, docxName, type DocxPicture } from './document';

const WORD = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const KEEP: Record<string, DocxPicture['type']> = { 'image/png': 'png', 'image/jpeg': 'jpeg', 'image/gif': 'gif' };

/** A picture's bytes, as PNG, JPEG or GIF (others, WebP and the like, drawn on white and saved as JPEG); null if it can't be read. */
async function asPicture(blob: Blob): Promise<DocxPicture | null> {
  const bmp = await createImageBitmap(blob);
  try {
    const kept = KEEP[blob.type];
    if (kept) return { data: new Uint8Array(await blob.arrayBuffer()), type: kept, width: bmp.width, height: bmp.height };
    const canvas = document.createElement('canvas');
    canvas.width = bmp.width;
    canvas.height = bmp.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, bmp.width, bmp.height);
    ctx.drawImage(bmp, 0, 0);
    const jpeg = await new Promise<Blob | null>((done) => canvas.toBlob(done, 'image/jpeg', 0.9));
    return jpeg ? { data: new Uint8Array(await jpeg.arrayBuffer()), type: 'jpeg', width: bmp.width, height: bmp.height } : null;
  } finally {
    bmp.close();
  }
}

/** A web image's file, the full one or else its smaller copy (a site that doesn't allow it to be read: null). */
async function webBlob(e: Entry, url: string): Promise<Blob | null> {
  const img = e.images.find((i) => i.url === url) ?? { url };
  for (const src of new Set([imageSrc(img, 'full'), imageSrc(img, 'thumb')])) {
    try {
      const res = await fetch(src, { mode: 'cors', referrerPolicy: 'no-referrer', signal: AbortSignal.timeout(15_000) });
      if (res.ok) return await res.blob();
    } catch {
      // the next one, or none
    }
  }
  return null;
}

async function picture(e: Entry, it: Item): Promise<DocxPicture | null> {
  try {
    const blob = it.kind === 'photo' ? await photoBlob(it.id) : await webBlob(e, it.url);
    return blob ? await asPicture(blob) : null;
  } catch {
    return null;
  }
}

/** The date line under the title: the note's day written out (and its last day, for a note over several). */
function dateLine(e: Entry): string {
  const long = (k: string) => {
    const s = formatDate(parseKey(k), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    return s.charAt(0).toUpperCase() + s.slice(1);
  };
  return e.dateEnd && e.dateEnd !== e.date ? `${long(e.date)} – ${long(e.dateEnd)}` : long(e.date);
}

/** Makes the note's .docx (`text`: its text now) and downloads it. */
export async function downloadDocx(e: Entry, text: string, comments: boolean): Promise<void> {
  const items = new Map<string, Item>();
  for (const m of parseBody(text).media) for (const it of itemsOf(m)) items.set(itemKey(it), it);
  const pictures = new Map<string, DocxPicture | null>();
  await Promise.all([...items].map(async ([key, it]) => pictures.set(key, await picture(e, it))));
  const bytes = await buildDocx({
    title: e.title,
    date: dateLine(e),
    text,
    created: e.created,
    updated: e.updated,
    lang,
    comments,
    author: t('Me'),
    pictures,
  });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([bytes as BlobPart], { type: WORD }));
  a.download = docxName(e.title, e.date);
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
