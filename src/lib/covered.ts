// Whether the page's moving pictures should hold still for now: a page change is sliding ([data-nav], lib/router.ts),
// the wheel is over the page ([data-covered]) or a sheet is open (.sheet-open). One observer serves every canvas and
// timer that asks.
const subs = new Set<() => void>();
let mo: MutationObserver | null = null;

export function pageCovered() {
  const root = document.documentElement;
  return root.hasAttribute('data-nav') || root.hasAttribute('data-covered') || root.classList.contains('sheet-open');
}

/** Calls `cb` whenever pageCovered() may have changed, until the returned function stops it. */
export function onCovered(cb: () => void) {
  if (!mo) {
    mo = new MutationObserver(() => { for (const f of subs) f(); });
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-nav', 'data-covered', 'class'] });
  }
  subs.add(cb);
  return () => void subs.delete(cb);
}
