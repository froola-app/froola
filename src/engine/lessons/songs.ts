import type { Lesson } from './types';
import { seq, step, chord } from './builders';

// Song lessons — real songs' chord progressions, taught in chunks and then
// played full-speed over a synthesized backing track (see SongBackingTrack).
//
// Only the chord progression is reproduced — never melody, lyrics, or audio —
// so nothing copyrightable is copied. Titles/artists are used nominatively to
// identify which song's changes are being taught.
//
// Every bpm here has a beat length that's a multiple of 100ms (60/75/100/120/150)
// so chord boundaries align with the 100ms recording sample grid.
//
// noteIdx = scale degree on the left wheel for the lesson's key/scale.
// qualIdx: triad=0 6th=1 7th=2 9th=3 add9=4 sus2=5 sus4=6.

// ── Let It Be — The Beatles ── C major: C(0) G(4) Am(5) F(3) ──

const LET_IT_BE_BPM = 75;

const letItBe: Lesson = {
  id: 'song-let-it-be',
  title: 'Let It Be',
  subtitle: 'The Beatles — the four-chord loop that powers half of pop music',
  kind: 'song',
  artist: 'The Beatles',
  difficulty: 'beginner',
  musicConfig: { keyOffset: 0, scale: 'major' },
  bpm: LET_IT_BE_BPM,
  progression: ['C', 'G', 'Am', 'F'],
  steps: [
    step(
      'lib-s1',
      'The opening line: C → G',
      seq(
        chord(0, 0, 4, LET_IT_BE_BPM), chord(4, 0, 4, LET_IT_BE_BPM),
        chord(0, 0, 4, LET_IT_BE_BPM), chord(4, 0, 4, LET_IT_BE_BPM),
      ),
      { hint: '“When I find myself in times of trouble” — swing between C and G, four beats each' },
    ),
    step(
      'lib-s2',
      'The answer: Am → F',
      seq(
        chord(5, 0, 4, LET_IT_BE_BPM), chord(3, 0, 4, LET_IT_BE_BPM),
        chord(5, 0, 4, LET_IT_BE_BPM), chord(3, 0, 4, LET_IT_BE_BPM),
      ),
      { hint: '“Mother Mary comes to me” — the melancholy half of the loop' },
    ),
    step(
      'lib-s3',
      'The whole verse, slowly',
      seq(
        chord(0, 0, 4, LET_IT_BE_BPM), chord(4, 0, 4, LET_IT_BE_BPM),
        chord(5, 0, 4, LET_IT_BE_BPM), chord(3, 0, 4, LET_IT_BE_BPM),
      ),
      { hint: 'C → G → Am → F — four beats on each, anticipate the next position' },
    ),
    step(
      'lib-s4',
      'Play it with the band',
      seq(
        chord(0, 0, 2, LET_IT_BE_BPM), chord(4, 0, 2, LET_IT_BE_BPM),
        chord(5, 0, 2, LET_IT_BE_BPM), chord(3, 0, 2, LET_IT_BE_BPM),
        chord(0, 0, 2, LET_IT_BE_BPM), chord(4, 0, 2, LET_IT_BE_BPM),
        chord(5, 0, 2, LET_IT_BE_BPM), chord(3, 0, 2, LET_IT_BE_BPM),
      ),
      { hint: 'Song speed — two beats per chord, lock into the pulse', minScore: 65 },
    ),
  ],
  tags: ['song', 'I-V-vi-IV', 'C major'],
};

// ── Stand By Me — Ben E. King ── C major: C(0) Am(5) F(3) G(4) ──

const STAND_BY_ME_BPM = 120;

