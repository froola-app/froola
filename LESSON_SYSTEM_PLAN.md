# Froola Lesson System — Implementation Plan

> **For Claude picking this up mid-way:** Read this file top to bottom before touching any code.
> Check the **Status** column in each section to know what's done vs. what's next.
> The codebase is a Vite + React + TypeScript app. Run `npm run build` to type-check. No backend yet.

---

## 1. What exists that we can leverage

| Existing piece | File | Why it matters for lessons |
|---|---|---|
| `Recording` type + codec | `src/engine/types.ts`, `src/engine/recording/codec.ts` | Lesson steps store target sequences as `Recording` objects (same binary format used by replays) |
| `replayPlayer.signalsAt()` | `src/engine/recording/replayPlayer.ts` | Given a `Recording` + elapsed ms → returns `GestureSignal[]`. We use this to drive the "ghost" target hands during a lesson attempt |
| `useRenderer` | `src/engine/renderer/index.ts` | Draws the canvas. Needs a small addition: a second `ghostSignalsRef` so it can draw translucent target-hand orbs alongside the live orbs |
| `useCoordinator` | `src/coordinator.ts` | Wires signals → audio + renderer. Already accepts an `externalSignalRef`. During a lesson the target signals go here during preview, live signals during attempt |
| `AudioEngine.createRecordingStream` | `src/engine/audio/AudioEngine.ts` | Not needed for lessons but shows the pattern: engine refs are threaded from coordinator outward |
| `AuthContext` + Firestore | `src/contexts/AuthContext.tsx`, `src/firebase.ts` | Lesson progress is stored per-user in Firestore. Must gracefully degrade when `firebaseReady === false` |
| `App.tsx` routes | `src/App.tsx` | Already has auth-gated routing. We add `/learn` and `/learn/:lessonId` here |
| `DialSelection` ref | `src/coordinator.ts` → `selectedRef` | This is the live note+quality selection at any moment. The scorer reads it frame-by-frame to compare against the target |

---

## 2. New file tree (all files to create)

```
src/
  engine/
    lessons/
      types.ts              ← LessonStep, Lesson, LessonResult, LessonPhase, StepResult
      curriculum.ts         ← The 5 built-in lessons (actual content + target recordings)
      scorer.ts             ← scoreFrame() — compares live vs target each tick
      useLessonRunner.ts    ← Main state-machine hook (preview → countdown → attempt → result → complete)
  components/
    learn/
      LessonCatalog.tsx     ← /learn route — grid of lesson cards
      LessonCard.tsx        ← Single card: title, difficulty badge, best score, Play button
      LearnShell.tsx        ← /learn/:lessonId — full-screen canvas + lesson HUD (analogous to PlayShell)
      LessonHUD.tsx         ← Overlay during a lesson: instruction text, countdown, live score bar
      StepResultScreen.tsx  ← Between steps: big score number, pass/fail, Retry / Next button
      CompletionScreen.tsx  ← After last step: total score, breakdown, Back to catalog button
```

CSS is added to `src/App.css` at the bottom under a `/* ── Lesson system ── */` comment block.

---

## 3. Complete TypeScript interfaces

These go in `src/engine/lessons/types.ts`. **Do not deviate from these types** — everything else depends on them.

