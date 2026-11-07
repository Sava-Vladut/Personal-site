// The push-up counter: the camera watches you, a pose model finds your shoulders, elbows, wrists and hips in each frame
// (lib/pose.ts), and lib/pushups.ts counts a rep each time you go down and push back up. It speaks each number, so you
// don't have to look, and keeps the screen awake. Nothing leaves the device: the model runs in the page, and the video
// is never saved or sent anywhere.
import { createPortal } from 'preact/compat';
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { PoseLandmarker } from '@mediapipe/tasks-vision';
import { loadPose } from '../../lib/pose';
import { createCounter, pushupReps, type Cue, type Mark, type Phase } from '../../lib/pushups';
import { pushBack } from '../../lib/router';
import { usePref } from '../../lib/prefs';
import { useWorkouts } from '../../lib/store';
import { haptic } from '../../lib/haptics';
import { count as countOf, LOCALE, noun, t } from '../../lib/i18n';
import { Icon } from '../icons';
import '../../styles/pushups.css';

type Facing = 'user' | 'environment';

// the lines drawn over you: shoulders, arms, body and legs
const BONES: [number, number][] = [[11, 12], [11, 13], [13, 15], [12, 14], [14, 16], [11, 23], [12, 24], [23, 24], [23, 25], [25, 27], [24, 26], [26, 28]];
const JOINTS = [11, 12, 13, 14, 15, 16, 23, 24, 25, 26, 27, 28];
/** About 18 frames a second is plenty for push-ups, and spares the battery. */
const FRAME_MS = 55;

/* ---------- sound: the count spoken, or a blip where speech isn't there ---------- */

let audio: AudioContext | null = null;

/**
 * Called from the tap that opens the counter: phones only let a page speak or play sound once a tap has asked for it,
 * and the counter starts talking much later, when the first rep comes.
 */
export function unlockSound() {
  try {
    audio ??= new AudioContext();
    void audio.resume();
  } catch { /* no Web Audio: speech alone */ }
  try {
    if ('speechSynthesis' in window) {
      const hush = new SpeechSynthesisUtterance('');
      hush.volume = 0;
      speechSynthesis.speak(hush);
    }
  } catch { /* no speech: the blip alone */ }
}

function blip(high: boolean) {
  if (!audio) return;
  try {
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.frequency.value = high ? 880 : 330;
    gain.gain.setValueAtTime(0.25, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audio.currentTime + 0.18);
    osc.connect(gain).connect(audio.destination);
    osc.start();
    osc.stop(audio.currentTime + 0.2);
  } catch { /* sound is a nicety */ }
}

function say(text: string, fallbackHigh: boolean) {
  if (!('speechSynthesis' in window)) return blip(fallbackHigh);
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = LOCALE;
    u.rate = 1.15;
    speechSynthesis.speak(u);
  } catch {
    blip(fallbackHigh);
  }
}

/* ---------- the camera ---------- */

function cameraError(e: unknown) {
  const name = (e as { name?: string })?.name;
  if (!window.isSecureContext) return t('The camera only works on a secure (https) page.');
  if (name === 'NotAllowedError' || name === 'SecurityError') return t('The camera is blocked. Allow it for this site in your browser’s settings, then try again.');
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return t('No camera found on this device.');
  if (name === 'NotReadableError') return t('Another app is using the camera. Close it and try again.');
  return t('Couldn’t start the camera.');
}

/** Your best set of push-ups so far, from your finished workouts. */
function useBest() {
  const workouts = useWorkouts();
  return useMemo(() => {
    let best = 0;
    for (const w of workouts) if (w.end !== null) best = Math.max(best, ...pushupReps(w));
    return best;
  }, [workouts]);
}

/**
 * Full screen over the page. `onSave` gets the reps and when counting began; it's up to the page where they go (a set
 * of the workout going on, or a workout of their own).
 */
