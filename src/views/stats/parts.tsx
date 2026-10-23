import { createContext } from 'preact';
import { useContext, useEffect, useRef, useState } from 'preact/hooks';
import { EMOTION, shortName } from '../../data/emotions';
import type { Insight, RangeKey, Stats as S } from '../../lib/stats';
import { watchView } from '../../lib/inView';
import { CountUp, type Table } from '../../components/charts';
import { AsciiMeter, Scramble } from '../../components/ascii';
import { AsciiCloud } from '../../components/cloud';
import { Icon, Sprite, type UiName } from '../../components/icons';
import { t } from '../../lib/i18n';

/** The period just before the one shown, to compare with. */
export const RANGE_BEFORE: Record<RangeKey, string> = { '7d': t('the 7 days before'), '30d': t('the 30 days before'), '90d': t('the 90 days before'), '1y': t('the year before'), all: t('the period before') };
export const RANGE_PHRASE: Record<RangeKey, string> = { '7d': t('over the last 7 days'), '30d': t('over the last 30 days'), '90d': t('over the last 90 days'), '1y': t('over the last year'), all: t('so far') };
export const label = (id: string) => (EMOTION[id].depth === 0 ? shortName(id) : EMOTION[id].name);

/** The world felt most in the period, if any feelings were named. */
export const leadWorld = (s: S) => s.cores.reduce<{ id: string; count: number } | null>((a, c) => (c.count > (a?.count ?? 0) ? c : a), null)?.id ?? null;

/** The page's sky worlds, most felt first: sections without a world of their own wear these. */
export const Worlds = createContext<string[]>([]);

const seedOf = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) % 1300, 7);

export function Delta({ cur, prev, digits = 0, unit = '' }: { cur: number | null; prev: number | null | undefined; digits?: number; unit?: string }) {
  if (cur === null || prev === null || prev === undefined) return null;
  const d = cur - prev;
  if (Math.abs(d) < (digits ? 0.05 : 0.5)) return <span class="delta">{t('no change')}</span>;
  return (
    <span class="delta">
      {d > 0 ? '↑' : '↓'} {Math.abs(d).toFixed(digits)}{unit}
    </span>
  );
}

/**
 * One part of the report, laid out like a day of the journal: its world's sprite and a little cloud of its letters
 * lead the label, a ribbon runs under it, and a soft aura of its colours drifts behind while it's on screen.
 * The content sits on a solid card, which can turn into a table.
 */
export function Section({ id, title, sub, world, legend, table, bare, children }: {
  id?: string;
  title: string;
  sub?: string;
  /** the section's own world; the page's leading one otherwise */
  world?: string | null;
  legend?: preact.ComponentChildren;
  table?: Table;
  /** content that brings its own surfaces, so no card around it */
  bare?: boolean;
  children: preact.ComponentChildren;
}) {
  const sky = useContext(Worlds);
  const c = world ?? sky[0] ?? null;
  const c2 = sky.find((w) => w !== c) ?? c;
  const [asTable, setAsTable] = useState(false);
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    return el ? watchView(el, (on) => el.toggleAttribute('data-live', on)) : undefined;
  }, []);
  return (
    <section ref={ref} id={id} class="st-section" style={c ? { '--d1': `var(--emo-${c})`, '--d2': `var(--emo-${c2})` } : undefined}>
      <header class="st-head">
        {c ? <Sprite core={c} size={12} idle="view" delay={seedOf(title)} /> : <Icon name="sparkles" size={13} />}
        <h3 class="st-title">{title}</h3>
        {c && <AsciiCloud world={c} seed={seedOf(title)} cols={12} rest />}
        {table && (
          <button class="icon-btn small" aria-pressed={asTable} aria-label={asTable ? t('Show chart') : t('Show as table')} title={asTable ? t('Show chart') : t('Show as table')} onClick={() => setAsTable(!asTable)}>
            <Icon name={asTable ? 'chart-bar' : 'table'} size={18} />
          </button>
        )}
        <i class="st-ribbon" aria-hidden="true" />
      </header>
      {sub && <p class="st-sub">{sub}</p>}
      <div class={bare ? 'st-body bare' : 'card st-body'}>
        {asTable && table ? (
          <div class="table-wrap">
            <table>
              <thead><tr>{table.head.map((h) => <th>{h}</th>)}</tr></thead>
              <tbody>{table.rows.map((r) => <tr>{r.map((c) => <td>{c}</td>)}</tr>)}</tbody>
            </table>
          </div>
        ) : (
          <>
            {legend && <div class="legend">{legend}</div>}
            {children}
          </>
        )}
      </div>
    </section>
  );
}

