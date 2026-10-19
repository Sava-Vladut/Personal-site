// Mind traps and laws of power in a note, as links: [[trap:<id>|Name]] and [[law:<n>|Title]]. They come from the
// Insights pages' data (data/traps.ts, data/laws), which is big, so it's fetched only once something needs it: a [[
// being typed, or a note with one of these links in it. Until then a link shows the name it was written with.
import { useEffect, useState } from 'preact/hooks';
import { score, searchKey } from './mentions';

export type RefKind = 'trap' | 'law';

/** A trap or a law, as a link shows it. */
export interface Ref {
  kind: RefKind;
  /** a trap's id, a law's number */
  id: string;
  name: string;
  /** its family (a trap) or its realm (a law), and how strong it is */
  sub: string;
  /** the one-line hook */
  line: string;
  /** an emotion's id, for its colour (var(--emo-<hue>)) */
  hue: string;
  /** where its page opens it */
  to: string;
}

let refs: Ref[] | null = null;
let loading: Promise<Ref[]> | null = null;

/** Fetches the traps and the laws (once). */
export function loadRefs(): Promise<Ref[]> {
  loading ??= Promise.all([import('../data/traps'), import('../data/laws')]).then(([tr, lw]) => {
    const list: Ref[] = [
      ...tr.TRAPS.map((x): Ref => ({
        kind: 'trap', id: x.id, name: x.name, sub: tr.FAMILIES[x.family].name, line: x.line,
        hue: tr.FAMILIES[x.family].hue, to: `traps?open=${x.id}`,
      })),
      ...lw.LAWS.map((x): Ref => ({
        kind: 'law', id: String(x.n), name: x.title, sub: lw.REALMS[x.realm].name, line: x.line,
        hue: lw.REALMS[x.realm].hue, to: `laws?open=${x.n}`,
      })),
    ];
    refs = list;
    return list;
  }).catch((err) => {
    loading = null; // offline: tried again next time
    throw err;
  });
  return loading;
}

/** The traps and laws, once they're here (null until then); asks for them the first time. */
export function useRefs(load = true) {
  const [list, setList] = useState(refs);
  useEffect(() => {
    if (list || (!load && !loading)) return;
    let on = true;
    loadRefs().then((l) => on && setList(l), () => {});
    return () => void (on = false);
  }, [load, list]);
  return list ?? refs;
}

/** What a link's target points at: `trap:<id>` or `law:<n>`. */
export function refTarget(target: string | undefined): { kind: RefKind; id: string } | null {
  const m = target && /^(trap|law):(.+)$/.exec(target);
  return m ? { kind: m[1] as RefKind, id: m[2] } : null;
}

export const findRef = (list: Ref[] | null, kind: RefKind, id: string) => list?.find((r) => r.kind === kind && r.id === id);

export const refOf = (r: Ref) => `[[${r.kind}:${r.id}|${r.name.replace(/[\]|\n]/g, ' ')}]]`;

/** The traps and laws that match a [[query (none with nothing typed: the notes come first then). */
export function suggestRefs(q: string, list: Ref[] | null): [number, Ref][] {
  const needle = searchKey(q);
  if (!needle || !list) return [];
  const least = needle.length < 3 ? 2 : 1;
  const out: [number, Ref][] = [];
  for (const r of list) {
    const s = r.kind === 'law' ? score(needle, r.name, r.id, `law ${r.id}`) : score(needle, r.name);
    if (s >= least) out.push([s - 0.1, r]);
  }
  return out;
}
