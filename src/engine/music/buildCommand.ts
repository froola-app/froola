import type { MusicalCommand } from '../types';
import { diatonicChord, degreeRootMidi, DEFAULT_MUSIC, EXTENSIONS, type MusicConfig } from './keyScale';

// Melody note for the latch solo — the degree's root, one octave above the pad.
export function melodyMidi(noteIdx: number, music: MusicConfig = DEFAULT_MUSIC): number {
  return degreeRootMidi(noteIdx, music.keyOffset, music.scale) + 12;
}

export function buildCommand(
  noteIdx: number,
  qualIdx: number,
  y: number,
  octave = 0,
  music: MusicConfig = DEFAULT_MUSIC,
): MusicalCommand {
  // The left wheel picks the scale degree (chord root + its diatonic quality);
  // the right wheel picks an extension on top.
  const chord = diatonicChord(noteIdx, qualIdx, music.keyOffset, music.scale, octave);
  return {
    chord: chord.label,
    voicing: chord.midis,
    register: y,
    texture: 0.5,
    tension: 0.5,
    rootNote: chord.rootLabel,
    chordQuality: EXTENSIONS[qualIdx % EXTENSIONS.length].id,
  };
}
