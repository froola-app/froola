-- Documentation / reproducibility migration. See 0001_init_schema.sql for
-- the "not auto-applied, apply manually" convention this repo uses.
--
-- Recording slots: free holds 1, plus 3, studio unlimited. The client
-- enforces first (delete-oldest with a confirm dialog); this trigger is the
-- backstop so a hostile client can't hoard rows. Owners may now delete their
-- recordings (share links die with them — that's the product behavior).

ALTER TABLE public.recordings
  ADD COLUMN IF NOT EXISTS duration_ms integer CHECK (duration_ms IS NULL OR duration_ms BETWEEN 0 AND 600000);

CREATE POLICY "recordings_delete_own" ON public.recordings
  FOR DELETE USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.enforce_recording_cap()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE cap integer; held integer;
BEGIN
  -- Serialize per-user inserts so concurrent requests can't both pass the
  -- count check below (transaction-scoped; released at commit/rollback).
  PERFORM pg_advisory_xact_lock(hashtext(NEW.user_id::text));

  SELECT CASE
    WHEN p.beta_tester THEN NULL            -- studio-level: unlimited
    WHEN p.plan = 'studio' THEN NULL
    WHEN p.plan = 'plus' THEN 3
    ELSE 1                                  -- fail-safe default: unknown plans get the free cap
  END INTO cap
  FROM public.profiles p WHERE p.id = NEW.user_id;
  IF NOT FOUND THEN
    cap := 1;                               -- no profile row: fail closed to the free cap
  END IF;
  IF cap IS NULL THEN RETURN NEW; END IF;   -- unlimited plan
  SELECT count(*) INTO held FROM public.recordings WHERE user_id = NEW.user_id;
  IF held >= cap THEN
    RAISE EXCEPTION 'recording cap reached (% of %)', held, cap;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS recordings_cap ON public.recordings;
CREATE TRIGGER recordings_cap BEFORE INSERT ON public.recordings
  FOR EACH ROW EXECUTE FUNCTION public.enforce_recording_cap();
