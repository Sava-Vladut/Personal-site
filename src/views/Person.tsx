import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import { EMOTION, coreOf, shortName } from '../data/emotions';
import { dayLabel } from '../lib/dates';
import { goBack, navigate } from '../lib/router';
import { MAX_PERSON_EMOTIONS, blankPerson, deletePerson, getPeople, savePerson, toast, type Entry, type Person } from '../lib/store';
import { EmotionChip, EmotionPicker } from '../components/emotion';
import { IconSheet } from '../components/IconPicker';
import { Icon, NoteIcon } from '../components/icons';
import { initials } from '../components/people';
import { Sheet } from '../components/Sheet';
import { CheckInRow, NoteCard } from './Journal';
import { lastSeen, useMoments } from './People';

type Open = null | 'icon' | 'emotion';

function useAutosize(value: string) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = el.scrollHeight + 'px';
  }, [value]);
  return ref;
}

export function PersonView({ id }: { id: string }) {
  const [draft, setDraft] = useState<Person | null>(() => (id === 'new' ? blankPerson() : getPeople().find((p) => p.id === id) ?? null));
  const [open, setOpen] = useState<Open>(null);
  const [status, setStatus] = useState('');
  const saved = useRef(id !== 'new');
  const dirty = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const latest = useRef(draft);
  latest.current = draft;
  const nameRef = useAutosize(draft?.name ?? '');
  const textRef = useAutosize(draft?.text ?? '');
  const moments = useMoments().get(draft?.id ?? '') ?? [];

  const syncUrl = () => {
    const d = latest.current;
    if (saved.current && d && !history.state?.mmSheet && location.hash === '#/person/new') history.replaceState(history.state, '', '#/person/' + d.id);
  };

  const flush = () => {
    clearTimeout(timer.current);
    const d = latest.current;
    if (!d || !dirty.current) return;
    dirty.current = false;
    if (!saved.current && !d.name.trim()) return; // a person needs a name before they're kept
    savePerson({ ...d, name: d.name.trim() || d.name });
    saved.current = true;
    syncUrl();
    setStatus('Saved');
  };

  const update = (patch: Partial<Person>) => {
    setDraft((d) => (d ? { ...d, ...patch } : d));
    dirty.current = true;
    setStatus('');
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, 500);
  };

  useEffect(() => {
    const hide = () => document.visibilityState === 'hidden' && flush();
    document.addEventListener('visibilitychange', hide);
    addEventListener('popstate', syncUrl);
    if (id === 'new') nameRef.current?.focus();
    return () => {
      document.removeEventListener('visibilitychange', hide);
      removeEventListener('popstate', syncUrl);
      flush();
    };
  }, []);

  // How the moments with them felt: the worlds of every feeling logged in notes and check-ins they're tagged in.
  const felt = useMemo(() => {
    const worlds = new Map<string, number>();
    const feelings = new Map<string, number>();
    for (const e of moments)
      for (const eid of e.emotions) {
        const c = coreOf(eid).id;
        worlds.set(c, (worlds.get(c) ?? 0) + 1);
        feelings.set(eid, (feelings.get(eid) ?? 0) + 1);
      }
    const total = [...worlds.values()].reduce((a, b) => a + b, 0);
    return {
      total,
      worlds: [...worlds].sort((a, b) => b[1] - a[1]),
      top: [...feelings].sort((a, b) => b[1] - a[1]).slice(0, 5),
    };
  }, [moments]);

  const groups = useMemo(() => {
    const out: [string, Entry[]][] = [];
    for (const e of moments) {
      const last = out[out.length - 1];
      if (last && last[0] === e.date) last[1].push(e);
      else out.push([e.date, [e]]);
    }
    return out;
  }, [moments]);

  if (!draft)
    return (
      <div class="page">
        <div class="empty">
          <h2 class="title-s">This person isn’t here</h2>
          <p>They may have been deleted.</p>
          <button class="btn btn-primary" onClick={() => goBack('people')}>Back to people</button>
        </div>
      </div>
    );

  const remove = async () => {
    if (saved.current && !confirm(`Delete ${draft.name.trim() || 'this person'}? Notes they’re tagged in stay in your journal.`)) return;
    clearTimeout(timer.current);
    dirty.current = false;
    const removed = saved.current ? await deletePerson(draft.id) : null;
    goBack('people');
    if (removed) toast(`${removed.name || 'Person'} deleted`, { label: 'Undo', run: () => savePerson(removed) });
  };

  const addEmotion = (eid: string) => {
    const list = draft.emotions.filter((x) => x !== eid && !eid.startsWith(x + '/') && !x.startsWith(eid + '/'));
    update({ emotions: [...list, eid].slice(-MAX_PERSON_EMOTIONS) });
    setOpen(null);
  };

  /** Starts a note (or check-in) already tagged with them. They're saved first so the tag has someone to point to. */
  const write = (to: 'note' | 'tracker') => {
    if (!draft.name.trim()) return nameRef.current?.focus();
    if (!saved.current) dirty.current = true;
    flush();
    navigate(to === 'note' ? `note/new?person=${draft.id}` : `tracker?person=${draft.id}`);
  };

  const first = draft.name.trim().split(/\s+/)[0] || 'them';
  const main = draft.emotions[0] ? coreOf(draft.emotions[0]).id : null;

  return (
    <div class="page editor person">
      <div class="editor-bar">
        <button class="glass glass-btn round" onClick={() => { flush(); goBack('people'); }} aria-label="Back"><Icon name="arrow-left" /></button>
        <span class="editor-status" aria-live="polite">{status && <span class="glass">{status}</span>}</span>
        <button class="glass glass-btn round" onClick={remove} aria-label="Delete person"><Icon name="trash" /></button>
        <button class="glass glass-btn tinted" onClick={() => { flush(); goBack('people'); }}>Done</button>
      </div>

      <div class="editor-top">
        <button
          class={`icon-pick avatar-pick${main ? ' tinted' : ''}`}
          style={{ '--c': main ? `var(--emo-${main})` : undefined }}
          onClick={() => setOpen('icon')}
          aria-label={draft.icon ? 'Change icon' : 'Add icon'}
        >
          {draft.icon ? <NoteIcon id={draft.icon} size={28} /> : draft.name.trim() ? <span class="avatar-initials">{initials(draft.name)}</span> : <Icon name="user" size={24} />}
        </button>
        <div class="grow">
          <textarea
            ref={nameRef}
            class="title-input"
            rows={1}
            placeholder="Name"
            value={draft.name}
            maxLength={120}
            onInput={(e) => update({ name: e.currentTarget.value.replace(/\n/g, ' ') })}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), textRef.current?.focus())}
            aria-label="Name"
          />
          <input
            class="relation-input"
            placeholder="Who are they to you? Friend, sister, coworker…"
            value={draft.relation}
            maxLength={60}
            onInput={(e) => update({ relation: e.currentTarget.value })}
            aria-label="Relationship"
          />
        </div>
      </div>

      <div class="eyebrow person-label">How {first} makes you feel</div>
      <div class="meta person-meta">
        {draft.emotions.map((eid) => (
          <EmotionChip id={eid} onRemove={() => update({ emotions: draft.emotions.filter((x) => x !== eid) })} />
        ))}
        {draft.emotions.length < MAX_PERSON_EMOTIONS && (
          <button class="chip" onClick={() => setOpen('emotion')}>
            <Icon name="mood-plus" size={16} /> {draft.emotions.length ? 'Add' : 'Add a feeling'}
          </button>
        )}
      </div>
      {draft.emotions.length === 1 && EMOTION[draft.emotions[0]]?.depth === 2 && (
        <p class="definition">{EMOTION[draft.emotions[0]].def}</p>
      )}

      <textarea
        ref={textRef}
        class="body-input person-text"
        rows={3}
        placeholder={`What’s on your mind about ${first}? Memories, things they said, what they’re going through, what you want to remember…`}
        value={draft.text}
        onInput={(e) => update({ text: e.currentTarget.value })}
        aria-label={`About ${first}`}
      />

      <section class="section">
        <div class="row between">
          <h2 class="section-title">Moments with {first}</h2>
          {moments.length > 0 && <span class="muted small">{moments.length} · since {lastSeen(moments[moments.length - 1].date)}</span>}
        </div>
        <div class="row gap-s person-actions">
          <button class="btn btn-quiet grow" onClick={() => write('note')} disabled={!draft.name.trim()}><Icon name="pencil" size={18} /> Write about {first}</button>
          <button class="btn btn-quiet" onClick={() => write('tracker')} disabled={!draft.name.trim()}><Icon name="mood-smile" size={18} /> Check in</button>
        </div>

        {felt.total > 0 && (
          <div class="card person-felt">
            <div class="chart-title">How moments with {first} felt</div>
            <div class="split-bar" role="img" aria-label={felt.worlds.map(([c, n]) => `${shortName(c)} ${Math.round((n / felt.total) * 100)}%`).join(', ')}>
              {felt.worlds.map(([c, n]) => <i style={{ flex: n, background: `var(--emo-${c})` }} title={`${shortName(c)} · ${n}`} />)}
            </div>
            <div class="note-emos">
              {felt.top.map(([eid, n]) => (
                <span class="felt-item"><EmotionChip id={eid} size="sm" />{n > 1 && <span class="muted small">×{n}</span>}</span>
              ))}
            </div>
          </div>
        )}

        {groups.length ? (
          groups.map(([date, list]) => (
            <section class="day">
              <h3 class="day-label">{dayLabel(date)}</h3>
              <div class="entries">{list.map((e) => (e.kind === 'checkin' ? <CheckInRow e={e} /> : <NoteCard e={e} />))}</div>
            </section>
          ))
        ) : (
          <p class="empty-note">Tag {first} in a note or check-in and it shows up here.</p>
        )}
      </section>

      <IconSheet open={open === 'icon'} onClose={() => setOpen(null)} value={draft.icon} onChange={(icon) => update({ icon })} />
      <Sheet open={open === 'emotion'} onClose={() => setOpen(null)} title={`How does ${first} make you feel?`}>
        <EmotionPicker onPick={addEmotion} selected={draft.emotions} />
      </Sheet>
    </div>
  );
}
