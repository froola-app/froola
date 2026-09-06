// Camera and MediaPipe plumbing for the hand tracker.
//
// The tracking *algorithms* do not live here. Filtering, slot assignment, fist
// gating, coasting and prediction are all in `@froola/handtrack`, which is pure
// and covered by benchmarks that run without a camera. What is left in this
// file is the part that genuinely needs a browser: acquiring a stream, loading
// and babysitting the MediaPipe landmarker, choosing a delegate, pacing
// inference, and releasing hardware when the tab goes away.
//
// Keeping the split at that line is deliberate. Everything on the far side of
// it can be tested; everything on this side has to be verified on a device.

import React, { useEffect, useRef, useState } from 'react';
import {
  HandTracker,
  coverTransform,
  type HandFrame,
  type Point,
} from '@froola/handtrack';
import type { GestureSignal } from '../types';
import { wheelGeometry } from '../renderer/geometry';

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

// MediaPipe's WebGL GPU delegate stalls badly in Safari/WebKit specifically
// (texture upload/readback overhead per frame with no compute-shader path,
// where it's often *slower* than the CPU delegate) — so WebKit starts on
// CPU. Every other mobile browser starts on GPU, which is several times
// faster than CPU when it works; GPU delegate failures are common enough
// across Android GPU/driver combos, though, that startCamera falls back to
// CPU at runtime (see gpuFailed below) rather than assuming it always works
// or always avoiding it.
const isWebKit =
  typeof navigator !== 'undefined' &&
  navigator.vendor === 'Apple Computer, Inc.';

/** Slot 0 drives the note wheel, slot 1 the extension wheel. */
const SLOT_TO_HAND: ('left' | 'right')[] = ['left', 'right'];

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
      const { HandLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');
      if (cancelled) return;

      // Kick off model loading and stream acquisition in parallel so the user
      // sees their camera feed as soon as permission is granted instead of waiting
      // for both MediaPipe models to download first.
      const visionPromise = FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm'
      );

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
        return;
      }
      if (cancelled) { stream.getTracks().forEach(t => t.stop()); return; }

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
        return;
      }

      const vision = await visionPromise;
      if (cancelled) {
        if (video.parentNode) video.parentNode.removeChild(video);
        stream.getTracks().forEach(t => t.stop());
        return;
      }

      const MODEL_ASSET_PATH =
        'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';

      function createLandmarker(delegate: 'CPU' | 'GPU') {
        return HandLandmarker.createFromOptions(vision, {
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
      }

      let currentDelegate: 'CPU' | 'GPU' = isWebKit ? 'CPU' : 'GPU';
      let landmarker: Awaited<ReturnType<typeof createLandmarker>>;
      try {
        landmarker = await createLandmarker(currentDelegate);
      } catch {
        // GPU delegate creation itself can throw (not just first detect) on
        // devices that don't support the backend at all.
        currentDelegate = 'CPU';
        landmarker = await createLandmarker('CPU');
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

      // Everything stateful about the hands themselves lives here, and it is
      // all portable: no DOM, no camera, no React. The two wheels are its two
      // slots.
      const tracker = new HandTracker({ slotCount: 2 });

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

          // A failed detect carries no information about where the hands are,
          // so leave the last signals standing rather than telling the tracker
          // the hands are gone.
          if (result) {
            const dw = window.innerWidth;
            const dh = window.innerHeight;
            const geo = wheelGeometry(dw, dh);
            // The wheel centers, in the same 0-1 space the tracker reports in.
            const anchors: Point[] = [
              { x: geo.leftCx / dw, y: geo.leftCy / dh },
              { x: geo.rightCx / dw, y: geo.rightCy / dh },
            ];
            const transform = coverTransform(video.videoWidth, video.videoHeight, dw, dh);

            const hands: HandFrame[] = result.landmarks.slice(0, 2).map((landmarks, i) => ({
              landmarks,
              // World landmarks (metric 3D) — required for facing angles;
              // normalized landmarks give distorted out-of-plane angles.
              worldLandmarks: result.worldLandmarks[i],
            }));

            const tracked = tracker.update(hands, {
              anchors,
              mapPoint: p => transform.map(p),
              nowMs: now,
            });

            signalRef.current = tracked.map(h => ({
              x: h.x,
              y: h.y,
              present: true,
              handId: SLOT_TO_HAND[h.slot] ?? 'left',
              fist: h.fist,
              facing: h.facing,
            }));

            if (facingDebug && tracked.length > 0 && now - lastFacingLogMs > 500) {
              lastFacingLogMs = now;
              for (const h of tracked) {
                console.log(
                  `[hand] ${SLOT_TO_HAND[h.slot]} facing=${h.facing} curl=${h.curl.toFixed(2)}` +
                  `${h.fist ? ' fist' : ''}${h.coasting ? ' coasting' : ''}`
                );
              }
            }
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
            // The hands have had minutes to move. Anything the tracker
            // remembers about them is stale, so start clean.
            tracker.reset();
            signalRef.current = [];
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
