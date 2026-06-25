import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mockAudioContext } from '../test-utils/webAudioMock'
import { createMapper } from './music'
import { AudioEngine } from './audio'
import type { GestureSignal } from './types'

beforeEach(() => {
  vi.clearAllMocks()
})

describe('Track A pipeline: gesture → audio', () => {
  it('a gesture crossing a zone boundary triggers a play() call', () => {
    const engine = new AudioEngine()
    const map = createMapper('warm')

    const playspy = vi.spyOn(engine, 'play')

    const zone0: GestureSignal = { x: 0.1, y: 0.5, present: true, handId: 'primary' }
    const zone1: GestureSignal = { x: 0.4, y: 0.5, present: true, handId: 'primary' }

    const cmd0 = map(zone0)
    if (cmd0) engine.play(cmd0)

    const cmd1 = map(zone1)
    if (cmd1) engine.play(cmd1)

    expect(playspy).toHaveBeenCalledTimes(2)
  })

  it('a gesture staying in the same zone triggers no play() call', () => {
    const engine = new AudioEngine()
    const map = createMapper('warm')
    const playspy = vi.spyOn(engine, 'play')

    const zone0a: GestureSignal = { x: 0.1, y: 0.5, present: true, handId: 'primary' }
    const zone0b: GestureSignal = { x: 0.12, y: 0.5, present: true, handId: 'primary' }

    const cmd0 = map(zone0a)
    if (cmd0) engine.play(cmd0)
    const cmd1 = map(zone0b)
    if (cmd1) engine.play(cmd1)

    expect(playspy).toHaveBeenCalledTimes(1) // only the first call
  })

  it('sweeping I→IV→V→I fires 4 play() calls with correct chords', () => {
    const engine = new AudioEngine()
    const map = createMapper('warm')
    const chords: string[] = []

    const xs = [0.1, 0.375, 0.625, 0.9]
    xs.forEach(x => {
      const cmd = map({ x, y: 0.5, present: true, handId: 'primary' })
      if (cmd) {
        engine.play(cmd)
        chords.push(cmd.chord)
      }
    })

    expect(chords).toEqual(['Cmaj', 'Fmaj', 'Gmaj', 'Cmaj'])
  })

  it('frequency ramps are scheduled for each chord in the sweep', () => {
    const engine = new AudioEngine()
    const map = createMapper('warm')

    const xs = [0.1, 0.375, 0.625, 0.9]
    xs.forEach(x => {
      const cmd = map({ x, y: 0.5, present: true, handId: 'primary' })
      if (cmd) engine.play(cmd)
    })

    // 4 chords × 3 voices = 12 frequency ramps total
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const totalRamps = (mockAudioContext.createOscillator.mock.results as any[]).reduce(
      (sum: number, r: { value: { frequency: { linearRampToValueAtTime: ReturnType<typeof vi.fn> } } }) =>
        sum + r.value.frequency.linearRampToValueAtTime.mock.calls.length,
      0
    )
    expect(totalRamps).toBe(12)
  })
})
