import type { Drill, Lesson } from './types';
import { diatonicChord } from '../music/keyScale';
import { CURRICULUM } from './curriculum';

function drillId(keyOffset: number, scale: string, noteIdx: number, qualIdx: number): string {
  return `${keyOffset}:${scale}:${noteIdx}:${qualIdx}`;
}

// Dedupe every unique chord actually taught somewhere in a curriculum's target
// recordings into a flat, reviewable drill list. First lesson (in array order)
// to teach a chord is recorded as the one that "introduced" it.
export function buildDrillBank(curriculum: Lesson[] = CURRICULUM): Drill[] {
  const seen = new Map<string, Drill>();

  for (const lesson of curriculum) {
    const { keyOffset, scale } = lesson.musicConfig;
    for (const step of lesson.steps) {
      for (const sample of step.targetRecording.samples) {
        const id = drillId(keyOffset, scale, sample.noteIdx, sample.qualityIdx);
        if (seen.has(id)) continue;
        const { label } = diatonicChord(sample.noteIdx, sample.qualityIdx, keyOffset, scale);
        seen.set(id, {
          id,
          noteIdx: sample.noteIdx,
          qualIdx: sample.qualityIdx,
          musicConfig: lesson.musicConfig,
          label,
          introducedByLessonId: lesson.id,
        });
      }
    }
  }

  return Array.from(seen.values());
}

export const DRILL_BANK: Drill[] = buildDrillBank();

export function drillById(id: string): Drill | undefined {
  return DRILL_BANK.find(d => d.id === id);
}