```typescript
import type { Recording } from '../types';
import type { MusicConfig } from '../music/keyScale';

export type LessonDifficulty = 'beginner' | 'intermediate' | 'advanced';

// One step inside a lesson. The user must sustain the target pattern for
// `durationMs` ms and achieve at least `minScore` to advance.
export type LessonStep = {
  id: string;
  instruction: string;       // Shown in the HUD during countdown + attempt
  hint?: string;             // Optional sub-text shown below instruction
  targetRecording: Recording; // The pattern the user should match
  minScore: number;          // 0–100; required to pass and advance
  durationMs: number;        // How long the attempt window is (ms)
};

export type Lesson = {
  id: string;
  title: string;
  subtitle: string;
  difficulty: LessonDifficulty;
  musicConfig: MusicConfig;  // Key + scale locked for this lesson
  steps: LessonStep[];
  tags: string[];            // e.g. ['chords', 'beginner', 'I-V-vi-IV']
};

// Per-step outcome after an attempt
export type StepResult = {
  stepId: string;
  score: number;    // 0–100 achieved
  passed: boolean;
  attemptMs: number; // how long the attempt took
};

// Full lesson outcome stored in Firestore
export type LessonResult = {
  lessonId: string;
  stepResults: StepResult[];
  totalScore: number;    // mean of step scores
  completedAt: number;   // Date.now()
};

// Progress record per lesson (stored in Firestore, keyed by lessonId)
export type LessonProgress = {
  bestScore: number;
  completedAt: number | null;  // null = never finished
  attempts: number;
};

// State machine phases for useLessonRunner
export type LessonPhase =
  | 'idle'         // not started
  | 'preview'      // playing target recording once so user can hear it (no scoring)
  | 'countdown'    // 3-2-1 before the attempt window opens
  | 'attempt'      // live scoring — user plays, ghost hands show the target
  | 'step-result'  // step finished — show score, Retry / Next
  | 'complete';    // all steps done — show CompletionScreen
```

---

## 4. Scoring logic (`src/engine/lessons/scorer.ts`)

```typescript
// Scoring is intentionally simple and transparent to the user:
//
//   note match  = 50 pts  (left wheel slice matches target)
//   quality match = 50 pts (right wheel slice matches target)
//   frame score = 0 | 50 | 100
//
// The step score is the mean of all frame scores sampled at ~10 fps (every 100ms).
// A 10% tolerance is applied: if the target slice only lasts < 200ms we skip scoring
// those frames (transition frames are unfair to penalise).

export function scoreFrame(
  targetNoteIdx: number,
  targetQualIdx: number,
  liveNoteIdx: number,
  liveQualIdx: number,
): number {
  const noteMatch = targetNoteIdx === liveNoteIdx ? 50 : 0;
  const qualMatch = targetQualIdx === liveQualIdx ? 50 : 0;
  return noteMatch + qualMatch;
}
```

---

## 5. Target recordings (curriculum content)

The five built-in lessons in `src/engine/lessons/curriculum.ts`.

Each `LessonStep.targetRecording` is a `Recording` with hand-authored `RecordingSample[]`.
The sample format: `{ dt: ms, noteIdx: 0-6, qualityIdx: 0-6, vibe: 0-3 }`.

All lessons use key C major (keyOffset: 0, scale: 'major').
Note indices (C major left wheel, clockwise from top): C=0, D=1, E=2, F=3, G=4, A=5, B=6
Quality indices (right wheel, clockwise from top): triad=0, 6th=1, 7th=2, 9th=3, add9=4, sus2=5, sus4=6

### Lesson 1 — Your First Chord (beginner, 3 steps)
- Step 1: Hold C triad (note 0, qual 0) for 3 000 ms
- Step 2: Move to G triad (note 4, qual 0) for 3 000 ms
- Step 3: C → G → Am(=A minor, note 5, qual 0) → F(=note 3, qual 0) — 2 s each = 8 000 ms total

### Lesson 2 — Around the Wheel (beginner, 2 steps)
- Step 1: Visit every diatonic chord in order C D E F G A B — 1 s each = 7 000 ms
- Step 2: Reverse — B A G F E D C — 1 s each = 7 000 ms

### Lesson 3 — Extensions (intermediate, 3 steps)
- Step 1: C triad → C7 → C9, each 2 000 ms. Introduces right-wheel movement.
- Step 2: G triad → G7 → G9
- Step 3: Am triad → Am7 — 2 s each

### Lesson 4 — I-V-vi-IV Smooth (intermediate, 1 long step)
- One continuous 16 s step: C G Am F × 2 at 2 s per chord. minScore 70.

### Lesson 5 — Fist Solo (advanced, 2 steps)
- Step 1: Lock C chord (right fist), play melody up left wheel C D E F — held chord, left moves.
  NOTE: fist is signalled by `fist: true` on GestureSignal. The scoring for this step is melody
  note accuracy only (left hand) — right hand is locked so only left noteIdx matters.
- Step 2: Same pattern over G chord.

---

## 6. `useLessonRunner` — detailed state machine

