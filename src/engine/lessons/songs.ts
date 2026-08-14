import type { Lesson } from './types';
import { seq, step, chord } from './builders';

// Song lessons — well-worn chord progressions, taught in chunks and then
// played full-speed over a synthesized backing track (see SongBackingTrack).
//
// Only the progression is here: never a melody, a lyric, or any audio, and no
// song titles or artist names either. Chord progressions aren't copyrightable,
// and each lesson names the style it evokes rather than a record it copies.
//
// Chords are authored in even beat counts and every bpm keeps a 2-beat chord
// on the 100ms recording sample grid ((120000 / bpm) % 100 === 0).
//
// noteIdx = scale degree on the left wheel for the lesson's key/scale.
// qualIdx: triad=0 6th=1 7th=2 9th=3 add9=4 sus2=5 sus4=6.

// ── The Four-Chord Loop ── C major: C(0) G(4) Am(5) F(3) ──

const LIB = 75;

const fourChordLoop: Lesson = {
  id: 'song-four-chord-loop',
  title: 'The Four-Chord Loop',
  subtitle: 'The four chords that power half of pop music',
  kind: 'song',
  style: 'In the style of sixties pop',
  difficulty: 'beginner',
  musicConfig: { keyOffset: 0, scale: 'major' },
  bpm: LIB,
  backing: 'four-chord-loop',
  progression: ['C', 'G', 'Am', 'F'],
  steps: [
    step(
      'lib-s1',
      'The opening line: C → G',
      seq(chord(0, 0, 4, LIB), chord(4, 0, 4, LIB), chord(0, 0, 4, LIB), chord(4, 0, 4, LIB)),
      { hint: 'The verse opens swinging between C and G — four beats each' },
    ),
    step(
      'lib-s2',
      'The answer: Am → F',
      seq(chord(5, 0, 4, LIB), chord(3, 0, 4, LIB), chord(5, 0, 4, LIB), chord(3, 0, 4, LIB)),
      { hint: 'The melancholy half of the loop — minor first, then F' },
    ),
    step(
      'lib-s3',
      'The whole verse, slowly',
      seq(chord(0, 0, 4, LIB), chord(4, 0, 4, LIB), chord(5, 0, 4, LIB), chord(3, 0, 4, LIB)),
      { hint: 'C → G → Am → F — four beats on each, anticipate the next position' },
    ),
    step(
      'lib-s4',
      'Play it with the band',
      seq(
        chord(0, 0, 2, LIB), chord(4, 0, 2, LIB), chord(5, 0, 2, LIB), chord(3, 0, 2, LIB),
        chord(0, 0, 2, LIB), chord(4, 0, 2, LIB), chord(5, 0, 2, LIB), chord(3, 0, 2, LIB),
      ),
      { hint: 'Song speed — two beats per chord, lock into the pulse', minScore: 65 },
    ),
  ],
  tags: ['song', 'I-V-vi-IV', 'C major'],
};

// ── The Doo-Wop Changes ── C major: C(0) Am(5) F(3) G(4) ──

const SBM = 120;

const dooWopChanges: Lesson = {
  id: 'song-doo-wop-changes',
  title: 'The Doo-Wop Changes',
  subtitle: 'The progression behind a thousand doo-wop records',
  kind: 'song',
  style: 'In the style of fifties soul',
  difficulty: 'beginner',
  musicConfig: { keyOffset: 0, scale: 'major' },
  bpm: SBM,
  backing: 'doo-wop-changes',
  progression: ['C', 'Am', 'F', 'G'],
  steps: [
    step(
      'sbm-s1',
      'The famous sway: C → Am',
      seq(chord(0, 0, 8, SBM), chord(5, 0, 8, SBM), chord(0, 0, 8, SBM), chord(5, 0, 8, SBM)),
      { hint: 'Two full bars on each chord — ride the walking bassline underneath' },
    ),
    step(
      'sbm-s2',
      'The turnaround: F → G → C',
      seq(
        chord(3, 0, 4, SBM), chord(4, 0, 4, SBM), chord(0, 0, 8, SBM),
        chord(3, 0, 4, SBM), chord(4, 0, 4, SBM), chord(0, 0, 8, SBM),
      ),
      { hint: 'F and G go by twice as fast — then land home on C' },
    ),
    step(
      'sbm-s3',
      'Full loop with the band',
      seq(
        chord(0, 0, 8, SBM), chord(5, 0, 8, SBM),
        chord(3, 0, 4, SBM), chord(4, 0, 4, SBM), chord(0, 0, 8, SBM),
      ),
      { hint: 'C · · · Am · · · F · G · C — the whole verse in one pass', minScore: 65 },
    ),
  ],
  tags: ['song', "'50s progression", 'C major'],
};

