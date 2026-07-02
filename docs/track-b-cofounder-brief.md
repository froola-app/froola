# Froola — Track B Engineering Brief
### For the cofounder / Surface owner

**Date:** 2026-06-25
**Product:** Froola — gesture-controlled musical instrument for the browser
**Your track:** B — "Surface" (Input, Renderer, React shell, Premium infra)
**Their track:** A — "Sound" (Musical Mapping + Audio Engine)
**Stack:** Vite 8 + React 19 + TypeScript (existing repo scaffold)

---

## What you're building (30-second version)

Froola lets someone with zero musical knowledge move their hand in front of a camera
and instantly play something that sounds great. There is no keyboard, no interface,
no terminology — just a dark full-screen canvas, a glowing cursor that follows your
hand, and music. The smarter it sounds, the more the canvas glows warm.

Your job is everything the user directly interacts with: the camera feed and hand
tracking, the canvas that renders it all, the onboarding, the settings, the upgrade
flow, and the WebRTC collaboration layer in the final phase.

---

## The two of you, one seam

The system has two tracks because the core pipeline has one clean split:

**A produces music. You deliver it to the user.**

Your counterpart (Track A) owns two pure-logic modules:
- **L2 Musical Mapping** — turns a normalized hand position + vibe setting into
  a musical command (which chord, which voicing, which register)
- **L3 Audio Engine** — takes that command and produces actual sound via Web Audio

You own everything else. The contract between the two tracks is exactly two data
types, which you define together in the first session of SP1:

```typescript
// B produces → A and your renderer consume
type GestureSignal = {
  x: number;       // 0–1, horizontal hand position
  y: number;       // 0–1, vertical hand position
  present: boolean;
  handId: 'left' | 'right';
}

// A produces → your renderer and the audio engine consume
type MusicalCommand = {
  chord: string;        // e.g. "Cmaj7"
  voicing: number[];    // MIDI note numbers
  register: number;     // 0–1, high to low
  texture: number;      // 0–1, sparse to dense
}
```

Freeze these types before you split. They are the only shared state. Once frozen,
you work in separate files with nearly zero merge conflict.

**The hard architectural rule (from the PRD):** all gesture → audio parameter
updates flow through **mutable refs**, never React state. React state is only for
UI chrome (onboarding modal, settings panel, upsell). This is non-negotiable — it
keeps the hot render path off the React reconciler.

---

## The architecture layers you own

### L1 — Input
**Purpose:** normalize the camera (MediaPipe Hands) *or* mouse into one unified
`GestureSignal` stream, so nothing downstream knows or cares about the source.

**Responsibilities:**
- Request and manage camera permission; handle denial gracefully
- Load MediaPipe `@mediapipe/tasks-vision` (the package is already in
  `package.json`) as a WASM module, lazy-loaded so it doesn't block initial paint
- Run MediaPipe inference on each video frame; extract the wrist/palm landmark and
  normalize to 0–1 canvas space
- Provide an identical `GestureSignal` stream via mouse position as a fallback —
  cursor x/y maps 1:1 to the gesture canvas coordinate space
- For SP5 (two-hand mode): detect and emit `handId: 'secondary'` separately

**Key constraint:** MediaPipe inference must not block the audio thread. Run it in
the `requestAnimationFrame` loop gated by a frame-skip if inference lags — the
audio engine continues from the last known signal, it does not stall.

**Privacy note in the PRD:** camera frames are processed entirely on-device via
MediaPipe WASM. Zero frames are ever transmitted. The camera permission prompt must
include the line: *"Your camera never leaves your device."*

**Acceptance criteria (SP1):**
- Hand tracking initializes within 3 seconds of camera permission being granted
- Graceful degradation to mouse mode if permission is denied
- Mouse mode labeled clearly with a prompt to try camera mode
- `GestureSignal` stream flows at 30fps minimum

---

### L4 — Canvas Renderer
**Purpose:** a `requestAnimationFrame` loop that renders the cursor orbs, warm zones,
and dials onto a `<canvas>` element. Canvas2D only — no WebGL, no Three.js in the MVP.

**Visual language:**
- Dark canvas background (deep navy or near-black)
- Hand cursors = glowing orbs (blue for left hand, amber for right hand)
- Left dial (15% of canvas width): vertical list of root notes A–G; left hand `x` selects active note
- Right dial (15% of canvas width): vertical list of chord qualities; right hand `x` selects active quality
- Warm zones = radial gradient glows in amber/gold (center of canvas)
- Audio reactivity = orb glow radius pulses with audio amplitude from the `AnalyserNode`
- **No UI chrome visible during play.** Settings/exit accessible only via a subtle corner icon.

**Renderer signature:**
```typescript
export function useRenderer(
  canvasRef: RefObject<HTMLCanvasElement>,
  signalsRef: RefObject<GestureSignal[]>,   // array — one entry per tracked hand
  analyserRef: RefObject<AnalyserNode | null>
): void
```

