// Face ID lock, off by default. Turning it on makes a passkey for this site on this device; opening My Mind,
// coming back to it after a while, and going to People then ask the device to confirm it's you with that
// passkey (Face ID on an iPhone, with its passcode as the fallback). The journal lives on the device, so this
// is a lock on the app here, not an account: nothing about it is sent to the server.
import { observable } from './store';
import { t } from './i18n';

const KEY = 'mm-lock';
/** Away longer than this and the app locks again; People locks as soon as you leave it or the app. */
const RELOCK_MS = 2 * 60_000;
const PEOPLE_GRACE_MS = 10_000;

export interface LockStatus {
  on: boolean;
  /** The whole app is waiting for Face ID. */
  locked: boolean;
  /** People has been opened with Face ID during this visit. */
  people: boolean;
}

function loadId(): string | null {
  try {
    const s = JSON.parse(localStorage.getItem(KEY) || 'null');
    return typeof s?.id === 'string' && /^[A-Za-z0-9_-]{8,}$/.test(s.id) ? s.id : null;
  } catch {
    return null;
  }
}
let credential = loadId();
function saveId(id: string | null) {
  credential = id;
  try {
    if (id) localStorage.setItem(KEY, JSON.stringify({ id }));
    else localStorage.removeItem(KEY);
  } catch {}
}

const lock$ = observable<LockStatus>({ on: !!credential, locked: !!credential, people: false });
export const useLock = lock$.use;
export const getLock = lock$.get;
const publish = (patch: Partial<LockStatus>) => lock$.set({ ...lock$.get(), ...patch });

const ua = typeof navigator === 'undefined' ? '' : navigator.userAgent;
/**
 * iPhone and iPad: Safari only goes straight to Face ID when it's asked from a tap. Asked any other way, it
 * first shows its own "sign in with a passkey" sheet that needs a Continue, so there the lock waits for a tap.
 */
export const isIOS = /iPhone|iPad/.test(ua) || (/Macintosh/.test(ua) && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1);

/** What the device calls the way it checks it's you. */
export const unlockName = (() => {
  if (isIOS) return 'Face ID';
  if (/Macintosh/.test(ua)) return 'Touch ID';
  if (/Windows/.test(ua)) return 'Windows Hello';
  return t('biometrics');
})();

/** Whether this device has a built-in way to confirm it's you (Face ID, Touch ID, Windows Hello…). */
export async function lockSupported() {
  try {
    return !!window.PublicKeyCredential && (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable());
  } catch {
    return false;
  }
}

const b64url = (buf: ArrayBuffer | Uint8Array) =>
  btoa(String.fromCharCode(...new Uint8Array(buf instanceof Uint8Array ? buf : new Uint8Array(buf)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64url = (s: string) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
const random = (n: number) => crypto.getRandomValues(new Uint8Array(n));

/** The device said it checked who you are (the UV flag), for the challenge we just made, on this site. */
function confirmed(response: AuthenticatorResponse & { authenticatorData?: ArrayBuffer; getAuthenticatorData?: () => ArrayBuffer }, challenge: Uint8Array, type: string) {
  try {
    const client = JSON.parse(new TextDecoder().decode(response.clientDataJSON));
    if (client.type !== type || client.challenge !== b64url(challenge) || client.origin !== location.origin) return false;
    const data = response.authenticatorData ?? response.getAuthenticatorData?.();
    return !data || (new Uint8Array(data)[32] & 0x04) !== 0;
  } catch {
    return false;
  }
}

// one question at a time: a new one (say, a tap on Unlock) replaces one still waiting
let pending: AbortController | null = null;
function fresh() {
  pending?.abort();
  return (pending = new AbortController());
}

/** Makes a new passkey for the lock; making it already asks for Face ID. */
async function create(): Promise<string> {
  const challenge = random(32);
  const ac = fresh();
  const cred = (await navigator.credentials.create({
    signal: ac.signal,
    publicKey: {
      challenge,
      rp: { name: 'My Mind', id: location.hostname },
      user: { id: random(16), name: 'My Mind', displayName: 'My Mind' },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'preferred' },
      attestation: 'none',
      timeout: 60_000,
    },
  })) as PublicKeyCredential | null;
  if (!cred || !confirmed(cred.response, challenge, 'webauthn.create')) throw new Error(t('{name} didn’t confirm it’s you', { name: unlockName }));
  return b64url(cred.rawId);
}

/** Asks for Face ID with the lock's passkey. Resolves once it's you; rejects if it was cancelled or failed. */
async function verify(): Promise<void> {
  if (!credential) return;
  const challenge = random(32);
  const ac = fresh();
  const cred = (await navigator.credentials.get({
    signal: ac.signal,
    publicKey: {
      challenge,
      rpId: location.hostname,
      allowCredentials: [{ type: 'public-key', id: unb64url(credential), transports: ['internal'] }],
      userVerification: 'required',
      timeout: 60_000,
    },
  })) as PublicKeyCredential | null;
  if (!cred || b64url(cred.rawId) !== credential || !confirmed(cred.response, challenge, 'webauthn.get')) {
    throw new Error(t('{name} didn’t confirm it’s you', { name: unlockName }));
  }
}

/** A short line for why it didn't work. A cancelled prompt says nothing. */
export function lockError(e: unknown): string | null {
  const name = (e as DOMException)?.name;
  if (name === 'AbortError') return null;
  if (name === 'NotAllowedError') return t('{name} was cancelled or didn’t recognise you.', { name: unlockName });
  if (name === 'InvalidStateError') return t('{name} is already set up for My Mind on this device.', { name: unlockName });
  return (e as Error)?.message || t('{name} isn’t available right now.', { name: unlockName });
}

export async function enableLock() {
  saveId(await create());
  publish({ on: true, locked: false, people: true });
}

/** Turning it off asks for Face ID first, so it can't just be switched off by whoever holds the phone. */
export async function disableLock() {
  await verify();
  saveId(null);
  publish({ on: false, locked: false, people: false });
}

export async function unlockApp() {
  await verify();
  publish({ locked: false });
}

export async function unlockPeople() {
  await verify();
  publish({ people: true, locked: false });
}

/**
 * When the passkey is gone (deleted from Passwords, or the device was restored), make a new one instead.
 * Making it also needs Face ID or the device passcode, so it's still only the phone's owner who gets in.
 */
export async function replacePasskey(then: 'app' | 'people') {
  saveId(await create());
  publish(then === 'people' ? { people: true, locked: false } : { locked: false });
}

/** People locks again once you leave it. */
export function leftPeople() {
  if (lock$.get().people) publish({ people: false });
}

let hiddenAt = 0;
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (!lock$.get().on) return;
    if (document.hidden) hiddenAt = Date.now();
    else if (hiddenAt) {
      const away = Date.now() - hiddenAt;
      hiddenAt = 0;
      publish({
        locked: lock$.get().locked || away > RELOCK_MS,
        people: lock$.get().people && away <= PEOPLE_GRACE_MS,
      });
    }
  });
}
