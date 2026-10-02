// A plain text box that knows about tags, for the words outside notes: what a person, a book or a song means to you,
// and a check-in's context. Typing @ brings up the same suggestions as in a note, riding on the keyboard; picking one
// writes the tag. Once you're done writing, the words show formatted, the tags as chips that open their little cards.
import { flushSync } from 'preact/compat';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { mentionOf } from '../lib/books';
import { mentionOfPerson, mentionOfSong, mentionsIn, suggest, typedMention, type Suggestion } from '../lib/mentions';
import { blankPerson, getBooks, getPeople, getSongs, savePerson, toast, useBooks, useEntries, usePeople, useSongs, type Person } from '../lib/store';
import { FormatBar } from './FormatBar';
import { Markdown } from './Markdown';
import { MentionStrip } from './mentions';

const nameKey = (name: string) => name.trim().normalize('NFC').toLowerCase();

function fit(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
}

let count = 0;

export function MentionText({ value, onChange, onPerson, class: cls, placeholder, label, rows = 3, autosize = true, inputRef }: {
  value: string;
  onChange: (v: string) => void;
  /** someone was tagged (or added to People by tagging them) */
  onPerson?: (p: Person) => void;
  class?: string;
  placeholder?: string;
  label: string;
  rows?: number;
  autosize?: boolean;
  inputRef?: { current: HTMLTextAreaElement | null };
}) {
  const ref = useRef<HTMLTextAreaElement | null>(null);
  const [focused, setFocused] = useState(false);
  const [writing, setWriting] = useState(false);
  const [mention, setMention] = useState<{ start: number; end: number; q: string } | null>(null);
  const [pickAt, setPickAt] = useState(0);
  const dismissed = useRef(-1); // where the @ Escape put away is
  const picking = useRef(false);
  const listId = useRef(`mention-list-${++count}`).current;
  const people = usePeople();
  const books = useBooks();
  const songs = useSongs();
  const entries = useEntries();

  const reading = !focused && !writing && mentionsIn(value, people, books, songs).length > 0;

  useLayoutEffect(() => { if (autosize) fit(ref.current); }, [value, reading, autosize]);
  useEffect(() => {
    if (!autosize) return;
    const on = () => fit(ref.current);
    addEventListener('resize', on);
    return () => removeEventListener('resize', on);
  }, [autosize]);
  useEffect(() => setPickAt(0), [mention?.start, mention?.q]);

  const readCaret = () => {
    const el = ref.current;
    if (!el || document.activeElement !== el || el.selectionStart !== el.selectionEnd) return setMention(null);
    const m = typedMention(el.value, el.selectionStart);
    if (!m || dismissed.current === m.start) {
      if (!m) dismissed.current = -1;
      return setMention(null);
    }
    setMention((cur) => (cur && cur.start === m.start && cur.end === m.end && cur.q === m.q ? cur : m));
  };

  const found = mention ? suggest(mention.q, people, books, songs, entries) : [];
  const canAdd = !!mention && mention.q.trim().length > 1 && !people.some((p) => nameKey(p.name) === nameKey(mention.q));
  const choices = found.length + (canAdd ? 1 : 0);
  const active = Math.min(pickAt, Math.max(0, choices - 1));

  /** Swaps the typed @query for the tag. */
  const pick = async (s: Suggestion | 'new') => {
    const m = mention, el = ref.current;
    if (!m || !el || picking.current) return;
    const source = el.value;
    if (source.slice(m.start, m.end) !== '@' + m.q) return setMention(null);
    el.focus({ preventScroll: true });
    let person: Person | null = null;
    let token: string;
    if (s === 'new') {
      if (!canAdd) return;
      person = getPeople().find((p) => nameKey(p.name) === nameKey(m.q)) ?? null;
      if (!person) {
        picking.current = true;
        try {
          person = await savePerson(blankPerson(m.q.trim()));
          toast(`${person.name} added to People`);
        } catch {
          toast('Couldn’t save this person. Try again.');
          return;
        } finally {
          picking.current = false;
        }
      }
      token = mentionOfPerson(person, getPeople());
    } else if (s.kind === 'person') {
      person = getPeople().find((p) => p.id === s.item.id) ?? null;
      if (!person) return setMention(null);
      token = mentionOfPerson(person, getPeople());
    } else if (s.kind === 'book') {
      const b = getBooks().find((x) => x.id === s.item.id);
      if (!b) return setMention(null);
      token = mentionOf(b, getBooks());
    } else {
      const song = getSongs().find((x) => x.id === s.item.id);
      if (!song) return setMention(null);
      token = mentionOfSong(song, getSongs());
    }
    if (!el.isConnected || el.value !== source) return;
    const after = source.slice(m.end);
    const insert = token + (/^\s/.test(after) ? '' : ' ');
    el.value = source.slice(0, m.start) + insert + after;
    el.setSelectionRange(m.start + insert.length, m.start + insert.length);
    onChange(el.value);
    if (person) onPerson?.(person);
    setMention(null);
  };

  const key = (e: KeyboardEvent) => {
    if (e.isComposing || e.keyCode === 229) return;
    const el = e.currentTarget as HTMLTextAreaElement;
    if (!mention) {
      // A full stop, comma… typed just after a tag takes the place of the space the tag came with.
      const at = el.selectionStart;
      if (!/^[.,!?;:)]$/.test(e.key) || e.metaKey || e.ctrlKey || e.altKey || at !== el.selectionEnd) return;
      if (!/(@\[[^\]\n]+\]|♪\[[^\]\n]+\]|\]\]) $/.test(el.value.slice(0, at))) return;
      e.preventDefault();
      el.setRangeText(e.key, at - 1, at);
      el.setSelectionRange(at, at);
      onChange(el.value);
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      dismissed.current = mention.start;
      setMention(null);
    } else if (choices && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
      e.preventDefault();
      setPickAt((i) => (i + (e.key === 'ArrowDown' ? 1 : -1) + choices) % choices);
    } else if (choices && (e.key === 'Enter' || e.key === 'Tab')) {
      e.preventDefault();
      pick(active < found.length ? found[active] : 'new');
    }
  };

  /** A tap on the formatted words starts writing, at the end. Tags, links and ticks keep their own taps. */
  const write = (e: MouseEvent) => {
    if ((e.target as Element).closest('a, input, button') || !getSelection()?.isCollapsed) return;
    const el = ref.current;
    if (!el) return;
    flushSync(() => setWriting(true)); // shown first: iOS won't bring the keyboard up for a hidden box
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
  };

  return (
    <>
      {reading && (
        <div class={`${cls ?? ''} mention-read`} onClick={write}>
          <Markdown text={value} />
        </div>
      )}
      <textarea
        ref={(el) => { ref.current = el; if (inputRef) inputRef.current = el; }}
        class={`${cls ?? ''}${reading ? ' is-tucked-away' : ''}`}
        rows={rows}
        placeholder={placeholder}
        value={value}
        aria-label={label}
        aria-autocomplete="list"
        aria-controls={mention ? listId : undefined}
        aria-expanded={!!mention}
        aria-activedescendant={mention && choices ? `${listId}-option-${active}` : undefined}
        onInput={(e) => { onChange(e.currentTarget.value); readCaret(); }}
        onKeyDown={key}
        onKeyUp={(e) => !['Enter', 'Tab', 'Escape', 'ArrowUp', 'ArrowDown'].includes(e.key) && readCaret()}
        onClick={readCaret}
        onSelect={readCaret}
        onCompositionStart={() => setMention(null)}
        onCompositionEnd={readCaret}
        onFocus={() => setFocused(true)}
        onBlur={() => { setFocused(false); setWriting(false); setMention(null); }}
      />
      {mention && (
        <FormatBar
          target={() => null}
          format={false}
          swapLabel="Tag someone, a book or music"
          swap={<MentionStrip items={found} active={active} q={mention.q} canAdd={canAdd} onPick={pick} onAdd={() => pick('new')} listId={listId} />}
        />
      )}
    </>
  );
}

