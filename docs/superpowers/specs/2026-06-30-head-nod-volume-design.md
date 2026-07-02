# Head Nod Volume Control — Design Spec

**Date:** 2026-06-30
**Status:** Approved

## Overview

Nodding up increases master volume by one step; nodding down decreases it. Detection uses MediaPipe FaceLandmarker running on the existing camera stream alongside the current HandLandmarker. Each nod fires a discrete ±10% volume step on the AudioEngine's master gain.

## 1. Input Layer — FaceLandmarker + Nod Detection

**File:** `src/engine/input/index.ts`

A `FaceLandmarker` model loads on the same camera video element as the existing `HandLandmarker`. It runs on a separate `setInterval` at ~100ms (not the hand rAF loop) to avoid stalling hand inference.

**Landmark used:** nose tip = index 1 in the FaceLandmarker result.

**Nod detection state machine (runs each 100ms tick):**

1. Compute smoothed nose-tip y using EMA (α = 0.4) to reduce noise.
2. Compute `dy = smoothedY - prevSmoothedY`.
3. If `dy > +0.018` (nose moving down in screen coords): enter `NODDING_DOWN`.
4. If in `NODDING_DOWN` and `dy` reverses to `< 0` (head returning up): fire `'down'` event, go to `IDLE`.
5. Mirror for up: `dy < -0.018` → `NODDING_UP`; reversal fires `'up'` event.
6. **Debounce:** after any fired event, suppress new events for 750ms.

**Output:** `nodEventRef: RefObject<'up' | 'down' | null>` — written by the face loop, cleared by the coordinator after consumption.

The FaceLandmarker is only created when camera mode is active (same lifecycle as HandLandmarker). It is closed and the interval cleared on cleanup.

**FaceLandmarker config:**
- `numFaces: 1`
- `runningMode: 'VIDEO'`
- `minFaceDetectionConfidence: 0.5`
- `minTrackingConfidence: 0.5`

## 2. AudioEngine — `setVolume`

**File:** `src/engine/audio/AudioEngine.ts`

New public method:

```ts
setVolume(v: number): void
```

- Clamps `v` to `[0, 1]`.
- Calls `masterGain.gain.linearRampToValueAtTime(v, ctx.currentTime + 0.08)` for a click-free 80ms ramp.

## 3. Coordinator — Volume State + Nod Wiring

**File:** `src/coordinator.ts`

- Accepts a new optional prop: `onVolumeChange?: (v: number) => void`.
- Holds `volumeRef = useRef(1.0)` (master volume, 0–1, 10 steps).
- Each rAF tick, after audio logic:
  - Read `nodEventRef.current`.
  - If `'up'`: `volumeRef.current = Math.min(volumeRef.current + 0.1, 1.0)`, call `engine.setVolume(volumeRef.current)`, call `onVolumeChange?.(volumeRef.current)`.
  - If `'down'`: `volumeRef.current = Math.max(volumeRef.current - 0.1, 0.0)`, same.
  - Set `nodEventRef.current = null`.

`nodEventRef` is produced by the input layer and passed into the coordinator (same pattern as `signalRef`).

## 4. PlayShell — Visual Feedback

**File:** `src/components/PlayShell.tsx`

- State: `volumeDisplay: number | null` (null = hidden).
- `onVolumeChange` callback: sets `volumeDisplay` to the new value, clears any pending timeout, sets a new `setTimeout` to reset it to `null` after 1500ms.
- Renders a small fixed badge (top-center, above the HUD) showing e.g. `vol 70%` when `volumeDisplay !== null`.

**Badge styling (inline in App.css):**
- `position: fixed`, `top: 1rem`, `left: 50%`, `transform: translateX(-50%)`
- Pill shape, dark background, white text, `font-size: 0.8rem`
- No animation needed — it appears and disappears on the timeout.

## 5. Mouse/Touch Mode

FaceLandmarker only initialises in camera mode. In mouse/touch mode `nodEventRef` is never written, so the volume stays at 1.0 and `onVolumeChange` is never called. No special handling needed.

## Files Changed

| File | Change |
|---|---|
| `src/engine/input/index.ts` | Add FaceLandmarker, nod state machine, `nodEventRef` output |
| `src/engine/audio/AudioEngine.ts` | Add `setVolume(v)` method |
| `src/coordinator.ts` | Add `volumeRef`, consume `nodEventRef`, call `onVolumeChange` |
| `src/components/PlayShell.tsx` | Pass `onVolumeChange`, render volume badge |
| `src/App.css` | Volume badge styles |

## Out of Scope

- Volume persistence across sessions
- Nod detection in mouse/touch mode
- Variable step size
- Mute gesture
