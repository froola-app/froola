import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ChordLooper, MAX_SLOTS, DEFAULT_BPM, type LooperState } from './ChordLooper'
import { TempoClock, type StepCallback, type TempoClockOptions } from '../audio'
import type { MusicalCommand } from '../types'

// Minimal command — only `chord`/`voicing` matter to the looper.
function cmd(label: string): MusicalCommand {
  return {
    chord: label, voicing: [60, 64, 67], register: 0.5, texture: 0.5,
    tension: 0.5, rootNote: label[0], chordQuality: 'triad',
  }
}

// A controllable audio clock we advance by hand.
function harness() {
  const audio = { currentTime: 0 }
  const played: { label: string; when: number }[] = []
  let silenceCount = 0
  let lastState: LooperState | null = null
  const looper = new ChordLooper({
    createClock: (cb: StepCallback, opts?: TempoClockOptions) => new TempoClock(audio, cb, opts),
    playAt: (c, when) => played.push({ label: c.chord, when }),
    silence: () => { silenceCount++ },
    onChange: s => { lastState = s },
  })
  return {
    audio, played, looper,
    get silenceCount() { return silenceCount },
    get state() { return lastState },
  }
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('ChordLooper — slot editing', () => {
  it('appends chords and reports labels in order', () => {
    const h = harness()
    h.looper.add(cmd('C'))
    h.looper.add(cmd('F'))
    expect(h.looper.length).toBe(2)
    expect(h.looper.getState().slots).toEqual(['C', 'F'])
  })

  it('caps the loop at MAX_SLOTS', () => {
    const h = harness()
    for (let i = 0; i < MAX_SLOTS; i++) expect(h.looper.add(cmd(`c${i}`))).toBe(true)
    expect(h.looper.add(cmd('overflow'))).toBe(false)
    expect(h.looper.length).toBe(MAX_SLOTS)
  })

  it('undo removes the last slot; clear empties', () => {
    const h = harness()
    h.looper.add(cmd('C')); h.looper.add(cmd('F'))
    h.looper.undo()
    expect(h.looper.getState().slots).toEqual(['C'])
    h.looper.clear()
    expect(h.looper.length).toBe(0)
  })

  it('clear also resets bpm to the default', () => {
    const h = harness()
    h.looper.add(cmd('C'))
    h.looper.setBpm(160)
    expect(h.looper.getBpm()).toBe(160)
    h.looper.clear()
    expect(h.looper.getBpm()).toBe(DEFAULT_BPM)
    expect(h.state?.bpm).toBe(DEFAULT_BPM)
  })

  it('notifies onChange for edits', () => {
    const h = harness()
    h.looper.add(cmd('C'))
    expect(h.state?.slots).toEqual(['C'])
  })
})

describe('ChordLooper — tempo', () => {
  it('defaults to DEFAULT_BPM and clamps setBpm', () => {
    const h = harness()
    expect(h.looper.getBpm()).toBe(DEFAULT_BPM)
    h.looper.setBpm(9999)
    expect(h.looper.getBpm()).toBe(300)
    h.looper.setBpm(1)
    expect(h.looper.getBpm()).toBe(30)
  })
})

describe('ChordLooper — beats per chord', () => {
  it('defaults to 4 beats per chord and reports it in state', () => {
    const h = harness()
    expect(h.looper.getBeatsPerSlot()).toBe(4)
    h.looper.add(cmd('C'))
    expect(h.state?.beatsPerSlot).toBe(4)
  })

  it('clamps setBeatsPerSlot to whole beats within 1–4', () => {
    const h = harness()
    h.looper.setBeatsPerSlot(0)
    expect(h.looper.getBeatsPerSlot()).toBe(1)
    h.looper.setBeatsPerSlot(9)
    expect(h.looper.getBeatsPerSlot()).toBe(4)
    h.looper.setBeatsPerSlot(2)
    expect(h.looper.getBeatsPerSlot()).toBe(2)
  })

  it('advances one chord per beat when beatsPerSlot is 1', () => {
    const h = harness()
    h.looper.add(cmd('C')); h.looper.add(cmd('F')); h.looper.add(cmd('G'))
    h.looper.setBpm(60) // 1 beat = 1s
    h.looper.setBeatsPerSlot(1)
    h.looper.start()
    h.audio.currentTime = 4
    vi.advanceTimersByTime(25)
    expect(h.played).toEqual([
      { label: 'C', when: 0 },
      { label: 'F', when: 1 },
      { label: 'G', when: 2 },
      { label: 'C', when: 3 },
      { label: 'F', when: 4 },
    ])
  })

  it('clear resets beatsPerSlot to the default', () => {
    const h = harness()
    h.looper.setBeatsPerSlot(1)
    h.looper.clear()
    expect(h.looper.getBeatsPerSlot()).toBe(4)
  })
})

describe('ChordLooper — playback', () => {
  it('does nothing on start when empty', () => {
    const h = harness()
    h.looper.start()
    expect(h.looper.playing).toBe(false)
    expect(h.played).toHaveLength(0)
  })

  it('steps through slots one bar apart and cycles', () => {
    const h = harness()
    h.looper.add(cmd('C')); h.looper.add(cmd('F')); h.looper.add(cmd('G'))
    h.looper.setBpm(60) // stepDuration 1s; 1 bar = 4 beats = 4s per slot
    h.looper.start()
    expect(h.looper.playing).toBe(true)
    expect(h.played).toEqual([{ label: 'C', when: 0 }]) // slot 0 at t=0

    // Advance ~2 loop cycles worth of bars and let the scheduler catch up.
    h.audio.currentTime = 16
    vi.advanceTimersByTime(25)

    // Bars land at 0,4,8,12,16 → C,F,G,C,F
    expect(h.played).toEqual([
      { label: 'C', when: 0 },
      { label: 'F', when: 4 },
      { label: 'G', when: 8 },
      { label: 'C', when: 12 },
      { label: 'F', when: 16 },
    ])
  })

  it('tracks the current slot in state', () => {
    const h = harness()
    h.looper.add(cmd('C')); h.looper.add(cmd('F'))
    h.looper.setBpm(60)
    h.looper.start()
    expect(h.state?.currentSlot).toBe(0)
    h.audio.currentTime = 4
    vi.advanceTimersByTime(25)
    expect(h.state?.currentSlot).toBe(1)
  })

  it('stop silences, resets, and halts further steps', () => {
    const h = harness()
    h.looper.add(cmd('C')); h.looper.add(cmd('F'))
    h.looper.setBpm(60)
    h.looper.start()
    const beforeStop = h.played.length
    h.looper.stop()
    expect(h.looper.playing).toBe(false)
    expect(h.state?.currentSlot).toBe(-1)
    expect(h.silenceCount).toBe(1)
    h.audio.currentTime = 20
    vi.advanceTimersByTime(100)
    expect(h.played.length).toBe(beforeStop) // no steps after stop
  })

  it('clearing while playing stops playback', () => {
    const h = harness()
    h.looper.add(cmd('C'))
    h.looper.setBpm(60)
    h.looper.start()
    expect(h.looper.playing).toBe(true)
    h.looper.clear()
    expect(h.looper.playing).toBe(false)
    expect(h.silenceCount).toBe(1)
  })

  it('undo emptying the loop while playing stops playback', () => {
    const h = harness()
    h.looper.add(cmd('C'))
    h.looper.setBpm(60)
    h.looper.start()
    h.looper.undo()
    expect(h.looper.length).toBe(0)
    expect(h.looper.playing).toBe(false)
  })
})

describe('ChordLooper — slot serialization', () => {
  it('round-trips slots through getSlots/load', () => {
    const h1 = harness()
    h1.looper.add(cmd('Cmaj7'))
    h1.looper.add(cmd('Am'))
    h1.looper.setBpm(120)
    h1.looper.setBeatsPerSlot(2)

    const h2 = harness()
    h2.looper.load({ bpm: h1.looper.getBpm(), beatsPerSlot: h1.looper.getBeatsPerSlot(), slots: h1.looper.getSlots() })
    expect(h2.looper.getState().slots).toEqual(['Cmaj7', 'Am'])
    expect(h2.looper.getBpm()).toBe(120)
    expect(h2.looper.getBeatsPerSlot()).toBe(2)
  })

  it('load stops playback and truncates past MAX_SLOTS', () => {
    const h = harness()
    h.looper.add(cmd('C'))
    h.looper.start()
    const nine = Array.from({ length: 9 }, (_, i) => cmd(`X${i}`))
    h.looper.load({ bpm: 90, beatsPerSlot: 4, slots: nine })
    expect(h.looper.playing).toBe(false)
    expect(h.looper.getState().slots).toHaveLength(8) // MAX_SLOTS
  })
})
