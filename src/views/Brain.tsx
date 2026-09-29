// A 3D brain drawn in letters. Scrolling flies the camera from lobe to lobe; dragging turns it; tapping sends a pulse
// across the folds. The geometry lives in lib/brain, the letters-from-points step in lib/brainRender; this file is the
// stage: camera, character ramp, canvas drawing and the chapters that ride along with the scroll.
import { useEffect, useRef, useState } from 'preact/hooks';
import { goBack } from '../lib/router';
import { Icon } from '../components/icons';
import { buildBrain, type BrainCloud } from '../lib/brain';
import { FOCUS_STEPS, makeFrame, rasterize, type Spark } from '../lib/brainRender';

type RGB = [number, number, number];
interface Cam { yaw: number; pitch: number; zoom: number; x: number; y: number; z: number }
interface Chapter { region: number; kicker: string; title: string; body: string; stat?: [string, string]; cam: Cam }

const FONT = 'ui-monospace, SFMono-Regular, Menlo, Consolas, "DejaVu Sans Mono", monospace';
const DEG = Math.PI / 180;
const TAU = Math.PI * 2;

/** frontal, parietal, temporal, occipital, cerebellum, brainstem */
const LIT: RGB[] = [[255, 132, 104], [246, 204, 96], [96, 222, 164], [104, 166, 255], [186, 140, 255], [232, 208, 228]];
const NAMES = ['Frontal lobe', 'Parietal lobe', 'Temporal lobe', 'Occipital lobe', 'Cerebellum', 'Brainstem'];
const rgb = (c: RGB) => `rgb(${c[0]},${c[1]},${c[2]})`;

const cam = (yaw: number, pitch: number, zoom: number, x: number, y: number, z: number): Cam => ({ yaw: yaw * DEG, pitch: pitch * DEG, zoom, x, y, z });

// yaw 90 looks at the left side with the front to the right; 0 is head-on; 180 is from behind
const CHAPTERS: Chapter[] = [
  {
    region: -1, kicker: 'A tour in letters', title: 'The human brain',
    body: 'About 86 billion neurons, joined by trillions of connections, folded into something you could hold in two hands. Scroll to fly across it.',
    stat: ['≈ 2,500 cm²', 'of cortex, crumpled to fit inside a skull'],
    cam: cam(34, 14, 1, 0, -0.1, 0),
  },
  {
    region: 0, kicker: 'Planning · Decisions · Speech', title: 'Frontal lobe',
    body: 'The largest lobe, right behind your forehead. It weighs choices, holds your attention and steers movement. Broca’s area, which shapes speech, sits here, usually on the left.',
    stat: ['Mid-20s', 'when its front part finishes maturing'],
    cam: cam(58, 8, 1.75, -0.12, 0.1, 0.48),
  },
  {
    region: 1, kicker: 'Touch · Space · Body sense', title: 'Parietal lobe',
    body: 'On top and toward the back. It blends touch, balance and sight into a map of where your body is and what surrounds it. A deep groove, the central sulcus, separates it from the frontal lobe.',
    stat: ['A map of you', 'every patch of skin has a place on it'],
    cam: cam(114, 40, 1.7, -0.15, 0.32, -0.16),
  },
  {
    region: 2, kicker: 'Hearing · Language · Memory', title: 'Temporal lobe',
    body: 'Tucked beneath the lateral fissure, level with your ears. It decodes sound and the meaning of words, and recognises faces. Deep inside lie the hippocampus and amygdala, where memories get their feelings.',
    stat: ['Hippocampus', 'the seahorse-shaped switchboard of memory'],
    cam: cam(86, -14, 1.8, -0.3, -0.1, 0.14),
  },
  {
    region: 3, kicker: 'Vision', title: 'Occipital lobe',
    body: 'The smallest lobe, at the very back. Everything you see is first assembled here, from edges and motion to colour, before other regions decide what it means.',
    stat: ['Far from your eyes', 'vision is processed at the back of the head'],
    cam: cam(154, 6, 1.7, -0.14, 0.08, -0.64),
  },
  {
    region: 4, kicker: 'Balance · Timing · Coordination', title: 'Cerebellum',
    body: 'Latin for “little brain”. It smooths every movement, from a handwritten letter to a catch, and keeps time for the rest of the brain.',
    stat: ['≈ 80%', 'of the brain’s neurons, in a tenth of its volume'],
    cam: cam(168, -34, 1.75, 0, -0.42, -0.46),
  },
  {
    region: 5, kicker: 'Breathing · Heartbeat · Sleep', title: 'Brainstem',
    body: 'The cable between brain and spinal cord. It runs everything you never have to think about: breathing, heart rate, waking and falling asleep.',
    stat: ['Midbrain · Pons · Medulla', 'three parts, one lifeline'],
    cam: cam(76, -8, 1.9, 0, -0.44, -0.12),
  },
  {
    region: -1, kicker: 'Seen from above', title: 'Two halves, one mind',
    body: 'A deep fissure splits the cerebrum into two hemispheres. They talk constantly through the corpus callosum, a bridge of about 200 million nerve fibres.',
    stat: ['≈ 200 million', 'fibres crossing between the halves'],
    cam: cam(180, 88, 1.38, 0, 0.2, 0),
  },
  {
    region: -1, kicker: 'Your turn', title: 'Take it for a spin',
    body: 'Drag to turn it. Tap the cortex to send a pulse across the folds.',
    cam: cam(34 + 360, 12, 1, 0, -0.1, 0),
  },
];
const LAST = CHAPTERS.length - 1;