File: `src/engine/lessons/useLessonRunner.ts`

**Dependencies it receives via props:**
```typescript
function useLessonRunner(
  lesson: Lesson,
  liveSelectedRef: RefObject<DialSelection>,   // from coordinator.selectedRef
  engineRef: RefObject<AudioEngine | null>,    // to play audio during preview
  canvasRef: RefObject<HTMLCanvasElement | null>,
): LessonRunnerAPI
```

**Returns:**
```typescript
type LessonRunnerAPI = {
  phase: LessonPhase;
  stepIndex: number;          // 0-based, current step
  countdown: number;          // 3, 2, 1, 0 during 'countdown' phase
  stepScore: number;          // live-updating 0–100 during 'attempt'
  stepResults: StepResult[];  // results accumulated so far
  totalScore: number;         // mean score of completed steps
  ghostSignalsRef: RefObject<GestureSignal[]>; // renderer reads this to draw ghost orbs
  start: () => void;          // idle → preview
  retry: () => void;          // step-result → countdown (same step)
  next: () => void;           // step-result → (countdown for next step | complete)
  exit: () => void;           // any phase → idle (navigate back)
};
```

**Phase transitions:**
```
idle ──start()──> preview (play target once via externalSignalRef-like mechanism)
preview ──auto after target ends──> countdown (3s)
countdown ──auto after 3s──> attempt
attempt ──auto when durationMs elapsed──> step-result
step-result ──retry()──> countdown
step-result ──next(), more steps──> countdown (stepIndex++)
step-result ──next(), last step──> complete
complete ──exit()──> idle
```

**During `preview`:**
- Feed `targetRecording` through `replayPlayer.signalsAt()` into `ghostSignalsRef`
- Also feed into the coordinator's external signal to play audio (so user can hear the target)
- No scoring

**During `countdown`:**
- Ghost signals continue showing last frame of target
- Decrement `countdown` ref via setInterval every 1 000 ms

**During `attempt`:**
- Ghost orbs follow target recording from t=0
- Every 100 ms: call `scoreFrame()` comparing `ghostSignalsRef.current` noteIdx/qualIdx to `liveSelectedRef.current`
- Accumulate frames into `frameScores[]`
- After `step.durationMs` ms: compute mean → StepResult → transition to `step-result`

**During `step-result`:**
- Ghost signals frozen on last frame
- UI shows score, pass/fail, buttons

---

## 7. Renderer changes (`src/engine/renderer/index.ts`)

`useRenderer` currently accepts:
```typescript
(canvasRef, signalsRef, analyserRef, selectedRef, commandRef?, musicRef?)
```

**Add one parameter:**
```typescript
ghostSignalsRef?: RefObject<GestureSignal[]>
```

In the `draw()` loop, after drawing live orbs, draw ghost orbs:
```typescript
// Ghost orbs — translucent, dashed ring, drawn before live orbs so live stays on top
for (const gs of ghostSignals) {
  drawOrb(ctx, gs, w, h, amplitude, true /* isGhost */);
}
```

`drawOrb` needs an `isGhost?: boolean` param:
- if ghost: reduce alpha to 0.35, draw a dashed circle outline instead of a solid orb
- live orbs: unchanged

`useRenderer` is called from `coordinator.ts` → add ghost param there too.
`coordinator.ts` returns `ghostSignalsRef` so `PlayShell` / `LearnShell` can pass it in.

---

## 8. `LearnShell` — the lesson runner page

File: `src/components/learn/LearnShell.tsx`

Nearly identical to `PlayShell.tsx` except:
1. Reads `:lessonId` from `useParams()`
2. Looks up `lesson` from `CURRICULUM` by id; redirects to `/learn` if not found
3. Calls `useLessonRunner(lesson, selectedRef, engineRef, canvasRef)`
4. Passes `lessonRunner.ghostSignalsRef` down to coordinator (via a new optional prop or by threading it into `useRenderer` directly)
5. Renders `<LessonHUD>`, `<StepResultScreen>`, or `<CompletionScreen>` on top of the canvas instead of `<RecordButton>` etc.
6. Does NOT show VideoRecordButton or ShareButton (distracting during a lesson)

