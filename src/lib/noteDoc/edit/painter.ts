// The Format Painter, as in Word: its button copies the styles at the caret (or of the selection), and the next words
// selected take exactly those. Clicked once it paints once; double-clicked it stays on until Esc (or its button again).
// What it holds lives in the editor's state (painterPlugin); when to paint is the editor's (src/editor/plugins.ts:
// when the mouse lets go of a selection, or Shift of one made with the keys).
import type { Mark } from '@tiptap/pm/model';
import { Plugin, PluginKey, type Command, type EditorState } from '@tiptap/pm/state';
import { copyMarks, paintMarks } from './marks';

export interface Painter {
  /** the styles it paints */
  marks: readonly Mark[];
  /** stays on after painting (a double click) */
  sticky: boolean;
}

export const painterKey = new PluginKey<Painter | null>('painter');

/** Holds the Format Painter's styles while it's on. */
export const painterPlugin = () =>
  new Plugin<Painter | null>({
    key: painterKey,
    state: {
      init: () => null,
      apply: (tr, was) => {
        const set = tr.getMeta(painterKey);
        return set === undefined ? was : set;
      },
    },
  });

/** The Format Painter, when it's on. */
export const painterOf = (state: EditorState): Painter | null => painterKey.getState(state) ?? null;

/**
 * The Format Painter's button: on with the styles at the caret or of the selection (`sticky`: until Esc), or off when
 * it's on already and clicked once more. False without the plugin.
 */
export const togglePainter = (sticky: boolean): Command => (state, dispatch) => {
  if (!painterKey.get(state)) return false;
  const on = painterOf(state);
  dispatch?.(state.tr.setMeta(painterKey, on && !sticky ? null : { marks: copyMarks(state), sticky }));
  return true;
};

/** Puts the Format Painter away (Esc). False when it isn't on. */
export const stopPainter: Command = (state, dispatch) => {
  if (!painterOf(state)) return false;
  dispatch?.(state.tr.setMeta(painterKey, null));
  return true;
};

/** Paints the selection (or the word at the caret) with the Format Painter's styles; then it's off unless sticky. */
export const paint: Command = (state, dispatch) => {
  const p = painterOf(state);
  if (!p) return false;
  let tr = state.tr;
  const done = paintMarks(p.marks)(state, (t) => (tr = t));
  if (!p.sticky) tr.setMeta(painterKey, null);
  dispatch?.(tr.scrollIntoView());
  return done;
};
