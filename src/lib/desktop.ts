// The Windows app (desktop/): a small native window that opens savavlad.com. Inside it, before any page script runs,
// the app defines a frozen window.myMindDesktop, which is how the site knows it's there. Settings offers the download.

/** The newest Windows app release. Bump it when a new exe goes out, so older apps are told there's an update. */
export const DESKTOP_VERSION = '1.0.0';
/** Always the newest release's exe, on GitHub. */
export const DESKTOP_DOWNLOAD = 'https://github.com/Sava-Vladut/Personal-site/releases/latest/download/MyMind.exe';

export type DesktopApp = { readonly platform: 'windows'; readonly version: string };

declare global {
  interface Window {
    readonly myMindDesktop?: DesktopApp;
  }
}

/** The Windows app this page runs in, or null in a browser. */
export function desktopApp(): DesktopApp | null {
  const app = typeof window !== 'undefined' ? window.myMindDesktop : undefined;
  return app && typeof app.version === 'string' ? app : null;
}

/** Dotted versions compared number by number: below 0 when a is older than b, 0 when they're the same, above 0 when newer. */
export function compareVersions(a: string, b: string) {
  const x = a.split('.'), y = b.split('.');
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (parseInt(x[i] ?? '0', 10) || 0) - (parseInt(y[i] ?? '0', 10) || 0);
    if (d) return Math.sign(d);
  }
  return 0;
}

/**
 * Whether to offer the Windows app here: 'windows' on a Windows computer, 'other' on a Mac, Linux or ChromeOS computer
 * (shown, saying it's for Windows), null on a phone or tablet. An iPad asking for the desktop site says it's a Mac but
 * has a touch screen, and Android's desktop mode says Linux but has no mouse, so both count as tablets.
 */
export function desktopOffer(): 'windows' | 'other' | null {
  if (typeof navigator === 'undefined') return null;
  const ua = navigator.userAgent;
  if (/Android|iPhone|iPad|iPod|Mobile/i.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return null;
  // any Windows 10 or 11 machine runs it, a touchscreen one too
  if (/Windows NT/.test(ua)) return 'windows';
  if (matchMedia('(hover: none) and (pointer: coarse)').matches) return null;
  return /Macintosh|Linux|X11|CrOS/.test(ua) ? 'other' : null;
}
