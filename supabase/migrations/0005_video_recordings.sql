-- Documentation / reproducibility migration. See 0001_init_schema.sql for
-- the "not auto-applied, apply manually" convention this repo uses.
--
-- Video recordings v2: recordings are now real videos (dials + camera + mic),
-- stored in Supabase Storage, listed in the profile drawer, and shared via
-- /watch?v=<id>. The gesture-replay recorder is retired; legacy /replay links
-- keep playing via the RPC at the bottom of this file.
--
-- Access model:
--   * The metadata table is owner-only (list/insert/delete). Anonymous share
--     viewers go through get_shared_video(), which looks up ONE row by exact
--     id — nobody can dump the table with the anon key (the 0004 mistake).
--   * The storage bucket is public but unlisted: object paths embed the
--     owner's uuid and a crypto-random slug, so a link works for anyone who
--     has it and for nobody who doesn't. Deleting the object kills the link,
--     which is exactly the free-tier rerecord contract.
--   * Plan quotas (free 1 / plus 3 / studio unlimited) and length caps are
--     enforced by a trigger reading profiles.plan, not just by the client.

CREATE TABLE IF NOT EXISTS public.video_recordings (
  -- Crypto-random base62 slug generated client-side, same convention as the
  -- 0004 recordings table.
  id text PRIMARY KEY CHECK (id ~ '^[A-Za-z0-9]{10}$'),
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  -- 'video/mp4' preferred (plays everywhere incl. iOS); 'video/webm' is the
  -- fallback for browsers whose MediaRecorder can't mux mp4.
  mime text NOT NULL CHECK (mime IN ('video/mp4', 'video/webm')),
  duration_ms integer NOT NULL CHECK (duration_ms BETWEEN 1 AND 360000),
  size_bytes bigint NOT NULL CHECK (size_bytes BETWEEN 1 AND 262144000),
  -- Epoch milliseconds, matching the client-timestamp convention in
  -- 0001_init_schema.sql.
  created_at bigint NOT NULL
);

CREATE INDEX IF NOT EXISTS video_recordings_user_idx
  ON public.video_recordings (user_id);

ALTER TABLE public.video_recordings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "video_recordings_select_own" ON public.video_recordings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "video_recordings_insert_own" ON public.video_recordings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "video_recordings_delete_own" ON public.video_recordings
  FOR DELETE USING (auth.uid() = user_id);

-- The canonical object path for a recording row. Single definition so the
-- storage policy and the share RPC can't drift apart. Clients build the same
-- string (src/engine/recording/videoRecordingStore.ts).
CREATE OR REPLACE FUNCTION public.video_object_path(rec public.video_recordings)
RETURNS text
LANGUAGE sql IMMUTABLE
SET search_path = ''
AS $$
  SELECT rec.user_id::text || '/' || rec.id
         || CASE rec.mime WHEN 'video/mp4' THEN '.mp4' ELSE '.webm' END;
$$;

-- Plan quotas + length caps, enforced server-side. Length caps carry a few
-- seconds of slack over the client-side stops (20s / 3min / 5min) because
-- MediaRecorder flushes a final chunk after stop().
CREATE OR REPLACE FUNCTION public.check_video_recording_quota()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  eff_plan text;
  max_count integer;  -- NULL = unlimited
  max_ms integer;
  used integer;
BEGIN
  SELECT CASE WHEN p.beta_tester THEN 'studio' ELSE COALESCE(p.plan, 'free') END
    INTO eff_plan
    FROM public.profiles p WHERE p.id = NEW.user_id;
  eff_plan := COALESCE(eff_plan, 'free');

  max_count := CASE eff_plan WHEN 'studio' THEN NULL WHEN 'plus' THEN 3 ELSE 1 END;
  max_ms    := CASE eff_plan WHEN 'studio' THEN 305000 WHEN 'plus' THEN 185000 ELSE 25000 END;

  IF NEW.duration_ms > max_ms THEN
    RAISE EXCEPTION 'recording exceeds plan length limit';
  END IF;

  IF max_count IS NOT NULL THEN
    SELECT count(*) INTO used FROM public.video_recordings WHERE user_id = NEW.user_id;
    IF used >= max_count THEN
      RAISE EXCEPTION 'recording limit reached for plan';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER video_recordings_quota
  BEFORE INSERT ON public.video_recordings
  FOR EACH ROW EXECUTE FUNCTION public.check_video_recording_quota();

-- Share-link lookup for anonymous viewers: exact-id fetch, SECURITY DEFINER
-- so the owner-only SELECT policy stays closed to direct queries.
CREATE OR REPLACE FUNCTION public.get_shared_video(share_id text)
RETURNS TABLE (object_path text, mime text, created_at bigint)
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = ''
AS $$
  SELECT public.video_object_path(r), r.mime, r.created_at
    FROM public.video_recordings r
   WHERE r.id = share_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_shared_video(text) TO anon, authenticated;

-- ---------------------------------------------------------------------------
-- Storage: public-but-unlisted bucket for the video files.

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('recordings', 'recordings', true, 262144000, ARRAY['video/mp4', 'video/webm'])
ON CONFLICT (id) DO NOTHING;

-- Upload requires a matching metadata row (which the quota trigger already
-- vetted), so storage can't be stuffed beyond a plan's recording slots.
CREATE POLICY "recordings_storage_insert_own" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'recordings'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND EXISTS (
      SELECT 1 FROM public.video_recordings r
       WHERE r.user_id = auth.uid()
         AND public.video_object_path(r) = name
    )
  );

CREATE POLICY "recordings_storage_delete_own" ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'recordings'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

-- ---------------------------------------------------------------------------
-- Legacy gesture replays (0004): the recorder is retired but shared /replay
-- links must keep working. Close the table-dump hole (SELECT was USING(true))
-- and serve lookups through the same exact-id RPC pattern as videos.

DROP POLICY IF EXISTS "recordings_select_public" ON public.recordings;
DROP POLICY IF EXISTS "recordings_insert_own" ON public.recordings;

CREATE OR REPLACE FUNCTION public.get_shared_replay(share_id text)
RETURNS text
LANGUAGE sql SECURITY DEFINER STABLE
SET search_path = ''
AS $$
  SELECT data FROM public.recordings WHERE id = share_id;
$$;

GRANT EXECUTE ON FUNCTION public.get_shared_replay(text) TO anon, authenticated;
