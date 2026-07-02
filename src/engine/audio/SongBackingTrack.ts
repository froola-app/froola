import { TempoClock } from './TempoClock'
import { midiToHz } from '../music/scales'
import { degreeRootMidi, type MusicConfig } from '../music/keyScale'
import type { Recording } from '../types'
import type { BackingStyle } from '../lessons/types'

// A quiet, fully synthesized "band" for song lessons: kick, snare, hi-hat and
// a bassline following the current chord's root, arranged per-style so each
// song's accompaniment resembles the original's feel (doo-wop walk for Stand
// By Me, straight rock eighths for Zombie, sparse ballad for Hallelujah…).
// Runs through its own low-gain bus into the engine's master so it sits under
// the user's playing instead of competing with it.

export type BackingChord = { rootMidi: number; durationMs: number }

const BACKING_GAIN = 0.16
const STEPS_PER_BAR = 16 // 16th-note grid, 4/4

// One bar of groove. Steps are 16th positions 0-15; bass notes name an
// interval above the chord root (0 = root, 7 = fifth, 12 = octave).
type Groove = {
  kick: number[]
  snare: number[]
  hat: number[]
  bass: Array<{ step: number; interval: number }>
  bassDecay: number // seconds
  hatGain: number
}

const GROOVES: Record<BackingStyle, Groove> = {
  // Soft pulse, long bass notes, quarter hats — slow piano songs.
  ballad: {
    kick: [0],
    snare: [],
    hat: [0, 4, 8, 12],
    bass: [{ step: 0, interval: 0 }, { step: 8, interval: 0 }],
    bassDecay: 1.4,
    hatGain: 0.2,
  },
  // Backbeat + eighth hats, root bass on the strong beats.
  pop: {
    kick: [0, 8],
    snare: [4, 12],
    hat: [0, 2, 4, 6, 8, 10, 12, 14],
    bass: [{ step: 0, interval: 0 }, { step: 8, interval: 0 }],
    bassDecay: 0.5,
    hatGain: 0.3,
  },
  // Driving eighth-note bass under a straight backbeat.
  rock: {
    kick: [0, 8, 10],
    snare: [4, 12],
    hat: [0, 2, 4, 6, 8, 10, 12, 14],
    bass: [0, 2, 4, 6, 8, 10, 12, 14].map(step => ({ step, interval: 0 })),
    bassDecay: 0.35,
    hatGain: 0.35,
  },
  // Laid-back backbeat, root-fifth bass with a pickup.
  soul: {
    kick: [0, 10],
    snare: [4, 12],
    hat: [0, 2, 4, 6, 8, 10, 12, 14],
    bass: [{ step: 0, interval: 0 }, { step: 6, interval: 7 }, { step: 8, interval: 0 }, { step: 14, interval: 7 }],
    bassDecay: 0.6,
    hatGain: 0.22,
  },
  // The classic '50s walk: root … root, fifth … fifth.
  doowop: {
    kick: [0, 8],
    snare: [4, 12],
    hat: [0, 4, 8, 12],
    bass: [{ step: 0, interval: 0 }, { step: 6, interval: 0 }, { step: 8, interval: 7 }, { step: 14, interval: 7 }],
    bassDecay: 0.5,
    hatGain: 0.22,
  },
}

/** Collapse a lesson step's target recording into the chord-root sequence the
 *  backing track follows. Consecutive samples on the same wheel degree merge
 *  into one chord; roots come from the lesson's key/scale, dropped into the
 *  bass register. */
export function backingSequence(recording: Recording, music: MusicConfig): BackingChord[] {
  const out: BackingChord[] = []
  for (const sample of recording.samples) {
    const rootMidi = degreeRootMidi(sample.noteIdx, music.keyOffset, music.scale) - 24
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

  /** Start (or restart) the groove. Runs on a 16th-note grid; loops past the
   *  end of the chord sequence until stopped. */
  start(sequence: BackingChord[], bpm: number, style: BackingStyle = 'pop'): void {
    this.stop()
    if (sequence.length === 0) return
    const groove = GROOVES[style]
    const totalMs = sequence.reduce((s, c) => s + c.durationMs, 0)
    const stepMs = 60000 / bpm / 4

    this.clock = new TempoClock(this.ctx, ({ time, step }) => {
      const barStep = step % STEPS_PER_BAR
      if (groove.kick.includes(barStep)) this.playKick(time)
      if (groove.snare.includes(barStep)) this.playSnare(time)
      if (groove.hat.includes(barStep)) this.playHat(time, groove.hatGain)
      const bassHit = groove.bass.find(b => b.step === barStep)
      if (bassHit) {
        const elapsedMs = (step * stepMs) % totalMs
        this.playBass(this.rootAt(sequence, elapsedMs) + bassHit.interval, time, groove.bassDecay)
      }
    }, { bpm, stepsPerBeat: 4 })
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

  private playBass(midi: number, when: number, decay: number): void {
    const osc = this.ctx.createOscillator()
    osc.type = 'triangle'
    osc.frequency.value = midiToHz(midi)
    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(0, when)
    gain.gain.linearRampToValueAtTime(0.9, when + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.001, when + decay)
    osc.connect(gain)
    gain.connect(this.out)
    osc.start(when)
    osc.stop(when + decay + 0.05)
  }

  private playKick(when: number): void {
    const osc = this.ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(110, when)
    osc.frequency.exponentialRampToValueAtTime(45, when + 0.1)
    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(0.8, when)
    gain.gain.exponentialRampToValueAtTime(0.001, when + 0.14)
    osc.connect(gain)
    gain.connect(this.out)
    osc.start(when)
    osc.stop(when + 0.16)
  }

  private playSnare(when: number): void {
    const src = this.ctx.createBufferSource()
    src.buffer = this.noiseBuffer()
    const filter = this.ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = 1800
    filter.Q.value = 0.8
    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(0.4, when)
    gain.gain.exponentialRampToValueAtTime(0.001, when + 0.12)
    src.connect(filter)
    filter.connect(gain)
    gain.connect(this.out)
    src.start(when)
  }

  private playHat(when: number, gainLevel: number): void {
    const src = this.ctx.createBufferSource()
    src.buffer = this.noiseBuffer()
    const filter = this.ctx.createBiquadFilter()
    filter.type = 'highpass'
    filter.frequency.value = 6000
    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(gainLevel, when)
    gain.gain.exponentialRampToValueAtTime(0.001, when + 0.04)
    src.connect(filter)
    filter.connect(gain)
    gain.connect(this.out)
    src.start(when)
  }

  private noiseBuffer(): AudioBuffer {
    if (this.noise) return this.noise
    const length = Math.floor(this.ctx.sampleRate * 0.15)
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1
    this.noise = buffer
    return buffer
  }
}
