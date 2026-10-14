// One shared IntersectionObserver for the many small things that only move while they're on screen.
import { useEffect, useState } from 'preact/hooks';

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

/**
 * Draws a long list a page at a time: how many of `total` to draw, and a ref for a marker after the last one that draws
 * the next page as it nears the screen. Starts over at one page whenever `key` changes (a new search, filter or order).
 */
export function usePaged(total: number, page: number, key: string) {
  const [at, setAt] = useState({ key, n: page });
  const n = at.key === key ? at.n : page;
  const more = total > n;
  // a callback ref, so a marker that turns up later (in a sheet that has just opened) is still watched
  const [el, ref] = useState<Element | null>(null);
  useEffect(() => {
    if (!el || !more) return;
    if (typeof IntersectionObserver === 'undefined') return setAt({ key, n: total });
    // a new observer after each page, so one that still leaves the end in reach draws the next page too
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setAt((a) => ({ key, n: (a.key === key ? a.n : page) + page })), { rootMargin: '1200px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [el, more, n, key]);
  return { n, more, ref };
}
