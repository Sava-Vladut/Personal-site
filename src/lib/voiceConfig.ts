/** The speech runtime's release. Its files are fetched under this name, so a new release is a new URL (scripts/build-voice.mjs). */
export const VOICE_RUNTIME = '4.3.0';

/** Where the runtime's downloads are kept on the device, so voice typing works offline once set up. */
export const VOICE_MODEL_CACHE = 'transformers-cache';
export const VOICE_RUNTIME_CACHE = 'mm-voice-v1';

export interface VoiceModel {
  id: string;
  repo: string;
  label: string;
  detail: string;
  /** Roughly what it downloads, in MB. */
  mb: number;
  /** Whether it can be told what language is spoken. */
  languages: boolean;
}

export const VOICE_MODELS: VoiceModel[] = [
  { id: 'tiny.en', repo: 'onnx-community/whisper-tiny.en', label: 'Quick', detail: 'English · fastest', mb: 45, languages: false },
  { id: 'base.en', repo: 'onnx-community/whisper-base.en', label: 'Accurate', detail: 'English · slower, fewer mistakes', mb: 80, languages: false },
  { id: 'base', repo: 'onnx-community/whisper-base', label: 'Other languages', detail: 'Around 100 languages', mb: 80, languages: true },
];

export const VOICE_LANGUAGES: [code: string, name: string][] = [
  ['', 'Detect automatically'],
  ['en', 'English'],
  ['ro', 'Romanian'],
  ['es', 'Spanish'],
  ['fr', 'French'],
  ['de', 'German'],
  ['it', 'Italian'],
  ['pt', 'Portuguese'],
  ['nl', 'Dutch'],
  ['pl', 'Polish'],
  ['ru', 'Russian'],
  ['uk', 'Ukrainian'],
  ['tr', 'Turkish'],
];

export type VoiceRequest =
  | { type: 'load'; repo: string }
  | { type: 'transcribe'; id: number; audio: Float32Array; language: string };

export type VoiceReply =
  | { type: 'progress'; progress: number }
  | { type: 'ready' }
  | { type: 'result'; id: number; text: string }
  | { type: 'error'; id?: number; message: string };
