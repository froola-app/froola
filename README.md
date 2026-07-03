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
| Auth & database | Firebase (Google Sign-In + Firestore) |
| Rendering | Canvas 2D API |
| Tests | Vitest + Testing Library |

---

## Getting started

### Prerequisites
- Node.js 18+
- A Firebase project with Google Sign-In and Firestore enabled ([setup guide below](#firebase-setup))

### Install and run

```bash
git clone https://github.com/froola-app/froola.git
cd froola
npm install
cp .env.example .env   # fill in your Firebase config
npm run dev
```

### Firebase setup

1. Go to [console.firebase.google.com](https://console.firebase.google.com) and create a new project
2. **Authentication** → Sign-in method → enable **Google**
3. **Firestore Database** → Create database → Start in test mode
4. **Project settings** → Your apps → register a Web app → copy the config
5. Paste the values into your `.env` file:

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

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
│   └── AuthContext.tsx  # Firebase auth state + Firestore profile
├── coordinator.ts    # Wires input → music → audio → renderer
└── firebase.ts       # Firebase app init
docs/
├── marketing.md      # Product strategy, free/paid tiers, growth ideas
└── tasks/            # Engineering task specs
```

---

## Onboarding flow

New users go through a 3-step flow after signing in with Google:

1. **User type** — casual, content creator, or music learner (stored in Firestore, personalizes future features)
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
- Only your Google account profile (name, email) and onboarding preferences are stored in Firestore

---

## License

Private — all rights reserved.
