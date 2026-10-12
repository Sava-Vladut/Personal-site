// Remembers the newest sign-in of each Spotify / GitHub account, sealed with the session key, in data/.
// Every device keeps its own cookie, but a device whose token was revoked or lost (GitHub keeps only an
// account's ten newest tokens; Spotify can rotate refresh tokens) can carry on with the newest one instead.
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const MAX_ACCOUNTS = 200;

export function createAccountStore({ file, seal, unseal }) {
  let all = Object.create(null);
  try {
    if (file && existsSync(file)) Object.assign(all, unseal(readFileSync(file, 'utf8').trim()) || {});
  } catch (e) {
    console.error('Could not read saved sign-ins:', e.message);
  }

  const save = () => {
    if (!file) return;
    try {
      mkdirSync(dirname(file), { recursive: true });
      writeFileSync(file + '.tmp', seal(all), { mode: 0o600 });
      renameSync(file + '.tmp', file);
    } catch (e) {
      console.error('Could not save sign-ins:', e.message);
    }
  };
  const key = (service, user) => `${service}:${user}`;

  return {
    get: (service, user) => (user ? all[key(service, user)] ?? null : null),
    set(service, user, value) {
      if (!user) return;
      const k = key(service, user);
      if (JSON.stringify(all[k]) === JSON.stringify(value)) return;
      delete all[k]; // re-inserted last, so the oldest account is the first one dropped
      all[k] = value;
      const keys = Object.keys(all);
      for (let i = 0; i < keys.length - MAX_ACCOUNTS; i++) delete all[keys[i]];
      save();
    },
    /** Forgets an account's sign-in, but only if it's still the one `stale` says it is. */
    forget(service, user, stale) {
      const k = key(service, user);
      if (!user || !all[k] || (stale && !stale(all[k]))) return;
      delete all[k];
      save();
    },
  };
}
