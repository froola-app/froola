// src/engine/input/index.ts
import React, { useEffect, useRef, useState } from 'react';
import type { GestureSignal } from '../types';

type InputMode = 'asking' | 'camera' | 'mouse';

export function useGestureInput(): { signalRef: React.RefObject<GestureSignal[]>; mode: InputMode; requestCamera: () => void; useMouse: () => void } {
  const signalRef = useRef<GestureSignal[]>([]);
  const [mode, setMode] = useState<InputMode>('asking');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  function switchToMouse() {
    setMode('mouse');
  }

  function requestCamera() {
    setMode('camera');
  }

  // Mouse mode
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
    window.addEventListener('mousemove', onMove);
    return () => window.removeEventListener('mousemove', onMove);
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
      const SMOOTH = 0.35;
      type HandState = { x: number; y: number; wasFist: boolean; frozenX: number | null; frozenY: number | null };
      const smooth: Record<'left' | 'right', HandState> = {
        left:  { x: 0.5, y: 0.5, wasFist: false, frozenX: null, frozenY: null },
        right: { x: 0.5, y: 0.5, wasFist: false, frozenX: null, frozenY: null },
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

      function loop() {
        if (cancelled) return;
        const now = performance.now();
        if (now - lastInferenceTime >= INFERENCE_INTERVAL) {
          const result = landmarker.detectForVideo(video, now);
          lastInferenceTime = now;

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

            // Only update EMA when hand is open — curled fingertip coords are invalid
            if (!fist) {
              s.x = SMOOTH * rx + (1 - SMOOTH) * s.x;
              s.y = SMOOTH * ry + (1 - SMOOTH) * s.y;
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
    };
  }, [mode]);

  return { signalRef, mode, requestCamera, useMouse: switchToMouse };
}
