-- Documentation / reproducibility migration. See 0001_init_schema.sql for
-- the "not auto-applied, apply manually" convention this repo uses.
--
-- Stored shareable replays: the recorder saves the codec payload here and
-- shares /replay?r=<id> instead of packing the whole recording into the URL
-- (which was 2000+ chars before RLE, and still grows with busy takes). The
-- legacy ?d=<payload> links keep working client-side with no table involved.
--
-- Replay links are public by design (that's the point of sharing them), so
-- SELECT is open to everyone including signed-out viewers. Writes require a
-- signed-in owner; rows are immutable (no UPDATE/DELETE policies).

CREATE TABLE IF NOT EXISTS public.recordings (
  -- Short random slug generated client-side (crypto-random base62, 10 chars
  -- ≈ 8e17 ids — unguessable). Format-checked so junk can't be inserted.
  id text PRIMARY KEY CHECK (id ~ '^[A-Za-z0-9]{10}$'),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  -- base64url codec payload (src/engine/recording/codec.ts). Capped well
  -- above any real recording (RLE output is usually <100 chars) so the anon
  -- key can't be used to stuff megabytes into the table.
  data text NOT NULL CHECK (char_length(data) BETWEEN 5 AND 20000),
  -- Epoch milliseconds, matching the client-timestamp convention in
  -- 0001_init_schema.sql.
  created_at bigint NOT NULL
);

ALTER TABLE public.recordings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recordings_select_public" ON public.recordings
  FOR SELECT USING (true);

CREATE POLICY "recordings_insert_own" ON public.recordings
  FOR INSERT WITH CHECK (auth.uid() = user_id);
