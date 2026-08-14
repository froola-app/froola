import { useCallback, useEffect, useState } from 'react';
import type { LessonProgress, LessonResult } from './types';
import { useAuth } from '../../contexts/AuthContext';
import { readProgress, saveProgressEntry } from './progressStore';
import { supabase, supabaseConfigured } from '../../supabase';

// Progress for all lessons (keyed by lessonId) plus a save function for one.
//
// This device is always written, so froola keeps your progress with no account
// and no backend. When someone is signed in, Supabase is written too and its
// rows win on load, which is what makes progress follow you between devices.
export function useLessonProgress(lessonId?: string) {
  const { user, authReady } = useAuth();
  const [allProgress, setAllProgress] = useState<Record<string, LessonProgress>>(
    () => readProgress<LessonProgress>('lesson'),
  );

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
      // Local entries stay unless the account has its own record of that
      // lesson: signing in should add history, never erase it.
      setAllProgress(prev => ({ ...prev, ...map }));
    });
    return () => { cancelled = true; };
  }, [user, authReady]);

  const save = useCallback(async (result: LessonResult) => {
    const existing = allProgress[result.lessonId];
    const progress: LessonProgress = {
      bestScore: Math.max(result.totalScore, existing?.bestScore ?? 0),
      completedAt: result.completedAt,
      attempts: (existing?.attempts ?? 0) + 1,
    };
    setAllProgress(prev => ({ ...prev, [result.lessonId]: progress }));
    saveProgressEntry('lesson', result.lessonId, progress);

    if (!authReady || !user || !supabase) return;
    try {
      await supabase.from('lesson_progress').upsert({
        user_id: user.id,
        lesson_id: result.lessonId,
        best_score: progress.bestScore,
        completed_at: progress.completedAt,
        attempts: progress.attempts,
      });
    } catch { /* database unavailable; the local copy already landed */ }
  }, [user, authReady, allProgress]);

  return { allProgress, progress: lessonId ? (allProgress[lessonId] ?? null) : null, save };
}