**Inputs read on every frame:**
- `GestureSignal[]` from coordinator (cursor positions for each hand)
- `AnalyserNode` from L3 / `getAnalyser()` (for audio-reactive orb glow)

**Outputs:** pixels on screen. Nothing else.

**Acceptance criteria (SP2):**
- Left hand orb (blue) follows left hand; right hand orb (amber) follows right hand
- Left dial highlights active note in amber; right dial highlights active chord quality
- Dials dim when respective hand is absent
- Mouse fallback: single left-hand signal drives note dial only
- Runs at 60fps on a 3-year-old laptop with camera + audio + canvas all active

---

### React Shell
The thin React layer that mounts and orchestrates everything. Key rule: React only
manages discrete UI state (which screen is showing, is the settings panel open, has
the user upgraded). The canvas and audio loop live entirely outside the React tree
in imperative code, driven by refs.

**Screens you own:**
1. Landing page (SP3)
2. Camera permission + privacy note
3. Vibe picker — 6 illustrated mood options (Warm, Moody, Dreamy, Tense, Floating,
   Grounded); each plays an ambient preview sound on hover; sets the active scale
   and synth timbre
4. Canvas (the full-screen performance surface) + guided first-play overlay (SP2)
5. Settings panel (corner icon → slide-in)
6. Upsell prompts (SP3–SP4)
7. Pricing + upgrade flow (SP4)

---

## Your sub-projects, in build order

### SP1 — Playable Core (Weeks 1–3)
**Goal:** prove the full pipeline end-to-end with the minimum code.
A moving hand (or mouse) → a musical sound → a basic canvas reaction.
No vibes, no onboarding, no polish. Just evidence the architecture works.

**Your SP1 deliverables:**
- `src/engine/input/` — L1 module: MediaPipe loader + single-hand detection +
  mouse fallback + `GestureSignal` emitter
- `src/engine/renderer/` — L4 module: Canvas2D rAF loop, cursor orb, placeholder
  warm zone (a single static gradient to start)
