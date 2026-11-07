// The pose model behind the push-up counter: Google's MediaPipe Pose Landmarker (the lite model), in WebAssembly, run on
// the device. Its runtime and model come from our own server (server/pose.js fetches them once from their public hosts),
// so the page never talks to anyone else and the CSP only needs 'wasm-unsafe-eval'. The library itself is a chunk of
// its own, loaded the first time the counter opens.
import type { PoseLandmarker } from '@mediapipe/tasks-vision';

/** Must match the @mediapipe/tasks-vision version in package.json and the one server/pose.js serves. */
export const POSE_VERSION = '1.1.1';
const MODEL = '/pose/models/pose_landmarker_lite.task';

// iPhones and iPads: MediaPipe's GPU path has given wrong answers in Safari without failing, so they use the CPU,
// which the lite model keeps quick enough (push-ups need about 15 frames a second).
const apple = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

/** A pose model ready to read video frames. Close it when done: it holds GPU memory. */
export async function loadPose(): Promise<PoseLandmarker> {
  const { FilesetResolver, PoseLandmarker } = await import('@mediapipe/tasks-vision');
  const files = await FilesetResolver.forVisionTasks(`/pose/${POSE_VERSION}`);
  const make = (delegate: 'GPU' | 'CPU') =>
    PoseLandmarker.createFromOptions(files, {
      baseOptions: { modelAssetPath: MODEL, delegate },
      runningMode: 'VIDEO',
      numPoses: 1,
      // a canvas of its own for the GPU, so it never fights over one (and works in iOS web views)
      canvas: delegate === 'GPU' ? document.createElement('canvas') : undefined,
    });
  if (apple()) return make('CPU');
  try {
    return await make('GPU');
  } catch {
    return make('CPU');
  }
}
