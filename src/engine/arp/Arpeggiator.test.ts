import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { Arpeggiator, type ArpState } from './Arpeggiator'
import { TempoClock, type StepCallback, type TempoClockOptions } from '../audio'

// A controllable audio clock we advance by hand.
function harness() {
  const audio = { currentTime: 0 }
  const played: { midi: number; when: number }[] = []
  let silenceCount = 0
  let lastState: ArpState | null = null
  const arp = new Arpeggiator({
    createClock: (cb: StepCallback, opts?: TempoClockOptions) => new TempoClock(audio, cb, opts),
    playNoteAt: (midi, when) => { played.push({ midi, when }) },
    silence: () => { silenceCount++ },
    onChange: s => { lastState = s },
  })
  return {
    audio, played, arp,
    get silenceCount() { return silenceCount },
    get state() { return lastState },
  }
}

beforeEach(() => vi.useFakeTimers())
afterEach(() => vi.useRealTimers())

describe('Arpeggiator — playback', () => {
  it('does nothing on start when the chord is empty', () => {
    const h = harness()
    h.arp.start()
    expect(h.arp.running).toBe(true) // clock still runs, just has no notes to play
    expect(h.played).toHaveLength(0)
  })

  it('cycles through the voicing one note per step', () => {
    const h = harness()
    h.arp.setChord([60, 64, 67])
    h.arp.setRate(60) // stepDuration 1s at 1 step/beat
    h.arp.start()
    expect(h.played).toEqual([{ midi: 60, when: 0 }]) // step 0 at t=0

    h.audio.currentTime = 4
    vi.advanceTimersByTime(25)

    // Steps land at 0,1,2,3,4 → 60,64,67,60,64
    expect(h.played).toEqual([
      { midi: 60, when: 0 },
      { midi: 64, when: 1 },
      { midi: 67, when: 2 },
      { midi: 60, when: 3 },
      { midi: 64, when: 4 },
    ])
  })

  it('tracks step index in state', () => {
    const h = harness()
    h.arp.setChord([60, 64])
    h.arp.setRate(60)
    h.arp.start()
    expect(h.state?.stepIdx).toBe(1)
    h.audio.currentTime = 1
    vi.advanceTimersByTime(25)
    expect(h.state?.stepIdx).toBe(2)
  })

  it('setRate mid-run changes spacing from the next step without retiming the current one', () => {
    const h = harness()
    h.arp.setChord([60, 64])
    h.arp.setRate(60) // 1s per step
    h.arp.start()
    expect(h.played).toEqual([{ midi: 60, when: 0 }])

    h.arp.setRate(120) // 0.5s per step, should apply starting from the step after next
    h.audio.currentTime = 1
    vi.advanceTimersByTime(25)

    // The already-scheduled next step (at t=1) still lands at the old spacing;
    // only steps scheduled after the rate change use the new duration.
    expect(h.played).toEqual([
      { midi: 60, when: 0 },
      { midi: 64, when: 1 },
    ])
  })

  it('stop silences, resets, and halts further steps', () => {
    const h = harness()
    h.arp.setChord([60, 64])
    h.arp.setRate(60)
    h.arp.start()
    const beforeStop = h.played.length
    h.arp.stop()
    expect(h.arp.running).toBe(false)
    expect(h.silenceCount).toBe(1)
    h.audio.currentTime = 10
    vi.advanceTimersByTime(100)
    expect(h.played.length).toBe(beforeStop) // no steps after stop
  })

  it('re-voicing mid-run picks up the new chord on the next step', () => {
    const h = harness()
    h.arp.setChord([60])
    h.arp.setRate(60)
    h.arp.start()
    expect(h.played).toEqual([{ midi: 60, when: 0 }])

    h.arp.setChord([72, 76])
    h.audio.currentTime = 1
    vi.advanceTimersByTime(25)

    // Step index keeps advancing rather than resetting on re-voice, so which
    // note of the new chord sounds depends on where the count landed (here
    // stepIdx=1, so voicing[1 % 2] = 76).
    expect(h.played).toEqual([
      { midi: 60, when: 0 },
      { midi: 76, when: 1 },
    ])
  })

  it('degrades gracefully for a single-note voicing (repeats the same note)', () => {
    const h = harness()
    h.arp.setChord([60])
    h.arp.setRate(60)
    h.arp.start()
    h.audio.currentTime = 2
    vi.advanceTimersByTime(25)
    expect(h.played).toEqual([
      { midi: 60, when: 0 },
      { midi: 60, when: 1 },
      { midi: 60, when: 2 },
    ])
  })
})
