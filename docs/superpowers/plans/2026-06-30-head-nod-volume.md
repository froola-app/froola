# Head Nod Volume Control — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Nodding up increases master volume by 10%; nodding down decreases it by 10%, detected via MediaPipe FaceLandmarker running alongside the existing HandLandmarker.

**Architecture:** FaceLandmarker runs on the same camera video element as HandLandmarker, throttled to ~10fps inside the existing rAF loop. Nod events are written to a `nodEventRef` in the input layer, consumed and cleared by the coordinator's rAF tick, which steps volume on `AudioEngine.setVolume()` and notifies PlayShell via a callback for a transient badge display.

**Tech Stack:** MediaPipe Tasks Vision (`@mediapipe/tasks-vision`), Web Audio API, React 19, TypeScript

## Global Constraints

- No new npm packages — FaceLandmarker is already in `@mediapipe/tasks-vision`
- All high-frequency updates via mutable refs, never React state
- Model asset loaded from `https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task`
- Volume range: 0.0–1.0, step size 0.1, 10 steps total
- Debounce: 750ms between nod events
- `npm test` must stay green (47 tests, 0 failures)

---

### Task 1: AudioEngine.setVolume()

**Files:**
- Modify: `src/engine/audio/AudioEngine.ts`
- Modify: `src/engine/audio/AudioEngine.test.ts`

**Interfaces:**
- Produces: `setVolume(v: number): void` — clamps to [0,1], ramps masterGain over 80ms

- [ ] **Step 1: Write the failing test**

Add to `src/engine/audio/AudioEngine.test.ts`:

```typescript
describe('AudioEngine — setVolume', () => {
  it('ramps masterGain to clamped value over 80ms', () => {
    const engine = new AudioEngine()
    const gainNode = mockAudioContext.createGain.mock.results[0].value
    engine.setVolume(0.5)
    expect(gainNode.gain.linearRampToValueAtTime).toHaveBeenCalledWith(
      0.5,
      expect.any(Number),
    )
  })

  it('clamps volume above 1.0 to 1.0', () => {
    const engine = new AudioEngine()
    const gainNode = mockAudioContext.createGain.mock.results[0].value
    engine.setVolume(1.5)
    expect(gainNode.gain.linearRampToValueAtTime).toHaveBeenCalledWith(
      1.0,
      expect.any(Number),
    )
  })

  it('clamps volume below 0.0 to 0.0', () => {
    const engine = new AudioEngine()
    const gainNode = mockAudioContext.createGain.mock.results[0].value
    engine.setVolume(-0.2)
    expect(gainNode.gain.linearRampToValueAtTime).toHaveBeenCalledWith(
      0.0,
      expect.any(Number),
    )
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
npm test -- --reporter=verbose 2>&1 | grep -A3 "setVolume"
```

Expected: FAIL — `setVolume is not a function`

- [ ] **Step 3: Implement setVolume**

Add this method to `AudioEngine` class in `src/engine/audio/AudioEngine.ts`, after the `suspend()` method:

```typescript
setVolume(v: number): void {
  const clamped = Math.max(0, Math.min(1, v))
  const now = this.ctx.currentTime
  this.masterGain.gain.cancelScheduledValues(now)
  this.masterGain.gain.setValueAtTime(this.masterGain.gain.value, now)
  this.masterGain.gain.linearRampToValueAtTime(clamped, now + 0.08)
}
```

- [ ] **Step 4: Run tests**

```bash
npm test
```

Expected: all tests pass (47+3 = 50)

- [ ] **Step 5: Commit**

```bash
git add src/engine/audio/AudioEngine.ts src/engine/audio/AudioEngine.test.ts
git commit -m "feat: AudioEngine.setVolume() ramps masterGain over 80ms"
```

---

### Task 2: FaceLandmarker + Nod Detection in Input Layer

**Files:**
- Modify: `src/engine/input/index.ts`

**Interfaces:**
- Consumes: existing `vision` FilsetResolver result, existing `video` element from HandLandmarker setup
- Produces: `nodEventRef: React.RefObject<'up' | 'down' | null>` added to `useGestureInput` return value

- [ ] **Step 1: Add nodEventRef and return it from useGestureInput**

In `src/engine/input/index.ts`, add `nodEventRef` alongside the existing refs. Update the function signature and return:

```typescript
// Add after the existing refs (after cleanupRef):
const nodEventRef = useRef<'up' | 'down' | null>(null);
```

Update the return type annotation on `useGestureInput` to include `nodEventRef: React.RefObject<'up' | 'down' | null>`:

```typescript
export function useGestureInput(initialMode: InputMode = 'asking'): {
  signalRef: React.RefObject<GestureSignal[]>;
  mode: InputMode;
  requestCamera: () => void;
  useMouse: () => void;
  cameraVideoRef: React.RefObject<HTMLVideoElement | null>;
  nodEventRef: React.RefObject<'up' | 'down' | null>;
}
```

Update the return statement at the bottom of the function:

```typescript
return { signalRef, mode, requestCamera, useMouse: switchToMouse, cameraVideoRef: videoRef, nodEventRef };
```

- [ ] **Step 2: Add FaceLandmarker loading inside startCamera**

Inside `startCamera()`, after `HandLandmarker.createFromOptions(...)` resolves and before the `stream` is requested, add:

```typescript
const { FaceLandmarker } = await import('@mediapipe/tasks-vision');

const faceLandmarker = await FaceLandmarker.createFromOptions(vision, {
  baseOptions: {
    modelAssetPath:
      'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
    delegate: 'GPU',
  },
  runningMode: 'VIDEO',
  numFaces: 1,
  minFaceDetectionConfidence: 0.5,
  minTrackingConfidence: 0.5,
});

if (cancelled) { landmarker.close(); faceLandmarker.close(); return; }
```

Also update the two early-exit `cancelled` checks after `stream` and after `video.play()` to also close `faceLandmarker`:

```typescript
// After stream acquisition:
if (cancelled) { stream.getTracks().forEach(t => t.stop()); landmarker.close(); faceLandmarker.close(); return; }

// After video.play():
if (cancelled) {
  if (video.parentNode) video.parentNode.removeChild(video);
  stream.getTracks().forEach(t => t.stop());
  landmarker.close();
  faceLandmarker.close();
  return;
}
```

Update the `cleanupRef` to close faceLandmarker:

```typescript
cleanupRef.current = () => {
  stream.getTracks().forEach(t => t.stop());
  landmarker.close();
  faceLandmarker.close();
  cancelAnimationFrame(animFrameId);
  if (video.parentNode) video.parentNode.removeChild(video);
};
```

- [ ] **Step 3: Add nod state machine variables before loop()**

Add these variables directly before `function loop()`:

```typescript
const FACE_INTERVAL = 100; // ms (~10 fps)
let lastFaceInferenceTime = 0;
let nodSmoothedY = 0.5;
let nodPrevY = 0.5;
let nodState: 'IDLE' | 'NODDING_DOWN' | 'NODDING_UP' = 'IDLE';
let nodDebounceUntil = 0;
const NOD_DOWN_THRESHOLD = 0.018;
const NOD_UP_THRESHOLD = -0.018;
const FACE_SMOOTH = 0.4;
```

- [ ] **Step 4: Add face inference + nod detection inside loop()**

Inside `function loop()`, after `signalRef.current = signals;` and before `animFrameId = requestAnimationFrame(loop);`, add:

```typescript
// Face inference at ~10fps for nod detection
if (now - lastFaceInferenceTime >= FACE_INTERVAL) {
  const faceResult = faceLandmarker.detectForVideo(video, now);
  lastFaceInferenceTime = now;

  if (faceResult.faceLandmarks.length > 0) {
    const noseTip = faceResult.faceLandmarks[0][1]; // nose tip landmark
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
```

- [ ] **Step 5: Run tests**

```bash
npm test
```

Expected: all tests still pass (input layer has no unit tests; this verifies nothing broke)

- [ ] **Step 6: Commit**

```bash
git add src/engine/input/index.ts
git commit -m "feat: add FaceLandmarker nod detection to input layer"
```

---

### Task 3: Coordinator — Volume Ref + Nod Wiring

**Files:**
- Modify: `src/coordinator.ts`

**Interfaces:**
- Consumes: `nodEventRef` from `useGestureInput`; `engine.setVolume(v)` from Task 1
- Produces: new optional 8th parameter `onVolumeChange?: (v: number) => void`

- [ ] **Step 1: Add onVolumeChange parameter and volumeRef**

In `src/coordinator.ts`, update the `useCoordinator` signature to add the 8th parameter:

```typescript
export function useCoordinator(
  canvasRef: RefObject<HTMLCanvasElement | null>,
  modeRef: RefObject<InstrumentMode>,
  initialMode: InputMode = 'asking',
  octaveRef?: RefObject<number>,
  externalSignalRef?: RefObject<GestureSignal[]>,
  musicRef?: RefObject<MusicConfig>,
  ghostSignalsRef?: RefObject<GestureSignal[]>,
  onVolumeChange?: (v: number) => void,
)
```

Add `volumeRef` alongside the existing refs near the top of the function body:

```typescript
const volumeRef = useRef(1.0);
```

- [ ] **Step 2: Destructure nodEventRef from input**

Update the destructuring of `input` to include `nodEventRef`:

```typescript
const { mode, requestCamera, useMouse, cameraVideoRef, nodEventRef } = input;
```

- [ ] **Step 3: Consume nodEventRef in the rAF tick**

Inside `function tick()`, after the `if (latched && engine)` block and before the `touching` / grace logic, add:

```typescript
// Nod gesture → volume step
const nod = nodEventRef.current;
if (nod && engine) {
  volumeRef.current = nod === 'up'
    ? Math.min(volumeRef.current + 0.1, 1.0)
    : Math.max(volumeRef.current - 0.1, 0.0);
  // Round to avoid floating-point drift (0.30000000000000004 etc.)
  volumeRef.current = Math.round(volumeRef.current * 10) / 10;
  engine.setVolume(volumeRef.current);
  onVolumeChange?.(volumeRef.current);
  nodEventRef.current = null;
}
```

- [ ] **Step 4: Run tests**

```bash
npm test
```

Expected: all tests pass

- [ ] **Step 5: Commit**

```bash
git add src/coordinator.ts
git commit -m "feat: coordinator wires nod events to volume steps"
```

---

### Task 4: PlayShell Volume Badge

**Files:**
- Modify: `src/components/PlayShell.tsx`
- Modify: `src/App.css`

**Interfaces:**
- Consumes: `onVolumeChange` callback (8th param) added to `useCoordinator` in Task 3

- [ ] **Step 1: Add volume badge state and callback in PlayShell**

In `src/components/PlayShell.tsx`, add volume display state after the existing `useState` calls:

```typescript
const [volumeDisplay, setVolumeDisplay] = useState<number | null>(null);
const volumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

const handleVolumeChange = useCallback((v: number) => {
  setVolumeDisplay(Math.round(v * 100));
  if (volumeTimerRef.current) clearTimeout(volumeTimerRef.current);
  volumeTimerRef.current = setTimeout(() => setVolumeDisplay(null), 1500);
}, []);
```

- [ ] **Step 2: Pass onVolumeChange to useCoordinator**

Update the `useCoordinator` call in PlayShell to pass `handleVolumeChange` as the 8th argument:

```typescript
const { mode, requestCamera, useMouse, selectedRef, vibe, preloadSampler, cameraVideoRef, engineRef } = useCoordinator(
  canvasRef, modeRef, initialInput, octaveRef, undefined, musicRef, undefined, handleVolumeChange
);
```

- [ ] **Step 3: Render the volume badge**

In the JSX return, add the badge after the `<canvas>` element:

```tsx
{volumeDisplay !== null && (
  <div className="volume-badge">vol {volumeDisplay}%</div>
)}
```

- [ ] **Step 4: Add volume badge CSS**

In `src/App.css`, append:

```css
.volume-badge {
  position: fixed;
  top: 1rem;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
  background: rgba(20, 20, 30, 0.85);
  color: #E5E7EB;
  font-family: 'DM Sans', system-ui, sans-serif;
  font-size: 0.8rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  padding: 0.3rem 0.75rem;
  border-radius: 999px;
  pointer-events: none;
}
```

- [ ] **Step 5: Run tests**

```bash
npm test
```

Expected: all tests pass

- [ ] **Step 6: Commit**

```bash
git add src/components/PlayShell.tsx src/App.css
git commit -m "feat: volume badge appears on nod gesture"
```

---

## Self-Review

**Spec coverage:**
- ✅ FaceLandmarker on same camera stream (Task 2)
- ✅ ~10fps face inference (Task 2, FACE_INTERVAL=100ms)
- ✅ Nose tip landmark index 1 (Task 2)
- ✅ EMA smoothing α=0.4 (Task 2, FACE_SMOOTH=0.4)
- ✅ State machine: IDLE → NODDING_DOWN/UP → event on reversal (Task 2)
- ✅ Debounce 750ms (Task 2)
- ✅ nodEventRef written by input, cleared by coordinator (Tasks 2+3)
- ✅ setVolume with 80ms ramp on masterGain (Task 1)
- ✅ Volume 0–1, 10% steps, clamped (Tasks 1+3)
- ✅ Floating-point rounding (Task 3)
- ✅ onVolumeChange callback (Task 3)
- ✅ Volume badge 1500ms auto-clear (Task 4)
- ✅ Mouse/touch mode: nodEventRef never written, no special handling needed
- ✅ FaceLandmarker closed on cleanup (Task 2)

**Placeholder scan:** None found.

**Type consistency:**
- `nodEventRef: React.RefObject<'up' | 'down' | null>` — consistent across Tasks 2 and 3
- `onVolumeChange?: (v: number) => void` — consistent across Tasks 3 and 4
- `setVolume(v: number): void` — defined in Task 1, consumed in Task 3
