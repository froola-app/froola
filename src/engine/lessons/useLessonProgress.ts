import { useCallback, useEffect, useState } from 'react';
import type { LessonProgress, LessonResult } from './types';
import { useAuth } from '../../contexts/AuthContext';
import { supabase, supabaseConfigured } from '../../supabase';

// Returns progress for all lessons (keyed by lessonId) plus a save function
// for a specific lesson. Degrades gracefully when Supabase isn't configured.
export function useLessonProgress(lessonId?: string) {
  const { user, authReady } = useAuth();
  const [allProgress, setAllProgress] = useState<Record<string, LessonProgress>>({});

  useEffect(() => {
    if (!authReady || !user || !supabaseConfigured) return;
    let cancelled = false;
    supabase?.from('lesson_progress').select('*').eq('user_id', user.id).then(({ data, error }) => {
      if (cancelled || error) return;
      const map: Record<string, LessonProgress> = {};
      (data ?? []).forEach(row => {
        map[row.lesson_id] = {
          bestScore: row.best_score,
          completedAt: row.completed_at,
          attempts: row.attempts,
        };
      });
      setAllProgress(map);
    });
    return () => { cancelled = true; };
  }, [user, authReady]);

  const save = useCallback(async (result: LessonResult) => {
    if (!authReady || !user || !supabase) return;
    const existing = allProgress[result.lessonId];
    const progress: LessonProgress = {
      bestScore: Math.max(result.totalScore, existing?.bestScore ?? 0),
      completedAt: result.completedAt,
      attempts: (existing?.attempts ?? 0) + 1,
    };
    setAllProgress(prev => ({ ...prev, [result.lessonId]: progress }));
    try {
      await supabase.from('lesson_progress').upsert({
        user_id: user.id,
        lesson_id: result.lessonId,
        best_score: progress.bestScore,
        completed_at: progress.completedAt,
        attempts: progress.attempts,
      });
    } catch { /* database unavailable */ }
  }, [user, authReady, allProgress]);

  return { allProgress, progress: lessonId ? (allProgress[lessonId] ?? null) : null, save };
}
