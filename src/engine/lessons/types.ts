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

export type LessonPhase =
  | 'idle'
  | 'preview'
  | 'countdown'
  | 'attempt'
  | 'step-result'
  | 'complete';
