// src/engine/input/index.ts
import React, { useEffect, useRef, useState } from 'react';
import type { GestureSignal } from '../types';
import { classifyHandFacing, handFacingAngles } from './handFacing';
import { createNodDetector, createShakeDetector, pitchFromMatrix, yawFromMatrix } from './headGestures';

// Discrete head-gesture events for volume control: any nod (up or down) means
// volume up, a head-shake means volume down. Direction-agnostic nods sidestep
// the MediaPipe pitch-sign question entirely.
export type HeadGestureEvent = 'nod' | 'shake';

export type InputMode = 'asking' | 'camera' | 'mouse';

// Single persistence mechanism for the user's camera/mouse choice, shared by
// LandingPage (decides whether to skip the hero on mount) and PlayShell
// (keeps it in sync when the mode changes after mount — a manual switch or
// an automatic camera-denied fallback). sessionStorage, not localStorage: the
// choice should survive the /learn round trip within a tab, not outlive it.
const INPUT_MODE_KEY = 'froola.inputMode';

export function storedInputMode(): InputMode | null {
  try {
    const v = sessionStorage.getItem(INPUT_MODE_KEY);
    return v === 'camera' || v === 'mouse' ? v : null;
  } catch {
    return null;
  }
}

export function storeInputMode(mode: 'camera' | 'mouse'): void {
  try { sessionStorage.setItem(INPUT_MODE_KEY, mode); } catch { /* private mode */ }
}

// MediaPipe's WebGL GPU delegate stalls badly in Safari/WebKit (texture
// upload/readback overhead per frame with no compute-shader path), where it's
// often *slower* than the CPU delegate — the opposite of Chrome. Safari also
// has a heavier camera decode pipeline, so we ask for a smaller frame too.
// Vendor check rather than a UA-string regex: every iOS browser (CriOS,
// FxiOS, Edge…) is WebKit under the hood and needs the same treatment, and
// they all report vendor 'Apple Computer, Inc.'.
const isWebKit =
  typeof navigator !== 'undefined' &&
  navigator.vendor === 'Apple Computer, Inc.';

// A single mouse pointer can only be on one wheel at a time, so we label it by
// which half of the screen it's in: the left wheel sits near the left edge and
// the right (extension) wheel near the right edge, so a mid-screen split lets
// the cursor drive either wheel. Without this the pointer is always 'left' and
// the extension wheel is unreachable (mouse users are stuck on plain triads).
export function pointerHandId(xNorm: number): 'left' | 'right' {
  return xNorm < 0.5 ? 'left' : 'right';
}

