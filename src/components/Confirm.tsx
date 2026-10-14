import { useRef } from 'preact/hooks';
import { observable } from '../lib/store';
import { haptic } from '../lib/haptics';
import { Sheet } from './Sheet';
import { t } from '../lib/i18n';

/**
 * Asking before something that can't be undone: deleting everything, signing out, stopping a share. Anything that
 * can be undone doesn't ask; it happens at once and the toast offers Undo.
 */
interface Question {
  title: string;
  text?: string;
  /** the button that goes ahead, e.g. 'Delete' */
  ok: string;
  /** going ahead loses something: the button is red */
  danger?: boolean;
}
type Asked = Question & { answer: (yes: boolean) => void };

const asked$ = observable<Asked | null>(null);

/** Shows the question in a sheet; true once its button is pressed, false if it's closed any other way. */
export function ask(q: Question): Promise<boolean> {
  asked$.get()?.answer(false);
  return new Promise((resolve) => {
    const answer = (yes: boolean) => {
      if (asked$.get()?.answer !== answer) return;
      asked$.set(null);
      resolve(yes);
    };
    asked$.set({ ...q, answer });
  });
}

/** Mounted once, by the app. */
export function ConfirmLayer() {
  const asked = asked$.use();
  // the sheet slides away showing the question it had
  const last = useRef<Asked | null>(null);
  if (asked) last.current = asked;
  const q = last.current;
  return (
    <Sheet
      open={!!asked}
      onClose={() => asked?.answer(false)}
      label={q?.title}
      footer={q && (
        <>
          <button class="btn btn-quiet" onClick={() => asked?.answer(false)}>{t('Cancel')}</button>
          <button
            class={q.danger ? 'btn btn-danger' : 'btn btn-primary'}
            onClick={() => {
              if (q.danger) haptic(12);
              asked?.answer(true);
            }}
          >
            {q.ok}
          </button>
        </>
      )}
    >
      {q && (
        <div class="confirm-ask">
          <h2 class="title-s">{q.title}</h2>
          {q.text && <p>{q.text}</p>}
        </div>
      )}
    </Sheet>
  );
}
