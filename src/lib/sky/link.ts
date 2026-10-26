// How a sky on the page (components/Sky.tsx) reaches its drawing (engine.ts): where the browser can hand canvases to
// a worker, one worker draws every sky; elsewhere the engine is loaded onto the page and drawn from there.
import type { SkyScene } from './engine';
import type { Look } from './specs';
import type { SkyMessage } from './worker';
import SkyWorker from './worker?worker';

export interface SkyLink {
  look(look: Look): void;
  size(w: number, h: number, dpr: number): void;
  pointer(x: number, y: number, on: boolean): void;
  run(on: boolean): void;
  draw(): void;
  close(): void;
}

const offscreen = typeof Worker === 'function' && typeof OffscreenCanvas === 'function' && typeof createImageBitmap === 'function'
  && typeof HTMLCanvasElement !== 'undefined' && 'transferControlToOffscreen' in HTMLCanvasElement.prototype;

let worker: Worker | null = null;
let ids = 0;
const drawnBy = new Map<number, () => void>();

function startWorker() {
  if (worker) return worker;
  worker = new SkyWorker();
  worker.onmessage = ({ data }: MessageEvent<{ type: 'drawn'; id: number }>) => {
    drawnBy.get(data.id)?.();
    drawnBy.delete(data.id);
  };
  return worker;
}

/** Connects a sky's four canvases (far clouds, far letters, near clouds, near letters) to its drawing. */
export function linkSky(canvases: HTMLCanvasElement[], small: boolean, onDrawn: () => void): SkyLink {
  return offscreen ? viaWorker(canvases, small, onDrawn) : onPage(canvases, small, onDrawn);
}

function viaWorker(canvases: HTMLCanvasElement[], small: boolean, onDrawn: () => void): SkyLink {
  const w = startWorker();
  const id = ++ids;
  const send = (m: SkyMessage, transfer: Transferable[] = []) => w.postMessage(m, transfer);
  const handed = canvases.map((c) => c.transferControlToOffscreen());
  drawnBy.set(id, onDrawn);
  send({ type: 'add', id, canvases: handed, small }, handed);
  // the letter atlases are painted on the page (fonts are surest there) and sent over as pictures, one look after another
  let looks = Promise.resolve();
  let closed = false;
  return {
    look(look) {
      looks = looks.then(async () => {
        const atlases = await Promise.all(look.layers.map((l) => createImageBitmap(l.atlas as HTMLCanvasElement)));
        if (closed) return atlases.forEach((a) => a.close());
        const layers = look.layers.map((l, i) => ({ ...l, atlas: atlases[i] })) as Look['layers'];
        send({ type: 'look', id, look: { ...look, layers } }, atlases);
      }).catch(() => {});
    },
    size: (w, h, dpr) => send({ type: 'size', id, w, h, dpr }),
    pointer: (x, y, on) => send({ type: 'pointer', id, x, y, on }),
    run: (on) => send({ type: 'run', id, on }),
    draw: () => send({ type: 'draw', id }),
    close() {
      closed = true;
      drawnBy.delete(id);
      send({ type: 'remove', id });
    },
  };
}

function onPage(canvases: HTMLCanvasElement[], small: boolean, onDrawn: () => void): SkyLink {
  let scene: SkyScene | null = null;
  let closed = false;
  const waiting: ((s: SkyScene) => void)[] = [];
  const call = (f: (s: SkyScene) => void) => (scene ? f(scene) : waiting.push(f));
  void import('./engine').then(({ SkyScene }) => {
    if (closed) return;
    const make = (w: number, h: number) => Object.assign(document.createElement('canvas'), { width: w, height: h });
    scene = new SkyScene(canvases, small, make, onDrawn);
    for (const f of waiting.splice(0)) f(scene);
  });
  return {
    look: (look) => call((s) => s.setLook(look)),
    size: (w, h, dpr) => call((s) => s.setSize(w, h, dpr)),
    pointer: (x, y, on) => call((s) => s.setPointer(x, y, on)),
    run: (on) => call((s) => s.run(on)),
    draw: () => call((s) => s.draw()),
    close() {
      closed = true;
      scene?.dispose();
    },
  };
}
