// An exercise up close: its two pictures played as a flipbook, what it is, what one rep (or a minute) of it is worth in
// ⚡ at your weight, the muscles it works on the body, and how to do it step by step. One you made can be deleted here.
// From 1024px it's a wide sheet in two columns: the move and its power on the left, the muscles and the steps on the right.
import { useEffect, useRef, useState } from 'preact/hooks';
import { imageOf, stepsOf } from '../../lib/exercises';
import { fmtPower, repPower, type Move, type Muscle, type Snap } from '../../lib/fitness';
import { deleteMyMove, getMyMoves, saveMyMove, toast } from '../../lib/store';
import { count, t } from '../../lib/i18n';
import { BodyMap } from '../BodyMap';
import { CAT_NAME, EQUIP_ICON, EQUIP_NAME, KIND_ICON, KIND_NAME, MUSCLE_NAME } from '../fitness';
import { Icon } from '../icons';
import { Flipbook, Rolling, useMedia } from '../power';
import { Sheet } from '../Sheet';
import { num, perUnit, useBodyWeight, useMoves } from './shared';
import '../../styles/exercise.css';

const LEVEL = [t('Beginner'), t('Intermediate'), t('Expert')];

/** How an exercise's power is counted, in a sentence, with what it comes to at your weight. */
function powerText(m: Move, bw: number) {
  const kg = num(bw);
  const pct = Math.round(m.share * 100);
  if (m.kind === 'weight') return m.pair
    ? t('It counts the weight you lift: 10 kg lifted once is 1 ⚡, for anyone. One in each hand, both count.')
    : t('It counts the weight you lift: 10 kg lifted once is 1 ⚡, for anyone.');
  if (m.kind === 'body') return t('It lifts about {pct}% of your body, and 15% of that counts: at {kg} kg, one rep is {p} ⚡.', { pct, kg, p: fmtPower(repPower(m, { kg: 0 }, bw)) });
  const minute = perUnit(m, bw)?.p ?? 0;
  if (m.kind === 'time' && m.share) return t('A hold: every 3 seconds counts as a rep lifting {pct}% of your body, so a minute is {p} ⚡ at {kg} kg.', { pct, kg, p: fmtPower(minute) });
  const effort = t('It counts effort over time ({met} METs): ten minutes is {p} ⚡ at {kg} kg.', { met: num(m.met), kg, p: fmtPower(minute * 10) });
  return m.foot ? `${effort} ${t('With a distance, your pace sets the effort.')}` : effort;
}

/** The power card's sum: an amount of the exercise ("1 rep", "1 min") and the ⚡ it's worth at your weight. */
function unitPower(m: Move, bw: number): { unit: string; p: number } {
  if (m.kind === 'weight') return { unit: t('10 kg lifted once'), p: 1 };
  if (m.kind === 'body') return { unit: count(1, 'rep', 'reps'), p: repPower(m, { kg: 0 }, bw) };
  const minute = perUnit(m, bw)?.p ?? 0;
  if (m.kind === 'time' && m.share) return { unit: t('{n} min', { n: 1 }), p: minute };
  return { unit: t('{n} min', { n: 10 }), p: minute * 10 };
}

/**
 * The details, in a sheet over whatever opened them. `move` may be only what a plan kept of it; the database fills in the
 * rest when it has it. `action` is the button at the bottom (add it, or use it instead).
 */
