// An exercise up close: how the move starts and ends, the muscles it works on the body, how to do it step by step, and
// how its power is counted at your weight. One you made can be deleted here.
import { useEffect, useRef, useState } from 'preact/hooks';
import { imageOf, stepsOf } from '../../lib/exercises';
import { fmtPower, repPower, type Move, type Muscle, type Snap } from '../../lib/fitness';
import { deleteMyMove, getMyMoves, saveMyMove, toast } from '../../lib/store';
import { t } from '../../lib/i18n';
import { BodyMap } from '../BodyMap';
import { CAT_NAME, EQUIP_ICON, EQUIP_NAME, KIND_ICON, KIND_NAME, MUSCLE_NAME } from '../fitness';
import { Icon } from '../icons';
import { Sheet } from '../Sheet';
import { num, perUnit, useBodyWeight, useMoves } from './shared';

const LEVEL = [t('Beginner'), t('Intermediate'), t('Expert')];

/** How an exercise's power is counted, in a sentence, with what it comes to at your weight. */
function powerText(m: Move, bw: number) {
  const kg = num(bw);
  const pct = Math.round(m.share * 100);
  if (m.kind === 'weight') return m.pair
    ? t('It counts the weight you lift: 10 kg lifted once is 1 ⚡, for anyone. One in each hand, both count.')
    : t('It counts the weight you lift: 10 kg lifted once is 1 ⚡, for anyone.');
  if (m.kind === 'body') return t('It lifts about {pct}% of your body: at {kg} kg, one rep is {p} ⚡.', { pct, kg, p: fmtPower(repPower(m, { kg: 0 }, bw)) });
  const minute = perUnit(m, bw)?.p ?? 0;
  if (m.kind === 'time' && m.share) return t('A hold: every 3 seconds counts as a rep lifting {pct}% of your body, so a minute is {p} ⚡ at {kg} kg.', { pct, kg, p: fmtPower(minute) });
  const effort = t('It counts effort over time ({met} METs): ten minutes is {p} ⚡ at {kg} kg.', { met: num(m.met), kg, p: fmtPower(minute * 10) });
  return m.foot ? `${effort} ${t('With a distance, your pace sets the effort.')}` : effort;
}

/**
 * The details, in a sheet over whatever opened them. `move` may be only what a plan kept of it; the database fills in the
 * rest when it has it. `action` is the button at the bottom (add it, or use it instead).
 */
export function ExerciseInfo({ move, onClose, action }: { move: Snap | null; onClose: () => void; action?: { label: string; on?: boolean; run: () => void } }) {
  const { byId } = useMoves();
  const bw = useBodyWeight();
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
  const shots = m ? [imageOf(m, 0), imageOf(m, 1)].filter((s): s is string => !!s) : [];

  return (
    <Sheet
      open={!!move}
      onClose={onClose}
      tall
      title={m?.name ?? ''}
      footer={action && (
        <button class={`btn wo-wide ${action.on ? 'btn-quiet' : 'btn-primary'}`} aria-pressed={action.on} onClick={action.run}>
          <Icon name={action.on ? 'check' : 'plus'} size={18} />
          {action.on ? t('Added') : action.label}
        </button>
      )}
    >
      {m && (
        <div class="wo-info">
          {shots.length > 0 && (
            <div class="wo-shots">
              {shots.map((src, i) => (
                <figure key={src} class="wo-shot">
                  <img src={src} alt={i ? t('{name}: the end of the move', { name: m.name }) : t('{name}: the start of the move', { name: m.name })} loading="lazy" decoding="async" width={300} height={200} />
                </figure>
              ))}
            </div>
          )}

          <div class="wo-facts">
            <span class="wo-fact"><Icon name={KIND_ICON[m.kind]} size={16} />{KIND_NAME[m.kind]}</span>
            <span class="wo-fact"><Icon name={EQUIP_ICON[m.equip]} size={16} />{EQUIP_NAME[m.equip]}</span>
            <span class="wo-fact"><Icon name="award" size={16} />{LEVEL[m.level]}</span>
            <span class="wo-fact"><Icon name="target" size={16} />{CAT_NAME[m.cat]}</span>
          </div>

          <p class="wo-info-power">
            <span class="wo-tile small"><Icon name="bolt" size={16} /></span>
            <span>{powerText(m, bw)}</span>
          </p>

          {m.muscles.length + m.also.length > 0 && (
            <section class="wo-info-part">
              <h3 class="section-title"><Icon name="body-scan" size={16} />{t('Muscles')}</h3>
              <div class="wo-body">
                <BodyMap heat={heat} side="both" size={180} label={t('The muscles {name} works', { name: m.name })} />
                <ul class="wo-muscles">
                  {m.muscles.map((x) => <li key={x} class="is-main"><i />{MUSCLE_NAME[x]}</li>)}
                  {m.also.map((x) => <li key={x}><i />{MUSCLE_NAME[x]}</li>)}
                </ul>
              </div>
            </section>
          )}

          <section class="wo-info-part">
            <h3 class="section-title"><Icon name="list-numbers" size={16} />{t('How to do it')}</h3>
            {steps === null ? (
              <div class="wo-ghost-lines" aria-hidden="true"><span class="ghost" /><span class="ghost" /><span class="ghost" /></div>
            ) : steps.length ? (
              <ol class="wo-steps fade-arrive-soft">{steps.map((s, i) => <li key={i}>{s}</li>)}</ol>
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
      )}
    </Sheet>
  );
}