/* ---------- small helpers ---------- */

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const mix = (a: RGB, b: RGB, t: number): RGB => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const smoother = (t: number) => t * t * t * (t * (t * 6 - 15) + 10);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

const CANDIDATES = '.,:;-~=+*!xoXO%#&8@MW$';

/** Characters from empty to dense, evenly spaced by how much ink they really lay down in this font. */
function makeRamp(font: string, size: number, levels: number): string[] {
  const s = Math.ceil(size * 1.6);
  const cv = document.createElement('canvas');
  cv.width = cv.height = s;
  const g = cv.getContext('2d', { willReadFrequently: true })!;
  g.font = `${size}px ${font}`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const cand: { ch: string; ink: number; off: number }[] = [];
  for (const ch of CANDIDATES) {
    g.clearRect(0, 0, s, s);
    g.fillText(ch, s / 2, s / 2);
    const px = g.getImageData(0, 0, s, s).data;
    let ink = 0, cy = 0;
    for (let y = 0; y < s; y++) for (let x = 0; x < s; x++) { const a = px[(y * s + x) * 4 + 3]; ink += a; cy += a * y; }
    if (ink > 0) cand.push({ ch, ink, off: Math.abs(cy / ink - s / 2) / size });
  }
  const top = Math.max(...cand.map((c) => c.ink));
  const out = [' '];
  const used = new Set<string>();
  for (let l = 1; l < levels; l++) {
    const want = (l / (levels - 1)) * top;
    let best: (typeof cand)[number] | null = null, bestCost = Infinity;
    for (const c of cand) {
      if (used.has(c.ch)) continue;
      const cost = Math.abs(c.ink - want) / top + c.off * 0.35;
      if (cost < bestCost) { bestCost = cost; best = c; }
    }
    if (best) { used.add(best.ch); out.push(best.ch); }
  }
  return out;
}

const RAMP_LEVELS = 12;

let cached: { detail: number; cloud: BrainCloud } | null = null;
const detailFor = (w: number) => clamp((w / 6 / 220) ** 2, 0.4, 1);

