import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { Icon } from './icons';
import { Sheet } from './Sheet';
import { t } from '../lib/i18n';
import { setDocView, useDocView } from '../lib/docView';
import type { Comments, NoteBodyHandle } from '../editor/NoteBody';

const EMPTY: Comments = { list: [], draft: null, focus: null, current: null };
/** The room between two boxes in the margin. */
const GAP = 8;

/** A comment's box: one being written (a draft, `text` ''), or one there already. */
interface Item { at: number; text: string; draft: boolean }

/** The note's comments as the pane shows them: each, and the draft, in the order of their words. */
function itemsOf(c: Comments): Item[] {
  const out: Item[] = c.list.map((x) => ({ at: x.from, text: x.text, draft: false }));
  if (c.draft) out.push({ at: c.draft.from, text: '', draft: true });
  return out.sort((a, b) => a.at - b.at);
}

/** A textarea as tall as its words. */
const fit = (el: HTMLTextAreaElement | null) => {
  if (!el) return;
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
};

/**
 * One comment's box in the margin: what it says, written in place. Esc, Enter or a click away saves it; saying
 * nothing, it goes (a draft too). A click on it selects its words in the note and lights them.
 */
function Card({ item, note, current, lit, reading, onSize }: {
  item: Item;
  note: NoteBodyHandle;
  /** the caret is on its words */
  current: boolean;
  /** its box has the focus, or its words were gone to */
  lit: boolean;
  reading: boolean;
  onSize: () => void;
}) {
  const [text, setText] = useState(item.text);
  const ref = useRef<HTMLTextAreaElement>(null);
  const editing = useRef(false);
  // what it says changed from elsewhere (undo, another device): shown, unless it's being written
  useEffect(() => {
    if (!editing.current) setText(item.text);
  }, [item.text]);
  useLayoutEffect(() => {
    fit(ref.current);
    onSize();
  }, [text]);
  // a new comment: its box takes the focus, as in Word
  useEffect(() => {
    if (item.draft) ref.current?.focus();
  }, []);

  const save = () => {
    editing.current = false;
    note.comments.save(item.at, text);
    note.comments.focus(null);
  };
  return (
    <div
      class={`cm-card${item.draft ? ' is-draft' : ''}${current ? ' is-current' : ''}${lit ? ' is-active' : ''}`}
      data-at={item.at}
      onClick={(e) => !item.draft && !(e.target as Element).closest('button') && note.comments.select(item.at)}
    >
      <textarea
        ref={ref}
        class="cm-text"
        rows={1}
        maxLength={2000}
        value={text}
        readOnly={reading}
        placeholder={t('Write a comment')}
        aria-label={t('Comment')}
        onFocus={() => {
          editing.current = !reading;
          if (!item.draft) note.comments.select(item.at);
          else note.comments.focus(null);
        }}
        onInput={(e) => setText(e.currentTarget.value)}
        onBlur={() => !reading && save()}
        onKeyDown={(e) => {
          // Esc or Enter: done, back to the words (a comment is one line, as the note writes it)
          if ((e.key === 'Escape' || e.key === 'Enter') && !e.isComposing) {
            e.preventDefault();
            e.stopPropagation();
            ref.current?.blur();
            note.focus();
          }
        }}
      />
      {!reading && (
        <button
          type="button"
          class="format-btn cm-del"
          aria-label={t('Delete comment')}
          title={t('Delete comment')}
          // (pressed, the box keeps the focus until the click: what's written is saved first, then it goes)
          onClick={() => note.comments.remove(item.at)}
        >
          <Icon name="x" size={14} />
        </button>
      )}
    </div>
  );
}

/**
 * Review's comments, as Word shows them: on a computer, a column in the margin right of the page, each comment's box
 * level with its words (pushed down below the one before when they'd overlap); on a phone, a sheet that opens with a
 * tap on a comment's words (or for a new one). Hidden with Review › Show comments off (and in print). Comments are
 * private: only this shows what they say (lib/comments.ts).
 */
