# Song-based lessons — design

## Problem

Froola's `/learn` curriculum (`curriculum.ts`) is five lessons of abstract
drills in C major. Nothing lets a user practice with a real, recognizable
song, which is the practice mode people actually want ("I want to play
something I know").

## Goal

Add a second lesson track — real songs' chord progressions — that reuses the
existing lesson runner, ghost-orb renderer, scoring, and Firestore progress
machinery as-is, and adds a quiet synthesized backing track so it feels like
"a song is playing" while the user plays along. No new UI paradigm (no
rhythm-game/note-highway mode), no copyrighted audio.

## Scope decisions (confirmed with user)

- **Presentation**: separate "Songs" section in the `/learn` catalog, not
  mixed into the existing 5-lesson grid.
- **Content**: chord progression only (no melody-note steps) — reuses the
  scorer exactly as-is.
- **Backing audio**: fully synthesized (bass + simple drum pulse following
  the chord root), *not* real recordings — avoids sync-licensing risk
  entirely, since only the chord progression (not copyrightable) is
  reproduced.
- **Spaced repetition**: song lessons are **not** added to `drillBank.ts` /
  Leitner review for v1. They're a "play it well once" experience, distinct
  from the drill-recall loop. Revisit later if wanted.
- **Content set**: start with 3 songs, each 2-3 steps, using progressions
  simple enough to map onto the engine's diatonic triad/extension model
  (e.g. I-V-vi-IV shape, 12-bar-blues shape, one other 4-chord pop shape).
  Only the chord progression is reproduced — not melody, lyrics, or audio.

## Design

### 1. Data model & content

- `Lesson` gains an optional `bpm?: number` (default ~90) — drives both the
  `SongBackingTrack` tempo and ghost-target pacing through chord changes.
- Each song lesson sets its own `musicConfig` (key/scale) rather than
  assuming C major, reusing the existing key/scale selector infra
  (`keyScale.ts`) — no new type needed.
- New song lessons are tagged `tags: ['song']` so drill lessons are
  completely unaffected by any of the new behavior gated on this tag.
- New content file `src/engine/lessons/songs.ts`, authored with the same
  `hold()` / `seq()` / `step()` helpers `curriculum.ts` already uses (shared
  by export, not duplicated).
- Not registered in `drillBank.ts`.

### 2. `SongBackingTrack` (new engine class)

`src/engine/audio/SongBackingTrack.ts`, same shape as the existing
`ChordLooper`:

- Owns a `TempoClock` at the lesson's `bpm`.
- Per step, schedules synthesized-inline (no samples): a low
  sine/triangle bass note at the chord's root (one octave down) on the
  beat, and a short noise-burst "hihat" tick on off-beats.
- Chord sequence for playback is derived directly from the current lesson
  step's `targetRecording` samples (root note per sample) — no separate
  authoring format.
- Runs through its own fixed-low-gain `GainNode` (~0.15) into
  `AudioEngine`'s `masterGain`, so it never competes with or masks the main
  synth / scoring signal.
- Public API: `start(chordSequence, bpm)`, `stop()`.

### 3. `useLessonRunner` integration

- Started alongside `startPreviewAudio()` / `startGhostLoop()` in
  `startPreview`, kept running through `countdown`, continues into
  `startAttempt` — stopped wherever `clearTimers()` already stops the synth
  (`engineRef.current?.silence('synth')`).
- Gated entirely on `lesson.tags.includes('song')` — zero behavior change
  for the existing 5 drill lessons.

### 4. Catalog / UI

- `LessonCatalog` renders a second section, "Songs," below the existing
  grid, grouping by the `song` tag. Same `LessonCard` component.
- No new route. Song lessons run through the exact same
  `LearnShell` → `useLessonRunner` → scorer → Firestore-progress path as
  drills.

## Out of scope (v1)

- Leitner/spaced-repetition integration for songs.
- Melody-note steps.
- Real/licensed audio playback.
- More than 3 initial songs.

## Open risk / follow-up

- Backing-track gain (~0.15) and bass/hihat balance will need by-ear tuning
  once implemented — not something that can be fully nailed down on paper.
- `bpm` field is new on `Lesson`; needs a default so it's optional for
  existing drill lessons (no back-compat break).
