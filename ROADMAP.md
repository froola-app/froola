# Froola — Roadmap & open items

_Refreshed 2026-08-13, when froola went open source. This file is the **single home for
open items**; status memories and other docs point here instead of keeping their own lists._

The launch blockers that used to head this file were all about taking money safely: the
Stripe webhook, the four price env vars, an RLS hole that let a user set their own plan.
None of them apply any more. Billing is parked in `optional/billing/`, nothing in the app
reads a plan, and there is no paid path to secure.

## 🔴 Still worth doing before more eyes arrive

| Pri | Item | Where |
|---|---|---|
| **P0** | **Live-check the reworked hand tracker on a real camera.** The filter (One Euro replacing the fixed EMA), fist detection (continuous curl + Schmitt trigger + dwell), slot assignment (hysteresis), dropout coasting and latency prediction all changed. Every claim is measured, but measured against *synthetic* traces: no real hand has touched this yet. Recipe and checklist in `docs/VERIFY.md`. | `packages/handtrack/`, `src/engine/input/` |
| P2 | **`/engineering` on a narrow viewport** — the results table restacks below 700px via a media query that has not been seen rendering. | `src/App.css` (`.eng__tr`) |
| P1 | **`recordings` SELECT policy is `USING(true)`** — anyone with the anon key can dump all rows (user_ids + payloads). Only affects deployments that configure Supabase, but the repo is public, so the policy is public too. Move lookup behind an RPC keyed by the share id. | `supabase/migrations/0004_recordings.sql` |
| P1 | **Public-repo doc leak** — internal docs (pricing, marketing, cofounder brief, handoffs) are reachable in git history; untracking them didn't purge them. Open sourcing defuses most of the sensitivity, but the cofounder brief still shouldn't be there. Fix = history purge (git filter-repo + force push) or accept it. | GitHub |
| P2 | **Verify migrations 0003/0004 are applied** on the hosted demo's Supabase project, and record the date here. | Supabase SQL editor |

## 🐞 Open fixes

| Pri | Item | Where |
|---|---|---|
| P1 | **Safari video record broken** — MediaRecorder is webm-only with no mp4 fallback, and the async `start()` has no catch: button sticks on "Allow mic…" with the mic left live. Listed as a good first issue. | `useVideoRecorder`, `VideoRecordButton` |
| P1 | **`vibe` is vestigial (verified)** — hardcoded `'warm'`; codec reserves 2 bits for a 4-vibe system with no UI/effect. Wire it to the synth or drop the field. | `coordinator.ts`, `engine/recording/codec.ts` |
| P1 | **Piano→synth sustain leak** — `silence('piano')` fades over 1.8s; switching instruments mid-note can leave voices ringing. Reset voice gains on mode change. | `engine/audio/AudioEngine.ts` |
| P2 | **Visual themes have no play-screen picker** — the palettes and the profile-drawer swatches exist, but there's no way to change look without opening the drawer. Listed as a good first issue. | `PlayShell`, `engine/renderer/themes.ts` |
| P2 | **Dead `mapGesture`/`createMapper` path (verified still present)** — integration tests exercise a pipeline that isn't shipped. Delete it and rewrite `integration.test.ts` against the real coordinator path. | `engine/music/mapGesture.ts`, `engine/integration.test.ts` |
| P2 | **Vestigial `QUALITIES` array (verified)** — `replayPlayer` relies on `QUALITIES.length` coincidentally matching `EXTENSIONS.length`; latent slice-count bug. Reference `EXTENSIONS.length`, retire `QUALITIES`. | `engine/types.ts`, `engine/recording/replayPlayer.ts` |

## 🧪 Pending live checks

The standing "needs a human with a camera" list lives in **`docs/VERIFY.md`** with the
headless recipes. Highlights: two-hand tracking on Chrome + Safari, theme-driven HUD in
light/dark, landing audio-resume with sound on, backing-track ear check.

Added by the open-source pass, still unverified on a real device:

