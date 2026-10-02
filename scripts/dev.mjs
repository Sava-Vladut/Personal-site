// Runs the API server and the Vite dev server together: npm run dev
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const opts = { stdio: 'inherit' };
const server = spawn(process.execPath, ['--watch', fileURLToPath(new URL('../server/index.js', import.meta.url))], { ...opts, env: { ...process.env, APP_URL: process.env.APP_URL || 'http://localhost:5173' } });
// Launch Vite directly so shutdown signals reach it instead of an npx wrapper.
const vite = spawn(process.execPath, [fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url))], opts);
const children = [server, vite];
const closed = new Set();
let stopping = false;
let timer;

const stop = (code = 0) => {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  for (const child of children) if (!closed.has(child)) child.kill('SIGTERM');
  timer = setTimeout(() => {
    for (const child of children) if (!closed.has(child)) child.kill('SIGKILL');
  }, 8_000);
  timer.unref();
  if (closed.size === children.length) clearTimeout(timer);
};
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
for (const child of children) {
  child.on('error', (error) => { console.error(error.message); stop(1); });
  child.on('close', (code, signal) => {
    closed.add(child);
    stop(code ?? (signal ? 1 : 0));
    if (closed.size === children.length) clearTimeout(timer);
  });
}
