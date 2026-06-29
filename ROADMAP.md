# Froola — Roadmap

Living list of fixes and feature ideas. Distilled from a multi-agent codebase
review + QA pass (June 2026). Open items are tracked as GitHub issues; this file
is the narrative master list.

## ✅ Recently shipped
- **Single inline landing page** with remembered input choice (10-min TTL).
- **Stable hand tracking** — reverted MediaPipe confidence to 0.5 (0.3 caused jitter + "stuck in the middle").
- **Octave stepper** (−2…+2, ↑/↓ keys), also applied to latched chords.
- **Replay playback (SP2)** — `/replay?d=…` links now actually play back, faithfully (recorder samples the angle-derived `selectedRef`, not raw cursor-x). Shared playback core: live vs recorded drive one pipeline via a pluggable signal source; shared wheel `geometry.ts` removes coordinator/renderer drift.
- **Key + scale selector** — 12 keys × {major, minor, dorian, mixolydian}; note-wheel labels follow the key.
- **First-run gesture coaching** overlay (two wheels, right-fist latch, octave keys).

## 🐞 Open fixes
| Pri | Item | Where |
|---|---|---|
| P0 | **Mouse mode is silent** — one pointer emits a single `left` signal, but the coordinator needs `leftInDial && rightInDial`. Single-pointer users hear nothing. Fix: label the pointer by which wheel it's over + persist the other wheel's selection + OR-trigger in mouse mode (also add a coordinator-trigger test — currently untested). | `coordinator.ts`, `engine/input/index.ts`, `engine/renderer/index.ts` |
| P1 | **`vibe` is vestigial** — hardcoded `'warm'`; codec reserves 2 bits for a 4-vibe system with no UI/effect. Either wire it to the synth or drop the field. | `coordinator.ts`, `engine/recording/codec.ts` |
| P1 | **Piano→synth sustain leak** — `silence('piano')` fades the oscillator sustain over 1.8s; switching instruments mid-note can leave voices ringing. Reset voice gains on mode change. | `engine/audio/AudioEngine.ts` |
| P2 | **Dead `mapGesture`/`createMapper` path is what the integration tests exercise** — validates a pipeline that isn't shipped. Delete it and rewrite the test against the real `buildCommand`/coordinator path (would have caught the mouse bug). | `engine/music/mapGesture.ts`, `engine/integration.test.ts` |
| P2 | **Misleading copy/comments** — onboarding advertises "Recordings up to 60 seconds" but the cap is 30s; a renderer comment references a non-existent "warm zone". | `components/onboarding/PricingStep.tsx`, `engine/recording/useRecorder.ts`, `engine/renderer/index.ts` |
| P2 | **Bundle size** — 763 kB / 231 kB gzip main chunk; MediaPipe + soundfont are already lazy, but Firebase loads eagerly. Lazy-load Firebase / route-split. | `firebase.ts`, app entry |
| P3 | **Lint env artifact** — transient `.claude/worktrees/*` dirs create a second tsconfig root and break `npm run lint`. Add `.claude/` to eslint `ignores`. | `eslint.config.*` |

## 🚀 Feature roadmap
**Make the replay link viral (highest leverage)**
- **Replay = autoplaying hero** — auto-play the gesture with animated wheels + a big "Make your own" CTA instead of bouncing visitors to `/play`. (S)
- **OG image / audio preview on share** — links unfurl in Slack/iMessage/Twitter. (M)
- **Audio export (WAV via OfflineAudioContext)** — deterministic offline render; shareable audio reaches further than a link. (M)

**Musical expressiveness**
- **Tempo + rhythmic arpeggiation** — latched chords currently just sustain; an arp/strum driven by hand height or a tempo control turns holding into playing. (M)
- **More instruments / finish the `vibe` system** — selectable timbres (warm/bright/dark/electric) reusing existing plumbing. (M)
- _Done: key/scale selector._

**Mobile / touch**
- **First-class touch UX** — touch already maps two fingers to the two wheels (better than mouse); promote it in landing copy. (S)
- **Haptics on slice change** — `navigator.vibrate` for tactile feedback. (S)

**Onboarding / retention**
- _Done: in-canvas gesture coaching._
- **Play first, gate later** — onboarding is a heavy auth-gated 3-step flow before any sound; let people play first. (S)

**Big bet (later)**
- **Multiplayer jam** — shared room (WebRTC / Firebase RTDB) where two phones each control one wheel/hand. Naturally viral, large build; park until the replay loop proves the share mechanic. (L)

_Effort: S = small, M = medium, L = large._