// ── Dreamy Sevenths ── C major 7ths: F7(3,2) Em7(2,2) Dm7(1,2) C7(0,2) ──
// (Wheel labels show the diatonic 7th — F7 here sounds as Fmaj7, C7 as Cmaj7.)

const BP = 80;

const dreamySevenths: Lesson = {
  id: 'song-dreamy-sevenths',
  title: 'Dreamy Sevenths',
  subtitle: 'A slow descent through dreamy seventh chords',
  kind: 'song',
  style: 'In the style of modern R&B',
  difficulty: 'intermediate',
  musicConfig: { keyOffset: 0, scale: 'major' },
  bpm: BP,
  backing: 'dreamy-sevenths',
  progression: ['F7', 'Em7', 'Dm7', 'C7'],
  steps: [
    step(
      'bp-s1',
      'Seventh colour: F7 → Em7',
      seq(chord(3, 2, 4, BP), chord(2, 2, 4, BP), chord(3, 2, 4, BP), chord(2, 2, 4, BP)),
      { hint: 'Park your right hand on 7th — the whole song lives there' },
    ),
    step(
      'bp-s2',
      'Keep falling: Dm7 → C7',
      seq(chord(1, 2, 4, BP), chord(0, 2, 4, BP), chord(1, 2, 4, BP), chord(0, 2, 4, BP)),
      { hint: 'The descent continues stepwise down to home' },
    ),
    step(
      'bp-s3',
      'The full descent, with the band',
      seq(
        chord(3, 2, 2, BP), chord(2, 2, 2, BP), chord(1, 2, 2, BP), chord(0, 2, 2, BP),
        chord(3, 2, 2, BP), chord(2, 2, 2, BP), chord(1, 2, 2, BP), chord(0, 2, 2, BP),
      ),
      { hint: 'F7 → Em7 → Dm7 → C7, two beats each — smooth left hand, still right', minScore: 65 },
    ),
  ],
  tags: ['song', 'sevenths', 'neo-soul'],
};

// ── Four Chords, New Key ── A major (keyOffset 9): A(0) E(4) F#m(5) D(3) ──

const SLY = 75;

const fourChordsNewKey: Lesson = {
  id: 'song-four-chords-new-key',
  title: 'Four Chords, New Key',
  subtitle: 'The four-chord shape you already know, moved somewhere new',
  kind: 'song',
  style: 'In the style of piano ballads',
  difficulty: 'intermediate',
  musicConfig: { keyOffset: 9, scale: 'major' },
  bpm: SLY,
  backing: 'four-chords-new-key',
  progression: ['A', 'E', 'F#m', 'D'],
  steps: [
    step(
      'sly-s1',
      'A new key: A → E',
      seq(chord(0, 0, 4, SLY), chord(4, 0, 4, SLY), chord(0, 0, 4, SLY), chord(4, 0, 4, SLY)),
      { hint: 'The wheel re-tuned to A major — home is now A, same positions as C → G' },
    ),
    step(
      'sly-s2',
      'The fall: F#m → D',
      seq(chord(5, 0, 4, SLY), chord(3, 0, 4, SLY), chord(5, 0, 4, SLY), chord(3, 0, 4, SLY)),
      { hint: 'Same slices as the Am → F you already played — the shape transfers between keys' },
    ),
    step(
      'sly-s3',
      'The chorus, full speed',
      seq(
        chord(0, 0, 2, SLY), chord(4, 0, 2, SLY), chord(5, 0, 2, SLY), chord(3, 0, 2, SLY),
        chord(0, 0, 2, SLY), chord(4, 0, 2, SLY), chord(5, 0, 2, SLY), chord(3, 0, 2, SLY),
      ),
      { hint: 'The chorus cycles all four — two beats per chord', minScore: 65 },
    ),
  ],
  tags: ['song', 'new key', 'A major'],
};

