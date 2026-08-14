# Froola goes open source

Transition plan. Froola is no longer a product to monetise; it is an open-source
hand-tracking music engine plus the browser instrument built on it. This file tracks the
migration and gets deleted once every box is ticked (surviving items live in `ROADMAP.md`).

**Decisions taken (2026-08-13)**

- **License:** MIT.
- **Billing:** kept as an optional, dormant module. `capabilities.ts` grants full access
  unconditionally; Stripe and `api/` moved under `optional/billing/` as a documented
  reference implementation. Nothing in the app path reads a plan.
- **Positioning:** engine-first repo. `src/engine/` is the library, the React app is its
  reference consumer. One repo, no npm publish yet.
- **Song content:** chord progressions stay, real song titles do not. Public lesson names
  read "in the style of". `public/melodies/` stays out of git, permanently.

---

## 1. Legal and history

- [x] Rename named-song lessons to "in the style of" phrasing in public copy. Lesson ids,
      backing keys, and `Lesson.artist` (now `Lesson.style`) went with them.
- [x] Confirm no melody data, lyrics, or audio is tracked anywhere in the working tree.
- [x] Un-gitignore `docs/` selectively: `docs/*` ignored with `!docs/ARCHITECTURE.md`
      opted in, so internal notes stay off GitHub.
- [ ] Decide on the git-history doc leak. Open sourcing defuses most of it; the cofounder
      brief is the part that still argues for a filter-repo pass. Tracked in `ROADMAP.md`.

## 2. Zero-config run

`git clone && npm install && npm run dev` gives the full instrument with no env file, no
Supabase project, and no account.

- [x] IndexedDB driver for video takes (`engine/recording/localVideoStore.ts`).
- [x] `videoRecordingStore.ts` became a façade over local and cloud, keyed on `userId`.
- [x] localStorage driver for lesson and review progress (`engine/lessons/progressStore.ts`).
- [x] Supabase is an opt-in sync layer; cloud rows merge over local on load.
- [x] Sign-in is a sync feature, never a gate.
- [ ] Live check on a real device (in `ROADMAP.md`): record signed out, reload, sign in,
      confirm nothing is lost.

## 3. Unlock

- [x] `entitlements.ts` → `capabilities.ts`, one full-access set.
- [x] Deleted `usePlayWall`, `PlayWall`, the wall's MutationObserver, and the coordinator's
      `gatedRef`.
- [x] Watermarks, recording quotas, and tier length caps gone; one technical video cap.
- [x] Stripe and friends moved under `optional/billing/`, excluded from tsc and lint.
- [x] `/pricing` and `/pricing-mockups` redirect home; onboarding lost its plan step.
- [x] ~780 lines of dead paywall CSS removed.

## 4. Website

- [x] Pricing section replaced by `OpenSourceSection`: what the engine is made of, and the
      four commands to run it.
- [x] Footer gained an Open source column (repo, license, contributing).
- [x] Terms page rewritten: nothing to pay, MIT governs the code.
- [x] `/watch` share links unchanged.

## 5. Portfolio packaging

- [x] `LICENSE` (MIT).
- [x] README rewritten engine-first.
- [x] `docs/ARCHITECTURE.md`.
- [x] `CONTRIBUTING.md`.
- [x] GitHub Actions running lint, `tsc --noEmit`, tests, and build.
- [x] Issue templates.
- [ ] Hero capture (GIF or clip) for the README, and a few labelled `good first issue`s.
      The contributing guide already names four candidates.

## 6. Retire the money apparatus

- [x] `ROADMAP.md` rewritten; the "before real money" blockers are moot.
- [x] `.env.example` trimmed to the two optional Supabase vars.
- [x] `stripe` dependency dropped from `package.json`.
- [ ] Stripe account set dormant, Supabase project confirmed on the free tier. Owner action.
