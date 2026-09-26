// Talks to our own server (server/index.js), which holds the Pinterest app secret and
// keeps the access token in an encrypted, http-only cookie. The browser never sees either.
import type { PinImage } from './store';

export interface PinStatus {
  configured: boolean;   // server has PINTEREST_APP_ID / SECRET
  connected: boolean;    // this browser has signed in to Pinterest
  user?: { username: string; image?: string };
  redirect?: string;     // the redirect URI to register with the Pinterest app
}
export interface Board { id: string; name: string; count: number; cover?: string }
export interface Pin extends PinImage { id: string; thumb: string }
export interface Page<T> { items: T[]; bookmark?: string }

async function get<T>(path: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch('/api/pinterest' + path, { credentials: 'same-origin' });
  } catch {
    throw new Error('Can’t reach the server. Pinterest needs the app’s server running (npm start).');
  }
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Pinterest request failed (${res.status})`);
  return body as T;
}

export const pinStatus = () =>
  get<PinStatus>('/status').catch(() => ({ configured: false, connected: false, offline: true }) as PinStatus & { offline: true });

export const resolvePin = (url: string) => get<PinImage>('/resolve?url=' + encodeURIComponent(url.trim()));
export const listBoards = (bookmark?: string) => get<Page<Board>>('/boards' + (bookmark ? '?bookmark=' + encodeURIComponent(bookmark) : ''));
export const listPins = (board: string | null, bookmark?: string) =>
  get<Page<Pin>>((board ? `/boards/${encodeURIComponent(board)}/pins` : '/pins') + (bookmark ? '?bookmark=' + encodeURIComponent(bookmark) : ''));

export const connectPinterest = () => {
  location.href = '/api/pinterest/connect';
};
export const disconnectPinterest = () => fetch('/api/pinterest/disconnect', { method: 'POST' });

/** Pinterest serves several widths from the same path; 236x/474x/736x/originals are interchangeable. */
export const sized = (url: string, w: 236 | 474 | 736) => url.replace(/i\.pinimg\.com\/(\d+x|originals)\//, `i.pinimg.com/${w}x/`);
