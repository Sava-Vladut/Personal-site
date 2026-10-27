// Puts a whole new document in an editor as one small change: only the part between where the two first and last
// differ is replaced, so the caret and the rest of the note stay put (used for changes made outside the editor,
// like a picture moved with body.ts, or the text put back by a toast's Undo).
import type { Node as PMNode } from '@tiptap/pm/model';
import type { Transaction } from '@tiptap/pm/state';

/** Meta on replaceDoc's transactions: a whole text put in, kept as it's written (the numbering pass leaves it be). */
export const REPLACED = 'noteDocReplaced';

/** Changes `tr`'s document into `next` (same schema), replacing only what differs. Returns `tr`. */
export function replaceDoc(tr: Transaction, next: PMNode): Transaction {
  const cur = tr.doc;
  const start = cur.content.findDiffStart(next.content);
  if (start === null) return tr;
  let { a: endA, b: endB } = cur.content.findDiffEnd(next.content)!;
  // when the change repeats what's around it, both ends can pass the start: move them back after it
  const overlap = start - Math.min(endA, endB);
  if (overlap > 0) {
    endA += overlap;
    endB += overlap;
  }
  tr.setMeta(REPLACED, true).replace(start, endA, next.slice(start, endB));
  // fitting the slice in doesn't always give `next` exactly (a change running from one table's cells into another's):
  // the top-level blocks that still differ are then put in whole
  if (!tr.doc.eq(next)) replaceBlocks(tr, next);
  return tr;
}

/** Replaces the top-level blocks of `tr`'s document that differ from `next`'s. */
function replaceBlocks(tr: Transaction, next: PMNode): Transaction {
  const cur = tr.doc;
  let i = 0, from = 0;
  while (i < cur.childCount && i < next.childCount && cur.child(i).eq(next.child(i))) from += cur.child(i++).nodeSize;
  let a = cur.childCount, b = next.childCount, toA = cur.content.size, toB = next.content.size;
  while (a > i && b > i && cur.child(a - 1).eq(next.child(b - 1))) (toA -= cur.child(--a).nodeSize), (toB -= next.child(--b).nodeSize);
  return tr.replaceWith(from, toA, next.content.cut(from, toB));
}
