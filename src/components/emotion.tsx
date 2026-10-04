import { useRef, useState } from 'preact/hooks';
import { CORE, EMOTION, PICKER_ORDER, shortName } from '../data/emotions';
import { Icon, Sprite } from './icons';
import { useSettings } from '../lib/store';
import { haptic } from '../lib/haptics';
import { EmotionWheel } from './EmotionWheel';

/** "Worried" with its world's sprite. `path` adds the trail: Fear › Anxiety. */
export function EmotionChip({ id, onRemove, path, size = 'md' }: { id: string; onRemove?: () => void; path?: boolean; size?: 'sm' | 'md' }) {
  const e = EMOTION[id];
  if (!e) return null;
  const core = e.core;
  return (
    <span class={`emo emo-${size}`}>
      <Sprite core={core} size={size === 'sm' ? 11 : 13} />
      <span class="emo-name">{e.depth === 0 ? shortName(id) : e.name}</span>
      {path && e.depth > 0 && <span class="emo-path">{trail(id)}</span>}
      {onRemove && (
        <button class="emo-x" onClick={onRemove} aria-label={`Remove ${e.name}`}>
          <Icon name="x" size={14} />
        </button>
      )}
    </span>
  );
}

/** "Fear › Anxiety" for a feeling, "Fear" for a family. */
export function trail(id: string) {
  const e = EMOTION[id];
  if (!e || e.depth === 0) return '';
  const parts = [shortName(e.core)];
  if (e.depth === 2 && e.parent) parts.push(EMOTION[e.parent].name);
  return parts.join(' › ');
}

export const INTENSITY = ['Barely', 'Mild', 'Moderate', 'Strong', 'Intense'];
const INTENSITY_NOTE = ['Just a flicker', 'There, but easy to carry', 'Clearly here', 'Hard to ignore', 'It fills everything'];

/** One slider for "how strong is it": tap or drag along the meter, or use the arrow keys. The feeling's world fills it and grows with it. */
export function IntensityPicker({ value, onChange, cores = [], title = 'How strong is it?' }: {
  value: number;
  onChange: (n: number) => void;
  /** The worlds of the feelings it measures: it wears their colours and sprites, and without any it takes `--c` from its surroundings. */
  cores?: string[];
  title?: string;
}) {
  const track = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);
  const set = (n: number) => {
    const v = Math.min(5, Math.max(1, n));
    if (v === value) return;
    haptic(6);
    onChange(v);
  };
  const at = (ev: PointerEvent) => {
    const r = track.current!.getBoundingClientRect();
    set(Math.floor(((ev.clientX - r.left) / r.width) * 5) + 1);
  };
  const key = (ev: KeyboardEvent) => {
    const step = ev.key === 'ArrowRight' || ev.key === 'ArrowUp' ? 1 : ev.key === 'ArrowLeft' || ev.key === 'ArrowDown' ? -1 : 0;
    if (step) set(value + step);
    else if (ev.key === 'Home') set(1);
    else if (ev.key === 'End') set(5);
    else return;
    ev.preventDefault();
  };

  const worlds = [...new Set(cores)].slice(0, 3);
  const tint = (c: string) => `color-mix(in oklab, var(--emo-${c}) ${8 + value * 3}%, var(--surface-2))`;
  return (
    <div class="intensity" style={worlds.length ? { '--c': `var(--emo-${worlds[0]})` } : undefined} data-level={value}>
      <div class="intensity-head">
        <span class="field-label" id="intensity-title">{title}</span>
        <span class="intensity-count" aria-hidden="true">{value} of 5</span>
      </div>
      <div class="intensity-read">
        {worlds.length > 0 && (
          <span
            class="intensity-sprite"
            style={{ '--k': value, background: worlds.length > 1 ? `linear-gradient(105deg, ${worlds.map(tint).join(', ')})` : undefined }}
          >
            {worlds.map((w) => <Sprite core={w} size={worlds.length > 1 ? 22 : 26} idle={value >= 4} />)}
          </span>
        )}
        <div>
          <div class="intensity-label" key={value}>{INTENSITY[value - 1]}</div>
          <div class="intensity-note">{INTENSITY_NOTE[value - 1]}</div>
        </div>
      </div>
      <div
        ref={track}
        class="intensity-track"
        role="slider"
        tabIndex={0}
        aria-labelledby="intensity-title"
        aria-valuemin={1}
        aria-valuemax={5}
        aria-valuenow={value}
        aria-valuetext={`${INTENSITY[value - 1]}, ${value} of 5`}
        onKeyDown={(ev) => key(ev as KeyboardEvent)}
        onPointerDown={(ev) => {
          if (ev.button > 0) return;
          dragging.current = true;
          track.current!.setPointerCapture(ev.pointerId);
          at(ev as PointerEvent);
        }}
        onPointerMove={(ev) => dragging.current && at(ev as PointerEvent)}
        onPointerUp={() => (dragging.current = false)}
        onPointerCancel={() => (dragging.current = false)}
      >
        {INTENSITY.map((_, i) => (
          <i class={i < value ? 'on' : ''} style={{ '--i': i, ...(worlds.length > 1 && { '--c': `var(--emo-${worlds[i % worlds.length]})` }) }} />
        ))}
      </div>
      <div class="intensity-ends" aria-hidden="true"><span>{INTENSITY[0]}</span><span>{INTENSITY[4]}</span></div>
    </div>
  );
}