// ── The Sparse Loop ── E major (keyOffset 4): E(0) B(4) C#m(5) A(3) ──

const LY = 100;

const sparseLoop: Lesson = {
  id: 'song-sparse-loop',
  title: 'The Sparse Loop',
  subtitle: 'A spare guitar loop where every change counts',
  kind: 'song',
  style: 'In the style of acoustic pop',
  difficulty: 'intermediate',
  musicConfig: { keyOffset: 4, scale: 'major' },
  bpm: LY,
  backing: 'sparse-loop',
  // Locally-generated melody data (gitignored; see tools/melody-extract).
  // When the file exists, the verse step plays the lead line over the groove.
  melodyAsset: '/melodies/sparse-loop.json',
  audioBackingAsset: '/melodies/sparse-loop-backing.wav',
  melodyStepId: 'ly-s3',
  progression: ['E', 'B', 'C#m', 'A'],
  steps: [
    step(
      'ly-s1',
      'Another key again: E → B',
      seq(chord(0, 0, 4, LY), chord(4, 0, 4, LY), chord(0, 0, 4, LY), chord(4, 0, 4, LY)),
      { hint: 'E major now — notice the shape is still I → V, top of the wheel to the 5th' },
    ),
    step(
      'ly-s2',
      'C#m → A',
      seq(chord(5, 0, 4, LY), chord(3, 0, 4, LY), chord(5, 0, 4, LY), chord(3, 0, 4, LY)),
      { hint: 'The vi → IV answer — three keys in, this move should feel automatic' },
    ),
    step(
      'ly-s3',
      'The verse, with the melody',
      // 7 times through the loop (~34s) — sized to carry the full 30s verse
      // melody when the local melody file is present.
      seq(
        ...Array.from({ length: 7 }, () => [
          chord(0, 0, 2, LY), chord(4, 0, 2, LY), chord(5, 0, 2, LY), chord(3, 0, 2, LY),
        ]).flat(),
      ),
      { hint: 'Two beats per chord under the lead line — stay minimal, like the record', minScore: 65 },
    ),
  ],
  tags: ['song', 'I-V-vi-IV', 'E major'],
};

// ── Minor Four ── E minor (keyOffset 4): Em(0) C(5) G(2) D(6) ──

const ZOM = 80;

const minorFour: Lesson = {
  id: 'song-minor-four',
  title: 'Minor Four',
  subtitle: 'Four chords in a minor key, heavy and hypnotic',
  kind: 'song',
  style: 'In the style of nineties alt-rock',
  difficulty: 'intermediate',
  musicConfig: { keyOffset: 4, scale: 'minor' },
  bpm: ZOM,
  backing: 'minor-four',
  progression: ['Em', 'C', 'G', 'D'],
  steps: [
    step(
      'zom-s1',
      'Into the minor: Em → C',
      seq(chord(0, 0, 4, ZOM), chord(5, 0, 4, ZOM), chord(0, 0, 4, ZOM), chord(5, 0, 4, ZOM)),
      { hint: 'The wheel is in E minor now — home base is a minor chord' },
    ),
    step(
      'zom-s2',
      'The lift: G → D',
      seq(chord(2, 0, 4, ZOM), chord(6, 0, 4, ZOM), chord(2, 0, 4, ZOM), chord(6, 0, 4, ZOM)),
      { hint: 'Two major chords that briefly open the clouds before Em pulls back' },
    ),
    step(
      'zom-s3',
      'The anthem loop',
      seq(
        chord(0, 0, 4, ZOM), chord(5, 0, 4, ZOM), chord(2, 0, 4, ZOM), chord(6, 0, 4, ZOM),
        chord(0, 0, 4, ZOM), chord(5, 0, 4, ZOM), chord(2, 0, 4, ZOM), chord(6, 0, 4, ZOM),
      ),
      { hint: 'Em → C → G → D, a full bar each — twice through, no gaps', minScore: 65 },
    ),
  ],
  tags: ['song', 'minor key', 'E minor'],
};

