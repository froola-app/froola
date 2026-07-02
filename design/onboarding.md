# Onboarding

_Written 2026-07-02 directly from `main` — verify against the current code
before relying on this for a redesign._

There are **two unrelated things called "onboarding" in this codebase** —
don't conflate them:

1. **Account onboarding** (`src/components/onboarding/`, route `/onboarding`)
   — a 3-step signup flow, documented below. Only reachable when Firebase is
   configured and the user is signed in but hasn't completed it
   (`AppRoutes` in `src/App.tsx`).
2. **In-app gesture tutorial** (`src/components/BeginnerTutorial.tsx`) — the
   4-step "hold your hands up / touch the left circle / …" overlay shown the
   first time someone reaches the instrument. See `design/play-page.md`.
   Different component, different trigger, different purpose (teaches the
   gesture mechanic, not the product/pricing).

## Account onboarding flow (`OnboardingFlow.tsx`)

Full-viewport light shell (`.onboarding-shell`, `#FAFAF8` bg, same faint
orange radial wash as the landing hero) with a logo + progress-dot header
(`.onboarding-progress__dot`, active dot widens to a pill) and one step
centered below.

**3 steps, linear, no back button:**

1. **`UserTypeStep`** — "How will you use Froola?" Three cards (casual /
   content creator / learning music), each a full-width button with emoji +
   label + description + arrow. Clicking one sets `selectedType` and
   advances immediately.
2. **`LearningCurveStep`** — "A quick heads-up." 4 tips (flat hand, ↕ note,
   ↔ chord/quality, mouse-mode fallback) as an icon list, then a single
   "Got it →" button.
3. **`PricingStep`** — "Free forever, upgrade when you're ready." Two cards
   (Free features list / Pro features list, tagged "coming soon"), then
   "Start playing →", which calls `completeOnboarding(selectedType)` and
   navigates to `/`.

State lives in `OnboardingFlow` itself (`useState<Step>`), each step is a
dumb presentational component taking an `onSelect`/`onContinue` callback.

### Cooldown between steps

Every step's advance action fired the instant it was clicked — nothing
stopped a user from clicking through all 3 steps (and the 3 cards, 4 tips,
and pricing comparison) in under a second, without reading any of it. Fixed
2026-07-02: `OnboardingFlow` now gates each step's interactive content
behind a ~1.4s minimum dwell time (`ready` state, reset on every `step`
change) via a `.is-cooling-down` class on `.onboarding-main` — dims the step
and disables pointer events until the timer clears. Applies uniformly to all
3 steps rather than modifying each step component individually.

## Design tokens used

Same as `design/tokens.json` — `#FAFAF8`/`#111111`/`#D4500A`, DM Sans. No
new colors introduced by this flow.
