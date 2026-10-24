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
  return tr.setMeta(REPLACED, true).replace(start, endA, next.slice(start, endB));
}
