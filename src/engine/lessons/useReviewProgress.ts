import { useCallback, useEffect, useState } from 'react';
import { doc, setDoc, collection, getDocs } from 'firebase/firestore';
import type { DrillProgress } from './types';
import { useAuth } from '../../contexts/AuthContext';
import { useLessonProgress } from './useLessonProgress';
import { DRILL_BANK } from './drillBank';
import { initialBoxState, nextBoxState, isDue } from './leitner';
import { db } from '../../firebase';

// Drills the user is eligible to review (their introducing lesson is passed),
// filtered down to the ones currently due, plus a function to record a
// pass/fail and advance the Leitner schedule. Degrades gracefully — same
// pattern as useLessonProgress — when Firebase isn't configured.
export function useReviewProgress() {
  const { user, firebaseReady } = useAuth();
  const { allProgress: lessonProgress } = useLessonProgress();
  const [allProgress, setAllProgress] = useState<Record<string, DrillProgress>>({});

  useEffect(() => {
    if (!firebaseReady || !user || !db) return;
    let cancelled = false;
    getDocs(collection(db, 'users', user.uid, 'reviewProgress')).then(snap => {
      if (cancelled) return;
      const map: Record<string, DrillProgress> = {};
      snap.forEach(d => { map[d.id] = d.data() as DrillProgress; });
      setAllProgress(map);
    }).catch(() => { /* firestore unavailable */ });
    return () => { cancelled = true; };
  }, [user, firebaseReady]);

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
    if (!firebaseReady || !user || !db) return;
    try {
      await setDoc(doc(db, 'users', user.uid, 'reviewProgress', drillId), progress);
    } catch { /* firestore unavailable */ }
  }, [allProgress, user, firebaseReady]);

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
