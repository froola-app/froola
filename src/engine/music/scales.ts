export type ChordSlot = {
  name: string
  rootMidi: number
  intervals: [0, number, number]
  tension: number
}

export const WARM_MAJOR: ChordSlot[] = [
  { name: 'Cmaj', rootMidi: 60, intervals: [0, 4, 7], tension: 0.0 },
  { name: 'Fmaj', rootMidi: 65, intervals: [0, 4, 7], tension: 0.3 },
  { name: 'Gmaj', rootMidi: 67, intervals: [0, 4, 7], tension: 0.6 },
  { name: 'Cmaj', rootMidi: 60, intervals: [0, 4, 7], tension: 0.0 },
]

export function midiToHz(midi: number): number {
  return 440 * Math.pow(2, (midi - 69) / 12)
}