const standByMe: Lesson = {
  id: 'song-stand-by-me',
  title: 'Stand By Me',
  subtitle: 'Ben E. King — the ’50s progression behind a thousand doo-wop songs',
  kind: 'song',
  artist: 'Ben E. King',
  difficulty: 'beginner',
  musicConfig: { keyOffset: 0, scale: 'major' },
  bpm: STAND_BY_ME_BPM,
  progression: ['C', 'Am', 'F', 'G'],
  steps: [
    step(
      'sbm-s1',
      'The famous sway: C → Am',
      seq(
        chord(0, 0, 8, STAND_BY_ME_BPM), chord(5, 0, 8, STAND_BY_ME_BPM),
        chord(0, 0, 8, STAND_BY_ME_BPM), chord(5, 0, 8, STAND_BY_ME_BPM),
      ),
      { hint: '“When the night has come…” — two full bars on each chord' },
    ),
    step(
      'sbm-s2',
      'The turnaround: F → G → C',
      seq(
        chord(3, 0, 4, STAND_BY_ME_BPM), chord(4, 0, 4, STAND_BY_ME_BPM), chord(0, 0, 8, STAND_BY_ME_BPM),
        chord(3, 0, 4, STAND_BY_ME_BPM), chord(4, 0, 4, STAND_BY_ME_BPM), chord(0, 0, 8, STAND_BY_ME_BPM),
      ),
      { hint: 'F and G go by twice as fast — then land home on C' },
    ),
    step(
      'sbm-s3',
      'Full loop with the band',
      seq(
        chord(0, 0, 8, STAND_BY_ME_BPM), chord(5, 0, 8, STAND_BY_ME_BPM),
        chord(3, 0, 4, STAND_BY_ME_BPM), chord(4, 0, 4, STAND_BY_ME_BPM),
        chord(0, 0, 8, STAND_BY_ME_BPM),
      ),
      { hint: 'C · · · Am · · · F · G · C — the whole verse in one pass', minScore: 65 },
    ),
  ],
  tags: ['song', "'50s progression", 'C major'],
};

// ── Riptide — Vance Joy ── C major: Am(5) F(3) C(0) G(4) ──

const RIPTIDE_BPM = 100;

const riptide: Lesson = {
  id: 'song-riptide',
  title: 'Riptide',
  subtitle: 'Vance Joy — a loop that starts on the minor chord and never resolves',
  kind: 'song',
  artist: 'Vance Joy',
  difficulty: 'beginner',
  musicConfig: { keyOffset: 0, scale: 'major' },
  bpm: RIPTIDE_BPM,
  progression: ['Am', 'F', 'C', 'G'],
  steps: [
    step(
      'rip-s1',
      'The loop, stretched out: Am → F → C',
      seq(
        chord(5, 0, 8, RIPTIDE_BPM), chord(3, 0, 8, RIPTIDE_BPM), chord(0, 0, 8, RIPTIDE_BPM),
      ),
      { hint: 'Start on Am — the whole song lives in these three chords' },
    ),
    step(
      'rip-s2',
      'Verse speed',
      seq(
        chord(5, 0, 4, RIPTIDE_BPM), chord(3, 0, 4, RIPTIDE_BPM), chord(0, 0, 8, RIPTIDE_BPM),
        chord(5, 0, 4, RIPTIDE_BPM), chord(3, 0, 4, RIPTIDE_BPM), chord(0, 0, 8, RIPTIDE_BPM),
      ),
      { hint: '“Lady, running down to the riptide” — C gets twice the space' },
    ),
    step(
      'rip-s3',
      'Chorus — G joins the party',
      seq(
        chord(5, 0, 4, RIPTIDE_BPM), chord(3, 0, 4, RIPTIDE_BPM),
        chord(0, 0, 4, RIPTIDE_BPM), chord(4, 0, 4, RIPTIDE_BPM),
        chord(5, 0, 4, RIPTIDE_BPM), chord(3, 0, 4, RIPTIDE_BPM),
        chord(0, 0, 4, RIPTIDE_BPM), chord(4, 0, 4, RIPTIDE_BPM),
      ),
      { hint: 'Same loop plus G at the end — one bar each, keep it rolling', minScore: 65 },
    ),
  ],
  tags: ['song', 'vi-IV-I-V', 'C major'],
};

// ── Someone Like You — Adele ── A major (keyOffset 9): A(0) E(4) F#m(5) D(3) ──

const SOMEONE_LIKE_YOU_BPM = 75;

