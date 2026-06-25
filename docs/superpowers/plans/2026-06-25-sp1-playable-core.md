# SP1 — Playable Core Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire a full gesture→canvas pipeline so that opening the app and moving your hand (or mouse) produces an animated canvas reaction, proving Track A's audio integration point is ready.

**Architecture:** L1 (input hook) emits a `GestureSignal` ref each frame from either MediaPipe HandLandmarker or mouse fallback. The coordinator writes that ref and calls stubbed Track A functions. L4 (renderer) runs a `requestAnimationFrame` loop reading the ref directly — no React re-renders in the hot path.

**Tech Stack:** React 19, TypeScript, Vite, `@mediapipe/tasks-vision` (already installed), Canvas2D

## Global Constraints

- No React state in the hot path — gesture/audio updates flow through `useRef`, never `useState`
- Canvas2D only — no WebGL, Three.js, or PixiJS
- MediaPipe inference must never stall the render loop — skip frames on lag, reuse last signal
- Camera permission UI must include exactly: *"Your camera never leaves your device."*
- Mouse fallback must be labeled "mouse mode" with a prompt to try camera mode
- Background: `#0A0E1A`; warm zone: `#F59E0B → #D97706`; cursor orb: white-gold glow, ~20px base radius
- Do not edit `src/engine/audio/` or `src/engine/music/` — those are Track A's

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `src/engine/types.ts` | Create | Shared `GestureSignal` and `MusicalCommand` types |
| `src/engine/input/index.ts` | Create | `useGestureInput()` hook — camera + mouse fallback |
| `src/engine/renderer/index.ts` | Create | `useRenderer()` hook — Canvas2D rAF loop |
| `src/coordinator.ts` | Create | `useCoordinator()` — wires L1 + stubs + L4 |
| `src/App.tsx` | Modify | Replace scaffold: mount canvas, call coordinator |
| `src/App.css` | Modify | Full-screen dark canvas styles |

---

### Task 1: Define shared types

**Files:**
- Create: `src/engine/types.ts`

**Interfaces:**
- Produces: `GestureSignal`, `MusicalCommand` — consumed by every subsequent task

- [ ] **Step 1: Create `src/engine/types.ts`**

```typescript
// src/engine/types.ts

/** Produced by L1 (useGestureInput). Consumed by L2 (Track A) and L4 (renderer). */
export type GestureSignal = {
  x: number;        // 0–1, horizontal position (left = 0, right = 1)
  y: number;        // 0–1, vertical position (top = 0, bottom = 1)
  present: boolean; // is a hand/cursor actively tracked?
  handId: 'primary' | 'secondary';
};

/** Produced by L2 (Track A). Consumed by L3 (audio) and L4 (renderer). */
export type MusicalCommand = {
  chord: string;      // e.g. "Cmaj7"
  voicing: number[];  // MIDI note numbers
  register: number;   // 0–1, high to low
  texture: number;    // 0–1, sparse to dense
  tension: number;    // 0–1, tonal to dissonant (drives warm-zone color)
};
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc -b --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/engine/types.ts
git commit -m "feat: add GestureSignal and MusicalCommand shared types"
```

---

### Task 2: L1 Input hook — camera + mouse fallback

**Files:**
- Create: `src/engine/input/index.ts`

**Interfaces:**
- Consumes: `GestureSignal` from `../types`
- Produces: `useGestureInput(): GestureSignal` — called each render, reads from internal ref

**Notes on MediaPipe:**
- WASM files are served from jsDelivr CDN — no local copy needed
- Use `HandLandmarker` (not `GestureRecognizer`) for wrist/palm centroid tracking
- The model file URL: `https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task`
- Landmark index 0 = wrist; use that as the palm centroid
- Run inference with `detectForVideo(videoEl, performance.now())`

- [ ] **Step 1: Create `src/engine/input/index.ts`**

