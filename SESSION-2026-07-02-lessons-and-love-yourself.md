# Session notes — 2026-07-02: Lesson system + Love Yourself real-audio backing

Full context for picking up this work. Written for a teammate joining cold.
(Committed at repo root because `docs/` is gitignored.)

## Part 1 — Where the lesson system stands

Everything below is merged to `main`:

- **`/learn` is a guided path** of 12 lessons: technique drills interleaved with real-song
  lessons (Let It Be, Stand By Me, Best Part, Someone Like You, Love Yourself, Zombie,
  Hallelujah, Wonderwall). Song lessons teach in chunks → slow full loop → song-speed.
- **Progression:** 1–3 stars per lesson (pass / 80 / 92), "up next" nudge, next-lesson CTA.
  Everything is skippable — no locks, failed steps offer Skip (owner: fun over forced).
- **Backing band (`src/engine/audio/SongBackingTrack.ts`):** bespoke per-song synthesized
  arrangements — drums/bass patterns plus a pad/arpeggio voice playing the diatonic chord
  voicings (piano quarters for Let It Be, 6/8 broken chords for Hallelujah at
  `stepsPerBeat: 3`, walking '50s bass for Stand By Me, swung fingerpicking for Best Part,
  saw-bass eighths for Zombie, strummed pushes for Wonderwall…). All in the `ARRANGEMENTS`
  table — mix/pattern tweaks are one-liners.
- **Song lessons re-tune the wheel** to their key/scale (A major, E major, E minor,
  A mixolydian). A nasty bug here is fixed: `LearnShell` previously never passed
  `musicConfig` to the coordinator, so the wheel showed/sounded C major while scoring
  another key.
- **Live chord prompts** (current + next chord, huge, centre screen) during song attempts;
  technique drills stay prompt-free to test recall.
- Notable fixes along the way: start-card burying the input chooser; CompletionScreen
  double-saving to Firestore; `/learn` not scrollable (global `body{overflow:hidden}`);
  learn UI redesigned to brand tokens (warm paper / ink / froola orange).
- Chord-grid constraint: song bpm must satisfy `(120000 / bpm) % 100 === 0` so 2-beat
  chords land on the 100 ms scoring grid (see `builders.ts`, enforced in
  `curriculum.test.ts`).

## Part 2 — The Love Yourself experiment (the main event)

### Goal
Owner's bar: *"users should feel like they're actually playing the real song."* Successive
attempts at synthesized backing (bass+hat pulse → per-style grooves → per-song
arrangements) never passed that bar — a chord progression + groove is anonymous without
the record's actual sound.

### What was tried, in order
1. **Synth arrangements** (above) — recognizable as a genre, not as the song.
2. **Vocal-melody extraction → synth lead.** Owner supplied their licensed mp3 locally
   (it sits untracked in `dist/assets/`; keep it out of git). Pipeline built and run
   locally: Demucs isolates the vocal stem → torchcrepe tracks pitch → notes segmented
   and quantized to a 16th grid. Output is a JSON note file the app loads at runtime.
   **Verdict from the owner: nowhere close** ("5% accuracy") — automatic transcription of
   a fast syllabic vocal plus a triangle-wave voice has a hard ceiling. Also shipped with
   a real bug: the melody attached to the whole *lesson*, so it played over every step's
   chords and restarted each phase (heard as "looping"). Fixed by scoping section-length
   assets to `melodyStepId`.
3. **Real-audio instrumental backing (current approach).** Demucs already separates the
   owner's file into stems; `tools/melody-extract/make_backing.py` mixes the non-vocal
   stems into an instrumental and time-stretches it (phase vocoder) from the song's
   measured ~103.4 bpm to the lesson's 100 bpm so the chord prompts stay in sync. The app
   plays that file as the backing on the verse step — karaoke-style, it literally is the
   record minus vocals.

### The licensing setup (important — don't undo this)
- Owner states the company has licensing and a legal team for the copyrighted material.
- Regardless: **no song-derived content ever goes in git.** `public/melodies/` is
  gitignored; the repo carries only neutral tooling and playback machinery. The
  extraction/mixing runs on the owner's machine against their own file, and the final
  "place the file into the app" step is deliberately left to a human who can stand on
  the license (it's a one-line `cp`). Claude sessions working on this repo build/refine
  the tools but don't place or hand-author song content (melody notes, lyrics, audio).
- Also keep hint text free of lyric quotes — song lessons reference sections
  descriptively.

### How the app consumes the assets (all wired for Love Yourself)
`src/engine/lessons/songs.ts`, lesson `song-love-yourself`:
- `melodyAsset: '/melodies/love-yourself.json'` — synth-lead note data `{step, midi, dur}[]`
  (16ths). Played by `SongBackingTrack` (`MELODY_TRANSPOSE`, `MELODY_GAIN` constants).
- `audioBackingAsset: '/melodies/love-yourself-backing.wav'` — real instrumental.
  **Takes precedence over the melody JSON when present.** Played via
  `SongBackingTrack.startAudio()` (gain node `audioGain`, currently 0.75).
- `melodyStepId: 'ly-s3'` — both assets only play on the verse step (30 s section;
  the step is sized at 7 chord loops ≈ 34 s to carry it).
- Runner fetches both with `cache: 'no-store'`; 404 = graceful fallback to synth band.

### Regenerating the assets (owner's machine, one-time venv)
```bash
cd tools/melody-extract
python3 -m venv .venv          # system python3.9 works; torch installs fine on arm64
.venv/bin/pip install torch torchaudio demucs torchcrepe soundfile numpy

# instrumental backing (the good path) — clip was 20s–50s of the mp3:
# 1) run demucs on the clip to get stems (see extract_melody.py for the clip step), then:
.venv/bin/python make_backing.py <stems-dir> ../../public/melodies/love-yourself-backing.wav \
    --source-bpm 103.4 --target-bpm 100 [--trim <seconds>]

# synth melody data (superseded for this song, kept for experiments):
.venv/bin/python extract_melody.py <mp3> 20 30 ../../public/melodies/love-yourself.json
```

### Current status / open items
- Owner had just been handed the generated backing wav to `cp` into
  `public/melodies/` and audition — **no ear-verdict yet** as of this writing.
- Likely tuning: `--trim` for downbeat alignment (clip may not start exactly on beat 1
  of the chord loop), `audioGain` level, and whether preview *and* attempt should both
  play the audio (currently both do).
- Time-stretch quality: phase vocoder at 3.4% is subtle; if artifacts bother anyone,
  re-author the lesson at the song's native tempo instead (needs the bpm-grid constraint
  relaxed or resampled scoring).
- Vercel deploys from git, so local-only assets don't ship — the deployed site plays the
  synth band. Shipping real audio to production is a product/legal decision for the team.
- Melody-over-instrumental (extracted lead layered on the real backing) was considered
  and parked — `startAudio()` currently replaces the synth arrangement entirely.
- The mp3 lives at `dist/assets/` (untracked); `dist/` is build output, so a rebuild may
  clobber it — worth moving somewhere safer locally.

### Key files
- `src/engine/audio/SongBackingTrack.ts` — arrangements, melody voice, `startAudio`
- `src/engine/lessons/useLessonRunner.ts` — asset fetch, step scoping, backing lifecycle
- `src/engine/lessons/songs.ts` / `curriculum.ts` — content + learning path
- `tools/melody-extract/` — `extract_melody.py`, `make_backing.py`
- `.gitignore` — `public/melodies/` (keep it that way)
