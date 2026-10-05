// Voice typing. Speech is recorded here, turned into words by Whisper running on this device (lib/voice.worker.ts),
// and put in the note. The audio never leaves the phone or computer; the only download is the model, once.
import { observable, toast } from './store';
import { VOICE_LANGUAGES, VOICE_MODELS, VOICE_MODEL_CACHE, VOICE_RUNTIME_CACHE, type VoiceModel, type VoiceReply, type VoiceRequest } from './voiceConfig';
import { cleanTranscript, loudness, toMono16k } from './voiceText';

export interface VoiceState {
  /** The model chosen in Settings, whether or not it has been downloaded. */
  model: string;
  language: string;
  /** Models downloaded to this device. */
  installed: string[];
  preparing: boolean;
  /** 0–1 while a model downloads; 0 until the first bytes arrive. */
  progress: number;
  /** Why the last download failed, until the next try. */
  error: string;
  activity: 'idle' | 'recording' | 'transcribing';
  seconds: number;
}

const KEY = 'mm-voice';
const MAX_SECONDS = 5 * 60;
const QUIET = 0.003; // below this loudness the recording is silence, which Whisper would invent words for

function saved(): Pick<VoiceState, 'model' | 'language' | 'installed'> {
  let raw: Partial<Pick<VoiceState, 'model' | 'language' | 'installed'>> = {};
  try { raw = JSON.parse(localStorage.getItem(KEY) ?? '{}'); } catch {}
  const known = (id: unknown): id is string => VOICE_MODELS.some((m) => m.id === id);
  return {
    model: known(raw.model) ? raw.model : VOICE_MODELS[0].id,
    language: VOICE_LANGUAGES.some(([code]) => code === raw.language) ? raw.language! : '',
    installed: Array.isArray(raw.installed) ? raw.installed.filter(known) : [],
  };
}

const state$ = observable<VoiceState>({ ...saved(), preparing: false, progress: 0, error: '', activity: 'idle', seconds: 0 });
export const useVoice = state$.use;
export const voiceState = state$.get;

function set(patch: Partial<VoiceState>) {
  state$.set({ ...state$.get(), ...patch });
  if ('model' in patch || 'language' in patch || 'installed' in patch) {
    const { model, language, installed } = state$.get();
    try { localStorage.setItem(KEY, JSON.stringify({ model, language, installed })); } catch {}
  }
}

export const voiceModel = (id = state$.get().model): VoiceModel => VOICE_MODELS.find((m) => m.id === id) ?? VOICE_MODELS[0];
export const chooseModel = (model: string) => set({ model });
export const chooseLanguage = (language: string) => set({ language });

/** Whether this browser can record and run the model. Not an https page, no microphone, no WebAssembly: no button. */
export function voiceSupported() {
  try {
    return isSecureContext && !!navigator.mediaDevices?.getUserMedia && typeof MediaRecorder !== 'undefined' && typeof Worker !== 'undefined' && typeof WebAssembly === 'object' && typeof AudioContext !== 'undefined';
  } catch {
    return false;
  }
}

/* ---------- the worker ---------- */

let worker: Worker | null = null;
let resting = 0;
let nextJob = 1;
const jobs = new Map<number, { resolve: (text: string) => void; reject: (error: Error) => void }>();
let loading: { repo: string; promise: Promise<void>; resolve: () => void; reject: (error: Error) => void } | null = null;

function friendly(message: string) {
  if (/fetch|network|import|load failed|offline/i.test(message)) return 'Couldn’t download the speech model. Check your connection and try again.';
  if (/memory|alloc/i.test(message)) return 'This device ran out of memory. Try the Quick model in Settings.';
  return 'Voice typing ran into a problem: ' + message;
}

function crash(error: Error) {
  loading?.reject(error);
  for (const job of jobs.values()) job.reject(error);
  jobs.clear();
  worker?.terminate();
  worker = null;
}

function connect() {
  if (worker) return worker;
  const w = new Worker(new URL('./voice.worker.ts', import.meta.url), { type: 'module' });
  w.onmessage = (e: MessageEvent<VoiceReply>) => {
    const m = e.data;
    if (m.type === 'progress') {
      if (m.progress === 1 || Math.abs(m.progress - state$.get().progress) >= 0.005) set({ progress: m.progress });
    }
    else if (m.type === 'ready') loading?.resolve();
    else if (m.type === 'result') {
      jobs.get(m.id)?.resolve(m.text);
      jobs.delete(m.id);
    } else if (m.id !== undefined) {
      jobs.get(m.id)?.reject(new Error(friendly(m.message)));
      jobs.delete(m.id);
    } else loading?.reject(new Error(friendly(m.message)));
  };
  w.onerror = (e) => {
    e.preventDefault();
    crash(new Error('Voice typing couldn’t start in this browser.'));
  };
  return (worker = w);
}

/** A model sits in memory while it's used and is let go a little after, so a phone gets its memory back. */
function rest() {
  clearTimeout(resting);
  resting = window.setTimeout(() => {
    const busy = loading || jobs.size || state$.get().preparing || state$.get().activity !== 'idle';
    if (busy) return rest();
    worker?.terminate();
    worker = null;
  }, 90_000);
}

async function loadModel(repo: string) {
  clearTimeout(resting);
  while (loading && loading.repo !== repo) await loading.promise.catch(() => {});
  if (loading) return loading.promise;
  const w = connect();
  let resolve!: () => void, reject!: (error: Error) => void;
  const promise = new Promise<void>((a, b) => ((resolve = a), (reject = b)));
  const entry = { repo, promise, resolve: () => ((loading = null), resolve()), reject: (error: Error) => ((loading = null), reject(error)) };
  loading = entry;
  w.postMessage({ type: 'load', repo } satisfies VoiceRequest);
  return promise;
}

