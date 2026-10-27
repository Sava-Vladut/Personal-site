// Word's AutoCorrect as it's typed: straight quotes become curly ones (opening or closing by what's before them, an
// apostrophe in a word closing), "--" an em dash (before a space, or between two words), "..." an ellipsis, (c) ©,
// (r) ®, (tm) ™, -> → and <- ←. Just Unicode characters in the text: the note reads back as it shows. As the block
// rules (rules.ts): the last character of the match is the one being typed, Backspace straight after takes the change
// back (undoInputRule), and nothing changes in code, in a `code span` still being typed, in a web address, or inside an
// HTML tag being typed.
import type { BlockRule } from './rules';

/** What's before a quote that makes it an opening one: nothing, a space, a bracket, a dash or another opening quote. */
const OPENS = /[\s([{<—–“‘]/;

/** Whether the text typed at [start, end) (`m` matched against the line before the caret) can be corrected. */
function plain(tr: Parameters<BlockRule['apply']>[0], m: RegExpMatchArray, end: number): boolean {
  const $e = tr.doc.resolve(end);
  if ($e.parent.type.spec.code || (tr.storedMarks ?? $e.marks()).some((x) => x.type.name === 'code')) return false;
  const before = m.input!.slice(0, m.index);
  // an open backtick: a `code span` being typed, not closed yet
  if ((before.match(/`/g)?.length ?? 0) % 2) return false;
  // nor in a web address, nor inside a tag being typed (<span style="color:red">)
  return !/(?:https?:\/\/|www\.)\S*$/i.test(before) && !/<\/?[a-z][^<>]*$/i.test(before);
}

/** A rule putting `to(match)` in place of what was typed. */
const swap = (name: string, find: RegExp, to: (m: RegExpMatchArray) => string): BlockRule => ({
  name,
  find,
  apply(tr, m, start, end) {
    if (!plain(tr, m, end)) return false;
    tr.insertText(to(m), start, end);
    return true;
  },
});

const SYMBOLS: Record<string, string> = { c: '©', r: '®', tm: '™' };

export const AUTOCORRECT: BlockRule[] = [
  swap('quote', /["']$/, (m) => {
    const prev = m.input![m.index! - 1];
    const open = prev === undefined || OPENS.test(prev);
    return m[0] === '"' ? (open ? '“' : '”') : open ? '‘' : '’';
  }),
  // never a third dash (a divider being typed, "---") nor an HTML comment's
  swap('dash', /(?:(?<![-!<])--( )|(?<=[\p{L}\p{N}])--([\p{L}\p{N}]))$/u, (m) => '—' + (m[1] ?? m[2])),
  swap('ellipsis', /\.\.\.$/, () => '…'),
  swap('symbol', /\((c|r|tm)\)$/i, (m) => SYMBOLS[m[1].toLowerCase()]),
  swap('arrow', /(?<![-<])->$/, () => '→'),
  swap('arrow-left', /<-$/, () => '←'),
];
