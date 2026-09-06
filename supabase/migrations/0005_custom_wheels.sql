-- Documentation / reproducibility migration. See 0001_init_schema.sql for
-- the "not auto-applied, apply manually" convention this repo uses.
--
-- Custom chord wheels (Plus/Studio): 7 owner-chosen slices per wheel, each
-- an interval above the tonic + a triad quality, stored as jsonb
-- (src/engine/music/keyScale.ts WheelSlice[]). Private to their owner —
-- unlike recordings, nothing here is shared.

CREATE TABLE IF NOT EXISTS public.custom_wheels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 40),
  -- 7 slices; shape is enforced client-side, size capped here so the anon
  -- key can't stuff arbitrary payloads into the table.
  slices jsonb NOT NULL CHECK (pg_column_size(slices) < 2048),
  -- Epoch milliseconds, matching the client-timestamp convention in
  -- 0001_init_schema.sql.
  created_at bigint NOT NULL
);

ALTER TABLE public.custom_wheels ENABLE ROW LEVEL SECURITY;

CREATE POLICY "custom_wheels_select_own" ON public.custom_wheels
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "custom_wheels_insert_own" ON public.custom_wheels
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "custom_wheels_update_own" ON public.custom_wheels
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "custom_wheels_delete_own" ON public.custom_wheels
  FOR DELETE USING (auth.uid() = user_id);