Key difference from PlayShell: the coordinator's `externalSignalRef` is overridden during preview phase to play the target through the audio engine, letting the user hear what they should aim for.

---

## 9. `LessonHUD` — in-attempt overlay

File: `src/components/learn/LessonHUD.tsx`

Props:
```typescript
{
  phase: LessonPhase;
  stepIndex: number;
  totalSteps: number;
  instruction: string;
  hint?: string;
  countdown: number;
  stepScore: number;    // live 0–100 during attempt
  elapsed: number;      // ms elapsed in current attempt
  durationMs: number;   // total attempt window
}
```

What it renders based on phase:
- `preview`: "Listen to the target…" label, animated speaker icon
- `countdown`: giant "3", "2", "1", "Go!" with fade transitions
- `attempt`:
  - Top bar: step X / Y dots
  - Instruction text (centred, large)
  - Optional hint in smaller text
  - Bottom: live score bar (green/red fill) + time remaining bar
- Other phases: null (other components handle them)

---

## 10. `StepResultScreen`

File: `src/components/learn/StepResultScreen.tsx`

Full-screen overlay (semi-transparent dark backdrop).

Shows:
- Big animated score number (counts up from 0 to achieved score)
- Pass indicator: "Great!" (≥ minScore) or "Almost — try again" (< minScore)
- Score breakdown: "Note: X/50  Chord: X/50" (average across frames)
- Two buttons: "Retry" | "Next →" (Next is disabled if score < minScore)

---

## 11. `CompletionScreen`

File: `src/components/learn/CompletionScreen.tsx`

Shows after all steps pass:
- "Lesson complete!"
- Total score (mean of step scores)
- Step-by-step breakdown table
- "Back to lessons" button → navigate('/learn')
- "Play freely" button → navigate('/play')
- Saves result to Firestore (if firebaseReady)

---

## 12. `LessonCatalog` and `LessonCard`

`LessonCatalog.tsx` — `/learn` route:
- Heading: "Learn to play"
- Grid of `<LessonCard>` for each entry in `CURRICULUM`
- Each card is clickable → navigate(`/learn/${lesson.id}`)

`LessonCard.tsx`:
- Title, subtitle
- Difficulty badge (colour coded: green/amber/red)
- Tags list
- Best score (from Firestore progress, or "—" if not attempted)
- Lock icon if lesson requires finishing a previous one (for now: all unlocked)

---

## 13. Firestore schema

Collection path: `users/{uid}/lessonProgress/{lessonId}`

```
{
  bestScore: number,       // 0–100
  completedAt: Timestamp | null,
  attempts: number
}
```

Only written at lesson completion. Read in `LessonCatalog` to show progress badges.
Must degrade gracefully when `!firebaseReady` — use local state only, no persistence.

A `useLessonProgress` hook in `src/engine/lessons/useLessonProgress.ts` wraps Firestore:
```typescript
function useLessonProgress(lessonId: string): {
  progress: LessonProgress | null;  // null = loading or no firebase
  save: (result: LessonResult) => Promise<void>;
}
```

---

## 14. Route changes in `App.tsx`

Add two routes in both the `firebaseReady` false block AND the authenticated block:
```tsx
<Route path="/learn" element={<LessonCatalog />} />
<Route path="/learn/:lessonId" element={<LearnShell />} />
```

Also add a "Learn" link somewhere accessible from PlayShell (small fixed button top-right area or in hud-bottom).

---

## 15. Implementation order (do these in sequence)

The numbers below are the order to implement. Each step should build + type-check before moving on.

