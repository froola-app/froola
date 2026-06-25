import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mockAudioContext } from '../../test-utils/webAudioMock'
import { AudioEngine } from './AudioEngine'
import type { MusicalCommand } from '../types'

const CMD: MusicalCommand = {
  chord: 'Cmaj',
  voicing: [60, 64, 67],
  register: 0.5,
  texture: 0.5,
  tension: 0.0,
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('AudioEngine — construction', () => {
  it('creates exactly 3 oscillators', () => {
    new AudioEngine()
    expect(mockAudioContext.createOscillator).toHaveBeenCalledTimes(3)
  })
  it('starts all 3 oscillators', () => {
    new AudioEngine()
    mockAudioContext.createOscillator.mock.results.forEach(r => {
      expect(r.value.start).toHaveBeenCalledTimes(1)
    })
  })
  it('sets all oscillators to sine type', () => {
    new AudioEngine()
    mockAudioContext.createOscillator.mock.results.forEach(r => {
      expect(r.value.type).toBe('sine')
    })
  })
  it('creates an analyser with fftSize 256', () => {
    new AudioEngine()
    expect(mockAudioContext.createAnalyser).toHaveBeenCalledTimes(1)
    const analyser = mockAudioContext.createAnalyser.mock.results[0].value
    expect(analyser.fftSize).toBe(256)
  })
  it('creates a dynamics compressor', () => {
    new AudioEngine()
    expect(mockAudioContext.createDynamicsCompressor).toHaveBeenCalledTimes(1)
  })
})

describe('AudioEngine — play()', () => {
  it('ramps frequency for all 3 oscillators', () => {
    const engine = new AudioEngine()
    engine.play(CMD)
    mockAudioContext.createOscillator.mock.results.forEach(r => {
      expect(r.value.frequency.linearRampToValueAtTime).toHaveBeenCalledTimes(1)
    })
  })

  it('ramps gain for all 3 voice gain nodes', () => {
    const engine = new AudioEngine()
    engine.play(CMD)
    // Voice gain nodes (not the master gain) each get a ramp
    const gainRampCalls = mockAudioContext.createGain.mock.results
      .map(r => r.value.gain.linearRampToValueAtTime.mock.calls.length)
    // At least 3 of the gain nodes (the voice gains) must have been ramped
    const ramped = gainRampCalls.filter(n => n > 0)
    expect(ramped.length).toBeGreaterThanOrEqual(3)
  })

  it('targets 440 Hz for MIDI 69 (A4)', () => {
    const engine = new AudioEngine()
    engine.play({ ...CMD, voicing: [69, 73, 76] })
    const firstOsc = mockAudioContext.createOscillator.mock.results[0].value
    const [targetHz] = firstOsc.frequency.linearRampToValueAtTime.mock.calls[0]
    expect(targetHz).toBeCloseTo(440, 1)
  })

  it('targets ~261.63 Hz for MIDI 60 (C4)', () => {
    const engine = new AudioEngine()
    engine.play(CMD)
    const firstOsc = mockAudioContext.createOscillator.mock.results[0].value
    const [targetHz] = firstOsc.frequency.linearRampToValueAtTime.mock.calls[0]
    expect(targetHz).toBeCloseTo(261.63, 1)
  })

  it('ramp end time is currentTime + 0.012s', () => {
    const engine = new AudioEngine()
    engine.play(CMD)
    const firstOsc = mockAudioContext.createOscillator.mock.results[0].value
    const [, endTime] = firstOsc.frequency.linearRampToValueAtTime.mock.calls[0]
    expect(endTime).toBeCloseTo(mockAudioContext.currentTime + 0.012, 5)
  })

  it('targets per-voice gain of 0.7 / 3 ≈ 0.233', () => {
    const engine = new AudioEngine()
    engine.play(CMD)
    const allGainRamps = mockAudioContext.createGain.mock.results.flatMap(r =>
      r.value.gain.linearRampToValueAtTime.mock.calls
    )
    const hasCorrectGain = allGainRamps.some(
      ([val]: [number]) => Math.abs(val - 0.7 / 3) < 0.001
    )
    expect(hasCorrectGain).toBe(true)
  })
})

describe('AudioEngine — getAnalyser()', () => {
  it('returns the AnalyserNode created at construction', () => {
    const engine = new AudioEngine()
    const analyser = engine.getAnalyser()
    expect(analyser).toBe(mockAudioContext.createAnalyser.mock.results[0].value)
  })
})

describe('AudioEngine — resume() / suspend()', () => {
  it('calls ctx.resume() when state is suspended', () => {
    const engine = new AudioEngine()
    engine.resume()
    expect(mockAudioContext.resume).toHaveBeenCalledTimes(1)
  })
  it('calls ctx.suspend() on suspend()', () => {
    const engine = new AudioEngine()
    engine.suspend()
    expect(mockAudioContext.suspend).toHaveBeenCalledTimes(1)
  })
})
