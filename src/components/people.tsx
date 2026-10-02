import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { coreOf } from '../data/emotions';
import { blankPerson, savePerson, toast, useEntries, usePeople, type Person } from '../lib/store';
import { Icon, NoteIcon } from './icons';
import { Sheet } from './Sheet';

export function initials(name: string) {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (!words.length) return '?';
  return ([...words[0]][0] + (words.length > 1 ? [...words[words.length - 1]][0] : '')).toUpperCase();
}

/** Round avatar: the person's icon, or their initials, tinted with the main feeling they bring. */
export function Avatar({ p, size = 40 }: { p: Person; size?: number }) {
  const main = p.emotions[0] ? coreOf(p.emotions[0]).id : null;
  return (
    <span class={`avatar${main ? ' tinted' : ''}`} style={{ width: size, height: size, fontSize: Math.round(size * 0.38), '--c': main ? `var(--emo-${main})` : undefined }} aria-hidden="true">
      {p.icon ? <NoteIcon id={p.icon} size={Math.round(size * 0.56)} /> : initials(p.name)}
    </span>
  );
}

export function usePeopleById() {
  const people = usePeople();
  return useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);
}

/** A tagged person: avatar and name, with an optional remove button. */
export function PersonChip({ p, onRemove, size = 'md' }: { p: Person; onRemove?: () => void; size?: 'sm' | 'md' }) {
  return (
    <span class={`emo emo-${size} person-chip`}>
      <Avatar p={p} size={size === 'sm' ? 16 : 20} />
      <span class="emo-name">{p.name || 'Unnamed'}</span>
      {onRemove && (
        <button class="emo-x" onClick={onRemove} aria-label={`Remove ${p.name}`}>
          <Icon name="x" size={14} />
        </button>
      )}
    </span>
  );
}

/** Tagged people plus an "add" chip, for the note editor and check-ins. */
export function PeopleChips({ ids, onChange, onAdd, label = 'Thinking of' }: {
  ids: string[];
  onChange: (ids: string[]) => void;
  onAdd: () => void;
  label?: string;
}) {
  const byId = usePeopleById();
  const tagged = ids.map((id) => byId.get(id)).filter(Boolean) as Person[];
  return (
    <>
      {tagged.map((p) => <PersonChip p={p} onRemove={() => onChange(ids.filter((x) => x !== p.id))} />)}
      <button class="chip" onClick={onAdd}>
        <Icon name="user-plus" size={16} /> {tagged.length ? 'Add' : label}
      </button>
    </>
  );
}

/** Pick people to tag, or add someone new by typing their name. */
export function PeopleSheet({ open, onClose, selected, onChange, title = 'Thinking of' }: {
  open: boolean;
  onClose: () => void;
  selected: string[];
  onChange: (ids: string[]) => void;
  title?: string;
}) {
  const people = usePeople();
  const entries = useEntries();
  const [q, setQ] = useState('');
  const creating = useRef(false);
  const request = useRef(0);
  const selection = useRef(selected);
  selection.current = selected;
  useEffect(() => () => { request.current++; }, [open]);

  // Most recently tagged first, so the usual people are at hand.
  const recent = useMemo(() => {
    const last = new Map<string, number>();
    for (const e of entries) for (const id of e.people) if (!last.has(id)) last.set(id, e.time);
    return last;
  }, [entries]);
  const needle = q.trim().toLowerCase();
  const shown = people
    .filter((p) => !needle || p.name.toLowerCase().includes(needle) || p.relation.toLowerCase().includes(needle))
    .sort((a, b) => (recent.get(b.id) ?? 0) - (recent.get(a.id) ?? 0));
  const exact = people.find((p) => p.name.trim().toLowerCase() === needle);

  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id].slice(0, 20));
  const create = async () => {
    const name = q.trim().slice(0, 120);
    if (!name || creating.current) return;
    const n = request.current;
    creating.current = true;
    try {
      const p = await savePerson(blankPerson(name));
      if (n !== request.current) return;
      onChange([...selection.current, p.id].slice(0, 20));
      setQ('');
    } catch {
      if (n === request.current) toast('Couldn’t save this person. Try again.');
    } finally {
      creating.current = false;
    }
  };

  return (
    <Sheet open={open} onClose={() => { setQ(''); onClose(); }} title={title} footer={<button class="btn btn-primary" onClick={() => { setQ(''); onClose(); }}>Done</button>}>
      <form class="search" onSubmit={(e) => { e.preventDefault(); if (exact) toggle(exact.id); else create(); }}>
        <Icon name="search" size={18} />
        <input type="search" placeholder={people.length ? 'Find or add someone' : 'Type a name to add someone'} value={q} onInput={(e) => setQ(e.currentTarget.value)} aria-label="Find or add a person" maxLength={120} />
      </form>
      <div class="person-picks">
        {needle && !exact && (
          <button class="person-pick" onClick={create}>
            <span class="avatar new" style={{ width: 36, height: 36 }}><Icon name="user-plus" size={18} /></span>
            <span class="person-pick-main"><span class="person-pick-name">Add “{q.trim()}”</span><span class="person-pick-sub">New person</span></span>
          </button>
        )}
        {shown.map((p) => (
          <button key={p.id} class="person-pick" aria-pressed={selected.includes(p.id)} onClick={() => toggle(p.id)}>
            <Avatar p={p} size={36} />
            <span class="person-pick-main">
              <span class="person-pick-name">{p.name || 'Unnamed'}</span>
              {p.relation && <span class="person-pick-sub">{p.relation}</span>}
            </span>
            <span class="track-check"><Icon name="check" size={16} stroke={2.4} /></span>
          </button>
        ))}
        {!people.length && !needle && <p class="empty-note center">No one here yet. Type a name above to add them.</p>}
      </div>
    </Sheet>
  );
}
