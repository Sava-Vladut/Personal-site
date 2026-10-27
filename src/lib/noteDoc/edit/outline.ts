// The note's outline, for the Navigation pane (View › Navigation pane): its headings in order, by level, and the one the
// caret is under.
import type { Node as PMNode } from '@tiptap/pm/model';

export interface Heading {
  /** 1 to 6 */
  level: number;
  /** its words (a tag as its name) */
  text: string;
  /** the position just before it */
  pos: number;
}

/** Every heading of the note with words in it, top to bottom (in a quote or callout too). */
export function headingsOf(doc: PMNode): Heading[] {
  const out: Heading[] = [];
  doc.descendants((node, pos) => {
    if (node.type.name === 'heading') {
      const text = node.textBetween(0, node.content.size, ' ', (leaf) => (typeof leaf.attrs.label === 'string' && leaf.type.name !== 'footnoteRef' ? leaf.attrs.label : '')).replace(/\s+/g, ' ').trim();
      if (text) out.push({ level: node.attrs.level, text, pos });
      return false;
    }
    return !node.isTextblock;
  });
  return out;
}

/** Which of `headings` the caret at `pos` is under (the last one starting before it), or -1 above the first. */
export function headingAt(headings: Heading[], pos: number): number {
  let at = -1;
  for (let i = 0; i < headings.length && headings[i].pos < pos; i++) at = i;
  return at;
}
