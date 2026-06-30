// src/engine/input/index.ts
import React, { useEffect, useRef, useState } from 'react';
import type { GestureSignal } from '../types';

export type InputMode = 'asking' | 'camera' | 'mouse';

const INPUT_MODE_KEY = 'froola-input-mode';

function savedMode(): InputMode | null {
  try {
    const v = localStorage.getItem(INPUT_MODE_KEY);
    return v === 'camera' || v === 'mouse' ? v : null;
  } catch { return null; }
}

export function useGestureInput(initialMode: InputMode = 'asking'): { signalRef: React.RefObject<GestureSignal[]>; mode: InputMode; requestCamera: () => void; useMouse: () => void; cameraVideoRef: React.RefObject<HTMLVideoElement | null>; trackingUnstable: boolean } {
  const signalRef = useRef<GestureSignal[]>([]);
  // Restore persisted choice so the user isn't re-prompted on every navigation
  const [mode, setMode] = useState<InputMode>(() =>
    initialMode === 'asking' ? (savedMode() ?? 'asking') : initialMode
  );
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);
  // True when tracking has been noisy for a sustained stretch — usually means
  // poor lighting is starving MediaPipe of detection confidence. Surfaced to
  // the UI so it can suggest finding better light.
  const [trackingUnstable, setTrackingUnstable] = useState(false);

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
      signalRef.current = [{
        x: e.clientX / window.innerWidth,
        y: e.clientY / window.innerHeight,
        present: true,
        handId: 'left',
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
      const { HandLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');

      const vision = await FilesetResolver.forVisionTasks(
        'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm'
      );

      const landmarker = await HandLandmarker.createFromOptions(vision, {
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
      });

      if (cancelled) { landmarker.close(); return; }

      const video = document.createElement('video');
      video.playsInline = true;
      video.muted = true;
      videoRef.current = video;

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1920 }, height: { ideal: 1080 }, facingMode: 'user' },
        });
      } catch {
        try { localStorage.setItem(INPUT_MODE_KEY, 'mouse'); } catch { /* ignore */ }
        setMode('mouse');
        landmarker.close();
        return;
      }

      if (cancelled) { stream.getTracks().forEach(t => t.stop()); landmarker.close(); return; }

      video.srcObject = stream;
      video.style.cssText = 'position:fixed;inset:0;width:100%;height:100%;object-fit:cover;z-index:0;pointer-events:none;transform:scaleX(-1);';
      document.body.appendChild(video);
      await video.play();
      if (cancelled) {
        if (video.parentNode) video.parentNode.removeChild(video);
        stream.getTracks().forEach(t => t.stop());
        landmarker.close();
        return;
      }

      // Per-hand EMA + fist-lock state
      const SMOOTH = 0.18;
      // How long (ms) a hand must be absent before we re-initialize its EMA
      // on the next appearance instead of blending from the stale position.
      // Prevents the orb from snapping to the 0.5,0.5 default when a hand
      // first appears or briefly drops out (e.g. due to handedness flipping).
      const REAPPEAR_GAP_MS = 300;
      // A real hand can't teleport more than this fraction of the screen in a
      // single ~33ms inference tick. A single noisy/low-confidence detection
      // (motion blur, brief occlusion) can land anywhere, including near
      // (0.5, 0.5) — without a clamp, that one bad frame tugs the EMA toward
      // the screen centre and shows up as a visible jitter/snap. Frames whose
      // jump exceeds this are treated as noise and held; if the jump persists
      // for MAX_REJECT_STREAK frames in a row it's accepted as real movement
      // (e.g. an intentional fast swing, or hands crossing sides) so legitimate
      // motion never gets stuck.
      const MAX_JUMP = 0.28;
      const MAX_REJECT_STREAK = 2;
      type HandState = {
        x: number; y: number; lastSeenMs: number; rejectStreak: number;
        // Last frame's raw (pre-smoothing) movement vector — used to detect
        // a hand zigzagging in place (jitter) rather than moving anywhere.
        prevDx: number; prevDy: number;
        wasFist: boolean; frozenX: number | null; frozenY: number | null;
      };
      const smooth: Record<'left' | 'right', HandState> = {
        left:  { x: 0.5, y: 0.5, lastSeenMs: -Infinity, rejectStreak: 0, prevDx: 0, prevDy: 0, wasFist: false, frozenX: null, frozenY: null },
        right: { x: 0.5, y: 0.5, lastSeenMs: -Infinity, rejectStreak: 0, prevDx: 0, prevDy: 0, wasFist: false, frozenX: null, frozenY: null },
      };
      // Sticky left/right assignment for the single-hand case — without this,
      // a lone hand hovering near the screen's horizontal centre can flip
      // its assigned id every frame, each flip briefly spawning a phantom
      // orb near (0.5, *) on the newly-assigned side.
      let soloId: 'left' | 'right' | null = null;
      const SOLO_HYSTERESIS = 0.05;

      // Direction-reversal threshold for jitter detection: cos(angle) between
      // this frame's and last frame's raw movement vectors below this means
      // they point meaningfully opposite ways (>~107°) — a hand oscillating
      // back and forth rather than moving somewhere. Below MIN_JITTER_MAG the
      // movement is too small to judge direction reliably and is ignored.
      const REVERSAL_COS = -0.3;
      const MIN_JITTER_MAG = 0.015;

      // Tracking-quality heuristic: bad lighting starves MediaPipe of
      // detection confidence. The clearest symptom — a hand zigzagging in
      // small steps that individually stay under MAX_JUMP — never trips a
      // reject and never changes hand count, so it's invisible to those
      // signals alone. Direction-reversal catches it regardless of step
      // size, without flagging legitimate fast movement (which is
      // directional, not oscillating). All three signals feed a slow-moving
      // "badness" score so a single blip doesn't trigger the warning.
      let prevHandCount = 0;
      let trackingBadness = 0;
      const BADNESS_ON = 0.35;
      const BADNESS_OFF = 0.15;
      let unstable = false;

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

      function loop() {
        if (cancelled) return;
        const now = performance.now();
        if (now - lastInferenceTime >= INFERENCE_INTERVAL) {
          const result = landmarker.detectForVideo(video, now);
          lastInferenceTime = now;

          // Remap from video-native coords to viewport coords (object-fit:cover compensation)
          const vw = video.videoWidth;
          const vh = video.videoHeight;
          const dw = window.innerWidth;
          const dh = window.innerHeight;
          const scale = Math.max(dw / vw, dh / vh);
          const offsetX = (dw - vw * scale) / 2;
          const offsetY = (dh - vh * scale) / 2;

          const detections = result.landmarks.map(lm => {
            const tip = lm[8]; // index fingertip
            return {
              rx: ((1 - tip.x) * vw * scale + offsetX) / dw,
              ry: (tip.y * vh * scale + offsetY) / dh,
              fist: isFist(lm),
            };
          });

          // Assign left/right by on-screen x position rather than MediaPipe's
          // per-frame handedness label. MediaPipe re-classifies handedness
          // independently every frame with no identity tracking across frames,
          // so when both hands are close together (exactly what happens during
          // a chord) it can flip "Left"/"Right" several times a second. Since
          // that flip touches both labels almost every frame, the EMA for each
          // side keeps grabbing the other hand's position and both orbs drag
          // toward the midpoint between the hands — "stuck in the middle".
          // Screen position is stable frame to frame and matches what the user
          // sees (left wheel responds to whichever hand is on the left).
          let ids: Array<'left' | 'right'>;
          if (detections.length === 2) {
            ids = detections[0].rx <= detections[1].rx ? ['left', 'right'] : ['right', 'left'];
          } else if (detections.length === 1) {
            const rx0 = detections[0].rx;
            if (soloId === null) {
              soloId = rx0 < 0.5 ? 'left' : 'right';
            } else if (soloId === 'left' && rx0 > 0.5 + SOLO_HYSTERESIS) {
              soloId = 'right';
            } else if (soloId === 'right' && rx0 < 0.5 - SOLO_HYSTERESIS) {
              soloId = 'left';
            }
            ids = [soloId];
          } else {
            ids = [];
          }

          let rejectedThisTick = false;
          let reversedThisTick = false;

          const signals: GestureSignal[] = [];
          for (let i = 0; i < detections.length; i++) {
            const handId = ids[i];
            const { rx, ry, fist } = detections[i];
            const s = smooth[handId];

            // Jump EMA to actual position on first appearance or after a tracking
            // gap — prevents the orb from drifting in from center (0.5, 0.5).
            const isNew = now - s.lastSeenMs > REAPPEAR_GAP_MS;
            s.lastSeenMs = now;

            if (!fist) {
              if (isNew) {
                s.x = rx; s.y = ry;
                s.rejectStreak = 0;
                s.prevDx = 0; s.prevDy = 0;
              } else {
                const dx = rx - s.x;
                const dy = ry - s.y;
                const jump = Math.hypot(dx, dy);

                const prevMag = Math.hypot(s.prevDx, s.prevDy);
                if (jump > MIN_JITTER_MAG && prevMag > MIN_JITTER_MAG) {
                  const cosAngle = (dx * s.prevDx + dy * s.prevDy) / (jump * prevMag);
                  if (cosAngle < REVERSAL_COS) reversedThisTick = true;
                }
                s.prevDx = dx; s.prevDy = dy;

                if (jump > MAX_JUMP && s.rejectStreak < MAX_REJECT_STREAK) {
                  // Implausible single-frame jump — likely a noisy/misclassified
                  // detection. Hold the last good position instead of blending
                  // toward it.
                  s.rejectStreak++;
                  rejectedThisTick = true;
                } else {
                  s.x = SMOOTH * rx + (1 - SMOOTH) * s.x;
                  s.y = SMOOTH * ry + (1 - SMOOTH) * s.y;
                  s.rejectStreak = 0;
                }
              }
            } else if (isNew) {
              // Fist on reappearance: seed EMA at actual position so the freeze
              // captures the real hand location, not the stale center default.
              s.x = rx; s.y = ry;
              s.prevDx = 0; s.prevDy = 0;
              s.rejectStreak = 0;
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
            });
          }
          signalRef.current = signals;

          // Update the rolling tracking-quality score. A flicker or a single
          // reversed step on its own (e.g. putting a hand up, or one quick
          // direction change during normal play) barely moves a slow EMA;
          // only sustained instability — repeated rejects, hands dropping
          // detection, or a hand visibly zigzagging in place — pushes it
          // past the threshold.
          const flickerThisTick = detections.length !== prevHandCount;
          prevHandCount = detections.length;
          const tickBad =
            (rejectedThisTick ? 0.5 : 0) +
            (flickerThisTick ? 0.3 : 0) +
            (reversedThisTick ? 0.45 : 0);
          trackingBadness = trackingBadness * 0.95 + tickBad * 0.05;

          if (!unstable && trackingBadness > BADNESS_ON) {
            unstable = true;
            setTrackingUnstable(true);
          } else if (unstable && trackingBadness < BADNESS_OFF) {
            unstable = false;
            setTrackingUnstable(false);
          }
        }
        animFrameId = requestAnimationFrame(loop);
      }
      animFrameId = requestAnimationFrame(loop);

      cleanupRef.current = () => {
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
      setTrackingUnstable(false);
    };
  }, [mode]);

  return { signalRef, mode, requestCamera, useMouse: switchToMouse, cameraVideoRef: videoRef, trackingUnstable };
}
