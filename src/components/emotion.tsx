import { useState } from 'preact/hooks';
import { CORE, EMOTION, PICKER_ORDER, coreOf, shortName } from '../data/emotions';
import { Icon, Sprite } from './icons';
import { useSettings } from '../lib/store';
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

export function IntensityPicker({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  return (
    <div class="intensity" role="radiogroup" aria-label="Intensity">
      <div class="intensity-steps">
        {INTENSITY.map((label, i) => (
          <button
            role="radio"
            aria-checked={value === i + 1}
            aria-label={`${i + 1} · ${label}`}
            class={`intensity-step${i < value ? ' on' : ''}`}
            onClick={() => onChange(i + 1)}
          >
            <i style={{ height: `${8 + i * 4}px` }} />
          </button>
        ))}
      </div>
      <span class="intensity-label">{INTENSITY[value - 1]}</span>
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
      {groups.map(([label, ids]) => (
        <div class="worlds-group">
          <div class="eyebrow">{label}</div>
          <div class="worlds-row">
            {ids.map((id) => (
              <button class="world" aria-pressed={active === id} onClick={() => onSelect(id)} style={{ '--c': `var(--emo-${id})` }}>
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
export function EmotionPicker({ onPick, selected, start }: { onPick: (id: string) => void; selected?: string[]; start?: string | null }) {
  const [core, setCore] = useState<string | null>(start ?? (selected?.length ? coreOf(selected[0]).id : null));
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