- `src/coordinator.ts` — the thin wiring file that connects L1 → L2 (A's module) →
  L3 (A's module) → L4. All via refs. This file is what you and A co-own.
- Camera permission UI with privacy note
- Mouse fallback labeled as "mouse mode"

**What A delivers in SP1:** L2 (one scale, x→chord, y→voicing), L3 (oscillator bank,
gain scaling, anti-click).

**Done when:** someone can open the app, move their hand/cursor, and hear a chord
change. Full stop.

---

### SP2 — Musicality & Guidance (Weeks 4–7)
**A is heavy in SP2.** Your piece is smaller but critical for feel.

**Your SP2 deliverables:**
- **Warm-zone visual system:** proper radial gradient glows, zone warmth computed
  from the current musical command (A emits a `tension: number` field you can add
  to `MusicalCommand` for this). Warmer = more tonal, cooler = more dissonant.
- **Guided first-play overlay:** non-intrusive animated overlay suggesting "try
  moving slowly left to right." Shown only on first session (localStorage flag),
  disappears after 30 seconds or first sustained note, dismissible at any time.
  Must not block the canvas or camera feed.
- **Vibe picker integration:** wire the 6 vibes A defines in SP2 into the UI
  (illustrated options, hover-preview sounds). First shown before entering the
  canvas; accessible from settings during play.

---

### SP3 — Performance Shell (Weeks 7–10, roughly)
**This is your heaviest solo cycle.**

**Your SP3 deliverables:**
- **Landing page:** CTA ("Start playing"), no sign-up wall, clear value prop
- **Onboarding flow:**
  ```
  Landing → "Start playing"
    → Camera permission (with privacy note)
      → Vibe picker (ambient hover sounds)
        → Canvas + guided overlay
          → Free play
            → [After 3 min] soft upsell: "Save your session?"
  ```
- **Audio-reactive particle system:** Canvas2D particles that pulse with amplitude
  from the `AnalyserNode`. Visually synced to audio, not on a timer.
- **Settings chrome:** minimal corner icon → slide-in panel. Contains: vibe switcher,
  mode toggle (camera/mouse), escape back to landing.
- **Upsell prompts (non-aggressive):**
  - After session > 5 minutes: "Save this as a preset?" → gates to Pro
  - When user attempts Jam invite: "Jam Mode is a Pro feature"
  - No popups during play, no feature degradation, no ads

---

### SP4 — Premium Foundation (Weeks 8–11, overlaps SP3)
**This is your second major solo cycle.** Infra + product work, minimal new UI.

**Your SP4 deliverables:**
- **Auth:** integrate Clerk or Supabase Auth (decide at SP4 kickoff). Account
  required only for premium. Free tier is fully anonymous — no account wall.
- **Supabase:** set up the DB + edge function. Tables needed in MVP:
  - `users` (managed by auth)
  - `presets` (for SP5 P2)
  - `subscriptions` (for gating)
- **Gating logic:** a single `usePremium()` hook that gates premium features.
  The component side just checks `isPremium`. Auth/DB details stay in the hook.
- **Pricing page + upgrade flow:** simple pricing page ($7.99/month or $59/year as
  starting hypothesis), payment via Stripe (or defer to A's recommendation —
  this is TBD in the PRD).

**Open question logged in the PRD (yours to resolve in SP4):**
Premium price point — $4.99 vs. $7.99 vs. $9.99. Test at launch.

---

### SP5 — Premium Features (Weeks 10–13, partial)
**Split with A.** You own the input and rendering side; A owns the audio side.

**Your SP5 deliverables:**
- **P3 — Two-hand mode:** L1 emits both `handId: 'left'` and `handId: 'right'` signals.
  L4 renders two orbs and two dials. Left hand selects root note; right hand selects chord quality.
  (A wires both signals to musical mapping.)
- **Preset UI (P2):** sidebar panel showing up to 10 saved presets. Load/save/name
  UI. The data model and Supabase writes are yours (SP4 foundation). The preset
  *state* that gets serialized (vibe, effects settings, positions) is defined
  jointly with A.

---

### SP6 — Jam Mode (Weeks 12–16)
**Paired with A.** You own networking; A owns the audio mix.

**Your SP6 deliverables:**
- **Signaling server:** a Cloudflare Worker or Vercel Edge Function that brokers
  WebRTC handshakes. Stateless; just passes SDP offers/answers and ICE candidates.
- **TURN fallback:** configure a TURN server (or use a managed one like Twilio NTS)
  for users behind restrictive NATs. The PRD calls this out explicitly as a risk.
- **Peer cursor sync:** broadcast your `GestureSignal` to the peer over the data
  channel; render their cursor as a visually distinct second orb on your canvas.
- **Room model:** shareable link, no account required for guest; host must be Pro.
- **Error states:** "try on a different network" message when WebRTC fails.

**Latency target (from PRD):** sub-200ms round-trip. Musical collaboration becomes
non-functional past ~150ms — this is the Jam Mode ceiling hypothesis; needs live
testing.

---

## What A delivers (reference, so you can plan interfaces)

| Cycle | A's output (what you depend on) |
|---|---|
| SP1 | `mapGesture(signal, vibe): MusicalCommand`, `play(cmd)`, `getAnalyser(): AnalyserNode` |
| SP2 | 6 vibe definitions (scale + timbre), quantization layer, Tone.js effects wired into L3. Adds `tension: number` to `MusicalCommand` for warm-zone rendering |
| SP5 | P4 advanced waveforms (fire-and-forget, no interface change), preset state shape |
| SP6 | `mixJamStream(peerAudio): void` |

---

## Load balance across the timeline

```
Weeks  1–3:   Both (SP1 — define interfaces, split by layer)
Weeks  4–7:   A heavy (musicality + quantization)
               B: SP2 warm-zone + guided overlay, then start SP3 early
Weeks  8–11:  B heavy (SP3 shell + SP4 premium)
               A: wrapping SP2, starting SP5 audio features
Weeks 12–16:  SP6 paired — you on networking, A on audio mix
```

---

## Technical constraints to keep in mind

1. **Camera + audio + canvas simultaneously must stay > 30fps** on a 3-year-old
   laptop. Profile early.
2. **MediaPipe model inference must not block the audio thread.** Frame-skip under
   load; never stall audio.
3. **All gesture → audio updates via mutable refs.** Never route high-frequency
   parameters through React state.
4. **Canvas2D only in MVP.** No WebGL, no Three.js (PRD §6.3 explicitly out of scope).
5. **Privacy:** zero camera frames transmitted to any server. MediaPipe is WASM,
   runs entirely on-device. The privacy note is required UI — not optional copy.
6. **Lighthouse performance target:** > 80 on desktop (PRD §9.3).

---

## Key open questions you'll need to resolve (as you reach each SP)

| SP | Question |
|---|---|
| SP2 | Do the vibe names resonate with users? ("Warm/Moody/Dreamy/Tense/Floating/Grounded") — validate in playtesting |
| SP4 | Clerk vs. Supabase Auth? Stripe payment flow? Premium price point ($4.99 / $7.99 / $9.99)? |
| SP5 | Preset state shape — define jointly with A before building the UI |
| SP6 | TURN provider choice (Twilio NTS, Metered, self-hosted) |

---

## Repo context

- **Branch/scaffold:** `main` — standard Vite 8 + React 19 + TypeScript boilerplate,
  default welcome page (not yet replaced)
- **Installed deps:** `@mediapipe/tasks-vision` is already in `package.json` — the
  MediaPipe package you need for L1 is ready to use
- **Not yet installed:** Tone.js (A installs for L3), Zustand, Tailwind CSS, auth,
  Supabase client, Tone.js
- **Dev command:** `npm run dev` — starts Vite with HMR
- **No test runner yet**

---

*Brief prepared 2026-06-25 based on Froola PRD v1.0 and the SP1–SP6 decomposition.
Questions → your cofounder (Track A).*
