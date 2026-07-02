# Froola — PRD Decomposition & Build Order

**Date:** 2026-06-25
**Status:** Approved (decomposition + stack decision)
**Source PRD:** Froola — Gesture-Based Musical Instrument (v1.0)
**Owner:** Froola product team

This document decomposes the full Froola PRD into independently buildable
sub-projects with a defined build order. It is the planning artifact that
precedes per-sub-project design specs. Each sub-project gets its own
`spec → plan → implementation` cycle.

---

## Decisions locked in this cycle

1. **Stack: Vite + React 19 + TypeScript** (the existing repo), *not* Next.js 14
   as the PRD originally stated. Rationale: the MVP is almost entirely
   client-side — camera (MediaPipe), audio (Web Audio), and rendering (Canvas2D)
   all run in the browser, and the PRD explicitly requires "no React re-renders
   in the hot path." Vite is the better fit and is already scaffolded. The few
   server-side needs (Jam Mode signaling, auth callbacks) will be handled by a
   small standalone edge worker introduced in SP4/SP6 — no full framework needed.

2. **Decompose before designing.** The PRD is a ~16-week product spanning several
   independent subsystems. We design and build it as a sequence of vertical
   sub-projects, not one monolithic spec.

---

## Architecture: four engine layers

The product is built on four reusable layers, each with one clear purpose and a
well-defined interface. Crucially, **the layers do not depend on each other
directly** — a thin coordinator wires them together. This isolation is what lets
the 2–3 person team parallelize once SP1 freezes the interfaces.

| Layer | Purpose | Exposed interface | Depends on |
|---|---|---|---|
| **L1 · Input** | Normalize camera (MediaPipe Hands) *or* mouse/trackpad into signals | stream of `{x, y, present, handId: 'left'|'right'}` in 0–1 space | nothing |
| **L2 · Musical Mapping** | Pure logic: `(x,y) + vibe` → notes / voicing / register, with scale quantization (the "AI guardrail") | `mapGesture(pos, vibe) → { chord, voicing, register, texture }` | nothing (pure, unit-testable) |
| **L3 · Audio Engine** | Web Audio oscillator bank; polyphony; per-voice gain scaling; anti-click ramps; effects chain; AnalyserNode tap | `play(musicalCmd)`, `getAnalyser()` | nothing |
| **L4 · Canvas Renderer** | Canvas2D `requestAnimationFrame` loop: cursor orb, warm zones (radial gradients), audio-reactive particles | `render(pos, analyserData, vibe)` | reads L1 + L3 output |

### Hot-path principle
All high-frequency gesture → audio parameter updates flow through **mutable refs**,
never React state. React state is reserved for UI chrome (onboarding, settings,
upsell). This is a hard architectural constraint inherited from the PRD.

---

## Sub-projects (shippable build order)

| # | Sub-project | PRD phase | Contains | Depends on |
|---|---|---|---|---|
| **SP1** | **Playable Core** (vertical slice) | Phase 0 | L1 (mouse + single-hand MediaPipe), L3 (basic oscillator bank + gain scaling + anti-click), L2 (one scale), L4 (cursor + basic warm zone), wired end-to-end | — |
| **SP2** | **Musicality & Guidance** | Phase 1 | Vibe picker, 6 scales/timbres, full AI quantization layer, warm-zone visual system, guided first-play overlay, Tone.js reverb/delay | SP1 |
| **SP3** | **Performance Shell** | Phase 1–2 | Landing page, onboarding flow, audio-reactive particle system, settings chrome, soft upsell prompts | SP1 |
| **SP4** | **Premium Foundation** | Phase 2 | Auth (Clerk/Supabase — decide here), Supabase persistence, gating logic, pricing + upgrade flow, standalone edge worker if needed | SP3 |
| **SP5** | **Premium Features** | Phase 2 | Preset saving (P2), two-hand mode (P3), advanced waveforms & effects (P4) — each a mini-cycle | SP1, SP4 |
| **SP6** | **Jam Mode** | Phase 3 | WebRTC P2P, signaling worker, peer canvas sync, TURN fallback | everything |

