import { describe, it, expect } from 'vitest';
import { scaleNotes, diatonicChord, SCALES, KEYS } from './keyScale';

describe('scaleNotes', () => {
  it('default C major reproduces the wheel (C4 ascending)', () => {
    const notes = scaleNotes(0, 'major');
    expect(notes.map(n => n.label)).toEqual(['C', 'D', 'E', 'F', 'G', 'A', 'B']);
    expect(notes.map(n => n.midi)).toEqual([60, 62, 64, 65, 67, 69, 71]);
  });

  it('transposes by key offset (G major = +7 semitones)', () => {
    const notes = scaleNotes(7, 'major');
    expect(notes[0]).toEqual({ label: 'G', midi: 67 });
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

describe('diatonicChord — quality follows the scale degree', () => {
  it('C major: I is major, ii is minor, vii is diminished', () => {
    expect(diatonicChord(0, 0, 0, 'major').midis).toEqual([60, 64, 67]); // C E G
    expect(diatonicChord(0, 0, 0, 'major').label).toBe('C');
    expect(diatonicChord(1, 0, 0, 'major').label).toBe('Dm');           // D F A
    expect(diatonicChord(6, 0, 0, 'major').label).toBe('B°');           // B D F
  });

  it('the SAME degree flips major↔minor when the scale changes (the mood)', () => {
    expect(diatonicChord(0, 0, 0, 'major').midis).toEqual([60, 64, 67]); // C major
    expect(diatonicChord(0, 0, 0, 'minor').midis).toEqual([60, 63, 67]); // C minor (Eb)
    expect(diatonicChord(0, 0, 0, 'minor').label).toBe('Cm');
  });

  it('extensions stack scale tones (7th adds the diatonic 7th)', () => {
    // G dominant 7th = degree 4 (G) + 7th in C major: G B D F
    expect(diatonicChord(4, 2, 0, 'major').midis).toEqual([67, 71, 74, 77]);
    expect(diatonicChord(4, 2, 0, 'major').label).toBe('G7');
  });

  it('octave shifts the whole chord by 12 semitones', () => {
    const base = diatonicChord(0, 0, 0, 'major').midis;
    const up = diatonicChord(0, 0, 0, 'major', 1).midis;
    expect(up).toEqual(base.map(m => m + 12));
  });
});