/** A figure in the report: a small mono label, the figure set large, and a meter written in letters. */
export function Readout({ label: l, value, small, sub, delta, meter, marks, lead, k = 0 }: {
  label: string;
  value: string | number;
  /** a word rather than a figure: set smaller so it fits */
  small?: boolean;
  sub?: string;
  delta?: preact.ComponentChildren;
  /** 0–1: a meter of letters under the figure */
  meter?: number;
  /** letters lit or not, like the days of a week */
  marks?: boolean[];
  /** something drawn beside the figure: a cloud, a sprite */
  lead?: preact.ComponentChildren;
  /** its place in the row, so the readouts arrive one after another */
  k?: number;
}) {
  const sky = useContext(Worlds);
  return (
    <div class="st-readout" style={{ '--k': k }}>
      <div class="st-readout-label">{l}</div>
      <div class="st-readout-row">
        <span class={small ? 'st-readout-value small' : 'st-readout-value'}><Scramble value={value} /></span>
        {lead}
      </div>
      {(meter !== undefined || marks) && <AsciiMeter value={meter} marks={marks} cells={12} world={sky[0]} />}
      <div class="st-readout-sub">{sub}{delta && sub ? ' · ' : ''}{delta}</div>
    </div>
  );
}

/** "What stands out", written out like a note: one sentence after another, each in the colour of its world. */
export function Story({ notes, title }: { notes: Insight[]; title: string }) {
  return (
    <Section title={title}>
      <p class="st-story">
        {notes.map((n, i) => (
          <span class="st-story-line" style={{ '--k': i, ...(n.core ? { '--c': `var(--emo-${n.core})` } : {}) }}>
            {n.core && <Sprite core={n.core} size={12} />}
            {n.text}{' '}
          </span>
        ))}
      </p>
    </Section>
  );
}

/** A figure in a tile, for the pages that share the stats' look (Friends, Laws, Traps). */
export function Tile({ icon, label: l, value, small, sub, delta, meter, pips, k = 0 }: {
  icon: UiName;
  label: string;
  value: string | number;
  /** a word rather than a figure: set smaller so it fits */
  small?: boolean;
  sub?: string;
  delta?: preact.ComponentChildren;
  /** 0–1: a thin bar under the figure */
  meter?: number;
  /** small dots under the figure, lit or not */
  pips?: boolean[];
  /** its place in the row, so the tiles arrive one after another */
  k?: number;
}) {
  return (
    <div class="tile" style={{ '--k': k }}>
      <div class="tile-top">
        <span class="tile-ico"><Icon name={icon} size={14} stroke={2} /></span>
        <span class="tile-label">{l}</span>
      </div>
      <div class={small ? 'tile-value small' : 'tile-value'}><CountUp value={value} /></div>
      <div class="tile-sub">{sub}{delta && sub ? ' · ' : ''}{delta}</div>
      {meter !== undefined && <div class="tile-meter"><i style={{ width: `${Math.max(0, Math.min(1, meter)) * 100}%` }} /></div>}
      {pips && <div class="pips">{pips.map((on, i) => <i class={on ? 'on' : ''} style={{ '--k': i }} />)}</div>}
    </div>
  );
}

/** A feeling or world as a small chip tinted with its own colour. */
export function WorldChip({ core, children }: { core: string; children: preact.ComponentChildren }) {
  return (
    <span class="world-chip" style={{ '--c': `var(--emo-${core})` }}>
      <Sprite core={core} size={12} />{children}
    </span>
  );
}