---

## Critical path & parallelization

- **SP1 is the gate.** It defines and freezes the L1–L4 interfaces by proving the
  entire pipeline end-to-end with the least code (move hand/mouse → hear a
  musical sound → see it react).
- Once SP1's interfaces are frozen, the team parallelizes:
  - **Person A:** SP2 (audio + musicality — extends L2/L3)
  - **Person B:** SP3 (visuals + shell — extends L4 + React UI)
  - **Person C:** begins SP4 (premium infra), which is largely decoupled
- **SP5** features each depend on a single layer extension + gating, so they slot
  in as small independent cycles.
- **SP6 (Jam Mode)** is the highest-risk item (WebRTC reliability on restricted
  networks) and intentionally goes last.

```
SP1 ──┬── SP2 ──┐
      ├── SP3 ──┼── SP4 ──┬── SP5
      │         │         └── SP6
      └─────────┴───────────────
   (freeze L1–L4 interfaces)
```

---

## Out of scope for the whole MVP (from PRD §6.3)

MIDI/DAW integration; native mobile app; audio recording/export (post-MVP);
vocal pitch detection; WebGL/Three.js backgrounds (Canvas2D/CSS only in MVP);
heavyweight user accounts (premium uses lightweight auth only).

---

## Open questions carried forward (from PRD §13)

These are deferred to the sub-project that owns them — not blockers for SP1:

- **Account model** (free = no account; premium = account) → resolved in SP4.
- **Vibe naming** validation → tested during SP2.
- **Premium price point** ($4.99 / $7.99 / $9.99) → SP4.
- **Jam Mode latency ceiling** (~150ms hypothesis) → SP6.
- **Export audio** pull-forward decision → revisit after SP3.
- **Mobile camera tracking** reliability → post-MVP.

---

## Division of labor (2 people, parallel)

Ownership is **by-layer for the whole timeline**, not rotating per sub-project, so
each person keeps a stable domain and the interface between tracks barely churns.

### Track A — "Sound" — *you*
Owns **L2 Musical Mapping + L3 Audio Engine**.

| Cycle | Work |
|---|---|
| SP1 | L3: oscillator bank, per-voice gain scaling, 12ms anti-click ramps. L2: basic mapping (one scale, x→chord, y→voicing) |
| SP2 | 6 scales + vibe→scale system, full AI quantization layer, Tone.js reverb/delay buses |
| SP5 | P4 advanced waveforms & effects; preset state serialization (P2 data side) |
| SP6 | Client-side audio mixing of the two jam streams |

### Track B — "Surface" — *cofounder*
Owns **L1 Input + L4 Renderer + React shell + premium infra**.

| Cycle | Work |
|---|---|
| SP1 | L1: MediaPipe single-hand + mouse fallback + camera permission. L4: cursor orb + basic warm zone. The coordinator wiring |
| SP2 | Warm-zone visual system, guided first-play overlay |
| SP3 | Landing, onboarding flow, audio-reactive particles, settings chrome, upsell prompts |
| SP4 | Auth, Supabase, gating, pricing + upgrade flow |
| SP5 | P3 two-hand mode (input + renderer), preset UI |
| SP6 | WebRTC signaling worker + peer cursor sync |

### The seam (defined jointly, first hour of SP1)
Two data types are the entire contract between the tracks. Freeze them before
splitting:
- `GestureSignal` — `{ x, y, present, handId: 'left'|'right' }` (B produces; A and L4 consume)
- `MusicalCommand` — `{ chord, voicing, register, texture }` (A produces; L3 consumes)

### Load balance
- Weeks 1–3 (SP1): both, split as above.
- Weeks 4–7 (SP2): A heavy (musicality + quantization); B does lighter warm-zone
  visuals, then starts SP3 early.
- Weeks 8–11: B heavy (SP3 shell + SP4 premium); A frees up and starts SP5 audio.
- Weeks 12–16 (SP6): paired — B on networking, A on audio mix.

---

## Next step

Brainstorm **SP1 · Playable Core** through the normal design flow (its own spec →
plan → implementation cycle).