// ── The Rising Cadence ── C major: C(0) Am(5) F(3) G(4) ──

const HAL = 60;

const risingCadence: Lesson = {
  id: 'song-rising-cadence',
  title: 'The Rising Cadence',
  subtitle: 'A progression that climbs and resolves like a chorus',
  kind: 'song',
  style: 'In the style of folk balladry',
  difficulty: 'intermediate',
  musicConfig: { keyOffset: 0, scale: 'major' },
  bpm: HAL,
  backing: 'rising-cadence',
  progression: ['C', 'Am', 'F', 'G'],
  steps: [
    step(
      'hal-s1',
      'The sway: C → Am',
      seq(
        chord(0, 0, 2, HAL), chord(5, 0, 2, HAL),
        chord(0, 0, 2, HAL), chord(5, 0, 2, HAL),
        chord(0, 0, 2, HAL), chord(5, 0, 2, HAL),
      ),
      { hint: 'A gentle two-beat rock between C and Am — the verse’s whole opening' },
    ),
    step(
      'hal-s2',
      'The famous walk: F → G → Am → F',
      seq(
        chord(3, 0, 2, HAL), chord(4, 0, 2, HAL), chord(5, 0, 2, HAL), chord(3, 0, 2, HAL),
        chord(3, 0, 2, HAL), chord(4, 0, 2, HAL), chord(5, 0, 2, HAL), chord(3, 0, 2, HAL),
      ),
      { hint: 'The line where the words name the harmony — the fourth (F), the fifth (G), the minor fall (Am)' },
    ),
    step(
      'hal-s3',
      'The full verse',
      seq(
        chord(0, 0, 2, HAL), chord(5, 0, 2, HAL), chord(0, 0, 2, HAL), chord(5, 0, 2, HAL),
        chord(3, 0, 2, HAL), chord(4, 0, 2, HAL), chord(0, 0, 2, HAL), chord(4, 0, 2, HAL),
      ),
      { hint: 'C Am C Am, then F G C G — let each change breathe', minScore: 65 },
    ),
  ],
  tags: ['song', 'ballad', 'C major'],
};

// ── Sus and Sevenths ── A mixolydian (keyOffset 9): Em7(4,7th) G(6) Dsus4(3,sus4) Asus4(0,sus4) ──

const WW = 80;

const susAndSevenths: Lesson = {
  id: 'song-sus-and-sevenths',
  title: 'Sus and Sevenths',
  subtitle: 'Sevenths and sus chords, for that unresolved shimmer',
  kind: 'song',
  style: 'In the style of Britpop',
  difficulty: 'advanced',
  musicConfig: { keyOffset: 9, scale: 'mixolydian' },
  bpm: WW,
  backing: 'sus-and-sevenths',
  progression: ['Em7', 'G', 'Dsus4', 'Asus4'],
  steps: [
    step(
      'ww-s1',
      'Colour chords: Em7 → G',
      seq(chord(4, 2, 4, WW), chord(6, 0, 4, WW), chord(4, 2, 4, WW), chord(6, 0, 4, WW)),
      { hint: 'Right hand on 7th for Em7, back to triad for G — both hands move' },
    ),
    step(
      'ww-s2',
      'The sus sound: Dsus4 → Asus4',
      seq(chord(3, 6, 4, WW), chord(0, 6, 4, WW), chord(3, 6, 4, WW), chord(0, 6, 4, WW)),
      { hint: 'Park your right hand on sus4 and let the left do the walking' },
    ),
    step(
      'ww-s3',
      'The famous loop',
      seq(
        chord(4, 2, 4, WW), chord(6, 0, 4, WW), chord(3, 6, 4, WW), chord(0, 6, 4, WW),
        chord(4, 2, 4, WW), chord(6, 0, 4, WW), chord(3, 6, 4, WW), chord(0, 6, 4, WW),
      ),
      { hint: 'The full loop, twice — both wheels working at once', minScore: 65 },
    ),
  ],
  tags: ['song', 'extensions', 'mixolydian'],
};

export const SONGS: Lesson[] = [
  fourChordLoop,
  dooWopChanges,
  dreamySevenths,
  fourChordsNewKey,
  sparseLoop,
  minorFour,
  risingCadence,
  susAndSevenths,
];
