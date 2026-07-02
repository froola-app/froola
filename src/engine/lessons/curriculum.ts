import type { Lesson } from './types';
import type { RecordingSample } from '../types';
import { hold, seq, step } from './builders';
import { SONGS } from './songs';

// noteIdx: C=0 D=1 E=2 F=3 G=4 A=5 B=6  (left wheel, C major)
// qualIdx: triad=0 6th=1 7th=2 9th=3 add9=4 sus2=5 sus4=6  (right wheel)

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

const L1_S4 = step(
  'l1-s4',
  'Right hand time: C → Csus4 → C',
  seq(hold(0, 0, 2000), hold(0, 6, 2000), hold(0, 0, 2000)),
  { hint: 'Keep your left hand on C — swing your right hand to sus4 and back to hear the chord change colour', minScore: 55 },
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

// ── Lesson 4: Fist Solo ───────────────────────────────────────
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

// ── Exported curriculum (technique drills) ────────────────────
// These feed the drill bank / spaced-repetition review. Song lessons
// (songs.ts) are deliberately excluded from review — they live only
// in the learning path below.

export const CURRICULUM: Lesson[] = [
  {
    id: 'first-chord',
    title: 'Your First Chord',
    subtitle: 'Land chords with your left hand, colour them with your right',
    kind: 'technique',
    difficulty: 'beginner',
    musicConfig: { keyOffset: 0, scale: 'major' },
    steps: [L1_S1, L1_S2, L1_S3, L1_S4],
    tags: ['chords', 'basics', 'both wheels'],
  },
  {
    id: 'around-the-wheel',
    title: 'Around the Wheel',
    subtitle: 'Navigate all 7 diatonic chords up and down',
    kind: 'technique',
    difficulty: 'beginner',
    musicConfig: { keyOffset: 0, scale: 'major' },
    steps: [L2_S1, L2_S2],
    tags: ['navigation', 'basics', 'diatonic'],
  },
  {
    id: 'extensions',
    title: 'Feel the Extensions',
    subtitle: 'Explore triads, sevenths, and ninths on one root',
    kind: 'technique',
    difficulty: 'intermediate',
    musicConfig: { keyOffset: 0, scale: 'major' },
    steps: [L3_S1, L3_S2, L3_S3],
    tags: ['extensions', 'right wheel', 'colour'],
  },
  {
    id: 'fist-solo',
    title: 'Fist Solo',
    subtitle: 'Lock a chord with your right fist and play a melody with your left',
    kind: 'technique',
    difficulty: 'advanced',
    musicConfig: { keyOffset: 0, scale: 'major' },
    steps: [L5_S1, L5_S2],
    tags: ['melody', 'chord lock', 'advanced'],
  },
];

const byId = (id: string): Lesson => {
  const found = CURRICULUM.find(l => l.id === id) ?? SONGS.find(l => l.id === id);
  if (!found) throw new Error(`Unknown lesson id in learning path: ${id}`);
  return found;
};

// ── The learning path ─────────────────────────────────────────
// One ordered journey: technique drills interleaved with real songs, each
// unlocked by completing the one before it. Order is the pedagogy — every
// technique lesson prepares the song(s) that follow it.

export const LEARNING_PATH: Lesson[] = [
  byId('first-chord'),          // land a chord; first taste of the right wheel
  byId('song-let-it-be'),       // first real song with those chords
  byId('around-the-wheel'),     // navigate all 7 degrees
  byId('song-stand-by-me'),     // reordered loop, faster changes
  byId('extensions'),           // right-wheel colours in depth
  byId('song-best-part'),       // whole song on 7th chords
  byId('song-someone-like-you'),// same shape, new key (A major)
  byId('song-love-yourself'),   // another key (E major), song-speed changes
  byId('song-zombie'),          // minor-key mode
  byId('song-hallelujah'),      // longer form, slow control
  byId('fist-solo'),            // chord lock + melody
  byId('song-wonderwall'),      // finale: 7ths + sus4 in mixolydian
];

export function lessonById(id: string): Lesson | undefined {
  return LEARNING_PATH.find(l => l.id === id);
}

/** Index of a lesson in the learning path, or -1. */
export function pathIndexOf(id: string): number {
  return LEARNING_PATH.findIndex(l => l.id === id);
}

/** The lesson after `id` in the learning path, if any. */
export function nextLessonAfter(id: string): Lesson | undefined {
  const i = pathIndexOf(id);
  return i >= 0 ? LEARNING_PATH[i + 1] : undefined;
}

/** Star rating for a completed lesson's best score: pass=1★, 80+=2★, 92+=3★. */
export function starsForScore(score: number): 1 | 2 | 3 {
  if (score >= 92) return 3;
  if (score >= 80) return 2;
  return 1;
}
