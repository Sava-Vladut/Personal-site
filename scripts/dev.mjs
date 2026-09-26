// Runs the API server and the Vite dev server together: npm run dev
import { spawn } from 'node:child_process';

const opts = { stdio: 'inherit', shell: process.platform === 'win32' };
const server = spawn('node', ['--watch', 'server/index.js'], { ...opts, env: { ...process.env, APP_URL: process.env.APP_URL || 'http://localhost:5173' } });
const vite = spawn('npx', ['vite'], opts);

const stop = () => {
  server.kill();
  vite.kill();
  process.exit();
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
server.on('exit', stop);
vite.on('exit', stop);
