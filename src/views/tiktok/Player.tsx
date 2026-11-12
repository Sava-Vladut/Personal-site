import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import { Icon } from '../../components/icons';
import { pushBack } from '../../lib/router';
import { formatDate } from '../../lib/dates';
import { LOCALE, t } from '../../lib/i18n';
import { LIB, type Rec } from '../../lib/tiktok';

/* The Saved TikToks player: one video at a time over the whole screen, swiped up and down like TikTok.
   Tap the left or right third to go back or forward 5 seconds, the middle to pause. It keeps ONE <video> for every
   video: a phone only lets an element play with sound after a tap on it, and that permission stays with the element,
   so a new element per video would start muted on every swipe. */

const SKIP = 5; // seconds per rewind / forward step
const PREF_KEY = 'saved-tiktoks.player';
const AHEAD = 2, AHEAD_MAX = 24e6; // videos fetched ahead, and the biggest file worth holding in memory

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const pad = (n: number) => String(n).padStart(2, '0');
const fmtDur = (s: number | null | undefined) => { const n = Math.max(0, Math.round(Number(s) || 0)); return `${Math.floor(n / 60)}:${pad(n % 60)}`; };
const num = new Intl.NumberFormat(LOCALE);
const compact = new Intl.NumberFormat(LOCALE, { notation: 'compact', maximumFractionDigits: 1 });
const day = (ms: number) => formatDate(ms, { day: 'numeric', month: 'short', year: 'numeric' });
const prefs = {
  get(): { muted?: boolean } { try { return JSON.parse(localStorage.getItem(PREF_KEY) || '{}') || {}; } catch { return {}; } },
  set(patch: { muted?: boolean }) { try { localStorage.setItem(PREF_KEY, JSON.stringify({ ...prefs.get(), ...patch })); } catch { /* private mode */ } },
};

export interface PlayerApi {
  /** Plays the video at this place in the list, in the list's order. */
  open(pos: number): void;
  /** Plays the list in a fresh random order. */
  random(): void;
  isOpen(): boolean;
}

interface Props {
  api: { current: PlayerApi | null };
  list: Rec[];
  stars: Set<string>;
  starsVer: number;
  onStar(id: string, on: boolean): Promise<void>;
  /** Show everything from this person or with this hashtag. */
  onFind(q: string): void;
  onClosed(rec: Rec | null, starsChanged: boolean): void;
}

interface Ahead { ctl: AbortController; url: string; got: number; size: number; done: Promise<void> }
interface Ui { open: boolean; rec: Rec | null; at: number; total: number; random: boolean; first: boolean; last: boolean; playing: boolean; muted: boolean; sound: boolean; info: boolean }

