// src/engine/input/index.ts
import React, { useEffect, useRef, useState } from 'react';
import type { GestureSignal } from '../types';
import { classifyHandFacing } from './handFacing';

export type InputMode = 'asking' | 'camera' | 'mouse';

const INPUT_MODE_KEY = 'froola-input-mode';

// A single mouse pointer can only be on one wheel at a time, so we label it by
// which half of the screen it's in: the left wheel sits near the left edge and
// the right (extension) wheel near the right edge, so a mid-screen split lets
// the cursor drive either wheel. Without this the pointer is always 'left' and
// the extension wheel is unreachable (mouse users are stuck on plain triads).
export function pointerHandId(xNorm: number): 'left' | 'right' {
  return xNorm < 0.5 ? 'left' : 'right';
}

function savedMode(): InputMode | null {
  try {
    const v = localStorage.getItem(INPUT_MODE_KEY);
    return v === 'camera' || v === 'mouse' ? v : null;
  } catch { return null; }
}

export function useGestureInput(initialMode: InputMode = 'asking'): {
  signalRef: React.RefObject<GestureSignal[]>;
  mode: InputMode;
  requestCamera: () => void;
  useMouse: () => void;
  cameraVideoRef: React.RefObject<HTMLVideoElement | null>;
  nodEventRef: React.RefObject<'up' | 'down' | null>;
} {
  const signalRef = useRef<GestureSignal[]>([]);
  // Restore persisted choice so the user isn't re-prompted on every navigation
  const [mode, setMode] = useState<InputMode>(() =>
    initialMode === 'asking' ? (savedMode() ?? 'asking') : initialMode
  );
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  const nodEventRef = useRef<'up' | 'down' | null>(null);

  function switchToMouse() {
    try { localStorage.setItem(INPUT_MODE_KEY, 'mouse'); } catch { /* ignore */ }
    setMode('mouse');
  }

  function requestCamera() {
    try { localStorage.setItem(INPUT_MODE_KEY, 'camera'); } catch { /* ignore */ }
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

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1920 }, height: { ideal: 1080 }, facingMode: 'user' },
        });
      } catch {
        try { localStorage.setItem(INPUT_MODE_KEY, 'mouse'); } catch { /* ignore */ }
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
            delegate: 'GPU',
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
            delegate: 'GPU',
          },
          runningMode: 'VIDEO',
          numFaces: 1,
          minFaceDetectionConfidence: 0.5,
          minTrackingConfidence: 0.5,
        }),
      ]);

      if (cancelled) {
        landmarker.close();
        faceLandmarker.close();
        if (video.parentNode) video.parentNode.removeChild(video);
        stream.getTracks().forEach(t => t.stop());
        return;
      }

      // Per-hand EMA + fist-lock state
      const SMOOTH = 0.35;
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

      const FACE_INTERVAL = 100;
      let lastFaceInferenceTime = 0;
      // -1 = not yet seeded; seeded from actual nose position on first detection
      // to avoid a false NODDING_UP transition from converging away from 0.5.
      let nodSmoothedY = -1;
      let nodPrevY = -1;
      let nodState: 'IDLE' | 'NODDING_DOWN' | 'NODDING_UP' = 'IDLE';
      let nodDebounceUntil = 0;
      const NOD_DOWN_THRESHOLD = 0.007;
      const NOD_UP_THRESHOLD = -0.007;
      const FACE_SMOOTH = 0.4;

      function loop() {
        if (cancelled) return;
        const now = performance.now();
        if (now - lastInferenceTime >= INFERENCE_INTERVAL) {
          const result = landmarker.detectForVideo(video, now);
          lastInferenceTime = now;

          if (result.landmarks.length === 0) {
            // No hands in frame: explicitly clear so the renderer's guardrail
            // check (signals.some(s => s.present)) returns false and the
            // pulsing guide rings reappear.
            signalRef.current = [];
          } else {
            const signals: GestureSignal[] = [];
            for (let i = 0; i < result.landmarks.length; i++) {
              const lm = result.landmarks[i];
              const tip = lm[8]; // index fingertip
              const rawHandedness = result.handednesses[i][0].categoryName;
              const handId: 'left' | 'right' = rawHandedness === 'Left' ? 'left' : 'right';

              // Remap from video-native coords to viewport coords (object-fit:cover compensation)
              const vw = video.videoWidth;
              const vh = video.videoHeight;
              const dw = window.innerWidth;
              const dh = window.innerHeight;
              const scale = Math.max(dw / vw, dh / vh);
              const offsetX = (dw - vw * scale) / 2;
              const offsetY = (dh - vh * scale) / 2;
              const rx = ((1 - tip.x) * vw * scale + offsetX) / dw;
              const ry = (tip.y * vh * scale + offsetY) / dh;

              const fist = isFist(lm);
              const s = smooth[handId];

              // Jump EMA to actual position on first appearance or after a tracking
              // gap — prevents the orb from drifting in from center (0.5, 0.5).
              const isNew = now - s.lastSeenMs > REAPPEAR_GAP_MS;
              s.lastSeenMs = now;

              if (!fist) {
                if (isNew) {
                  s.x = rx; s.y = ry;
                } else {
                  s.x = SMOOTH * rx + (1 - SMOOTH) * s.x;
                  s.y = SMOOTH * ry + (1 - SMOOTH) * s.y;
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

              signals.push({
                x: Math.max(0, Math.min(1, reportX)),
                y: Math.max(0, Math.min(1, reportY)),
                present: true,
                handId,
                fist,
                facing: classifyHandFacing(lm),
              });
            }
            signalRef.current = signals;
          }

          // Face inference at ~10fps for nod detection
          if (now - lastFaceInferenceTime >= FACE_INTERVAL) {
            const faceResult = faceLandmarker.detectForVideo(video, now);
            lastFaceInferenceTime = now;

            if (faceResult.faceLandmarks.length > 0) {
              const noseTip = faceResult.faceLandmarks[0][1];
              if (nodSmoothedY < 0) {
                // Seed EMA at actual nose position on first detection — same
                // pattern as the hand EMA — so dy starts near zero instead of
                // jumping from the 0.5 placeholder and false-triggering NODDING_UP.
                nodSmoothedY = noseTip.y;
                nodPrevY = noseTip.y;
              } else {
                nodSmoothedY = FACE_SMOOTH * noseTip.y + (1 - FACE_SMOOTH) * nodSmoothedY;
                const dy = nodSmoothedY - nodPrevY;
                nodPrevY = nodSmoothedY;

                if (now > nodDebounceUntil) {
                  if (nodState === 'IDLE') {
                    if (dy > NOD_DOWN_THRESHOLD) nodState = 'NODDING_DOWN';
                    else if (dy < NOD_UP_THRESHOLD) nodState = 'NODDING_UP';
                  } else if (nodState === 'NODDING_DOWN' && dy < 0) {
                    nodEventRef.current = 'down';
                    nodState = 'IDLE';
                    nodDebounceUntil = now + 750;
                  } else if (nodState === 'NODDING_UP' && dy > 0) {
                    nodEventRef.current = 'up';
                    nodState = 'IDLE';
                    nodDebounceUntil = now + 750;
                  }
                }
              }
            }
          }
        }
        animFrameId = requestAnimationFrame(loop);
      }
      animFrameId = requestAnimationFrame(loop);

      cleanupRef.current = () => {
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

  return { signalRef, mode, requestCamera, useMouse: switchToMouse, cameraVideoRef: videoRef, nodEventRef };
}
