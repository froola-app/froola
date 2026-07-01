import type { Recording } from '../types';
import type { MusicConfig } from '../music/keyScale';

export type LessonDifficulty = 'beginner' | 'intermediate' | 'advanced';

export type LessonStep = {
  id: string;
  instruction: string;
  hint?: string;
  targetRecording: Recording;
  minScore: number;   // 0–100 required to advance
  durationMs: number; // attempt window length
};

export type Lesson = {
  id: string;
  title: string;
  subtitle: string;
  difficulty: LessonDifficulty;
  musicConfig: MusicConfig;
  steps: LessonStep[];
  tags: string[];
};

export type StepResult = {
  stepId: string;
  score: number;
  passed: boolean;
  attemptMs: number;
  noteAccuracy: number;
  qualAccuracy: number;
  scoresQuality: boolean;
};

export type LessonResult = {
  lessonId: string;
  stepResults: StepResult[];
  totalScore: number;
  completedAt: number;
};

export type LessonProgress = {
  bestScore: number;
  completedAt: number | null;
  attempts: number;
};

// A single reviewable chord, deduped out of the curriculum's target recordings.
export type Drill = {
  id: string; // `${keyOffset}:${scale}:${noteIdx}:${qualIdx}`
  noteIdx: number;
  qualIdx: number;
  musicConfig: MusicConfig;
  label: string;                 // e.g. "G7" — from diatonicChord(...).label
  introducedByLessonId: string;  // first lesson (curriculum order) that teaches it
};

// Leitner-box spaced-repetition state for one drill, one user.
export type DrillProgress = {
  box: number;
  dueAt: number;
  reviewCount: number;
  lastResult: boolean;
  lastReviewedAt: number;
};

export type LessonPhase =
  | 'idle'
  | 'preview'
  | 'countdown'
  | 'attempt'
  | 'step-result'
  | 'complete';
