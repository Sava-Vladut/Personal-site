// How the note's blocks are drawn where ProseMirror's own drawing (the schema's renderHTML) isn't enough: a list item's
// task box ticks without moving the caret, chips are the app's own tags (people, songs, note and book links), and a
// picture is a slot the editor (views/Editor.tsx) fills with its MediaBlock through a portal.
import { h, render } from 'preact';
import type { Node as PMNode } from '@tiptap/pm/model';
import type { EditorView, NodeView, NodeViewConstructor } from '@tiptap/pm/view';
import { toggleTask } from '../lib/noteDoc/edit';
import { depthOf, type ListItemAttrs } from '../lib/noteDoc';
import type { Media } from '../lib/body';
import { PersonMention, SongMention, WikiLink } from '../components/mentions';
import { t } from '../lib/i18n';

/* ---------- list items ---------- */

/**
 * A bullet, a number or a task. A task's box is a real checkbox outside the text: a tap ticks it (in the reading view
 * too) and the caret stays where it was, the keyboard staying down.
 */
class ListItemView implements NodeView {
  dom: HTMLElement;
  contentDOM: HTMLElement;
  private box: HTMLElement;

  constructor(private node: PMNode, private view: EditorView, private getPos: () => number | undefined) {
    this.dom = document.createElement('div');
    this.contentDOM = document.createElement('span');
    this.contentDOM.className = 'md-li-text';
    this.box = this.makeBox();
    this.dom.append(this.box, this.contentDOM);
    this.draw();
  }

  private makeBox(): HTMLElement {
    const a = this.node.attrs as ListItemAttrs;
    if (a.kind !== 'task') {
      const s = document.createElement('span');
      s.className = 'md-marker';
      s.contentEditable = 'false';
      s.setAttribute('aria-hidden', 'true');
      return s;
    }
    const box = document.createElement('input');
    box.type = 'checkbox';
    box.contentEditable = 'false';
    // a tap ticks it without the caret moving or the keyboard coming up; a swipe that starts on it scrolls the note
    // and ticks nothing
    box.addEventListener('mousedown', (e) => e.preventDefault());
    let from: { x: number; y: number } | null = null;
    box.addEventListener('touchstart', (e) => {
      const t = e.touches[0];
      from = e.touches.length === 1 && t ? { x: t.clientX, y: t.clientY } : null;
    }, { passive: true });
    box.addEventListener('touchmove', (e) => {
      const t = e.touches[0];
      if (from && t && Math.hypot(t.clientX - from.x, t.clientY - from.y) > 10) from = null;
    }, { passive: true });
    box.addEventListener('touchcancel', () => void (from = null));
    box.addEventListener('touchend', (e) => {
      const t = e.changedTouches[0];
      const tap = !!from && !!t && Math.hypot(t.clientX - from.x, t.clientY - from.y) <= 10;
      from = null;
      if (!tap) return;
      // handled here, so no click follows and the focus stays where it was
      e.preventDefault();
      this.tick();
    });
    box.addEventListener('click', (e) => {
      e.preventDefault(); // drawn from the document, not the browser's own state
      this.tick();
    });
    return box;
  }

  private tick() {
    const pos = this.getPos();
    if (pos !== undefined) toggleTask(pos)(this.view.state, this.view.dispatch);
  }

  private draw() {
    // the browser may have taken the marker or box out (a phone's Backspace): it goes back in
    if (!this.dom.contains(this.box)) this.dom.prepend(this.box);
    const a = this.node.attrs as ListItemAttrs;
    const depth = depthOf(a.indent);
    this.dom.className = `md-li md-${a.kind}${a.kind === 'task' && a.checked ? ' is-done' : ''}`;
    if (depth) this.dom.style.setProperty('--depth', String(depth));
    else this.dom.style.removeProperty('--depth');
    if (this.box instanceof HTMLInputElement) {
      this.box.checked = a.checked;
      this.box.setAttribute('aria-label', a.checked ? t('Done') : t('To do'));
    } else this.box.textContent = a.kind === 'ol' ? a.num + '.' : '•';
  }

  update(node: PMNode) {
    if (node.type !== this.node.type || (node.attrs.kind === 'task') !== (this.node.attrs.kind === 'task')) return false;
    this.node = node;
    this.draw();
    return true;
  }

  stopEvent(e: Event) {
    return e.target === this.box;
  }

  ignoreMutation(m: MutationRecord | { type: 'selection'; target: Node }) {
    return m.type !== 'selection' && !this.contentDOM.contains(m.target);
  }
}

/* ---------- chips ---------- */

