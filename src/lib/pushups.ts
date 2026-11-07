// Counting push-ups from a body pose, frame by frame. The pose comes from MediaPipe's Pose Landmarker (lib/pose.ts): 33
// points over the body, each with x and y as a share of the frame and how sure the model is it can see it.
//
// From the side (or at an angle, the view that counts best), a rep is the elbow bending below DOWN and opening back past
// UP: the angle at the elbow between shoulder and wrist, on the arm the camera sees better. The gap between the two is
// what keeps one rep from counting twice. Counting only starts once you hold a plank with straight arms (shoulder, hip
// and knee in a line, the body lying across the frame), so standing up, kneeling or reaching for the phone never counts.
// A rep whose body line sagged doesn't count, and one that turned back too early is told to go lower.
//
// From the front (the phone on the floor ahead of your head), the elbow bends toward the camera and its angle hardly
// changes, so the counter follows how far your shoulders sit above your hands instead, measured in shoulder widths:
// the top is learned as you hold the plank, and a rep is going below FRONT_DOWN of it and back above FRONT_UP.
//
// Push-ups come in sets, with rests between. The moment you leave the plank (getting up, dropping to your knees, sitting
// back, standing, walking off) counting pauses: whatever the arms do then isn't a rep, and neither is the move that took
// you out of it, such as lying down on the floor and pushing yourself up. It starts again once you hold a plank again,
// and the reps after a rest are the next set.
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
  /** Shoulder–hip–knee angle (°) a plank needs to start; below BODY_BAD a rep doesn't count (hips sagging or piked);
   * below BODY_GONE you've left the plank (kneeling up, sitting back, downward dog). */
  BODY_OK: 150,
  BODY_BAD: 140,
  BODY_GONE: 110,
  /** Hip–knee–ankle angle (°): legs straight, and (after starting with straight legs) dropped to the knees. */
  LEGS_OK: 150,
  LEGS_GONE: 130,
  /** How sure the model must be it sees a point. */
  VIS: 0.5,
  /** Smoothing: the share of each new frame in the running value. */
  ALPHA: 0.4,
  /** How long a plank is held before counting starts, or starts again after a rest (ms). */
  ARM_MS: 500,
  /** Out of sight this long: a rest (ms). */
  LOST_MS: 700,
  /** Out of the plank this long and the rep going on doesn't count; this long and it's a rest (ms). */
  SLIP_MS: 200,
  REST_MS: 600,
  /** Longer than this at the bottom is lying on the floor: a rest (ms). */
  MAX_DOWN_MS: 3000,
  /** No two reps closer than this (ms). */
  MIN_REP_MS: 400,
  /** From the front: down below this share of the top, back up above this one. */
  FRONT_DOWN: 0.45,
  FRONT_UP: 0.8,
  FRONT_PARTIAL: 0.7,
  /** From the front: hands at least this many shoulder widths below the shoulders to start. */
  FRONT_ARM: 0.9,
  /** From the front the torso runs toward the camera and looks short: longer than this many shoulder widths to start,
   * or than FRONT_TORSO once counting, and you're upright (kneeling or standing). */
  FRONT_TORSO_ARM: 1.1,
  FRONT_TORSO: 1.4,
  /** From the front: the shoulders this much wider or narrower than at the start, and you've moved off. */
  FRONT_DRIFT: 0.4,
} as const;

/**
 * Where counting is: nobody seen, someone seen but not the parts it needs, seen but not in a plank yet, up or down
 * within a rep, and resting between sets (out of the plank after at least one rep).
 */
export type Phase = 'unseen' | 'partial' | 'ready' | 'up' | 'down' | 'rest';
/** What just happened, for a sound or a word: a rep, a rep cut short, a rep whose body line broke, or a rest begun. */
export type Cue = 'rep' | 'shallow' | 'hips' | 'rest' | null;
export type View = 'side' | 'front';

export interface Frame {
  phase: Phase;
  /** Push-ups in all. */
  count: number;
  /** The reps of each set so far; the last is the one going on (or the one just done, while resting). */
  sets: readonly number[];
  cue: Cue;
  /** How far down this rep is: 0 at the top, 1 deep enough to count (it can go past 1). */
  depth: number;
  view: View | null;
  /** While resting: when the rest began (on the clock `step` is given). */
  restSince: number | null;
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
  let sets: number[] = [];
  let fresh = true;                  // the next rep starts a new set
  let phase: Phase = 'unseen';
  let view: View | null = null;
  let side: Side = LEFT;
  let elbow: number | null = null;   // smoothed elbow angle
  let body: number | null = null;    // smoothed shoulder–hip–knee angle
  let legs: number | null = null;    // smoothed hip–knee–ankle angle
  let straightLegs = false;          // started with straight legs (not knee push-ups), so dropping to the knees is a rest
  let lift: number | null = null;    // smoothed hands-below-shoulders, in shoulder widths (from the front)
  let top = 0;                       // from the front: lift at the top of the plank
  let width0 = 0;                    // from the front: shoulder width at the start
  let lost: number | null = null;    // when the pose (or the parts counting needs) went missing
  let off: number | null = null;     // when you left the plank
  let downSince = 0;
  let arming: { view: View; since: number } | null = null;
  let lastRep = -Infinity;
  let low = Infinity;                // the lowest point of this rep so far (angle, or lift)
  let worstBody = 180;               // the body line's worst point in this rep
  let slipped = false;               // left the plank during this rep: it doesn't count
  let restSince: number | null = null;

