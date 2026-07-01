import { buildDrillBank, DRILL_BANK } from './drillBank';
import { diatonicChord, DEFAULT_MUSIC } from '../music/keyScale';
import type { Lesson, RecordingSample } from '../types';

function sample(noteIdx: number, qualityIdx: number): RecordingSample {
  return { dt: 100, noteIdx, qualityIdx, vibe: 0 };
}

function fixtureLesson(id: string, chords: [number, number][]): Lesson {
  const samples = chords.map(([n, q]) => sample(n, q));
  return {
    id,
    title: id,
    subtitle: '',
    difficulty: 'beginner',
    musicConfig: DEFAULT_MUSIC,
    tags: [],
    steps: [{
      id: `${id}-s1`,
      instruction: '',
      targetRecording: { samples, totalMs: samples.length * 100 },
      minScore: 60,
      durationMs: samples.length * 100,
    }],
  };
}

describe('buildDrillBank', () => {
  const fixture = [
    fixtureLesson('lesson-a', [[0, 0], [4, 0]]),       // C major, G major
    fixtureLesson('lesson-b', [[4, 0], [5, 0]]),        // G major (repeat), A minor
  ];

  it('dedupes repeated chords across lessons', () => {
    const bank = buildDrillBank(fixture);
    expect(bank).toHaveLength(3); // C, G, Am — G only counted once
  });

  it('credits the first lesson (in array order) that introduces a chord', () => {
    const bank = buildDrillBank(fixture);
    const g = bank.find(d => d.noteIdx === 4 && d.qualIdx === 0);
    expect(g?.introducedByLessonId).toBe('lesson-a');
  });

  it('labels drills using diatonicChord', () => {
    const bank = buildDrillBank(fixture);
    const c = bank.find(d => d.noteIdx === 0 && d.qualIdx === 0)!;
    expect(c.label).toBe(diatonicChord(0, 0, DEFAULT_MUSIC.keyOffset, DEFAULT_MUSIC.scale).label);
  });
});

describe('DRILL_BANK (real curriculum)', () => {
  it('is non-empty and has unique ids', () => {
    expect(DRILL_BANK.length).toBeGreaterThan(0);
    const ids = new Set(DRILL_BANK.map(d => d.id));
    expect(ids.size).toBe(DRILL_BANK.length);
  });
});