export function CommentsPane({ note, wide, reading, open, onOpen }: {
  note: NoteBodyHandle | null;
  wide: boolean;
  reading: boolean;
  /** on a phone: the comment whose sheet is open (where its words start), or null */
  open: number | null;
  onOpen: (at: number | null) => void;
}) {
  const [c, setC] = useState<Comments>(EMPTY);
  const view = useDocView();
  const box = useRef<HTMLElement>(null);
  useEffect(() => (note ? note.comments.watch(setC) : undefined), [note]);

  // a new comment shows, Show comments off or not; on a phone its sheet opens
  const draftAt = c.draft?.from ?? null;
  useEffect(() => {
    if (draftAt === null) return;
    if (!view.comments) setDocView({ comments: true });
    if (!wide) onOpen(draftAt);
  }, [draftAt]);

  /** Each box level with its words, or just below the one before it. */
  const layout = () => {
    const el = box.current;
    if (!el || !note) return;
    const base = el.getBoundingClientRect().top;
    let floor = 0;
    for (const card of el.querySelectorAll<HTMLElement>('.cm-card')) {
      const r = note.comments.coords(Number(card.dataset.at));
      const top = Math.max(r ? Math.round(r.top - base) : floor, floor);
      card.style.top = top + 'px';
      floor = top + card.offsetHeight + GAP;
    }
  };
  const items = itemsOf(c);
  const shown = wide && view.comments && items.length > 0 && !!note;
  useLayoutEffect(() => {
    if (shown) layout();
  });
  // the words move without the comments changing: a picture loading, the window or the zoom changing
  useEffect(() => {
    if (!shown || !note) return;
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => layout()) : null;
    ro?.observe(note.view.dom);
    addEventListener('resize', layout);
    return () => {
      ro?.disconnect();
      removeEventListener('resize', layout);
    };
  }, [shown, note]);

  if (!note) return null;
  if (!wide) return <CommentSheet note={note} c={c} at={open} reading={reading} onClose={() => onOpen(null)} />;
  if (!shown) return null;
  return (
    <aside ref={box} class="cm-pane" aria-label={t('Comments')}>
      {items.map((it) => (
        <Card
          key={(it.draft ? 'd' : 'c') + it.at}
          item={it}
          note={note}
          current={c.current === it.at}
          lit={c.focus === it.at}
          reading={reading}
          onSize={layout}
        />
      ))}
    </aside>
  );
}

/** A phone's comment: its words quoted, what it says to write in; Done (or closing it) saves, Delete takes it off. */
function CommentSheet({ note, c, at, reading, onClose }: { note: NoteBodyHandle; c: Comments; at: number | null; reading: boolean; onClose: () => void }) {
  const draft = !!c.draft && c.draft.from === at;
  const found = at === null ? null : c.list.find((x) => x.from === at) ?? null;
  const range = draft ? c.draft : found;
  const [text, setText] = useState('');
  const kept = useRef<number | null>(null);
  useEffect(() => {
    if (at !== kept.current) setText(found?.text ?? '');
    kept.current = at;
  }, [at, found?.text]);
  const open = at !== null && !!range;
  const done = () => {
    if (at !== null && !reading) note.comments.save(at, text);
    onClose();
  };
  return (
    <Sheet
      open={open}
      onClose={done}
      title={t('Comment')}
      footer={!reading && (
        <div class="row gap-s">
          {found && (
            <button class="btn btn-quiet danger" onClick={() => (at !== null && note.comments.remove(at), onClose())}>
              <Icon name="trash" size={18} /> {t('Delete')}
            </button>
          )}
          <button class="btn btn-primary grow" onClick={done}>{t('Done')}</button>
        </div>
      )}
    >
      <div class="link-form">
        {range && <blockquote class="cm-quote">{note.comments.words(range.from, range.to)}</blockquote>}
        <textarea
          class="input"
          rows={3}
          maxLength={2000}
          value={text}
          readOnly={reading}
          placeholder={t('Write a comment')}
          aria-label={t('Comment')}
          onInput={(e) => setText(e.currentTarget.value)}
          onKeyDown={(e) => e.key === 'Enter' && !e.isComposing && (e.preventDefault(), done())}
          autoFocus={!reading}
        />
      </div>
    </Sheet>
  );
}
