// Making an exercise the database doesn't have: its name, how it's logged, what it's done with, the muscles it works,
// and what it's worth: the share of your body a body move or a hold lifts, or how hard a cardio one is.
import { useEffect, useState } from 'preact/hooks';
import { EQUIPS, KINDS, MUSCLES, fmtPower, type Equip, type Kind, type Move, type Muscle } from '../../lib/fitness';
import { saveMyMove, toast, uid } from '../../lib/store';
import { t } from '../../lib/i18n';
import { MuscleIcon } from '../BodyMap';
import { EQUIP_ICON, EQUIP_NAME, KIND_ICON, MUSCLE_NAME } from '../fitness';
import { Icon } from '../icons';
import { Sheet } from '../Sheet';
import { num, perUnit, useBodyWeight } from './shared';

const KIND_SHORT: Record<Kind, string> = { weight: t('Weights'), body: t('Body'), time: t('Hold'), cardio: t('Cardio') };
/** How hard a cardio exercise is, in METs: a brisk walk, a steady jog, a hard run. */
const EFFORTS: [number, string][] = [[4, t('Light')], [7, t('Moderate')], [10, t('Hard')]];

export function CreateMove({ open, name: typed, onClose, onMade }: { open: boolean; name: string; onClose: () => void; onMade: (m: Move) => void }) {
  const bw = useBodyWeight();
  const [name, setName] = useState('');
  const [kind, setKind] = useState<Kind>('body');
  const [equip, setEquip] = useState<Equip>('body');
  const [muscles, setMuscles] = useState<Muscle[]>([]);
  const [share, setShare] = useState(0.6);
  const [met, setMet] = useState(7);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(typed);
    setKind('body');
    setEquip('body');
    setMuscles([]);
    setShare(0.6);
    setMet(7);
  }, [open]);

  const pickKind = (k: Kind) => {
    setKind(k);
    setEquip(k === 'weight' ? 'dumbbell' : 'body');
  };
  const toggleMuscle = (m: Muscle) => setMuscles(muscles.includes(m) ? muscles.filter((x) => x !== m) : [...muscles, m]);
  const lifts = kind === 'body' || kind === 'time';
  const pct = Math.round(share * 100);
  // a rep (body moves), a minute (holds, cardio): what the move is worth at your weight
  const unit = perUnit({ kind, share: lifts ? share : 0, met: kind === 'cardio' ? met : 0, foot: false }, bw)?.p ?? 0;

  const save = async () => {
    const now = Date.now();
    setBusy(true);
    try {
      const made = await saveMyMove({
        id: 'my' + uid(), name: name.trim(), kind, equip, cat: kind === 'cardio' ? 'cardio' : 'strength', muscles, also: [],
        share: lifts ? share : 0, met: kind === 'cardio' ? met : 0, pair: equip === 'dumbbell', foot: false, level: 0, force: null, img: 0,
        created: now, updated: now,
      });
      toast(t('Exercise made'));
      onMade(made);
      onClose();
    } catch {
      toast(t('Couldn’t save the exercise. Try again.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t('New exercise')}
      footer={
        <button class="btn btn-primary wo-wide" onClick={save} disabled={!name.trim() || busy}>
          <Icon name="check" size={18} />
          {busy ? t('Saving…') : t('Make exercise')}
        </button>
      }
    >
      <div class="wo-make">
        <label class="wo-field">
          <span class="field-label">{t('Name')}</span>
          <input class="input" value={name} maxLength={120} autofocus={!typed} placeholder={t('Archer push-up')} onInput={(e) => setName(e.currentTarget.value)} />
        </label>

        <div class="wo-field">
          <span class="field-label">{t('How you log it')}</span>
          <div class="seg wo-kinds" role="tablist" aria-label={t('How you log it')}>
            {KINDS.map((k) => (
              <button key={k} role="tab" aria-selected={kind === k} onClick={() => pickKind(k)} title={k === 'time' ? t('Holds and stretches') : undefined}>
                <Icon name={KIND_ICON[k]} size={16} />
                {KIND_SHORT[k]}
              </button>
            ))}
          </div>
        </div>

        <div class="wo-field">
          <span class="field-label">{t('Equipment')}</span>
          <div class="chips scroll-x wo-chips" role="group" aria-label={t('Equipment')}>
            {EQUIPS.map((e) => (
              <button key={e} class="chip" aria-pressed={equip === e} onClick={() => setEquip(e)}>
                <Icon name={EQUIP_ICON[e]} size={16} />
                {EQUIP_NAME[e]}
              </button>
            ))}
          </div>
        </div>

        <div class="wo-field">
          <span class="field-label">{t('Muscles it works')} <span class="muted">· {t('the main one first')}</span></span>
          <div class="chips scroll-x wo-chips" role="group" aria-label={t('Muscles it works')}>
            {MUSCLES.map((m) => (
              <button key={m} class="chip" aria-pressed={muscles.includes(m)} onClick={() => toggleMuscle(m)}>
                <MuscleIcon muscle={m} size={16} />
                {MUSCLE_NAME[m]}
              </button>
            ))}
          </div>
        </div>

        {lifts && (
          <label class="wo-field">
            <span class="field-label">{t('Share of your body weight it lifts')}</span>
            <input
              class="wo-range"
              type="range"
              min={5}
              max={120}
              step={5}
              value={pct}
              style={{ '--v': `${(pct - 5) / 1.15}%` }}
              onInput={(e) => setShare(Number(e.currentTarget.value) / 100)}
            />
            <span class="wo-readout">
              <b>{pct}%</b>
              <Icon name="bolt" size={14} />
              {kind === 'body'
                ? t('= {p} ⚡/rep at {kg} kg', { p: fmtPower(unit), kg: num(bw) })
                : t('= {p} ⚡ a minute at {kg} kg', { p: fmtPower(unit), kg: num(bw) })}
            </span>
          </label>
        )}

        {kind === 'cardio' && (
          <div class="wo-field">
            <span class="field-label">{t('How hard it is')}</span>
            <div class="chips" role="group" aria-label={t('How hard it is')}>
              {EFFORTS.map(([v, label]) => (
                <button key={v} class="chip" aria-pressed={met === v} onClick={() => setMet(v)}>
                  <Icon name="flame" size={16} />
                  {label}
                </button>
              ))}
            </div>
            <span class="wo-readout">
              <Icon name="bolt" size={14} />
              {t('= {p} ⚡ for 10 minutes at {kg} kg', { p: fmtPower(unit * 10), kg: num(bw) })}
            </span>
          </div>
        )}
      </div>
    </Sheet>
  );
}