function recognise(audio: Float32Array, language: string) {
  clearTimeout(resting);
  const w = connect();
  const id = nextJob++;
  return new Promise<string>((resolve, reject) => {
    jobs.set(id, { resolve, reject });
    w.postMessage({ type: 'transcribe', id, audio, language } satisfies VoiceRequest, [audio.buffer]);
  });
}

/* ---------- the model on this device ---------- */

/** Downloads the chosen model (and the runtime, the first time) so it works from then on, offline too. */
export async function downloadModel(id = state$.get().model) {
  if (state$.get().preparing) return;
  const model = voiceModel(id);
  set({ preparing: true, progress: 0, error: '' });
  try {
    await loadModel(model.repo);
    const { installed } = state$.get();
    set({ installed: installed.includes(model.id) ? installed : [...installed, model.id] });
  } catch (error) {
    set({ error: error instanceof Error ? error.message : 'Couldn’t download the speech model.' });
  } finally {
    set({ preparing: false });
    rest();
  }
}

/** Forgets every downloaded model and the runtime. */
export async function removeModels() {
  worker?.terminate();
  worker = null;
  loading = null;
  set({ installed: [], preparing: false, progress: 0, error: '' });
  try {
    await Promise.all([caches.delete(VOICE_MODEL_CACHE), caches.delete(VOICE_RUNTIME_CACHE)]);
  } catch {}
}

/* ---------- recording ---------- */

let session: { recorder: MediaRecorder; stream: MediaStream; chunks: Blob[]; clock: number; started: number } | null = null;
let sink: ((text: string) => void) | null = null;

/** Where finished words go: the open note. Returns what lets go of it, which does nothing if another note has taken over. */
export function setVoiceSink(next: (text: string) => void) {
  sink = next;
  return () => {
    if (sink === next) sink = null;
  };
}

function microphoneError(error: unknown) {
  const name = (error as { name?: string })?.name;
  if (name === 'NotAllowedError' || name === 'SecurityError') return 'Microphone access is blocked. Allow it for this site in your browser’s settings.';
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'No microphone found.';
  if (name === 'NotReadableError') return 'The microphone is in use by another app.';
  return 'Couldn’t start the microphone.';
}

const stopTracks = (stream: MediaStream) => stream.getTracks().forEach((t) => t.stop());

export async function startRecording() {
  if (state$.get().activity !== 'idle' || session) return;
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
  } catch (error) {
    return void toast(microphoneError(error));
  }
  try {
    const type = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm', 'audio/ogg;codecs=opus'].find((t) => MediaRecorder.isTypeSupported(t));
    const recorder = new MediaRecorder(stream, type ? { mimeType: type } : undefined);
    const chunks: Blob[] = [];
    recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };
    recorder.start();
    const started = Date.now();
    const clock = window.setInterval(() => {
      const seconds = (Date.now() - started) / 1000;
      set({ seconds });
      if (seconds >= MAX_SECONDS) void stopRecording();
    }, 250);
    session = { recorder, stream, chunks, clock, started };
    set({ activity: 'recording', seconds: 0 });
    // Wake the model up while they talk; a problem with it is reported when they stop.
    void loadModel(voiceModel().repo).catch(() => {});
  } catch {
    stopTracks(stream);
    toast('Couldn’t start recording in this browser.');
  }
}

/** Decodes what was recorded into the 16 kHz mono samples Whisper takes. */
async function samples(blob: Blob) {
  let context: AudioContext;
  try {
    context = new AudioContext({ sampleRate: 16000 });
  } catch {
    context = new AudioContext(); // older Safari: decoded at the device's rate, brought to 16 kHz below
  }
  try {
    const buffer = await context.decodeAudioData(await blob.arrayBuffer());
    return toMono16k(Array.from({ length: buffer.numberOfChannels }, (_, i) => buffer.getChannelData(i)), buffer.sampleRate);
  } finally {
    void context.close();
  }
}

/** Stops listening, turns what was said into words and hands them to the open note. */
export async function stopRecording() {
  const s = session;
  if (!s) return;
  session = null;
  clearInterval(s.clock);
  set({ activity: 'transcribing' });
  try {
    await new Promise<void>((done) => {
      if (s.recorder.state === 'inactive') return done();
      s.recorder.onstop = () => done();
      s.recorder.stop();
    });
    stopTracks(s.stream);
    const blob = new Blob(s.chunks, { type: s.recorder.mimeType });
    if (Date.now() - s.started < 500 || !blob.size) return void toast('Too short — hold on a bit longer.');
    const audio = await samples(blob);
    if (loudness(audio) < QUIET) return void toast('Didn’t hear anything. Is the microphone covered?');
    const { model, language } = state$.get();
    await loadModel(voiceModel(model).repo);
    const text = cleanTranscript(await recognise(audio, language));
    if (!text) return void toast('Didn’t catch any words.');
    if (sink) sink(text);
    else toast('The note was closed before this was ready.', { label: 'Copy', run: () => void navigator.clipboard?.writeText(text) });
  } catch (error) {
    stopTracks(s.stream);
    toast(error instanceof Error && !/decode/i.test(error.message) ? error.message : 'Couldn’t read that recording. Try again.');
  } finally {
    set({ activity: 'idle', seconds: 0 });
    rest();
  }
}

/** Drops a recording in progress without transcribing it. */
export function cancelRecording() {
  const s = session;
  if (!s) return;
  session = null;
  clearInterval(s.clock);
  s.recorder.onstop = null;
  if (s.recorder.state !== 'inactive') s.recorder.stop();
  stopTracks(s.stream);
  set({ activity: 'idle', seconds: 0 });
}

// A recording shouldn't run on in a tab nobody is looking at; what was said so far is written down.
if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => document.hidden && void stopRecording());
