// src/engine/input/index.ts
import React, { useEffect, useRef, useState } from 'react';
import type { HandLandmarker as HandLandmarkerInstance } from '@mediapipe/tasks-vision';
import type { GestureSignal } from '../types';
import { classifyHandFacing, handFacingAngles } from './handFacing';
import { palmCenter } from './palmCenter';
import { wheelGeometry, type WheelGeometry } from '../renderer/geometry';
import { obtainHandTracking } from './warm';

export type InputMode = 'asking' | 'camera';

// Single persistence mechanism for the user's camera choice, shared by
// LandingPage (decides whether to skip the hero on mount) and PlayShell
// (keeps it in sync when the mode changes after mount). sessionStorage, not
// localStorage: the choice should survive the /learn round trip within a
// tab, not outlive it.
const INPUT_MODE_KEY = 'froola.inputMode';

export function storedInputMode(): InputMode | null {
  try {
    const v = sessionStorage.getItem(INPUT_MODE_KEY);
    return v === 'camera' ? v : null;
  } catch {
    return null;
  }
}

export function storeInputMode(mode: 'camera'): void {
  try { sessionStorage.setItem(INPUT_MODE_KEY, mode); } catch { /* private mode */ }
}

// Trims the requested camera resolution and, since a CPU delegate spends
// most of its budget on pixel readback, drives an offscreen-canvas
// downscale before inference (see inferenceSource below) on any mobile
// browser once it's on the CPU delegate.
const isMobile =
  typeof navigator !== 'undefined' &&
  /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);

// A single detected hand can only be on one wheel at a time, so we label it
// by which wheel center it's nearest — on the desktop/landscape side-by-side
// layout that's equivalent to a left/right screen-half split, but on the
// portrait diagonal layout (see wheelGeometry) the two wheels sit close
// together on the x-axis, so an x-only split would misassign hands reaching
// for the vertically-staggered wheel.
export function assignHandIds(
  points: { rx: number; ry: number }[],
  geo: WheelGeometry,
  dw: number,
  dh: number
): ('left' | 'right')[] {
  const distTo = (p: { rx: number; ry: number }, cx: number, cy: number) =>
    Math.hypot(p.rx * dw - cx, p.ry * dh - cy);

  if (points.length === 1) {
    const p = points[0];
    return [distTo(p, geo.leftCx, geo.leftCy) <= distTo(p, geo.rightCx, geo.rightCy) ? 'left' : 'right'];
  }
  // Two hands: pick whichever left/right pairing has the lower total
  // distance instead of assuming index 0 is always the left wheel.
  const [a, b] = points;
  const straight = distTo(a, geo.leftCx, geo.leftCy) + distTo(b, geo.rightCx, geo.rightCy);
  const swapped = distTo(a, geo.rightCx, geo.rightCy) + distTo(b, geo.leftCx, geo.leftCy);
  return straight <= swapped ? ['left', 'right'] : ['right', 'left'];
}

