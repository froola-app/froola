import type { Recording } from '../types';
import type { MusicConfig } from '../music/keyScale';

export type LessonDifficulty = 'beginner' | 'intermediate' | 'advanced';

// 'technique' = abstract drill teaching a mechanic; 'song' = a real song's
// chord progression, played over a synthesized backing track.
export type LessonKind = 'technique' | 'song';

// Arrangement key for the synthesized backing track. Song lessons get a
// bespoke per-song arrangement (drums, bassline rhythm, chord/arpeggio voice)
// defined in SongBackingTrack.ts; 'pop' is the generic fallback.
export type BackingStyle =
  | 'let-it-be'
  | 'stand-by-me'
  | 'best-part'
  | 'someone-like-you'
  | 'love-yourself'
  | 'zombie'
  | 'hallelujah'
  | 'wonderwall'
  | 'pop';

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
  kind: LessonKind;
  difficulty: LessonDifficulty;
  musicConfig: MusicConfig;
  steps: LessonStep[];
  tags: string[];
  /** Song lessons only — credited artist, shown in the catalog. */
  artist?: string;
  /** Song lessons only — drives the backing track and chord pacing. */
  bpm?: number;
  /** Song lessons only — display chips for the loop, e.g. ['C','G','Am','F']. */
  progression?: string[];
  /** Song lessons only — backing-track groove preset (default 'pop'). */
  backing?: BackingStyle;
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
  // Self-paced practice with no timer or scoring, inserted only before the
  // very first step a brand-new user ever attempts (see useLessonRunner).
  | 'warmup'
  | 'countdown'
  | 'attempt'
  | 'step-result'
  | 'complete';
