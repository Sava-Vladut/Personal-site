/** Mixes channels down to one and, if the browser didn't already, resamples to the 16 kHz Whisper listens at. */
export function toMono16k(channels: Float32Array[], rate: number): Float32Array {
  const n = channels[0]?.length ?? 0;
  const mono = new Float32Array(n);
  for (const c of channels) for (let i = 0; i < n; i++) mono[i] += c[i] / channels.length;
  if (rate === 16000) return mono;
  const out = new Float32Array(Math.floor((n * 16000) / rate));
  const step = rate / 16000;
  for (let i = 0; i < out.length; i++) {
    const at = i * step, a = Math.floor(at), b = Math.min(a + 1, n - 1);
    out[i] = mono[a] + (mono[b] - mono[a]) * (at - a);
  }
  return out;
}

/** How loud the recording is, as a root mean square, so silence can be told from speech before spending time on it. */
export function loudness(audio: Float32Array) {
  if (!audio.length) return 0;
  let sum = 0;
  for (let i = 0; i < audio.length; i++) sum += audio[i] * audio[i];
  return Math.sqrt(sum / audio.length);
}

/**
 * What Whisper says it heard, without the notes it adds for sounds that aren't speech ([BLANK_AUDIO], (music), ♪),
 * and with its stray spacing tidied.
 */
export function cleanTranscript(text: string) {
  return text
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\((?:silence|music|applause|laughter|noise|blank[_ ]audio)\)/gi, ' ')
    .replace(/[♪♫]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?])/g, '$1')
    .trim();
}

/** The space to put before spoken text so it doesn't run into the word before the caret. */
export const spaceBefore = (before: string | undefined, text: string) =>
  before && !/[\s([{]$/.test(before) && !/^[,.;:!?)\]}]/.test(text) ? ' ' : '';

export const clock = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
