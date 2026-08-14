# Contributing to froola

Thanks for looking. Froola is a browser instrument built on a hand-tracking music engine,
and it is small enough to hold in your head in an afternoon.

## Getting set up

```bash
git clone https://github.com/froola-app/froola.git
cd froola
npm install
npm run dev
```

That's the whole setup. No env file, no database, no keys. You need a webcam to try the
instrument end to end, and Chrome or Safari to test what most players use.

Before opening a pull request:

```bash
npm run test
npm run lint
npx tsc --noEmit
```

CI runs the same three.

## Where things live

```
src/
├── engine/        the instrument, independent of the UI
│   ├── input/     MediaPipe landmarks → per-hand signals
│   ├── music/     keys, scales, voicings, gesture → chord
│   ├── audio/     Web Audio synth, sampler, tempo clock
│   ├── looper/    chord looper
│   ├── arp/       arpeggiator
│   ├── renderer/  canvas dials, markers, particles, wheel geometry
│   ├── recording/ replay codec, video capture, take storage
│   └── lessons/   curriculum, scoring, spaced repetition
├── coordinator.ts wires input → music → audio → renderer
└── components/    React UI: landing, play shell, learn shell, profile drawer
docs/ARCHITECTURE.md explains the data flow and the timing constants.
```

## House rules

These are the ones that will get a pull request sent back, so they're worth reading first.

1. **The gesture-to-audio hot path uses refs, never React state.** A re-render between a
   hand moving and a note sounding is audible. See ARCHITECTURE.md.
2. **Visual work must not change dial interaction.** Wheel geometry, the hit-test, and the
   selection hysteresis are behaviour. Restyle freely, but if the wheels end up in
   different places or select differently, that's a regression.
3. **No song-derived content, ever.** Chord progressions only. No melodies, no lyrics, no
   audio from any recording, and no song titles or artist names in lesson copy.
   `public/melodies/` is gitignored and stays that way.
4. **Match the surrounding code.** Same comment density, same naming, same idiom. Comments
   here explain why a thing is the way it is, not what the line does.
5. **Tests come with behaviour changes.** Vitest and Testing Library are already set up;
   there are 44 test files to copy the style from.

## Copy voice

If you're touching user-facing text: warm, plain, and specific. No em dashes. Nothing
cringy. The instrument is fun; the writing doesn't have to keep telling you so.

## Good first changes

- Wire a UI for the visual themes in `engine/renderer/themes.ts` (the palettes exist and
  are reachable from the profile drawer, but there's no picker on the play screen).
- Safari's `MediaRecorder` is webm-only; add an mp4 fallback in
  `engine/recording/useVideoRecorder.ts` so recording works there.
- Add scales beyond the current set in `engine/music/scales.ts`.
- Haptics on slice change via `navigator.vibrate` for touch players.

Open issues carry more. If you're planning something large, open an issue first so nobody
duplicates the work.

## Pull requests

Keep them focused, explain what changed and why in the description, and say how you tested
it. If the change affects what a player sees or hears, a short clip or screenshot helps
more than a paragraph.

By contributing you agree that your contributions are licensed under the MIT License.
