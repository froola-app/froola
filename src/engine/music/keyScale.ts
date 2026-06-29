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

// C5 — keeps the original default register (C-major from C5 ascending).
const TONIC_MIDI = 72;

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