  const smooth = (prev: number | null, next: number) => (prev === null ? next : prev + PU.ALPHA * (next - prev));
  const total = () => sets.reduce((a, b) => a + b, 0);
  const frame = (p: Phase, cue: Cue = null, depth = 0): Frame => {
    phase = p;
    return { phase: p, count: total(), sets, cue, depth: Math.max(0, depth), view, restSince: p === 'rest' ? restSince : null };
  };
  /** Not counting: before the first plank it says why; after a set, it's a rest. */
  const idle = (p: 'unseen' | 'partial' | 'ready') => frame(sets.length ? 'rest' : p);

  /** Out of the plank: counting pauses until the next one, and the set (if it had reps) is done. */
  function rest(now: number): Frame {
    view = null;
    arming = null;
    elbow = body = legs = lift = null;
    low = Infinity;
    off = lost = null;
    slipped = false;
    if (!sets.length || fresh) return idle('ready');
    fresh = true;
    restSince = now;
    return frame('rest', 'rest');
  }

  function step(marks: Mark[] | undefined | null, width: number, height: number, now: number): Frame {
    if (!marks || marks.length < 29) return missing(now) ?? idle('unseen');
    const vis = (i: number) => marks[i].visibility ?? 1;
    const at = (i: number): P => ({ x: marks[i].x * width, y: marks[i].y * height });
    const seen = (...ids: number[]) => ids.every((i) => vis(i) >= PU.VIS);

    // the arm the camera sees better, changing only when the other is clearly better
    const score = (s: Side) => Math.min(vis(s.s), vis(s.e), vis(s.w), vis(s.h));
    const other = side === LEFT ? RIGHT : LEFT;
    if (score(other) > score(side) + 0.1) side = other;

    if (view === 'front') return front(at, vis, now);
    if (view === 'side') return sideways(at, seen, now);
    lost = null;

    // not counting: which way does the camera see you, and are you in a plank?
    const shoulders = seen(LEFT.s, RIGHT.s);
    const hands = seen(LEFT.w, RIGHT.w);
    const hipsSeen = vis(LEFT.h) >= PU.VIS || vis(RIGHT.h) >= PU.VIS;
    const w = shoulders ? dist(at(LEFT.s), at(RIGHT.s)) : 0;
    const torso = dist(mid(at(LEFT.s), at(RIGHT.s)), mid(at(LEFT.h), at(RIGHT.h)));
    // From the front the shoulders are wide apart and the torso runs toward the camera, so it looks short (or the
    // hips are hidden behind the head). From the side the shoulders overlap and the torso lies across the frame.
    const facing = shoulders && hands && w > 0 && (!hipsSeen || torso < PU.FRONT_TORSO_ARM * w);
    if (facing) {
      lift = smooth(lift, (mid(at(LEFT.w), at(RIGHT.w)).y - mid(at(LEFT.s), at(RIGHT.s)).y) / w);
      return arm('front', lift >= PU.FRONT_ARM, now, () => {
        top = lift!;
        width0 = w;
      });
    }
    lift = null;
    const s = side;
    if (!seen(s.s, s.e, s.w, s.h) || !(seen(s.k) || seen(s.a))) {
      arming = null;
      return idle(seen(s.s) || seen(NOSE) ? 'partial' : 'unseen');
    }
    elbow = smooth(elbow, angle(at(s.s), at(s.e), at(s.w)));
    body = smooth(body, bodyLine(at, seen, s));
    legs = seen(s.k, s.a) ? smooth(legs, angle(at(s.h), at(s.k), at(s.a))) : null;
    return arm('side', elbow > PU.UP && body >= PU.BODY_OK && lying(at, seen, s), now, () => {
      straightLegs = legs !== null && legs >= PU.LEGS_OK;
    });
  }

  /** The parts counting needs are out of sight: a moment is fine (a rep's bottom hides them), longer is a rest. */
  function missing(now: number): Frame | null {
    lost ??= now;
    if (!view) return null;
    if (now - lost > PU.LOST_MS) return rest(now);
    return frame(phase);
  }

  /** Counting starts once the plank has been held a moment (and from the same view all along). */
  function arm(v: View, ready: boolean, now: number, start: () => void): Frame {
    if (!ready) {
      arming = null;
      return idle('ready');
    }
    if (!arming || arming.view !== v) arming = { view: v, since: now };
    if (now - arming.since < PU.ARM_MS) return idle('ready');
    view = v;
    arming = null;
    off = lost = null;
    low = Infinity;
    worstBody = 180;
    slipped = false;
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
    if (!seen(s.s, s.e, s.w)) return missing(now)!;
    lost = null;
    elbow = smooth(elbow, angle(at(s.s), at(s.e), at(s.w)));
    const hasLegs = seen(s.h) && (seen(s.k) || seen(s.a));
    if (hasLegs) body = smooth(body, bodyLine(at, seen, s));
    if (seen(s.h, s.k, s.a)) legs = smooth(legs, angle(at(s.h), at(s.k), at(s.a)));
    // left the plank: legs out of sight, upright, folded at the hips, or down on the knees
    const gone = !hasLegs || !lying(at, seen, s) || (body ?? 180) < PU.BODY_GONE || (straightLegs && legs !== null && legs < PU.LEGS_GONE);
    return counting(gone, elbow, PU.DOWN, PU.UP, PU.PARTIAL, (PU.UP - elbow) / (PU.UP - PU.DOWN), now);
  }