/** A caption with its #hashtags and @people as buttons that search for them. */
function linkify(text: string) {
  const out: ComponentChildren[] = [];
  const re = /(^|[\s(])(#[\p{L}\p{N}_]+|@[\p{L}\p{N}_.]*[\p{L}\p{N}_])/gu;
  let at = 0;
  for (let m = re.exec(text); m; m = re.exec(text)) {
    const start = m.index + m[1].length;
    out.push(text.slice(at, start), <button type="button" data-find={m[2]}>{m[2]}</button>);
    at = start + m[2].length;
  }
  out.push(text.slice(at));
  return out;
}

export function Player(props: Props) {
  const pr = useRef(props);
  pr.current = props;
  const playerEl = useRef<HTMLDivElement>(null), stageEl = useRef<HTMLDivElement>(null), mediaEl = useRef<HTMLDivElement>(null);
  const vidEl = useRef<HTMLVideoElement>(null), peekPrev = useRef<HTMLImageElement>(null), peekNext = useRef<HTMLImageElement>(null);
  const flashEl = useRef<HTMLDivElement>(null), barEl = useRef<HTMLInputElement>(null), timeEl = useRef<HTMLSpanElement>(null);
  const starEl = useRef<HTMLButtonElement>(null);
  const [ui, setUi] = useState<Ui>({ open: false, rec: null, at: 0, total: 0, random: false, first: true, last: true, playing: false, muted: false, sound: false, info: false });

  const c = useMemo(() => {
    const P = {
      open: false, pos: 0, rec: null as Rec | null, random: false, order: [] as Rec[], oi: 0, autoMuted: false, scrubbing: false,
      skipSum: 0, skipAt: 0, swipeAt: 0, wheelAcc: 0, wheelAt: 0, wheelLock: 0, sliding: false, aheadTimer: 0, flashTimer: 0, starsChanged: false,
      back: null as null | (() => void), wake: null as WakeLockSentinel | null,
      touch: null as null | { x: number; y: number; drag: boolean; dy: number; last: [number, number][] },
    };
    const ahead = new Map<string, Ahead>(); // file -> the copy fetched ahead
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const L = () => pr.current.list;
    const vid = () => vidEl.current!;

    const dur = () => { const v = vid(); return isFinite(v.duration) && v.duration > 0 ? v.duration : Number(P.rec?.v.duration) || 0; };
    function setBar(f: number) {
      const k = Math.round(clamp(f, 0, 1) * 1000), b = barEl.current!;
      b.value = String(k);
      b.style.setProperty('--p', k / 10 + '%');
    }
    function tick() {
      if (!P.open || P.scrubbing) return;
      const d = dur(), now = vid().currentTime || 0;
      setBar(d ? now / d : 0);
      timeEl.current!.textContent = `${fmtDur(now)} / ${fmtDur(d)}`;
    }
    function syncMedia() {
      const v = vid();
      if (!v.muted) P.autoMuted = false;
      setUi((u) => ({ ...u, playing: !v.paused, muted: v.muted, sound: v.muted ? u.sound : false }));
    }
    function say(text: string, side: 'l' | 'r' | 'c') {
      const f = flashEl.current!;
      f.textContent = text;
      f.dataset.side = side;
      f.classList.remove('go');
      void f.offsetWidth;
      f.classList.add('go');
      // with reduced motion the bubble doesn't fade: it shows, then goes
      clearTimeout(P.flashTimer);
      if (reduced.matches) P.flashTimer = window.setTimeout(() => f.classList.remove('go'), 900);
    }

    // where one step up (-1) or down (+1) leads: a place in the list, or -1 at either end.
    // In random mode it walks the shuffled order: forward is a new random video, back is the one you just saw.
    function step(d: number) {
      if (P.random) { const n = P.oi + d; return n < 0 || n >= P.order.length ? -1 : L().indexOf(P.order[n]); }
      const p = P.pos + d;
      return p < 0 || p >= L().length ? -1 : p;
    }
    function where() {
      const at = P.random ? P.oi : P.pos;
      return { at, total: L().length, random: P.random, first: at <= 0, last: at >= L().length - 1 };
    }
    // the thumbnails of the videos above and below, which slide in while you swipe
    function setPeek(img: HTMLImageElement | null, p: number) {
      if (!img) return;
      const r = L()[p], src = r && r.v.thumb ? LIB + r.v.thumb : '';
      if (src && img.getAttribute('src') !== src) img.src = src;
      if (!src) img.removeAttribute('src');
      img.hidden = !src;
    }
    function syncPos() {
      setPeek(peekPrev.current, step(-1));
      setPeek(peekNext.current, step(1));
      setUi((u) => ({ ...u, ...where() }));
    }

    function begin(r: Rec, src: string) {
      const v = vid();
      v.src = src;
      const p = v.play();
      if (p) p.catch((err: DOMException) => {
        if (P.rec !== r || err.name !== 'NotAllowedError' || v.muted) return;
        P.autoMuted = true; // the browser refused sound: play silently and offer one tap to fix it
        v.muted = true;
        v.play().catch(() => {});
        setUi((u) => ({ ...u, sound: true }));
      });
    }
    function show(pos: number) {
      const r = L()[pos];
      if (!r) return;
      const v = vid();
      P.pos = pos; P.rec = r; P.autoMuted = false; P.skipSum = 0;
      v.muted = !!prefs.get().muted;
      if (r.v.thumb) v.poster = LIB + r.v.thumb; else v.removeAttribute('poster');
      clearTimeout(P.aheadTimer);
      const e = ahead.get(r.v.file);
      if (e && e.url) begin(r, e.url); // fetched while the last one played: starts at once
      else if (e && e.size && e.got >= e.size * 0.6) { // nearly here: waiting for the rest beats starting over
        v.pause(); v.removeAttribute('src'); v.load();
        void e.done.then(() => { if (P.open && P.rec === r) begin(r, e.url || LIB + r.v.file); });
      } else { dropAhead(r.v.file); begin(r, LIB + r.v.file); }
      setBar(0);
      timeEl.current!.textContent = `0:00 / ${fmtDur(r.v.duration)}`;
      setPeek(peekPrev.current, step(-1));
      setPeek(peekNext.current, step(1));
      setUi((u) => ({ ...u, open: true, rec: r, info: false, sound: false, playing: !v.paused, muted: v.muted, ...where() }));
    }

    /* ---------- look-ahead: the next videos are fetched whole while this one plays, so a swipe starts from memory
       instead of waiting for the network (a phone otherwise asks for a file only after the swipe, in several
       stop-and-start requests). The one before is kept too, for swiping back. ---------- */
    function fetchAhead(r: Rec) {
      const f = r.v.file;
      if (ahead.has(f)) return ahead.get(f)!;
      if ((Number(r.v.filesize) || 0) > AHEAD_MAX) return null;
      const e: Ahead = { ctl: new AbortController(), url: '', got: 0, size: Number(r.v.filesize) || 0, done: Promise.resolve() };
      ahead.set(f, e);
      e.done = (async () => {
        const res = await fetch(LIB + f, { signal: e.ctl.signal });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        e.size = Number(res.headers.get('content-length')) || e.size;
        if (e.size > AHEAD_MAX) throw new Error('too big');
        const parts: BlobPart[] = [];
        if (res.body) {
          for (const rd = res.body.getReader(); ;) {
            const { done, value } = await rd.read();
            if (done) break;
            parts.push(value);
            e.got += value.length;
          }
        } else parts.push(await res.arrayBuffer());
        if (ahead.get(f) === e) e.url = URL.createObjectURL(new Blob(parts, { type: 'video/mp4' }));
      })().catch(() => { if (ahead.get(f) === e) ahead.delete(f); e.ctl.abort(); });
      return e;
    }
    function dropAhead(f: string) {
      const e = ahead.get(f);
      if (!e) return;
      ahead.delete(f);
      e.ctl.abort();
      if (e.url) URL.revokeObjectURL(e.url);
    }
    function lookAhead() {
      clearTimeout(P.aheadTimer);
      const cur = P.rec, conn = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
      if (!P.open || !cur || conn?.saveData) return;
      const keep = new Set([cur.v.file]), next: Rec[] = [];
      for (let k = 1; k <= AHEAD; k++) { const r = L()[step(k)]; if (r) { next.push(r); keep.add(r.v.file); } }
      const back = L()[step(-1)];
      if (back) keep.add(back.v.file);
      for (const f of [...ahead.keys()]) if (!keep.has(f)) dropAhead(f);
      // one at a time, nearest first: the very next video gets the whole connection
      const go = (i: number) => {
        if (i >= next.length || !P.open || P.rec !== cur) return;
        const e = fetchAhead(next[i]);
        if (e) void e.done.then(() => go(i + 1)); else go(i + 1);
      };
      go(0);
    }

    // keep the phone's screen on while the player is open (Screen Wake Lock; iOS Safari 16.4+).
    // The browser drops the lock whenever the tab is hidden, so it is asked for again on return.
    function keepAwake() {
      if (!navigator.wakeLock || P.wake || document.hidden || !P.open) return;
      navigator.wakeLock.request('screen').then((l) => {
        if (!P.open) { void l.release(); return; }
        P.wake = l;
        l.addEventListener('release', () => { if (P.wake === l) P.wake = null; });
      }).catch(() => {});
    }

    function open(pos: number) {
      if (!L()[pos]) return;
      P.open = true;
      P.starsChanged = false;
      playerEl.current!.hidden = false;
      document.documentElement.classList.add('tt-locked');
      show(pos);
      // the phone's back gesture closes the player, like a sheet
      P.back = pushBack(hide);
      playerEl.current!.focus({ preventScroll: true });
      keepAwake();
    }
    function hide() {
      if (!P.open) return;
      P.open = false; P.back = null; P.random = false; P.order = []; P.touch = null;
      const v = vid();
      v.pause(); v.removeAttribute('src'); v.load();
      clearTimeout(P.aheadTimer);
      for (const f of [...ahead.keys()]) dropAhead(f);
      moveTo(0, 0);
      P.sliding = false;
      playerEl.current!.hidden = true;
      if (P.wake) { void P.wake.release(); P.wake = null; }
      document.documentElement.classList.remove('tt-locked');
      setUi((u) => ({ ...u, open: false, info: false, sound: false }));
      const changed = P.starsChanged;
      P.starsChanged = false;
      pr.current.onClosed(P.rec, changed);
    }
    function close() {
      const back = P.back;
      hide();
      back?.();
    }

    function atEnd(d: number) { say(d > 0 ? (P.random ? t('Seen them all') : t('Last one')) : t('First one'), 'c'); }
    function go(d: number, p: number) { if (P.random) P.oi += d; show(p); }
    /* the slide between videos: the video moves with your finger (or the wheel / keys), the next one's
       thumbnail comes in behind it, and once it's in place the one <video> takes the new file. */
    function moveTo(y: number, ms: number) {
      const m = mediaEl.current!;
      m.style.transition = ms ? `transform ${ms}ms var(--ease-emph)` : 'none';
      m.style.transform = y ? `translate3d(0, ${y}px, 0)` : '';
    }
    function slide(d: number, p: number, from = 0) {
      if (reduced.matches) { moveTo(0, 0); go(d, p); return; }
      P.sliding = true;
      const h = stageEl.current!.clientHeight, ms = Math.round(90 + 230 * (1 - Math.min(1, Math.abs(from) / h)));
      moveTo(-d * h, ms);
      setTimeout(() => {
        if (!P.open) return;
        go(d, p); // the new video's poster is the thumbnail that just slid in, so the swap doesn't show
        moveTo(0, 0);
        P.sliding = false;
      }, ms);
    }
    function nav(d: number) {
      if (!P.open || P.sliding) return;
      const p = step(d);
      if (p < 0) { atEnd(d); return; }
      slide(d, p);
    }

    /* random mode: every video is shown once, in a fresh random order */
    function shuffled(list: Rec[]) {
      const a = list.slice();
      for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
      return a;
    }
    function setRandom(on: boolean, first?: Rec | null) {
      P.random = on;
      P.oi = 0;
      P.order = !on ? [] : first ? [first, ...shuffled(L().filter((r) => r !== first))] : shuffled(L());
    }
    function toggleRandom() { // inside the player: the current video keeps playing
      setRandom(!P.random, P.rec);
      say(P.random ? t('Random on') : t('Random off'), 'c');
      syncPos();
      lookAhead(); // what comes next just changed
    }
    function skip(d: number) {
      if (!P.open) return;
      const v = vid(), total = dur(), now = performance.now();
      v.currentTime = clamp((v.currentTime || 0) + d, 0, total ? Math.max(0, total - 0.1) : Infinity);
      // quick repeated taps add up in the bubble: −5s, −10s, −15s…
      P.skipSum = now - P.skipAt < 800 && Math.sign(P.skipSum) === Math.sign(d) ? P.skipSum + d : d;
      P.skipAt = now;
      say(`${P.skipSum < 0 ? '−' : '+'}${Math.abs(P.skipSum)}s`, d < 0 ? 'l' : 'r');
      tick();
    }
    /* stars: tap the star (or press s) and the video joins the Starred list; saved on the server */
    function toggleStar() {
      if (!P.open || !P.rec) return;
      const id = P.rec.id, on = !pr.current.stars.has(id);
      P.starsChanged = true;
      pr.current.onStar(id, on).catch(() => { if (P.open) say(t('Couldn’t save'), 'c'); });
      const b = starEl.current;
      if (on && b) { b.classList.remove('is-pop'); void b.offsetWidth; b.classList.add('is-pop'); }
      say(on ? '★' : '☆', 'c');
    }
    function togglePlay() { const v = vid(); if (v.paused) v.play().catch(() => {}); else v.pause(); }
    function setMuted(m: boolean) {
      const v = vid();
      P.autoMuted = false;
      v.muted = m;
      prefs.set({ muted: m });
      if (!m) v.play().catch(() => {});
    }

    /* ---------- the hand: taps, swipes, the wheel, the keys ---------- */
    function onStageClick(e: MouseEvent) {
      if (Date.now() - P.swipeAt < 400 || (e.target as Element).closest('button, a, input, .tt-p-info')) return;
      const box = stageEl.current!.getBoundingClientRect(), x = (e.clientX - box.left) / box.width;
      if (x < 1 / 3) skip(-SKIP); else if (x > 2 / 3) skip(SKIP); else togglePlay();
    }
    function onTouchStart(e: TouchEvent) {
      P.touch = !P.sliding && e.touches.length === 1 && !(e.target as Element).closest('.tt-p-seek, .tt-p-info.open')
        ? { x: e.touches[0].clientX, y: e.touches[0].clientY, drag: false, dy: 0, last: [] } : null;
    }
    function onTouchMove(e: TouchEvent) {
      const tc = P.touch;
      if (!tc || e.touches.length !== 1) return;
      const p = e.touches[0], dx = p.clientX - tc.x, dy = p.clientY - tc.y;
      if (!tc.drag) {
        if (Math.abs(dy) < 10 || Math.abs(dy) < Math.abs(dx) * 1.3) return;
        tc.drag = true;
      }
      tc.dy = dy;
      tc.last.push([performance.now(), dy]);
      if (tc.last.length > 5) tc.last.shift();
      moveTo(step(dy < 0 ? 1 : -1) < 0 ? dy * 0.25 : dy, 0); // at the first / last video it only gives a little
    }
    function endTouch(cancel: boolean) {
      const tc = P.touch;
      P.touch = null;
      if (!tc || !tc.drag) return;
      P.swipeAt = Date.now();
      const dy = tc.dy, d = dy < 0 ? 1 : -1, p = step(d), h = stageEl.current!.clientHeight;
      const [t0, y0] = tc.last[0] || [0, 0], [t1, y1] = tc.last[tc.last.length - 1] || [0, 0];
      const speed = t1 > t0 ? Math.abs(y1 - y0) / (t1 - t0) : 0; // px per ms over the last few moves
      if (!cancel && p >= 0 && (Math.abs(dy) > h * 0.2 || (speed > 0.4 && Math.abs(dy) > 24))) { slide(d, p, dy); return; }
      if (!cancel && p < 0 && Math.abs(dy) > 50) atEnd(d);
      moveTo(0, reduced.matches ? 0 : 240); // not far enough: spring back
    }
    function onWheel(e: WheelEvent) {
      if ((e.target as Element).closest('.tt-p-info.open')) return;
      e.preventDefault();
      const now = performance.now();
      if (now < P.wheelLock) return;
      if (now - P.wheelAt > 250) P.wheelAcc = 0;
      P.wheelAt = now;
      P.wheelAcc += e.deltaMode === 1 ? e.deltaY * 30 : e.deltaY;
      if (Math.abs(P.wheelAcc) > 60 && !P.sliding) { nav(Math.sign(P.wheelAcc)); P.wheelAcc = 0; P.wheelLock = now + 450; }
    }
    function onKey(e: KeyboardEvent) {
      if (!P.open || e.ctrlKey || e.metaKey || e.altKey) return;
      const onButton = (e.target as Element)?.closest?.('button, a');
      switch (e.key) {
        case 'Escape': close(); break;
        case 'ArrowLeft': skip(-SKIP); break;
        case 'ArrowRight': skip(SKIP); break;
        case 'ArrowDown': case 'j': case 'PageDown': nav(1); break;
        case 'ArrowUp': case 'k': case 'PageUp': nav(-1); break;
        case 'm': setMuted(!vid().muted); break;
        case 'r': toggleRandom(); break;
        case 's': toggleStar(); break;
        case ' ': if (onButton) return; togglePlay(); break;
        default: return;
      }
      e.preventDefault();
    }
    function onBarInput() {
      P.scrubbing = true;
      const d = dur(), b = barEl.current!, f = Number(b.value) / 1000;
      b.style.setProperty('--p', f * 100 + '%');
      if (d) { vid().currentTime = f * d; timeEl.current!.textContent = `${fmtDur(f * d)} / ${fmtDur(d)}`; }
    }
    function onVideoError() {
      const v = vid(), src = v.getAttribute('src');
      if (!P.open || !src || !P.rec) return;
      // a copy fetched ahead that this browser won't play from memory: play the file itself instead
      if (src.startsWith('blob:')) { dropAhead(P.rec.v.file); begin(P.rec, LIB + P.rec.v.file); return; }
      say(t('Can’t play this file'), 'c');
    }

    return {
      P, tick, syncMedia, lookAhead, keepAwake, open, close, hide, nav, skip, toggleRandom, toggleStar, togglePlay, setMuted,
      onStageClick, onTouchStart, onTouchMove, endTouch, onWheel, onKey, onBarInput, onVideoError, setRandom,
      teardown() {
        clearTimeout(P.aheadTimer);
        for (const f of [...ahead.keys()]) dropAhead(f);
        if (P.wake) { void P.wake.release(); P.wake = null; }
        document.documentElement.classList.remove('tt-locked');
      },
    };
  }, []);

  props.api.current = {
    open: (pos) => { c.setRandom(false); c.open(pos); },
    random: () => {
      const list = pr.current.list;
      if (!list.length) return;
      c.setRandom(true);
      c.open(list.indexOf(c.P.order[0]));
    },
    isOpen: () => c.P.open,
  };

  useEffect(() => {
    const v = vidEl.current!, stage = stageEl.current!, player = playerEl.current!, bar = barEl.current!;
    const ahead = () => { clearTimeout(c.P.aheadTimer); c.P.aheadTimer = window.setTimeout(c.lookAhead, 2500); };
    const endScrub = () => { c.P.scrubbing = false; };
    const onVisible = () => { if (c.P.open) c.keepAwake(); };
    const touchEnd = () => c.endTouch(false), touchCancel = () => c.endTouch(true);
    v.addEventListener('timeupdate', c.tick);
    v.addEventListener('loadedmetadata', c.tick);
    v.addEventListener('play', c.syncMedia);
    v.addEventListener('pause', c.syncMedia);
    v.addEventListener('volumechange', c.syncMedia);
    v.addEventListener('error', c.onVideoError);
    // once this video can play to its end without waiting, the connection is free for the next ones
    v.addEventListener('canplaythrough', c.lookAhead);
    v.addEventListener('playing', ahead);
    stage.addEventListener('touchstart', c.onTouchStart, { passive: true });
    stage.addEventListener('touchmove', c.onTouchMove, { passive: true });
    stage.addEventListener('touchend', touchEnd, { passive: true });
    stage.addEventListener('touchcancel', touchCancel, { passive: true });
    player.addEventListener('wheel', c.onWheel, { passive: false });
    player.addEventListener('pointerdown', c.keepAwake); // some browsers only grant the wake lock after a tap
    for (const ev of ['change', 'pointerup', 'pointercancel', 'touchend']) bar.addEventListener(ev, endScrub);
    document.addEventListener('keydown', c.onKey);
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('keydown', c.onKey);
      document.removeEventListener('visibilitychange', onVisible);
      c.teardown();
    };
  }, []);

  const r = ui.rec;
  const starOn = !!r && props.stars.has(r.id);
  const stats = r ? [
    r.v.views != null && t('{n} views', { n: compact.format(r.v.views) }),
    r.v.likes != null && t('{n} likes', { n: compact.format(r.v.likes) }),
    r.v.liked && t('you liked it'),
  ].filter(Boolean).join(' · ') : '';

  const onInfo = (e: MouseEvent) => {
    const find = (e.target as Element).closest<HTMLElement>('[data-find]');
    if (find) { c.close(); props.onFind(find.dataset.find!); return; }
    if ((e.target as Element).closest('a')) return;
    setUi((u) => ({ ...u, info: !u.info }));
  };

  return (
    <div
      class="tt-player"
      ref={playerEl}
      hidden={!ui.open}
      role="dialog"
      aria-modal="true"
      aria-label={t('Video player')}
      tabIndex={-1}
      onClick={(e) => { if (e.target === playerEl.current) c.close(); }}
    >
      <div class="tt-stage" ref={stageEl} onClick={c.onStageClick}>
        <div class="tt-media" ref={mediaEl}>
          <img class="tt-peek prev" ref={peekPrev} alt="" decoding="async" data-no-fade hidden />
          <img class="tt-peek next" ref={peekNext} alt="" decoding="async" data-no-fade hidden />
          <video ref={vidEl} playsInline loop preload="auto" {...{ 'webkit-playsinline': '' }} />
        </div>
        <div class="tt-flash" ref={flashEl} aria-hidden="true" />

        <div class="tt-p-top">
          <button type="button" class="tt-p-btn" onClick={c.close} aria-label={t('Close')}>
            <Icon name="x" size={22} />
          </button>
          <span class="tt-p-pos">{ui.random ? t('Random') + ' ' : ''}{num.format(ui.at + 1)} / {num.format(ui.total)}</span>
          <span class="tt-p-right">
            <button type="button" class="tt-p-btn tt-p-star" ref={starEl} onClick={c.toggleStar} aria-pressed={starOn} aria-label={starOn ? t('Remove star') : t('Star this video')} title={t('Star (s)')}>
              <Icon name="star" size={22} />
            </button>
            <button type="button" class="tt-p-btn tt-p-shuffle" onClick={c.toggleRandom} aria-pressed={ui.random} aria-label={t('Random order')} title={t('Random order (r)')}>
              <Icon name="arrows-shuffle" size={22} />
            </button>
            <button type="button" class="tt-p-btn" onClick={() => c.setMuted(!ui.muted)} aria-label={ui.muted ? t('Turn sound on') : t('Mute')} title={t('Sound (m)')}>
              <Icon name={ui.muted ? 'volume-off' : 'volume'} size={22} />
            </button>
          </span>
        </div>

        {ui.sound && <button type="button" class="tt-p-sound" onClick={() => c.setMuted(false)}><Icon name="volume" size={18} />{t('Tap for sound')}</button>}

        <div class="tt-p-bottom">
          {r && (
            <div class={'tt-p-info' + (ui.info ? ' open' : '')} onClick={onInfo}>
              <div class="tt-p-who">
                {r.user && <button type="button" class="tt-p-user" data-find={'@' + r.user}>@{r.user}</button>}
                <span>{t('saved {date}', { date: day(r.t) })}</span>
                <button type="button" class="tt-p-more" aria-expanded={ui.info}>{ui.info ? t('Less') : t('More')}</button>
              </div>
              {r.cap && <p class="tt-p-cap">{linkify(r.cap)}</p>}
              <div class="tt-p-extra">
                {r.v.music && <p><Icon name="music" size={14} /> {r.v.music}</p>}
                {stats && <p>{stats}</p>}
                <p>
                  {r.v.uploaded_at && <>{t('posted {date}', { date: day(Date.parse(r.v.uploaded_at)) })} · </>}
                  <a href={r.v.url} target="_blank" rel="noopener noreferrer">{t('Open on TikTok')}</a>
                </p>
              </div>
            </div>
          )}
          <div class="tt-p-seek">
            {/* no value prop: the playing video moves it (setBar), and a re-render must not put it back */}
            <input type="range" ref={barEl} min={0} max={1000} step={1} aria-label={t('Position in video')} onInput={c.onBarInput} />
            <span ref={timeEl}>0:00</span>
          </div>
          <div class="tt-p-ctl">
            <button type="button" class="tt-p-back" onClick={() => c.skip(-SKIP)} aria-label={t('Back 5 seconds')}>
              <Icon name="rewind-backward-5" size={24} />
            </button>
            <button type="button" onClick={c.togglePlay} aria-label={ui.playing ? t('Pause') : t('Play')}>
              <Icon name={ui.playing ? 'player-pause' : 'player-play'} size={24} class="tt-fill" />
            </button>
            <button type="button" onClick={() => c.skip(SKIP)} aria-label={t('Forward 5 seconds')}>
              <Icon name="rewind-forward-5" size={24} />
            </button>
          </div>
        </div>
      </div>

      <button type="button" class="tt-p-btn tt-p-nav prev" onClick={() => c.nav(-1)} disabled={ui.first} aria-label={t('Previous video')}>
        <Icon name="chevron-up" size={22} />
      </button>
      <button type="button" class="tt-p-btn tt-p-nav next" onClick={() => c.nav(1)} disabled={ui.last} aria-label={t('Next video')}>
        <Icon name="chevron-down" size={22} />
      </button>
    </div>
  );
}
