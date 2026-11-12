// A plan: a workout you do again and again. Its name and icon, what it comes to (a ring of its power against the
// target, with a notch where last time came to, and its exercises, sets and about how long), the power it asks of you,
// and its exercises with the sets you mean to do; saved as you go. Each exercise is a line saying its sets, with a strip
// of what each set is worth; a tap opens them to change. Start stays in reach at the bottom. Opened from the Workout
// page as ?plan=<id> (a new id makes a new plan).
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { goBack } from '../../lib/router';
import { fmtPower, itemPower, MAX_SETS, planPower, ROUTINE_ICONS, suggestTarget, workoutPower, type Item, type Routine, type WSet } from '../../lib/fitness';
import { deleteRoutine, saveRoutine, toast, useRoutines, useWorkouts } from '../../lib/store';
import { count, t } from '../../lib/i18n';
import { Power } from '../fitness';
import { Icon, type UiName } from '../icons';
import { PowerGauge, PowerStrip } from '../power';
import { Sheet } from '../Sheet';
import { ExerciseInfo } from './ExerciseInfo';
import { ItemMenu } from './ItemMenu';
import { Picker } from './Picker';
import { SetRows } from './SetRows';
import { itemActions, lastPlanWorkout, lastSets, planMinutes, restText, setParts, setsLine, startWorkout, totalReps, TargetStepper, Thumb, useBodyWeight, useDraft } from './shared';
import '../../styles/workout-home.css';

const blank = (id: string): Routine => ({ id, name: '', icon: 'barbell', target: 0, items: [], created: Date.now(), updated: Date.now() });

