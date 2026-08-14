# Froola goes open source

Transition plan. Froola is no longer a product to monetise; it is an open-source
hand-tracking music engine plus the browser instrument built on it. This file tracks the
migration and gets deleted once every box is ticked (surviving items fold into `ROADMAP.md`).

**Decisions taken (2026-08-13)**

- **License:** MIT.
- **Billing:** kept as an optional, dormant module. `entitlements.ts` grants full access
  unconditionally; Stripe and `api/` move under `optional/billing/` as a documented
  reference implementation. Nothing in the app path reads a plan.
- **Positioning:** engine-first repo. `src/engine/` is the library, the React app is its
  reference consumer. One repo, no npm publish yet.
- **Song content:** chord progressions stay, real song titles do not. Public lesson names
  read "in the style of". `public/melodies/` stays out of git, permanently.

---

## 1. Legal and history

- [ ] Rename named-song lessons to "in the style of" phrasing in public copy.
- [ ] Confirm no melody data, lyrics, or audio is tracked anywhere in the working tree.
- [ ] Un-gitignore `docs/`, publishing only architecture and design docs. Private
      material (cofounder brief, marketing, pricing rationale) moves out of the repo.
- [ ] Decide on the git-history doc leak. Open sourcing defuses most of it; the remaining
      question is whether the private docs still in history justify a filter-repo pass.

## 2. Zero-config run

`git clone && npm install && npm run dev` must give the full instrument with no env file,
no Supabase project, and no account. `App.tsx` already has an `!authReady` path; the work
is giving the engine local storage drivers so that path is fully featured, not degraded.

- [ ] Local (IndexedDB/localStorage) driver for `engine/recording/recordingStore.ts`.
- [ ] Local driver for `engine/recording/videoRecordingStore.ts`.
- [ ] Local driver for `engine/lessons/useLessonProgress.ts`.
- [ ] Local driver for `engine/lessons/useReviewProgress.ts`.
- [ ] Supabase becomes an opt-in adapter behind the same interface, for cross-device sync.
- [ ] Sign-in is a sync feature, never a gate.

## 3. Unlock

- [ ] `entitlements.ts` returns full access unconditionally.
- [ ] Delete `usePlayWall` and `PlayWall`. A two-minute conversion timer has no place here.
- [ ] Remove `recordingWatermark` and `exportWatermark` burn-in.
- [ ] Replace tier recording quotas (1/3/unlimited) and length caps (20s/3min/5min) with a
      single technical cap driven by browser memory.
- [ ] Move Stripe, `api/`, `billing.ts`, `UpgradeSheet`, `CheckoutResult`,
      `PricingPage`, `PricingSection`, `PricingMockups` under `optional/billing/`.
- [ ] `/pricing` and `/pricing-mockups` redirect to `/`.

## 4. Website

- [ ] Swap the pricing CTA for an open-source band: repo link, self-host in two minutes,
      architecture diagram.
- [ ] Footer gains GitHub, license, and docs links.
- [ ] `/watch` share links keep working exactly as they do now.

## 5. Portfolio packaging

- [ ] `LICENSE` (MIT), replacing "Private, all rights reserved" in the README.
- [ ] README rewritten engine-first, with a hero capture and badge row.
- [ ] `docs/ARCHITECTURE.md`: input to music to audio to renderer, and why the hot path is
      refs only.
- [ ] `CONTRIBUTING.md`.
- [ ] GitHub Actions running lint, `tsc --noEmit`, and vitest.
- [ ] Issue templates and a few `good first issue` candidates.
- [ ] Demo link pinned at the top of the README.

## 6. Retire the money apparatus

- [ ] Rewrite `ROADMAP.md`: the "before real money" launch blockers are moot.
- [ ] Stripe account dormant, Supabase project on free tier.
- [ ] `.env.example` trimmed to the two optional Supabase vars.
