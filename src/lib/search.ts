// The journal's search: what it looks through in each note, and getting that ready before the first key is typed.
import { EMOTION } from '../data/emotions';
import { pictureWords, plainText } from './body';
import { commentWords } from './comments';
import { dropTags } from './inline';
import type { Entry } from './store';

/** The id part of a tag or link (`note:<id>|`), which search shouldn't match. */
const TAG_ID = /(\[\[|@\[|♪\[)(?:note|book|person|song|trap|law):[^\]|\n]+\|/g;

/** What search looks through in a note (what your comments on it say too: your own words), worked out once per version
 * of it (a saved note is a new object), so typing a search doesn't re-read every note's text on every key. */
const searchText = new WeakMap<Entry, string>();
export function haystack(e: Entry) {
  let s = searchText.get(e);
  if (s === undefined) {
    s = `${e.title} ${dropTags(plainText(e.text)).replace(TAG_ID, '$1')} ${commentWords(e.text).join(' ')} ${pictureWords(e.text)} ${e.emotions.map((id) => EMOTION[id]?.name).join(' ')} ${e.music.map((m) => `${m.title} ${m.sub ?? ''}`).join(' ')} ${e.place?.name ?? ''}`.toLowerCase();
    searchText.set(e, s);
  }
  return s;
}

/** How long one go at reading notes ahead may hold the page, in ms: well under a frame, so typing and the search bar's
 * unfolding never wait on it. */
const SLICE = 5;

/**
 * Reads every note for search while the search bar opens, a few at a time between frames: with a long journal, reading
 * them all at the first key held that key up for a moment. Anything typed sooner just reads the rest then, as before.
 * Returns how to stop.
 */
export function warmSearch(list: Entry[]): () => void {
  let i = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const step = () => {
    const until = performance.now() + SLICE;
    while (i < list.length && performance.now() < until) haystack(list[i++]);
    if (i < list.length) timer = setTimeout(step, 0);
  };
  timer = setTimeout(step, 0);
  return () => clearTimeout(timer);
}