export function useGestureInput(initialMode: InputMode = 'asking'): {
  signalRef: React.RefObject<GestureSignal[]>;
  mode: InputMode;
  requestCamera: () => void;
  useMouse: () => void;
  cameraVideoRef: React.RefObject<HTMLVideoElement | null>;
  headGestureRef: React.RefObject<HeadGestureEvent | null>;
} {
  const signalRef = useRef<GestureSignal[]>([]);
  // The input-mode choice itself is persisted one layer up, in LandingPage
  // (sessionStorage) — this hook always receives an explicit initialMode from
  // its caller and just tracks it as live state.
  const [mode, setMode] = useState<InputMode>(initialMode);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const headGestureRef = useRef<HeadGestureEvent | null>(null);

  function switchToMouse() {
    setMode('mouse');
  }

  function requestCamera() {
    setMode('camera');
  }

  // Mouse / touch mode
  useEffect(() => {
    if (mode !== 'mouse') return;
    signalRef.current = [{ x: 0.5, y: 0.5, present: true, handId: 'left' }];

    function onMove(e: MouseEvent) {
      const x = e.clientX / window.innerWidth;
      signalRef.current = [{
        x,
        y: e.clientY / window.innerHeight,
        present: true,
        handId: pointerHandId(x),
      }];
    }

    function onTouch(e: TouchEvent) {
      e.preventDefault();
      const touches = Array.from(e.touches);
      if (touches.length === 0) {
        signalRef.current = [];
        return;
      }
      // Sort touches by x so the leftmost maps to 'left' hand and rightmost to 'right'
      touches.sort((a, b) => a.clientX - b.clientX);
      signalRef.current = touches.slice(0, 2).map((t, i) => ({
        x: t.clientX / window.innerWidth,
        y: t.clientY / window.innerHeight,
        present: true,
        handId: (i === 0 ? 'left' : 'right') as 'left' | 'right',
      }));
    }

    function onTouchEnd(e: TouchEvent) {
      e.preventDefault();
      const touches = Array.from(e.touches);
      if (touches.length === 0) {
        signalRef.current = [{ x: 0.5, y: 0.5, present: true, handId: 'left' }];
        return;
      }
      onTouch(e);
    }

    window.addEventListener('mousemove', onMove);
    window.addEventListener('touchstart', onTouch, { passive: false });
    window.addEventListener('touchmove', onTouch, { passive: false });
    window.addEventListener('touchend', onTouchEnd, { passive: false });
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('touchstart', onTouch);
      window.removeEventListener('touchmove', onTouch);
      window.removeEventListener('touchend', onTouchEnd);
    };
  }, [mode]);

  // Camera mode
  useEffect(() => {
    if (mode !== 'camera') return;
    let cancelled = false;
    let animFrameId: number;
    let lastInferenceTime = 0;
    const INFERENCE_INTERVAL = 33; // ms (~30 fps inference)

    async function startCamera() {
      const { HandLandmarker, FaceLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');
      if (cancelled) return;

      // Kick off model loading and stream acquisition in parallel so the user
      // sees their camera feed as soon as permission is granted instead of waiting
      // for both MediaPipe models to download first.
      const visionPromise = FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm'
      );

      const videoConstraints = isWebKit
        ? { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' as const }
        : { width: { ideal: 1920 }, height: { ideal: 1080 }, facingMode: 'user' as const };

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints });
      } catch {
        // Persisting this fallback is PlayShell's job (it syncs `mode` on
        // every change) — the hook itself only tracks live state.
        setMode('mouse');
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

      // Load hand and face models in parallel rather than sequentially.
      const [landmarker, faceLandmarker] = await Promise.all([
        HandLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task',
            delegate: isWebKit ? 'CPU' : 'GPU',
          },
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
        }),
        FaceLandmarker.createFromOptions(vision, {
          baseOptions: {
            modelAssetPath:
              'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
            delegate: isWebKit ? 'CPU' : 'GPU',
          },
          runningMode: 'VIDEO',
          numFaces: 1,
          minFaceDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
          outputFacialTransformationMatrixes: true,
        }),
      ]);

      if (cancelled) {
        landmarker.close();
        faceLandmarker.close();
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

      // On WebKit the CPU delegate spends most of its budget acquiring
      // pixels: every detect call reads back the full 720p frame (~3.7 MB)
      // and resizes it in WASM, though the models consume only 192-224 px
      // inputs. Drawing the video into a small offscreen canvas first cuts
      // that readback ~7x. Chrome keeps the direct video path — its GPU
      // delegate samples the frame as a texture, so the copy would only add
      // work. Aspect ratio is preserved, so the normalized landmark coords
      // (and the viewport remap below) are unaffected.
      const INFER_MAX_WIDTH = 480;
      const inferCtx = isWebKit
        ? document.createElement('canvas').getContext('2d')
        : null;

      function inferenceSource(): HTMLVideoElement | HTMLCanvasElement {
        if (!inferCtx) return video;
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

      // ~30Hz so a fast ~300ms nod lands on ~9 samples instead of aliasing away.
      const FACE_INTERVAL = 33;
      let lastFaceInferenceTime = 0;
      // Set localStorage 'froola.debugNod' = '1' to log pitch and detector
      // transitions (for verifying the pitch sign convention on a real camera).
      const nodDebug = (() => {
        try { return localStorage.getItem('froola.debugNod') === '1'; } catch { return false; }
      })();
      let lastNodLogMs = 0;
      const nodDetector = createNodDetector(
        nodDebug ? (msg) => console.log(`[nod] ${msg}`) : undefined,
      );
      const shakeDetector = createShakeDetector(
        nodDebug ? (msg) => console.log(`[shake] ${msg}`) : undefined,
      );

      // Adaptive pacing: each delay stretches to a multiple of the measured
      // cost of the last detect call, so slow inference (WebKit's CPU
      // delegate) lowers its own rate instead of re-running on every rAF
      // tick and saturating the main thread — that saturation is what made
      // the whole page (video included) jank on Safari. On Chrome the GPU
      // calls take a few ms, so both delays stay pinned at their nominal
      // intervals.
      let handDelay = INFERENCE_INTERVAL;
      let faceDelay = FACE_INTERVAL;

      // Set true while the tab is hidden: the camera stream is released and the
      // detection loop is halted (see the visibilitychange handler below). Also
      // short-circuits any late rAF callback so nothing advances while paused.
      let paused = false;

      function loop() {
        if (cancelled || paused) return;
        const now = performance.now();
        // Starvation guard: hand inference is due nearly every tick (its
        // interval is short and it takes priority below), so on a low
        // refresh-rate display the face branch could be due forever and
        // never get to run. Once it's gone three intervals unserved, force
        // it through this tick and let the hand branch skip instead. Scaled
        // by the adaptive faceDelay so the guard never forces face inference
        // faster than the slow-delegate backoff allows.
        const faceStarved =
          now - lastFaceInferenceTime >= Math.max(3 * FACE_INTERVAL, 1.5 * faceDelay);
        if (!faceStarved && now - lastInferenceTime >= handDelay) {
          const result = landmarker.detectForVideo(inferenceSource(), now);
          lastInferenceTime = now;
          handDelay = Math.max(INFERENCE_INTERVAL, (performance.now() - now) * 1.5);

          if (result.landmarks.length === 0) {
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
            // and left one wheel unreachable. Leftmost orb → left/note wheel,
            // rightmost → right/extension wheel; a single hand gets the wheel
            // for the side it's on (the same rule as pointer input).
            const detections = result.landmarks.slice(0, 2).map((lm, i) => {
              const tip = lm[8]; // index fingertip
              return {
                rx: ((1 - tip.x) * vw * scale + offsetX) / dw,
                ry: (tip.y * vh * scale + offsetY) / dh,
                fist: isFist(lm),
                // World landmarks (metric 3D) — required for facing angles;
                // normalized landmarks give distorted out-of-plane angles.
                worldLm: result.worldLandmarks[i],
              };
            }).sort((a, b) => a.rx - b.rx);

            const signals: GestureSignal[] = [];
            for (let i = 0; i < detections.length; i++) {
              const { rx, ry, fist, worldLm } = detections[i];
              const handId: 'left' | 'right' =
                detections.length === 1 ? pointerHandId(rx) : i === 0 ? 'left' : 'right';
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

              // Freeze reported position on fist-close; unfreeze on fist-open
              if (fist && !s.wasFist) {
                s.frozenX = s.x;
                s.frozenY = s.y;
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
        } else if (now - lastFaceInferenceTime >= faceDelay || faceStarved) {
          // Face inference (~30Hz) for nod detection. `else if`, not `if`:
          // the two detect calls must never share a rAF tick, or they stack
          // into one long main-thread stall — the periodic hitch that read as
          // jitter (mild on Chrome, severe on Safari's CPU delegate). The
          // `faceStarved` guard above already forces this branch — and skips
          // the hand branch — once the face branch has gone unserved for
          // three intervals, so it isn't starved out by hand priority.
          const faceResult = faceLandmarker.detectForVideo(inferenceSource(), now);
          lastFaceInferenceTime = now;
          faceDelay = Math.max(FACE_INTERVAL, (performance.now() - now) * 2);

          const matrix = faceResult.facialTransformationMatrixes?.[0];
          if (faceResult.faceLandmarks.length === 0) {
            // Face lost: next detection re-seeds instead of firing on the gap.
            nodDetector.reset();
            shakeDetector.reset();
          } else if (!matrix) {
            // Landmarks present but the transformation matrix hasn't arrived
            // yet (can lag a frame behind landmarks): skip this sample
            // rather than resetting, so an in-flight nod isn't killed by a
            // transient gap.
            if (nodDebug && now - lastNodLogMs > 500) {
              console.log('[nod] no matrix');
              lastNodLogMs = now;
            }
          } else {
            const pitch = pitchFromMatrix(matrix.data);
            const yaw = yawFromMatrix(matrix.data);
            if (nodDebug && now - lastNodLogMs > 500) {
              console.log(`[nod] pitch=${pitch.toFixed(1)} yaw=${yaw.toFixed(1)}`);
              lastNodLogMs = now;
            }
            // Mutual suppression: a firing gesture puts the other detector
            // into refractory, so the pitch wobble of a vigorous shake (or
            // the slight yaw of a nod) can't double-fire the volume.
            const nod = nodDetector.sample(pitch, now);
            const shake = shakeDetector.sample(yaw, now);
            if (nod && !shake) {
              headGestureRef.current = 'nod';
              shakeDetector.suppress(now);
            } else if (shake) {
              headGestureRef.current = 'shake';
              nodDetector.suppress(now);
            }
          }
        }
        animFrameId = requestAnimationFrame(loop);
      }
      animFrameId = requestAnimationFrame(loop);

      // Release the camera (turns the webcam light off) and pause detection
      // while the tab is hidden; re-acquire and restart on return. The MediaPipe
      // landmarkers are kept alive across the hide — only the stream is released
      // — so returning costs a camera re-acquire, not a model reload.
      let reacquiring = false;
      const onVisibility = async () => {
        if (document.hidden) {
          if (paused) return;
          paused = true;
          cancelAnimationFrame(animFrameId);
          stream.getTracks().forEach(t => t.stop());
        } else {
          if (!paused || reacquiring) return;
          reacquiring = true;
          try {
            const next = await navigator.mediaDevices.getUserMedia({ video: videoConstraints });
            // Torn down (mode change / unmount) or hidden again mid-re-acquire:
            // drop the freshly acquired stream instead of wiring it up.
            if (cancelled || document.hidden) { next.getTracks().forEach(t => t.stop()); return; }
            stream = next;
            video.srcObject = stream;
            await video.play();
            if (cancelled || document.hidden) return;
            // A detection gap shouldn't fire a phantom gesture on return.
            nodDetector.reset();
            shakeDetector.reset();
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
        stream.getTracks().forEach(t => t.stop());
        landmarker.close();
        faceLandmarker.close();
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

  return { signalRef, mode, requestCamera, useMouse: switchToMouse, cameraVideoRef: videoRef, headGestureRef };
}
