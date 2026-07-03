-- Documentation / reproducibility migration.
--
-- This file is NOT auto-applied to the live Supabase project (there is no
-- CI hook wired up). It exists so the schema and Row Level Security (RLS)
-- policies the client code depends on are checked into the repo instead of
-- living only in the Supabase dashboard.
--
-- To apply/confirm against the existing project, run this manually via the
-- SQL editor in the Supabase dashboard, or:
--
--   supabase link --project-ref <project-ref>
--   supabase db push
--
-- Every table below is read/written by the client using the public anon
-- key, filtered by user id (see src/contexts/AuthContext.tsx,
-- src/engine/lessons/useLessonProgress.ts,
-- src/engine/lessons/useReviewProgress.ts). That is only safe if RLS
-- actually restricts each table to the authenticated user's own rows —
-- these policies encode that requirement.

-- profiles: one row per user, created/updated via upsert in
-- AuthContext.tsx (completeOnboarding) and read on session load.
CREATE TABLE IF NOT EXISTS public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  user_type text,
  onboarding_complete boolean NOT NULL DEFAULT false
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "profiles_select_own" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "profiles_insert_own" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- lesson_progress: per-user, per-lesson best score / completion, read and
-- upserted in src/engine/lessons/useLessonProgress.ts.
CREATE TABLE IF NOT EXISTS public.lesson_progress (
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  lesson_id text NOT NULL,
  best_score numeric NOT NULL,
  -- Stored as epoch milliseconds (LessonResult.completedAt is `Date.now()`
  -- on the client), not a Postgres timestamp type.
  completed_at bigint,
  attempts integer NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, lesson_id)
);

ALTER TABLE public.lesson_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lesson_progress_select_own" ON public.lesson_progress
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "lesson_progress_insert_own" ON public.lesson_progress
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "lesson_progress_update_own" ON public.lesson_progress
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- review_progress: per-user, per-drill Leitner box scheduling state, read
-- and upserted in src/engine/lessons/useReviewProgress.ts.
CREATE TABLE IF NOT EXISTS public.review_progress (
  user_id uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  drill_id text NOT NULL,
  box integer NOT NULL,
  -- due_at / last_reviewed_at are epoch milliseconds (DrillProgress in
  -- src/engine/lessons/types.ts uses `Date.now()`-style numbers), not
  -- Postgres timestamp types.
  due_at bigint,
  review_count integer NOT NULL DEFAULT 0,
  last_result boolean,
  last_reviewed_at bigint,
  PRIMARY KEY (user_id, drill_id)
);

ALTER TABLE public.review_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "review_progress_select_own" ON public.review_progress
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "review_progress_insert_own" ON public.review_progress
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "review_progress_update_own" ON public.review_progress
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