export function PlanEditor({ id }: { id: string }) {
  const plans = useRoutines();
  const workouts = useWorkouts();
  const bw = useBodyWeight();
  const stored = plans.find((r) => r.id === id);
  // a new plan isn't kept until it has a name or an exercise
  const { draft: r, update, flush, drop } = useDraft<Routine>(stored ?? blank(id), saveRoutine, (x) => !!(x.name.trim() || x.items.length || plans.some((p) => p.id === x.id)));
  const [open, setOpen] = useState<number | null>(null);
  const [menu, setMenu] = useState<number | null>(null);
  // adding exercises, or swapping the one at an index for another
  const [picking, setPicking] = useState<{ swap: number | null } | null>(null);
  const [info, setInfo] = useState<Item | null>(null);
  const [aiming, setAiming] = useState(false);
  // the icons to choose from, shown when the plan's own icon is tapped
  const [icons, setIcons] = useState(false);

  const ghosts = useMemo(() => lastSets(workouts), [workouts]);
  const last = useMemo(() => lastPlanWorkout(workouts, id), [workouts, id]);
  const full = planPower(r, bw);
  const lastP = last ? workoutPower(last) : 0;
  const suggested = suggestTarget(r, bw, lastP || undefined);
  const sets = r.items.reduce((n, it) => n + it.sets.length, 0);

  const act = itemActions<Routine>(r.items, update, ghosts, false);
  const move = (i: number, by: -1 | 1) => {
    const j = i + by;
    if (j < 0 || j >= r.items.length) return;
    act.swap(i, j);
    // what's open follows the exercise it was open on
    setOpen((o) => (o === i ? j : o === j ? i : o));
    setMenu((m) => (m === i ? j : m));
  };
  const remove = (i: number) => {
    setOpen(null);
    act.remove(i);
  };

  const back = () => goBack('workout');
  const del = async () => {
    drop();
    back();
    if (!stored) return;
    await deleteRoutine(id);
    toast(t('Deleted {name}', { name: r.name.trim() || t('New workout') }), { label: t('Undo'), run: () => saveRoutine(r) });
  };
  const name = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!stored) name.current?.focus();
  }, []);

  const start = async () => {
    flush();
    if (await startWorkout(r, bw)) back();
  };

  // under the exercises on a phone (staying in reach as you scroll), under the summary in the side panel on a wide screen
  const startBtn = (
    <button class="btn btn-primary wo-wide wo-start pw-sheen" onClick={start} disabled={!r.items.length}>
      <Icon name="player-play" size={18} />
      {t('Start this workout')}
    </button>
  );

  return (
    <div class="page wo-page wo-plan-page fade-arrive-soft">
      <div class="editor-bar">
        <button class="glass glass-btn round" onClick={back} aria-label={t('Back')} title={t('Back')}><Icon name="arrow-left" /></button>
        <span class="grow" />
        <button class="glass glass-btn round" onClick={del} aria-label={t('Delete workout')} title={t('Delete workout')}><Icon name="trash" /></button>
        <button class="glass glass-btn tinted" onClick={back}>{t('Done')}</button>
      </div>

      <div class="editor-top">
        <button class="wo-tile big wo-icon-pick" onClick={() => setIcons(!icons)} aria-expanded={icons} aria-label={t('Change the icon')} title={t('Change the icon')}>
          <Icon name={r.icon as UiName} size={24} />
        </button>
        <input
          ref={name}
          class="title-input"
          value={r.name}
          maxLength={120}
          placeholder={t('Name it: Push, Legs…')}
          aria-label={t('Name')}
          enterkeyhint="done"
          onInput={(e) => {
            const name = e.currentTarget.value;
            update((x) => ({ ...x, name }));
          }}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        />
      </div>
      {icons && (
        <div class="chips wo-icons fade-arrive-soft" role="group" aria-label={t('Icon')}>
          {ROUTINE_ICONS.map((name) => (
            <button
              key={name}
              class="icon-btn small"
              aria-pressed={r.icon === name}
              onClick={() => {
                update((x) => ({ ...x, icon: name }));
                setIcons(false);
              }}
              aria-label={t('Icon: {name}', { name })}
              title={name}
            >
              <Icon name={name} size={16} />
            </button>
          ))}
        </div>
      )}

      <div class="wo-plan-body">
        <aside class="wo-side">
          <div class="card wo-plan-sum">
            {/* the ring: what every set adds up to against the target (or, with none, against last time), a notch where last time came to */}
            <div class="wo-plan-hero">
              <PowerGauge
                size="m"
                class="wo-plan-gauge"
                value={full}
                target={r.target}
                scale={Math.max(full, lastP)}
                ghost={lastP || undefined}
                label={`${t('What every set adds up to')}: ${fmtPower(full)} ⚡${r.target > 0 ? `. ${t('Target: {p} ⚡', { p: fmtPower(r.target) })}` : ''}${last ? `. ${t('Last time: {p} ⚡', { p: fmtPower(lastP) })}` : ''}`}
              >
                <b class="wo-plan-mid"><Icon name="bolt" size={14} />{fmtPower(full)}</b>
                <small class="wo-plan-mid-label">{r.target > 0 ? t('of {p}', { p: fmtPower(r.target) }) : t('planned')}</small>
              </PowerGauge>
              <div class="wo-plan-facts">
                <span class="wo-plan-fact" title={count(r.items.length, 'exercise', 'exercises')}><Icon name="list-details" size={16} /><b>{r.items.length}</b>{t('exercises')}</span>
                <span class="wo-plan-fact" title={count(sets, 'set', 'sets')}><Icon name="list-numbers" size={16} /><b>{sets}</b>{t('sets')}</span>
                <span class="wo-plan-fact" title={last ? t('As long as it took last time') : t('About how long it takes')}><Icon name="stopwatch" size={16} /><b>{planMinutes(r, last) || '–'}</b>{t('min')}</span>
              </div>
            </div>
            <button class="wo-target-row" onClick={() => setAiming(true)} aria-label={t('Target power')}>
              <span class="wo-tile small"><Icon name="target" size={16} /></span>
              <span class="wo-target-row-text">
                <span class="wo-target-row-label">{t('Target power')}</span>
                <span class="muted small">
                  {!r.target ? t('Set the power this workout asks for') : full < r.target ? t('Every set adds up to {p} ⚡: a little short.', { p: fmtPower(full) }) : t('Only the sets you tick off count.')}
                </span>
              </span>
              {r.target > 0 ? <Power value={r.target} size={16} class="wo-target-row-n" /> : <span class="wo-target-row-n muted">{t('None')}</span>}
              <Icon name="chevron-right" size={16} />
            </button>
          </div>
          <div class="wo-side-end">{startBtn}</div>
        </aside>

        <section class="section wo-plan-items">
          <h2 class="section-title">
            <Icon name="list-details" size={16} />
            {t('Exercises')}
            {r.items.length > 0 && <span class="wo-count">{r.items.length}</span>}
          </h2>
          {r.items.length ? (
            <div class="wo-plan-list">
              {r.items.map((it, i) => (
                <PlanItem
                  key={i}
                  it={it}
                  bw={bw}
                  ghosts={ghosts.get(it.move.id)}
                  open={open === i}
                  first={i === 0}
                  last={i === r.items.length - 1}
                  onOpen={() => setOpen(open === i ? null : i)}
                  onInfo={() => setInfo(it)}
                  onMenu={() => setMenu(i)}
                  onSets={(next) => act.setItem(i, { ...it, sets: next })}
                  onRemoveSet={(k) => act.removeSet(i, k)}
                  onAddSet={() => act.addSet(i)}
                  onMove={(by) => move(i, by)}
                  onRemove={() => remove(i)}
                />
              ))}
            </div>
          ) : (
            <div class="wo-plan-empty">
              <span class="wo-tile big" aria-hidden="true"><Icon name="list-details" size={24} /></span>
              <p class="muted">{t('No exercises yet. Add the ones this workout is made of.')}</p>
            </div>
          )}
          <button class={r.items.length ? 'wo-add-btn' : 'btn btn-primary wo-wide'} onClick={() => setPicking({ swap: null })}>
            <Icon name="circle-plus" size={18} />
            {t('Add exercises')}
          </button>
        </section>
      </div>

      {r.items.length > 0 && <div class="wo-plan-end">{startBtn}</div>}

      <Picker open={!!picking} single={picking?.swap != null} onClose={() => setPicking(null)} onPick={(moves) => act.add(moves, picking?.swap ?? null)} />
      <ItemMenu
        item={menu !== null ? r.items[menu] ?? null : null}
        first={menu === 0}
        last={menu === r.items.length - 1}
        onClose={() => setMenu(null)}
        onChange={(it) => menu !== null && act.setItem(menu, it)}
        onReplace={() => setPicking({ swap: menu })}
        onInfo={() => menu !== null && setInfo(r.items[menu])}
        onMove={(by) => menu !== null && move(menu, by)}
        onRemove={() => menu !== null && remove(menu)}
      />
      <ExerciseInfo move={info?.move ?? null} onClose={() => setInfo(null)} />
      <Sheet
        open={aiming}
        onClose={() => setAiming(false)}
        title={t('Target power')}
        footer={<button class="btn btn-primary wo-wide" onClick={() => setAiming(false)}>{t('Done')}</button>}
      >
        <TargetStepper value={r.target} onValue={(target) => update((x) => ({ ...x, target }))} suggested={suggested} full={full} />
        <p class="muted small wo-sheet-note">{t('Only the sets you tick off count. Body moves count at your weight on the day.')}</p>
      </Sheet>
    </div>
  );
}

