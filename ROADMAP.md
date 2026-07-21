# Froola — Roadmap & open items

_Refreshed 2026-07-11 (doc audit + security audit pass). This file is the **single home
for open items** — status memories and other docs point here instead of keeping their own
lists. Verified items were reproduced against code this pass._

## 🔴 Launch blockers (do these before real money)

| Pri | Item | Where |
|---|---|---|
| P0 | **Verify Supabase migrations 0003/0004 are applied.** Until 0003 runs, any user can set their own `plan` from the browser console (RLS hole). Needs a dashboard check; record the date here when done. | Supabase SQL editor, `supabase/migrations/` |
| P0 | **Production Stripe webhook not configured** — Vercel's `STRIPE_WEBHOOK_SECRET` is a local `stripe listen` secret, so `profiles.plan` never syncs after payment. Add the endpoint (checkout.session.completed, customer.subscription.updated/deleted) in the Stripe dashboard and replace the Vercel secret. | Stripe dashboard, Vercel env |
| P0 | **Checkout env vars renamed** — `api/_lib/stripe.ts` wants `STRIPE_PRICE_{PLUS,STUDIO}_{WEEK,MONTH}`; the four weekly/monthly prices must exist in Stripe and the vars be set in Vercel or checkout 500s. (`.env.example` updated 2026-07-11; local `.env` still has old names.) | Stripe dashboard, Vercel env, `.env` |
| P0 | **Public-repo doc leak** — ~23 internal docs (pricing, marketing, cofounder brief, handoffs) remain reachable in public GitHub history; untracking commit 899af52 didn't purge them, and `docs/superpowers/specs/…` was still tracked until 2026-07-11. Fix = history purge (git filter-repo + force push + GitHub support) or make the repo private. | GitHub |
| P1 | **`recordings` SELECT policy is `USING(true)`** — anyone with the anon key can dump all rows (user_ids + payloads). Move lookup behind an RPC keyed by the share id. | `supabase/migrations/0004_recordings.sql` |
| P1 | **0003 column grants may break `completeOnboarding`** — PostgREST upsert's ON CONFLICT DO UPDATE sets `id`, which has no UPDATE grant. Verify live once 0003 is applied. | Supabase, `AuthContext` |

## 🐞 Open fixes

| Pri | Item | Where |
|---|---|---|
| P1 | **Safari video record broken** — MediaRecorder is webm-only with no mp4 fallback, and the async `start()` has no catch: button sticks on "Allow mic…" with the mic left live. | `VideoRecordButton` |
| P1 | **`vibe` is vestigial (verified)** — hardcoded `'warm'`; codec reserves 2 bits for a 4-vibe system with no UI/effect. Wire it to the synth or drop the field. | `coordinator.ts:324`, `engine/recording/codec.ts` |
| P1 | **Piano→synth sustain leak** — `silence('piano')` fades over 1.8s; switching instruments mid-note can leave voices ringing. Reset voice gains on mode change. | `engine/audio/AudioEngine.ts` |
| P2 | **Visual themes have no UI** — entitlement + renderer module exist (`themes.ts`), picker dropped in #49. Decide: re-add a picker or stop advertising themes in `pricingTiers.ts`/UpgradeSheet. | `PlayShell`, `pricingTiers.ts` |
| P2 | **Dead `mapGesture`/`createMapper` path (verified still present)** — integration tests exercise a pipeline that isn't shipped. Delete it and rewrite `integration.test.ts` against the real coordinator path. | `engine/music/mapGesture.ts`, `engine/integration.test.ts` |
| P2 | **Vestigial `QUALITIES` array (verified)** — `replayPlayer` relies on `QUALITIES.length` coincidentally matching `EXTENSIONS.length`; latent slice-count bug. Reference `EXTENSIONS.length`, retire `QUALITIES`. | `engine/types.ts:23`, `engine/recording/replayPlayer.ts` |
| P2 | **Checkout success card always claims a trial** — only monthly plans carry the 5-day trial, but Stripe's redirect doesn't say which interval was bought, so the card shows trial copy to weekly buyers too. Pass the interval through the success URL. (Hardcoded 14-day figure fixed 2026-07-11 — now imports `TRIAL_DAYS`.) | `CheckoutResult.tsx`, `api/create-checkout-session.ts` |
| P2 | **Watermark flag is client-forgeable** — `FLAG_NO_WATERMARK` lives in the client-encoded replay payload; all entitlements are client-side only. Acceptable pre-launch; revisit with paid volume. | `engine/recording/codec.ts` |
| P3 | **Lint env artifact** — transient `.claude/worktrees/*` dirs create a second tsconfig root and can break `npm run lint`. Add `.claude/` to eslint `ignores`. | `eslint.config.js` |

## 🧪 Pending live checks

The standing "needs a human with a camera" list lives in **`docs/VERIFY.md`** with the
headless recipes. Highlights: two-hand tracking on Chrome + Safari, theme-driven HUD in
light/dark, landing audio-resume with sound on, backing-track ear check.

## 🚀 Feature roadmap

**Lessons (active thread)**
- **Backing tracks must sound like the real songs** — the big open issue; real-audio
  instrumental approach wired for Love Yourself, awaiting the owner's ear verdict.
  Full context: `docs/HANDOFF-lessons.md`.

**Make the replay link viral (highest leverage)**
- Replay = autoplaying hero with a "Make your own" CTA. (S)
- OG image / audio preview so links unfurl in Slack/iMessage/Twitter. (M)
- Audio export (WAV via OfflineAudioContext). (M) — also a Studio entitlement waiting to be built.

**Studio tier features not yet built**
- Continuous/instant-replay recording (the flagship differentiator).
- Audio download (MP3/WAV) + MIDI export.

**Go-live checklist (after blockers)**
- Live-mode Stripe keys, live products/prices, live webhook, all re-entered in Vercel.
- Checkout branding: business name "Froola" (not "Froola sandbox"), logo + orange under
  Settings → Branding.
- Piano tuning/sound-quality pass (sellable but rough).

**Mobile / touch**
- First-class touch UX — two fingers already map to the two wheels; promote in landing copy. (S)
- Haptics on slice change (`navigator.vibrate`). (S)

**Big bet (later)**
- Multiplayer jam (WebRTC / shared room, two phones = two wheels). Park until the replay
  loop proves the share mechanic. (L)

_Effort: S = small, M = medium, L = large._

## ✅ Recently closed (this pass)

- Lint clean repo-wide (48d68f0) and the Node 22 localStorage test failure fixed in
  `src/test-setup.ts` — both were open P1s here.
- README misleading copy (guitar / 60s / wrong tier lists) fixed; tier contents now live
  only in `src/entitlements.ts` + `src/pricingTiers.ts`.
- Firebase fully retired from docs (stack is Supabase everywhere).
- Older shipped-feature history (looper, arp, replay, key/scale, lessons, billing) is in
  git log — this file no longer archives it.
