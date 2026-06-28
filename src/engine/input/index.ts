// src/engine/input/index.ts
import React, { useEffect, useRef, useState } from 'react';
import type { GestureSignal } from '../types';

type InputMode = 'asking' | 'camera' | 'mouse';

const DEFAULT_SIGNAL: GestureSignal = {
  x: 0.5, y: 0.5, present: false, handId: 'left',
};

export function useGestureInput(): { signalRef: React.RefObject<GestureSignal>; mode: InputMode; requestCamera: () => void; useMouse: () => void } {
  const signalRef = useRef<GestureSignal>({ ...DEFAULT_SIGNAL });
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
    signalRef.current = { ...DEFAULT_SIGNAL, present: true };

    function onMove(e: MouseEvent) {
      signalRef.current = {
        x: e.clientX / window.innerWidth,
        y: e.clientY / window.innerHeight,
        present: true,
        handId: 'left',
      };
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
        numHands: 1,
      });

      if (cancelled) { landmarker.close(); return; }

      const video = document.createElement('video');
      video.playsInline = true;
      video.muted = true;
      videoRef.current = video;

      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
      } catch {
        // camera denied — silently fall back to mouse
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

      // EMA state — smooths out landmark noise near edges / face occlusion
      const SMOOTH = 0.35;
      let smoothX = 0.5;
      let smoothY = 0.5;

      function loop() {
        if (cancelled) return;
        const now = performance.now();
        if (now - lastInferenceTime >= INFERENCE_INTERVAL) {
          const result = landmarker.detectForVideo(video, now);
          lastInferenceTime = now;
          if (result.landmarks.length > 0) {
            const tip = result.landmarks[0][8];
            // Remap from video-native coords to viewport coords to compensate
            // for object-fit:cover cropping (landmark 0,0 is not viewport 0,0)
            const vw = video.videoWidth;
            const vh = video.videoHeight;
            const dw = window.innerWidth;
            const dh = window.innerHeight;
            const scale = Math.max(dw / vw, dh / vh);
            const offsetX = (dw - vw * scale) / 2;
            const offsetY = (dh - vh * scale) / 2;
            const rx = ((1 - tip.x) * vw * scale + offsetX) / dw;
            const ry = (tip.y * vh * scale + offsetY) / dh;
            smoothX = SMOOTH * rx + (1 - SMOOTH) * smoothX;
            smoothY = SMOOTH * ry + (1 - SMOOTH) * smoothY;
            signalRef.current = {
              x: Math.max(0, Math.min(1, smoothX)),
              y: Math.max(0, Math.min(1, smoothY)),
              present: true,
              handId: 'left',
            };
          } else {
            signalRef.current = { ...signalRef.current, present: false };
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
    };
  }, [mode]);

  return { signalRef, mode, requestCamera, useMouse: switchToMouse };
}
