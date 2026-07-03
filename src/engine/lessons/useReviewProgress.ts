import { useCallback, useEffect, useState } from 'react';
import type { DrillProgress } from './types';
import { useAuth } from '../../contexts/AuthContext';
import { useLessonProgress } from './useLessonProgress';
import { DRILL_BANK } from './drillBank';
import { initialBoxState, nextBoxState, isDue } from './leitner';
import { supabase, supabaseConfigured } from '../../supabase';

// Drills the user is eligible to review (their introducing lesson is passed),
// filtered down to the ones currently due, plus a function to record a
// pass/fail and advance the Leitner schedule. Degrades gracefully — same
// pattern as useLessonProgress — when Supabase isn't configured.
export function useReviewProgress() {
  const { user, authReady } = useAuth();
  const { allProgress: lessonProgress } = useLessonProgress();
  const [allProgress, setAllProgress] = useState<Record<string, DrillProgress>>({});

  useEffect(() => {
    if (!authReady || !user || !supabaseConfigured) return;
    let cancelled = false;
    supabase?.from('review_progress').select('*').eq('user_id', user.id).then(({ data, error }) => {
      if (cancelled || error) return;
      const map: Record<string, DrillProgress> = {};
      (data ?? []).forEach(row => {
        map[row.drill_id] = {
          box: row.box,
          dueAt: row.due_at,
          reviewCount: row.review_count,
          lastResult: row.last_result,
          lastReviewedAt: row.last_reviewed_at,
        };
      });
      setAllProgress(map);
    });
    return () => { cancelled = true; };
  }, [user, authReady]);

  const completedLessonIds = new Set(
    Object.entries(lessonProgress)
      .filter(([, p]) => p.completedAt != null)
      .map(([lessonId]) => lessonId),
  );

  // Never quiz a chord from a lesson the user hasn't actually passed yet.
  const eligibleDrills = DRILL_BANK.filter(d => completedLessonIds.has(d.introducedByLessonId));
  const dueDrills = eligibleDrills.filter(d => {
    const progress = allProgress[d.id];
    return !progress || isDue(progress);
  });

  const recordResult = useCallback(async (drillId: string, passed: boolean) => {
    const existing = allProgress[drillId];
    const box = nextBoxState(existing ?? initialBoxState(), passed);
    const progress: DrillProgress = {
      box: box.box,
      dueAt: box.dueAt,
      reviewCount: (existing?.reviewCount ?? 0) + 1,
      lastResult: passed,
      lastReviewedAt: Date.now(),
    };
    setAllProgress(prev => ({ ...prev, [drillId]: progress }));
    if (!authReady || !user || !supabase) return;
    try {
      await supabase.from('review_progress').upsert({
        user_id: user.id,
        drill_id: drillId,
        box: progress.box,
        due_at: progress.dueAt,
        review_count: progress.reviewCount,
        last_result: progress.lastResult,
        last_reviewed_at: progress.lastReviewedAt,
      });
    } catch { /* database unavailable */ }
  }, [allProgress, user, authReady]);

  return {
    allProgress,
    dueDrills,
    dueCount: dueDrills.length,
    // Whether review is a meaningful feature to surface yet — false until
    // the user has learned at least one reviewable chord, even if nothing
    // happens to be due right now.
    hasEligibleDrills: eligibleDrills.length > 0,
    recordResult,
  };
}
