import { describe, it, expect } from 'vitest';
import { melodyMidi } from './buildCommand';
import { NOTES } from '../types';

describe('melodyMidi', () => {
  it('plays the wheel note one octave above the chord register', () => {
    // NOTES[0] is C, mapped to MIDI 72 (C5) for the chord — melody is an octave up.
    expect(melodyMidi(0)).toBe(84); // C6
  });

  it('stays an octave above the chord register for every slice', () => {
    // Chord roots live at MIDI 72..83, so every melody note sits in 84..95.
    NOTES.forEach((_, i) => {
      expect(melodyMidi(i)).toBeGreaterThanOrEqual(84);
      expect(melodyMidi(i)).toBeLessThanOrEqual(95);
    });
  });

  it('wraps the index modulo the wheel length', () => {
    expect(melodyMidi(NOTES.length)).toBe(melodyMidi(0));
  });
});
