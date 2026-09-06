import { describe, it, expect } from 'vitest'
import { midiToHz } from './scales'

describe('midiToHz', () => {
  it('converts A4 (MIDI 69) to 440 Hz', () => {
    expect(midiToHz(69)).toBeCloseTo(440, 2)
  })
  it('converts C4 (MIDI 60) to 261.63 Hz', () => {
    expect(midiToHz(60)).toBeCloseTo(261.63, 1)
  })
  it('doubles frequency each octave', () => {
    expect(midiToHz(81)).toBeCloseTo(midiToHz(69) * 2, 2)
  })
})
