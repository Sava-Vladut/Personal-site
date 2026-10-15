// Undo and redo for a note's text. The browser's own undo can't be trusted with it: the text is laid out again as
// it's typed (lib/editable.ts), which the browser's undo doesn't know about. So each text block keeps its own: the
// text before each step, and where the selection was. Typing groups into steps the way word processors do it — a
// word at a time, with the space after it — until the caret moves elsewhere or you pause; deleting groups the same
// way. Anything else (a toolbar command, a paste, a list carried on to the next line) is a step of its own.

/** A block's text, and its selection. */
export interface Snap { text: string; start: number; end: number }

/** What a change was: letters typed, typing that ends a word (a space), letters deleted, or anything else. */
export type Kind = 'type' | 'space' | 'delete' | 'other';

/** How long a pause in typing ends a step, in milliseconds. */
const PAUSE = 1000;
const MAX = 300;

export class History {
  private undos: Snap[] = [];
  private redos: Snap[] = [];
  /** The text as it was last seen, with the selection the next change starts from. */
  private cur: Snap | null = null;
  /** The kind of the last step, while more typing (or deleting) can still join it. */
  private open: 'type' | 'delete' | null = null;
  private at = 0;

  /** Before a change: where it starts from. A text that changed without the history seeing it is a step of its own. */
  before(s: Snap) {
    const cur = this.cur;
    if (cur && cur.text !== s.text) {
      this.push(cur);
      this.open = null;
    } else if (cur && (cur.start !== s.start || cur.end !== s.end)) this.open = null; // the caret moved: a new step
    this.cur = s;
  }

  /** After a change: the text it made, and what kind of change it was. */
  after(s: Snap, kind: Kind, now = Date.now()) {
    const cur = this.cur;
    if (!cur || cur.text === s.text) {
      this.cur = s;
      return;
    }
    const grow = this.open !== null && now - this.at < PAUSE
      && (kind === 'delete' ? this.open === 'delete' : (kind === 'type' || kind === 'space') && this.open === 'type');
    if (!grow) this.push(cur);
    this.cur = s;
    this.at = now;
    this.open = kind === 'type' ? 'type' : kind === 'delete' ? 'delete' : null;
  }

  /** Ends the step being typed, so whatever comes next is a step of its own. */
  cut() {
    this.open = null;
  }

  /** The text (and selection) to go back to, or null when there's nothing to undo. `now` is how it is at the moment. */
  undo(now: Snap) {
    this.before(now);
    const s = this.undos.pop();
    if (!s) return null;
    this.redos.push(this.cur!);
    return this.land(s);
  }

  /** The text to go forward to again, or null. Once the text has changed since an undo, there's nothing to redo. */
  redo(now: Snap) {
    if (this.cur && this.cur.text !== now.text) {
      this.before(now);
      return null;
    }
    const s = this.redos.pop();
    if (!s) return null;
    this.undos.push({ ...now, start: this.cur?.start ?? now.start, end: this.cur?.end ?? now.end });
    return this.land(s);
  }

  get canUndo() {
    return this.undos.length > 0;
  }
  get canRedo() {
    return this.redos.length > 0;
  }

  private land(s: Snap) {
    this.cur = s;
    this.open = null;
    return s;
  }

  private push(s: Snap) {
    this.undos.push(s);
    if (this.undos.length > MAX) this.undos.shift();
    this.redos = [];
  }
}
