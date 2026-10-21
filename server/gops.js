// The Global Operations port's progress, for its page under Insights. The port's loop writes
// status.json into GOPS_DIR (mounted read-only) after every iteration; this hands it out as is.
// Its screenshots and play build are served by Caddy at /gops-debug/, from the same folder.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { HttpError } from './http-error.js';
import { json } from './http-response.js';

export function createGopsHandler({ directory }) {
  return async (req, res) => {
    if (req.method !== 'GET') throw new HttpError(405, 'Method not allowed');
    if (!directory) throw new HttpError(404, 'The port’s progress isn’t connected on this server.');
    let text;
    try {
      text = await readFile(join(directory, 'status.json'), 'utf8');
    } catch {
      throw new HttpError(404, 'The port hasn’t reported any progress yet.');
    }
    return json(res, 200, JSON.parse(text));
  };
}
