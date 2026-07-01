import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { TempoClock, MIN_BPM, MAX_BPM, type ClockStep } from './TempoClock'

// A controllable stand-in for AudioContext — we advance `currentTime` by hand.
function fakeClock(t = 0) {
  return { currentTime: t }
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('TempoClock — configuration', () => {
  it('defaults to 90 bpm', () => {
    const c = new TempoClock(fakeClock(), () => {})
    expect(c.getBpm()).toBe(90)
  })

  it('clamps bpm into [MIN_BPM, MAX_BPM]', () => {
    const lo = new TempoClock(fakeClock(), () => {}, { bpm: 5 })
    const hi = new TempoClock(fakeClock(), () => {}, { bpm: 9999 })
    expect(lo.getBpm()).toBe(MIN_BPM)
    expect(hi.getBpm()).toBe(MAX_BPM)
  })

  it('computes stepDuration from bpm and stepsPerBeat', () => {
    expect(new TempoClock(fakeClock(), () => {}, { bpm: 120, stepsPerBeat: 4 }).stepDuration).toBeCloseTo(0.125, 6)
    expect(new TempoClock(fakeClock(), () => {}, { bpm: 60, stepsPerBeat: 1 }).stepDuration).toBeCloseTo(1.0, 6)
  })
})

describe('TempoClock — scheduling', () => {
  it('front-loads every step within the lookahead window on start', () => {
    const steps: ClockStep[] = []
    // stepDuration = 60/150/4 = 0.1s; window 0.25s → steps at 0, 0.1, 0.2
    const c = new TempoClock(fakeClock(0), e => steps.push(e), {
      bpm: 150, stepsPerBeat: 4, scheduleAheadSec: 0.25,
    })
    c.start()
    expect(steps.map(s => s.step)).toEqual([0, 1, 2])
    expect(steps.map(s => s.time)).toEqual([0, 0.1, 0.2].map(t => expect.closeTo(t, 6)))
  })

  it('schedules later steps as the audio clock advances', () => {
    const steps: ClockStep[] = []
    const clock = fakeClock(0)
    // stepDuration 1.0s, window 0.1s → one step per second
    const c = new TempoClock(clock, e => steps.push(e), {
      bpm: 60, stepsPerBeat: 1, lookaheadMs: 25, scheduleAheadSec: 0.1,
    })
    c.start()
    expect(steps.map(s => s.step)).toEqual([0])

    clock.currentTime = 1.0
    vi.advanceTimersByTime(25)
    expect(steps.map(s => s.step)).toEqual([0, 1])
    expect(steps[1].time).toBeCloseTo(1.0, 6)

    clock.currentTime = 2.0
    vi.advanceTimersByTime(25)
    expect(steps.map(s => s.step)).toEqual([0, 1, 2])
    expect(steps[2].time).toBeCloseTo(2.0, 6)
  })

  it('keeps step times on a steady grid regardless of when the timer fires', () => {
    const steps: ClockStep[] = []
    const clock = fakeClock(0)
    const c = new TempoClock(clock, e => steps.push(e), {
      bpm: 60, stepsPerBeat: 1, lookaheadMs: 25, scheduleAheadSec: 0.1,
    })
    c.start()
    // Jump the clock forward past several steps at once — all missed steps get
    // scheduled, each on the exact 1.0s grid (no drift from the coarse timer).
    clock.currentTime = 3.0
    vi.advanceTimersByTime(25)
    expect(steps.map(s => s.time)).toEqual([0, 1, 2, 3].map(t => expect.closeTo(t, 6)))
  })

  it('retimes remaining steps when bpm changes mid-run', () => {
    const steps: ClockStep[] = []
    const clock = fakeClock(0)
    const c = new TempoClock(clock, e => steps.push(e), {
      bpm: 60, stepsPerBeat: 1, lookaheadMs: 25, scheduleAheadSec: 0.1,
    })
    c.start() // step 0 @ 0, next at 1.0
    c.setBpm(120) // now stepDuration 0.5s
    clock.currentTime = 1.0
    vi.advanceTimersByTime(25)
    // step 1 fires at its already-set 1.0; step 2 uses the new 0.5s gap → 1.5
    clock.currentTime = 1.5
    vi.advanceTimersByTime(25)
    expect(steps.find(s => s.step === 1)?.time).toBeCloseTo(1.0, 6)
    expect(steps.find(s => s.step === 2)?.time).toBeCloseTo(1.5, 6)
  })
})

describe('TempoClock — lifecycle', () => {
  it('reports running state and stop halts scheduling', () => {
    const steps: ClockStep[] = []
    const clock = fakeClock(0)
    const c = new TempoClock(clock, e => steps.push(e), {
      bpm: 60, stepsPerBeat: 1, scheduleAheadSec: 0.1,
    })
    expect(c.running).toBe(false)
    c.start()
    expect(c.running).toBe(true)
    const countAfterStart = steps.length
    c.stop()
    expect(c.running).toBe(false)
    clock.currentTime = 5.0
    vi.advanceTimersByTime(100)
    expect(steps.length).toBe(countAfterStart) // no new steps after stop
  })

  it('start is idempotent while running (no second interval / step reset)', () => {
    const steps: ClockStep[] = []
    const clock = fakeClock(0)
    const c = new TempoClock(clock, e => steps.push(e), {
      bpm: 60, stepsPerBeat: 1, scheduleAheadSec: 0.1,
    })
    c.start()
    c.start() // no-op
    clock.currentTime = 1.0
    vi.advanceTimersByTime(25)
    expect(steps.map(s => s.step)).toEqual([0, 1]) // monotonic, not restarted
  })

  it('restarts from step 0 after a stop', () => {
    const steps: ClockStep[] = []
    const clock = fakeClock(0)
    const c = new TempoClock(clock, e => steps.push(e), {
      bpm: 60, stepsPerBeat: 1, scheduleAheadSec: 0.1,
    })
    c.start()
    c.stop()
    clock.currentTime = 10.0
    c.start()
    expect(steps.at(-1)?.step).toBe(0)
    expect(steps.at(-1)?.time).toBeCloseTo(10.0, 6)
  })
})
