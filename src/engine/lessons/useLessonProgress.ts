import { useCallback, useEffect, useState } from 'react';
import { doc, setDoc, collection, getDocs } from 'firebase/firestore';
import type { LessonProgress, LessonResult } from './types';
import { useAuth } from '../../contexts/AuthContext';
import { db } from '../../firebase';

// Returns progress for all lessons (keyed by lessonId) plus a save function
// for a specific lesson. Degrades gracefully when Firebase isn't configured.
export function useLessonProgress(lessonId?: string) {
  const { user, firebaseReady } = useAuth();
  const [allProgress, setAllProgress] = useState<Record<string, LessonProgress>>({});

  useEffect(() => {
    if (!firebaseReady || !user || !db) return;
    let cancelled = false;
    getDocs(collection(db, 'users', user.uid, 'lessonProgress')).then(snap => {
      if (cancelled) return;
      const map: Record<string, LessonProgress> = {};
      snap.forEach(d => { map[d.id] = d.data() as LessonProgress; });
      setAllProgress(map);
    }).catch(() => { /* firestore unavailable */ });
    return () => { cancelled = true; };
  }, [user, firebaseReady]);

  const save = useCallback(async (result: LessonResult) => {
    if (!firebaseReady || !user) return;
    const existing = allProgress[result.lessonId];
    const progress: LessonProgress = {
      bestScore: Math.max(result.totalScore, existing?.bestScore ?? 0),
      completedAt: result.completedAt,
      attempts: (existing?.attempts ?? 0) + 1,
    };
    setAllProgress(prev => ({ ...prev, [result.lessonId]: progress }));
    if (!db) return;
    try {
      await setDoc(doc(db, 'users', user.uid, 'lessonProgress', result.lessonId), progress);
    } catch { /* firestore unavailable */ }
  }, [user, firebaseReady, allProgress]);

  return { allProgress, progress: lessonId ? (allProgress[lessonId] ?? null) : null, save };
}
