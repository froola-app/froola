# Dormant: Stripe billing

Froola used to be a freemium product with Plus and Studio subscriptions. It is open
source now, every feature is on for everyone, and nothing in `src/` imports anything
here. This directory is a **parked reference implementation**, kept because the billing
path was complete and working, not because the app needs it.

It is excluded from the build, from `tsc`, and from lint. Nothing here runs.

## What's in it

| Path | What it did |
|---|---|
| `api/create-checkout-session.ts` | Stripe Checkout session for a plan and interval, with a 5-day trial on monthly only |
| `api/create-portal-session.ts` | Stripe billing portal redirect for existing subscribers |
| `api/stripe-webhook.ts` | `checkout.session.completed` and `customer.subscription.updated/deleted`, writing `profiles.plan` |
| `api/_lib/` | Stripe client and price lookup, a service-role Supabase client, small HTTP helpers |
| `src/pricingTiers.ts` | Plan ids, display copy, weekly and monthly prices |
| `src/billing.ts` | Browser side: start checkout, open the portal |
| `src/components/Pricing*.tsx` | The pricing page, the landing-page pricing section, and design mockups |
| `src/components/UpgradeSheet.tsx` | In-context upsell over the play canvas, per locked feature |
| `src/components/CheckoutResult.tsx` | Post-checkout success and cancel card |
| `src/components/onboarding/PricingStep.tsx` | Third onboarding step, the plan overview |

## Paths

Files keep the relative import paths they had in the app, so `src/components/UpgradeSheet.tsx`
still reads `../contexts/AuthContext`. Read them as if they sat at the repo root. Re-wiring
means copying them back to those positions, not fixing up imports in place.

## If you ever want it back

1. Copy the files back to their original positions (drop the `optional/billing/` prefix).
2. Restore `src/capabilities.ts` to a per-plan matrix and read the plan off the user profile.
3. Re-add the `/pricing` route and the Supabase `profiles.plan`, `stripe_customer_id`
   columns from `supabase/migrations/0002_billing.sql` and `0003_entitlements.sql`.
4. Set `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, and the four
   `STRIPE_PRICE_{PLUS,STUDIO}_{WEEK,MONTH}` price ids.

Known rough edges at the time it was parked: the webhook was only ever pointed at a local
`stripe listen` secret, so production plan sync was never exercised, and the checkout
success card claimed a trial for weekly buyers who did not get one.
