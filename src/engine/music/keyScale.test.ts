import { describe, it, expect } from 'vitest';
import { scaleNotes, diatonicChord, SCALES } from './keyScale';

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

  it('labels use each of the 7 letters exactly once, spelled diatonically from the tonic', () => {
    const notes = scaleNotes(11, 'major'); // B major — wraps past B back to lower letters
    expect(new Set(notes.map(n => n.label[0]))).toEqual(new Set(['B', 'C', 'D', 'E', 'F', 'G', 'A']));
  });

  it('minor-key scales spell with flats, not enharmonic sharps', () => {
    // C minor: C-D-Eb-F-G-Ab-Bb, not C-D-D#-F-G-G#-A#
    expect(scaleNotes(0, 'minor').map(n => n.label)).toEqual(['C', 'D', 'Eb', 'F', 'G', 'Ab', 'Bb']);
  });

  it('never spells a degree with a double accidental, across every key and scale', () => {
    for (let keyOffset = 0; keyOffset < 12; keyOffset++) {
      for (const scale of Object.keys(SCALES) as (keyof typeof SCALES)[]) {
        for (const note of scaleNotes(keyOffset, scale)) {
          expect(note.label).not.toMatch(/##|bb/);
        }
      }
    }
  });

  it('a key whose tonic is a "black key" still spells cleanly (Eb major, not D#/E#/F##)', () => {
    expect(scaleNotes(3, 'major').map(n => n.label)).toEqual(['Eb', 'F', 'G', 'Ab', 'Bb', 'C', 'D']);
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

  it('sus chords use fixed intervals: root + M2/P4 + P5, regardless of degree', () => {
    // extIdx 5 = sus2, extIdx 6 = sus4
    // Bsus4 in C major: B E F# (perfect 4th + perfect 5th, not diatonic B E F)
    expect(diatonicChord(6, 6, 0, 'major').midis).toEqual([71, 76, 78]);
    expect(diatonicChord(6, 6, 0, 'major').label).toBe('Bsus4');
    // Esus2 in C major: E F# B (major 2nd, not diatonic minor 2nd E F B)
    expect(diatonicChord(2, 5, 0, 'major').midis).toEqual([64, 66, 71]);
    expect(diatonicChord(2, 5, 0, 'major').label).toBe('Esus2');
    // Csus4 / Dsus2 sanity (already correct diatonically, must stay correct)
    expect(diatonicChord(0, 6, 0, 'major').midis).toEqual([60, 65, 67]); // C F G
    expect(diatonicChord(1, 5, 0, 'major').midis).toEqual([62, 64, 69]); // D E A
  });

  it('6th chords add a major 6th above the root, not the diatonic 6th', () => {
    // extIdx 1 = 6th. Am6 in C major: A C E F# — not the diatonic F natural
    // (which would be an Fmaj7 inversion, contradicting the "Am6" label).
    expect(diatonicChord(5, 1, 0, 'major').midis).toEqual([69, 72, 76, 78]);
    expect(diatonicChord(5, 1, 0, 'major').label).toBe('Am6');
    // C6 sanity (already correct diatonically, must stay correct): C E G A
    expect(diatonicChord(0, 1, 0, 'major').midis).toEqual([60, 64, 67, 69]);
  });

  it('9th and add9 chords add a major 9th above the root, not the diatonic 9th', () => {
    // extIdx 3 = 9th, extIdx 4 = add9. Em9 in C major: E G B D F# — not the
    // diatonic F natural (a b9 clash a semitone above the root).
    expect(diatonicChord(2, 3, 0, 'major').midis).toEqual([64, 67, 71, 74, 78]);
    expect(diatonicChord(2, 3, 0, 'major').label).toBe('Em9');
    // Em(add9): E G B F#
    expect(diatonicChord(2, 4, 0, 'major').midis).toEqual([64, 67, 71, 78]);
    // C9 sanity (already correct diatonically): C E G B D
    expect(diatonicChord(0, 3, 0, 'major').midis).toEqual([60, 64, 67, 71, 74]);
  });

  it('octave shifts the whole chord by 12 semitones', () => {
    const base = diatonicChord(0, 0, 0, 'major').midis;
    const up = diatonicChord(0, 0, 0, 'major', 1).midis;
    expect(up).toEqual(base.map(m => m + 12));
  });
});
