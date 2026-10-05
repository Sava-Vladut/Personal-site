// Runs Whisper off the main thread, so the page stays smooth while it listens back. lib/voice.ts talks to it.
import { VOICE_MODEL_CACHE, VOICE_RUNTIME, type VoiceReply, type VoiceRequest } from './voiceConfig';

interface Recogniser {
  (audio: Float32Array, options: Record<string, unknown>): Promise<{ text: string } | { text: string }[]>;
  dispose?: () => Promise<void>;
}
interface Runtime {
  pipeline(task: string, model: string, options: Record<string, unknown>): Promise<Recogniser>;
  env: Record<string, any>;
}

const scope = self as unknown as { postMessage(message: VoiceReply): void; onmessage: ((e: MessageEvent<VoiceRequest>) => void) | null };
const send = (m: VoiceReply) => scope.postMessage(m);
const origin = self.location.origin;

let runtime: Promise<Runtime> | undefined;
let current: { repo: string; recogniser: Recogniser } | undefined;

// The runtime is one bundled file (scripts/build-voice.mjs) kept out of the app's own bundle: only people who turn
// voice typing on ever download it. Its WebAssembly comes from our own server too, so no third party is involved.
function start() {
  runtime ??= (import(/* @vite-ignore */ `${origin}/voice/transformers-${VOICE_RUNTIME}.js`) as Promise<Runtime>).then((r) => {
    const { env } = r;
    env.allowLocalModels = false;
    env.remoteHost = `${origin}/voice/models/`;
    env.useBrowserCache = true;
    env.cacheKey = VOICE_MODEL_CACHE;
    // The wasm is fetched by the runtime itself (and kept by the service worker); a blob copy of its loader would break the CSP.
    env.useWasmCache = false;
    const wasm = env.backends.onnx.wasm;
    wasm.numThreads = 1; // more would need cross-origin isolation
    wasm.wasmPaths = { mjs: `${origin}/voice/ort-${VOICE_RUNTIME}/ort-wasm-simd-threaded.mjs`, wasm: `${origin}/voice/ort-${VOICE_RUNTIME}/ort-wasm-simd-threaded.wasm` };
    return r;
  });
  runtime.catch(() => (runtime = undefined));
  return runtime;
}

async function load(repo: string) {
  if (current?.repo === repo) return send({ type: 'ready' });
  const { pipeline } = await start();
  const old = current;
  current = undefined;
  await old?.recogniser.dispose?.();
  const recogniser = await pipeline('automatic-speech-recognition', repo, {
    dtype: 'q8',
    device: 'wasm',
    progress_callback: (p: { status: string; progress?: number }) => {
      if (p.status === 'progress_total' && typeof p.progress === 'number') send({ type: 'progress', progress: Math.min(1, p.progress / 100) });
    },
  });
  current = { repo, recogniser };
  send({ type: 'ready' });
}

async function transcribe(id: number, audio: Float32Array, language: string) {
  if (!current) throw new Error('The speech model isn’t loaded.');
  const { repo, recogniser } = current;
  // 30-second windows, overlapped a little so words on the seams aren't lost.
  const options: Record<string, unknown> = { chunk_length_s: 30, stride_length_s: 5 };
  // English-only models refuse a language; the others guess it unless they're told.
  if (!repo.endsWith('.en') && language) Object.assign(options, { language, task: 'transcribe' });
  const out = await recogniser(audio, options);
  send({ type: 'result', id, text: (Array.isArray(out) ? out : [out]).map((o) => o.text).join(' ') });
}

// One thing at a time: a model load and a transcription must not overlap.
let queue = Promise.resolve();
scope.onmessage = (e) => {
  const m = e.data;
  queue = queue
    .then(() => (m.type === 'load' ? load(m.repo) : transcribe(m.id, m.audio, m.language)))
    .catch((error: unknown) => send({ type: 'error', id: m.type === 'transcribe' ? m.id : undefined, message: error instanceof Error ? error.message : String(error) }));
};
