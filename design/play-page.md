# Play page

_Trimmed 2026-07-11. The screen-by-screen UI inventory this file used to carry went
stale within days (three HUD reworks in a week) and was deleted — `PlayShell.tsx` and
`App.css` are self-describing. What remains below is the durable structure. Verify
against code before relying on specifics._

## Routing model

Single page at `/` (`src/components/LandingPage.tsx`). There is no `/play` route — the
landing hero and the instrument are the same page; choosing an input mode swaps the hero
for `PlayShell` in place, same URL. The choice is remembered in `sessionStorage`
(`froola.inputMode`, via `storedInputMode()`/`storeInputMode()` in
`src/engine/input/index.ts`), so navigating to `/learn` and back drops straight into the
instrument — but a fresh tab always sees the hero first.

Input modes: camera (hand tracking) and mouse/touch fallback (single pointer is labelled
left/right by screen half; extensions stick since there's no second hand).

## Two visual registers

The marketing chrome (landing, learn) is light editorial (`design/README.md` tokens).
The instrument HUD is theme-driven liquid glass over the camera feed/canvas — see
`design/liquid-glass-hud.md` for the material recipe and its revision history.
"Onboarding" is overloaded in this codebase — see `design/onboarding.md`.

## Data flow

`useCoordinator` (`src/coordinator.ts`) is the single hook wiring
input → music → audio → renderer. Gesture → audio is refs only, never React state, on
the hot path. It takes the canvas ref plus a long tail of optional refs/callbacks —
**read the current signature in `coordinator.ts` directly before relying on the exact
param order**; it has grown incrementally and isn't a stable API.

## Known issues

- `useCoordinator`'s positional-optional-params signature is fragile to extend; a
  props-object would be safer if it grows further.
