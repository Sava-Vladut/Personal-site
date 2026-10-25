// The pieces the three Learn pages (Mind traps, Laws of power, Win friends) are built from, so they look and move
// alike (styles/learn.css). Nothing here animates in on its own: the page transition and lib/reveal.ts bring things
// in, hovers only change colour, a press sinks to .98 and springs back, and anything whose content changes keeps its
// size. Only the icons move, inside their own box (Ico, styles/icon-motion.css). `hue` is always the name of a world colour (the part after --emo-, e.g. 'sadness'), as Mark takes it.
import type { ComponentChildren } from 'preact';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { UiName } from './icons';
import { Mark } from './Mark';
import UI from '../data/ui-icons.json';
import { svgInner } from '../lib/icons';
import { t } from '../lib/i18n';
import '../styles/learn.css';
import '../styles/icon-motion.css';

/*
 * Icon motion (styles/icon-motion.css). Every interface icon on these pages is an Ico: the same Tabler svg as
 * components/icons' Icon, plus `ic` and the gesture that fits its meaning (the eye blinks, the crown hops, the
 * chevron nudges…). The gesture is played by the control the icon sits in (hover, keyboard focus, press) or by a
 * state change (`is-go`, `is-pop`, `data-play`), never on its own and never in a loop. `--ic-len` is how long the
 * icon's longest stroke is, for the icons that draw themselves on.
 */
const MOTION: Partial<Record<UiName, [gesture: string, len?: number]>> = {
  search: ['ic-tilt'],
  eye: ['ic-blink'],
  crown: ['ic-hop'],
  brain: ['ic-pulse'],
  sparkles: ['ic-twinkle', 38],
  'dice-5': ['ic-tumble'],
  'chevron-right': ['ic-nudge-r'],
  'arrow-up-right': ['ic-nudge-ur'],
  check: ['ic-draw', 22],
  x: ['ic-draw', 17],
  'list-check': ['ic-draw', 10],
  'alert-circle': ['ic-draw', 57],
  plus: ['ic-turn', 14],
  book: ['ic-open', 19],
  heart: ['ic-beat', 56],
  moon: ['ic-swing', 62],
  'info-circle': ['ic-drop', 57],
};

/* icons that play once as they first come into view (`arrive`): one shared observer, each let go after it fires */
let arrivals: IntersectionObserver | null = null;
function watchArrival(el: Element) {
  if (typeof IntersectionObserver === 'undefined') {
    el.setAttribute('data-in', '');
    return undefined;
  }
  arrivals ??= new IntersectionObserver((list) => {
    for (const e of list) {
      if (!e.isIntersecting) continue;
      e.target.setAttribute('data-in', '');
      arrivals?.unobserve(e.target);
    }
  }, { threshold: 0.35 });
  arrivals.observe(el);
  return () => arrivals?.unobserve(el);
}

/**
 * An interface icon that moves (see MOTION above): the gesture plays when the control around it is hovered, focused
 * or pressed. `arrive` draws it on once, a beat after it first comes into view (an aside's label, the evidence line).
 * `class` adds state classes: `is-go` plays the gesture now (put it on as the state changes, or key the icon so it
 * mounts with it), `is-pop` pops the whole icon (a count going up).
 */
export function Ico({ name, size = 20, stroke = 1.75, class: cls, arrive }: { name: UiName; size?: number; stroke?: number; class?: string; arrive?: boolean }) {
  const ref = useRef<SVGSVGElement>(null);
  useEffect(() => (arrive && ref.current ? watchArrival(ref.current) : undefined), [arrive]);
  const [gesture, len] = MOTION[name] ?? [];
  return (
    <svg
      ref={ref}
      class={['ic', gesture, arrive && 'is-arrive', cls].filter(Boolean).join(' ')}
      style={len ? { '--ic-len': len } : undefined}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
      dangerouslySetInnerHTML={{ __html: svgInner('t:' + name, UI[name], stroke) }}
    />
  );
}

/**
 * Whether `value` has changed since the component mounted (and stays true after): put a state class on an icon
 * only once it's live, so the icon moves when you change something, not when the page or sheet first draws it.
 */
export function useLive(value: unknown): boolean {
  const at = useRef({ value, live: false });
  if (!Object.is(at.current.value, value)) at.current = { value, live: true };
  return at.current.live;
}