| # | Task | Status |
|---|---|---|
| 1 | `src/engine/lessons/types.ts` — all TypeScript types | DONE |
| 2 | `src/engine/lessons/scorer.ts` — `scoreFrame()` | DONE |
| 3 | `src/engine/lessons/curriculum.ts` — 5 lessons with hand-authored recordings | DONE |
| 4 | `src/engine/renderer/index.ts` — add `ghostSignalsRef` param + ghost orb drawing | DONE |
| 5 | `src/coordinator.ts` — thread `ghostSignalsRef` through | DONE |
| 6 | `src/engine/lessons/useLessonRunner.ts` — full state machine hook | DONE |
| 7 | `src/components/learn/LessonHUD.tsx` | DONE |
| 8 | `src/components/learn/StepResultScreen.tsx` | DONE |
| 9 | `src/components/learn/CompletionScreen.tsx` | DONE |
| 10 | `src/components/learn/LessonCard.tsx` | DONE |
| 11 | `src/components/learn/LessonCatalog.tsx` | DONE |
| 12 | `src/components/learn/LearnShell.tsx` — wire everything together | DONE |
| 13 | `src/engine/lessons/useLessonProgress.ts` — Firestore progress hook | DONE |
| 14 | `src/App.tsx` — add /learn routes | DONE |
| 15 | `src/App.css` — all lesson system styles | DONE |

## Remaining / known gaps (pick these up next)

