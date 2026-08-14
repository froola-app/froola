<div align="center">

# froola

**Play music with your hands. No instrument, no install, no account.**

[![tests](https://github.com/froola-app/froola/actions/workflows/ci.yml/badge.svg)](https://github.com/froola-app/froola/actions/workflows/ci.yml)
[![license: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

[Try it](https://froola.vercel.app) · [How it works](#how-it-works) · [Architecture](docs/ARCHITECTURE.md) · [Contributing](CONTRIBUTING.md)

</div>

---

Froola is a browser instrument. Your camera watches your hands, two dials on screen follow
them, and moving between the dials plays chords in whatever key and scale you pick. It is
also the reference app for a hand-tracking music engine you can build your own things with.

```bash
git clone https://github.com/froola-app/froola.git
cd froola
npm install
npm run dev
```

No API keys. No database. No config file. Open the page, allow the camera, play.

---

## How it works

Hand tracking runs on-device through [MediaPipe](https://mediapipe.dev/), so camera frames
are never uploaded anywhere. Two circular dials sit on the canvas:

- **Left hand → note dial.** Position around the wheel picks a scale degree. Its chord root
  and quality (major, minor, diminished) follow the key and scale you've chosen.
- **Right hand → extension dial.** Position adds colour on top: triad, 6th, 7th, 9th, add9,
  sus2, sus4.
- **Height** sets the register.
- **Make a fist** locks the current chord so you can move freely without changing it.

On top of that sit a chord looper, an arpeggiator whose rate follows hand height, video
recording, and a lesson path with spaced-repetition review.

## The engine

Everything musical lives in `src/engine/`, independent of the React app that renders it.
The audio, music, looper, arpeggiator, and recording-codec modules import nothing from
React at all.

| Module | What it owns |
|---|---|
| `engine/input/` | MediaPipe landmarks to stable per-hand signals: palm centre, facing, and hand ids assigned by screen position |
| `engine/music/` | Keys, scales, chord voicings, and the gesture-to-chord mapping |
| `engine/audio/` | Web Audio synth and sampler, tempo clock, backing arrangements |
| `engine/looper/` | Chord looper with beat-quantised slots |
| `engine/arp/` | Arpeggiator driven by the same clock |
| `engine/renderer/` | Canvas 2D dials, hand markers, particles, and the shared wheel geometry |
| `engine/recording/` | Bit-packed gesture codec, video capture, and the local/cloud take stores |
| `engine/lessons/` | Curriculum, scoring, drill bank, and a Leitner spaced-repetition scheduler |

`src/coordinator.ts` wires them together: one `requestAnimationFrame` loop reading gesture
input and driving audio and the renderer. That loop talks to refs, never React state, so a
re-render can never land between a hand moving and a note sounding. `docs/ARCHITECTURE.md`
goes through the data flow properly.

## Optional: accounts

Froola stores your recordings and lesson progress in the browser by default, and that path
is the one that gets the attention. If you want progress to follow a player between
devices, point it at your own [Supabase](https://supabase.com) project:

1. Create a project. Under **Authentication → Providers**, enable Google (and add your
   OAuth client from the Google Cloud Console, with the Supabase callback URL as an
   authorised redirect URI).
2. Under **Authentication → URL Configuration**, allowlist `http://localhost:5173/auth/popup`
   and your production origin plus `/auth/popup`. The sign-in popup passes this as
   `redirectTo`, so the OAuth flow fails without it.
3. Apply the schema in `supabase/migrations/`.
4. Copy the project URL and anon key from **Project Settings → API** into `.env`:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

With those set, signing in becomes available and syncs on top of local storage. Without
them the sign-in UI never appears and nothing else changes.

## Scripts

```bash
npm run dev         # dev server
npm run build       # typecheck + production build
npm run test        # vitest run
npm run test:watch  # vitest watch
npm run lint        # eslint
npx tsc --noEmit    # typecheck only
```

## Browser support

| Browser | Camera mode |
|---|---|
| Chrome (desktop) | yes |
| Safari (desktop) | yes |
| Firefox | yes |
| Chrome (Android) | yes |
| Safari (iOS 15.4+) | yes |

Touch works too: two fingers drive the two wheels.

## Privacy

Camera frames are processed locally by MediaPipe's WASM runtime and never transmitted. No
video or image data leaves your device. With no Supabase project configured, nothing leaves
your device at all: recordings live in IndexedDB and progress in localStorage.

## A note on the lessons

Song lessons teach chord progressions, which aren't copyrightable, and are named for what
they teach rather than for records they evoke. No melodies, lyrics, or audio from any
recording are in this repository, and none should ever be added.

## What's in `optional/`

Froola used to be a subscription product. The Stripe integration is parked under
`optional/billing/` as a reference implementation: it is not built, not type-checked, and
nothing in `src/` imports it. See `optional/billing/README.md`.

## Contributing

Issues and pull requests are welcome. `CONTRIBUTING.md` covers the layout, the house rules
(the hot path stays on refs; visual work must not change dial interaction), and what a good
first change looks like.

## License

MIT. See [LICENSE](LICENSE).
