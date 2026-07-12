import { describe, it, expect } from 'vitest';
import {
  scaleNotes,
  diatonicChord,
  SCALES,
  wheelChord,
  wheelNotes,
  diatonicSlices,
  type WheelSlice,
  type CustomWheel,
  type MusicConfig,
} from './keyScale';

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

describe('diatonicChord — universal chord mode', () => {
  it('applies fixed qualities regardless of the scale degree', () => {
    // Degree 1 in C major is D minor diatonically; universal maj forces D major.
    const c = diatonicChord(1, 0, 0, 'major', 0, 'universal');
    expect(c.midis).toEqual([62, 66, 69]);
    expect(c.label).toBe('D');
  });

  it('offers minor, dom7, maj7, min7, dim7, and aug on the wheel', () => {
    expect(diatonicChord(0, 1, 0, 'major', 0, 'universal').midis).toEqual([60, 63, 67]); // Cm
    expect(diatonicChord(0, 1, 0, 'major', 0, 'universal').label).toBe('Cm');
    expect(diatonicChord(0, 2, 0, 'major', 0, 'universal').midis).toEqual([60, 64, 67, 70]); // C7
    expect(diatonicChord(0, 3, 0, 'major', 0, 'universal').midis).toEqual([60, 64, 67, 71]); // Cmaj7
    expect(diatonicChord(0, 4, 0, 'major', 0, 'universal').midis).toEqual([60, 63, 67, 70]); // Cm7
    expect(diatonicChord(0, 5, 0, 'major', 0, 'universal').midis).toEqual([60, 63, 66, 69]); // C°7
    expect(diatonicChord(0, 5, 0, 'major', 0, 'universal').label).toBe('C°7');
    expect(diatonicChord(0, 6, 0, 'major', 0, 'universal').midis).toEqual([60, 64, 68]); // C+
  });

  it('universal roots still follow the key and scale', () => {
    // Degree 2 in A minor (keyOffset 9) = C; universal min7 → Cm7.
    const c = diatonicChord(2, 4, 9, 'minor', -1, 'universal');
    expect(c.midis).toEqual([60, 63, 67, 70]);
    expect(c.label).toBe('Cm7');
  });

  it('defaults to diatonic mode when no mode is given', () => {
    expect(diatonicChord(1, 0, 0, 'major').midis).toEqual(diatonicChord(1, 0, 0, 'major', 0, 'diatonic').midis);
  });
});

describe('lydian', () => {
  it('spells C lydian with a raised 4th', () => {
    expect(scaleNotes(0, 'lydian').map(n => n.label)).toEqual(['C', 'D', 'E', 'F#', 'G', 'A', 'B']);
  });

  it('makes degree IV the diminished triad', () => {
    // F#–A–C: lydian's raised 4th puts the diminished triad on IV
    const chord = diatonicChord(3, 0, 0, 'lydian');
    expect(chord.midis).toEqual([66, 69, 72]);
    expect(chord.label).toBe('F#°');
  });
});

describe('sounded chord names', () => {
  // extIdx 2 = '7th', extIdx 3 = '9th' (EXTENSIONS order)
  it('names the 7th chords of C major by their sounded quality', () => {
    const labels = [0, 1, 2, 3, 4, 5, 6].map(d => diatonicChord(d, 2, 0, 'major').label);
    expect(labels).toEqual(['Cmaj7', 'Dm7', 'Em7', 'Fmaj7', 'G7', 'Am7', 'Bm7♭5']);
  });

  it('names G in D major (degree IV) Gmaj7, not G7', () => {
    expect(diatonicChord(3, 2, 2, 'major').label).toBe('Gmaj7');
  });

  it('names 9th chords by their sounded seventh', () => {
    expect(diatonicChord(0, 3, 0, 'major').label).toBe('Cmaj9');
    expect(diatonicChord(1, 3, 0, 'major').label).toBe('Dm9');
    expect(diatonicChord(4, 3, 0, 'major').label).toBe('G9');
  });

  it('names minor-key 7ths correctly', () => {
    expect(diatonicChord(0, 2, 0, 'minor').label).toBe('Cm7');   // i7
    expect(diatonicChord(2, 2, 0, 'minor').label).toBe('Ebmaj7'); // III maj7
  });

  it('leaves triads, 6ths, add9 and sus labels unchanged', () => {
    expect(diatonicChord(5, 0, 0, 'major').label).toBe('Am');
    expect(diatonicChord(5, 1, 0, 'major').label).toBe('Am6');
    expect(diatonicChord(0, 4, 0, 'major').label).toBe('Cadd9');
    expect(diatonicChord(0, 5, 0, 'major').label).toBe('Csus2');
  });
});

describe('custom wheels', () => {
  const III: WheelSlice = { interval: 4, quality: 'maj' };
  const wheel: CustomWheel = {
    id: 'w1',
    name: 'pop',
    slices: [
      { interval: 0, quality: 'maj' },  // I
      { interval: 2, quality: 'min' },  // ii
      III,                              // III (the iii→III case)
      { interval: 5, quality: 'maj' },  // IV
      { interval: 7, quality: 'maj' },  // V
      { interval: 9, quality: 'min' },  // vi
      { interval: 10, quality: 'maj' }, // bVII (borrowed)
    ],
  };
  const music: MusicConfig = { keyOffset: 0, scale: 'major', customWheel: wheel };

  it('plays the custom triad on a slice (III in C = E major)', () => {
    const chord = wheelChord(2, 0, music);
    expect(chord.midis).toEqual([64, 68, 71]); // E G# B
    expect(chord.label).toBe('E');
  });

  it('transposes with the key (III in D = F# major)', () => {
    const chord = wheelChord(2, 0, { ...music, keyOffset: 2 });
    expect(chord.midis).toEqual([66, 70, 73]); // F# A# C#
    expect(chord.label).toBe('F#');
  });

  it('stacks extensions on the custom quality (7th on maj → dominant)', () => {
    expect(wheelChord(2, 2, music).midis).toEqual([64, 68, 71, 74]); // E7
    expect(wheelChord(2, 2, music).label).toBe('E7');
    expect(wheelChord(1, 2, music).label).toBe('Dm7');
  });

  it('handles borrowed roots (bVII in C = Bb)', () => {
    const chord = wheelChord(6, 0, music);
    expect(chord.midis).toEqual([70, 74, 77]);
    expect(chord.rootLabel).toBe('A#'); // sharp fallback spelling, matches KEYS
  });

  it('wheelNotes shows the custom roots; falls back to scaleNotes without a wheel', () => {
    expect(wheelNotes(music).map(n => n.midi)).toEqual([60, 62, 64, 65, 67, 69, 70]);
    expect(wheelNotes({ keyOffset: 0, scale: 'major' }).map(n => n.label))
      .toEqual(scaleNotes(0, 'major').map(n => n.label));
  });

  it('universal chord mode ignores the custom wheel', () => {
    const uni: MusicConfig = { ...music, chordMode: 'universal' };
    expect(wheelChord(2, 0, uni).label).toBe(diatonicChord(2, 0, 0, 'major', 0, 'universal').label);
  });

  it('diatonicSlices reproduces the diatonic wheel', () => {
    const slices = diatonicSlices('major');
    expect(slices[2]).toEqual({ interval: 4, quality: 'min' }); // iii
    expect(slices[6]).toEqual({ interval: 11, quality: 'dim' }); // vii°
  });
});
