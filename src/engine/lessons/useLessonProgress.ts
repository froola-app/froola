import { useCallback, useEffect, useState } from 'react';
import type { LessonProgress, LessonResult } from './types';
import { useAuth } from '../../contexts/AuthContext';

// Lazy import Firestore so we don't break when Firebase isn't configured
async function getFirestore() {
  const { doc, getDoc, setDoc, collection, getDocs } = await import('firebase/firestore');
  const { db } = await import('../../firebase');
  return { doc, getDoc, setDoc, collection, getDocs, db };
}

// Returns progress for all lessons (keyed by lessonId) plus a save function
// for a specific lesson. Degrades gracefully when Firebase isn't configured.
export function useLessonProgress(lessonId?: string) {
  const { user, firebaseReady } = useAuth();
  const [allProgress, setAllProgress] = useState<Record<string, LessonProgress>>({});

  useEffect(() => {
    if (!firebaseReady || !user) return;
    let cancelled = false;
    getFirestore().then(async ({ collection, getDocs, db }) => {
      if (!db || cancelled) return;
      const snap = await getDocs(collection(db, 'users', user.uid, 'lessonProgress'));
      if (cancelled) return;
      const map: Record<string, LessonProgress> = {};
      snap.forEach(d => { map[d.id] = d.data() as LessonProgress; });
      setAllProgress(map);
    }).catch(() => { /* firebase not available */ });
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
    try {
      const { doc, setDoc, db } = await getFirestore();
      if (!db) return;
      await setDoc(doc(db, 'users', user.uid, 'lessonProgress', result.lessonId), progress);
    } catch { /* firebase not available */ }
  }, [user, firebaseReady, allProgress]);

  return { allProgress, progress: lessonId ? (allProgress[lessonId] ?? null) : null, save };
}
