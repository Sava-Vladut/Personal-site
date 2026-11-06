import { useMemo, useState } from 'preact/hooks';
import { shortDate } from '../../lib/dates';
import { KINDS, type Move } from '../../lib/fitness';
import { imageOf, useExercises } from '../../lib/exercises';
import { trendOf, type MoveStats } from '../../lib/trainingStats';
import { KIND_ICON, KIND_NAME, Power } from '../../components/fitness';
import { Icon } from '../../components/icons';
import { count, t } from '../../lib/i18n';
import { Spark } from './charts';
import { fmtKg } from './parts';

/** Lowercase, without accents or punctuation, for matching what's typed. */
const fold = (s: string) => s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

/** The pictures the exercise database has, by id (your own exercises have none). */
export function usePictures() {
  const { list } = useExercises();
  return useMemo(() => new Map<string, Move>(list.filter((m) => m.img > 0).map((m) => [m.id, m])), [list]);
}

/** An exercise's first picture, or the icon of its kind while there's none (or none yet). */
export function MoveThumb({ id, kind, pictures }: { id: string; kind: MoveStats['move']['kind']; pictures: Map<string, Move> }) {
  const m = pictures.get(id);
  const src = m ? imageOf(m, 0) : null;
  return src
    ? <img class="tr-thumb" src={src} alt="" width={40} height={40} loading="lazy" decoding="async" />
    : <span class="tr-thumb tr-ico" aria-hidden="true"><Icon name={KIND_ICON[kind]} size={16} /></span>;
}

/** The figure an exercise is known by: its best estimated one-rep max, or its best set's ⚡. */
export const BestOf = ({ m }: { m: MoveStats }) => (m.best1rm
  ? <span class="tr-best"><small>{t('1RM')}</small> {fmtKg(m.best1rm.value)}</span>
  : m.bestSet ? <Power value={m.bestSet.value} size={14} /> : <span class="tr-best">—</span>);

/** Every exercise you've done, by kind, the most done first, each with its best and how it's going. */
export function Exercises({ moves, onOpen }: { moves: MoveStats[]; onOpen: (id: string) => void }) {
  const [q, setQ] = useState('');
  const pictures = usePictures();
  const found = useMemo(() => {
    const terms = fold(q).split(' ').filter(Boolean);
    return terms.length ? moves.filter((m) => { const w = fold(m.move.name); return terms.every((x) => w.includes(x)); }) : moves;
  }, [moves, q]);
  const groups = KINDS.map((k) => ({ kind: k, list: found.filter((m) => m.move.kind === k) })).filter((g) => g.list.length);

  return (
    <div class="tr-exercises">
      {moves.length > 8 && (
        <label class="search tr-search">
          <Icon name="search" size={18} />
          <input type="search" value={q} onInput={(e) => setQ(e.currentTarget.value)} placeholder={t('Find an exercise')} aria-label={t('Find an exercise')} autocomplete="off" enterKeyHint="search" />
        </label>
      )}
      {!found.length ? (
        <div class="empty-note center">
          <p>{t('No exercise you’ve done matches “{q}”.', { q })}</p>
          <button class="btn btn-quiet" onClick={() => setQ('')}>{t('Clear search')}</button>
        </div>
      ) : groups.map((g) => (
        <section class="section tr-group" key={g.kind}>
          <h2 class="section-title"><Icon name={KIND_ICON[g.kind]} size={16} /> {KIND_NAME[g.kind]} <span class="tr-count">{g.list.length}</span></h2>
          <div class="card list">
            {g.list.map((m) => {
              const trend = trendOf(m).slice(-12).map((p) => p.value);
              return (
                <button class="list-row action tr-ex" key={m.move.id} onClick={() => onOpen(m.move.id)}>
                  <MoveThumb id={m.move.id} kind={m.move.kind} pictures={pictures} />
                  <span class="tr-row-main">
                    <span class="tr-row-name">{m.move.name}</span>
                    <span class="tr-row-meta">{count(m.times, 'time', 'times')} · {shortDate(m.last)}</span>
                  </span>
                  <span class="tr-row-end">
                    <BestOf m={m} />
                    <Spark values={trend} />
                  </span>
                </button>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
