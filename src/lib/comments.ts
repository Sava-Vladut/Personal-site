// Comments: your own notes to yourself on a passage of a note, as Word's Review › New comment. They're private: the
// note's public copy, its link preview, the reading view, previews, word counts and exports never show them.
//
// In the text a comment is the passage in a plain <span>, then the comment itself in an HTML comment right after it:
//
//   I said <span class="comment">yes</span><!-- comment: did I mean it? --> and left.
//
// Obsidian, GitHub and other Markdown readers show the passage as it is (its Markdown inside still read) and hide the
// comment, so a note reads right outside the app and nothing private shows there. The span is never a line's only
// thing, so a line starting with one is never read as an HTML block. Matched strictly (lib/inline.ts): the passage is
// never empty and holds no other comment; the comment is one line, not starting or ending with a space, and written
// in one way only: % [ ] | < > ` * ~ = as %25 %5B %5D %7C %3C %3E %60 %2A %7E %3D, and a - followed by another as %2D
// (an HTML comment can't hold --). So a comment never ends early, never closes a style around it (*, ~~, ==, ]),
// never splits a table's row, and never reads as a link or a tag to anything that looks through a note's text for
// those. Anything else is the text it is.

/** The characters a comment writes as codes (a - only before another -). */
const CODES: Record<string, string> = {
  '%': '%25', '[': '%5B', ']': '%5D', '|': '%7C', '<': '%3C', '>': '%3E', '`': '%60', '*': '%2A', '~': '%7E', '=': '%3D',
};

/** A comment's words as written in the text. */
export const encodeComment = (s: string) => s.replace(/[%[\]|<>`*~=]/g, (c) => CODES[c]).replace(/-(?=-)/g, '%2D');
/** A comment's words from the text. */
export const decodeComment = (s: string) => s.replace(/%(25|5B|5D|7C|3C|3E|60|2A|7E|3D|2D)/g, (_, h: string) => String.fromCharCode(parseInt(h, 16)));
/** Words as a comment can hold them: one line (line breaks become spaces), no spaces at either end. */
export const cleanComment = (s: string) => s.replace(/\s*[\r\n\u2028\u2029]+\s*/g, ' ').trim();

/** A letter of a comment as written: exactly what encodeComment writes. */
const CT_CHAR = String.raw`(?:[^\s%[\]|<>\x60*~=-]|[^\S\n\r\u2028\u2029]|%(?:25|5B|5D|7C|3C|3E|60|2A|7E|3D)|%2D(?=-|%2D)|-(?!-|%2D))`;
/** A letter of the passage: an escaped one whole; never another comment's start, nor the end of this one. */
const CA_CHAR = String.raw`(?:(?!<span class="comment">|</span><!-- comment: )(?:\\[^\n]|[^\\\n]))`;

/** A comment, as lib/inline.ts reads it: the passage (`ca`) and the comment as written (`ct`). */
export const COMMENT_SOURCE =
  String.raw`<span class="comment">(?!</span>)(?<ca>${CA_CHAR}+?)</span><!-- comment: (?<ct>(?!\s)${CT_CHAR}+(?<!\s)) -->`;

/** The text of a comment's passage and the comment, as written. */
export const commentToken = (passage: string, text: string) => `<span class="comment">${passage}</span><!-- comment: ${encodeComment(text)} -->`;

const ALL = () => new RegExp(COMMENT_SOURCE, 'g');
/** Anything left that looks like a comment's hidden part (not in the strict form), for taking out to be safe. */
const LOOSE = /<!--\s*comment:[\s\S]*?-->/gi;

/**
 * A note's text without its comments: each passage stays, its comment goes. Whatever looks like one too (in code, not
 * written strictly): this is what keeps comments private, so it errs on the side of taking out.
 */
export function dropComments(text: string): string {
  if (!text.includes('<!--')) return text;
  return text.replace(ALL(), '$<ca>').replace(LOOSE, '');
}

/** The comments' words in a text (for the journal's search: your own words, found again). */
export function commentWords(text: string): string[] {
  if (!text.includes('<!-- comment: ')) return [];
  return [...text.matchAll(ALL())].map((m) => decodeComment(m.groups!.ct));
}
