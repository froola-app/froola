# Pricing & subscriptions

Working doc for Froola's paid tiers. Status: **implemented in Stripe test mode.** Checkout, plan entitlements (`src/entitlements.ts`), weekly/monthly intervals, the pricing-page toggle, and the in-context upgrade sheet (`src/components/UpgradeSheet.tsx`) are built. Outstanding: production webhook (plan never syncs to Supabase in prod), visual-themes UI wiring, Studio's instant-replay + audio/MIDI export features.

## Tiers

Source of truth for what each plan unlocks is `src/entitlements.ts`; display copy lives in `src/pricingTiers.ts`.

### Free — $0

- Synth only (piano locked)
- Camera mode + mouse/touch fallback
- Shareable replay links up to 20s, watermarked ("made with froola" overlay on playback)
- 4 chord-loop slots
- No video recording (button visible as a teaser; opens the upgrade sheet)

Kept deliberately modest — good enough to be a nice experience and to generate shareable clips (free marketing via replay links), but visibly worse than paid on every axis.

### Plus — $1.99/wk or $4.99/mo

The "I like this app, unlock a bit more" tier. Priced to be an easy impulse buy.

- Everything in Free
- Piano unlocked
- Video recording & download, up to 3 min
- Replays up to 30s, watermark-free
- Visual themes (module built in `src/engine/renderer/themes.ts`; picker UI not wired yet)
- 8 chord-loop slots

### Studio — $3.99/wk or $8.99/mo

For people using Froola seriously / "professionally" — a jump in value, not just quantity.

- Everything in Plus
- **Continuous/instant-replay recording** — flagship differentiator. Records into a rolling local buffer continuously; pressing a "keep that" button saves the last ~20s to a real recording. Older buffer content is discarded, never uploaded. *(entitlement flag exists; feature not built)*
- Unlimited video recording length
- Audio download (MP3 / WAV) + MIDI export *(entitlement flag exists; feature not built)*
- Loop & layer — unlimited slots
- Early access to new features

## Billing mechanics

- **Provider:** Stripe (Checkout + Billing + Customer Portal). `stripe_customer_id` and current `plan` live on the Supabase `profiles` row; the webhook (`checkout.session.completed`, `customer.subscription.updated/deleted`) keeps `plan` in sync. Price ids come from env vars `STRIPE_PRICE_{PLUS,STUDIO}_{WEEK,MONTH}`.
- **Cadence:** weekly and monthly. Weekly is the default display interval on the pricing page and in the upgrade sheet (small number up front); monthly is the "save up to 48%" option.
- **Free trial:** 5 days, **monthly plans only** — a trial nearly as long as the weekly billing period would invite churn cycling. Card required up front (`payment_method_collection: always`); Stripe auto-converts at trial end. Communicated on the pricing CTA ("Try 5 days free") and Stripe's pre-charge reminder email should be enabled so it doesn't feel like a dark pattern.
- **Upsell surface:** locked controls stay visible in the HUD with a "plus" chip; tapping one opens the in-context upgrade sheet (feature-specific copy, weekly price, checkout at the shown interval) rather than navigating to /pricing.
- **Upgrades/downgrades/cancellation:** handled via the Stripe Customer Portal rather than custom UI, at least for v1.

## Open questions

- **Storage/cost model:** unlimited recording on Studio has real storage + bandwidth cost once server-side recording storage grows; no quota-enforcement mechanism designed yet.
- **Weekly churn:** watch weekly-plan cancel rates; if people subscribe for a weekend and bail, revisit weekly pricing or add a minimum term.

## Not yet built

- Visual-themes picker UI + renderer wiring (module and entitlement flag exist).
- Continuous/instant-replay recording (Studio's flagship) — no rolling-buffer capture exists in the audio engine today.
- Audio download (MP3/WAV) and MIDI export.
- Production Stripe webhook — until it's configured, paid checkouts never update `plan` in Supabase outside test mode.
- Piano tuning/sound-quality pass (sellable but rough).
