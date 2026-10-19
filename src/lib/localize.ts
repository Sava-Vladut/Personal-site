// Puts a translation over a piece of English data. The translation mirrors the data's shape but holds only the text:
// whatever it leaves out (ids, numbers, anything not yet translated) keeps its English value.

export function localize<T>(base: T, ro: unknown): T {
  if (ro == null) return base;
  if (typeof base === 'string') return (typeof ro === 'string' && ro ? ro : base) as T;
  if (Array.isArray(base)) return (Array.isArray(ro) ? base.map((x, i) => localize(x, ro[i])) : base) as T;
  if (base && typeof base === 'object' && typeof ro === 'object') {
    const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
    for (const k in ro as object) if (k in out) out[k] = localize(out[k], (ro as Record<string, unknown>)[k]);
    return out as T;
  }
  return base;
}
