# froola

**Play music with your hands — no instrument required.**

Froola is a browser-based musical instrument that uses your camera and hand tracking to let anyone play chords and melodies in real time. Point your hands at the screen, move them around the two interactive dials, and make music. No downloads, no sign-up friction, no music theory knowledge required.

---

## How it works

Froola uses [MediaPipe](https://mediapipe.dev/) to track your hands entirely on-device — no video is ever sent to a server. Two circular dials appear on screen:

- **Left hand → Note dial** — move your left hand around the wheel to pick a scale degree; its chord root (and major/minor/diminished quality) follows the selected key & scale
- **Right hand → Extension dial** — move your right hand to add colour on top of that chord (triad, 6th, 7th, 9th, add9, sus2, sus4)
- **Height** — how high your hands are controls the register (octave range)
- **Make a fist** — locks your current chord selection while you move freely

No camera? Froola falls back to **mouse mode** (desktop) or **touch mode** (mobile), where your cursor or finger controls the left orb.

---

## Features

### Free
- Both instrument modes — **synth** and **piano**
- Camera hand tracking (on-device, private) + mouse/touch fallback
- Recordings up to 30 seconds
- Shareable replay links

### Pro *(coming soon)*
- Unlimited recordings
- Audio download (MP3 / WAV)
- Watermark-free share links
- Additional instrument & sound packs
- Loop & layer tracks
- Custom visual themes
- MIDI export

---

## Tech stack

| Layer | Technology |
|---|---|
| Framework | React 19 + TypeScript + Vite |
| Routing | React Router v7 |
| Hand tracking | MediaPipe Tasks Vision (WASM, runs on-device) |
| Audio | Web Audio API + [soundfont-player](https://github.com/danigb/soundfont-player) |
| Auth & database | Supabase (Google Sign-In via Supabase Auth + Postgres for profile storage) |
| Rendering | Canvas 2D API |
| Tests | Vitest + Testing Library |

---

## Getting started

### Prerequisites
- Node.js 18+
- A Supabase project with Google Sign-In and a `profiles` table set up ([setup guide below](#supabase-setup))

### Install and run

```bash
git clone https://github.com/froola-app/froola.git
cd froola
npm install
cp .env.example .env   # fill in your Supabase config
npm run dev
```

### Supabase setup

1. Go to [supabase.com](https://supabase.com) and create a new project
2. In [Google Cloud Console](https://console.cloud.google.com/), create an OAuth Client ID (Web application) and add the Supabase callback URL (`https://<project-ref>.supabase.co/auth/v1/callback`) as an authorized redirect URI
3. In Supabase, **Authentication** → Providers → enable **Google**, pasting in the Client ID/Secret from step 2
4. **Authentication** → URL Configuration → Redirect URLs → add `http://localhost:5173/auth/popup` and your production origin + `/auth/popup` (the sign-in popup calls `signInWithOAuth` with this as `redirectTo`, so it must be allowlisted or the OAuth flow will fail)
5. **Table Editor** → create a `profiles` table with columns: `id` (uuid, references `auth.users`), `user_type` (text), `onboarding_complete` (boolean)
6. **Project settings** → API → copy the Project URL and anon/publishable key
7. Paste the values into your `.env` file:

```env
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

Optional: see `supabase/migrations/` for the expected schema and RLS policies.

### Available scripts

```bash
npm run dev        # start dev server
npm run build      # production build
npm run test       # run tests
npm run test:watch # watch mode
npm run lint       # lint
```

---

## Project structure

```
src/
├── engine/
│   ├── audio/        # Web Audio engine (synth, sampler, AudioContext management)
│   ├── input/        # Hand tracking + mouse/touch gesture input
│   ├── music/        # Chord voicings, scales, gesture → musical command mapping
│   ├── renderer/     # Canvas 2D rendering (dials, orbs, particles)
│   └── types.ts      # Shared types (GestureSignal, MusicalCommand, etc.)
├── components/
│   ├── onboarding/   # 3-step onboarding flow (user type, tips, pricing)
│   ├── PlayShell.tsx # Main play screen
│   ├── ReplayShell.tsx
│   ├── RecordButton.tsx
│   └── ShareButton.tsx
├── contexts/
│   └── AuthContext.tsx  # Supabase auth state + profile
├── coordinator.ts    # Wires input → music → audio → renderer
└── supabase.ts       # Supabase client init
docs/
├── marketing.md      # Product strategy, free/paid tiers, growth ideas
└── tasks/            # Engineering task specs
```

---

## Onboarding flow

New users go through a 3-step flow after signing in with Google:

1. **User type** — casual, content creator, or music learner (stored in Supabase, personalizes future features)
2. **Learning curve tips** — quick guide on how hand positions map to sound
3. **Pricing overview** — what's free forever vs. what's in Pro

Returning users skip onboarding and go straight to the app. The `/replay` route is always public — share links work without a sign-in.

---

## Browser support

| Browser | Camera mode | Touch/Mouse mode |
|---|---|---|
| Chrome (desktop) | ✅ | ✅ |
| Safari (desktop) | ✅ | ✅ |
| Chrome (Android) | ✅ | ✅ |
| Safari (iOS 15.4+) | ✅ | ✅ |
| Firefox | ✅ | ✅ |

MediaPipe's WASM runtime runs entirely in the browser — no backend involved in hand tracking.

---

## Privacy

- Camera frames are processed locally by MediaPipe and **never leave your device**
- No video or image data is transmitted anywhere
- Only your Google account profile (name, email) and onboarding preferences are stored in Supabase (Postgres)

---

## License

Private — all rights reserved.
