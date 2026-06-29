import type { NoteName, ChordQuality, MusicalCommand } from '../types';
import { NOTES, QUALITIES } from '../types';

// C-major scale ascending from C5 so the wheel rises in pitch from the top (C) clockwise.
const NOTE_MIDI: Record<NoteName, number> = {
  C: 72, D: 74, E: 76, F: 77, G: 79, A: 81, B: 83,
};

const QUALITY_INTERVALS: Record<ChordQuality, [0, number, number]> = {
  major: [0, 4, 7],
  minor: [0, 3, 7],
  maj7:  [0, 4, 11],
  min7:  [0, 3, 10],
  dom7:  [0, 4, 10],
  aug:   [0, 4, 8],
  dim:   [0, 3, 6],
};

const QUALITY_TENSION: Record<ChordQuality, number> = {
  major: 0.0, minor: 0.2, maj7: 0.3, min7: 0.4, dom7: 0.6, aug: 0.8, dim: 1.0,
};

// MIDI note for a melody line played from the note wheel — one octave above the
// chord register so it sits clearly over the held pad.
export function melodyMidi(noteIdx: number): number {
  const note = NOTES[noteIdx % NOTES.length];
  return NOTE_MIDI[note] + 12;
}

export function buildCommand(
  noteIdx: number,
  qualIdx: number,
  y: number,
  octave = 0,
): MusicalCommand {
  const note = NOTES[noteIdx % NOTES.length];
  const quality = QUALITIES[qualIdx % QUALITIES.length];
  const rootMidi = NOTE_MIDI[note];
  const intervals = QUALITY_INTERVALS[quality];
  // Each octave step shifts the whole voicing by 12 semitones.
  const offset = octave * 12;
  return {
    chord: `${note}${quality}`,
    voicing: intervals.map(i => rootMidi + i + offset),
    register: y,
    texture: 0.5,
    tension: QUALITY_TENSION[quality],
    rootNote: note,
    chordQuality: quality,
  };
}
