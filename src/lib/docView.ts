import { useEffect, useState } from 'preact/hooks';

/**
 * How a note is shown while writing, the way Word's View tab and status bar set it: how big the page is (zoom),
 * Focus (nothing but the page), whether the ribbon is folded down to its tabs, whether the Navigation pane is open
 * (on a computer) and whether comments show (Review › Show comments). Kept per device, and shared by
 * everything that shows or changes it (the ribbon, the status bar), so they always agree.
 *
 * While a note is open (applyDocView) the root element carries it for the stylesheets: `--doc-zoom` (1 = 100%),
 * `data-note-focus` while in Focus, `data-ribbon="open" | "collapsed"`, `data-nav-pane` while the pane is open and
 * `data-comments-off` while comments are hidden.
 */
export interface DocView {
  /** 0.8 to 1.5 */
  zoom: number;
  focus: boolean;
  ribbon: 'open' | 'collapsed';
  /** the Navigation pane, on a computer */
  nav: boolean;
  /** comments shown: their words lit, and what they say beside them */
  comments: boolean;
}

const KEY = 'mm-doc-view';
export const ZOOMS = [0.8, 0.9, 1, 1.1, 1.25, 1.5];
const DEFAULT: DocView = { zoom: 1, focus: false, ribbon: 'open', nav: false, comments: true };

function read(): DocView {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (!raw || typeof raw !== 'object') return DEFAULT;
    return {
      zoom: ZOOMS.includes(raw.zoom) ? raw.zoom : 1,
      // Focus is for this sitting only: a note opened later starts with everything in reach
      focus: false,
      ribbon: raw.ribbon === 'collapsed' ? 'collapsed' : 'open',
      nav: raw.nav === true,
      comments: raw.comments !== false,
    };
  } catch {
    return DEFAULT;
  }
}

let view: DocView | null = null;
let shown = 0; // notes open: the root element only carries the view while one is
const listeners = new Set<(v: DocView) => void>();

export function docView(): DocView {
  return (view ??= read());
}

function paint() {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const v = docView();
  if (!shown) {
    root.style.removeProperty('--doc-zoom');
    root.removeAttribute('data-note-focus');
    root.removeAttribute('data-ribbon');
    root.removeAttribute('data-nav-pane');
    root.removeAttribute('data-comments-off');
    return;
  }
  root.style.setProperty('--doc-zoom', String(v.zoom));
  root.toggleAttribute('data-note-focus', v.focus);
  root.setAttribute('data-ribbon', v.ribbon);
  root.toggleAttribute('data-nav-pane', v.nav);
  root.toggleAttribute('data-comments-off', !v.comments);
}

export function setDocView(patch: Partial<DocView>) {
  view = { ...docView(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(view));
  } catch {}
  paint();
  for (const f of listeners) f(view);
}

/** One step bigger (1) or smaller (-1) through ZOOMS. */
export function stepZoom(dir: 1 | -1) {
  const z = docView().zoom;
  const i = ZOOMS.indexOf(z);
  setDocView({ zoom: ZOOMS[Math.max(0, Math.min(ZOOMS.length - 1, (i < 0 ? ZOOMS.indexOf(1) : i) + dir))] });
}

/** Puts the view on the root element while a note is open; call the returned function when it closes. */
export function applyDocView() {
  shown++;
  paint();
  return () => {
    shown = Math.max(0, shown - 1);
    // Focus ends with the note
    if (!shown && docView().focus) view = { ...docView(), focus: false };
    paint();
  };
}

/** The view, kept up to date. */
export function useDocView(): DocView {
  const [v, set] = useState(docView);
  useEffect(() => {
    listeners.add(set);
    return () => void listeners.delete(set);
  }, []);
  return v;
}