  function front(at: (i: number) => P, vis: (i: number) => number, now: number): Frame {
    // once counting, a point half-hidden behind the head still does, so the bottom of a rep isn't lost
    const ok = (...ids: number[]) => ids.every((i) => vis(i) >= 0.3);
    if (!ok(LEFT.s, RIGHT.s, LEFT.w, RIGHT.w)) return missing(now)!;
    const w = dist(at(LEFT.s), at(RIGHT.s));
    if (!w) return missing(now)!;
    lost = null;
    lift = smooth(lift, (mid(at(LEFT.w), at(RIGHT.w)).y - mid(at(LEFT.s), at(RIGHT.s)).y) / w);
    const hipsSeen = vis(LEFT.h) >= PU.VIS || vis(RIGHT.h) >= PU.VIS;
    const torso = dist(mid(at(LEFT.s), at(RIGHT.s)), mid(at(LEFT.h), at(RIGHT.h)));
    // left the plank: hands up off the floor, the torso standing up in view, or moved nearer or away
    const gone = lift < 0.2 || (hipsSeen && torso > PU.FRONT_TORSO * w) || Math.abs(w - width0) > PU.FRONT_DRIFT * width0;
    if (!gone && phase !== 'down') top = Math.max(top, lift);
    return counting(gone, lift, PU.FRONT_DOWN * top, PU.FRONT_UP * top, PU.FRONT_PARTIAL * top, (top - lift) / (top - PU.FRONT_DOWN * top), now);
  }

  /**
   * One frame of a set, either view: `v` is how open you are (elbow angle, or lift), `down` and `up` the lines a rep
   * crosses. Out of the plank a moment and this rep doesn't count; a moment longer, or too long at the bottom, it's a rest.
   */
  function counting(gone: boolean, v: number, down: number, up: number, partial: number, depth: number, now: number): Frame {
    if (gone) {
      off ??= now;
      if (now - off >= PU.SLIP_MS) slipped = true;
      if (now - off >= PU.REST_MS) return rest(now);
    } else off = null;
    if (body !== null && view === 'side') worstBody = Math.min(worstBody, body);
    if (phase === 'down') {
      if (now - downSince > PU.MAX_DOWN_MS) return rest(now);
      if (v <= up) return frame('down', null, depth);
      return finish(now, depth);
    }
    low = Math.min(low, v);
    if (v < down) {
      downSince = now;
      return frame('down', null, depth);
    }
    if (v > up) {
      const short = !slipped && low < partial;
      low = Infinity;
      // back at the top in a good plank: the next rep starts clean
      if (!gone) {
        slipped = false;
        worstBody = body ?? 180;
      }
      return frame('up', short ? 'shallow' : null, depth);
    }
    return frame('up', null, depth);
  }

  /** Back up from the bottom: a rep, unless you left the plank on the way, the body line broke, or it came too soon. */
  function finish(now: number, depth: number): Frame {
    low = Infinity;
    if (slipped) return frame('up', null, depth);
    if (worstBody < PU.BODY_BAD) return frame('up', 'hips', depth);
    if (now - lastRep < PU.MIN_REP_MS) return frame('up', null, depth);
    lastRep = now;
    if (fresh || !sets.length) {
      sets = [...sets, 1];
      fresh = false;
    } else sets = [...sets.slice(0, -1), sets[sets.length - 1] + 1];
    restSince = null;
    return frame('up', 'rep', depth);
  }

  return {
    step,
    get count() { return total(); },
    get sets() { return sets; },
    /** Back to zero, keeping the plank if you're in one. */
    reset() {
      sets = [];
      fresh = true;
      lastRep = -Infinity;
      restSince = null;
    },
  };
}

export type Counter = ReturnType<typeof createCounter>;

/** The reps of each push-up set done in a workout. */
export function pushupReps(w: { items: { move: { id: string; name: string; kind: string }; sets: { reps: number | null; done: boolean }[] }[] }) {
  return w.items.flatMap((it) => (countsPushups(it.move) ? it.sets.flatMap((s) => (s.done && s.reps ? [s.reps] : [])) : []));
}

/** The exercises the camera can count: push-ups of any kind, from the database or your own (not upside down ones). */
export function countsPushups(m: { id: string; name: string; kind: string }) {
  const words = `${m.id} ${m.name}`.replace(/_/g, ' ');
  return m.kind === 'body' && /push.?ups?\b/i.test(words) && !/handstand/i.test(words);
}