/** Plays the press gesture of the Ico in the clicked control (the dice tumbling): call it from the control's onClick. */
export function playIcon(e: Event): void {
  const svg = (e.currentTarget as Element | null)?.querySelector('.ic');
  if (!svg) return;
  svg.removeAttribute('data-play');
  void svg.getBoundingClientRect(); // let the style drop, so setting it again starts the animation over
  svg.setAttribute('data-play', '');
}

/**
 * The card of the day at the top of the feature column: a kicker, the entry's mark (64px), its title and line, an
 * optional `aside` at the right of the title (Traps' power gauge) and an optional `foot` under a hairline (the tell,
 * the question, this week's try), with `footLabel` as its small label. The whole card is one button (`onClick`).
 */
export function Today({ kicker, id, hue, title, line, aside, footLabel, foot, onClick }: {
  /** The small uppercase label at the top ("Trap of the day"). */
  kicker: string;
  /** The entry's mark id (data/marks.ts). */
  id: string;
  hue: string;
  title: string;
  line: string;
  aside?: ComponentChildren;
  footLabel?: string;
  foot?: ComponentChildren;
  onClick: () => void;
}) {
  return (
    <button class="card lrn-card lrn-today" onClick={onClick}>
      <span class="kicker">{kicker}</span>
      <span class="lrn-today-row">
        <Mark id={id} hue={hue} size={64} />
        <span class="lrn-today-body">
          <span class="lrn-today-title">{title}</span>
          <span class="lrn-today-line">{line}</span>
        </span>
        {aside != null && aside !== false && <span class="lrn-today-aside">{aside}</span>}
      </span>
      {foot != null && foot !== false && (
        <span class="lrn-today-foot">
          {footLabel && <small>{footLabel}</small>}
          {foot}
        </span>
      )}
    </button>
  );
}

/**
 * The head of one group in the list (a family, an arena, a part): a dot in its `hue`, the `title`, how many are in it
 * (`count`), and under it an optional `motto` (one quiet line) and `about` (a short paragraph). Leave `hue` out for
 * a group that isn't one colour (a ranked list).
 */
export function GroupHead({ hue, title, motto, about, count }: {
  hue?: string;
  title: string;
  motto?: string;
  about?: ComponentChildren;
  count: number;
}) {
  return (
    <header class="lrn-group-head">
      <h3 class="lrn-group-title">
        {hue && <i class="lrn-dot" style={{ '--c': `var(--emo-${hue})` }} aria-hidden="true" />}
        <span class="lrn-group-name">{title}</span>
        <span class="lrn-count">{count}</span>
      </h3>
      {motto && <p class="lrn-group-motto">{motto}</p>}
      {about != null && about !== false && <p class="lrn-group-about">{about}</p>}
    </header>
  );
}

/**
 * One entry in a list: renders an `<li>`, so put it straight in an `<ol class="lrn-rows">`. The mark (34px), the
 * `title` (serif, up to two lines), an optional `sub` (up to two lines) and an optional `top` (a small line above the
 * title), then `end` at the right (a number: wrap it as `<span class="lrn-num"><b>82</b><small>power</small></span>`).
 * Optional extras: `rank` shows a place number before the mark (a ranked sort), `badge` a small pill on the top line
 * ("Practising", "debated").
 */
export function Row({ id, hue, title, sub, top, end, rank, badge, onClick }: {
  id: string;
  hue: string;
  title: string;
  sub?: ComponentChildren;
  top?: ComponentChildren;
  end?: ComponentChildren;
  rank?: number | string;
  badge?: ComponentChildren;
  onClick: () => void;
}) {
  const hasTop = (top != null && top !== false) || (badge != null && badge !== false);
  return (
    <li>
      <button class="lrn-row" onClick={onClick}>
        {rank != null && <span class="lrn-rank">{rank}</span>}
        <Mark id={id} hue={hue} size={34} />
        <span class="lrn-row-main">
          {hasTop && (
            <span class="lrn-row-top">
              {top}
              {badge != null && badge !== false && <span class="lrn-badge">{badge}</span>}
            </span>
          )}
          <span class="lrn-row-title">{title}</span>
          {sub != null && sub !== false && <span class="lrn-row-sub">{sub}</span>}
        </span>
        {end != null && end !== false && <span class="lrn-row-end">{end}</span>}
      </button>
    </li>
  );
}

