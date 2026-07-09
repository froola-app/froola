# Liquid Glass HUD — redesign process

*July 2026. Covers the play-screen controls: record / video / share / profile /
Learn buttons, the bottom instrument row, the arp toggle, the loop panel, and
the top-center badges.*

## The problem

The play screen's controls float directly over the user's live camera feed.
The old recipe was `rgba(255,255,255,0.15)` fill + white text + `blur(8px)`.
Two failures:

1. **Readability.** The fill and the text were both white-ish. Over a bright
   scene (sunlit room, white wall — i.e. most webcam feeds) the pill and its
   label washed into the background: white-on-white.
2. **It didn't read as glass.** A light blur over a flat translucent fill has
   no depth cues, so the pills read as matte gray stickers, not lenses. Glass
   is convincing when it *reacts* to what's behind it — the old buttons
   reacted to nothing.

Both failures share a root cause: the buttons were styled for one assumed
backdrop (dark), but the backdrop is whatever the camera sees.

## Part 1 — the glass recipe

What makes real glass (and Apple's Liquid Glass material) read as glass is a
stack of light behaviors, each of which maps to a CSS layer:

| Physical cue | CSS layer |
|---|---|
| Refraction pulls color through | `backdrop-filter: blur(18px) saturate(180%)` — the saturation boost is the key upgrade; it makes the scene's color bleed *into* the pill instead of graying out |
| Specular highlight on the top edge | `inset 0 1px 0 <rim>` box-shadow — a 1px bright line where light would catch the rim |
| Shadowed bottom edge | `inset 0 -1px 1px rgba(0,0,0,0.08)` |
| A sheen across the surface | `linear-gradient(to bottom, rgba(255,255,255,0.10), transparent 45%)` layered over the fill |
| The pill sits *above* the scene | soft drop shadow, `0 4px 16px` |
| Thin material edge | 1px hairline stroke, not a heavy border |

The fill itself dropped from 15% white to **8%** — near-clear. Counter-
intuitively, *less* fill looks more like glass, because the blur + saturation
do the work and the material stops looking painted on.

All values live in CSS custom properties (`--lg-top-*`, `--lg-bottom-*`) in
`src/App.css`, so every control shares one recipe and the adaptive system
below only has to swap variables.

## Part 2 — adaptive ink (the readability fix)

No single ink color survives every camera feed, so the HUD watches the feed
and adapts. `src/hooks/useAmbientLuminance.ts`:

1. Every **400ms**, draw the camera `<video>` into a **32×18** offscreen
   canvas (`willReadFrequently`). That's 576 pixels — microscopic next to the
   MediaPipe inference already running per frame.
2. Compute mean perceived luminance (Rec. 601 weights: `0.299R + 0.587G +
   0.114B`) for **two bands**: the top 30% of the frame (corner buttons,
   badges) and the bottom 35% (instrument row, loop panel). A window behind
   your head shouldn't flip the bottom row, and vice versa — the zones flip
   independently.
3. Classify each band with **hysteresis**: flip to `light` above 0.58
   luminance, back to `dark` only below 0.46. The dead zone stops the HUD
   from strobing when a hand waves through frame or the scene hovers near
   the threshold.
4. Stamp the result on the root element: `data-hud-top="light|dark"`,
   `data-hud-bottom="light|dark"`. CSS does the rest — no React re-renders,
   no per-component wiring.

On the permission-asking screen the attributes are removed (the app
background is dark, the defaults already fit) and the sampler never runs.

### The two palettes

| Variable | Dark backdrop (default) | Light backdrop |
|---|---|---|
| ink | white @ 92% | near-black `rgba(19,21,27,0.92)` |
| fill | white @ 8% | white @ 34% (frosts the bright scene down so dark ink has a bed) |
| stroke | white @ 30% | black @ 16% |
| rim | white @ 40% | white @ 85% (specular reads stronger in daylight) |
| drop shadow | 35% black | 14% black (hard shadows look wrong on bright scenes) |

Every color/background/border/shadow transitions over **0.3s**, so a flip
reads as the material responding to light, not a theme toggle snapping.

### States that don't adapt

Recording-red, video-recording-purple, and the amber "done" chip keep their
solid, color-coded fills in both modes — status colors must stay recognizable
everywhere, and their fills are opaque enough to be self-sufficient.
Inverted chips (active loop slot, playing state) use the ink color as their
fill, so they automatically become white-chip-on-dark-scene /
dark-chip-on-bright-scene.

## Decisions & tradeoffs

- **Interval sampling (400ms), not per-frame.** Ambient light changes slowly;
  per-frame sampling would burn CPU that belongs to hand tracking and audio.
- **Two zones, not per-button sampling.** Per-button would be maximally
  correct but causes a patchwork HUD where adjacent buttons disagree. Two
  zones match the two visual clusters and keep each cluster coherent.
- **Attributes + CSS variables, not React state.** Zero re-renders on flip;
  the browser animates the variable swap. Components didn't change at all
  (except the arp toggle gaining a class).
- **Rec. 601 luma, not relative luminance (WCAG).** We're classifying a
  camera frame, not measuring contrast ratios; 601 is cheaper and the
  hysteresis band absorbs the difference.
- **The arp toggle got its own class** (`.arp-btn`): it shared `.octave-btn`
  with the steppers inside the octave pill, but unlike them it sits directly
  on the video, so it needs the full glass treatment rather than the flat
  inner-button style.

## Files

- `src/hooks/useAmbientLuminance.ts` — feed sampler → root attributes
- `src/components/PlayShell.tsx` — mounts the hook; arp button class
- `src/App.css` — `--lg-*` variable sets + per-control glass recipe
  (see the "Liquid glass HUD" comment block)

## v2 — curvature (July 2026, same day)

Feedback on v1: readable now, but still not Apple. Diagnosis: v1 got the
*material* right (blur, saturation, translucency) but not the *curvature*.
Apple's glass reads convex because its edge lighting is directional and its
controls respond physically. True refraction (the background bending through
the edge) needs an SVG displacement map in `backdrop-filter`, which only
Chromium honors and Safari does not — not acceptable for Froola — so v2
fakes the curvature with three cues that work everywhere:

1. **Directional gradient rim.** The uniform 1px stroke is joined by a
   `::before` ring (the two-layer mask trick: fill minus content-box):
   brightest warm-white at top-left where light enters, nearly nothing
   mid-edge, a cool blue-tinted catch-light at bottom-right. The warm/cool
   split is the chromatic hint a thick lens gives. `<select>` can't host
   pseudo-elements, so the pickers keep the flat stroke — visually close
   enough sitting next to ringed neighbors.
2. **Thicker material.** Blur 18→24px, saturation 180→200%. The scene
   should look like it's passing through something with mass.
3. **Physical response.** Hover floats the pill 1px; press squishes to
   0.95 (0.88 for inner chips) on a spring curve
   (`cubic-bezier(0.34, 1.56, 0.64, 1)`) so the release overshoots
   slightly — glass that behaves like an object, not a painted chip.
   Disabled under `prefers-reduced-motion`.

The v2 rules live at the very end of `App.css` (they must follow the
per-control rules to win the cascade). The v1 top-rim inset shadow stays —
a straight specular plus a directional ring is exactly how Apple layers
their rims.

## Verifying / tuning

- Point the camera at a bright wall: ink should go near-black within ~1s.
  Cover the lens: back to white.
- Thresholds live at the top of `useAmbientLuminance.ts` (`LIGHT_ENTER`,
  `LIGHT_EXIT`). If the HUD flips too eagerly on mid-gray scenes, raise
  `LIGHT_ENTER`; if it flickers, widen the gap.
- Glass intensity lives in the `--lg-*` blocks in `App.css`; the blur and
  saturation are inlined per rule (`blur(18px) saturate(180%)`).

## Revision — theme-driven glass (July 2026)

The adaptive-ink system above proved too unpredictable in practice: the
near-clear fill + `saturate(200%)` pulled the scene's color (usually skin
tone) into every pill, and the two zones flipping ink independently made the
HUD read as unintentional — light buttons up top, salmon buttons below.

The material is now **theme-driven** (`<html data-theme>`, the user's
light/dark choice from useTheme.ts):

- **Light theme**: milky glass `rgba(252,250,246,0.60)`, near-black ink.
- **Dark theme**: smoked glass `rgba(19,21,27,0.55)`, white ink.
- Saturation dropped to **130%**; the fill is opaque enough to carry ink
  contrast on any camera scene.
- The canvas dials follow the same theme via a `WheelPalette` in
  `src/engine/renderer/index.ts` (read per frame from `data-theme`).
- `useAmbientLuminance` still runs, but is only a **contrast assist**: when
  the scene behind a zone fights the fill, the fill thickens a step
  (0.60→0.76 light, 0.55→0.72 dark). Ink never flips with the scene.
