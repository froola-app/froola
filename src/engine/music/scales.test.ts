import { describe, it, expect } from 'vitest'
import { midiToHz, WARM_MAJOR } from './scales'

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

describe('WARM_MAJOR', () => {
  it('has exactly 4 slots', () => {
    expect(WARM_MAJOR).toHaveLength(4)
  })
  it('starts on Cmaj (tonic)', () => {
    expect(WARM_MAJOR[0].name).toBe('Cmaj')
  })
  it('ends on Cmaj (tonic loop)', () => {
    expect(WARM_MAJOR[3].name).toBe('Cmaj')
  })
  it('has Fmaj at slot 1', () => {
    expect(WARM_MAJOR[1].name).toBe('Fmaj')
  })
  it('has Gmaj at slot 2', () => {
    expect(WARM_MAJOR[2].name).toBe('Gmaj')
  })
  it('all intervals start with 0 (root)', () => {
    WARM_MAJOR.forEach(slot => expect(slot.intervals[0]).toBe(0))
  })
  it('all slots are major triads (intervals [0,4,7])', () => {
    WARM_MAJOR.forEach(slot => expect(slot.intervals).toEqual([0, 4, 7]))
  })
  it('dominant (Gmaj, slot 2) has highest tension', () => {
    expect(WARM_MAJOR[2].tension).toBeGreaterThan(WARM_MAJOR[1].tension)
    expect(WARM_MAJOR[2].tension).toBeGreaterThan(WARM_MAJOR[0].tension)
  })
})