/**
 * The line under a map that tells you what's under the pointer, in a box of fixed height so hovering never moves the
 * page: with a `title`, the title (one line, cut with an ellipsis) and `sub` (up to two lines); without, `idle` (up to
 * three lines). It's a polite live region.
 */
export function Caption({ title, sub, idle }: { title?: ComponentChildren; sub?: ComponentChildren; idle: ComponentChildren }) {
  const on = title != null && title !== false && title !== '';
  return (
    <div class="lrn-caption" aria-live="polite">
      {on ? (
        <>
          <b class="lrn-caption-title">{title}</b>
          {sub != null && sub !== false && <span class="lrn-caption-sub">{sub}</span>}
        </>
      ) : (
        <span class="lrn-caption-idle">{idle}</span>
      )}
    </div>
  );
}

/**
 * One answer in a quiz: a lettered key (A for `index` 0) and its `label`. `state` is 'idle' before anything is picked,
 * 'picked' for the one picked when there's no right answer, 'right' for the right answer once picked (whether or not
 * it was the one tapped) and 'wrong' for a wrong pick. `disabled` greys out the rest once answered. `pressed` sets
 * aria-pressed (pass true for the one that was tapped). The button keeps its size in every state; the key shows a
 * tick or a cross in the same circle. Put the options in `.lrn-opts` and the verdict after them, never above.
 */
export function Option({ index, label, state, disabled, pressed, onClick }: {
  index: number;
  label: ComponentChildren;
  state: 'idle' | 'picked' | 'right' | 'wrong';
  disabled?: boolean;
  pressed?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      class={`lrn-opt${state === 'idle' ? '' : ` is-${state}`}`}
      onClick={onClick}
      disabled={disabled}
      aria-pressed={pressed}
    >
      <span class="lrn-opt-key" aria-hidden={state === 'right' || state === 'wrong'}>
        {state === 'right' ? <Ico name="check" size={14} stroke={2.25} /> : state === 'wrong' ? <Ico name="x" size={14} stroke={2.25} /> : String.fromCharCode(65 + index)}
      </span>
      <span class="lrn-opt-label">{label}</span>
    </button>
  );
}

/**
 * A score out of ten as a bar: its `label`, the bar and the `value`; `about` is the tooltip. The bar draws itself
 * once, after the sheet has landed (it waits --dur-3), and not at all under reduced motion. Put meters in a
 * `.lrn-meters` well.
 */
export function Meter({ label, value, about }: { label: string; value: number; about?: string }) {
  const v = Math.max(0, Math.min(10, value));
  return (
    <div class="lrn-meter" title={about}>
      <span class="lrn-meter-label">{label}</span>
      <i class="lrn-meter-track" role="meter" aria-label={label} aria-valuemin={0} aria-valuemax={10} aria-valuenow={v}>
        <b style={{ '--v': v / 10 }} />
      </i>
      <em class="lrn-meter-n">{v}</em>
    </div>
  );
}

/**
 * The top of an opened entry: its mark (96px, still), a `kicker` (one small uppercase line), the `title` and its
 * `line`. `children` go under the line (e.g. Traps' "also called").
 */
export function DetailHead({ id, hue, kicker, title, line, children, onShare }: {
  id: string;
  hue: string;
  kicker: string;
  title: string;
  line: ComponentChildren;
  children?: ComponentChildren;
  /** Shows a quiet "Share" under the head that opens the page's LearnShare for this entry. */
  onShare?: () => void;
}) {
  return (
    <header class="lrn-d-head">
      <Mark id={id} hue={hue} size={96} />
      <p class="kicker">{kicker}</p>
      <h2 class="lrn-d-title">{title}</h2>
      <p class="lrn-d-line">{line}</p>
      {children}
      {onShare && <button class="btn btn-quiet btn-s lrn-d-share" onClick={onShare}><Ico name="share" size={16} /> {t('Share publicly')}</button>}
    </header>
  );
}

/**
 * A boxed aside in an opened entry (the experiment, from history, the story, the shadow side, strange but true):
 * an `icon` and an uppercase `label`, then an optional serif `title` and `who` (a quiet byline), then `children`
 * (text, or paragraphs). Put two side by side in a `.lrn-pair`.
 */
