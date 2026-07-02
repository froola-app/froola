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
export const KEYS = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// C4 — base register; octave 0 plays from C4, +1 from C5, etc.
const TONIC_MIDI = 60;

export type ScaleNote = { label: string; midi: number };

export type MusicConfig = { keyOffset: number; scale: ScaleName };

export const DEFAULT_MUSIC: MusicConfig = { keyOffset: 0, scale: 'major' };

/** The 7 wheel notes (label + root MIDI) for a given key offset and scale.
 *  `scaleNotes(0, 'major')` reproduces the original C-major wheel exactly. */
export function scaleNotes(keyOffset: number, scale: ScaleName): ScaleNote[] {
  return SCALES[scale].map(interval => ({
    label: KEYS[(keyOffset + interval) % 12],
    midi: TONIC_MIDI + keyOffset + interval,
  }));
}

// The right wheel picks an *extension*; the chord's major/minor/dim quality
// comes from the scale degree (diatonic harmony). `steps` are scale-degree
// offsets from the root degree (so they bend with the scale automatically).
export type Extension = { id: string; label: string; suffix: string; steps: number[] };

export const EXTENSIONS: Extension[] = [
  { id: 'triad', label: 'triad', suffix: '',     steps: [0, 2, 4] },
  { id: '6th',   label: '6th',   suffix: '6',    steps: [0, 2, 4, 5] },
  { id: '7th',   label: '7th',   suffix: '7',    steps: [0, 2, 4, 6] },
  { id: '9th',   label: '9th',   suffix: '9',    steps: [0, 2, 4, 6, 8] },
  { id: 'add9',  label: 'add9',  suffix: 'add9', steps: [0, 2, 4, 8] },
  { id: 'sus2',  label: 'sus2',  suffix: 'sus2', steps: [0, 1, 4] },
  { id: 'sus4',  label: 'sus4',  suffix: 'sus4', steps: [0, 3, 4] },
];

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
): Chord {
  const iv = SCALES[scale];
  const n = iv.length;
  const ext = EXTENSIONS[((extIdx % EXTENSIONS.length) + EXTENSIONS.length) % EXTENSIONS.length];
  const base = TONIC_MIDI + keyOffset + octave * 12;
  // Semitones of scale position p above the tonic, wrapping octaves past degree n-1.
  const tone = (p: number) => iv[((p % n) + n) % n] + 12 * Math.floor(p / n);

  const midis = ext.steps.map(step => base + tone(degree + step));

  const rootLabel = KEYS[(keyOffset + iv[((degree % n) + n) % n] + 1200) % 12];
  const third = tone(degree + 2) - tone(degree);
  const fifth = tone(degree + 4) - tone(degree);
  let q = '';
  if (third === 3 && fifth === 6) q = '°';
  else if (third === 4 && fifth === 8) q = '+';
  else if (third === 3) q = 'm';
  const isSus = ext.id === 'sus2' || ext.id === 'sus4';
  const label = isSus ? `${rootLabel}${ext.suffix}` : `${rootLabel}${q}${ext.suffix}`;

  return { midis, label, rootLabel };
}
