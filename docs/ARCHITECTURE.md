# Architecture

How a hand moving in front of a camera becomes a chord, and why the code is shaped the way
it is.

## The pipeline

```
camera frame
    │
    ▼
engine/input  ──────────────  MediaPipe landmarks → GestureSignal[]
    │                         (palm centre, facing, per-hand id, present flag)
    ▼
coordinator.ts  ────────────  one rAF loop: hit-test the wheels, debounce the
    │                         fist, decide what should be sounding right now
    ├──────────────► engine/music     scale degree + extension → MusicalCommand
    │                                 (root, quality, voicing, register)
    ├──────────────► engine/audio     Web Audio synth / sampler, tempo clock
    └──────────────► engine/renderer  Canvas 2D dials, hand markers, particles
```

`engine/looper` and `engine/arp` hang off the same clock, so a looped progression and a
live hand stay in phase. `engine/recording` taps the gesture stream (for the bit-packed
replay codec) and the canvas plus microphone (for video capture).

## The one rule that shapes everything

**The gesture-to-audio path reads and writes refs, never React state.**

`useCoordinator` runs a single `requestAnimationFrame` loop. Every frame it reads
`signalRef.current`, hit-tests both wheels, and decides whether to attack, hold, or release
a chord. Nothing on that path is allowed to trigger a re-render.

This is not premature optimisation. At 60fps a state update per frame would put React's
reconciler between a hand moving and a note sounding, and the resulting jitter is audible:
notes arrive late, and a re-render landing mid-gesture can retrigger a chord that should
have been sustained. UI that wants to show hot-path data (the sustain indicator, the
elapsed recording time) reads a ref on its own schedule instead.

The practical consequence for contributors: if you find yourself adding `useState` inside
the coordinator or the renderer loop, that's the signal to use a ref and let the UI poll.

## Geometry is shared, not duplicated

Both the renderer and the coordinator need to know where the wheels are: the renderer to
draw them, the coordinator to hit-test hands against them. They both call
`engine/renderer/geometry.ts`, rather than the coordinator waiting on the renderer to
publish positions. That keeps the hit-test independent of draw order, and it means a frame
where rendering is skipped still plays the right note.

Visual changes must not change interaction. Wheel geometry, the hit-test, and the selection
hysteresis are behaviour, not decoration, and a restyle that shifts them is a regression
even if the screenshot looks better.

## Timing details that matter

A few constants in `coordinator.ts` exist because the naive version sounds wrong:

- **`SILENCE_GRACE_MS` (140ms).** Hands cross the centre hub, and MediaPipe drops the
  occasional frame. Cutting the chord the instant both hands leave the ring makes sustained
  playing stutter, so a chord keeps ringing through a brief absence.
- **`FIST_DEBOUNCE_MS` (120ms).** Hand-shape detection flickers near the threshold. Without
  debouncing, a half-closed hand toggles sustain on and off several times a second.
- **Sustain never re-attacks.** Engaging sustain holds the ringing chord rather than
  playing it again, so the pedal is silent by itself. Space is the keyboard pedal, a
  steady fist is the camera equivalent.
- **Arp rate follows hand height,** mapped from 240bpm at the top of the frame to 60bpm at
  the bottom.

## Hand identity

Left and right hands are assigned by **screen position**, not by MediaPipe's handedness
label. Handedness flips when a hand rotates or the camera mirrors, and a flip mid-phrase
swaps which wheel each hand controls: the instrument appears to break in the player's
hands. Position is stable through rotation, which is what an instrument needs.

## Storage

Two backends behind one interface, chosen by whether anyone is signed in:

| | Local (default) | Cloud (Supabase configured and signed in) |
|---|---|---|
| Video takes | IndexedDB, `engine/recording/localVideoStore.ts` | `video_recordings` table plus a storage bucket |
| Lesson and review progress | localStorage, `engine/lessons/progressStore.ts` | `lesson_progress`, `review_progress` tables |

`videoRecordingStore.ts` is the façade over both. `VideoRecording.userId` is `null` for a
local take, which is what the UI checks before offering a share link: a `/watch?v=<id>` URL
for a take that only exists in one browser would be a broken promise. Local takes resolve
first when a watch link is opened, so the browser that recorded one can always play it.

Signing in merges cloud rows over the local map rather than replacing it, so progress made
before an account existed doesn't appear to vanish.

## Lessons

`engine/lessons/` is a small teaching system: a `curriculum` ordering technique drills and
song lessons into one path, a `scorer` comparing what was played against a target recording
on a 100ms sample grid, a `drillBank` derived from the lessons, and `leitner.ts`, a
spaced-repetition scheduler that decides which chords are due for review.

Song lessons carry only chord progressions, and are named for what they teach. No melody,
lyric, or audio from any recording belongs in this repository.

## What's deliberately not here

`optional/billing/` holds the Stripe integration from when froola was a subscription
product. It is not built, not type-checked, not linted, and nothing in `src/` imports it.
It stays as a reference implementation, not as a feature flag: there is no code path that
turns paid plans back on.