const someoneLikeYou: Lesson = {
  id: 'song-someone-like-you',
  title: 'Someone Like You',
  subtitle: 'Adele — the same four-chord shape you already know, in a brand-new key',
  kind: 'song',
  artist: 'Adele',
  difficulty: 'intermediate',
  musicConfig: { keyOffset: 9, scale: 'major' },
  bpm: SOMEONE_LIKE_YOU_BPM,
  progression: ['A', 'E', 'F#m', 'D'],
  steps: [
    step(
      'sly-s1',
      'A new key: A → E',
      seq(
        chord(0, 0, 4, SOMEONE_LIKE_YOU_BPM), chord(4, 0, 4, SOMEONE_LIKE_YOU_BPM),
        chord(0, 0, 4, SOMEONE_LIKE_YOU_BPM), chord(4, 0, 4, SOMEONE_LIKE_YOU_BPM),
      ),
      { hint: 'The wheel re-tuned to A major — home is now A, same positions as C → G' },
    ),
    step(
      'sly-s2',
      'The fall: F#m → D',
      seq(
        chord(5, 0, 4, SOMEONE_LIKE_YOU_BPM), chord(3, 0, 4, SOMEONE_LIKE_YOU_BPM),
        chord(5, 0, 4, SOMEONE_LIKE_YOU_BPM), chord(3, 0, 4, SOMEONE_LIKE_YOU_BPM),
      ),
      { hint: 'Same slices as Am → F in Let It Be — the shape transfers between keys' },
    ),
    step(
      'sly-s3',
      'The chorus, full speed',
      seq(
        chord(0, 0, 2, SOMEONE_LIKE_YOU_BPM), chord(4, 0, 2, SOMEONE_LIKE_YOU_BPM),
        chord(5, 0, 2, SOMEONE_LIKE_YOU_BPM), chord(3, 0, 2, SOMEONE_LIKE_YOU_BPM),
        chord(0, 0, 2, SOMEONE_LIKE_YOU_BPM), chord(4, 0, 2, SOMEONE_LIKE_YOU_BPM),
        chord(5, 0, 2, SOMEONE_LIKE_YOU_BPM), chord(3, 0, 2, SOMEONE_LIKE_YOU_BPM),
      ),
      { hint: '“Never mind, I’ll find someone like you” — two beats per chord', minScore: 65 },
    ),
  ],
  tags: ['song', 'new key', 'A major'],
};

// ── Zombie — The Cranberries ── E minor (keyOffset 4): Em(0) C(5) G(2) D(6) ──

const ZOMBIE_BPM = 75;

const zombie: Lesson = {
  id: 'song-zombie',
  title: 'Zombie',
  subtitle: 'The Cranberries — four chords in a minor key, heavy and hypnotic',
  kind: 'song',
  artist: 'The Cranberries',
  difficulty: 'intermediate',
  musicConfig: { keyOffset: 4, scale: 'minor' },
  bpm: ZOMBIE_BPM,
  progression: ['Em', 'C', 'G', 'D'],
  steps: [
    step(
      'zom-s1',
      'Into the minor: Em → C',
      seq(
        chord(0, 0, 4, ZOMBIE_BPM), chord(5, 0, 4, ZOMBIE_BPM),
        chord(0, 0, 4, ZOMBIE_BPM), chord(5, 0, 4, ZOMBIE_BPM),
      ),
      { hint: 'The wheel is in E minor now — home base is a minor chord' },
    ),
    step(
      'zom-s2',
      'The lift: G → D',
      seq(
        chord(2, 0, 4, ZOMBIE_BPM), chord(6, 0, 4, ZOMBIE_BPM),
        chord(2, 0, 4, ZOMBIE_BPM), chord(6, 0, 4, ZOMBIE_BPM),
      ),
      { hint: 'Two major chords that briefly open the clouds before Em pulls back' },
    ),
    step(
      'zom-s3',
      'The anthem loop',
      seq(
        chord(0, 0, 4, ZOMBIE_BPM), chord(5, 0, 4, ZOMBIE_BPM),
        chord(2, 0, 4, ZOMBIE_BPM), chord(6, 0, 4, ZOMBIE_BPM),
        chord(0, 0, 4, ZOMBIE_BPM), chord(5, 0, 4, ZOMBIE_BPM),
        chord(2, 0, 4, ZOMBIE_BPM), chord(6, 0, 4, ZOMBIE_BPM),
      ),
      { hint: 'Em → C → G → D, a full bar each — twice through, no gaps', minScore: 65 },
    ),
  ],
  tags: ['song', 'minor key', 'E minor'],
};

// ── Hallelujah — Leonard Cohen ── C major: C(0) Am(5) F(3) G(4) ──

const HALLELUJAH_BPM = 60;