- **Preview audio**: During the `preview` phase the ghost orbs move but no sound plays (the target recording isn't being fed into the audio engine). `useLessonRunner` receives `_engineRef` for this purpose. To implement: during preview, feed `ghostSignalsRef` signals into the coordinator's `externalSignalRef` so the engine plays the target chords. This requires `LearnShell` to expose an `externalSignalRef` override or the runner to drive audio directly via `AudioEngine.play()`.
- **Fist-lock in target recordings**: Lesson 5 target samples don't currently set `fist: true` on GestureSignals — the replayPlayer only generates x/y from noteIdx/qualIdx. A future enhancement would add a `fist` flag to `RecordingSample` so Lesson 5 can correctly demo the chord-lock mechanic visually.
- **Manual testing**: Navigate to `/play` → click "Learn" → run through Lesson 1 end-to-end. Verify: start screen, preview ghost orbs, countdown, attempt scoring, step result, completion screen.
- **Mobile layout**: The HUD and cards should be tested on small screens (< 400px wide). The `lesson-grid` uses `auto-fill` so it collapses to one column automatically, but the HUD instruction text and bar widths may need media query tweaks.

---

## 16. Key design decisions

**Why store target recordings as raw `RecordingSample[]` rather than encoded URL strings?**
The curriculum is shipped as code, not fetched. Raw arrays are easier to author and read. The `encode()`/`decode()` codec is only needed for URL sharing. We construct `Recording` objects directly.

**Why not use a separate AudioContext for preview playback?**
The existing `AudioEngine` is already running. During preview we feed target signals into `externalSignalRef` (same mechanism `ReplayShell` uses) so the existing audio pipeline plays them. No second context needed.

**Why is scoring frame-by-frame rather than note-change-by-note-change?**
Frame scoring rewards holding the right chord for the full duration, not just touching it briefly. A player who plays C for 2.9s and then drifts should score ~97, not 100. It's also simpler to implement — no need to detect "chord change events".

**Why ghost orbs rather than highlighted wheel slices?**
Ghost orbs show spatial position (where the hand should be) which is more actionable than lighting up a slice label. Both live and target hands appear simultaneously so the user can see the gap between them.

**Why is LearnShell separate from PlayShell rather than a mode inside PlayShell?**
The lesson runner needs to hijack `externalSignalRef` during preview, override the coordinator's normal live-signal path, and show completely different UI. The shared state would make PlayShell too complex. Separate components sharing the same coordinator/renderer hooks is cleaner.

**Ghost signal drawing order:**
Ghost orbs are drawn BEFORE live orbs so the live hands always appear on top. The user's real hands should never be obscured by target indicators.

---

## 17. Curriculum — actual sample data

Below is the exact `RecordingSample[]` structure for each step. `dt` values are in ms.
`noteIdx` maps to the left wheel (C=0 D=1 E=2 F=3 G=4 A=5 B=6).
`qualityIdx` maps to the right wheel (triad=0 6th=1 7th=2 9th=3 add9=4 sus2=5 sus4=6).

### Lesson 1, Step 1 — Hold C triad (3 000 ms)
```
30 samples of { dt: 100, noteIdx: 0, qualityIdx: 0, vibe: 0 }
```

### Lesson 1, Step 2 — Hold G triad (3 000 ms)
```
30 samples of { dt: 100, noteIdx: 4, qualityIdx: 0, vibe: 0 }
```

### Lesson 1, Step 3 — I-V-vi-IV progression (8 000 ms)
```
C triad × 20 samples (2 000 ms)
G triad × 20 samples (2 000 ms)
Am triad × 20 samples  (noteIdx 5, qualIdx 0)
F triad × 20 samples   (noteIdx 3, qualIdx 0)
```

### Lesson 2, Step 1 — Ascend C D E F G A B (7 000 ms)
```
Each note: 10 samples × 100 ms = 1 000 ms, qualIdx 0
noteIdx 0 → 1 → 2 → 3 → 4 → 5 → 6
```

### Lesson 2, Step 2 — Descend B A G F E D C (7 000 ms)
```
Each note: 10 samples × 100 ms = 1 000 ms, qualIdx 0
noteIdx 6 → 5 → 4 → 3 → 2 → 1 → 0
```

### Lesson 3, Step 1 — C: triad → 7th → 9th (6 000 ms)
```
C triad × 20 (noteIdx 0, qualIdx 0)
C 7th   × 20 (noteIdx 0, qualIdx 2)
C 9th   × 20 (noteIdx 0, qualIdx 3)
```

### Lesson 3, Step 2 — G: triad → 7th → 9th (6 000 ms)
```
G triad × 20 (noteIdx 4, qualIdx 0)
G 7th   × 20 (noteIdx 4, qualIdx 2)
G 9th   × 20 (noteIdx 4, qualIdx 3)
```

### Lesson 3, Step 3 — Am triad → Am7 (4 000 ms)
```
Am triad × 20 (noteIdx 5, qualIdx 0)
Am 7th   × 20 (noteIdx 5, qualIdx 2)
```

### Lesson 4, Step 1 — I-V-vi-IV × 2 (16 000 ms)
```
C triad × 20, G triad × 20, Am triad × 20, F triad × 20  (repeat twice)
```

### Lesson 5, Step 1 — Fist lock C + melody up (5 000 ms)
```
noteIdx ramps 0→1→2→3 (1 250 ms each, 12-13 samples each), qualIdx 0, fist on right
NOTE: In this lesson, scoring only checks noteIdx (left hand), since fist locks right.
```

### Lesson 5, Step 2 — Fist lock G + melody up (5 000 ms)
```
Same ramp pattern starting at noteIdx 4 → 5 → 6 → 0(wrap), qualIdx 0
```

---

## 18. CSS class names to add to App.css

```css
/* ── Lesson system ─────────────────────────────────────────── */

/* /learn catalog page */
.learn-page { }
.learn-header { }
.lesson-grid { }

/* Lesson card */
.lesson-card { }
.lesson-card__difficulty { }  /* --beginner / --intermediate / --advanced modifiers */
.lesson-card__title { }
.lesson-card__subtitle { }
.lesson-card__score { }

/* In-lesson HUD overlay */
.lesson-hud { }
.lesson-hud__steps { }      /* dot progress indicator */
.lesson-hud__instruction { }
.lesson-hud__hint { }
.lesson-hud__score-bar { }  /* live score fill */
.lesson-hud__time-bar { }   /* time remaining */

/* Countdown overlay */
.lesson-countdown { }       /* giant number */

/* Step result overlay */
.step-result { }
.step-result__score { }
.step-result__pass { }
.step-result__fail { }

/* Completion screen */
.lesson-complete { }
.lesson-complete__total { }
.lesson-complete__table { }
```

---

## 19. What a fresh Claude session should do

1. Read this file completely.
2. Run `npm run build` — should pass cleanly (all video recording work is done).
3. Look at the **Status** column in section 15 to find the first TODO item.
4. Implement that item, run `npm run build` to type-check, then mark it DONE in this file.
5. Repeat for the next TODO item.
6. After completing all 15 items, run `npm run dev` and manually test:
   - Navigate to `/learn` — catalog shows 5 lessons
   - Click Lesson 1 — canvas loads, preview plays
   - Countdown shows 3-2-1
   - Play along — ghost orbs visible
   - Score appears after attempt window
   - Complete all steps → completion screen
7. Commit with message `feat: lesson system — <item completed>` after each significant step.
