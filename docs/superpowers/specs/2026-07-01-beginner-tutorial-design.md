# Beginner Tutorial & Hand Guardrail — Design Spec
_2026-07-01_

## Goal

Make Froola accessible to absolute beginners with zero music knowledge. Target user: someone who has never used the app and doesn't know what the wheels do or where to put their hands.

## Overview

Two new features added to PlayShell:

1. **Hand Guardrail** — a persistent canvas overlay showing where hands should be positioned. Always on by default, toggleable off.
2. **Beginner Tutorial** — a 4-step overlay that walks first-time users through the instrument interactively. Shown once, skippable at any time.

Both features are also active in LearnShell (same renderer), so beginners get guidance during lessons too.

---

## Feature 1: Hand Guardrail

### What it does
Draws two faint target zones on the canvas showing where hands need to be to reach the wheels. Pulses gently when no hands are detected in frame. Fades to a subtle static outline when hands are present.

### Visual
- Two soft glowing rings or outlined hand silhouettes in the upper half of the screen, roughly aligned with where each wheel sits
- Pulses gently when no hands are detected
- Disappears completely when any hand is detected in frame
- Drawn behind hand orbs (z-order: guardrail → orbs → UI)

### Implementation
- Drawn by the existing canvas renderer (`src/engine/renderer/index.ts`) so it stays on the hot path with no React re-renders
- Controlled by a `guardrailRef: RefObject<boolean>` passed into `useRenderer`
- Toggle: small hand icon button in the PlayShell HUD (next to octave control)
- Toggle state persisted in localStorage key `froola.guardrail` (default: `true`)
- On toggle, flip the ref value — renderer reads it each frame, no state update needed

### Scope
- Shown in PlayShell and LearnShell (both use the same renderer)
- Not shown in ReplayShell (no live hands)

---

## Feature 2: Beginner Tutorial

### What it does
A 4-step interactive overlay shown on first visit. Each step gives a short instruction and waits for the user to complete a real gesture before advancing. Teaches the instrument through doing, not reading.

### Steps

| # | Headline | Body | Completes when |
|---|----------|------|----------------|
| 1 | "Hold your hands up" | "Lift both hands in front of your camera" | Any hand signal detected in `signalRef` |
| 2 | "Touch the left circle" | "Move your left hand onto the big circle on the left" | Left hand position lands inside the left wheel ring |
| 3 | "Slide around to change the chord" | "Keep your hand on the circle and move it — hear the music change" | Left hand visits 3 or more distinct note slices |
| 4 | "Try the right circle" | "Put your right hand on the right circle for different flavors" | Right hand lands inside the right wheel ring |

After step 4: brief "You're ready — have fun!" message (1.5s), then overlay fades.

### UI
- Dark semi-transparent backdrop over PlayShell (camera feed and wheels still visible behind it)
- Step headline + one-sentence instruction centered on screen
- Visual highlight (arrow or glow) pointing at the relevant part of the UI
- "Skip tutorial" text link always visible in the top-right corner
- No "Next" button — advancement is gesture-driven only
- Progress dots at the bottom (4 dots, current step filled)

### Completion detection
- Runs in a `useEffect` polling `signalRef.current` at ~10fps (100ms interval)
- Uses same `wheelGeometry()` helper as the coordinator for ring hit-testing
- Tracks visited note slices in a local `Set<number>` for step 3
- On completion of step 4 or on skip: sets localStorage flag `froola.tutorialSeen = true`

### Trigger
- Shown when `localStorage.getItem('froola.tutorialSeen')` is falsy
- Shown only when `mode === 'camera'` or `mode === 'mouse'` (not during the camera permission prompt)
- If user is in mouse mode, step 1 is skipped (no camera to detect hands) and tutorial starts at step 2 with mouse-appropriate instructions

### State
All local to the `BeginnerTutorial` component:
- `step: number` (0–3, or 4 = complete)
- `visitedSlices: Set<number>` (for step 3 completion)

---

## Files Changed

| File | Change |
|------|--------|
| `src/engine/renderer/index.ts` | Accept `guardrailRef` param; draw guardrail each frame |
| `src/engine/renderer/guardrail.ts` | New: `drawGuardrail(ctx, w, h, handsPresent, guardrailOn)` |
| `src/components/BeginnerTutorial.tsx` | New: 4-step tutorial overlay component |
| `src/components/PlayShell.tsx` | Mount `BeginnerTutorial`, add guardrail toggle button, pass `guardrailRef` to coordinator/renderer |
| `src/components/learn/LearnShell.tsx` | Create `guardrailRef`, pass to `useCoordinator` |
| `src/coordinator.ts` | Accept `guardrailRef` as optional param, forward to `useRenderer` |

---

## Out of Scope

- Changes to Lesson 1 content or scoring thresholds
- Tutorial for LearnShell specifically (the global tutorial covers pre-lesson knowledge)
- Mouse-mode-specific visuals for the guardrail (same visual works for both)
- Analytics on tutorial completion/skip rate
