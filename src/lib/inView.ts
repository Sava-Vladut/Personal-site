// One shared IntersectionObserver for the many small things that only move while they're on screen.
const subs = new Map<Element, (on: boolean) => void>();
let io: IntersectionObserver | null = null;

/** Calls `cb` with whether `el` is on (or nearly on) screen, until the returned function stops it. */
export function watchView(el: Element, cb: (on: boolean) => void) {
  io ??= new IntersectionObserver((list) => {
    for (const e of list) subs.get(e.target)?.(e.isIntersecting);
  }, { rootMargin: '120px 0px' });
  subs.set(el, cb);
  io.observe(el);
  return () => {
    subs.delete(el);
    io?.unobserve(el);
  };
}
