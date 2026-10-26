// The journal's sky: two layers of soft clouds drifting behind the top panel, partly drawn in letters.
// A far layer of small, faint clouds and finer letters sits behind a near layer of larger, faster
// ones that lean harder toward a finger or cursor. Clouds breathe, stretch and pinch as they drift, and a low sun
// from the upper left lights their edges. Each emotion world has its own letter ramp. The sky can take
// one world (the journal) or a mix (the mind page, where each cloud belongs to someone you think about),
// and changes colour in place when they change, without the clouds starting over.
//
// This component only watches the page (size, theme, whether the sky is on screen, a finger on it); the clouds are
// drawn by lib/sky/engine.ts, in a worker where the browser allows it, all skies from one frame loop.
import { useEffect, useRef } from 'preact/hooks';
import { RAMPS } from './ramps';
import { linkSky } from '../lib/sky/link';
import { makeLook, readColors, type Colors } from '../lib/sky/look';
import { sizeOf } from '../lib/sky/specs';

export { RAMPS };

/**
 * worlds: the emotion worlds the clouds take their colours from, in order of how much sky each gets.
 * letters: a ramp of its own (RAMPS) instead of the world's.
 * small: a sky for a card rather than a panel (set once, when it first appears).
 * calm: it holds still until the button or link it's in is pointed at or focused (for a sky that's always on screen).
 */
export function Sky({ world, worlds, letters, small, calm }: { world?: string | null; worlds?: string[]; letters?: string; small?: boolean; calm?: boolean }) {
  const els = useRef<(HTMLCanvasElement | null)[]>([]);
  const latest = useRef({ world, worlds, letters });
  const retune = useRef<() => void>();
  const applied = useRef('');
  latest.current = { world, worlds, letters };
  const key = `${world ?? ''}|${(worlds ?? []).join()}|${letters ?? ''}`;

  useEffect(() => {
    const canvases = els.current as HTMLCanvasElement[];
    const host = canvases[3].parentElement!;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const darkQuery = matchMedia('(prefers-color-scheme: dark)');
    // fades in once its first frame is down, rather than showing blank and then popping in
    const link = linkSky(canvases, !!small, () => canvases.forEach((c) => c.setAttribute('data-drawn', '')));

    let w = 0, h = 0, dpr = 0;
    let colors: Colors | null = null;
    let lookFor = ''; // the letter size and sharpness the last look was painted for
    let rect: DOMRect | null = null;
    let visible = true, covered = false, running = false, woken = false;
    const waker = calm ? host.closest('button, a') ?? host : null;

    const relook = (fresh: boolean) => {
      if (!w) return;
      const at = `${sizeOf(w)}|${dpr}`;
      if (!fresh && at === lookFor) return;
      lookFor = at;
      const { world, worlds, letters } = latest.current;
      colors ??= readColors(host, world, worlds);
      link.look(makeLook(colors, letters ?? world ?? '', !!small, w, dpr));
    };
    // new colours (a new theme, or new worlds): read them again and repaint the letters
    const repaint = () => {
      const { world, worlds } = latest.current;
      colors = readColors(host, world, worlds);
      relook(true);
    };

    const resize = () => {
      const r = host.getBoundingClientRect();
      if (!r.width || !r.height) return;
      rect = r;
      w = r.width; h = r.height; dpr = devicePixelRatio || 1;
      relook(false);
      link.size(w, h, dpr);
    };

    const sync = () => {
      const on = visible && !covered && !document.hidden && !reduced.matches && (!calm || woken);
      if (on !== running) link.run((running = on));
    };

    const move = (e: PointerEvent) => {
      const r = rect ?? (rect = host.getBoundingClientRect());
      link.pointer(e.clientX - r.left, e.clientY - r.top, true);
    };
    const down = (e: PointerEvent) => { rect = null; move(e); };
    const leave = () => link.pointer(0, 0, false);
    const up = (e: PointerEvent) => { if (e.pointerType !== 'mouse') leave(); }; // a lifted finger lets go
    const scrolled = () => { rect = null; };
    const wake = () => { woken = true; sync(); };
    const rest = () => { woken = false; sync(); };

    // a full-screen layer ([data-cover], e.g. the wheel) or an open sheet hides the skies under it: they wait, and the
    // layer's own sky goes on (a sheet's glass would otherwise re-blur every cloud frame behind it).
    // While a page change slides ([data-nav], lib/router.ts) every sky holds still, so the slide gets the frames
    const front = !!host.closest('[data-cover], .sheet-wrap');
    const recover = () => {
      const root = document.documentElement;
      covered = root.hasAttribute('data-nav') || (!front && (root.hasAttribute('data-covered') || root.classList.contains('sheet-open')));
      sync();
    };
    const onRoot = (list: MutationRecord[]) => {
      if (list.some((m) => m.attributeName === 'data-theme')) repaint();
      if (list.some((m) => m.attributeName !== 'data-theme')) recover();
    };
    const onMotion = () => { sync(); if (reduced.matches) link.draw(); };
    const ro = new ResizeObserver(resize);
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      sync();
    });
    const mo = new MutationObserver(onRoot);

    applied.current = key;
    retune.current = repaint;
    resize();
    recover();
    ro.observe(host);
    io.observe(host);
    mo.observe(document.documentElement, { attributeFilter: ['data-theme', 'data-covered', 'data-nav', 'class'] });
    darkQuery.addEventListener('change', repaint);
    reduced.addEventListener('change', onMotion);
    document.addEventListener('visibilitychange', sync);
    addEventListener('scroll', scrolled, { passive: true, capture: true });
    host.addEventListener('pointerdown', down);
    host.addEventListener('pointermove', move);
    host.addEventListener('pointerleave', leave);
    host.addEventListener('pointerup', up);
    host.addEventListener('pointercancel', leave);
    waker?.addEventListener('pointerenter', wake);
    waker?.addEventListener('pointerleave', rest);
    waker?.addEventListener('focusin', wake);
    waker?.addEventListener('focusout', rest);
    return () => {
      link.close();
      ro.disconnect();
      io.disconnect();
      mo.disconnect();
      darkQuery.removeEventListener('change', repaint);
      reduced.removeEventListener('change', onMotion);
      document.removeEventListener('visibilitychange', sync);
      removeEventListener('scroll', scrolled, { capture: true });
      host.removeEventListener('pointerdown', down);
      host.removeEventListener('pointermove', move);
      host.removeEventListener('pointerleave', leave);
      host.removeEventListener('pointerup', up);
      host.removeEventListener('pointercancel', leave);
      waker?.removeEventListener('pointerenter', wake);
      waker?.removeEventListener('pointerleave', rest);
      waker?.removeEventListener('focusin', wake);
      waker?.removeEventListener('focusout', rest);
    };
  }, []);

  // a new mix of worlds (or new letters) recolours the clouds where they are
  useEffect(() => {
    if (applied.current === key) return;
    applied.current = key;
    retune.current?.();
  }, [key]);

  const at = (i: number) => (el: HTMLCanvasElement | null) => void (els.current[i] = el);
  // the far clouds are fainter (--sky-o); each canvas fades in once drawn (app.css)
  return (
    <>
      <canvas ref={at(0)} class="sky" style={{ '--sky-o': 0.65 }} aria-hidden="true" />
      <canvas ref={at(1)} class="sky" aria-hidden="true" />
      <canvas ref={at(2)} class="sky" aria-hidden="true" />
      <canvas ref={at(3)} class="sky" aria-hidden="true" />
    </>
  );
}
