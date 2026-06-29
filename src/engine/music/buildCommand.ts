import type { ChordQuality, MusicalCommand } from '../types';
import { QUALITIES } from '../types';
import { scaleNotes, type ScaleNote } from './keyScale';

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

// Default wheel = C major from C5, matching the original hardcoded behaviour.
const DEFAULT_NOTES = scaleNotes(0, 'major');

// MIDI note for a melody line played from the note wheel — one octave above the
// chord register so it sits clearly over the held pad.
export function melodyMidi(noteIdx: number, notes: ScaleNote[] = DEFAULT_NOTES): number {
  return notes[noteIdx % notes.length].midi + 12;
}

export function buildCommand(
  noteIdx: number,
  qualIdx: number,
  y: number,
  octave = 0,
  notes: ScaleNote[] = DEFAULT_NOTES,
): MusicalCommand {
  const quality = QUALITIES[qualIdx % QUALITIES.length];
  const root = notes[noteIdx % notes.length];
  const intervals = QUALITY_INTERVALS[quality];
  // Each octave step shifts the whole voicing by 12 semitones.
  const offset = octave * 12;
  return {
    chord: `${root.label}${quality}`,
    voicing: intervals.map(i => root.midi + i + offset),
    register: y,
    texture: 0.5,
    tension: QUALITY_TENSION[quality],
    rootNote: root.label,
    chordQuality: quality,
  };
}