```typescript
// src/engine/input/index.ts
import { useEffect, useRef, useState } from 'react';
import type { GestureSignal } from '../types';

type InputMode = 'asking' | 'camera' | 'mouse';

const DEFAULT_SIGNAL: GestureSignal = {
  x: 0.5, y: 0.5, present: false, handId: 'primary',
};

export function useGestureInput(): { signal: GestureSignal; mode: InputMode; requestCamera: () => void; useMouse: () => void } {
  const signalRef = useRef<GestureSignal>({ ...DEFAULT_SIGNAL });
  const [mode, setMode] = useState<InputMode>('asking');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cleanupRef = useRef<(() => void) | null>(null);

  function useMouse() {
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
        handId: 'primary',
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
      await video.play();

      function loop() {
        if (cancelled) return;
        const result = landmarker.detectForVideo(video, performance.now());
        if (result.landmarks.length > 0) {
          const wrist = result.landmarks[0][0]; // landmark 0 = wrist
          // MediaPipe x is mirrored (right edge = 0) — flip it
          signalRef.current = {
            x: 1 - wrist.x,
            y: wrist.y,
            present: true,
            handId: 'primary',
          };
        } else {
          signalRef.current = { ...signalRef.current, present: false };
        }
        animFrameId = requestAnimationFrame(loop);
      }
      animFrameId = requestAnimationFrame(loop);

      cleanupRef.current = () => {
        stream.getTracks().forEach(t => t.stop());
        landmarker.close();
        cancelAnimationFrame(animFrameId);
      };
    }

    startCamera();

    return () => {
      cancelled = true;
      cancelAnimationFrame(animFrameId);
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, [mode]);

  return { signal: signalRef.current, mode, requestCamera, useMouse };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc -b --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/engine/input/index.ts
git commit -m "feat: add L1 input hook with camera and mouse fallback"
```

---

### Task 3: L4 Canvas Renderer hook

**Files:**
- Create: `src/engine/renderer/index.ts`

**Interfaces:**
- Consumes: `GestureSignal` from `../types`, `RefObject<HTMLCanvasElement>`, `AnalyserNode | null`
- Produces: `useRenderer(canvasRef, gestureRef, analyser): void`

- [ ] **Step 1: Create `src/engine/renderer/index.ts`**

```typescript
// src/engine/renderer/index.ts
import { useEffect } from 'react';
import type { RefObject } from 'react';
import type { GestureSignal } from '../types';

export function useRenderer(
  canvasRef: RefObject<HTMLCanvasElement>,
  gestureRef: RefObject<GestureSignal>,
  analyser: AnalyserNode | null
): void {
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d')!;
    const freqData = analyser ? new Uint8Array(analyser.frequencyBinCount) : null;
    let rafId: number;

    function resize() {
      canvas!.width = window.innerWidth;
      canvas!.height = window.innerHeight;
    }
    resize();
    window.addEventListener('resize', resize);

    function draw() {
      const w = canvas!.width;
      const h = canvas!.height;
      const signal = gestureRef.current!;

      // Clear
      ctx.clearRect(0, 0, w, h);

      // Background
      ctx.fillStyle = '#0A0E1A';
      ctx.fillRect(0, 0, w, h);

      // Warm zone — static amber radial gradient centered (SP2 will drive this from tension)
      const grad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.min(w, h) * 0.45);
      grad.addColorStop(0, 'rgba(245, 158, 11, 0.18)');   // #F59E0B
      grad.addColorStop(0.6, 'rgba(217, 119, 6, 0.08)');  // #D97706
      grad.addColorStop(1, 'rgba(217, 119, 6, 0)');
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, w, h);

      if (!signal.present) {
        rafId = requestAnimationFrame(draw);
        return;
      }

      // Audio amplitude → orb glow radius
      let amplitude = 0;
      if (analyser && freqData) {
        analyser.getByteFrequencyData(freqData);
        const sum = freqData.reduce((a, b) => a + b, 0);
        amplitude = sum / freqData.length / 255; // 0–1
      }

      const cx = signal.x * w;
      const cy = signal.y * h;
      const baseRadius = 20;
      const glowRadius = baseRadius + amplitude * 40;

      // Glow halo
      const orbGrad = ctx.createRadialGradient(cx, cy, 0, cx, cy, glowRadius * 2.5);
      orbGrad.addColorStop(0, 'rgba(255, 240, 200, 0.9)');
      orbGrad.addColorStop(0.3, 'rgba(245, 200, 100, 0.4)');
      orbGrad.addColorStop(1, 'rgba(245, 158, 11, 0)');
      ctx.fillStyle = orbGrad;
      ctx.beginPath();
      ctx.arc(cx, cy, glowRadius * 2.5, 0, Math.PI * 2);
      ctx.fill();

      // Core orb
      ctx.fillStyle = 'rgba(255, 248, 220, 0.95)';
      ctx.beginPath();
      ctx.arc(cx, cy, glowRadius, 0, Math.PI * 2);
      ctx.fill();

      rafId = requestAnimationFrame(draw);
    }

    rafId = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', resize);
    };
  }, [canvasRef, gestureRef, analyser]);
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc -b --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/engine/renderer/index.ts
git commit -m "feat: add L4 Canvas2D renderer with orb and warm zone"
```

