import { useMemo, useState } from 'preact/hooks';
import { MUSCLES, type Muscle } from '../../lib/fitness';
import { groupLoad, muscleHeat, muscleLoad, movesFor, rested, type Done } from '../../lib/trainingStats';
import { ChartCard, RevealStack, TipRow, tipProps } from '../../components/charts';
import { BodyMap, MuscleIcon } from '../../components/BodyMap';
import { GROUP_NAME, KIND_ICON, MUSCLE_GROUP, MUSCLE_NAME, Power } from '../../components/fitness';
import { Icon, type UiName } from '../../components/icons';
import { count, listOf, t } from '../../lib/i18n';
import { Split } from './charts';
import { powerText } from './parts';

const GROUP_ICON: Record<keyof typeof GROUP_NAME, UiName> = { push: 'arrow-up', pull: 'arrow-down', legs: 'footsteps', core: 'target' };
const GROUP_COLOR = { push: 'var(--pos-a)', pull: 'var(--accent)', legs: 'var(--tr-pale)', core: 'var(--ink-3)' };
/** Sets as the muscles count them: whole, or with a half from the exercises that only helped. */
const sets = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));

/** The body, shaded by what you worked; each muscle ranked; how push, pull, legs and core balance; what's rested longest. */
export function Muscles({ all, list, today, onMove }: { all: Done[]; list: Done[]; today: string; onMove: (id: string) => void }) {
  const [picked, setPicked] = useState<Muscle | null>(null);
  const load = useMemo(() => muscleLoad(list), [list]);
  const heat = useMemo(() => muscleHeat(load), [load]);
  const ever = useMemo(() => rested(muscleLoad(all), today), [all, today]);
  const groups = useMemo(() => groupLoad(load, MUSCLE_GROUP), [load]);
  const ranked = MUSCLES.filter((m) => load[m].sets > 0).sort((a, b) => load[b].sets - load[a].sets || load[b].power - load[a].power);
  const top = ranked.length ? load[ranked[0]].sets : 1;
  const pick = (m: Muscle | null) => setPicked(m === picked ? null : m);

  return (
    <RevealStack>
      <section class="card chart-card wide tr-body">
        <header class="chart-head">
          <div>
            <h3 class="chart-title">{t('Muscles worked')}</h3>
            <p class="chart-sub">{t('Shaded by sets: an exercise’s main muscles count a whole set, the ones that help count half. Tap a muscle to see what worked it.')}</p>
          </div>
        </header>
        <div class="tr-map">
          <BodyMap heat={heat} side="both" picked={picked} onPick={pick} label={t('Your muscles, shaded by how much you worked them')} />
        </div>
      </section>

      {picked ? (
        <MuscleCard muscle={picked} list={list} sets={load[picked].sets} power={load[picked].power} rested={ever.worked.find((x) => x.muscle === picked)?.days ?? null} onClose={() => setPicked(null)} onMove={onMove} />
      ) : (
        <ChartCard title={t('Most worked')} table={{ head: [t('Muscle'), t('Sets'), t('Power')], rows: ranked.map((m) => [MUSCLE_NAME[m], sets(load[m].sets), powerText(load[m].power)]) }}>
          {ranked.length ? (
            <ol class="ranked tr-ranked">
              {ranked.map((m, i) => (
                <li style={{ '--k': i, '--c': 'var(--accent)', '--w': load[m].sets / top }}>
                  <button class="tr-rank-btn" onClick={() => pick(m)} aria-label={t('{muscle}: {sets} sets', { muscle: MUSCLE_NAME[m], sets: sets(load[m].sets) })}>
                    <span class="rk-top">
                      <MuscleIcon muscle={m} size={24} />
                      <span class="rk-name">{MUSCLE_NAME[m]}</span>
                      <span class="rk-n"><b>{sets(load[m].sets)}</b> <small>{t('sets')}</small> <Power value={load[m].power} size={12} /></span>
                    </span>
                    <span class="rk-bar"><i /></span>
                  </button>
                </li>
              ))}
            </ol>
          ) : <p class="empty-note">{t('No sets for any muscle in this range.')}</p>}
        </ChartCard>
      )}

      <ChartCard title={t('Balance')} sub={t('The sets of each part of the body')} table={{ head: [t('Part'), t('Sets')], rows: (['push', 'pull', 'legs', 'core'] as const).map((g) => [GROUP_NAME[g], sets(groups[g] ?? 0)]) }}>
        <Split
          label={t('Sets by part of the body')}
          empty={t('Nothing to balance in this range yet.')}
          parts={(['push', 'pull', 'legs', 'core'] as const).map((g) => ({
            key: g, name: GROUP_NAME[g], icon: GROUP_ICON[g], n: groups[g] ?? 0, color: GROUP_COLOR[g], text: count(Math.round(groups[g] ?? 0), 'set', 'sets'),
          }))}
        />
      </ChartCard>

      <section class="card chart-card">
        <header class="chart-head">
          <div>
            <h3 class="chart-title">{t('Rested longest')}</h3>
            <p class="chart-sub">{t('Days since each muscle was last worked, of all time')}</p>
          </div>
        </header>
        {ever.worked.length ? (
          <ul class="tr-rested">
            {ever.worked.slice(0, 6).map((x, i) => (
              <li style={{ '--k': i }}>
                <button class="tr-rest-btn" onClick={() => pick(x.muscle)} {...tipProps(() => <TipRow value={x.days} label={t('days since {muscle} was worked', { muscle: MUSCLE_NAME[x.muscle] })} />, `${MUSCLE_NAME[x.muscle]}: ${count(x.days, 'day', 'days')}`)}>
                  <MuscleIcon muscle={x.muscle} size={24} />
                  <span class="tr-rest-name">{MUSCLE_NAME[x.muscle]}</span>
                  <b class="tr-rest-days">{x.days === 0 ? t('today') : count(x.days, 'day', 'days')}</b>
                </button>
              </li>
            ))}
          </ul>
        ) : <p class="empty-note">{t('Nothing worked yet.')}</p>}
        {ever.never.length > 0 && ever.never.length < MUSCLES.length && (
          <p class="tr-never"><Icon name="circle-dashed" size={14} /> {t('Never worked: {list}', { list: listOf(ever.never.map((m) => MUSCLE_NAME[m])) })}</p>
        )}
      </section>
    </RevealStack>
  );
}

