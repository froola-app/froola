// Turns a held (sustained) chord into a repeating pattern instead of a static
// drone. Built on the same TempoClock lookahead scheduler as the chord looper,
// but steps through a single chord's voicing one note at a time (a "strum")
// rather than stepping through slots of different chords.

import { TempoClock, type ClockStep, type StepCallback, type TempoClockOptions, MIN_BPM, MAX_BPM } from '../audio'

export type ArpState = {
  running: boolean
  stepIdx: number
}

export type ArpDeps = {
  createClock: (cb: StepCallback, opts?: TempoClockOptions) => TempoClock
  playNoteAt: (midi: number, when: number) => void
  silence: () => void
  onChange?: (state: ArpState) => void
}

const clampBpm = (bpm: number) => Math.max(MIN_BPM, Math.min(MAX_BPM, Math.round(bpm)))
// One arp note per beat by default — hand-height drives rate via setRate.
const STEPS_PER_BEAT = 1

export class Arpeggiator {
  private deps: ArpDeps
  private voicing: number[] = []
  private clock: TempoClock | null = null
  private bpm = MIN_BPM
  private stepIdx = 0

  constructor(deps: ArpDeps) {
    this.deps = deps
  }

  get running(): boolean {
    return this.clock?.running ?? false
  }

  /** Replace the notes being cycled (re-voice mid-run, e.g. wheel rotated while held). */
  setChord(voicing: number[]): void {
    this.voicing = voicing
  }

  /** Change arp rate (e.g. driven by hand height); takes effect from the next step. */
  setRate(bpm: number): void {
    this.bpm = clampBpm(bpm)
    this.clock?.setBpm(this.bpm)
  }

  start(): void {
    if (this.running) return
    this.stepIdx = 0
    this.clock = this.deps.createClock(e => this.onStep(e), {
      bpm: this.bpm,
      stepsPerBeat: STEPS_PER_BEAT,
    })
    this.clock.start()
    this.emit()
  }

  stop(): void {
    if (!this.running) return
    this.clock?.stop()
    this.clock = null
    this.stepIdx = 0
    this.deps.silence()
    this.emit()
  }

  private onStep(e: ClockStep): void {
    if (this.voicing.length === 0) return
    const idx = this.stepIdx % this.voicing.length
    this.deps.playNoteAt(this.voicing[idx], e.time)
    this.stepIdx += 1
    this.emit()
  }

  private emit(): void {
    this.deps.onChange?.({ running: this.running, stepIdx: this.stepIdx })
  }
}