---

### Task 4: Coordinator and permission screen

**Files:**
- Create: `src/coordinator.ts`
- Modify: `src/App.tsx`
- Modify: `src/App.css`

**Interfaces:**
- Consumes: `useGestureInput` from `./engine/input`, `useRenderer` from `./engine/renderer`, `GestureSignal` from `./engine/types`
- Produces: `useCoordinator(canvasRef)` — call from App

**Note:** Track A's `useAudio` and `mapGesture` are not ready yet — include stubs that will be deleted when Track A delivers. The stub comment is important so Track A knows where to integrate.

- [ ] **Step 1: Create `src/coordinator.ts`**

```typescript
// src/coordinator.ts
import { useEffect, useRef } from 'react';
import type { RefObject } from 'react';
import type { GestureSignal, MusicalCommand } from './engine/types';
import { useGestureInput } from './engine/input';
import { useRenderer } from './engine/renderer';

// --- Track A stubs — delete when Track A delivers useAudio and mapGesture ---
const mapGesture = (_s: GestureSignal, _vibe: string): MusicalCommand => ({
  chord: 'C',
  voicing: [60, 64, 67],
  register: 0.5,
  texture: 0.5,
  tension: 0.2,
});
const useAudio = () => ({
  play: (_cmd: MusicalCommand) => {},
  getAnalyser: (): AnalyserNode | null => null,
});
// --- end stubs ---

export function useCoordinator(canvasRef: RefObject<HTMLCanvasElement>) {
  const gestureRef = useRef<GestureSignal>({
    x: 0.5, y: 0.5, present: false, handId: 'primary',
  });

  const { signal, mode, requestCamera, useMouse } = useGestureInput();
  const { play, getAnalyser } = useAudio();
  const analyserRef = useRef<AnalyserNode | null>(getAnalyser());

  // Write latest signal into ref — no re-render
  useEffect(() => {
    gestureRef.current = signal;
  });

  // Fire audio on presence
  useEffect(() => {
    if (!signal.present) return;
    const cmd = mapGesture(signal, 'default');
    play(cmd);
  }, [signal, play]);

  useRenderer(canvasRef, gestureRef, analyserRef.current);

  return { mode, requestCamera, useMouse };
}
```

- [ ] **Step 2: Replace `src/App.tsx`**

