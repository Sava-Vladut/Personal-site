// Finding exercises to add: search by name, muscle or equipment, narrow by the muscle it works and what it's done with,
// and pick as many as you like. The ones you do most come first, and each says what it's worth at your weight.
import { useEffect, useMemo, useState } from 'preact/hooks';
import { MUSCLE_ORDER, searchExercises } from '../../lib/exercises';
import { EQUIPS, type Equip, type Move, type Muscle } from '../../lib/fitness';
import { count, t } from '../../lib/i18n';
import { MuscleIcon } from '../BodyMap';
import { EQUIP_ICON, EQUIP_NAME, KIND_ICON, MUSCLE_NAME } from '../fitness';
import { Icon } from '../icons';
import { Sheet } from '../Sheet';
import { CreateMove } from './CreateMove';
import { ExerciseInfo } from './ExerciseInfo';
import { PerUnit, Thumb, useBodyWeight, useMoves, useUsedCounts } from './shared';

/** Rows shown at once: the database has about 900, and a phone shouldn't lay them all out. */
const PAGE = 60;
/** How many of the ones you do most come first. */
const MOST = 8;

/**
 * The picker, a tall sheet. `single` picks one with a tap (swapping an exercise for another); otherwise each tap ticks one
 * and the button at the bottom adds them all.
 */
