import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { cp, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';

// Isolated, tiny Node fixtures: never launch Vite or the real API server.
for (const failure of [false, true]) {
  test(failure ? 'a failed dev child stops its sibling and preserves its exit code' : 'dev shutdown waits for child cleanup', { timeout: 15_000, skip: process.platform === 'win32' }, async (t) => {
    const directory = await mkdtemp(join(tmpdir(), 'personal-site-dev-'));
    let child;
    t.after(async () => {
      // A separate process group bounds cleanup even when an assertion fails.
      if (child?.pid) {
        try { process.kill(-child.pid, 'SIGKILL'); }
        catch (error) { if (error.code !== 'ESRCH') throw error; }
        if (child.exitCode === null && child.signalCode === null) await once(child, 'exit');
      }
      await rm(directory, { recursive: true, force: true });
    });
    await mkdir(join(directory, 'scripts'));
    await mkdir(join(directory, 'server'));
    await mkdir(join(directory, 'node_modules', 'vite', 'bin'), { recursive: true });
    await cp(new URL('./dev.mjs', import.meta.url), join(directory, 'scripts', 'dev.mjs'));
    for (const [name, file] of [['server', 'server/index.js'], ['vite', 'node_modules/vite/bin/vite.js']]) {
      await writeFile(join(directory, file), `
        console.log('${name} ready', process.pid);
        process.on('SIGTERM', () => setTimeout(() => {
          console.log('${name} stopped');
          process.exit(0);
        }, 80));
        process.on('SIGUSR2', () => process.exit(7));
        setInterval(() => {}, 1000);
      `);
    }
    child = spawn(process.execPath, ['scripts/dev.mjs'], { cwd: directory, detached: true, stdio: ['ignore', 'pipe', 'pipe'] });
    let output = '';
    let errors = '';
    child.stdout.on('data', (chunk) => { output += chunk; });
    child.stderr.on('data', (chunk) => { errors += chunk; });
    const exited = once(child, 'exit');
    while (!/server ready \d+/.test(output) || !/vite ready \d+/.test(output)) {
      await Promise.race([
        once(child.stdout, 'data'),
        exited.then(([code]) => { throw new Error(`Dev process exited before readiness (${code}): ${errors}`); }),
      ]);
    }
    const serverPid = Number(output.match(/server ready (\d+)/)[1]);
    const vitePid = Number(output.match(/vite ready (\d+)/)[1]);
    if (failure) process.kill(vitePid, 'SIGUSR2');
    else child.kill('SIGTERM');
    assert.deepEqual(await exited, [failure ? 7 : 0, null]);
    if (!failure) assert.match(output, /vite stopped/);
    for (const pid of [serverPid, vitePid]) {
      for (let attempts = 0; attempts < 50; attempts++) {
        try { process.kill(pid, 0); }
        catch (error) { if (error.code === 'ESRCH') break; throw error; }
        await delay(20);
      }
      assert.throws(() => process.kill(pid, 0), { code: 'ESRCH' });
    }
  });
}
