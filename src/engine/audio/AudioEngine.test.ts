import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mockAudioContext } from '../../test-utils/webAudioMock'
import { AudioEngine } from './AudioEngine'
import { midiToHz } from '../music/scales'
import type { MusicalCommand } from '../types'

vi.mock('soundfont-player', () => ({
  default: { instrument: vi.fn(() => Promise.resolve({ play: vi.fn(), stop: vi.fn() })) },
}))

// chord gain (0.2) spread over its 5 voices (soundgo used 4; we use 5 so a
// 9th chord's top note isn't dropped)
const SYNTH_VOICE_GAIN = 0.2 / 5

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
  it('creates 6 oscillators (5-voice chord pad + 1 melody lead)', () => {
    new AudioEngine()
    expect(mockAudioContext.createOscillator).toHaveBeenCalledTimes(6)
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
    // 5 pad voices + 1 melody lead, each panned.
    expect(mockAudioContext.createStereoPanner).toHaveBeenCalledTimes(6)
    const padDetunes = mockAudioContext.createOscillator.mock.results.slice(0, 5).map(r => r.value.detune.value)
    const padPans = mockAudioContext.createStereoPanner.mock.results.slice(0, 5).map(r => r.value.pan.value)
    expect(new Set(padDetunes).size).toBe(5)
    expect(new Set(padPans).size).toBe(5)
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
  it('glides frequency for all five pad oscillators', () => {
    const engine = new AudioEngine()
    engine.play(CMD)
    mockAudioContext.createOscillator.mock.results.slice(0, 5).forEach(r => {
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

  it('pads a 3-note triad up to 5 voices by doubling root then 5th (open voicing)', () => {
    const engine = new AudioEngine()
    // voicing [60, 64, 67] (root/3rd/5th) → 4th voice = root + 12 = 72,
    // 5th voice = 5th + 12 = 79 — doubling the 5th (not the 3rd) keeps it from
    // being buried under two roots and one 3rd.
    engine.play(CMD)
    const lastHz = (idx: number) => {
      const calls = mockAudioContext.createOscillator.mock.results[idx].value.frequency.linearRampToValueAtTime.mock.calls
      return calls[calls.length - 1][0]
    }
    expect(lastHz(3)).toBeCloseTo(midiToHz(72), 1)
    expect(lastHz(4)).toBeCloseTo(midiToHz(79), 1)
  })

  // Regression: a 9th chord has 5 notes; it must not be truncated down to the
  // 7th's 4 notes — the 9th (top note) has to actually sound.
  it('sounds all five notes of a 9th chord, including the 9th', () => {
    const engine = new AudioEngine()
    const ninth = [60, 64, 67, 71, 74] // C E G B D — the 74 is the 9th
    engine.play({ ...CMD, voicing: ninth })
    const lastHz = (idx: number) => {
      const calls = mockAudioContext.createOscillator.mock.results[idx].value.frequency.linearRampToValueAtTime.mock.calls
      return calls[calls.length - 1][0]
    }
    ninth.forEach((midi, i) => expect(lastHz(i)).toBeCloseTo(midiToHz(midi), 1))
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

  it('targets per-voice gain of 0.2 / 5 = 0.04', () => {
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
  // The melody lead is the 6th oscillator (after the 5 pad voices).
  const melodyOsc = () => mockAudioContext.createOscillator.mock.results[5].value

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

describe('AudioEngine — playNoteAt()', () => {
  const melodyOsc = () => mockAudioContext.createOscillator.mock.results[5].value

  it('schedules the melody oscillator pitch and gain attack at the given time', () => {
    const engine = new AudioEngine()
    engine.playNoteAt(69, 5) // A4 at t=5
    const call = melodyOsc().frequency.setValueAtTime.mock.calls.at(-1)
    expect(call?.[0]).toBeCloseTo(440, 1)
    expect(call?.[1]).toBe(5)
    const attackRamp = mockAudioContext.createGain.mock.results
      .flatMap(r => r.value.gain.linearRampToValueAtTime.mock.calls)
      .some(([val, time]: [number, number]) => val > 0.1 && val < 0.2 && time === 5 + 0.012)
    expect(attackRamp).toBe(true)
  })

  it('does not retrigger the chord pad', () => {
    const engine = new AudioEngine()
    engine.playNoteAt(72, 3)
    mockAudioContext.createOscillator.mock.results.slice(0, 4).forEach(r => {
      expect(r.value.frequency.setValueAtTime).not.toHaveBeenCalled()
    })
  })

  it('plucks the note — schedules a decay back toward 0 after the attack', () => {
    const engine = new AudioEngine()
    engine.playNoteAt(69, 5, 1) // 1s step
    const decay = mockAudioContext.createGain.mock.results
      .flatMap(r => r.value.gain.setTargetAtTime.mock.calls)
      .find(([val, time]: [number, number]) => val === 0 && time > 5)
    expect(decay).toBeDefined()
  })
})

describe('AudioEngine — setPadDuck()', () => {
  it('ducks the pad bus while the arp runs and restores it after', () => {
    const engine = new AudioEngine()
    const allRamps = () => mockAudioContext.createGain.mock.results
      .flatMap(r => r.value.gain.linearRampToValueAtTime.mock.calls)

    engine.setPadDuck(true)
    expect(allRamps().some(([val]: [number]) => val > 0 && val < 0.5)).toBe(true)

    engine.setPadDuck(false)
    expect(allRamps().some(([val]: [number]) => val === 1)).toBe(true)
  })

  it('does not touch the melody lead gain', () => {
    const engine = new AudioEngine()
    engine.playNoteAt(60, 1, 0.5)
    const melodyGain = mockAudioContext.createGain.mock.results.at(-1)!.value
    const before = melodyGain.gain.linearRampToValueAtTime.mock.calls.length
    engine.setPadDuck(true)
    expect(melodyGain.gain.linearRampToValueAtTime.mock.calls.length).toBe(before)
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

describe('AudioEngine — sampler loading', () => {
  it('reports the piano sampler as not ready until it finishes loading', async () => {
    const engine = new AudioEngine()
    expect(engine.isSamplerReady('piano')).toBe(false)
    engine.startLoadingSampler('piano')
    expect(engine.isSamplerReady('piano')).toBe(false)
    await vi.waitFor(() => expect(engine.isSamplerReady('piano')).toBe(true))
  })
})
