// Key + scale system for the note wheel. The wheel has 7 slices, so every scale
// here is a 7-note (heptatonic) scale: slice index = scale degree.

export type ScaleName = 'major' | 'minor' | 'dorian' | 'mixolydian';

// Semitone offsets of each degree from the tonic.
export const SCALES: Record<ScaleName, number[]> = {
  major:      [0, 2, 4, 5, 7, 9, 11],
  minor:      [0, 2, 3, 5, 7, 8, 10],
  dorian:     [0, 2, 3, 5, 7, 9, 10],
  mixolydian: [0, 2, 4, 5, 7, 9, 10],
};

export const SCALE_NAMES = Object.keys(SCALES) as ScaleName[];

// Pitch-class names; index doubles as the semitone offset above C used for `keyOffset`.
// Tonic spelling only (used to pick the key's starting letter) — always natural or
// single-sharp. Individual scale degrees are spelled diatonically from that tonic
// letter (see `degreeLabel`) so e.g. C minor reads C-D-Eb-F-G-Ab-Bb, not C-D-D#-...
export const KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const NATURAL_SEMITONE: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

// C4 — base register; octave 0 plays from C4, +1 from C5, etc.
const TONIC_MIDI = 60;

export type ScaleNote = { label: string; midi: number };

// What the right wheel offers: 'diatonic' = extensions on the degree's own
// in-key quality (triad/6th/7th/…); 'universal' = fixed textbook qualities
// (maj/min/7/maj7/m7/dim7/aug) applied to the selected root, key be damned.
export type ChordMode = 'diatonic' | 'universal';

export type MusicConfig = { keyOffset: number; scale: ScaleName; chordMode?: ChordMode };

export const DEFAULT_MUSIC: MusicConfig = { keyOffset: 0, scale: 'major' };

// Signed semitone distance from `pitchClass` to `letter`'s natural pitch,
// normalized to [-6, 6] (0 = natural, ±1 = single accidental, ±2 = double, ...).
function accidentalFor(letter: string, pitchClass: number): number {
  const diff = ((pitchClass - NATURAL_SEMITONE[letter] + 6 + 120) % 12) - 6;
  return diff === -6 ? 6 : diff; // keep the tritone case on one consistent side
}

// Pick which of the 7 letters should spell the scale's tonic. C is unambiguous
// (natural). The 5 "black key" pitch classes alias two letters a semitone apart
// (e.g. keyOffset 3 = D# or Eb) — trying both and keeping whichever spells the
// *whole* scale without a double accidental is what keeps Eb major as Eb-F-G-Ab-Bb-C-D
// instead of D#-E#-F##-G#-A#-B#-C## (mathematically equivalent, unreadable).
function pickTonicLetter(keyOffset: number, scale: ScaleName): string {
  const candidates = LETTERS.filter(letter => Math.abs(accidentalFor(letter, ((keyOffset % 12) + 12) % 12)) <= 1);
  const worstAccidental = (tonicLetter: string) =>
    Math.max(...SCALES[scale].map((interval, degree) => {
      const letter = LETTERS[(LETTERS.indexOf(tonicLetter) + degree) % 7];
      const target = ((keyOffset + interval) % 12 + 12) % 12;
      return Math.abs(accidentalFor(letter, target));
    }));
  // Prefer whichever candidate keeps every degree to a single accidental; on a
  // genuine tie (e.g. F#/Gb, both clean) keep the sharp spelling already used
  // for the tonic elsewhere in the app (KEYS is sharp-only).
  return candidates.reduce((best, candidate) =>
    worstAccidental(candidate) < worstAccidental(best) ? candidate : best
  );
}

// Spell scale degree `degreeInScale` (0-6) diatonically: advance one letter per
// degree from the scale's tonic letter, then pick the accidental that lands on
// `targetPitchClass`.
function spellDegree(keyOffset: number, scale: ScaleName, degreeInScale: number, targetPitchClass: number): string {
  const tonicLetter = pickTonicLetter(keyOffset, scale);
  const letter = LETTERS[(LETTERS.indexOf(tonicLetter) + degreeInScale) % 7];
  const diff = accidentalFor(letter, targetPitchClass);
  const symbol = diff === 0 ? '' : diff > 0 ? '#'.repeat(diff) : 'b'.repeat(-diff);
  return letter + symbol;
}

/** The 7 wheel notes (label + root MIDI) for a given key offset and scale.
 *  `scaleNotes(0, 'major')` reproduces the original C-major wheel exactly. */
export function scaleNotes(keyOffset: number, scale: ScaleName): ScaleNote[] {
  return SCALES[scale].map((interval, degree) => ({
    label: spellDegree(keyOffset, scale, degree, ((keyOffset + interval) % 12 + 12) % 12),
    midi: TONIC_MIDI + keyOffset + interval,
  }));
}

