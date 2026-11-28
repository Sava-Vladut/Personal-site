// Finding exercises to add: search by name, muscle or equipment (lib/exercises.ts ranks what you've done and the common
// ones first), narrow by the muscle it works (a dropdown) and what it's done with (chips: any of them, or none for all,
// remembered for next time), and pick as many as you like. Before anything's typed it shows the ones you do most, the
// popular ones or all of them, and each says what it's worth at your weight.
import type { ComponentChildren } from 'preact';
import { useEffect, useMemo, useState } from 'preact/hooks';
import { popularOf, searchExercises } from '../../lib/exercises';
import { usePref } from '../../lib/prefs';
import { EQUIPS, type Equip, type Move, type Muscle } from '../../lib/fitness';
import { count, t } from '../../lib/i18n';
import { MuscleIcon } from '../BodyMap';
import { EQUIP_ICON, EQUIP_NAME, KIND_ICON, MUSCLE_NAME } from '../fitness';
import { Icon } from '../icons';
import { Sheet } from '../Sheet';
import { CreateMove } from './CreateMove';
import { ExerciseInfo } from './ExerciseInfo';
import { Select, type Choice } from '../Select';
import { PerUnit, Thumb, useBodyWeight, useMoves, useUsedCounts } from './shared';

/** Rows shown at once: the database has about 900, and a phone shouldn't lay them all out. */
const PAGE = 60;
/** How many of the ones you do most are shown. */
const MOST = 12;
/** The equipment chips, the most common first. */
const EQUIP_ORDER: Equip[] = ['body', 'dumbbell', 'barbell', 'machine', 'cable', 'kettlebell', 'bands', 'ezbar', 'medball', 'ball', 'foam', 'other'];
/** The muscles in the muscle dropdown, by part of the body. */
const MUSCLE_GROUPS: [string, Muscle[]][] = [
  [t('Upper body'), ['chest', 'shoulders', 'biceps', 'triceps', 'forearms', 'lats', 'middle back', 'traps', 'neck']],
  [t('Core'), ['abdominals', 'lower back']],
  [t('Lower body'), ['quadriceps', 'hamstrings', 'glutes', 'calves', 'abductors', 'adductors']],
];
type Tab = 'yours' | 'popular' | 'all';

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
  // the equipment picked, kept as "body,dumbbell" (none: all of it)
  const [equipPref, setEquipPref] = usePref<string>('wo-pick-equip', '');
  const equip = useMemo(() => equipPref.split(',').filter((e): e is Equip => EQUIPS.includes(e as Equip)), [equipPref]);
  const setEquip = (list: Equip[]) => setEquipPref(EQUIP_ORDER.filter((e) => list.includes(e)).join(','));
  const toggleEquip = (e: Equip) => setEquip(equip.includes(e) ? equip.filter((x) => x !== e) : [...equip, e]);
  const [picked, setPicked] = useState<Move[]>([]);
  const [limit, setLimit] = useState(PAGE);
  const [info, setInfo] = useState<Move | null>(null);
  const [tab, setTab] = useState<Tab>('popular');
  const [making, setMaking] = useState(false);

  useEffect(() => {
    if (!open) return;
    setQ('');
    setMuscle(null);
    setPicked([]);
    setTab(used.size ? 'yours' : 'popular');
  }, [open]);
  useEffect(() => setLimit(PAGE), [q, muscle, equipPref, open, tab]);

  const narrowed = !!(q.trim() || muscle || equip.length);
  const found = useMemo(() => searchExercises(list, { q, muscle, equip }, used), [list, q, muscle, equip, used]);
  // with nothing typed or picked, the list is in order of use already: the ones you've done head it
  const yours = useMemo(() => found.filter((m) => used.has(m.id)).slice(0, MOST), [found, used]);
  const popular = useMemo(() => popularOf(list), [list]);
  const shown = narrowed ? found : tab === 'yours' ? yours : tab === 'popular' ? popular : found;

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
    setEquip([]);
  };
  const tabs: [Tab, string][] = [...(used.size ? [['yours', t('Yours')] as [Tab, string]] : []), ['popular', t('Popular')], ['all', t('All')]];

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
          <div class="wo-pick-filters" role="group" aria-label={t('Filters')}>
            <Dropdown
              label={t('Muscle')}
              value={muscle ?? ''}
              onChange={(v) => setMuscle((v || null) as Muscle | null)}
              icon={muscle ? <MuscleIcon muscle={muscle} size={16} /> : <Icon name="body-scan" size={16} />}
              text={muscle ? MUSCLE_NAME[muscle] : t('Muscle')}
              options={[
                { value: '', label: t('Any muscle') },
                ...MUSCLE_GROUPS.flatMap(([group, ms]) => ms.map((m) => ({ value: m as string, label: MUSCLE_NAME[m], group }))),
              ]}
            />
            {(muscle || equip.length > 0) && (
              <button class="icon-btn small" onClick={() => (setMuscle(null), setEquip([]))} aria-label={t('Clear filters')} title={t('Clear filters')}>
                <Icon name="x" size={16} />
              </button>
            )}
          </div>
          {/* what you have to hand: any of them (tap more than one), or none for everything */}
          <div class="chips scroll-x wo-pick-equip" role="group" aria-label={t('Equipment')}>
            <button class="chip" aria-pressed={!equip.length} onClick={() => setEquip([])}>{t('All equipment')}</button>
            {EQUIP_ORDER.map((e) => (
              <button key={e} class="chip" aria-pressed={equip.includes(e)} onClick={() => toggleEquip(e)}>
                <Icon name={EQUIP_ICON[e]} size={16} />
                {EQUIP_NAME[e]}
              </button>
            ))}
          </div>
          {!narrowed && (
            <div class="seg wo-pick-tabs" role="tablist" aria-label={t('Exercises')}>
              {tabs.map(([k, label]) => (
                <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}>{label}</button>
              ))}
            </div>
          )}

          {!ready ? (
            <GhostRows />
          ) : (
            <div class="wo-pick-found fade-arrive-soft" key={narrowed ? 'found' : tab}>
              {shown.length > 0 ? (
                <section class="wo-pick-part">
                  {narrowed && (
                    <h3 class="wo-label"><Icon name="filter" size={14} />{count(found.length, 'exercise', 'exercises')}</h3>
                  )}
                  <div class="wo-pick-list">{shown.slice(0, limit).map(row)}</div>
                  {shown.length > limit && (
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

/** A filter as a chip that opens the site's dropdown; dark once it's set. */
function Dropdown({ label, value, onChange, icon, text, options }: {
  label: string; value: string; onChange: (v: string) => void; icon: ComponentChildren; text: string; options: Choice[];
}) {
  return (
    <Select class={`chip wo-drop${value ? ' is-set' : ''}`} label={label} title={label} value={value} onChange={onChange} options={options}>
      {icon}
      <span class="wo-drop-text">{text}</span>
      <Icon name="chevron-down" size={14} />
    </Select>
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