/** One muscle picked on the map or the list: its sets and ⚡ in the range, how long it has rested, and what worked it. */
function MuscleCard({ muscle, list, sets: n, power, rested: days, onClose, onMove }: {
  muscle: Muscle; list: Done[]; sets: number; power: number; rested: number | null; onClose: () => void; onMove: (id: string) => void;
}) {
  const moves = useMemo(() => movesFor(list, muscle), [list, muscle]);
  const top = moves.length ? moves[0].sets : 1;
  return (
    <section class="card chart-card tr-muscle fade-arrive-soft">
      <header class="chart-head">
        <div class="tr-muscle-head">
          <MuscleIcon muscle={muscle} size={28} />
          <div>
            <h3 class="chart-title">{MUSCLE_NAME[muscle]}</h3>
            <p class="chart-sub">
              {count(Math.round(n), 'set', 'sets')} · {powerText(power)}
              {days !== null && <> · {days === 0 ? t('worked today') : t('rested {time}', { time: count(days, 'day', 'days') })}</>}
            </p>
          </div>
        </div>
        <button class="icon-btn small" onClick={onClose} aria-label={t('Show every muscle')} title={t('Show every muscle')}><Icon name="x" size={16} /></button>
      </header>
      {moves.length ? (
        <ol class="ranked tr-ranked">
          {moves.map((m, i) => (
            <li style={{ '--k': i, '--c': 'var(--accent)', '--w': m.sets / top }}>
              <button class="tr-rank-btn" onClick={() => onMove(m.move.id)}>
                <span class="rk-top">
                  <span class="tr-ico small"><Icon name={KIND_ICON[m.move.kind]} size={14} /></span>
                  <span class="rk-name">{m.move.name}</span>
                  <span class="rk-n"><b>{sets(m.sets)}</b> <small>{t('sets')}</small></span>
                </span>
                <span class="rk-bar"><i /></span>
              </button>
            </li>
          ))}
        </ol>
      ) : <p class="empty-note">{t('Not worked in this range.')}</p>}
    </section>
  );
}
