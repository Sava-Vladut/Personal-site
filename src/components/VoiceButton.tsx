import { useEffect } from 'preact/hooks';
import { VOICE_LANGUAGES, VOICE_MODELS } from '../lib/voiceConfig';
import { cancelRecording, chooseLanguage, chooseModel, downloadModel, setVoiceSink, startRecording, stopRecording, useVoice, voiceModel, voiceState, voiceSupported } from '../lib/voice';
import { clock } from '../lib/voiceText';
import { Icon } from './icons';
import { Sheet } from './Sheet';
import '../styles/voice.css';
import { rich, t } from '../lib/i18n';

// keep the note focused (and a phone's keyboard up) while tapping, like the rest of the toolbar
const keepFocus = {
  onPointerDown: (e: PointerEvent) => e.preventDefault(),
  onMouseDown: (e: MouseEvent) => e.preventDefault(),
};

/**
 * Where spoken words go: `onText` is given each finished piece. A recording still running when the note closes is
 * dropped. Lives in the note itself rather than in the button, which comes and goes as the toolbar swaps.
 */
export function useDictation(onText: (text: string) => void) {
  useEffect(() => setVoiceSink(onText));
  useEffect(() => () => { if (voiceState().activity === 'recording') cancelRecording(); }, []);
}

/** The toolbar's microphone: tap to talk, tap again to write it down. The first time, it offers to download the model. */
export function VoiceButton({ onSetup }: { onSetup: () => void }) {
  const v = useVoice();
  if (!voiceSupported()) return null;
  const recording = v.activity === 'recording';
  const working = v.activity === 'transcribing';
  const label = recording ? t('Stop and write it down') : working ? t('Writing it down') : t('Talk to type');
  return (
    <button
      class={`format-btn voice-btn${recording ? ' is-recording' : ''}`}
      aria-pressed={recording}
      aria-label={label}
      title={label}
      disabled={working}
      {...keepFocus}
      onClick={() => (recording ? void stopRecording() : v.installed.includes(v.model) ? void startRecording() : onSetup())}
    >
      {working ? (
        <Icon name="loader-2" size={19} class="spin" />
      ) : recording ? (
        <>
          <span class="voice-time">{clock(v.seconds)}</span>
          <Icon name="player-stop" size={16} />
        </>
      ) : (
        <Icon name="microphone" size={19} />
      )}
    </button>
  );
}

/** The models to choose from, with what each costs to download. */
export function VoiceModels() {
  const v = useVoice();
  return (
    <div class="voice-models" role="radiogroup" aria-label={t('Speech model')}>
      {VOICE_MODELS.map((m) => (
        <button class="voice-model" role="radio" aria-checked={v.model === m.id} disabled={v.preparing} onClick={() => chooseModel(m.id)}>
          <span class="voice-model-name">
            <b>{t(m.label)}</b>
            <span class="muted small">{t(m.detail)}</span>
          </span>
          <span class="muted small">{v.installed.includes(m.id) ? t('On this device') : `${m.mb} MB`}</span>
        </button>
      ))}
    </div>
  );
}

export function VoiceLanguage() {
  const v = useVoice();
  return (
    <select class="input input-s" value={v.language} onChange={(e) => chooseLanguage(e.currentTarget.value)} aria-label={t('Language spoken')}>
      {VOICE_LANGUAGES.map(([code, name]) => <option value={code}>{t(name)}</option>)}
    </select>
  );
}

/** A download's progress, or a plain "Getting ready" until the first bytes arrive (the server fetches each file once first). */
export function VoiceProgress() {
  const v = useVoice();
  if (!v.preparing) return v.error ? <p class="hint danger" role="alert">{v.error}</p> : null;
  const started = v.progress > 0;
  return (
    <div class="voice-progress" role="status">
      <span class="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={started ? Math.round(v.progress * 100) : undefined} aria-label={t('Downloading the speech model')}>
        <i class={started ? '' : 'is-waiting'} style={started ? { width: `${Math.round(v.progress * 100)}%` } : undefined} />
      </span>
      <span class="muted small">{started ? `${Math.round(v.progress * 100)}%` : t('Getting ready…')}</span>
    </div>
  );
}

/** First-time setup: pick a model and download it. Once it's on the device, the same button starts talking. */
export function VoiceSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const v = useVoice();
  const model = voiceModel(v.model);
  const ready = v.installed.includes(model.id);
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={<span class="row gap-s"><Icon name="microphone" /> {t('Talk to type')}</span>}
      label={t('Talk to type')}
      footer={
        ready ? (
          <button class="btn btn-primary" onClick={() => { onClose(); void startRecording(); }}>{t('Start talking')}</button>
        ) : (
          <button class="btn btn-primary" onClick={() => void downloadModel()} disabled={v.preparing}>
            {v.preparing ? t('Downloading…') : t('Download · {mb} MB', { mb: model.mb })}
          </button>
        )
      }
    >
      <p class="hint">
        {rich('Say it instead of typing it. Your voice is turned into words {here} — the recording is never sent anywhere. It needs a one-time download of a speech model, and works offline after that.', { here: <b>{t('on this device')}</b> })}
      </p>
      <VoiceModels />
      {model.languages && (
        <div class="voice-language">
          <span>{t('Language')}</span>
          <VoiceLanguage />
        </div>
      )}
      <VoiceProgress />
    </Sheet>
  );
}
