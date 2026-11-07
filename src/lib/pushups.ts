// Counting push-ups from a body pose, frame by frame. The pose comes from MediaPipe's Pose Landmarker (lib/pose.ts): 33
// points over the body, each with x and y as a share of the frame and how sure the model is it can see it.
//
// From the side (or at an angle, the view that counts best), a rep is the elbow bending below DOWN and opening back past
// UP: the angle at the elbow between shoulder and wrist, on the arm the camera sees better. The gap between the two is
// what keeps one rep from counting twice. Counting only starts once you hold a plank with straight arms (shoulder, hip
// and knee in a line, the body lying across the frame), so standing up, kneeling or reaching for the phone never counts.
// A rep whose body line broke on the way down doesn't count, and one that turned back too early is told to go lower.
//
// From the front (the phone on the floor ahead of your head), the elbow bends toward the camera and its angle hardly
// changes, so the counter follows how far your shoulders sit above your hands instead, measured in shoulder widths:
// the top is learned as you hold the plank, and a rep is going below FRONT_DOWN of it and back above FRONT_UP.
//
// The numbers are the ones open-source counters settle on (down near 90°, up near 150–160°, a smoothed angle, a pause
// between reps), loosened a little for people who don't lock out fully.

/** A point of the pose: x and y as a share of the frame's width and height. */
export interface Mark { x: number; y: number; visibility?: number }

export const PU = {
  /** Elbow angle (°) that counts as down, and as back up. */
  DOWN: 100,
  UP: 150,
  /** A dip that turns back above this (°) was a rep cut short. */
  PARTIAL: 125,
  /** Shoulder–hip–knee angle (°) a plank needs to start, and below which a rep doesn't count. */
  BODY_OK: 150,
  BODY_BAD: 140,
  /** How sure the model must be it sees a point. */
  VIS: 0.5,
  /** Smoothing: the share of each new frame in the running value. */
  ALPHA: 0.4,
  /** How long a plank is held before counting starts (ms). */
  ARM_MS: 300,
  /** Lost from view this long, or out of the plank this long, and counting waits for a new plank (ms). */
  LOST_MS: 700,
  OFF_MS: 1200,
  /** No two reps closer than this (ms). */
  MIN_REP_MS: 400,
  /** From the front: down below this share of the top, back up above this one. */
  FRONT_DOWN: 0.45,
  FRONT_UP: 0.8,
  FRONT_PARTIAL: 0.7,
  /** From the front: hands at least this many shoulder widths below the shoulders to start. */
  FRONT_ARM: 0.9,
} as const;

/**
 * Where counting is: nobody seen, someone seen but not the parts it needs, seen but not in a plank yet, and then up or
 * down within a rep.
 */
export type Phase = 'unseen' | 'partial' | 'ready' | 'up' | 'down';
/** What just happened, for a sound or a word: a rep, a rep cut short, or a rep whose body line broke. */
export type Cue = 'rep' | 'shallow' | 'hips' | null;
export type View = 'side' | 'front';

export interface Frame {
  phase: Phase;
  count: number;
  cue: Cue;
  /** How far down this rep is: 0 at the top, 1 deep enough to count (it can go past 1). */
  depth: number;
  view: View | null;
}

// MediaPipe's pose points (the person's own left and right)
const NOSE = 0;
const LEFT = { s: 11, e: 13, w: 15, h: 23, k: 25, a: 27 };
const RIGHT = { s: 12, e: 14, w: 16, h: 24, k: 26, a: 28 };
type Side = typeof LEFT;

interface P { x: number; y: number }
const dist = (a: P, b: P) => Math.hypot(a.x - b.x, a.y - b.y);
const mid = (a: P, b: P): P => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });

/** The angle at b between a and c, in degrees (0–180). */
export function angle(a: P, b: P, c: P) {
  const ux = a.x - b.x, uy = a.y - b.y, vx = c.x - b.x, vy = c.y - b.y;
  const n = Math.hypot(ux, uy) * Math.hypot(vx, vy);
  if (!n) return 180;
  return (Math.acos(Math.max(-1, Math.min(1, (ux * vx + uy * vy) / n))) * 180) / Math.PI;
}