export function useGestureInput(initialMode: InputMode = 'asking'): {
  signalRef: React.RefObject<GestureSignal[]>;
  mode: InputMode;
  requestCamera: () => void;
  // Set when the last requestCamera() call failed (permission denied, no
  // device, etc.) — the caller shows a retry prompt instead of silently
  // sitting on the 'asking' screen.
  cameraError: boolean;
  cameraVideoRef: React.RefObject<HTMLVideoElement | null>;
} {
  const signalRef = useRef<GestureSignal[]>([]);
  // The input-mode choice itself is persisted one layer up, in LandingPage
  // (sessionStorage) — this hook always receives an explicit initialMode from
  // its caller and just tracks it as live state.
  const [mode, setMode] = useState<InputMode>(initialMode);
  const [cameraError, setCameraError] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  function requestCamera() {
    setCameraError(false);
    setMode('camera');
  }

  // Camera mode
  useEffect(() => {
    if (mode !== 'camera') return;
    let cancelled = false;
    let animFrameId: number;
    let lastInferenceTime = 0;
    const INFERENCE_INTERVAL = 33; // ms (~30 fps inference)

    async function startCamera() {
      // Whole tracking load (module + WASM + model) runs concurrently with
      // the permission prompt and stream acquisition; warm visits from the
      // landing page usually have it finished already (see ./warm.ts).
      const trackingPromise = obtainHandTracking();

      // Mobile detection is CPU-bound often enough (WebKit always, Android on
      // GPU-delegate fallback) that a smaller capture resolution is worth
      // the tradeoff — a phone held at arm's length fills most of the frame
      // with hands anyway, so 960x540 loses little for tracking purposes
      // while cutting decode + downscale cost well below 1280x720.
      const videoConstraints = isMobile
        ? { width: { ideal: 960 }, height: { ideal: 540 }, facingMode: 'user' as const }
        : { width: { ideal: 1920 }, height: { ideal: 1080 }, facingMode: 'user' as const };

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints });
      } catch {
        setMode('asking');
        setCameraError(true);
        // The load we started is ours now (ownership taken) — close its landmarker when we bail before using it.
        void trackingPromise.then(t => t.landmarker.close()).catch(() => {});
        return;
      }
      if (cancelled) {
        stream.getTracks().forEach(t => t.stop());
        void trackingPromise.then(t => t.landmarker.close()).catch(() => {});
        return;
      }

      // Show camera feed immediately while models finish loading.
      const video = document.createElement('video');
      video.playsInline = true;
      video.muted = true;
      videoRef.current = video;
      video.srcObject = stream;
      video.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;object-fit:cover;z-index:0;pointer-events:none;transform:scaleX(-1);';
      document.body.appendChild(video);
      await video.play();
      if (cancelled) {
        if (video.parentNode) video.parentNode.removeChild(video);
        stream.getTracks().forEach(t => t.stop());
        void trackingPromise.then(t => t.landmarker.close()).catch(() => {});
        return;
      }

      let landmarker: HandLandmarkerInstance;
      let currentDelegate: 'CPU' | 'GPU';
      let createLandmarker: (d: 'CPU' | 'GPU') => Promise<HandLandmarkerInstance>;
      try {
        const tracking = await trackingPromise;
        landmarker = tracking.landmarker;
        currentDelegate = tracking.delegate;
        createLandmarker = tracking.createLandmarker;
      } catch {
        setMode('asking');
        setCameraError(true);
        if (video.parentNode) video.parentNode.removeChild(video);
        stream.getTracks().forEach(t => t.stop());
        return;
      }
      let fallingBack = false;

      async function fallBackToCpu() {
        if (fallingBack || currentDelegate === 'CPU') return;
        fallingBack = true;
        console.error('[handTracking] GPU delegate failed, falling back to CPU');
        try {
          const cpu = await createLandmarker('CPU');
          landmarker.close();
          landmarker = cpu;
          currentDelegate = 'CPU';
        } catch (err) {
          console.error('[handTracking] CPU delegate fallback also failed', err);
        } finally {
          fallingBack = false;
        }
      }

      if (cancelled) {
        landmarker.close();
        if (video.parentNode) video.parentNode.removeChild(video);
        stream.getTracks().forEach(t => t.stop());
        return;
      }

      // Per-hand EMA + fist-lock state.
      // Time constant (ms) for the fingertip EMA; the per-update alpha is
      // 1 - exp(-dt/tau), which matches the old fixed alpha (0.35 per 33 ms
      // tick) at the nominal rate but stays rate-independent. With a fixed
      // alpha, slower inference (Safari's CPU delegate) meant fewer blend
      // steps per second, so the orb converged slower — "lags behind".
      const SMOOTH_TAU = 77;
      // How long (ms) a hand must be absent before we re-initialize its EMA
      // on the next appearance instead of blending from the stale position.
      // Prevents the orb from snapping to the 0.5,0.5 default when a hand
      // first appears or briefly drops out (e.g. due to handedness flipping).
      const REAPPEAR_GAP_MS = 300;
      type HandState = { x: number; y: number; lastSeenMs: number; wasFist: boolean; frozenX: number | null; frozenY: number | null };
      const smooth: Record<'left' | 'right', HandState> = {
        left:  { x: 0.5, y: 0.5, lastSeenMs: -Infinity, wasFist: false, frozenX: null, frozenY: null },
        right: { x: 0.5, y: 0.5, lastSeenMs: -Infinity, wasFist: false, frozenX: null, frozenY: null },
      };

      function isFist(lm: { x: number; y: number; z: number }[]): boolean {
        const wrist = lm[0];
        const tipIdx = [8, 12, 16, 20];
        const mcpIdx = [5,  9, 13, 17];
        const d = (a: typeof wrist, b: typeof wrist) =>
          Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
        let curled = 0;
        for (let k = 0; k < 4; k++) {
          if (d(lm[tipIdx[k]], wrist) < d(lm[mcpIdx[k]], wrist) * 0.95) curled++;
        }
        return curled >= 3;
      }

      // Set localStorage 'froola.debugFacing' = '1' to log per-hand tilt
      // angles (for tuning the tilt-popup thresholds against a real camera).
      const facingDebug = (() => {
        try { return localStorage.getItem('froola.debugFacing') === '1'; } catch { return false; }
      })();
      let lastFacingLogMs = 0;

      // On the CPU delegate, most of the per-frame budget goes to acquiring
      // pixels: every detect call reads back the full captured frame (~1.5
      // MB at 960x540) and resizes it in WASM, though the models consume
      // only 192-224 px inputs. Drawing the video into a small offscreen
      // canvas first cuts that readback dramatically. The GPU delegate
      // samples the frame directly as a texture, so this copy would only
      // add work there — gate on the *current* delegate (which can change
      // at runtime via fallBackToCpu), not just on mobile. Aspect ratio is
      // preserved, so the normalized landmark coords (and the viewport
      // remap below) are unaffected.
      const INFER_MAX_WIDTH = 320;
      const inferCtx = isMobile
        ? document.createElement('canvas').getContext('2d')
        : null;

      function inferenceSource(): HTMLVideoElement | HTMLCanvasElement {
        if (!inferCtx || currentDelegate === 'GPU') return video;
        const vw = video.videoWidth;
        const vh = video.videoHeight;
        if (!vw || !vh) return video;
        const scale = Math.min(1, INFER_MAX_WIDTH / vw);
        const cw = Math.round(vw * scale);
        const ch = Math.round(vh * scale);
        const canvas = inferCtx.canvas;
        if (canvas.width !== cw || canvas.height !== ch) {
          canvas.width = cw;
          canvas.height = ch;
        }
        inferCtx.drawImage(video, 0, 0, cw, ch);
        return canvas;
      }

      // Adaptive pacing: the delay stretches to a multiple of the measured
      // cost of the last detect call, so slow inference (WebKit's CPU
      // delegate) lowers its own rate instead of re-running on every rAF
      // tick and saturating the main thread — that saturation is what made
      // the whole page (video included) jank on Safari. On Chrome the GPU
      // calls take a few ms, so the delay stays pinned at its nominal
      // interval.
      let handDelay = INFERENCE_INTERVAL;

      // Set true while the tab is hidden: the detection loop is halted (and the
      // camera released after a grace period — see the visibilitychange handler
      // below). Also short-circuits any late rAF callback so nothing advances
      // while paused.
      let paused = false;

      function loop() {
        if (cancelled || paused) return;
        const now = performance.now();
        if (now - lastInferenceTime >= handDelay) {
          // A throw here (e.g. a flaky GPU delegate on some Android devices)
          // used to abort this function before the requestAnimationFrame call
          // below ran, silently killing hand tracking for the rest of the
          // session while the camera feed kept playing. Swallow it, kick off
          // a CPU fallback if we were still on GPU, and retry next frame.
          let result: ReturnType<typeof landmarker.detectForVideo> | null = null;
          try {
            result = landmarker.detectForVideo(inferenceSource(), now);
          } catch (err) {
            console.error('[handTracking] detectForVideo failed', err);
            fallBackToCpu();
          }
          lastInferenceTime = now;
          handDelay = Math.max(INFERENCE_INTERVAL, (performance.now() - now) * 1.5);

          if (!result || result.landmarks.length === 0) {
            // No hands in frame: explicitly clear so the renderer's guardrail
            // check (signals.some(s => s.present)) returns false and the
            // pulsing guide rings reappear.
            signalRef.current = [];
          } else {
            // Remap from video-native coords to viewport coords (object-fit:cover compensation)
            const vw = video.videoWidth;
            const vh = video.videoHeight;
            const dw = window.innerWidth;
            const dh = window.innerHeight;
            const scale = Math.max(dw / vw, dh / vh);
            const offsetX = (dw - vw * scale) / 2;
            const offsetY = (dh - vh * scale) / 2;

            // handId comes from mirrored screen position, not MediaPipe's
            // handedness label: handedness flickers frame-to-frame, which
            // swapped the wheel a hand was driving mid-play, and two
            // detections with the same label collided the per-hand EMA state
            // and left one wheel unreachable. Each hand is assigned to
            // whichever wheel center it's nearest (see assignHandIds).
            const detections = result.landmarks.slice(0, 2).map((lm, i) => {
              const fist = isFist(lm);
              // Open hand tracks the index fingertip; a fist tracks the palm
              // center, so where the curled index finger ends up can't drag
              // the lock into a neighboring zone.
              const p = fist ? palmCenter(lm) : lm[8];
              return {
                rx: ((1 - p.x) * vw * scale + offsetX) / dw,
                ry: (p.y * vh * scale + offsetY) / dh,
                fist,
                // World landmarks (metric 3D) — required for facing angles;
                // normalized landmarks give distorted out-of-plane angles.
                worldLm: result.worldLandmarks[i],
              };
            });
            const wheelGeo = wheelGeometry(dw, dh);
            const handIds = assignHandIds(detections, wheelGeo, dw, dh);

            const signals: GestureSignal[] = [];
            for (let i = 0; i < detections.length; i++) {
              const { rx, ry, fist, worldLm } = detections[i];
              const handId = handIds[i];
              const s = smooth[handId];

              // Jump EMA to actual position on first appearance or after a tracking
              // gap — prevents the orb from drifting in from center (0.5, 0.5).
              const dt = now - s.lastSeenMs;
              const isNew = dt > REAPPEAR_GAP_MS;
              s.lastSeenMs = now;

              if (!fist) {
                if (isNew) {
                  s.x = rx; s.y = ry;
                } else {
                  const alpha = 1 - Math.exp(-dt / SMOOTH_TAU);
                  s.x = alpha * rx + (1 - alpha) * s.x;
                  s.y = alpha * ry + (1 - alpha) * s.y;
                }
              } else if (isNew) {
                // Fist on reappearance: seed EMA at actual position so the freeze
                // captures the real hand location, not the stale center default.
                s.x = rx; s.y = ry;
              }

              // Freeze reported position on fist-close; unfreeze on fist-open.
              // Snap to this frame's palm center rather than the EMA — the EMA
              // still holds the fingertip position from the open-hand frames.
              if (fist && !s.wasFist) {
                s.x = rx;
                s.y = ry;
                s.frozenX = rx;
                s.frozenY = ry;
              } else if (!fist && s.wasFist) {
                s.frozenX = null;
                s.frozenY = null;
              }
              s.wasFist = fist;

              const reportX = s.frozenX ?? s.x;
              const reportY = s.frozenY ?? s.y;

              const facing = classifyHandFacing(worldLm);
              if (facingDebug && now - lastFacingLogMs > 500) {
                lastFacingLogMs = now;
                const a = handFacingAngles(worldLm);
                console.log(`[facing] ${handId} turn=${a.turn.toFixed(0)}° pitch=${a.pitch.toFixed(0)}° → ${facing}`);
              }

              signals.push({
                x: Math.max(0, Math.min(1, reportX)),
                y: Math.max(0, Math.min(1, reportY)),
                present: true,
                handId,
                fist,
                facing,
              });
            }
            signalRef.current = signals;
          }
        }
        animFrameId = requestAnimationFrame(loop);
      }
      animFrameId = requestAnimationFrame(loop);

      // Pause detection while the tab is hidden, but keep the camera for a
      // grace period so a quick tab switch doesn't flicker the webcam light
      // or cost a re-acquire. Only after the tab has stayed hidden this long
      // do we actually release the stream (turning the webcam light off).
      // The MediaPipe landmarkers are kept alive across the hide either way,
      // so returning after a release costs a camera re-acquire, not a model
      // reload.
      const RELEASE_DELAY_MS = 2 * 60 * 1000;
      let reacquiring = false;
      let released = false;
      let releaseTimer: ReturnType<typeof setTimeout> | null = null;

      const clearReleaseTimer = () => {
        if (releaseTimer !== null) { clearTimeout(releaseTimer); releaseTimer = null; }
      };

      const onVisibility = async () => {
        if (document.hidden) {
          if (!paused) {
            paused = true;
            cancelAnimationFrame(animFrameId);
          }
          // Defer the actual camera release; returning before it fires cancels it.
          if (releaseTimer === null && !released) {
            releaseTimer = setTimeout(() => {
              releaseTimer = null;
              if (!document.hidden || cancelled) return;
              released = true;
              stream.getTracks().forEach(t => t.stop());
            }, RELEASE_DELAY_MS);
          }
        } else {
          clearReleaseTimer();
          if (!paused || reacquiring) return;
          // Came back within the grace period — the stream is still live, so
          // just resume detection without touching the camera.
          if (!released) {
            paused = false;
            animFrameId = requestAnimationFrame(loop);
            return;
          }
          // Past the grace period — the camera was released, so re-acquire it.
          reacquiring = true;
          try {
            const next = await navigator.mediaDevices.getUserMedia({ video: videoConstraints });
            // Torn down (mode change / unmount) or hidden again mid-re-acquire:
            // drop the freshly acquired stream instead of wiring it up.
            if (cancelled || document.hidden) { next.getTracks().forEach(t => t.stop()); return; }
            stream = next;
            released = false;
            video.srcObject = stream;
            await video.play();
            if (cancelled || document.hidden) return;
            paused = false;
            animFrameId = requestAnimationFrame(loop);
          } catch {
            // Camera unavailable on return (e.g. claimed by another app): stay
            // paused; a later visibility flip retries.
          } finally {
            reacquiring = false;
          }
        }
      };
      document.addEventListener('visibilitychange', onVisibility);

      cleanupRef.current = () => {
        document.removeEventListener('visibilitychange', onVisibility);
        clearReleaseTimer();
        stream.getTracks().forEach(t => t.stop());
        landmarker.close();
        cancelAnimationFrame(animFrameId);
        if (video.parentNode) video.parentNode.removeChild(video);
      };
    }

    startCamera();

    return () => {
      cancelled = true;
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, [mode]);

  return { signalRef, mode, requestCamera, cameraError, cameraVideoRef: videoRef };
}
