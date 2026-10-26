// The skies, drawn off the main thread: the page hands each sky's canvases over (link.ts) and then only sends what
// changes (its size, its look, a finger on it, whether it should move).
import { SkyScene } from './engine';
import type { Look } from './specs';

export type SkyMessage =
  | { type: 'add'; id: number; canvases: OffscreenCanvas[]; small: boolean }
  | { type: 'look'; id: number; look: Look }
  | { type: 'size'; id: number; w: number; h: number; dpr: number }
  | { type: 'pointer'; id: number; x: number; y: number; on: boolean }
  | { type: 'run'; id: number; on: boolean }
  | { type: 'draw'; id: number }
  | { type: 'remove'; id: number };

const scope = self as unknown as { postMessage(m: unknown): void; onmessage: ((e: MessageEvent<SkyMessage>) => void) | null };
const skies = new Map<number, SkyScene>();
const make = (w: number, h: number) => new OffscreenCanvas(w, h);

scope.onmessage = ({ data: m }) => {
  if (m.type === 'add') {
    skies.set(m.id, new SkyScene(m.canvases, m.small, make, () => scope.postMessage({ type: 'drawn', id: m.id })));
    return;
  }
  const sky = skies.get(m.id);
  if (!sky) return;
  if (m.type === 'look') sky.setLook(m.look);
  else if (m.type === 'size') sky.setSize(m.w, m.h, m.dpr);
  else if (m.type === 'pointer') sky.setPointer(m.x, m.y, m.on);
  else if (m.type === 'run') sky.run(m.on);
  else if (m.type === 'draw') sky.draw();
  else if (m.type === 'remove') {
    sky.dispose();
    skies.delete(m.id);
  }
};