// The right wheel picks an *extension*; the chord's major/minor/dim quality
// comes from the scale degree (diatonic harmony). `steps` are scale-degree
// offsets from the root degree (so they bend with the scale automatically).
// Tones above the 7th are the exception: chord structure fixes them in
// semitones from the root (6 = M6, 9 = M9), whatever the scale would give —
// otherwise e.g. Am6 in C major would sound the diatonic F natural (an Fmaj7
// inversion) and Em9 a b9 clash. Those carry `addSemitones` on top of the
// diatonic `steps`. Sus chords go further: sus2/sus4 replace the whole stack
// with fixed `semitones` (root + M2/P4 + P5).
export type Extension = {
  id: string;
  label: string;
  suffix: string;
  steps?: number[];
  addSemitones?: number[];
  semitones?: number[];
};

export const EXTENSIONS: Extension[] = [
  { id: 'triad', label: 'triad', suffix: '',     steps: [0, 2, 4] },
  { id: '6th',   label: '6th',   suffix: '6',    steps: [0, 2, 4], addSemitones: [9] },
  { id: '7th',   label: '7th',   suffix: '7',    steps: [0, 2, 4, 6] },
  { id: '9th',   label: '9th',   suffix: '9',    steps: [0, 2, 4, 6], addSemitones: [14] },
  { id: 'add9',  label: 'add9',  suffix: 'add9', steps: [0, 2, 4], addSemitones: [14] },
  { id: 'sus2',  label: 'sus2',  suffix: 'sus2', semitones: [0, 2, 7] },
  { id: 'sus4',  label: 'sus4',  suffix: 'sus4', semitones: [0, 5, 7] },
];

// 'universal' chord mode: the right wheel picks a fixed quality in semitones
// from the selected root instead of a diatonic extension. Same 7-slice count
// as EXTENSIONS so both modes share the wheel geometry.
export const UNIVERSAL_CHORDS: Extension[] = [
  { id: 'maj',  label: 'maj',  suffix: '',     semitones: [0, 4, 7] },
  { id: 'min',  label: 'min',  suffix: 'm',    semitones: [0, 3, 7] },
  { id: 'dom7', label: '7th',  suffix: '7',    semitones: [0, 4, 7, 10] },
  { id: 'maj7', label: 'maj7', suffix: 'maj7', semitones: [0, 4, 7, 11] },
  { id: 'min7', label: 'min7', suffix: 'm7',   semitones: [0, 3, 7, 10] },
  { id: 'dim7', label: 'dim7', suffix: '°7',   semitones: [0, 3, 6, 9] },
  { id: 'aug',  label: 'aug',  suffix: '+',    semitones: [0, 4, 8] },
];

/** The right wheel's chord set for a given mode. */
export function chordSet(mode: ChordMode = 'diatonic'): Extension[] {
  return mode === 'universal' ? UNIVERSAL_CHORDS : EXTENSIONS;
}

// Root MIDI of a scale degree (used by the melody lead).
export function degreeRootMidi(degree: number, keyOffset: number, scale: ScaleName): number {
  const iv = SCALES[scale];
  const n = iv.length;
  const d = ((degree % n) + n) % n;
  return TONIC_MIDI + keyOffset + iv[d];
}

export type Chord = { midis: number[]; label: string; rootLabel: string };

// Build the diatonic chord for `degree` + `extIdx` in the given key/scale.
// The triad quality (maj/min/dim/aug) falls out of the scale's own intervals.
export function diatonicChord(
  degree: number,
  extIdx: number,
  keyOffset: number,
  scale: ScaleName,
  octave = 0,
  mode: ChordMode = 'diatonic',
): Chord {
  const iv = SCALES[scale];
  const n = iv.length;
  const set = chordSet(mode);
  const ext = set[((extIdx % set.length) + set.length) % set.length];
  const base = TONIC_MIDI + keyOffset + octave * 12;
  // Semitones of scale position p above the tonic, wrapping octaves past degree n-1.
  const tone = (p: number) => iv[((p % n) + n) % n] + 12 * Math.floor(p / n);

  const root = base + tone(degree);
  const midis = ext.semitones
    ? ext.semitones.map(s => root + s)
    : [
        ...ext.steps!.map(step => base + tone(degree + step)),
        ...(ext.addSemitones ?? []).map(s => root + s),
      ];

  const degreeInScale = ((degree % n) + n) % n;
  const rootLabel = spellDegree(keyOffset, scale, degreeInScale, ((keyOffset + iv[degreeInScale]) % 12 + 12) % 12);
  const third = tone(degree + 2) - tone(degree);
  const fifth = tone(degree + 4) - tone(degree);
  let q = '';
  if (third === 3 && fifth === 6) q = '°';
  else if (third === 4 && fifth === 8) q = '+';
  else if (third === 3) q = 'm';
  // Fixed-interval chords (sus + all universal qualities) carry their whole
  // identity in the suffix — the degree's diatonic quality doesn't apply.
  const label = ext.semitones ? `${rootLabel}${ext.suffix}` : `${rootLabel}${q}${ext.suffix}`;

  return { midis, label, rootLabel };
}
