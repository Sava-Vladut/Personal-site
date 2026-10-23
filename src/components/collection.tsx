// The pieces the Media page builds its two collections from: a section's head, a rail of things you swipe through
// sideways, the order chip, and a list broken into runs under small headings (styles/media.css).
import type { ComponentChildren } from 'preact';
import { Icon, type UiName } from './icons';
import { t } from '../lib/i18n';

export type Sort = 'recent' | 'title' | 'rating';
export const SORTS: [Sort, string][] = [['recent', t('Recent')], ['title', t('A–Z')], ['rating', t('Top rated')]];

/** One chip for the order: each tap moves to the next. */
export function SortChip({ sort, onSort }: { sort: Sort; onSort: (s: Sort) => void }) {
  const at = SORTS.findIndex(([s]) => s === sort);
  const next = SORTS[(at + 1) % SORTS.length];
  return (
    <button class="chip sort-chip" onClick={() => onSort(next[0])} aria-label={t('Order: {now}. Change to {next}', { now: SORTS[at][1], next: next[1] })} title={t('Order by {next}', { next: next[1] })}>
      <Icon name="arrow-down" size={14} />
      <span key={sort}>{SORTS[at][1]}</span>
    </button>
  );
}

/** A section's head: its title and how many at the left, one control at the right. */
export function MediaHead({ title, icon, count, children }: { title: string; icon?: UiName; count?: number; children?: ComponentChildren }) {
  return (
    <header class="mx-head">
      <h2 class="section-title">
        {icon && <Icon name={icon} size={16} />}
        {title}
        {count !== undefined && <span class="mx-count">{count}</span>}
      </h2>
      {children}
    </header>
  );
}

/** The quiet "See all" at the end of a section's head. */
export const More = ({ onClick, label = t('See all') }: { onClick: () => void; label?: string }) => (
  <button class="mx-more" onClick={onClick}>{label}<Icon name="chevron-right" size={14} /></button>
);

/** A titled row of things you swipe through sideways. */
export function Rail({ title, icon, count, action, class: cls, children }: {
  title: string;
  icon?: UiName;
  count?: number;
  action?: ComponentChildren;
  class?: string;
  children: ComponentChildren;
}) {
  return (
    <section class={`mx-rail${cls ? ' ' + cls : ''}`}>
      <MediaHead title={title} icon={icon} count={count}>{action}</MediaHead>
      <div class="mx-track" role="list" aria-label={title}>{children}</div>
    </section>
  );
}

/** Brings a collection's list into view after a "See all" has filtered it. */
export const showList = (el: Element | null) =>
  el?.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });

/** Splits an already ordered list into runs that share a heading, in the order they come. */
export function runsOf<T>(list: T[], label: (x: T) => string): [string, T[]][] {
  const out: [string, T[]][] = [];
  for (const x of list) {
    const l = label(x);
    const last = out[out.length - 1];
    if (last && last[0] === l) last[1].push(x);
    else out.push([l, [x]]);
  }
  return out;
}

/** The first letter a title files under: A–Z, or # for the rest. */
export const letterOf = (title: string) => {
  const c = title.trim().normalize('NFD').charAt(0).toUpperCase();
  return /\p{L}/u.test(c) ? c : '#';
};

/** A list in runs: a small heading over each (only when there's more than one), then its rows. */
export function Runs<T>({ runs, row }: { runs: [string, T[]][]; row: (x: T) => ComponentChildren }) {
  return (
    <div class="mx-runs">
      {runs.map(([label, list]) => (
        <section class="mx-run" key={label}>
          {runs.length > 1 && <h3 class="mx-run-label">{label}</h3>}
          <div class="mx-rows">{list.map(row)}</div>
        </section>
      ))}
    </div>
  );
}

/** Rows still on their way: quiet shapes where they'll be. */
export const GhostRows = ({ n = 6, tall }: { n?: number; tall?: boolean }) => (
  <div class="mx-rows" aria-hidden="true">
    {Array.from({ length: n }, () => (
      <span class="mx-ghost">
        <span class="mx-row-art"><span class={`ghost${tall ? ' is-tall' : ''}`} /></span>
        <span class="mx-ghost-lines"><span class="ghost" /><span class="ghost" /></span>
      </span>
    ))}
  </div>
);
