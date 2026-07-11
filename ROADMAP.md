# Froola — Roadmap

Living list of fixes and feature ideas. Distilled from a multi-agent codebase
review + QA pass (June 2026), refreshed by a full read-through + browser-driven
QA pass (30 Jun 2026), reconciled against the code again on 2026-07-11. This
file is the narrative master list. Items marked **(verified)** were reproduced
(or confirmed fixed) in a headless-Chromium run at the time they were written.

Mouse/touch mode was removed entirely on 2026-07-08 (`a9706f1`, PR #44) —
camera is now the only input mode. Shipped items below that reference mouse
mode are historical; see `docs/DECISIONS.md`.

## ✅ Recently shipped
- **Hold reworked into a sustain (no extra attack)** — holding a chord now keeps the *already-ringing* chord sounding instead of re-attacking a different one, fixing the audible "extra sound" on hold. Space = sustain pedal (blurs a focused HUD button so it isn't swallowed; buttons stay Enter-activatable); fist = debounced sustain toggle. _(verified headless: pedal held → no silence ramp; released → silences.)_
- **Chord looper** — capture chords into ordered slots (max 8), play the progression back in tempo, and solo over it with the free hand (`LoopPanel`: +chord/undo/clear, bpm stepper, play/stop; Enter captures). Built on a new **TempoClock** (Web Audio lookahead scheduler, shared by future arpeggiation). _(verified headless: slots C-Em-G, active-bar highlight advances, chords scheduled exactly one bar apart at the set bpm.)_
- **9th chords sound their 9th** — the synth was capped at 4 voices, so a 9th was truncated to the same 4 notes as a 7th; raised to 5 voices so the 9th actually sounds distinct.
- **Single inline landing page** with remembered input choice (10-min TTL).
- **Stable hand tracking** — reverted MediaPipe confidence to 0.5 (0.3 caused jitter + "stuck in the middle").
- **Octave stepper** (−2…+2, ↑/↓ keys), also applied to sustained chords.
- **Replay playback (SP2)** — `/replay?d=…` links now actually play back, faithfully (recorder samples the angle-derived `selectedRef`, not raw cursor-x). Shared playback core: live vs recorded drive one pipeline via a pluggable signal source; shared wheel `geometry.ts` removes coordinator/renderer drift. _(record→share→replay loop verified end-to-end this pass.)_
- **Key + scale selector** — 12 keys × {major, minor, dorian, mixolydian}; note-wheel labels follow the key.
- **First-run gesture coaching** overlay (two wheels, fist-to-sustain / Space pedal, octave keys).
- ~~Mouse/touch mode now sounds~~ / ~~Mouse/touch can now reach the extension wheel~~ — **superseded by camera-only (2026-07-08)**, mouse/touch mode no longer exists.
- **Lesson preview audio** — the "Listen to the target" phase now actually plays the target chord.
- **Lessons test real recall** — the graded attempt phase no longer shows the ghost/hint; results show real independent note vs. chord-quality accuracy; a Leitner-box spaced-repetition review re-tests completed chords cold (`/learn/review`).
- **Rhythmic arpeggiation** — sustaining a chord (fist-hold or Space pedal) now cycles through its voicing as a repeating pattern instead of a static drone, driven by a new `Arpeggiator` on its own `TempoClock`; hand height sets the rate (60–240bpm), and an "arp on/off" HUD toggle falls back to the plain sustained pad. Non-sustained play and loop mode are unaffected. _(verified headless: 0.968s/step at hand-low ≈ 60bpm, 0.252s/step at hand-high ≈ 240bpm; stops immediately on release; silent during loop playback and with the toggle off.)_

## 🐞 Open fixes
_Re-verified 2026-07-11. Removed since the last pass: `GestureCoach` (component deleted), the README-copy item (fixed), and the Firebase bundle-size item (no `firebase.ts` in this codebase — stack is Supabase, see `docs/DECISIONS.md`)._

| Pri | Item | Where |
|---|---|---|
| P1 | **`vibe` is vestigial** — hardcoded `'warm'`; codec reserves 2 bits for a 4-vibe system with no UI/effect. Either wire it to the synth or drop the field. | `coordinator.ts`, `engine/recording/codec.ts` |
| P1 | **Piano→synth sustain leak** — `silence('piano')` fades the oscillator sustain over 1.8s; switching instruments mid-note can leave voices ringing. Reset voice gains on mode change. | `engine/audio/AudioEngine.ts` |
| P2 | **Dead `mapGesture`/`createMapper` path is what the integration tests exercise** — validates a pipeline that isn't shipped (the app drives audio via `buildCommand`/`coordinator`). `scales.ts` also still exports `WARM_MAJOR`/`ChordSlot` only for this dead path (its `midiToHz` is live). Delete the dead path and rewrite `integration.test.ts` against the real coordinator path. | `engine/music/mapGesture.ts`, `engine/music/scales.ts`, `engine/integration.test.ts` |
| P2 | **Vestigial `QUALITIES` array** — `types.ts` still exports the superseded chord-quality model (`major/minor/maj7/…`); the live right wheel uses `EXTENSIONS` (`triad/6th/7th/…`). `replayPlayer` relies on `QUALITIES.length` (7) coincidentally matching `EXTENSIONS.length` — a latent slice-count bug if either list changes. Reference `EXTENSIONS.length` and drop/retire `QUALITIES`. | `engine/types.ts`, `engine/recording/replayPlayer.ts` |
| P3 | **Lint env artifact** — transient `.claude/worktrees/*` dirs create a second tsconfig root and break `npm run lint`. Add `.claude/` to eslint `ignores`. | `eslint.config.*` |
| P3 | **Pre-existing `react-hooks` lint errors** — `refs`/`set-state-in-effect`/`immutability`/`only-export-components` across `PlayShell`, `useLessonRunner`, `AuthContext`, etc. Not regressions, but they mask new violations. Triage in one pass — re-run `npm run lint` to get a current count. | multiple |
| P3 | **Bottom-HUD overlap at desktop widths** — carried over from `LESSON_SYSTEM_PLAN.md`'s one open follow-up; not yet re-verified. | HUD layout components |

## 🚀 Feature roadmap
**Make the replay link viral (highest leverage)**
- **Replay = autoplaying hero** — auto-play the gesture with animated wheels + a big "Make your own" CTA instead of bouncing visitors to `/play`. (S)
- **OG image / audio preview on share** — links unfurl in Slack/iMessage/Twitter. (M)
- **Audio export (WAV via OfflineAudioContext)** — deterministic offline render; shareable audio reaches further than a link. (M)

**Musical expressiveness**
- **More instruments / finish the `vibe` system** — selectable timbres (warm/bright/dark/electric) reusing existing plumbing. (M)
- _Done: key/scale selector; tempo clock + chord looper; rhythmic arpeggiation._

**Mobile / touch**
- **First-class touch UX** — _stale: this predates the 2026-07-08 camera-only decision (`docs/DECISIONS.md`), which removed touch input entirely. Re-scope or close the tracking issue (#14)._
- **Haptics on slice change** — `navigator.vibrate` for tactile feedback. (S)

**Onboarding / retention**
- _Done: in-canvas gesture coaching._
- **Play first, gate later** — onboarding is a heavy auth-gated 3-step flow before any sound; let people play first. (S)

**Big bet (later)**
- **Multiplayer jam** — shared room (WebRTC / Firebase RTDB) where two phones each control one wheel/hand. Naturally viral, large build; park until the replay loop proves the share mechanic. (L)

_Effort: S = small, M = medium, L = large._