/** A counter for one go in front of the camera. Feed it every frame; it says where counting is and what changed. */
export function createCounter() {
  let count = 0;
  let phase: Phase = 'unseen';
  let view: View | null = null;
  let side: Side = LEFT;
  let elbow: number | null = null;   // smoothed elbow angle
  let body: number | null = null;    // smoothed shoulder–hip–knee angle
  let lift: number | null = null;    // smoothed hands-below-shoulders, in shoulder widths (from the front)
  let top = 0;                       // from the front: lift at the top of the plank
  let lost: number | null = null;    // when the pose went missing
  let off: number | null = null;     // when the plank broke
  let arming: { view: View; since: number } | null = null;
  let lastRep = -Infinity;
  let low = Infinity;                // the lowest point of this rep so far (angle, or lift)
  let worstBody = 180;               // the body line's worst point since going down

  const smooth = (prev: number | null, next: number) => (prev === null ? next : prev + PU.ALPHA * (next - prev));
  const unarm = () => {
    view = null;
    arming = null;
    elbow = body = lift = null;
    low = Infinity;
  };
  const frame = (p: Phase, cue: Cue = null, depth = 0): Frame => {
    phase = p;
    return { phase: p, count, cue, depth: Math.max(0, depth), view };
  };

  function step(marks: Mark[] | undefined | null, width: number, height: number, now: number): Frame {
    if (!marks || marks.length < 29) {
      lost ??= now;
      if (now - lost > PU.LOST_MS) unarm();
      return frame(view ? phase : 'unseen');
    }
    lost = null;
    const vis = (i: number) => marks[i].visibility ?? 1;
    const at = (i: number): P => ({ x: marks[i].x * width, y: marks[i].y * height });
    const seen = (...ids: number[]) => ids.every((i) => vis(i) >= PU.VIS);

    // the arm the camera sees better, changing only when the other is clearly better
    const score = (s: Side) => Math.min(vis(s.s), vis(s.e), vis(s.w), vis(s.h));
    const other = side === LEFT ? RIGHT : LEFT;
    if (score(other) > score(side) + 0.1) side = other;

    if (view === 'front') return front(at, vis, now);
    if (view === 'side') return sideways(at, seen, now);

    // not counting yet: which way does the camera see you, and are you in a plank?
    const shoulders = seen(LEFT.s, RIGHT.s);
    const hands = seen(LEFT.w, RIGHT.w);
    const hipsSeen = vis(LEFT.h) >= PU.VIS || vis(RIGHT.h) >= PU.VIS;
    const width_ = shoulders ? dist(at(LEFT.s), at(RIGHT.s)) : 0;
    const torso = dist(mid(at(LEFT.s), at(RIGHT.s)), mid(at(LEFT.h), at(RIGHT.h)));
    // From the front the shoulders are wide apart and the torso runs toward the camera, so it looks short (or the
    // hips are hidden behind the head). From the side the shoulders overlap and the torso lies across the frame.
    const facing = shoulders && hands && width_ > 0 && (!hipsSeen || width_ > 0.9 * torso);
    if (facing) {
      const l = (mid(at(LEFT.w), at(RIGHT.w)).y - mid(at(LEFT.s), at(RIGHT.s)).y) / width_;
      lift = smooth(lift, l);
      return arm('front', lift >= PU.FRONT_ARM, now, () => { top = lift!; });
    }
    lift = null;
    const s = side;
    if (!seen(s.s, s.e, s.w, s.h) || !(seen(s.k) || seen(s.a))) {
      arming = null;
      return frame(seen(s.s) || seen(NOSE) ? 'partial' : 'unseen');
    }
    elbow = smooth(elbow, angle(at(s.s), at(s.e), at(s.w)));
    body = smooth(body, bodyLine(at, seen, s));
    return arm('side', elbow > PU.UP && body >= PU.BODY_OK && lying(at, seen, s), now, () => {});
  }

  /** Counting starts once the plank has been held a moment (and from the same view all along). */
  function arm(v: View, ready: boolean, now: number, start: () => void): Frame {
    if (!ready) {
      arming = null;
      return frame('ready');
    }
    if (!arming || arming.view !== v) arming = { view: v, since: now };
    if (now - arming.since < PU.ARM_MS) return frame('ready');
    view = v;
    arming = null;
    off = null;
    low = Infinity;
    start();
    return frame('up');
  }

  function bodyLine(at: (i: number) => P, seen: (...ids: number[]) => boolean, s: Side) {
    return angle(at(s.s), at(s.h), at(seen(s.k) ? s.k : s.a));
  }

  /** The body lies across the frame (shoulder to knee nearer level than upright), not standing or kneeling up. */
  function lying(at: (i: number) => P, seen: (...ids: number[]) => boolean, s: Side) {
    const a = at(s.s), b = at(seen(s.k) ? s.k : s.a);
    return Math.abs(b.y - a.y) <= 1.2 * Math.abs(b.x - a.x);
  }

  function sideways(at: (i: number) => P, seen: (...ids: number[]) => boolean, now: number): Frame {
    const s = side;
    if (!seen(s.s, s.e, s.w)) return frame(phase);
    elbow = smooth(elbow, angle(at(s.s), at(s.e), at(s.w)));
    const legs = seen(s.h) && (seen(s.k) || seen(s.a));
    if (legs) body = smooth(body, bodyLine(at, seen, s));
    // out of the plank a while (standing up, resting on the knees): wait for the next one
    if (!legs || !lying(at, seen, s)) {
      off ??= now;
      if (now - off > PU.OFF_MS) {
        unarm();
        return frame('ready');
      }
    } else off = null;
    const depth = (PU.UP - elbow) / (PU.UP - PU.DOWN);
    if (phase === 'down') {
      if (body !== null) worstBody = Math.min(worstBody, body);
      if (elbow <= PU.UP) return frame('down', null, depth);
      return finish(worstBody >= PU.BODY_BAD, now, depth);
    }
    low = Math.min(low, elbow);
    if (elbow < PU.DOWN) {
      worstBody = body ?? 180;
      return frame('down', null, depth);
    }
    if (elbow > PU.UP) {
      const short = low < PU.PARTIAL;
      low = Infinity;
      return frame('up', short ? 'shallow' : null, depth);
    }
    return frame('up', null, depth);
  }

  function front(at: (i: number) => P, vis: (i: number) => number, now: number): Frame {
    // once counting, a point half-hidden behind the head still does, so the bottom of a rep isn't lost
    const ok = (...ids: number[]) => ids.every((i) => vis(i) >= 0.3);
    if (!ok(LEFT.s, RIGHT.s, LEFT.w, RIGHT.w)) return frame(phase);
    const w = dist(at(LEFT.s), at(RIGHT.s));
    if (!w) return frame(phase);
    lift = smooth(lift, (mid(at(LEFT.w), at(RIGHT.w)).y - mid(at(LEFT.s), at(RIGHT.s)).y) / w);
    // hands no longer below the shoulders (up off the floor, standing): wait for the next plank
    if (lift < 0.2) {
      off ??= now;
      if (now - off > PU.OFF_MS) {
        unarm();
        return frame('ready');
      }
    } else off = null;
    const depth = (1 - lift / top) / (1 - PU.FRONT_DOWN);
    if (phase === 'down') {
      if (lift <= PU.FRONT_UP * top) return frame('down', null, depth);
      return finish(true, now, depth);
    }
    top = Math.max(top, lift);
    low = Math.min(low, lift);
    if (lift < PU.FRONT_DOWN * top) return frame('down', null, depth);
    if (lift > PU.FRONT_UP * top) {
      const short = low < PU.FRONT_PARTIAL * top;
      low = Infinity;
      return frame('up', short ? 'shallow' : null, depth);
    }
    return frame('up', null, depth);
  }

  /** Back up from the bottom: a rep, unless the body line broke or it came too soon after the last. */
  function finish(straight: boolean, now: number, depth: number): Frame {
    low = Infinity;
    if (!straight) return frame('up', 'hips', depth);
    if (now - lastRep < PU.MIN_REP_MS) return frame('up', null, depth);
    lastRep = now;
    count++;
    return frame('up', 'rep', depth);
  }

  return {
    step,
    get count() { return count; },
    /** Back to zero, keeping the plank if you're in one. */
    reset() { count = 0; lastRep = -Infinity; },
  };
}

export type Counter = ReturnType<typeof createCounter>;

/** The exercises the camera can count: push-ups of any kind, from the database or your own (not upside down ones). */
export function countsPushups(m: { id: string; name: string; kind: string }) {
  const words = `${m.id} ${m.name}`.replace(/_/g, ' ');
  return m.kind === 'body' && /push.?ups?\b/i.test(words) && !/handstand/i.test(words);
}
