// A plan: a workout you do again and again. Its name and icon, the power it asks of you, and its exercises with the sets
// you mean to do; saved as you go. Opened from the Workout page as ?plan=<id> (a new id makes a new plan).
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { goBack } from '../../lib/router';
import { itemPower, planPower, ROUTINE_ICONS, suggestTarget, workoutPower, type Item, type Routine } from '../../lib/fitness';
import { deleteRoutine, saveRoutine, toast, useRoutines, useWorkouts } from '../../lib/store';
import { count, t } from '../../lib/i18n';
import { Power } from '../fitness';
import { Icon, type UiName } from '../icons';
import { ExerciseInfo } from './ExerciseInfo';
import { ItemMenu } from './ItemMenu';
import { Picker } from './Picker';
import { SetRows } from './SetRows';
import { itemActions, lastPlanWorkout, lastSets, setsLine, startWorkout, TargetStepper, Thumb, useBodyWeight, useDraft } from './shared';

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
  // the icons to choose from, shown when the plan's own icon is tapped
  const [icons, setIcons] = useState(false);

  const ghosts = useMemo(() => lastSets(workouts), [workouts]);
  const last = useMemo(() => lastPlanWorkout(workouts, id), [workouts, id]);
  const full = planPower(r, bw);
  const suggested = suggestTarget(r, bw, last && workoutPower(last));

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

  // under the exercises on a phone, under the target in the side panel on a wide screen
  const startBtn = (
    <button class="btn btn-primary wo-wide wo-start" onClick={start} disabled={!r.items.length}>
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
      <section class="section wo-side-target">
        <h2 class="section-title"><Icon name="target" size={16} />{t('Target power')}</h2>
        <div class="card wo-card">
          <TargetStepper value={r.target} onValue={(target) => update((x) => ({ ...x, target }))} suggested={suggested} full={full} />
          {r.target > 0 && (
            <div class="meter wo-meter" aria-hidden="true">
              <i style={{ width: `${Math.min(100, (full / r.target) * 100)}%` }} />
            </div>
          )}
          <p class="muted small">
            {r.target > 0 && full < r.target ? t('Every set adds up to {p} ⚡: a little short of the target.', { p: Math.round(full) }) : t('Only the sets you tick off count. Body moves count at your weight on the day.')}
          </p>
        </div>
      </section>

      <div class="wo-side-end">{startBtn}</div>
      </aside>

      <section class="section wo-plan-items">
        <h2 class="section-title">
          <Icon name="list-details" size={16} />
          {t('Exercises')}
          {r.items.length > 0 && <span class="wo-count">{r.items.length}</span>}
        </h2>
        {r.items.length ? (
          <div class="stack-l wo-plan-list">
            {r.items.map((it, i) => (
              <article key={i} class="card wo-item">
                <div class="wo-item-head">
                  <button class="wo-thumb-btn" onClick={() => setInfo(it)} aria-label={t('About {name}', { name: it.move.name })} title={t('About {name}', { name: it.move.name })}>
                    <Thumb move={it.move} />
                  </button>
                  <div class="wo-item-title">
                    <button class="wo-item-name" onClick={() => setInfo(it)} title={t('About {name}', { name: it.move.name })}>{it.move.name}</button>
                    <button class="wo-item-sets" onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i} title={t('Change the sets')} aria-label={t('Change the sets')}>
                      {setsLine(it).map((s) => <span key={s} class="wo-set-chip">{s}</span>)}
                      <Icon name="chevron-down" size={14} />
                    </button>
                  </div>
                  <Power value={itemPower(it, bw, true)} />
                </div>
                <div class="wo-tools">
                  <button class="icon-btn small" onClick={() => act.removeSet(i, it.sets.length - 1)} disabled={it.sets.length <= 1} aria-label={t('One set less')} title={t('One set less')}><Icon name="minus" size={16} /></button>
                  <span class="wo-tools-n" title={count(it.sets.length, 'set', 'sets')}>{it.sets.length}</span>
                  <button class="icon-btn small" onClick={() => act.addSet(i)} aria-label={t('One set more')} title={t('One set more')}><Icon name="plus" size={16} /></button>
                  <span class="grow" />
                  <button class="icon-btn small" onClick={() => move(i, -1)} disabled={i === 0} aria-label={t('Move up')} title={t('Move up')}><Icon name="arrow-up" size={16} /></button>
                  <button class="icon-btn small" onClick={() => move(i, 1)} disabled={i === r.items.length - 1} aria-label={t('Move down')} title={t('Move down')}><Icon name="arrow-down" size={16} /></button>
                  <button class="icon-btn small" onClick={() => setMenu(i)} aria-label={t('More')} title={t('More')}><Icon name="dots" size={16} /></button>
                  <button class="icon-btn small" onClick={() => remove(i)} aria-label={t('Remove {name}', { name: it.move.name })} title={t('Remove')}><Icon name="x" size={16} /></button>
                </div>
                {open === i && (
                  <div class="wo-item-sets-edit fade-arrive-soft">
                    <SetRows item={it} bw={bw} onSets={(sets) => act.setItem(i, { ...it, sets })} onRemove={(k) => act.removeSet(i, k)} />
                  </div>
                )}
              </article>
            ))}
          </div>
        ) : (
          <p class="empty-note">{t('No exercises yet. Add the ones this workout is made of.')}</p>
        )}
        <button class="btn btn-quiet wo-wide wo-add" onClick={() => setPicking({ swap: null })}>
          <Icon name="circle-plus" size={18} />
          {t('Add exercises')}
        </button>
      </section>

      </div>

      <div class="wo-plan-end">{startBtn}</div>

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
    </div>
  );
}
