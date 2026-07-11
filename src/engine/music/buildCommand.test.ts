import { describe, it, expect } from 'vitest';
import { melodyMidi } from './buildCommand';
import { NOTES } from '../types';

describe('melodyMidi', () => {
  it('plays the wheel note one octave above the chord register', () => {
    // NOTES[0] is C, mapped to MIDI 60 (C4) for the chord — melody is an octave up.
    expect(melodyMidi(0)).toBe(72); // C5
  });

  it('stays an octave above the chord register for every slice', () => {
    // Chord roots live at MIDI 60..71, so every melody note sits in 72..83.
    NOTES.forEach((_, i) => {
      expect(melodyMidi(i)).toBeGreaterThanOrEqual(72);
      expect(melodyMidi(i)).toBeLessThanOrEqual(83);
    });
  });

  it('wraps the index modulo the wheel length', () => {
    expect(melodyMidi(NOTES.length)).toBe(melodyMidi(0));
  });
});

describe('buildCommand — chord mode', () => {
  it('universal mode applies fixed qualities from the right wheel', async () => {
    const { buildCommand } = await import('./buildCommand');
    // Degree 1 (D in C major) + slice 1: diatonically a 6th chord on Dm;
    // universally a plain D minor triad.
    const uni = buildCommand(1, 1, 0.5, 0, { keyOffset: 0, scale: 'major', chordMode: 'universal' });
    expect(uni.voicing).toEqual([62, 65, 69]);
    expect(uni.chord).toBe('Dm');
    expect(uni.chordQuality).toBe('min');
  });

  it('defaults to diatonic extensions when chordMode is omitted', async () => {
    const { buildCommand } = await import('./buildCommand');
    const cmd = buildCommand(1, 0, 0.5, 0, { keyOffset: 0, scale: 'major' });
    expect(cmd.chord).toBe('Dm');
    expect(cmd.chordQuality).toBe('triad');
  });
});
