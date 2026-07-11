import { describe, it, expect } from 'vitest'
import { applyVoiceLeading } from './voiceLeading'

// C major [60,64,67], F major root [65,69,72], G major root [67,71,74]
describe('applyVoiceLeading', () => {
  it('returns root position unchanged when there is no previous chord', () => {
    expect(applyVoiceLeading([60, 64, 67], null)).toEqual([60, 64, 67])
    expect(applyVoiceLeading([60, 64, 67], [])).toEqual([60, 64, 67])
  })

  it('keeps the same voicing when the chord repeats', () => {
    expect(applyVoiceLeading([60, 64, 67], [60, 64, 67])).toEqual([60, 64, 67])
  })

  it('C → F picks the second inversion (common tone C held)', () => {
    // F root [65,69,72] scores 8 total motion from C [60,64,67];
    // 2nd inversion [60,65,69] scores 0+1+2=3 — shares the C.
    expect(applyVoiceLeading([65, 69, 72], [60, 64, 67])).toEqual([60, 65, 69])
  })

  it('C → G picks an inversion instead of jumping the whole chord up', () => {
    const led = applyVoiceLeading([67, 71, 74], [60, 64, 67])
    // Any inversion beats root position's total motion.
    const motion = led.reduce(
      (s, n) => s + Math.min(...[60, 64, 67].map(p => Math.abs(n - p))), 0)
    expect(motion).toBeLessThan(21)
    // Still spells a G major chord (pitch classes G B D).
    expect(new Set(led.map(n => n % 12))).toEqual(new Set([7, 11, 2]))
  })

  it('is stable: re-leading a result against itself returns it unchanged', () => {
    const led = applyVoiceLeading([65, 69, 72], [60, 64, 67])
    expect(applyVoiceLeading([65, 69, 72], led)).toEqual(led)
  })

  it('never lets the bass drift more than an octave from root position', () => {
    // Previous chord two octaves down — clamp must reject candidates that chase it.
    const led = applyVoiceLeading([60, 64, 67], [36, 40, 43])
    expect(Math.abs(led[0] - 60)).toBeLessThanOrEqual(12)
  })

  it('handles 4-note chords (C7 → F picks a near inversion)', () => {
    const led = applyVoiceLeading([65, 69, 72], [60, 64, 67, 70])
    expect(new Set(led.map(n => n % 12))).toEqual(new Set([5, 9, 0]))
    const motion = led.reduce(
      (s, n) => s + Math.min(...[60, 64, 67, 70].map(p => Math.abs(n - p))), 0)
    expect(motion).toBeLessThanOrEqual(3)
  })

  it('handles universal-mode symmetric chords (dim7) without crashing', () => {
    const led = applyVoiceLeading([62, 65, 68, 71], [60, 64, 67])
    expect(led).toHaveLength(4)
    expect(new Set(led.map(n => n % 12))).toEqual(new Set([2, 5, 8, 11]))
  })

  it('returns single notes and empty arrays unchanged', () => {
    expect(applyVoiceLeading([60], [55, 59, 62])).toEqual([60])
    expect(applyVoiceLeading([], [55, 59, 62])).toEqual([])
  })
})
