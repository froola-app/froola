import type { Lesson, LessonStep } from './types';
import type { RecordingSample, Recording } from '../types';

// Helpers to build target recordings from compact descriptions.
// noteIdx: C=0 D=1 E=2 F=3 G=4 A=5 B=6  (left wheel, C major)
// qualIdx: triad=0 6th=1 7th=2 9th=3 add9=4 sus2=5 sus4=6  (right wheel)

function hold(noteIdx: number, qualIdx: number, durationMs: number): RecordingSample[] {
  const count = Math.round(durationMs / 100);
  return Array.from({ length: count }, () => ({ dt: 100, noteIdx, qualityIdx: qualIdx, vibe: 0 }));
}

function seq(...chunks: RecordingSample[][]): Recording {
  const samples = chunks.flat();
  return { samples, totalMs: samples.reduce((s, r) => s + r.dt, 0) };
}

function step(
  id: string,
  instruction: string,
  recording: Recording,
  opts: { hint?: string; minScore?: number } = {},
): LessonStep {
  return {
    id,
    instruction,
    hint: opts.hint,
    targetRecording: recording,
    minScore: opts.minScore ?? 60,
    durationMs: recording.totalMs,
  };
}

// ── Lesson 1: Your First Chord ─────────────────────────────────

const L1_S1 = step(
  'l1-s1',
  'Hold C major',
  seq(hold(0, 0, 3000)),
  { hint: 'Left hand at the top of the left wheel, right hand at the top of the right wheel', minScore: 60 },
);

const L1_S2 = step(
  'l1-s2',
  'Now find G major',
  seq(hold(4, 0, 3000)),
  { hint: 'Move your left hand clockwise — G is the 5th position', minScore: 60 },
);

const L1_S3 = step(
  'l1-s3',
  'Play C → G → Am → F',
  seq(hold(0, 0, 2000), hold(4, 0, 2000), hold(5, 0, 2000), hold(3, 0, 2000)),
  { hint: 'The I–V–vi–IV progression — the backbone of thousands of songs', minScore: 55 },
);

// ── Lesson 2: Around the Wheel ────────────────────────────────

const L2_S1 = step(
  'l2-s1',
  'Visit every chord — up the wheel',
  seq(...[0, 1, 2, 3, 4, 5, 6].map(n => hold(n, 0, 1000))),
  { hint: 'C D E F G A B — one second each, keep right hand on triad', minScore: 55 },
);

const L2_S2 = step(
  'l2-s2',
  'Now come back down',
  seq(...[6, 5, 4, 3, 2, 1, 0].map(n => hold(n, 0, 1000))),
  { hint: 'B A G F E D C — same wheel, opposite direction', minScore: 55 },
);

// ── Lesson 3: Extensions ──────────────────────────────────────

const L3_S1 = step(
  'l3-s1',
  'C triad → C7 → C9',
  seq(hold(0, 0, 2000), hold(0, 2, 2000), hold(0, 3, 2000)),
  { hint: 'Keep left hand on C — move only your right hand up the extension wheel', minScore: 60 },
);

const L3_S2 = step(
  'l3-s2',
  'G triad → G7 → G9',
  seq(hold(4, 0, 2000), hold(4, 2, 2000), hold(4, 3, 2000)),
  { hint: 'Same pattern, left hand moves to G first', minScore: 60 },
);

const L3_S3 = step(
  'l3-s3',
  'Am → Am7',
  seq(hold(5, 0, 2000), hold(5, 2, 2000)),
  { hint: 'A minor gets a melancholy seventh — feel the colour change', minScore: 60 },
);

// ── Lesson 4: I–V–vi–IV Smooth ───────────────────────────────

const L4_S1 = step(
  'l4-s1',
  'I–V–vi–IV, twice through — stay smooth',
  seq(
    hold(0, 0, 2000), hold(4, 0, 2000), hold(5, 0, 2000), hold(3, 0, 2000),
    hold(0, 0, 2000), hold(4, 0, 2000), hold(5, 0, 2000), hold(3, 0, 2000),
  ),
  { hint: 'No pauses between chords — anticipate the next position', minScore: 70 },
);

// ── Lesson 5: Fist Solo ───────────────────────────────────────
// Right hand makes a fist (chord lock), left hand plays a melody.
// In the target recording qualIdx stays 0 (triad), but during playback
// the coordinator will see the fist flag and engage chord-lock mode.
// The lesson runner scores only noteIdx during this lesson.

function fistSamples(notes: number[], msEach: number): RecordingSample[] {
  return notes.flatMap(noteIdx =>
    Array.from({ length: Math.round(msEach / 100) }, () => ({
      dt: 100,
      noteIdx,
      qualityIdx: 0,
      vibe: 0,
    })),
  );
}

const L5_S1 = step(
  'l5-s1',
  'Lock C with a fist — play the melody up',
  seq(fistSamples([0, 1, 2, 3], 1250)),
  { hint: 'Make a fist with your right hand to lock the chord, then walk your left hand up', minScore: 55 },
);

const L5_S2 = step(
  'l5-s2',
  'Lock G — melody from G upward',
  seq(fistSamples([4, 5, 6, 0], 1250)),
  { hint: 'Same technique over G — your left hand wraps around the top of the wheel', minScore: 55 },
);

// ── Exported curriculum ───────────────────────────────────────

export const CURRICULUM: Lesson[] = [
  {
    id: 'first-chord',
    title: 'Your First Chord',
    subtitle: 'Learn to land on any chord in the C major scale',
    difficulty: 'beginner',
    musicConfig: { keyOffset: 0, scale: 'major' },
    steps: [L1_S1, L1_S2, L1_S3],
    tags: ['chords', 'basics', 'C major'],
  },
  {
    id: 'around-the-wheel',
    title: 'Around the Wheel',
    subtitle: 'Navigate all 7 diatonic chords up and down',
    difficulty: 'beginner',
    musicConfig: { keyOffset: 0, scale: 'major' },
    steps: [L2_S1, L2_S2],
    tags: ['navigation', 'basics', 'diatonic'],
  },
  {
    id: 'extensions',
    title: 'Feel the Extensions',
    subtitle: 'Explore triads, sevenths, and ninths on one root',
    difficulty: 'intermediate',
    musicConfig: { keyOffset: 0, scale: 'major' },
    steps: [L3_S1, L3_S2, L3_S3],
    tags: ['extensions', 'right wheel', 'colour'],
  },
  {
    id: 'four-chord-smooth',
    title: 'I–V–vi–IV Smooth',
    subtitle: 'Play the most common progression in pop music without hesitating',
    difficulty: 'intermediate',
    musicConfig: { keyOffset: 0, scale: 'major' },
    steps: [L4_S1],
    tags: ['progression', 'I-V-vi-IV', 'fluency'],
  },
  {
    id: 'fist-solo',
    title: 'Fist Solo',
    subtitle: 'Lock a chord with your right fist and play a melody with your left',
    difficulty: 'advanced',
    musicConfig: { keyOffset: 0, scale: 'major' },
    steps: [L5_S1, L5_S2],
    tags: ['melody', 'chord lock', 'advanced'],
  },
];

export function lessonById(id: string): Lesson | undefined {
  return CURRICULUM.find(l => l.id === id);
}