```typescript
// src/App.tsx
import { useRef } from 'react';
import { useCoordinator } from './coordinator';
import './App.css';

function CameraPrompt({ onCamera, onMouse }: { onCamera: () => void; onMouse: () => void }) {
  return (
    <div className="permission-screen">
      <h1>Froola</h1>
      <p className="privacy-note">Your camera never leaves your device.</p>
      <p>MediaPipe runs entirely on your device — no video is transmitted.</p>
      <div className="permission-buttons">
        <button onClick={onCamera} className="btn-primary">Enable camera</button>
        <button onClick={onMouse} className="btn-secondary">Use mouse instead</button>
      </div>
    </div>
  );
}

function MouseModeBadge({ onSwitch }: { onSwitch: () => void }) {
  return (
    <div className="mode-badge">
      Mouse mode —{' '}
      <button onClick={onSwitch} className="link-btn">try camera mode</button>
    </div>
  );
}

function AppCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { mode, requestCamera, useMouse } = useCoordinator(canvasRef);

  return (
    <>
      <canvas ref={canvasRef} className="main-canvas" />
      {mode === 'asking' && (
        <CameraPrompt onCamera={requestCamera} onMouse={useMouse} />
      )}
      {mode === 'mouse' && (
        <MouseModeBadge onSwitch={requestCamera} />
      )}
    </>
  );
}

export default function App() {
  return <AppCanvas />;
}
```

- [ ] **Step 3: Replace `src/App.css`**

```css
/* src/App.css */
*, *::before, *::after {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  background: #0A0E1A;
  overflow: hidden;
}

.main-canvas {
  position: fixed;
  inset: 0;
  display: block;
}

.permission-screen {
  position: fixed;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  color: #e5e7eb;
  font-family: system-ui, sans-serif;
  text-align: center;
  padding: 2rem;
  background: rgba(10, 14, 26, 0.85);
  backdrop-filter: blur(4px);
}

.permission-screen h1 {
  font-size: 2.5rem;
  font-weight: 700;
  color: #f5d98a;
  letter-spacing: -0.02em;
}

.privacy-note {
  font-size: 1.1rem;
  color: #f59e0b;
  font-weight: 500;
}

.permission-buttons {
  display: flex;
  gap: 1rem;
  margin-top: 0.5rem;
}

.btn-primary {
  padding: 0.75rem 1.75rem;
  border-radius: 9999px;
  border: none;
  background: #f59e0b;
  color: #0A0E1A;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
}

.btn-primary:hover { background: #d97706; }

.btn-secondary {
  padding: 0.75rem 1.75rem;
  border-radius: 9999px;
  border: 1px solid rgba(245, 158, 11, 0.4);
  background: transparent;
  color: #e5e7eb;
  font-size: 1rem;
  cursor: pointer;
}

.btn-secondary:hover { border-color: #f59e0b; color: #f5d98a; }

.mode-badge {
  position: fixed;
  bottom: 1.5rem;
  left: 50%;
  transform: translateX(-50%);
  font-family: system-ui, sans-serif;
  font-size: 0.85rem;
  color: rgba(229, 231, 235, 0.5);
}

.link-btn {
  background: none;
  border: none;
  color: #f59e0b;
  cursor: pointer;
  font-size: inherit;
  text-decoration: underline;
}
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc -b --noEmit
```

Expected: no errors.

- [ ] **Step 5: Run the dev server and manually verify**

```bash
npm run dev
```

Open `http://localhost:5173` in the browser. Check:
1. Permission screen appears with the exact text *"Your camera never leaves your device."*
2. Clicking "Use mouse instead" shows the canvas; moving the mouse moves the glowing orb
3. Orb tracks cursor position continuously
4. "Mouse mode — try camera mode" badge appears at bottom
5. If you have a webcam: clicking "Enable camera" requests permission; granting it starts hand tracking; the orb follows your hand

- [ ] **Step 6: Commit**

```bash
git add src/coordinator.ts src/App.tsx src/App.css
git commit -m "feat: SP1 playable core — coordinator, permission screen, canvas wired"
```
