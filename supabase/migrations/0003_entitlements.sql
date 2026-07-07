-- Documentation / reproducibility migration. See 0001_init_schema.sql for
-- the "not auto-applied, apply manually" convention this repo uses.
--
-- 1. Closes a privilege hole: the RLS policies in 0001 restrict WHICH rows a
--    user can write, but not WHICH COLUMNS — so any signed-in user could set
--    their own profiles.plan = 'studio' with the anon key. Column-level
--    grants fix that: clients may only write user_type/onboarding_complete;
--    billing state (plan, subscription_status, ...) and beta_tester are
--    writable only by the service-role client (api/stripe-webhook.ts) or the
--    dashboard SQL editor, which bypass these grants.
--
-- 2. Adds beta_tester: a manual, service-role-only flag that grants full
--    Studio-level entitlements without a subscription (see
--    src/entitlements.ts and docs/BETA_TESTERS.md).

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS beta_tester boolean NOT NULL DEFAULT false;

-- Supabase grants ALL on public tables to anon/authenticated by default.
-- Narrow writes to the two columns the app legitimately writes from the
-- browser (AuthContext.completeOnboarding). SELECT is left table-wide —
-- rows are already limited to the user's own via profiles_select_own.
REVOKE INSERT, UPDATE ON public.profiles FROM anon, authenticated;
GRANT INSERT (id, user_type, onboarding_complete) ON public.profiles TO authenticated;
GRANT UPDATE (user_type, onboarding_complete) ON public.profiles TO authenticated;

-- To grant a beta tester full access (run in the SQL editor):
--   UPDATE public.profiles SET beta_tester = true
--   WHERE id = (SELECT id FROM auth.users WHERE email = 'tester@example.com');
