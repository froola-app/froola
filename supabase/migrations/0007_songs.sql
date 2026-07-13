-- Documentation / reproducibility migration (apply manually — see 0001).
--
-- "My Song": one saved project per user (Plus+) — the pasted lyrics+chords
-- sheet plus saved chord loops. user_id as PRIMARY KEY *is* the one-song
-- limit; "resettable import" = deleting the row frees the slot. The client
-- gates on entitlements; the unique key is the server backstop.

CREATE TABLE IF NOT EXISTS public.songs (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  title text NOT NULL CHECK (char_length(title) BETWEEN 1 AND 120),
  sheet_source text NOT NULL CHECK (char_length(sheet_source) <= 20000),
  loops jsonb NOT NULL DEFAULT '[]',
  created_at bigint NOT NULL,
  updated_at bigint NOT NULL
);

ALTER TABLE public.songs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "songs_select_own" ON public.songs FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "songs_insert_own" ON public.songs FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "songs_update_own" ON public.songs FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "songs_delete_own" ON public.songs FOR DELETE USING (auth.uid() = user_id);
