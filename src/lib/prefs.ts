import { useState } from 'preact/hooks';

/** A piece of view state (a sort order, a filter, a tab) that survives reloads. `allowed` guards against stale or edited values. */
export function usePref<T extends string | boolean>(key: string, fallback: T, allowed?: readonly T[]) {
  const storageKey = 'mm-pref-' + key;
  const [value, set] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw !== null) {
        const v = (typeof fallback === 'boolean' ? raw === 'true' : raw) as T;
        if (!allowed || allowed.includes(v)) return v;
      }
    } catch {}
    return fallback;
  });
  const update = (v: T) => {
    set(v);
    try {
      localStorage.setItem(storageKey, String(v));
    } catch {}
  };
  return [value, update] as const;
}
