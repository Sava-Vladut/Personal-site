// Cards and rows below the fold drift in as they scroll into view, once. One MutationObserver looks only at what's
// added: a content unit that lands below the screen gets data-reveal="wait" (hidden, a little low), and one shared
// IntersectionObserver turns that into a stagger step, "0" to "4", as it peeks in, which plays the transition
// (styles/fade-scroll.css). The tag goes once it has played. Anything already on screen is left to the page's own
// entrance (the boot cascade, the view transition). Only elements this file tags are ever hidden, so if it never runs
// everything simply shows.

const ATTR = 'data-reveal';
/** The repeating pieces of a page that drift in. Anything inside one that's tagged moves with it, not on its own. */
const UNITS = [
  '.card', '.entries > *', '.note', '.note-row', '.checkin', '.list-row', '.book-row', '.track', '.person-card',
  '.repo-item', '.tile', '.status-card', '.spot-row', '.section-title', '.tab-panel > .stack-l > *', '.mx-rail', '.mx-run-label', '.lrn-group',
].join(', ');
/** Never hidden: sheets, dialogs and menus, the note being written, the wheels, the bars and toasts. */
const SKIP = [
  '.sheet-wrap', '[role="dialog"]', '[role="menu"]', '[role="listbox"]', '.confirm', '.details', '.route-note', '.ProseMirror',
  '.note-editor', '.nw-layer', '.nw', '.ew', '.wheel-detail', '.nav', '.side', '.toasts', '.pswp', '[data-no-reveal]',
].join(', ');
/** Items coming in together follow each other by 25ms, up to 100ms (the CSS has a step for each). */
const STEPS = 4;
const STEP_MS = 25;

let io: IntersectionObserver | null = null;
let reduced: MediaQueryList | null = null;
/** Every unit already looked at, so one Preact moves (a keyed list reordering) isn't hidden again. */
const seen = new WeakSet<Element>();
/** Tagged and not yet revealed. */
const waiting = new Set<Element>();
/** Subtrees added since the last frame. */
const added = new Set<Element>();
let removed = false;
let frame = 0;
let settleMs = 0;

/** Reveals cards and rows as they scroll into view. */
export function startReveal() {
  if (typeof IntersectionObserver === 'undefined' || typeof MutationObserver === 'undefined') return;
  reduced = matchMedia('(prefers-reduced-motion: reduce)');
  reduced.addEventListener?.('change', () => reduced?.matches && showAll());
  addEventListener('beforeprint', showAll);
  // Starts just as it peeks in. In pixels, not a share of the screen, so even the last row above a short bottom
  // padding gets far enough up to be revealed.
  io = new IntersectionObserver(reveal, { rootMargin: '0px 0px -32px 0px' });
  new MutationObserver((records) => {
    for (const r of records) {
      // typing in a note adds elements on every key, and nothing in there ever drifts in (SKIP): don't look at them
      if ((r.target as Element).closest?.('.ProseMirror')) continue;
      for (const n of r.addedNodes) if (n instanceof Element) added.add(n);
      if (r.removedNodes.length) removed = true;
    }
    // all of a render's changes in one pass, before it's painted
    if (!frame && (added.size || (removed && waiting.size))) frame = requestAnimationFrame(flush);
  }).observe(document.getElementById('app') ?? document.body, { childList: true, subtree: true });
}

function flush() {
  frame = 0;
  if (removed) {
    removed = false;
    for (const el of waiting) if (!el.isConnected) forget(el);
  }
  if (reduced?.matches) return added.clear();
  const found: Element[] = [];
  for (const root of added) {
    if (!root.isConnected) continue;
    if (root.matches(UNITS)) found.push(root);
    if (root.firstElementChild) for (const el of root.querySelectorAll(UNITS)) found.push(el);
  }
  added.clear();
  // Reads first (positions, styles), then all the writes, so the layout is worked out once.
  const fold = innerHeight;
  const held = new Map<Element, boolean>();
  const picked = new Set<Element>();
  for (const el of found) {
    if (seen.has(el)) continue;
    seen.add(el);
    const page = el.closest('.page');
    if (!page || el.hasAttribute(ATTR) || el.closest(SKIP) || el.parentElement?.closest(`[${ATTR}]`)) continue;
    const r = el.getBoundingClientRect();
    // on screen or above it, or not drawn at all: leave it as it is
    if (r.top < fold || !r.height) continue;
    if (isPinned(el, page, held)) continue;
    picked.add(el);
  }
  for (const el of picked) {
    if (insidePicked(el, picked)) continue;
    el.setAttribute(ATTR, 'wait');
    waiting.add(el);
    io!.observe(el);
  }
}

/** Whether `el` is fixed or sticky, or sits in something that is or that scrolls by itself (it isn't the screen that
 * shows it then). Ancestors are remembered for the pass, as most units share them. */
function isPinned(el: Element, page: Element, held: Map<Element, boolean>) {
  const pos = getComputedStyle(el).position;
  return pos === 'fixed' || pos === 'sticky' || isHeld(el.parentElement, page, held);
}

function isHeld(el: Element | null, page: Element, held: Map<Element, boolean>): boolean {
  if (!el || el === page) return false;
  let v = held.get(el);
  if (v === undefined) {
    const s = getComputedStyle(el);
    v = s.position === 'fixed' || s.position === 'sticky' || /auto|scroll/.test(s.overflowX + s.overflowY) || isHeld(el.parentElement, page, held);
    held.set(el, v);
  }
  return v;
}

/** A unit inside another one hidden in the same pass rides along with it. */
function insidePicked(el: Element, picked: Set<Element>) {
  for (let p = el.parentElement; p && !p.classList.contains('page'); p = p.parentElement) if (picked.has(p)) return true;
  return false;
}

/** Plays the ones that peeked in, top to bottom (then left to right), each a beat after the one before. */
function reveal(entries: IntersectionObserverEntry[]) {
  const shown = entries
    .filter((e) => e.isIntersecting && waiting.has(e.target))
    .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top || a.boundingClientRect.left - b.boundingClientRect.left);
  shown.forEach((e, i) => play(e.target, Math.min(i, STEPS)));
}

function play(el: Element, step: number) {
  forget(el);
  const tag = String(step);
  el.setAttribute(ATTR, tag);
  // Once it has landed the tag goes, giving the element its own transitions (press feedback) back.
  setTimeout(() => el.getAttribute(ATTR) === tag && el.removeAttribute(ATTR), settle() + step * STEP_MS + 100);
}

function forget(el: Element) {
  waiting.delete(el);
  io?.unobserve(el);
}

/** Shows everything still waiting at once: reduced motion switched on, or printing. */
function showAll() {
  for (const el of [...waiting]) {
    el.removeAttribute(ATTR);
    forget(el);
  }
}

/** How long the reveal takes (--dur-3), read once. */
function settle() {
  if (!settleMs) {
    const d = getComputedStyle(document.documentElement).getPropertyValue('--dur-3').trim();
    settleMs = (d.endsWith('ms') ? parseFloat(d) : parseFloat(d) * 1000) || 450;
  }
  return settleMs;
}
