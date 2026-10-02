import { useEffect, useMemo, useState } from 'preact/hooks';
import { iconLabel, loadAll, loadCurated, svgInner, viewBoxOf, type IconCategory } from '../lib/icons';
import { rememberIcon } from '../lib/store';
import { Icon } from './icons';
import { Sheet } from './Sheet';

// Everyday words → the words icon names actually use.
const SYNONYMS: Record<string, string[]> = {
  happy: ['smil', 'grin', 'happy', 'beam', 'joy', 'laugh', 'xd'],
  joy: ['smil', 'grin', 'happy', 'joy', 'party', 'confetti'],
  sad: ['sad', 'cry', 'frown', 'pensive', 'disappoint', 'tear', 'downcast'],
  cry: ['cry', 'tear', 'sob'],
  angry: ['angry', 'anger', 'pout', 'steam', 'wrrr', 'symbols', 'rage'],
  mad: ['angry', 'anger', 'pout', 'steam', 'wrrr'],
  anxious: ['anxious', 'nervous', 'worried', 'fear', 'sweat', 'grimac', 'shak'],
  nervous: ['nervous', 'anxious', 'worried', 'sweat', 'grimac'],
  scared: ['fear', 'scream', 'anguish', 'ghost', 'anxious'],
  stress: ['anxious', 'weary', 'persever', 'confound', 'exhal', 'steam'],
  tired: ['tired', 'sleep', 'zzz', 'yawn', 'weary', 'battery', 'bed'],
  sleep: ['sleep', 'zzz', 'bed', 'moon', 'yawn'],
  love: ['heart', 'kiss', 'hug', 'love'],
  calm: ['relieved', 'leaf', 'yoga', 'cloud', 'ripple', 'feather', 'halo', 'exhal'],
  peace: ['relieved', 'halo', 'leaf', 'yoga', 'dove', 'feather'],
  confused: ['confus', 'puzzl', 'question', 'spiral', 'monocle', 'raised-eyebrow'],
  think: ['think', 'thought', 'brain', 'bulb', 'monocle'],
  sick: ['sick', 'thermometer', 'bandage', 'nause', 'pill', 'vomit', 'mask'],
  shame: ['flushed', 'see-no-evil', 'hand-over-mouth', 'peeking', 'sweat'],
  hope: ['sparkl', 'star', 'rainbow', 'sunrise', 'seedling', 'bulb'],
  energy: ['bolt', 'battery', 'flame', 'fire', 'rocket'],
  work: ['briefcase', 'laptop', 'building', 'clipboard', 'report'],
  friends: ['users', 'friends', 'people', 'hug', 'handshake'],
  weather: ['sun', 'cloud', 'rain', 'storm', 'snow', 'wind', 'rainbow'],
};

function matches(id: string, words: string[]) {
  const name = id.slice(2);
  return words.every((w) => (SYNONYMS[w] ?? [w]).some((s) => name.includes(s)) || name.includes(w));
}

export function IconSheet({ open, onClose, value, onChange }: {
  open: boolean;
  onClose: () => void;
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const [cats, setCats] = useState<IconCategory[] | null>(null);
  const [bodies, setBodies] = useState<Record<string, string>>({});
  const [tab, setTab] = useState(0);
  const [q, setQ] = useState('');
  const [all, setAll] = useState<Record<string, string> | null>(null);
  const [loadingAll, setLoadingAll] = useState(false);
  const [error, setError] = useState('');
  const [limit, setLimit] = useState(240);

  useEffect(() => {
    if (!open || cats) return;
    let active = true;
    loadCurated().then((c) => {
      if (!active) return;
      setCats(c.categories);
      setBodies(c.bodies);
      setError('');
    }).catch(() => {
      if (active) setError('Couldn’t load icons. Check your connection and try again.');
    });
    return () => { active = false; };
  }, [open, cats]);

  const words = q.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const pool = useMemo(() => ({ ...bodies, ...(all ?? {}) }), [bodies, all]);
  const searchIds = useMemo(() => Object.keys(all ? { ...all, ...bodies } : bodies), [all, bodies]);
  const results = useMemo(() => {
    if (!words.length) return null;
    return searchIds.filter((id) => matches(id, words));
  }, [q, searchIds]);

  const pick = async (id: string) => {
    const body = bodies[id] ?? all?.[id];
    if (body) await rememberIcon(id, body);
    onChange(id);
    onClose();
  };
  const searchAll = async () => {
    setLoadingAll(true);
    setError('');
    try {
      const a = await loadAll();
      setAll(a);
      setTab(cats?.length ?? 0);
    } catch {
      setError('Couldn’t load the full icon set. Check your connection and try again.');
    }
    setLoadingAll(false);
  };

  const tabs = useMemo(() => cats ? (all ? [...cats, { name: 'All', icons: Object.keys(all) }] : cats) : [], [cats, all]);
  const list = results ?? tabs[tab]?.icons ?? [];
  const shown = list.slice(0, limit);

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Icon"
      tall
      footer={value ? <button class="btn btn-quiet" onClick={() => { onChange(null); onClose(); }}>Remove icon</button> : undefined}
    >
      <label class="search">
        <Icon name="search" size={18} />
        <input
          type="search"
          placeholder={all ? 'Search all icons' : 'Search icons — try “tired” or “rain”'}
          value={q}
          onInput={(e) => setQ(e.currentTarget.value)}
          aria-label="Search icons"
        />
      </label>
      {!results && cats && (
        <div class="chips scroll-x" role="tablist">
          {tabs.map((c, i) => (
            <button class="chip" role="tab" aria-selected={tab === i} aria-pressed={tab === i} onClick={() => { setTab(i); setLimit(240); }}>{c.name}</button>
          ))}
        </div>
      )}
      {!cats && <p class="hint">Loading icons…</p>}
      <div class="icon-grid">
        {shown.map((id) => (
          <button key={id} class="icon-cell" aria-pressed={id === value} title={iconLabel(id)} aria-label={iconLabel(id)} onClick={() => pick(id)}>
            <svg width="26" height="26" viewBox={viewBoxOf(id)} aria-hidden="true" dangerouslySetInnerHTML={{ __html: svgInner(id, pool[id]) }} />
          </button>
        ))}
      </div>
      {list.length > limit && (
        <div class="center pad"><button class="btn btn-quiet" onClick={() => setLimit(limit + 480)}>Show more</button></div>
      )}
      {results && !results.length && <p class="hint center">No icons match “{q}”{all ? '' : ' here'}.</p>}
      {!all && (
        <div class="center pad">
          <button class="btn btn-quiet" onClick={searchAll} disabled={loadingAll}>
            {loadingAll ? 'Loading…' : 'Browse all 4,900 icons'}
          </button>
        </div>
      )}
      {error && <p class="error">{error}</p>}
      <p class="credit">Tabler Icons · Fluent Emoji (Microsoft) — MIT</p>
    </Sheet>
  );
}
