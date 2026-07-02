// C1 sequential chord looper. Captured chords are held as ordered slots; when
// playing, a TempoClock steps through them one bar at a time and schedules each
// chord to sound at its precise audio time. It plays one chord at a time, which
// fits the engine's single chord-pad — the free hand solos over it separately.

import type { MusicalCommand } from '../types'
import type { TempoClock, ClockStep, StepCallback, TempoClockOptions } from '../audio'
import { MIN_BPM, MAX_BPM } from '../audio'

export const MAX_SLOTS = 8
export const DEFAULT_BPM = 90
// 1 slot = 1 bar = 4 beats; the clock emits one step per beat.
const STEPS_PER_BEAT = 1
const BEATS_PER_BAR = 4

export type LooperState = {
  /** Chord label per slot, in order (for display). */
  slots: string[]
  playing: boolean
  bpm: number
  /** Index of the currently sounding slot, or -1 when stopped. */
  currentSlot: number
}

export type LooperDeps = {
  createClock: (cb: StepCallback, opts?: TempoClockOptions) => TempoClock
  playAt: (cmd: MusicalCommand, when: number) => void
  silence: () => void
  onChange?: (state: LooperState) => void
}

const clampBpm = (bpm: number) => Math.max(MIN_BPM, Math.min(MAX_BPM, Math.round(bpm)))

export class ChordLooper {
  private deps: LooperDeps
  private slots: MusicalCommand[] = []
  private clock: TempoClock | null = null
  private bpm = DEFAULT_BPM
  private barsPerSlot = 1
  private currentSlot = -1

  constructor(deps: LooperDeps) {
    this.deps = deps
  }

  private get stepsPerSlot(): number {
    return BEATS_PER_BAR * this.barsPerSlot
  }

  get length(): number {
    return this.slots.length
  }

  get playing(): boolean {
    return this.clock?.running ?? false
  }

  getBpm(): number {
    return this.bpm
  }

  /** Append the current chord as a new slot. Returns false if the loop is full. */
  add(cmd: MusicalCommand): boolean {
    if (this.slots.length >= MAX_SLOTS) return false
    this.slots.push(cmd)
    this.emit()
    return true
  }

  /** Remove the last slot. Stops playback if that empties the loop. */
  undo(): void {
    if (this.slots.length === 0) return
    this.slots.pop()
    if (this.slots.length === 0 && this.playing) this.stop()
    else this.emit()
  }

  clear(): void {
    this.slots = []
    this.bpm = DEFAULT_BPM
    this.clock?.setBpm(this.bpm)
    if (this.playing) this.stop()
    else this.emit()
  }

  setBpm(bpm: number): void {
    this.bpm = clampBpm(bpm)
    this.clock?.setBpm(this.bpm)
    this.emit()
  }

  start(): void {
    if (this.playing || this.slots.length === 0) return
    this.clock = this.deps.createClock(e => this.onStep(e), {
      bpm: this.bpm,
      stepsPerBeat: STEPS_PER_BEAT,
    })
    this.clock.start()
    this.emit()
  }

  stop(): void {
    this.clock?.stop()
    this.clock = null
    this.currentSlot = -1
    this.deps.silence()
    this.emit()
  }

  toggle(): void {
    if (this.playing) this.stop()
    else this.start()
  }

  getState(): LooperState {
    return {
      slots: this.slots.map(c => c.chord),
      playing: this.playing,
      bpm: this.bpm,
      currentSlot: this.currentSlot,
    }
  }

  // Fired for every clock step; act only on slot (bar) boundaries.
  private onStep(e: ClockStep): void {
    if (this.slots.length === 0) return
    if (e.step % this.stepsPerSlot !== 0) return
    const idx = (e.step / this.stepsPerSlot) % this.slots.length
    this.currentSlot = idx
    this.deps.playAt(this.slots[idx], e.time)
    this.emit()
  }

  private emit(): void {
    this.deps.onChange?.(this.getState())
  }
}
