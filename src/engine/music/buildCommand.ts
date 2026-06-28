import type { NoteName, ChordQuality, MusicalCommand } from '../types';
import { NOTES, QUALITIES } from '../types';

// A4–B4 then C5–G5 so the wheel ascends in pitch without a large drop at C.
const NOTE_MIDI: Record<NoteName, number> = {
  A: 69, B: 71, C: 72, D: 74, E: 76, F: 77, G: 79,
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

export function buildCommand(noteIdx: number, qualIdx: number, y: number): MusicalCommand {
  const note = NOTES[noteIdx % NOTES.length];
  const quality = QUALITIES[qualIdx % QUALITIES.length];
  const rootMidi = NOTE_MIDI[note];
  const intervals = QUALITY_INTERVALS[quality];
  // Shift only in whole octaves so the note class always matches the dial label.
  // Top third of screen → +1 oct, bottom third → -1 oct, middle → exact.
  const octave = y < 0.33 ? 1 : y > 0.67 ? -1 : 0;
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
