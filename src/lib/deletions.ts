/** Keep the newest valid tombstone for each record, including dictionary-like ids from old backups. */
export function combineDeleted(a: Record<string, number>, b: unknown): Record<string, number> {
  const merged: Record<string, number> = Object.assign(Object.create(null), a);
  if (b && typeof b === 'object' && !Array.isArray(b))
    for (const [id, time] of Object.entries(b))
      if (id.length <= 40 && typeof time === 'number' && Number.isFinite(time) && time >= 0 && !(merged[id] >= time)) merged[id] = time;
  return merged;
}
