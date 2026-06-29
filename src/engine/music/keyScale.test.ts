import { describe, it, expect } from 'vitest';
import { scaleNotes, SCALES, KEYS } from './keyScale';

describe('scaleNotes', () => {
  it('default C major reproduces the original wheel (C5 ascending)', () => {
    const notes = scaleNotes(0, 'major');
    expect(notes.map(n => n.label)).toEqual(['C', 'D', 'E', 'F', 'G', 'A', 'B']);
    expect(notes.map(n => n.midi)).toEqual([72, 74, 76, 77, 79, 81, 83]);
  });

  it('transposes by key offset (G major = +7 semitones)', () => {
    const notes = scaleNotes(7, 'major');
    expect(notes[0]).toEqual({ label: 'G', midi: 79 });
    // tonic + perfect fifth (D) is the 5th degree
    expect(notes[4].label).toBe('D');
  });

  it('minor scale lowers the 3rd, 6th and 7th', () => {
    const major = scaleNotes(0, 'major');
    const minor = scaleNotes(0, 'minor');
    expect(minor[2].midi).toBe(major[2].midi - 1); // E -> Eb
    expect(minor[5].midi).toBe(major[5].midi - 1); // A -> Ab
    expect(minor[6].midi).toBe(major[6].midi - 1); // B -> Bb
  });

  it('every scale has exactly 7 degrees (matches the 7-slice wheel)', () => {
    for (const intervals of Object.values(SCALES)) {
      expect(intervals).toHaveLength(7);
    }
  });

  it('labels wrap within the 12 pitch classes', () => {
    const notes = scaleNotes(11, 'major'); // B major — wraps past B back to lower letters
    for (const n of notes) expect(KEYS).toContain(n.label);
  });
});
