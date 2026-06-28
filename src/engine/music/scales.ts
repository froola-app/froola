import type { NoteName, ChordQuality } from '../types'

export type ChordSlot = {
  name: string
  rootNote: NoteName
  rootMidi: number
  intervals: [0, number, number]
  tension: number
  chordQuality: ChordQuality
}

export const WARM_MAJOR: ChordSlot[] = [
  { name: 'Cmaj', rootNote: 'C', rootMidi: 60, intervals: [0, 4, 7], tension: 0.0, chordQuality: 'major' },
  { name: 'Fmaj', rootNote: 'F', rootMidi: 65, intervals: [0, 4, 7], tension: 0.3, chordQuality: 'major' },
  { name: 'Gmaj', rootNote: 'G', rootMidi: 67, intervals: [0, 4, 7], tension: 0.6, chordQuality: 'major' },
  { name: 'Cmaj', rootNote: 'C', rootMidi: 60, intervals: [0, 4, 7], tension: 0.0, chordQuality: 'major' },
]

export function midiToHz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12)
}