const hallelujah: Lesson = {
  id: 'song-hallelujah',
  title: 'Hallelujah',
  subtitle: 'Leonard Cohen — the song whose lyrics narrate its own chords',
  kind: 'song',
  artist: 'Leonard Cohen',
  difficulty: 'intermediate',
  musicConfig: { keyOffset: 0, scale: 'major' },
  bpm: HALLELUJAH_BPM,
  progression: ['C', 'Am', 'F', 'G'],
  steps: [
    step(
      'hal-s1',
      'The sway: C → Am',
      seq(
        chord(0, 0, 2, HALLELUJAH_BPM), chord(5, 0, 2, HALLELUJAH_BPM),
        chord(0, 0, 2, HALLELUJAH_BPM), chord(5, 0, 2, HALLELUJAH_BPM),
        chord(0, 0, 2, HALLELUJAH_BPM), chord(5, 0, 2, HALLELUJAH_BPM),
      ),
      { hint: '“I heard there was a secret chord” — a gentle two-beat rock, back and forth' },
    ),
    step(
      'hal-s2',
      '“The fourth, the fifth…”: F → G → Am → F',
      seq(
        chord(3, 0, 2, HALLELUJAH_BPM), chord(4, 0, 2, HALLELUJAH_BPM),
        chord(5, 0, 2, HALLELUJAH_BPM), chord(3, 0, 2, HALLELUJAH_BPM),
        chord(3, 0, 2, HALLELUJAH_BPM), chord(4, 0, 2, HALLELUJAH_BPM),
        chord(5, 0, 2, HALLELUJAH_BPM), chord(3, 0, 2, HALLELUJAH_BPM),
      ),
      { hint: 'The lyric names the chords: the fourth (F), the fifth (G), the minor fall (Am)' },
    ),
    step(
      'hal-s3',
      'The full verse',
      seq(
        chord(0, 0, 2, HALLELUJAH_BPM), chord(5, 0, 2, HALLELUJAH_BPM),
        chord(0, 0, 2, HALLELUJAH_BPM), chord(5, 0, 2, HALLELUJAH_BPM),
        chord(3, 0, 2, HALLELUJAH_BPM), chord(4, 0, 2, HALLELUJAH_BPM),
        chord(0, 0, 2, HALLELUJAH_BPM), chord(4, 0, 2, HALLELUJAH_BPM),
      ),
      { hint: 'C Am C Am, then F G C G — let each change breathe', minScore: 65 },
    ),
  ],
  tags: ['song', 'ballad', 'C major'],
};

// ── Wonderwall — Oasis ── A mixolydian (keyOffset 9): Em7(4,7th) G(6) Dsus4(3,sus4) Asus4(0,sus4) ──

const WONDERWALL_BPM = 75;

const wonderwall: Lesson = {
  id: 'song-wonderwall',
  title: 'Wonderwall',
  subtitle: 'Oasis — sevenths and sus chords give it that unresolved shimmer',
  kind: 'song',
  artist: 'Oasis',
  difficulty: 'advanced',
  musicConfig: { keyOffset: 9, scale: 'mixolydian' },
  bpm: WONDERWALL_BPM,
  progression: ['Em7', 'G', 'Dsus4', 'Asus4'],
  steps: [
    step(
      'ww-s1',
      'Colour chords: Em7 → G',
      seq(
        chord(4, 2, 4, WONDERWALL_BPM), chord(6, 0, 4, WONDERWALL_BPM),
        chord(4, 2, 4, WONDERWALL_BPM), chord(6, 0, 4, WONDERWALL_BPM),
      ),
      { hint: 'Right hand on 7th for Em7, back to triad for G — both hands move' },
    ),
    step(
      'ww-s2',
      'The sus sound: Dsus4 → Asus4',
      seq(
        chord(3, 6, 4, WONDERWALL_BPM), chord(0, 6, 4, WONDERWALL_BPM),
        chord(3, 6, 4, WONDERWALL_BPM), chord(0, 6, 4, WONDERWALL_BPM),
      ),
      { hint: 'Park your right hand on sus4 and let the left do the walking' },
    ),
    step(
      'ww-s3',
      '“Today is gonna be the day”',
      seq(
        chord(4, 2, 4, WONDERWALL_BPM), chord(6, 0, 4, WONDERWALL_BPM),
        chord(3, 6, 4, WONDERWALL_BPM), chord(0, 6, 4, WONDERWALL_BPM),
        chord(4, 2, 4, WONDERWALL_BPM), chord(6, 0, 4, WONDERWALL_BPM),
        chord(3, 6, 4, WONDERWALL_BPM), chord(0, 6, 4, WONDERWALL_BPM),
      ),
      { hint: 'The full loop, twice — both wheels working at once', minScore: 65 },
    ),
  ],
  tags: ['song', 'extensions', 'mixolydian'],
};

export const SONGS: Lesson[] = [
  letItBe,
  standByMe,
  riptide,
  someoneLikeYou,
  zombie,
  hallelujah,
  wonderwall,
];