export function Aside({ icon, label, title, who, children }: {
  icon: UiName;
  label: string;
  title?: ComponentChildren;
  who?: ComponentChildren;
  children: ComponentChildren;
}) {
  return (
    <aside class="lrn-aside">
      <p class="lrn-aside-k"><Ico name={icon} size={14} arrive />{label}</p>
      {title != null && title !== false && <h4 class="lrn-aside-title">{title}</h4>}
      {who != null && who !== false && <p class="lrn-aside-who">{who}</p>}
      <div class="lrn-aside-body">{children}</div>
    </aside>
  );
}

/**
 * A link to an entry on another Learn page (a trap, a law, a principle) and how the two connect. At the left its mark
 * (28px) when `id` is given, otherwise `icon` in a small tile in its `hue`; then an optional `kicker` ("Law 15"), the
 * `title` and `how` (the connection, a line or two), and an arrow. Put them in a `.lrn-links` list.
 */
export function LinkRow({ hue, id, icon, kicker, title, how, onClick }: {
  hue: string;
  id?: string;
  icon?: UiName;
  kicker?: string;
  title: string;
  how?: ComponentChildren;
  onClick: () => void;
}) {
  return (
    <button class="lrn-link" onClick={onClick}>
      {id ? (
        <Mark id={id} hue={hue} size={28} />
      ) : (
        <span class="lrn-link-ico" style={{ '--c': `var(--emo-${hue})` }} aria-hidden="true">{icon && <Ico name={icon} size={16} />}</span>
      )}
      <span class="lrn-link-main">
        {kicker && <small class="lrn-link-k">{kicker}</small>}
        <b class="lrn-link-title">{title}</b>
        {how != null && how !== false && <span class="lrn-link-how">{how}</span>}
      </span>
      <Ico name="arrow-up-right" size={16} class="lrn-link-go" />
    </button>
  );
}

/**
 * A button that counts ("I caught myself in this one ×3") or toggles ("Practising"): an `icon`, the `label`, and,
 * when `n` is given (0 included), a count slot at the right that's always there, empty and invisible at 0, so the
 * label never moves when the count appears. Leave `n` out for a toggle and pass `pressed` instead. Put them in a
 * `.lrn-actions` row.
 */
export function Tally({ icon, label, n, pressed, onClick }: {
  icon: UiName;
  label: string;
  n?: number;
  pressed?: boolean;
  onClick: () => void;
}) {
  // the icon is keyed by what it shows, so a new count or a toggle mounts it afresh and its one-shot plays; only once
  // something has changed here, so opening the sheet doesn't set it off
  const live = useLive(`${icon}:${n}:${pressed}`);
  const toggle = n === undefined;
  return (
    <button class="btn btn-quiet lrn-tally" onClick={onClick} aria-pressed={pressed}>
      <Ico key={`${icon}:${n ?? ''}`} name={icon} size={18} class={live ? (toggle ? 'is-go is-pop' : 'is-pop') : undefined} />
      <span class="lrn-tally-label">{label}</span>
      {n !== undefined && <b class="lrn-tally-n">{n > 0 ? `×${n}` : ''}</b>}
    </button>
  );
}

/**
 * State kept on this device as JSON under `key` exactly (no prefix, so the pages' existing keys such as
 * 'mm-traps-caught' keep their data), starting at `init` when there's nothing stored or it can't be read.
 * Unlike lib/prefs' usePref, it holds objects and numbers; use usePref for a sort or filter.
 */
export function useLocal<T>(key: string, init: T): [T, (v: T) => void] {
  const [value, set] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw == null ? init : ((JSON.parse(raw) as T) ?? init);
    } catch {
      return init;
    }
  });
  const save = (v: T) => {
    set(v);
    try {
      localStorage.setItem(key, JSON.stringify(v));
    } catch {}
  };
  return [value, save];
}

/** A shuffled copy of `a` (Fisher–Yates); `a` is left as it is. */
export function shuffle<T>(a: T[]): T[] {
  const out = [...a];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Goes back to the top of the sheet `el` sits in (or is), at once: call it in the same tick as you switch the sheet to
 * another entry, so the new one starts at its head instead of the content swapping mid-scroll. `el` is any element
 * inside the sheet's body (a ref on a wrapper around the detail).
 */
export function jumpTop(el: Element | null): void {
  const body = el?.closest('.sheet-body');
  if (body) body.scrollTop = 0;
}