export function PushupCounter({ onClose, onSave, saveLabel }: { onClose: () => void; onSave: (reps: number, start: number) => void; saveLabel?: string }) {
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const meter = useRef<HTMLSpanElement>(null);
  const pose = useRef<PoseLandmarker | null>(null);
  const counter = useRef(createCounter());
  const started = useRef(Date.now());
  const best = useBest();

  const [facing, setFacing] = useState<Facing>('user');
  const [cameras, setCameras] = useState(1);
  const [camKey, setCamKey] = useState(0);
  const [camError, setCamError] = useState<string | null>(null);
  const [model, setModel] = useState<'loading' | 'ready' | 'failed'>('loading');
  const [modelKey, setModelKey] = useState(0);
  const [reps, setReps] = useState(0);
  const [phase, setPhase] = useState<Phase>('unseen');
  const [flash, setFlash] = useState<Cue>(null);
  const [leaving, setLeaving] = useState(false);
  const [sound, setSound] = usePref<boolean>('wo-pu-sound', true);
  const soundRef = useRef(sound);
  soundRef.current = sound;

  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  const repsRef = useRef(0);
  repsRef.current = reps;

  // the back button and Escape close it (asking first when there are reps to keep)
  useEffect(() => {
    const leave = () => (repsRef.current ? setLeaving(true) : closeRef.current());
    const onBack = () => {
      if (!repsRef.current) return closeRef.current();
      // the back button used up its step: take another, so pressing it again still lands here
      release = pushBack(onBack);
      setLeaving(true);
    };
    let release = pushBack(onBack);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && leave();
    addEventListener('keydown', onKey);
    return () => {
      removeEventListener('keydown', onKey);
      release();
    };
  }, []);

  // the pose model: downloaded the first time (about 9 MB), then from the cache
  useEffect(() => {
    let gone = false;
    setModel('loading');
    loadPose().then(
      (p) => {
        if (gone) return p.close();
        pose.current = p;
        setModel('ready');
      },
      () => !gone && setModel('failed'),
    );
    return () => {
      gone = true;
      pose.current?.close();
      pose.current = null;
    };
  }, [modelKey]);

  // the camera, again whenever it's flipped, or comes back after the phone put it to sleep
  useEffect(() => {
    let gone = false;
    let stream: MediaStream | null = null;
    setCamError(null);
    (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('unsupported');
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: facing, width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 30 } },
        });
        if (gone) return stream.getTracks().forEach((tr) => tr.stop());
        const v = video.current!;
        v.srcObject = stream;
        await v.play().catch(() => {});
        const devices = await navigator.mediaDevices.enumerateDevices().catch(() => []);
        if (!gone) setCameras(devices.filter((d) => d.kind === 'videoinput').length);
      } catch (e) {
        if (!gone) setCamError(cameraError(e));
      }
    })();
    return () => {
      gone = true;
      stream?.getTracks().forEach((tr) => tr.stop());
      if (video.current) video.current.srcObject = null;
    };
  }, [facing, camKey]);

  // the screen stays on while counting; a phone that hid the page stops its camera, so it's started again on return
  useEffect(() => {
    let lock: WakeLockSentinel | null = null;
    const awake = () => navigator.wakeLock?.request('screen').then((l) => (lock = l), () => {});
    void awake();
    const onShow = () => {
      if (document.visibilityState !== 'visible') return;
      void awake();
      const stream = video.current?.srcObject as MediaStream | null;
      if (!stream || stream.getVideoTracks().some((tr) => tr.readyState === 'ended')) setCamKey((k) => k + 1);
    };
    document.addEventListener('visibilitychange', onShow);
    return () => {
      document.removeEventListener('visibilitychange', onShow);
      void lock?.release().catch(() => {});
      if ('speechSynthesis' in window) speechSynthesis.cancel();
    };
  }, []);

  // each frame: find the pose, count, draw
  useEffect(() => {
    let raf = 0;
    let lastFrame = -1;
    let lastTime = 0;
    let flashTimer = 0;
    let shown: { phase: Phase; reps: number } = { phase: 'unseen', reps: 0 };
    const style = getComputedStyle(document.documentElement);
    const accent = style.getPropertyValue('--accent').trim() || style.getPropertyValue('--ink').trim();
    const line = style.getPropertyValue('--on-color').trim() || 'white';

    const tick = () => {
      raf = requestAnimationFrame(tick);
      const v = video.current, p = pose.current;
      if (!v || !p || v.readyState < 2 || !v.videoWidth) return;
      const now = performance.now();
      if (v.currentTime === lastFrame || now - lastTime < FRAME_MS) return;
      lastFrame = v.currentTime;
      lastTime = now;
      let marks: Mark[] | undefined;
      try {
        marks = p.detectForVideo(v, now).landmarks[0];
      } catch {
        return;
      }
      const out = counter.current.step(marks, v.videoWidth, v.videoHeight, now);
      if (meter.current) meter.current.style.setProperty('--d', String(Math.min(1, out.depth)));
      meter.current?.classList.toggle('is-deep', out.depth >= 1);
      if (out.phase !== shown.phase || out.count !== shown.reps) {
        shown = { phase: out.phase, reps: out.count };
        setPhase(out.phase);
        setReps(out.count);
      }
      if (out.cue) {
        if (out.cue === 'rep') {
          haptic(10);
          if (soundRef.current) say(String(out.count), true);
        } else {
          if (soundRef.current) say(out.cue === 'shallow' ? t('Lower') : t('Body straight'), false);
          setFlash(out.cue);
          clearTimeout(flashTimer);
          flashTimer = window.setTimeout(() => setFlash(null), 1600);
        }
      }
      draw(canvas.current, v, marks, accent, line);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(flashTimer);
    };
  }, []);

  const reset = () => {
    counter.current.reset();
    started.current = Date.now();
    setReps(0);
    setLeaving(false);
  };
  const save = () => {
    if (!reps) return;
    haptic(10);
    onSave(reps, started.current);
  };

  const status = camError ?? (model === 'failed' ? t('Couldn’t load the pose model. Check your connection and try again.')
    : model === 'loading' ? t('Getting the pose model ready. The first time it downloads about 9 MB.')
    : flash === 'shallow' ? t('Go lower: bend your elbows to about 90°')
    : flash === 'hips' ? t('Keep your body in a straight line')
    : MESSAGES[phase]());
  const failed = !!camError || model === 'failed';
  const mirror = facing === 'user';

  return createPortal(
    <div class="pu" role="dialog" aria-modal="true" aria-label={t('Push-up counter')}>
      <div class={`pu-view${mirror ? ' is-mirror' : ''}`}>
        <video ref={video} class="pu-video" playsInline muted autoPlay />
        <canvas ref={canvas} class="pu-bones" />
      </div>

      <div class="pu-top">
        <button class="icon-btn pu-btn" onClick={() => (reps ? setLeaving(true) : onClose())} aria-label={t('Close')} title={t('Close')}>
          <Icon name="x" size={22} />
        </button>
        <span class="pu-title">{t('Push-up counter')}</span>
        <button class="icon-btn pu-btn" aria-pressed={sound} onClick={() => (unlockSound(), setSound(!sound))}
          aria-label={sound ? t('Turn off counting out loud') : t('Count out loud')} title={sound ? t('Turn off counting out loud') : t('Count out loud')}>
          <Icon name={sound ? 'volume' : 'volume-off'} size={22} />
        </button>
        {cameras > 1 && (
          <button class="icon-btn pu-btn" onClick={() => setFacing(facing === 'user' ? 'environment' : 'user')} aria-label={t('Switch camera')} title={t('Switch camera')}>
            <Icon name="camera-rotate" size={22} />
          </button>
        )}
      </div>

      <div class="pu-count" aria-live="polite">
        <span key={reps} class={`pu-num${reps ? ' is-new' : ''}`}>{reps}</span>
        <span class="pu-unit">{noun(reps, 'push-up', 'push-ups')}</span>
        {best > 0 && <span class="pu-best">{reps > best ? t('New best!') : t('Best: {n}', { n: best })}</span>}
      </div>

      <div class={`pu-meter${phase === 'up' || phase === 'down' ? ' is-on' : ''}`} aria-hidden="true">
        <span ref={meter} class="pu-fill" />
      </div>

      <div class="pu-bottom">
        <p class={`pu-status${flash ? ' is-cue' : ''}${failed ? ' is-error' : ''}`} role="status">
          {model === 'loading' && !camError && <Icon name="loader-2" size={16} class="pu-spin" />}
          {status}
        </p>
        {failed ? (
          <div class="pu-foot">
            <button class="btn btn-primary pu-wide" onClick={() => (camError ? setCamKey((k) => k + 1) : setModelKey((k) => k + 1))}>
              <Icon name="refresh" size={18} />
              {t('Try again')}
            </button>
          </div>
        ) : leaving ? (
          <div class="pu-foot">
            <p class="pu-ask">{t('Leave without saving {count}?', { count: countOf(reps, 'push-up', 'push-ups') })}</p>
            <button class="btn pu-quiet" onClick={onClose}>{t('Leave')}</button>
            <button class="btn btn-primary" onClick={save}>{t('Save')}</button>
          </div>
        ) : (
          <div class="pu-foot">
            <button class="btn pu-quiet" onClick={reset} disabled={!reps}>
              <Icon name="restore" size={18} />
              {t('Start over')}
            </button>
            <button class="btn btn-primary pu-wide" onClick={save} disabled={!reps}>
              <Icon name="check" size={18} />
              {saveLabel ?? t('Save')}
            </button>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

const MESSAGES: Record<Phase, () => string> = {
  unseen: () => t('Stand the phone on the floor 1–2 m away, to your side or at an angle, so it sees all of you'),
  partial: () => t('Move back so your arms and hips are in view'),
  ready: () => t('Get into a plank with your arms straight'),
  up: () => t('Go! Chest down, then push back up'),
  down: () => t('Push!'),
};

/** The pose over the video, as the video is shown (covering the frame, so it's cut at the sides). */
function draw(c: HTMLCanvasElement | null, v: HTMLVideoElement, marks: Mark[] | undefined, accent: string, line: string) {
  if (!c) return;
  const dpr = Math.min(2, devicePixelRatio || 1);
  const w = c.clientWidth, h = c.clientHeight;
  if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
    c.width = Math.round(w * dpr);
    c.height = Math.round(h * dpr);
  }
  const g = c.getContext('2d');
  if (!g) return;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
  g.clearRect(0, 0, w, h);
  if (!marks) return;
  const scale = Math.max(w / v.videoWidth, h / v.videoHeight);
  const ox = (w - v.videoWidth * scale) / 2, oy = (h - v.videoHeight * scale) / 2;
  const at = (i: number) => [ox + marks[i].x * v.videoWidth * scale, oy + marks[i].y * v.videoHeight * scale] as const;
  const seen = (i: number) => (marks[i].visibility ?? 1) >= 0.5;
  g.lineCap = 'round';
  g.lineWidth = 4;
  g.strokeStyle = line;
  g.globalAlpha = 0.85;
  for (const [a, b] of BONES) {
    if (!seen(a) || !seen(b)) continue;
    g.beginPath();
    g.moveTo(...at(a));
    g.lineTo(...at(b));
    g.stroke();
  }
  g.globalAlpha = 1;
  g.fillStyle = accent;
  for (const i of JOINTS) {
    if (!seen(i)) continue;
    g.beginPath();
    g.arc(...at(i), 6, 0, Math.PI * 2);
    g.fill();
  }
}