export function Brain() {
  const [cloud, setCloud] = useState<BrainCloud | null>(cached?.cloud ?? null);
  const [progress, setProgress] = useState(0);
  const [active, setActive] = useState(0);
  const stage = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const tag = useRef<HTMLDivElement>(null);
  const hint = useRef<HTMLDivElement>(null);
  const cards = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    const prev = document.title;
    document.title = 'The brain';
    return () => { document.title = prev; };
  }, []);

  useEffect(() => {
    const detail = detailFor(innerWidth);
    if (cached && cached.detail >= detail * 0.99) { setCloud(cached.cloud); return; }
    let dead = false;
    buildBrain(detail, (f) => !dead && setProgress(f)).then((c) => {
      cached = { detail, cloud: c };
      if (!dead) setCloud(c);
    });
    return () => { dead = true; };
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') goBack('settings'); };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    if (!cloud) return;
    const host = stage.current!, cv = canvas.current!;
    const ctx = cv.getContext('2d', { alpha: true })!;
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let fr = makeFrame(0);
    let dirty = true, dragging = false;

    // layout
    let W = 0, H = 0, dpr = 1, cwd = 8, chd = 16, cols = 0, rows = 0, fit = 1, cx = 0, cy = 0;
    let ramp: string[] = [' '];
    let atlas: HTMLCanvasElement | null = null, atlasKey = '';
    let wide = true, size = 0, sizeStep = 0;
    const STEPS = [1, 1.3, 1.7];

    const layout = () => {
      const r = host.getBoundingClientRect();
      if (!r.width || !r.height) return;
      W = r.width; H = r.height;
      dpr = Math.min(devicePixelRatio || 1, 2);
      wide = W >= 760;
      const fontCss = clamp(W / 170, 6, 10) * STEPS[sizeStep];
      const fontPx = Math.round(fontCss * dpr);
      const probe = document.createElement('canvas').getContext('2d')!;
      probe.font = `${fontPx}px ${FONT}`;
      cwd = Math.max(3, Math.round(probe.measureText('M').width));
      chd = Math.max(5, Math.round(fontPx * 1.1));
      size = fontPx;
      cols = Math.floor((W * dpr) / cwd);
      rows = Math.floor((H * dpr) / chd);
      cv.width = cols * cwd;
      cv.height = rows * chd;
      cv.style.width = `${(cols * cwd) / dpr}px`;
      cv.style.height = `${(rows * chd) / dpr}px`;
      const Wd = cols * cwd, Hd = rows * chd;
      if (wide) { fit = Math.min((Wd * 0.5) / 1.85, (Hd * 0.76) / 1.5); cx = Wd * 0.66; cy = Hd * 0.5; }
      else { fit = Math.min((Wd * 0.96) / 1.85, (Hd * 0.6) / 1.5); cx = Wd * 0.5; cy = Hd * 0.4; }
      fr = makeFrame(cols * rows);
      buildAtlas();
    };

    const buildAtlas = () => {
      const key = `${size}|${cwd}|${chd}`;
      if (key === atlasKey && atlas) return;
      atlasKey = key;
      ramp = makeRamp(FONT, size, RAMP_LEVELS);
      const a = atlas ?? (atlas = document.createElement('canvas'));
      a.width = ramp.length * cwd;
      a.height = LIT.length * FOCUS_STEPS * chd;
      const g = a.getContext('2d')!;
      g.font = `${size}px ${FONT}`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      LIT.forEach((lit, r) => {
        const dim = mix(lit, [18, 26, 38], 0.9);
        for (let s = 0; s < FOCUS_STEPS; s++) {
          g.fillStyle = rgb(mix(dim, lit, s / (FOCUS_STEPS - 1)).map(Math.round) as RGB);
          const y = (r * FOCUS_STEPS + s) * chd + chd / 2 + size * 0.04;
          for (let l = 1; l < ramp.length; l++) g.fillText(ramp[l], l * cwd + cwd / 2, y);
        }
      });
    };

    // camera: follows the scroll, then eases toward it
    const now: Cam = { ...CHAPTERS[0].cam };
    const want: Cam = { ...CHAPTERS[0].cam };
    let offYaw = 0, offPitch = 0, velYaw = 0, velPitch = 0, idle = 0;
    const focus = new Float32Array(6).fill(0.68);
    const sparks: Spark[] = [];
    const rand = Math.random;
    let time = 0, nextSpark = 1.2, nextScan = 4, scanAt = -1;
    let last = 0, raf = 0, ema = 8, slow = 0;
    let tx = 0, ty = 0, tOn = 0;
    const tagPos = { x: 0, y: 0, on: 0 };

    const chapterAt = () => {
      const c = clamp(scrollY / Math.max(1, host.clientHeight), 0, LAST);
      return c;
    };

    const pickSpark = (region: number, view: Cam) => {
      const sy = Math.sin(view.yaw), cyw = Math.cos(view.yaw), sp = Math.sin(view.pitch), cp = Math.cos(view.pitch);
      const fx = -sy * cp, fy = sp, fz = cyw * cp;
      const { pos, nor, reg, n } = cloud;
      for (let tries = 0; tries < 60; tries++) {
        const i = (rand() * n) | 0;
        if (region >= 0 && reg[i] !== region) continue;
        if (nor[i * 3] * fx + nor[i * 3 + 1] * fy + nor[i * 3 + 2] * fz < 0.35) continue;
        sparks.push({ x: pos[i * 3], y: pos[i * 3 + 1], z: pos[i * 3 + 2], t0: time });
        return;
      }
    };

    const step = (t: number) => {
      raf = requestAnimationFrame(step);
      if (!W) return;
      const dt = last ? Math.min(0.05, (t - last) / 1000) : 0.016;
      last = t;
      time += dt;
      const still = reduced.matches;

      const c = chapterAt();
      const i = Math.min(LAST - 1, Math.floor(c));
      const f = c - i;
      const e = smoother(clamp((f - 0.2) / 0.6, 0, 1));
      const A = CHAPTERS[i].cam, B = CHAPTERS[i + 1].cam;
      want.yaw = lerp(A.yaw, B.yaw, e); want.pitch = lerp(A.pitch, B.pitch, e); want.zoom = lerp(A.zoom, B.zoom, e);
      want.x = lerp(A.x, B.x, e); want.y = lerp(A.y, B.y, e); want.z = lerp(A.z, B.z, e);
      const nearest = Math.round(c);
      const region = CHAPTERS[nearest].region;
      const finale = clamp(1 - Math.abs(c - LAST) * 2, 0, 1);

      // drag momentum, then drift back to the chapter's angle (the last chapter keeps spinning)
      idle += dt;
      offYaw += velYaw * dt; offPitch += velPitch * dt;
      const glide = Math.exp(-dt * 3.2);
      velYaw *= glide; velPitch *= glide;
      if (!dragging) {
        if (finale > 0.6 && !still) { offYaw += dt * 0.32 * finale; }
        else if (idle > 1.2) {
          const home = Math.round(offYaw / TAU) * TAU;
          const k = 1 - Math.exp(-dt * 1.1);
          offYaw += (home - offYaw) * k;
        }
        if (idle > 1.2) offPitch += (0 - offPitch) * (1 - Math.exp(-dt * 1.4));
      }
      offPitch = clamp(offPitch, -0.7, 0.7);

      const k = still ? 1 : 1 - Math.exp(-dt * 6.5);
      now.yaw += (want.yaw + offYaw + (still ? 0 : Math.sin(time * 0.3) * 0.05) - now.yaw) * k;
      now.pitch += (want.pitch + offPitch - now.pitch) * k;
      now.zoom += (want.zoom - now.zoom) * k;
      now.x += (want.x - now.x) * k; now.y += (want.y - now.y) * k; now.z += (want.z - now.z) * k;

      let moving = Math.abs(want.yaw + offYaw - now.yaw) + Math.abs(want.pitch + offPitch - now.pitch) + Math.abs(want.zoom - now.zoom) > 0.0005;
      const fk = still ? 1 : 1 - Math.exp(-dt * 5);
      for (let r = 0; r < 6; r++) {
        const goal = region < 0 ? 0.68 : r === region ? 1 : 0.06;
        const d = goal - focus[r];
        if (Math.abs(d) > 0.004) moving = true;
        focus[r] += d * fk;
      }

      // pulses and the scan band
      if (!still) {
        if (time > nextSpark) { pickSpark(region, now); nextSpark = time + 1.1 + rand() * 1.4; }
        if (time > nextScan) { scanAt = time; nextScan = time + 9 + rand() * 5; }
        while (sparks.length && time - sparks[0].t0 > 2.6) sparks.shift();
      }
      const scanT = scanAt >= 0 ? (time - scanAt) / 2.6 : 2;
      const scan = scanT < 1 ? 0.62 - scanT * 1.5 : NaN;
      if (still && !moving && !sparks.length && !dirty) return;
      dirty = false;

      const t0 = performance.now();
      rasterize(
        cloud,
        { yaw: now.yaw, pitch: now.pitch, zoom: now.zoom, target: [now.x, now.y, now.z] },
        { cols, rows, levels: ramp.length, cw: cwd, ch: chd, cx, cy, scale: fit },
        { focus, time, sparks, scan, tag: region },
        fr,
      );
      ctx.clearRect(0, 0, cv.width, cv.height);
      const { glyph, tone } = fr;
      const a = atlas!;
      for (let row = 0, cell = 0; row < rows; row++) {
        const y = row * chd;
        for (let col = 0; col < cols; col++, cell++) {
          const g = glyph[cell];
          if (g) ctx.drawImage(a, g * cwd, tone[cell] * chd, cwd, chd, col * cwd, y, cwd, chd);
        }
      }
      // if frames take too long, use bigger letters
      const spent = performance.now() - t0;
      ema += (spent - ema) * 0.08;
      if (ema > 20 && sizeStep < STEPS.length - 1) { if (++slow > 45) { slow = 0; ema = 8; sizeStep++; layout(); } } else slow = 0;

      // the region's name, riding on the middle of what's visible of it
      const pane = cv.getBoundingClientRect(), hostBox = host.getBoundingClientRect();
      const ok = region >= 0 && fr.tagN > 24;
      if (ok) {
        tx = pane.left - hostBox.left + ((fr.tagX + 0.5) * cwd) / dpr;
        ty = pane.top - hostBox.top + ((fr.tagY + 0.5) * chd) / dpr;
        tx = clamp(tx, 70, W - 70); ty = clamp(ty, 90, H - 90);
      }
      tOn += ((ok ? 1 : 0) - tOn) * (1 - Math.exp(-dt * 8));
      if (tagPos.on < 0.02 && ok) { tagPos.x = tx; tagPos.y = ty; }
      tagPos.x += (tx - tagPos.x) * (1 - Math.exp(-dt * 9)); tagPos.y += (ty - tagPos.y) * (1 - Math.exp(-dt * 9));
      tagPos.on = tOn;
      const el = tag.current;
      if (el) {
        const fade = clamp(1 - Math.abs(c - nearest) * 2.6, 0, 1) * tOn;
        el.style.opacity = String(fade);
        el.style.transform = `translate3d(${tagPos.x}px, ${tagPos.y}px, 0)`;
        if (region >= 0) { el.style.setProperty('--c', rgb(LIT[region])); if (el.dataset.r !== String(region)) { el.dataset.r = String(region); el.lastElementChild!.textContent = NAMES[region]; } }
      }
    };
    const sync = () => {
      const c = chapterAt();
      const n = Math.round(c);
      setActive((a) => (a === n ? a : n));
      cards.current.forEach((el, i) => {
        if (!el) return;
        const d = c - i;
        const o = clamp(1 - (Math.abs(d) - 0.28) / 0.34, 0, 1);
        el.style.opacity = String(o);
        el.style.transform = `translate3d(0, ${clamp(-d, -1, 1) * 34}px, 0)`;
        el.style.visibility = o > 0 ? 'visible' : 'hidden';
      });
      hint.current?.classList.toggle('gone', c > 0.12);
      dirty = true;
    };
    addEventListener('scroll', sync, { passive: true });

    // dragging turns the brain; a tap sends a pulse
    let px = 0, py = 0, downT = 0, moved = 0, pid = -1;
    const cellAt = (clientX: number, clientY: number) => {
      const r = cv.getBoundingClientRect();
      const col = Math.floor(((clientX - r.left) * dpr) / cwd), row = Math.floor(((clientY - r.top) * dpr) / chd);
      for (let d = 0; d <= 2; d++) for (let dy = -d; dy <= d; dy++) for (let dx = -d; dx <= d; dx++) {
        const cc = col + dx, rr = row + dy;
        if (cc < 0 || rr < 0 || cc >= cols || rr >= rows) continue;
        const who = fr.who[rr * cols + cc];
        if (who >= 0) return who;
      }
      return -1;
    };
    const down = (e: PointerEvent) => {
      if (pid !== -1 || (e.pointerType === 'mouse' && e.button !== 0)) return;
      pid = e.pointerId; px = e.clientX; py = e.clientY; downT = performance.now(); moved = 0;
      dragging = true; idle = 0; velYaw = velPitch = 0;
      host.setPointerCapture(e.pointerId);
    };
    const move = (e: PointerEvent) => {
      if (e.pointerId !== pid) return;
      const dx = e.clientX - px, dy = e.clientY - py;
      px = e.clientX; py = e.clientY;
      moved += Math.abs(dx) + Math.abs(dy);
      const k = 3.6 / Math.max(300, Math.min(W, 900));
      const ay = dx * k, ap = e.pointerType === 'mouse' ? dy * k : 0;
      offYaw += ay; offPitch += ap;
      const dtm = Math.max(8, performance.now() - downT);
      velYaw = clamp((ay / dtm) * 1000 * 0.5 + velYaw * 0.5, -6, 6);
      velPitch = clamp((ap / dtm) * 1000 * 0.5 + velPitch * 0.5, -4, 4);
      downT = performance.now();
      idle = 0; dirty = true;
    };
    const up = (e: PointerEvent) => {
      if (e.pointerId !== pid) return;
      pid = -1; dragging = false; idle = 0;
      if (e.type === 'pointerup' && moved < 8) {
        const i = cellAt(e.clientX, e.clientY);
        if (i >= 0) sparks.push({ x: cloud.pos[i * 3], y: cloud.pos[i * 3 + 1], z: cloud.pos[i * 3 + 2], t0: time });
        velYaw = velPitch = 0;
        dirty = true;
      }
    };
    host.addEventListener('pointerdown', down);
    host.addEventListener('pointermove', move);
    host.addEventListener('pointerup', up);
    host.addEventListener('pointercancel', up);

    layout();
    let lw = W, lh = H;
    const ro = new ResizeObserver(() => {
      const r = host.getBoundingClientRect();
      if (Math.abs(r.width - lw) < 1 && Math.abs(r.height - lh) < 120) return; // a phone's toolbar sliding away isn't a resize
      lw = r.width; lh = r.height;
      layout(); sync();
    });
    ro.observe(host);
    sync();
    now.yaw = want.yaw; now.pitch = want.pitch;
    raf = requestAnimationFrame(step);
    const onMotion = () => { dirty = true; };
    reduced.addEventListener('change', onMotion);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      removeEventListener('scroll', sync);
      reduced.removeEventListener('change', onMotion);
      host.removeEventListener('pointerdown', down);
      host.removeEventListener('pointermove', move);
      host.removeEventListener('pointerup', up);
      host.removeEventListener('pointercancel', up);
    };
  }, [cloud]);

  const goTo = (i: number) => scrollTo({ top: i * (stage.current?.clientHeight ?? innerHeight), behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });

  return (
    <div class="brain-page" style={{ '--n': CHAPTERS.length }}>
      <div class="brain-stage" ref={stage}>
        <canvas ref={canvas} class="brain-canvas" aria-label="A 3D brain drawn in letters, turning as you scroll" role="img" />
        <div class="brain-tag" ref={tag} aria-hidden="true"><i /><span /></div>
        <button class="brain-back" onClick={() => goBack('settings')}><Icon name="chevron-left" size={18} /> Settings</button>
        <nav class="brain-rail" aria-label="Chapters">
          {CHAPTERS.map((c, i) => (
            <button
              class={i === active ? 'on' : ''}
              style={c.region >= 0 ? { '--c': rgb(LIT[c.region]) } : undefined}
              aria-label={c.title}
              aria-current={i === active ? 'step' : undefined}
              onClick={() => goTo(i)}
            />
          ))}
        </nav>
        {!cloud && (
          <div class="brain-loading" role="status">
            <span class="brain-loading-bar"><i style={{ transform: `scaleX(${progress})` }} /></span>
            <span>Growing neurons…</span>
          </div>
        )}
        <div class="brain-hint" ref={hint}><span>Scroll</span><Icon name="arrow-down" size={16} /></div>
      </div>
      <div class="brain-track">
        {CHAPTERS.map((c, i) => (
          <section class="brain-chapter">
            <article class="brain-card" ref={(el) => void (cards.current[i] = el)} style={c.region >= 0 ? { '--c': rgb(LIT[c.region]) } : undefined}>
              <div class="brain-kicker"><b>{String(i + 1).padStart(2, '0')}</b> {c.kicker}</div>
              <h2>{c.title}</h2>
              <p>{c.body}</p>
              {c.stat && <div class="brain-stat"><b>{c.stat[0]}</b><span>{c.stat[1]}</span></div>}
              {i === LAST && (
                <div class="brain-actions">
                  <button class="brain-btn" onClick={() => goTo(0)}>Back to start</button>
                  <button class="brain-btn ghost" onClick={() => goBack('settings')}>Done</button>
                </div>
              )}
            </article>
          </section>
        ))}
      </div>
    </div>
  );
}
