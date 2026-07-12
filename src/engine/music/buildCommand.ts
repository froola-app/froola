import type { MusicalCommand } from '../types';
import { wheelChord, wheelNotes, degreeRootMidi, DEFAULT_MUSIC, chordSet, type MusicConfig } from './keyScale';

// Melody note for the latch solo — the selected slice's root, one octave above the pad.
export function melodyMidi(noteIdx: number, music: MusicConfig = DEFAULT_MUSIC): number {
  if (music.customWheel) {
    const notes = wheelNotes(music);
    return notes[((noteIdx % notes.length) + notes.length) % notes.length].midi + 12;
  }
  return degreeRootMidi(noteIdx, music.keyOffset, music.scale) + 12;
}

export function buildCommand(
  noteIdx: number,
  qualIdx: number,
  y: number,
  octave = 0,
  music: MusicConfig = DEFAULT_MUSIC,
): MusicalCommand {
  // The left wheel picks the slice (diatonic degree, or a custom-wheel chord);
  // the right wheel picks an extension on top — or, in universal chord mode,
  // a fixed quality (maj/min/7/…) applied straight to the root.
  const chord = wheelChord(noteIdx, qualIdx, music, octave);
  const set = chordSet(music.chordMode);
  return {
    chord: chord.label,
    voicing: chord.midis,
    register: y,
    texture: 0.5,
    tension: 0.5,
    rootNote: chord.rootLabel,
    chordQuality: set[qualIdx % set.length].id,
  };
}