export function ExerciseInfo({ move, onClose, action }: { move: Snap | null; onClose: () => void; action?: { label: string; on?: boolean; run: () => void } }) {
  const { byId } = useMoves();
  const bw = useBodyWeight();
  const wide = useMedia('(min-width: 1024px)');
  // the sheet slides away showing the exercise it had
  const held = useRef<Move | null>(null);
  if (move) held.current = byId.get(move.id) ?? { ...move, pair: false, level: 0, img: 0 };
  const m = held.current;
  const [steps, setSteps] = useState<string[] | null>(null);

  useEffect(() => {
    if (!move) return;
    // yours have no steps: no need to fetch the database's
    if (getMyMoves().some((x) => x.id === move.id)) return void setSteps([]);
    setSteps(null);
    let live = true;
    stepsOf(move.id).then((s) => live && setSteps(s), () => live && setSteps([]));
    return () => {
      live = false;
    };
  }, [move?.id]);

  const mine = !!m && getMyMoves().some((x) => x.id === m.id);
  const remove = async () => {
    const was = getMyMoves().find((x) => x.id === m?.id);
    if (!was) return;
    onClose();
    await deleteMyMove(was.id);
    toast(t('Exercise deleted'), { label: t('Undo'), run: () => saveMyMove(was) });
  };

  const heat: Partial<Record<Muscle, number>> = {};
  m?.also.forEach((x) => (heat[x] = 0.5));
  m?.muscles.forEach((x) => (heat[x] = 1));
  // the start and the end of the move, with what each is for a screen reader (a missing one drops out with its words)
  const shots = m
    ? [
      [imageOf(m, 0), t('{name}: the start of the move', { name: m.name })],
      [imageOf(m, 1), t('{name}: the end of the move', { name: m.name })],
    ].filter((x): x is [string, string] => !!x[0])
    : [];
  const unit = m ? unitPower(m, bw) : null;

  return (
    <Sheet
      open={!!move}
      onClose={onClose}
      tall
      class="wo-info-sheet"
      title={m?.name ?? ''}
      footer={action && (
        <button class={`btn wo-wide ${action.on ? 'btn-quiet' : 'btn-primary'}`} aria-pressed={action.on} onClick={action.run}>
          <Icon name={action.on ? 'check' : 'plus'} size={18} />
          {action.on ? t('Added') : action.label}
        </button>
      )}
    >
      {m && unit && (
        <div class="wo-info" key={m.id}>
          <div class="wo-info-col">
            {shots.length > 0 && <Flipbook class="wo-info-flip" frames={shots.map((x) => x[0])} alt={shots.map((x) => x[1])} />}

            <div class="wo-facts">
              <span class="wo-fact"><Icon name={KIND_ICON[m.kind]} size={16} />{KIND_NAME[m.kind]}</span>
              <span class="wo-fact"><Icon name={EQUIP_ICON[m.equip]} size={16} />{EQUIP_NAME[m.equip]}</span>
              <span class="wo-fact"><Icon name="award" size={16} />{LEVEL[m.level]}</span>
              <span class="wo-fact"><Icon name="target" size={16} />{CAT_NAME[m.cat]}</span>
            </div>

            <section class="wo-info-pw" aria-label={t('Power')}>
              <p class="wo-info-pw-sum">
                <span class="wo-info-pw-unit">{unit.unit}</span>
                <span class="wo-info-pw-eq" aria-hidden="true">=</span>
                <b class="wo-info-pw-n">
                  <Rolling value={unit.p} from={0} ms={700} />
                  <span class="wo-info-pw-bolt"><Icon name="bolt" size={20} /></span>
                </b>
              </p>
              <p class="wo-info-pw-text">{powerText(m, bw)}</p>
            </section>
          </div>

          <div class="wo-info-col">
            {m.muscles.length + m.also.length > 0 && (
              <section class="wo-info-part">
                <h3 class="section-title"><Icon name="body-scan" size={16} />{t('Muscles')}</h3>
                <div class="wo-info-body">
                  <BodyMap heat={heat} side="both" size={wide ? 220 : 180} label={t('The muscles {name} works', { name: m.name })} />
                  <ul class="wo-info-muscles">
                    {m.muscles.map((x, i) => <li key={x} class="is-main" style={{ '--k': Math.min(i, 4) }}><i />{MUSCLE_NAME[x]}</li>)}
                    {m.also.map((x, i) => <li key={x} style={{ '--k': Math.min(m.muscles.length + i, 4) }}><i />{MUSCLE_NAME[x]}</li>)}
                  </ul>
                </div>
              </section>
            )}

            <section class="wo-info-part">
              <h3 class="section-title"><Icon name="list-numbers" size={16} />{t('How to do it')}</h3>
              {steps === null ? (
                <div class="wo-ghost-lines" aria-hidden="true"><span class="ghost" /><span class="ghost" /><span class="ghost" /></div>
              ) : steps.length ? (
                <ol class="wo-info-steps">
                  {steps.map((s, i) => (
                    <li key={i} style={{ '--k': Math.min(i, 4) }}>
                      <b class="wo-info-step-n" aria-hidden="true">{i + 1}</b>
                      <span>{s}</span>
                    </li>
                  ))}
                </ol>
              ) : (
                <p class="empty-note fade-arrive-soft">{mine ? t('One you made: no steps to show.') : t('No steps for this one.')}</p>
              )}
            </section>

            {mine && (
              <button class="btn btn-quiet danger wo-wide" onClick={remove}>
                <Icon name="trash" size={18} />
                {t('Delete exercise')}
              </button>
            )}
          </div>
        </div>
      )}
    </Sheet>
  );
}
