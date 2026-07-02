import { TempoClock } from './TempoClock'
import { midiToHz } from '../music/scales'
import { degreeRootMidi, type MusicConfig } from '../music/keyScale'
import type { Recording } from '../types'

// A quiet, fully synthesized "band" for song lessons: a triangle bass note on
// each beat following the current chord's root, and a short noise-burst hi-hat
// on the off-beats. Runs through its own low-gain bus into the engine's master
// so it sits under the user's playing instead of competing with it.

export type BackingChord = { rootMidi: number; durationMs: number }

const BACKING_GAIN = 0.15
const HAT_GAIN = 0.35
const BASS_OCTAVES_DOWN = 2

/** Collapse a lesson step's target recording into the chord-root sequence the
 *  backing track follows. Consecutive samples on the same wheel degree merge
 *  into one chord; roots come from the lesson's key/scale, dropped into the
 *  bass register. */
export function backingSequence(recording: Recording, music: MusicConfig): BackingChord[] {
  const out: BackingChord[] = []
  for (const sample of recording.samples) {
    const rootMidi = degreeRootMidi(sample.noteIdx, music.keyOffset, music.scale) - 12 * BASS_OCTAVES_DOWN
    const last = out[out.length - 1]
    if (last && last.rootMidi === rootMidi) last.durationMs += sample.dt
    else out.push({ rootMidi, durationMs: sample.dt })
  }
  return out
}

export class SongBackingTrack {
  private ctx: AudioContext
  private out: GainNode
  private clock: TempoClock | null = null
  private noise: AudioBuffer | null = null

  constructor(ctx: AudioContext, destination: AudioNode) {
    this.ctx = ctx
    this.out = ctx.createGain()
    this.out.gain.value = BACKING_GAIN
    this.out.connect(destination)
  }

  /** Start (or restart) the groove. Runs at 8th-note resolution: bass root on
   *  the beats, hi-hat on the off-beats. Loops past the end of the sequence
   *  until stopped. */
  start(sequence: BackingChord[], bpm: number): void {
    this.stop()
    if (sequence.length === 0) return
    const totalMs = sequence.reduce((s, c) => s + c.durationMs, 0)
    const stepMs = 60000 / bpm / 2

    this.clock = new TempoClock(this.ctx, ({ time, step }) => {
      if (step % 2 === 0) {
        const elapsedMs = (step * stepMs) % totalMs
        this.playBass(this.rootAt(sequence, elapsedMs), time)
      } else {
        this.playHat(time)
      }
    }, { bpm, stepsPerBeat: 2 })
    this.clock.start()
  }

  stop(): void {
    this.clock?.stop()
    this.clock = null
  }

  private rootAt(sequence: BackingChord[], elapsedMs: number): number {
    let acc = 0
    for (const c of sequence) {
      acc += c.durationMs
      if (elapsedMs < acc) return c.rootMidi
    }
    return sequence[sequence.length - 1].rootMidi
  }

  private playBass(midi: number, when: number): void {
    const osc = this.ctx.createOscillator()
    osc.type = 'triangle'
    osc.frequency.value = midiToHz(midi)
    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(0, when)
    gain.gain.linearRampToValueAtTime(0.9, when + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.001, when + 0.45)
    osc.connect(gain)
    gain.connect(this.out)
    osc.start(when)
    osc.stop(when + 0.5)
  }

  private playHat(when: number): void {
    const src = this.ctx.createBufferSource()
    src.buffer = this.noiseBuffer()
    const filter = this.ctx.createBiquadFilter()
    filter.type = 'highpass'
    filter.frequency.value = 6000
    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(HAT_GAIN, when)
    gain.gain.exponentialRampToValueAtTime(0.001, when + 0.04)
    src.connect(filter)
    filter.connect(gain)
    gain.connect(this.out)
    src.start(when)
  }

  private noiseBuffer(): AudioBuffer {
    if (this.noise) return this.noise
    const length = Math.floor(this.ctx.sampleRate * 0.05)
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1
    this.noise = buffer
    return buffer
  }
}
