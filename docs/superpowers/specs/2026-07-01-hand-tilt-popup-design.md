# Hand tilt popup — design

**Date:** 2026-07-01 · **Status:** Implemented

## Goal

When a hand is not facing the camera, show a popup (after a grace period) that
tells the user how their hand is currently oriented and how to fix it. This
replaces the removed binary guardrail overlay (d0100a3 / 5a37afa) with
directional guidance instead of static hand silhouettes.

## Detection (L1)

`src/engine/input/handFacing.ts` — pure `classifyHandFacing(landmarks)`:

- Uses MediaPipe *world* landmarks (metric 3D) — normalized landmarks scale
  x/y/z differently and give distorted angles.
- For a landmark segment, `asin(|dz| / 3D length)` gives its angle out of the
  camera plane, independent of hand size and distance.
- Debug: set localStorage `froola.debugFacing` = `'1'` to log live angles.
- **turned** — knuckle line (index MCP 5 → pinky MCP 17) is > 25° out of
  plane: hand rotated sideways.
- **pitched** — palm line (wrist 0 → middle MCP 9) is > 30° out of plane:
  fingers pointing toward/away from camera. Extra slack because relaxed hands
  naturally lean back.
- Whichever exceeds its threshold by more wins; otherwise **ok**.

Result is published per hand on `GestureSignal.facing` (camera mode only).
Thresholds are exported constants for tuning against a real camera.

## Popup (shell)

`src/components/HandTiltPopup.tsx`, rendered by PlayShell in camera mode only.
Polls `signalRef` every 100 ms (same pattern as BeginnerTutorial):

- **Grace period:** a hand must be continuously off-plane for 1200 ms before
  the popup appears.
- **Clear delay:** it hides only after 600 ms of continuous ok, so it never
  flickers.
- Fists are skipped — a fist is an intentional chord-lock gesture.

Content: names the hand, describes the current orientation ("turned sideways"
/ "leaning toward the camera"), shows a current→target visual (🖐️ 3D-rotated
to echo the detected tilt, arrow, flat glowing target palm), and states the
fix. Fixed top-center card, `pointer-events: none`, z-index 55 (above the
tutorial overlay, matching the old guardrail's layering).

## Testing

- `handFacing.test.ts` — ok / grace-zone / turned / pitched / degenerate.
- `HandTiltPopup.test.tsx` — fake timers: grace period, brief-blip suppression,
  clear delay, per-hand copy, fist suppression.

Thresholds (25°/30°) and timings (1200/600 ms) need validation with a real
camera; adjust the exported constants in `handFacing.ts` if the popup nags or
misses.