export function Picker({ open, onClose, onPick, single }: { open: boolean; onClose: () => void; onPick: (moves: Move[]) => void; single?: boolean }) {
  const { list, ready } = useMoves();
  const used = useUsedCounts();
  const bw = useBodyWeight();
  const [q, setQ] = useState('');
  const [muscle, setMuscle] = useState<Muscle | null>(null);
  const [equip, setEquip] = useState<Equip | null>(null);
  const [picked, setPicked] = useState<Move[]>([]);
  const [limit, setLimit] = useState(PAGE);
  const [info, setInfo] = useState<Move | null>(null);
  const [making, setMaking] = useState(false);

  useEffect(() => {
    if (!open) return;
    setQ('');
    setMuscle(null);
    setEquip(null);
    setPicked([]);
  }, [open]);
  useEffect(() => setLimit(PAGE), [q, muscle, equip, open]);

  const narrowed = !!(q.trim() || muscle || equip);
  const found = useMemo(() => searchExercises(list, { q, muscle, equip }, used), [list, q, muscle, equip, used]);
  // with nothing typed or picked, the list is in order of use already: the first few you've done head it
  const most = useMemo(() => (narrowed ? [] : found.slice(0, MOST).filter((m) => used.has(m.id))), [found, narrowed, used]);
  const rest = most.length ? found.slice(most.length) : found;

  const isOn = (m: Move) => picked.some((x) => x.id === m.id);
  const toggle = (m: Move) => {
    if (single) {
      onPick([m]);
      onClose();
      return;
    }
    setPicked((p) => (p.some((x) => x.id === m.id) ? p.filter((x) => x.id !== m.id) : [...p, m]));
  };
  const clear = () => {
    setQ('');
    setMuscle(null);
    setEquip(null);
  };

  const row = (m: Move) => {
    const on = !single && isOn(m);
    return (
      <div key={m.id} class="wo-pick-row">
        <button class="wo-pick-main" aria-pressed={single ? undefined : on} onClick={() => toggle(m)}>
          <Thumb move={m} on={on} />
          <span class="wo-pick-text">
            <span class="wo-pick-name">{m.name}</span>
            <span class="wo-meta">
              <Icon name={m.kind === 'weight' || m.kind === 'body' ? EQUIP_ICON[m.equip] : KIND_ICON[m.kind]} size={14} />
              {m.muscles[0] && <><MuscleIcon muscle={m.muscles[0]} size={14} /><span class="wo-meta-text">{MUSCLE_NAME[m.muscles[0]]}</span></>}
              {m.kind === 'weight' ? <span class="wo-per">{t('kg × reps')}</span> : <PerUnit move={m} bw={bw} />}
            </span>
          </span>
        </button>
        <button class="icon-btn small" onClick={() => setInfo(m)} aria-label={t('About {name}', { name: m.name })} title={t('How to do it')}>
          <Icon name="info-circle" size={16} />
        </button>
      </div>
    );
  };

  return (
    <>
      <Sheet
        open={open}
        onClose={onClose}
        tall
        title={single ? t('Replace with') : t('Add exercises')}
        footer={!single && picked.length > 0 && (
          <button class="btn btn-primary wo-wide" onClick={() => (onPick(picked), onClose())}>
            <Icon name="plus" size={18} />
            {t('Add {n}', { n: count(picked.length, 'exercise', 'exercises') })}
          </button>
        )}
      >
        <div class="wo-pick">
          <label class="search">
            <Icon name="search" size={18} />
            <input type="search" value={q} enterkeyhint="search" placeholder={t('Search exercises')} aria-label={t('Search exercises')} onInput={(e) => setQ(e.currentTarget.value)} />
          </label>
          <div class="chips scroll-x wo-chips" role="group" aria-label={t('Muscle')}>
            {MUSCLE_ORDER.map((m) => (
              <button key={m} class="chip" aria-pressed={muscle === m} onClick={() => setMuscle(muscle === m ? null : m)}>
                <MuscleIcon muscle={m} size={16} />
                {MUSCLE_NAME[m]}
              </button>
            ))}
          </div>
          <div class="chips scroll-x wo-chips" role="group" aria-label={t('Equipment')}>
            {EQUIPS.map((e) => (
              <button key={e} class="chip" aria-pressed={equip === e} onClick={() => setEquip(equip === e ? null : e)}>
                <Icon name={EQUIP_ICON[e]} size={16} />
                {EQUIP_NAME[e]}
              </button>
            ))}
          </div>

          {!ready ? (
            <GhostRows />
          ) : (
            <div class="wo-pick-found fade-arrive-soft">
              {most.length > 0 && (
                <section class="wo-pick-part">
                  <h3 class="wo-label"><Icon name="history" size={14} />{t('You do these most')}</h3>
                  <div class="wo-pick-list">{most.map(row)}</div>
                </section>
              )}
              {rest.length > 0 ? (
                <section class="wo-pick-part">
                  <h3 class="wo-label">
                    <Icon name={narrowed ? 'filter' : 'list-details'} size={14} />
                    {narrowed ? count(found.length, 'exercise', 'exercises') : t('All exercises')}
                  </h3>
                  <div class="wo-pick-list">{rest.slice(0, limit).map(row)}</div>
                  {rest.length > limit && (
                    <button class="btn btn-quiet wo-wide" onClick={() => setLimit(limit + PAGE)}>
                      <Icon name="chevron-down" size={18} />
                      {t('Show more')}
                    </button>
                  )}
                </section>
              ) : (
                <div class="empty-note">
                  <p>{t('No exercise matches that.')}</p>
                  <button class="btn btn-quiet" onClick={clear}><Icon name="x" size={18} />{t('Clear filters')}</button>
                </div>
              )}
              <button class="btn btn-quiet wo-wide wo-make-btn" onClick={() => setMaking(true)}>
                <Icon name="circle-plus" size={18} />
                {q.trim() ? t('Create “{name}”', { name: q.trim() }) : t('Create exercise')}
              </button>
            </div>
          )}
        </div>
      </Sheet>
      <ExerciseInfo
        move={info}
        onClose={() => setInfo(null)}
        action={info ? { label: single ? t('Use this one') : t('Add'), on: !single && isOn(info), run: () => (toggle(info), setInfo(null)) } : undefined}
      />
      <CreateMove open={making} name={q.trim()} onClose={() => setMaking(false)} onMade={(m) => (single ? toggle(m) : setPicked((p) => [...p, m]))} />
    </>
  );
}

/** Rows still on their way: quiet shapes where they'll be. */
const GhostRows = () => (
  <div class="wo-pick-list" aria-hidden="true">
    {Array.from({ length: 6 }, (_, i) => (
      <span key={i} class="wo-ghost-row">
        <span class="ghost wo-ghost-thumb" />
        <span class="wo-ghost-lines"><span class="ghost" /><span class="ghost" /></span>
      </span>
    ))}
  </div>
);
