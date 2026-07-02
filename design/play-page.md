# Play page

_Written 2026-07-02 directly from `main` — verify against the current code before
relying on this for a redesign; UI code changes faster than design docs do._

## Where it lives

Single page at `/` (`src/components/LandingPage.tsx`). There is no `/play`
route — the landing hero and the instrument are the same page; choosing an
input mode swaps the hero out for `PlayShell` in place, same URL. The choice
is remembered in `sessionStorage` (`froola.inputMode`, via
`storedInputMode()`/`storeInputMode()` in `src/engine/input/index.ts`), so
navigating to `/learn` and back drops straight into the instrument instead of
re-showing the hero — but a fresh tab always sees the hero first.

## 1. Landing hero (`LandingPage.tsx`, class prefix `lp3__`)

Editorial, light mode, single scroll. Tokens match `design/tokens.json`
(`bg #FAFAF8`, `text #111111`, `accent #D4500A`, DM Sans).

- **Hero section**: logo, headline ("Make music with your hands."), an
  animated waveform (`WaveVisual` — 40 CSS-height-animated bars, `rAF` loop,
  every 7th bar accented orange), two buttons (**Enable camera** primary /
  **Use mouse instead** secondary, "Use touch instead" on touch devices via
  `navigator.maxTouchPoints`), a "scroll to see how it works" hint.
- **How it works**: 3 numbered steps (Allow camera / Move your hands / Make
  music), same numbered-step visual language as the design system doc.
- **Why we built it**: one paragraph + "Built by two high school students."
- **Get in touch**: contact prose + email + the same two input buttons again.
- **Footer**: copyright line.

Clicking either input button calls `chooseInput('camera' | 'mouse')`, which
persists the choice and swaps to `<PlayShell initialInput={...} />`.

## 2. PlayShell (`src/components/PlayShell.tsx`)

Everything below is `position: fixed` UI layered over a full-viewport
`<canvas className="main-canvas">` that the renderer (`useRenderer`,
`src/engine/renderer`) draws into — two wheels (left = chord/note, right =
extension/quality), particles, orb glow per hand. Dark background
(`#0A0E1A`), frosted-glass pill controls (`rgba(255,255,255,0.15)` +
`backdrop-filter: blur(8px)`) throughout — this is a deliberately different
visual register from the light editorial marketing chrome (landing/learn),
because the canvas underneath needs a dark, low-contrast frame.

### Permission gate (`mode === 'asking'`)

`CameraPrompt` — full-viewport light card (`permission-screen`, reuses the
`#FAFAF8` editorial palette, not the dark HUD one): logo, "Camera access"
eyebrow, headline, privacy copy, a one-line mechanic hint ("You'll move both
hands over two wheels — left picks the chord, right shapes it."), Enable
camera / Use mouse buttons. The rest of the HUD is hidden entirely while this
gate is showing (it sits at a lower z-index than the HUD and would otherwise
show frosted pills floating uselessly on top of it).

### Once a mode is chosen

- **`HandTiltPopup`** (camera mode only) — warns when a hand's facing angle
  is out of range for reliable tracking.
- **`BeginnerTutorial`** — 4-step gesture walkthrough overlay, shown once
  per browser (`localStorage['froola.tutorialSeen']`). See
  `design/onboarding.md`... actually this is the *in-app* tutorial, distinct
  from the account-signup `OnboardingFlow` — documented in its own section
  below since "onboarding" is overloaded in this codebase.
- **Volume badge** — appears for 1.5s after a head-nod changes volume
  (`vol NN%`), top-center.
- **Nod hint** — persistent "nod ↕ your head to change volume" pill, shown
  until the first successful nod, camera mode only.
- **`MouseModeBadge`** (mouse/touch mode only) — small "Mouse mode — try
  camera mode" link, bottom-center. **Known bug**: this collides with the
  bottom instrument HUD once it wraps to multiple rows (happens at both
  mobile and, less severely, some desktop widths) — hidden entirely below
  480px as a stopgap (`@media (max-width: 480px) { .mode-badge { display:
  none; } }` in `App.css`), not fixed at other widths.
- **`ShareButton`**, **`RecordButton`**, **`VideoRecordButton`**, **Learn**
  nav button — top corners.
- **`LoopPanel`** — chord-loop builder (add/undo/clear slots, bpm, play),
  shown once the `ChordLooper` is constructed, floats above the bottom HUD.
- **Bottom HUD row** (`.hud-bottom`) — 5 frosted pills: instrument select
  (synth/piano, shows "loading piano…" while the sampler downloads), key
  select, scale select, octave stepper (±, clamped `-2..+2`), arp toggle
  (on/off). Wraps to multiple rows on narrow screens.

### Data flow

`useCoordinator` (`src/coordinator.ts`) is the single hook wiring
input → music → audio → renderer for this page (per `CLAUDE.md`: gesture →
audio is refs only, never React state, on the hot path). It takes the canvas
ref, instrument-mode ref, initial input mode, and a long tail of optional
refs/callbacks (octave, external signal source for replay, music config,
ghost signals for lesson mode, volume-change callback, loop-playing flag,
arpeggiator ref + enabled flag, guardrail ref) — read the current signature
in `coordinator.ts` directly before relying on the exact param order, it has
grown incrementally and isn't stable API.

## Known issues at time of writing

- Mode-badge/hud-bottom overlap (above) — mobile-only fix landed, desktop
  instance still open.
- `useCoordinator`'s positional-optional-params signature is fragile to
  extend; a props-object would be safer if it grows further.