- Record a take signed out, confirm it lands in the profile drawer with a Download button
  and that `/watch?v=<id>` plays it back in the same browser.
- Complete a lesson signed out, reload, confirm progress survived.
- Sign in afterwards and confirm local progress isn't wiped by the merge.

## 🚀 Feature roadmap

**Lessons (active thread)**
- **Backing tracks must sound like the real songs** — the big open issue; the real-audio
  instrumental approach is wired for one lesson, awaiting the owner's ear verdict. Full
  context: `docs/HANDOFF-lessons.md`. Note the lesson ids and melody-asset filenames were
  renamed in the open-source pass (`love-yourself` → `sparse-loop`); local files under
  `public/melodies/` need renaming to match.

**Make the share link viral (highest leverage)**
- `/watch` = autoplaying hero with a "Make your own" CTA. (S)
- OG image / audio preview so links unfurl in Slack/iMessage/Twitter. (M)
- Audio export (WAV via OfflineAudioContext). (M)
- MIDI export. (M)

**Open-source polish**
- Hero capture (GIF or short clip) for the README. (S)
- A few labelled `good first issue`s so the contributing guide has something to point at. (S)
- Publish `src/engine/` as a package if the engine framing draws interest. (L)

**Mobile / touch**
- First-class touch UX — two fingers already map to the two wheels; promote in landing copy. (S)
- Haptics on slice change (`navigator.vibrate`). (S)

**Big bet (later)**
- Multiplayer jam (WebRTC / shared room, two phones = two wheels). Park until the share
  mechanic proves itself. (L)

_Effort: S = small, M = medium, L = large._

## ✅ Recently closed

- **Hand tracking became a library (2026-09-06):** extracted to `packages/handtrack/`
  (`@froola/handtrack`), pure and dependency-free, with the browser bits left behind in
  `src/engine/input/`. Six substantive fixes, each benchmarked: One Euro filter, temporal
  slot hysteresis, continuous curl with a Schmitt-triggered fist gate, dropout coasting,
  velocity prediction, and rate-independent smoothing. Jitter down 18%, lag down 65%,
  settling 9x faster, fist and slot chatter down to ~0. `npm run bench` regenerates
  `packages/handtrack/BENCHMARK.md`; a test fails if the site's quoted numbers drift.
- **`/engineering` case study (2026-09-06):** the portfolio-facing write-up, live at
  `/engineering`. It owns its own shell classes (`eng__wrap`, `eng__nav`) rather than
  borrowing the landing page's, which is what broke it the first time `main` restructured.
- **The open-source pivot actually shipped (2026-09-06):** it had lived only on
  `open-source-repackage` while `main` kept the paywall and moved 99 commits ahead. The
  merge kept every feature `main` had grown and removed the paywall from all of it;
  `main` is now the open-source version and deploys to froolamusic.com.
- **Watermarks off everywhere (2026-09-06):** nothing froola produces is watermarked.
  Note the shape, since it changed mid-session: the plumbing was deleted outright, then
  the merge with `main` brought back a newer export path that carries it, so watermarking
  is now **flag-off in `capabilities.ts`** (`replayWatermark`/`exportWatermark` are
  constant `false`) rather than absent. Ripping it out of main's export compositor is a
  tidy-up worth doing, not a gate to remove. The gesture codec keeps its flags byte for
  wire compatibility, so links minted while the flag existed still decode.
- **Open-source pass (2026-08-13):** every feature unlocked and plan gating deleted, Stripe
  parked under `optional/billing/`, local IndexedDB + localStorage drivers so the app runs
  with no backend, song lessons renamed away from real titles, MIT license, engine-first
  README, `docs/ARCHITECTURE.md`, CONTRIBUTING, and CI. See `OPEN-SOURCE.md`.
- Lint clean repo-wide, and the Node 22 localStorage test failure fixed in `test-setup.ts`.
- Firebase fully retired from docs (stack is Supabase everywhere).
- Older shipped-feature history (looper, arp, replay, key/scale, lessons) is in git log.
