import { HttpError } from './http-error.js';

/** A small JSON request body: anything bigger than `limit` bytes, or not JSON, is refused. */
export async function readJson(req, limit = 16 * 1024) {
  if (!/^application\/json\b/i.test(req.headers['content-type'] || '')) throw new HttpError(415, 'Expected JSON.');
  if (Number(req.headers['content-length']) > limit) {
    req.resume();
    throw new HttpError(413, 'That’s too much to send.');
  }
  let size = 0;
  const chunks = [];
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new HttpError(413, 'That’s too much to send.');
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new HttpError(400, 'Expected JSON.');
  }
}
