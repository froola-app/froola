import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mockAudioContext } from '../../test-utils/webAudioMock'
import { AudioEngine } from './AudioEngine'
import { midiToHz } from '../music/scales'
import type { MusicalCommand } from '../types'

// soundgo chord gain (0.2) spread over its 4 voices
const SYNTH_VOICE_GAIN = 0.2 / 4

const CMD: MusicalCommand = {
  chord: 'Cmaj',
  voicing: [60, 64, 67],
  register: 0.5,
  texture: 0.5,
  tension: 0.0,
  rootNote: 'C',
  chordQuality: 'major',
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('AudioEngine — construction', () => {
  it('creates 5 oscillators (4-voice chord pad + 1 melody lead)', () => {
    new AudioEngine()
    expect(mockAudioContext.createOscillator).toHaveBeenCalledTimes(5)
  })
  it('starts all oscillators', () => {
    new AudioEngine()
    mockAudioContext.createOscillator.mock.results.forEach(r => {
      expect(r.value.start).toHaveBeenCalledTimes(1)
    })
  })
  it('sets all oscillators to triangle type', () => {
    new AudioEngine()
    mockAudioContext.createOscillator.mock.results.forEach(r => {
      expect(r.value.type).toBe('triangle')
    })
  })
  it('creates a lowpass synth filter at 1800 Hz (soundgo chord filter)', () => {
    new AudioEngine()
    expect(mockAudioContext.createBiquadFilter).toHaveBeenCalledTimes(1)
    const filter = mockAudioContext.createBiquadFilter.mock.results[0].value
    expect(filter.type).toBe('lowpass')
    expect(filter.frequency.value).toBe(1800)
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
  it('gives each pad voice a distinct detune and stereo pan for width', () => {
    new AudioEngine()
    // 4 pad voices + 1 melody lead, each panned.
    expect(mockAudioContext.createStereoPanner).toHaveBeenCalledTimes(5)
    const padDetunes = mockAudioContext.createOscillator.mock.results.slice(0, 4).map(r => r.value.detune.value)
    const padPans = mockAudioContext.createStereoPanner.mock.results.slice(0, 4).map(r => r.value.pan.value)
    expect(new Set(padDetunes).size).toBe(4)
    expect(new Set(padPans).size).toBe(4)
  })
  it('creates a convolver reverb with an impulse buffer', () => {
    new AudioEngine()
    expect(mockAudioContext.createConvolver).toHaveBeenCalledTimes(1)
    const convolver = mockAudioContext.createConvolver.mock.results[0].value
    expect(convolver.buffer).not.toBeNull()
  })
})

describe('AudioEngine — play()', () => {
  // soundgo glides notes to pitch (rampTo 0.12s) rather than jumping instantly.
  it('glides frequency for all four pad oscillators', () => {
    const engine = new AudioEngine()
    engine.play(CMD)
    mockAudioContext.createOscillator.mock.results.slice(0, 4).forEach(r => {
      expect(r.value.frequency.linearRampToValueAtTime).toHaveBeenCalled()
    })
  })

  it('ramps gain for all voice gain nodes', () => {
    const engine = new AudioEngine()
    engine.play(CMD)
    const gainRampCalls = mockAudioContext.createGain.mock.results
      .map(r => r.value.gain.linearRampToValueAtTime.mock.calls.length)
    const ramped = gainRampCalls.filter(n => n > 0)
    expect(ramped.length).toBeGreaterThanOrEqual(4)
  })

  it('glides to 440 Hz for MIDI 69 (A4)', () => {
    const engine = new AudioEngine()
    engine.play({ ...CMD, voicing: [69, 73, 76] })
    const firstOsc = mockAudioContext.createOscillator.mock.results[0].value
    const calls = firstOsc.frequency.linearRampToValueAtTime.mock.calls
    const targetHz = calls[calls.length - 1][0]
    expect(targetHz).toBeCloseTo(440, 1)
  })

  it('glides to ~261.63 Hz for MIDI 60 (C4)', () => {
    const engine = new AudioEngine()
    engine.play(CMD)
    const firstOsc = mockAudioContext.createOscillator.mock.results[0].value
    const calls = firstOsc.frequency.linearRampToValueAtTime.mock.calls
    const targetHz = calls[calls.length - 1][0]
    expect(targetHz).toBeCloseTo(261.63, 1)
  })

  it('pads a 3-note triad to a 4th octave voice (soundgo voicing)', () => {
    const engine = new AudioEngine()
    engine.play(CMD) // voicing [60, 64, 67] → 4th voice = 60 + 12 = 72
    const fourthOsc = mockAudioContext.createOscillator.mock.results[3].value
    const calls = fourthOsc.frequency.linearRampToValueAtTime.mock.calls
    const targetHz = calls[calls.length - 1][0]
    expect(targetHz).toBeCloseTo(midiToHz(72), 1)
  })

  it('gain ramp end time is currentTime + 0.06s (soundgo chord ramp)', () => {
    const engine = new AudioEngine()
    engine.play(CMD)
    const allGainRamps = mockAudioContext.createGain.mock.results.flatMap(r =>
      r.value.gain.linearRampToValueAtTime.mock.calls
    )
    const endTime = allGainRamps.find(([val]: [number]) => Math.abs(val - SYNTH_VOICE_GAIN) < 0.001)?.[1]
    expect(endTime).toBeCloseTo(mockAudioContext.currentTime + 0.06, 5)
  })

  it('targets soundgo per-voice gain of 0.2 / 4 = 0.05', () => {
    const engine = new AudioEngine()
    engine.play(CMD)
    const allGainRamps = mockAudioContext.createGain.mock.results.flatMap(r =>
      r.value.gain.linearRampToValueAtTime.mock.calls
    )
    const hasCorrectGain = allGainRamps.some(
      ([val]: [number]) => Math.abs(val - SYNTH_VOICE_GAIN) < 0.001
    )
    expect(hasCorrectGain).toBe(true)
  })
})

describe('AudioEngine — playMelody() / silenceMelody()', () => {
  // The melody lead is the 5th oscillator (after the 4 pad voices).
  const melodyOsc = () => mockAudioContext.createOscillator.mock.results[4].value

  it('sets the melody oscillator pitch and raises its gain', () => {
    const engine = new AudioEngine()
    engine.playMelody(69) // A4
    const hz = melodyOsc().frequency.setValueAtTime.mock.calls.at(-1)?.[0]
    expect(hz).toBeCloseTo(440, 1)
    const melodyGainRamp = mockAudioContext.createGain.mock.results
      .flatMap(r => r.value.gain.linearRampToValueAtTime.mock.calls)
      .some(([val]: [number]) => val > 0.1 && val < 0.2)
    expect(melodyGainRamp).toBe(true)
  })

  it('does not retrigger the chord pad when playing a melody note', () => {
    const engine = new AudioEngine()
    engine.playMelody(72)
    // The 4 pad oscillators get no frequency changes from a melody note.
    mockAudioContext.createOscillator.mock.results.slice(0, 4).forEach(r => {
      expect(r.value.frequency.setValueAtTime).not.toHaveBeenCalled()
    })
  })

  it('silenceMelody ramps the melody gain to 0', () => {
    const engine = new AudioEngine()
    engine.playMelody(72)
    engine.silenceMelody()
    const zeroRamp = mockAudioContext.createGain.mock.results
      .flatMap(r => r.value.gain.linearRampToValueAtTime.mock.calls)
      .some(([val]: [number]) => val === 0)
    expect(zeroRamp).toBe(true)
  })
})

describe('AudioEngine — getAnalyser()', () => {
  it('returns the AnalyserNode created at construction', () => {
    const engine = new AudioEngine()
    const analyser = engine.getAnalyser()
    expect(analyser).toBe(mockAudioContext.createAnalyser.mock.results[0].value)
  })
})

describe('AudioEngine — silence()', () => {
  it('ramps all voice gains to 0', () => {
    const engine = new AudioEngine()
    engine.play(CMD)
    engine.silence()
    const zeroRamps = mockAudioContext.createGain.mock.results.flatMap(r =>
      r.value.gain.linearRampToValueAtTime.mock.calls
    ).filter(([val]: [number]) => val === 0)
    expect(zeroRamps.length).toBeGreaterThanOrEqual(3)
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

describe('AudioEngine — setVolume', () => {
  it('ramps masterGain to clamped value over 80ms', () => {
    const engine = new AudioEngine()
    const gainNode = mockAudioContext.createGain.mock.results[0].value
    engine.setVolume(0.5)
    expect(gainNode.gain.linearRampToValueAtTime).toHaveBeenCalledWith(
      0.5,
      expect.any(Number),
    )
  })

  it('clamps volume above 1.0 to 1.0', () => {
    const engine = new AudioEngine()
    const gainNode = mockAudioContext.createGain.mock.results[0].value
    engine.setVolume(1.5)
    expect(gainNode.gain.linearRampToValueAtTime).toHaveBeenCalledWith(
      1.0,
      expect.any(Number),
    )
  })

  it('clamps volume below 0.0 to 0.0', () => {
    const engine = new AudioEngine()
    const gainNode = mockAudioContext.createGain.mock.results[0].value
    engine.setVolume(-0.2)
    expect(gainNode.gain.linearRampToValueAtTime).toHaveBeenCalledWith(
      0.0,
      expect.any(Number),
    )
  })
})
