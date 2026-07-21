// Warm-up singleton for the gesture pipeline. The heavy loads — the
// tasks-vision module, the WASM fileset, and the hand-landmarker model
// download + creation — start on the landing page (warmGestureInput on
// idle) so /play usually finds them done. obtainHandTracking has
// take-ownership semantics: it hands the pending load to the caller and
// clears the cache, so a cancelled/closed landmarker never gets reused.
import type { HandLandmarker as HandLandmarkerInstance } from '@mediapipe/tasks-vision';

// MediaPipe's WebGL GPU delegate stalls badly in Safari/WebKit specifically
// (texture upload/readback overhead per frame with no compute-shader path,
// where it's often *slower* than the CPU delegate) — so WebKit starts on
// CPU. Every other mobile browser starts on GPU, which is several times
// faster than CPU when it works; GPU delegate failures are common enough
// across Android GPU/driver combos, though, that startCamera falls back to
// CPU at runtime (see gpuFailed below) rather than assuming it always works
// or always avoiding it.
export const isWebKit =
  typeof navigator !== 'undefined' &&
  navigator.vendor === 'Apple Computer, Inc.';

const WASM_BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm';
const MODEL_ASSET_PATH =
  'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

export type HandTracking = {
  landmarker: HandLandmarkerInstance;
  delegate: 'CPU' | 'GPU';
  createLandmarker: (delegate: 'CPU' | 'GPU') => Promise<HandLandmarkerInstance>;
};

let pending: Promise<HandTracking> | null = null;

async function load(): Promise<HandTracking> {
  const { HandLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');
  const vision = await FilesetResolver.forVisionTasks(WASM_BASE);
  const createLandmarker = (delegate: 'CPU' | 'GPU') =>
    HandLandmarker.createFromOptions(vision, {
      baseOptions: { modelAssetPath: MODEL_ASSET_PATH, delegate },
      runningMode: 'VIDEO',
      numHands: 2,
      // Keep MediaPipe's 0.5 defaults. Dropping these to 0.3 (to track hands
      // held close to the camera) made it accept low-confidence/blurry hands:
      // noisy landmarks caused heavy jitter, and a curled-looking blurry hand
      // registered as a fist, freezing the reported position at center
      // ("stuck in the middle"). 0.5 restores stable tracking.
      minHandDetectionConfidence: 0.5,
      minHandPresenceConfidence: 0.5,
      minTrackingConfidence: 0.5,
    });
  let delegate: 'CPU' | 'GPU' = isWebKit ? 'CPU' : 'GPU';
  let landmarker: HandLandmarkerInstance;
  try {
    landmarker = await createLandmarker(delegate);
  } catch {
    // GPU delegate creation itself can throw (not just first detect) on
    // devices that don't support the backend at all.
    delegate = 'CPU';
    landmarker = await createLandmarker('CPU');
  }
  return { landmarker, delegate, createLandmarker };
}

/** Fire-and-forget: start loading if nothing is cached. Safe to call often. */
export function warmGestureInput(): void {
  if (pending) return;
  const p = load();
  pending = p;
  // A failed warm must not poison /play: clear so the next caller retries.
  p.catch(() => { if (pending === p) pending = null; });
}

/** Take the warm load if one exists (clearing the cache), else load cold. */
export function obtainHandTracking(): Promise<HandTracking> {
  const p = pending ?? load();
  pending = null;
  return p;
}

/** Put an in-flight/completed load back in the cache if nothing newer has
 *  taken its place — used when a consumer tears down before ever using the
 *  tracking it obtained (e.g. React StrictMode's dev-only double-invoke of
 *  effects), so the real surviving mount can still reuse it instead of
 *  falling back to a cold load. Returns false if something newer was
 *  already cached (caller should close the tracking it holds instead). */
export function restashHandTracking(p: Promise<HandTracking>): boolean {
  if (pending) return false;
  pending = p;
  return true;
}