/* ---------- picker: world → zone/feeling ("name it to tame it") ---------- */

export function WorldGrid({ onSelect, active }: { onSelect: (core: string) => void; active?: string | null }) {
  const groups: [string, string[]][] = [
    ['Unpleasant', PICKER_ORDER.slice(0, 4)],
    ['Pleasant', PICKER_ORDER.slice(4)],
  ];
  return (
    <div class="worlds">
      {groups.map(([label, ids], g) => (
        <div class="worlds-group">
          <div class="eyebrow">{label}</div>
          <div class="worlds-row">
            {ids.map((id, i) => (
              <button class="world" aria-pressed={active === id} onClick={() => onSelect(id)} style={{ '--c': `var(--emo-${id})`, '--i': g * 4 + i }}>
                <Sprite core={id} size={28} />
                <span>{shortName(id)}</span>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export function WorldDetail({ core, onBack, onPick, selected = [] }: {
  core: string;
  onBack: () => void;
  onPick: (id: string) => void;
  selected?: string[];
}) {
  const c = CORE[core];
  return (
    <div class="world-detail" style={{ '--c': `var(--emo-${core})` }}>
      <div class="world-head">
        <button class="icon-btn" onClick={onBack} aria-label="Back to all emotions">
          <Icon name="chevron-left" />
        </button>
        <Sprite core={core} size={22} />
        <div>
          <h3 class="world-name">{c.name}</h3>
          <p class="world-def">{c.def}</p>
        </div>
      </div>
      {c.families.map((f) => (
        <section class="zone">
          <button class="zone-head" aria-pressed={selected.includes(f.id)} onClick={() => onPick(f.id)}>
            <span class="zone-name">{f.name}</span>
            <span class="zone-def">{f.def}</span>
          </button>
          <div class="feelings">
            {f.feelings.map((x) => (
              <button class="feeling" aria-pressed={selected.includes(x.id)} onClick={() => onPick(x.id)}>
                <span class="feeling-name">{x.name}</span>
                <span class="feeling-def">{x.def}</span>
              </button>
            ))}
          </div>
        </section>
      ))}
      <button class="btn btn-quiet just-core" aria-pressed={selected.includes(core)} onClick={() => onPick(core)}>
        Just “{shortName(core)}” — not sure which
      </button>
    </div>
  );
}

/** Two-step picker used in sheets. */
export function EmotionPicker({ onPick, selected }: { onPick: (id: string) => void; selected?: string[] }) {
  const [core, setCore] = useState<string | null>(null);
  const { picker } = useSettings();
  if (picker === 'wheel') return <EmotionWheel focus={core} onFocus={setCore} onPick={onPick} selected={selected} />;
  return core ? (
    <WorldDetail core={core} onBack={() => setCore(null)} onPick={onPick} selected={selected} />
  ) : (
    <div>
      <p class="hint">Pick the world that feels closest. There are no wrong answers.</p>
      <WorldGrid onSelect={setCore} />
    </div>
  );
}