/** A tag in the text: the app's own chip (the same as in the reading view), one character to the caret. */
class ChipView implements NodeView {
  dom: HTMLElement;

  /** `quiet`: drawn after the note opened (typed, pasted, undone), so without the sheen the opening plays */
  constructor(private node: PMNode, quiet: boolean) {
    this.dom = document.createElement('span');
    this.dom.className = quiet ? 'note-chip is-quiet' : 'note-chip';
    this.dom.contentEditable = 'false';
    this.draw();
  }

  private draw() {
    const { target, label } = this.node.attrs as { target: string | null; label: string };
    const props = { target: target ?? undefined, text: label };
    const C = this.node.type.name === 'person' ? PersonMention : this.node.type.name === 'song' ? SongMention : WikiLink;
    render(h(C, props), this.dom);
  }

  update(node: PMNode) {
    if (node.type !== this.node.type) return false;
    const same = node.attrs.target === this.node.attrs.target && node.attrs.label === this.node.attrs.label;
    this.node = node;
    if (!same) this.draw();
    return true;
  }

  selectNode() { this.dom.classList.add('is-selected'); }
  deselectNode() { this.dom.classList.remove('is-selected'); }
  ignoreMutation() { return true; }
  // the chip's own button opens its peek; ProseMirror still gets the press, to select it
  stopEvent(e: Event) { return e.type === 'click'; }
  destroy() { render(null, this.dom); }
}

/* ---------- pictures ---------- */

/**
 * A picture's slot in the note: where it is (when the list was last told), what it is, and the element its
 * MediaBlock goes in.
 */
export interface MediaSlot {
  dom: HTMLElement;
  pos: number;
  media: Media;
}

/**
 * The slots the editor's pictures fill, told to `onChange` when they come, go, change or swap places — not when typing
 * only moves them along, which would draw the whole page again on every key.
 */
export class MediaSlots {
  private views = new Set<MediaView>();
  private frame = 0;
  private told: MediaSlot[] | null = null;
  constructor(private onChange: (slots: MediaSlot[]) => void) {}

  add(v: MediaView) { this.views.add(v); this.changed(); }
  remove(v: MediaView) { this.views.delete(v); this.changed(); }

  /** After any change to the document, at most once a frame. */
  changed() {
    cancelAnimationFrame(this.frame);
    this.frame = requestAnimationFrame(() => {
      const next = this.list();
      const was = this.told;
      if (was && was.length === next.length && was.every((s, i) => s.dom === next[i].dom && s.media === next[i].media)) return;
      this.told = next;
      this.onChange(next);
    });
  }

  /** Tells the slots now (the first time, before the page paints, so the pictures come with the words). */
  flush() {
    cancelAnimationFrame(this.frame);
    this.told = this.list();
    this.onChange(this.told);
  }

  /** Now, without waiting for a frame. */
  list(): MediaSlot[] {
    const out: MediaSlot[] = [];
    for (const v of this.views) {
      const pos = v.getPos();
      if (pos !== undefined) out.push({ dom: v.dom, pos, media: v.node.attrs.media });
    }
    return out.sort((a, b) => a.pos - b.pos);
  }

  destroy() { cancelAnimationFrame(this.frame); }
}

/**
 * A picture: an empty box ProseMirror leaves alone, its MediaBlock rendered into it by the editor. It makes no block
 * formatting context of its own, so a picture floated to a side has the paragraphs after it wrap around it.
 */
export class MediaView implements NodeView {
  dom: HTMLElement;

  constructor(public node: PMNode, public getPos: () => number | undefined, private slots: MediaSlots) {
    this.dom = document.createElement('div');
    this.dom.className = 'media-node';
    this.dom.contentEditable = 'false';
    slots.add(this);
  }

  update(node: PMNode) {
    if (node.type !== this.node.type) return false;
    this.node = node;
    this.slots.changed();
    return true;
  }

  stopEvent() { return true; }
  ignoreMutation() { return true; }
  destroy() { this.slots.remove(this); }
}

/** The node views, for EditorView's nodeViews prop. `settled`: the note has opened (its tags' sheen has played). */
export function nodeViews(slots: MediaSlots, settled: () => boolean = () => false): Record<string, NodeViewConstructor> {
  const chip: NodeViewConstructor = (node) => new ChipView(node, settled());
  return {
    listItem: (node, view, getPos) => new ListItemView(node, view, getPos),
    person: chip,
    song: chip,
    wiki: chip,
    media: (node, _view, getPos) => new MediaView(node, getPos, slots),
  };
}