/**
 * An exercise in a plan: its picture and name (a tap shows how it's done), its sets in a line with their power and a
 * strip of what each set is worth, and the line's tap opens them to change (last time's numbers marked on them), with
 * ways to add a set, move it and take it out.
 */
function PlanItem({ it, bw, ghosts, open, first, last, onOpen, onInfo, onMenu, onSets, onRemoveSet, onAddSet, onMove, onRemove }: {
  it: Item;
  bw: number;
  ghosts?: WSet[];
  open: boolean;
  first: boolean;
  last: boolean;
  onOpen: () => void;
  onInfo: () => void;
  onMenu: () => void;
  onSets: (sets: Item['sets']) => void;
  onRemoveSet: (k: number) => void;
  onAddSet: () => void;
  onMove: (by: -1 | 1) => void;
  onRemove: () => void;
}) {
  const about = t('About {name}', { name: it.move.name });
  const reps = totalReps(it);
  // a plan's sets are all still to do: each segment is shown whole, as wide as what the set is worth
  const parts = setParts(it, bw).map((x) => ({ ...x, fill: 1 }));
  return (
    <article class={`card wo-item${open ? ' is-open' : ''}`}>
      <div class="wo-item-head">
        <button class="wo-thumb-btn" onClick={onInfo} aria-label={about} title={about}>
          <Thumb move={it.move} />
        </button>
        <div class="wo-item-title">
          <button class="wo-item-name" onClick={onInfo} title={about}>{it.move.name}</button>
          <button class="wo-item-sets" onClick={onOpen} aria-expanded={open} title={t('Change the sets')} aria-label={t('Change the sets')}>
            {setsLine(it).map((s) => <span key={s} class="wo-set-chip">{s}</span>)}
            {reps ? <span class="wo-reps-total">= {count(reps, 'rep', 'reps')}</span> : null}
            <Power value={itemPower(it, bw, true)} size={12} />
            <Icon name="chevron-down" size={14} />
          </button>
          {parts.length > 0 && <PowerStrip class="is-mini wo-plan-strip" parts={parts} />}
        </div>
        <button class="icon-btn small" onClick={onMenu} aria-label={t('Options for {name}', { name: it.move.name })} title={t('More')}>
          <Icon name="dots" size={16} />
        </button>
      </div>
      {open && (
        <div class="wo-item-body fade-arrive-soft">
          {it.note && <p class="wo-note"><Icon name="pencil" size={12} />{it.note}</p>}
          <SetRows item={it} bw={bw} ghosts={ghosts} onSets={onSets} onRemove={onRemoveSet} />
          <div class="wo-item-foot">
            <button class="wo-add-set" onClick={onAddSet} disabled={it.sets.length >= MAX_SETS}>
              <Icon name="plus" size={16} />
              {t('Add set')}
            </button>
            <span class="wo-item-tools">
              <button class="wo-meta-text wo-rest-chip" onClick={onMenu} title={t('Rest between sets')}><Icon name="alarm" size={12} />{restText(it.rest)}</button>
              <button class="icon-btn small" onClick={() => onMove(-1)} disabled={first} aria-label={t('Move up')} title={t('Move up')}><Icon name="arrow-up" size={16} /></button>
              <button class="icon-btn small" onClick={() => onMove(1)} disabled={last} aria-label={t('Move down')} title={t('Move down')}><Icon name="arrow-down" size={16} /></button>
              <button class="icon-btn small" onClick={onRemove} aria-label={t('Remove {name}', { name: it.move.name })} title={t('Remove')}><Icon name="trash" size={16} /></button>
            </span>
          </div>
        </div>
      )}
    </article>
  );
}
