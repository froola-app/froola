# Pricing & subscriptions

Working doc for Froola's paid tiers. Status: **design agreed, not yet implemented.** No Stripe integration exists in the codebase yet — this doc is the spec to build against.

## Tiers

### Free — $0

- Synth only (piano locked)
- Camera mode + mouse/touch fallback
- 3 recordings / month, up to 20s each, watermarked
- Login required to record (existing Google Sign-In)
- Rate-limited server-side to prevent abuse

Kept deliberately modest — good enough to be a nice experience and to generate shareable clips (free marketing via replay links), but visibly worse than paid on every axis (length, watermark, quantity, instrument choice).

### Encore — $4.99/mo *(name not final, see Open questions)*

The "I like this app, unlock a bit more" tier. Priced to be an easy impulse buy.

- Everything in Free
- Piano unlocked (needs a tuning/quality pass first — tracked separately, not a pricing blocker)
- Recordings up to 3 min, watermark-free
- Visual themes *(not built yet — placeholder feature)*
- Monthly recording cap raised (exact number TBD, see Open questions)

### Pro — $19.99/mo

For people using Froola seriously / "professionally" — modeled on the Claude Pro/Max jump in value, not just quantity.

- Everything in Encore
- **Continuous/instant-replay recording** — flagship differentiator. Records into a rolling local buffer continuously; pressing a "keep that" button saves the last ~20s to a real recording. Older buffer content is discarded, never uploaded.
- Unlimited recording length and quantity
- Audio download (MP3 / WAV)
- MIDI export
- Loop & layer — unlimited slots (vs. capped on lower tiers)
- Early access to new features

## Billing mechanics

- **Provider:** Stripe (Checkout + Billing + Customer Portal). Store `stripeCustomerId` and current `plan` on the Firestore user doc; a webhook (`checkout.session.completed`, `customer.subscription.updated/deleted`) keeps `plan` in sync.
- **Cadence:** monthly recurring only for now. Annual pricing is a plausible fast-follow (e.g. ~2 months free) but out of scope for v1.
- **Free trial:** both paid tiers offer a free trial. Card is required up front via Stripe Checkout (`payment_method_collection: always`, `subscription_data.trial_period_days`); if the user doesn't cancel before the trial ends, Stripe auto-charges and converts them to a paying subscriber. This needs to be communicated clearly in the checkout UI and in a pre-charge reminder email (Stripe can send this automatically) so it doesn't feel like a dark pattern.
- **Upgrades/downgrades/cancellation:** handled via the Stripe Customer Portal rather than custom UI, at least for v1.

## Open questions

- **Free tier recording allowance:** 3/mo is a starting proposal, not final — revisit after seeing real usage/storage cost data.
- **Encore monthly recording cap:** needs an actual number (options discussed: flat monthly cap like 20, or no hard cap since recordings are still ≤3min watermark-free).
- **Encore tier name:** "Encore" is the current front-runner (vs. "Jam Pass" / "Riff Pass"); not finalized.
- **Trial length:** 7 vs 14 days not yet decided.
- **Pro price:** $19.99 vs $24.99 — leaning $19.99 to stay under the Claude Pro anchor price, not finalized.
- **Storage/cost model:** unlimited recordings on Pro (and raised caps on Encore) have real Firestore storage + bandwidth cost; no cap/quota-enforcement mechanism designed yet.

## Not yet built (dependencies before shipping this)

- Piano needs a tuning/sound-quality pass before it can be used as an Encore selling point.
- Visual themes don't exist yet.
- Continuous/instant-replay recording (Pro's flagship feature) needs its own design — no rolling-buffer capture exists in the audio engine today.
- No Stripe integration, webhook handler, or plan-gating logic exists in the codebase yet.
