-- Documentation / reproducibility migration. See 0001_init_schema.sql for
-- the "not auto-applied, apply manually" convention this repo uses.
--
-- Adds Stripe billing state to profiles. Written only by the service-role
-- client in api/stripe-webhook.ts (never by the browser anon key), so no
-- new RLS policy is needed for writes — the existing profiles_select_own
-- policy already lets a signed-in user read their own plan/status.
--
-- See docs/PRICING.md for the tier/billing spec this implements.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS stripe_customer_id text UNIQUE,
  ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS subscription_status text,
  -- Epoch milliseconds, matching the lesson_progress/review_progress
  -- convention in 0001_init_schema.sql (client-side Date.now() timestamps),
  -- rather than a Postgres timestamp type.
  ADD COLUMN IF NOT EXISTS current_period_end bigint;
