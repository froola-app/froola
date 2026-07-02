import { TempoClock } from './TempoClock'
import { midiToHz } from '../music/scales'
import { degreeRootMidi, diatonicChord, type MusicConfig } from '../music/keyScale'
import type { Recording } from '../types'
import type { BackingStyle } from '../lessons/types'

// A synthesized "band" for song lessons, arranged per song so each backing
// track carries the feel of the original record: its groove, bassline rhythm,
// and — crucially — a pad/arpeggio voice playing the actual chord voicings
// (piano quarters for Let It Be, walking '50s bass for Stand By Me, 6/8
// broken chords for Hallelujah, driving eighths for Zombie, …).
// Runs through its own low-gain bus into the engine's master so it sits under
// the user's playing instead of competing with it.

export type BackingChord = { rootMidi: number; voicing: number[]; durationMs: number }

// A one-shot lead line rendered as an instrument voice on top of the groove.
// Loaded at runtime from a per-song data file (public/melodies/*.json,
// gitignored — generated locally by tools/melody-extract from the app owner's
// licensed audio); steps are absolute 16th positions from the step's start.
export type MelodyNote = { step: number; midi: number; dur: number }

// Lift the lead above the pad voicings so it reads as the tune, not a chord tone.
const MELODY_TRANSPOSE = 12
const MELODY_GAIN = 0.6

const BACKING_GAIN = 0.2

// One repeating pattern of a song's arrangement, on a step grid.
// `stepsPerBeat` sets the grid (4 = 16ths, 3 = triplet/6-8 feel);
// `patternLen` is how many steps before the pattern repeats.
// Pad `notes` are indices into the current chord's voicing ('all' = strum).
type PadEvent = { step: number; notes: 'all' | number[] }
type Arrangement = {
  stepsPerBeat: number
  patternLen: number
  swing?: number // 0.5 = straight; >0.5 delays offbeat steps
  kick: number[]
  snare: number[]
  hat: number[]
  hatOpen?: number[]
  bass: Array<{ step: number; interval: number }>
  bassDecay: number
  bassWave?: OscillatorType
  pad?: PadEvent[]
  padDecay?: number
  padGain?: number
  padWave?: OscillatorType
  gains?: { bass?: number; kick?: number; snare?: number; hat?: number }
}

const EIGHTHS = [0, 2, 4, 6, 8, 10, 12, 14]
const QUARTERS = [0, 4, 8, 12]

const ARRANGEMENTS: Record<string, Arrangement> = {
  // Piano ballad: block piano chords on the quarters, simple heartbeat drums.
  'let-it-be': {
    stepsPerBeat: 4, patternLen: 16,
    kick: [0, 8], snare: [4, 12], hat: [],
    bass: [{ step: 0, interval: 0 }, { step: 8, interval: 0 }], bassDecay: 1.0,
    pad: QUARTERS.map(step => ({ step, notes: 'all' as const })),
    padDecay: 1.1, padGain: 0.5,
  },
  // Doo-wop: the walking root-fifth bass IS the texture — bass forward,
  // brushed backbeat, everything else sparse.
  'stand-by-me': {
    stepsPerBeat: 4, patternLen: 16,
    kick: [0], snare: [4, 12], hat: QUARTERS,
    bass: [
      { step: 0, interval: 0 }, { step: 6, interval: 0 },
      { step: 8, interval: 7 }, { step: 14, interval: 7 },
    ],
    bassDecay: 0.5,
    gains: { bass: 1.25, snare: 0.5, hat: 0.5 },
  },
  // Neo-soul: swung 16th feel, soft backbeat, fingerpicked broken chords.
  'best-part': {
    stepsPerBeat: 4, patternLen: 16, swing: 0.58,
    kick: [0, 10], snare: [4, 12], hat: EIGHTHS,
    bass: [{ step: 0, interval: 0 }, { step: 8, interval: 7 }], bassDecay: 0.8,
    pad: [
      { step: 0, notes: [0] }, { step: 2, notes: [2] }, { step: 4, notes: [1] }, { step: 6, notes: [3] },
      { step: 8, notes: [2] }, { step: 10, notes: [3] }, { step: 12, notes: [1] }, { step: 14, notes: [2] },
    ],
    padDecay: 0.55, padGain: 0.5,
    gains: { snare: 0.5, hat: 0.55 },
  },
  // Solo-piano ballad: continuous 16th-note arpeggios, no drums.
  'someone-like-you': {
    stepsPerBeat: 4, patternLen: 8,
    kick: [], snare: [], hat: [],
    bass: [{ step: 0, interval: 0 }], bassDecay: 1.6,
    pad: [
      { step: 0, notes: [0] }, { step: 1, notes: [2] }, { step: 2, notes: [1] }, { step: 3, notes: [2] },
      { step: 4, notes: [0] }, { step: 5, notes: [2] }, { step: 6, notes: [1] }, { step: 7, notes: [2] },
    ],
    padDecay: 0.6, padGain: 0.55,
  },
  // Sparse guitar pop: plucked chord tones over a soft four-on-the-floor thump.
  'love-yourself': {
    stepsPerBeat: 4, patternLen: 16,
    kick: QUARTERS, snare: [], hat: [],
    bass: [{ step: 0, interval: 0 }], bassDecay: 0.4,
    pad: [
      { step: 0, notes: [0] }, { step: 2, notes: [1] }, { step: 4, notes: [2] }, { step: 6, notes: [1] },
      { step: 8, notes: [0] }, { step: 10, notes: [1] }, { step: 12, notes: [2] }, { step: 14, notes: [1] },
    ],
    padDecay: 0.28, padGain: 0.45,
    gains: { kick: 0.55, bass: 0.7 },
  },
  // Grunge anthem: driving eighth-note saw bass, heavy backbeat, a dark
  // strummed wall on the strong beats.
  zombie: {
    stepsPerBeat: 4, patternLen: 16,
    kick: [0, 8, 10], snare: [4, 12], hat: EIGHTHS, hatOpen: [0],
    bass: EIGHTHS.map(step => ({ step, interval: 0 })),
    bassDecay: 0.32, bassWave: 'sawtooth',
    pad: QUARTERS.map(step => ({ step, notes: 'all' as const })),
    padDecay: 0.8, padGain: 0.32, padWave: 'sawtooth',
    gains: { hat: 0.6 },
  },
  // 6/8 waltz feel: the classic rise-and-fall broken chord, barely any drums.
  hallelujah: {
    stepsPerBeat: 3, patternLen: 6,
    kick: [0], snare: [], hat: [],
    bass: [{ step: 0, interval: 0 }], bassDecay: 1.8,
    pad: [
      { step: 0, notes: [0] }, { step: 1, notes: [1] }, { step: 2, notes: [2] },
      { step: 3, notes: [1] }, { step: 4, notes: [2] }, { step: 5, notes: [1] },
    ],
    padDecay: 0.7, padGain: 0.5,
    gains: { kick: 0.35 },
  },
  // Britpop strum: relentless eighths with 16th pushes, busy hats — the sus
  // colour lives in the chord voicings themselves.
  wonderwall: {
    stepsPerBeat: 4, patternLen: 16,
    kick: [0, 8], snare: [4, 12],
    hat: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15],
    bass: [{ step: 0, interval: 0 }, { step: 8, interval: 0 }], bassDecay: 0.9,
    pad: [0, 2, 4, 6, 8, 10, 11, 12, 14, 15].map(step => ({ step, notes: 'all' as const })),
    padDecay: 0.3, padGain: 0.38,
    gains: { hat: 0.4 },
  },
  // Fallback groove for anything unlisted.
  pop: {
    stepsPerBeat: 4, patternLen: 16,
    kick: [0, 8], snare: [4, 12], hat: EIGHTHS,
    bass: [{ step: 0, interval: 0 }, { step: 8, interval: 0 }], bassDecay: 0.5,
    pad: [{ step: 0, notes: 'all' }, { step: 8, notes: 'all' }],
    padDecay: 0.6, padGain: 0.4,
  },
}

/** Collapse a lesson step's target recording into the chord sequence the
 *  backing track follows: bass root two octaves down plus the diatonic chord
 *  voicing an octave below the user's wheel register. */
export function backingSequence(recording: Recording, music: MusicConfig): BackingChord[] {
  const out: BackingChord[] = []
  let lastKey = ''
  for (const sample of recording.samples) {
    const key = `${sample.noteIdx}:${sample.qualityIdx}`
    if (key === lastKey) {
      out[out.length - 1].durationMs += sample.dt
      continue
    }
    lastKey = key
    out.push({
      rootMidi: degreeRootMidi(sample.noteIdx, music.keyOffset, music.scale) - 24,
      voicing: diatonicChord(sample.noteIdx, sample.qualityIdx, music.keyOffset, music.scale, -1).midis,
      durationMs: sample.dt,
    })
  }
  return out
}

export class SongBackingTrack {
  private ctx: AudioContext
  private out: GainNode
  private padFilter: BiquadFilterNode
  private clock: TempoClock | null = null
  private noise: AudioBuffer | null = null
  private audioSource: AudioBufferSourceNode | null = null
  private audioGain: GainNode

  constructor(ctx: AudioContext, destination: AudioNode) {
    this.ctx = ctx
    this.out = ctx.createGain()
    this.out.gain.value = BACKING_GAIN
    this.out.connect(destination)
    // Real-audio backing (the app owner's own local file) bypasses the quiet
    // synth bus — it IS the accompaniment, so it sits at near-full level.
    this.audioGain = ctx.createGain()
    this.audioGain.gain.value = 0.75
    this.audioGain.connect(destination)
    // Shared lowpass keeps the pad/arp voice mellow so it never masks the
    // user's own synth.
    this.padFilter = ctx.createBiquadFilter()
    this.padFilter.type = 'lowpass'
    this.padFilter.frequency.value = 1500
    this.padFilter.connect(this.out)
  }

  /** Play a real audio buffer (e.g. the owner's locally-separated instrumental)
   *  as the backing instead of the synth arrangement. One-shot, from t=0. */
  startAudio(buffer: AudioBuffer): void {
    this.stop()
    const src = this.ctx.createBufferSource()
    src.buffer = buffer
    src.connect(this.audioGain)
    src.start()
    this.audioSource = src
  }

  /** Start (or restart) the arrangement. Loops past the end of the chord
   *  sequence until stopped. */
  start(sequence: BackingChord[], bpm: number, style: BackingStyle = 'pop', melody?: MelodyNote[]): void {
    this.stop()
    if (sequence.length === 0) return
    const arr = ARRANGEMENTS[style] ?? ARRANGEMENTS.pop
    const totalMs = sequence.reduce((s, c) => s + c.durationMs, 0)
    const stepMs = 60000 / bpm / arr.stepsPerBeat
    const stepSec = stepMs / 1000
    const swingShift = ((arr.swing ?? 0.5) - 0.5) * 2 * stepSec
    const g = arr.gains ?? {}
    // Melody data is authored on a 16th grid; remap if the arrangement runs
    // on a different step resolution.
    const melodyByStep = new Map<number, MelodyNote[]>()
    for (const n of melody ?? []) {
      const at = Math.round((n.step * arr.stepsPerBeat) / 4)
      const list = melodyByStep.get(at) ?? []
      list.push(n)
      melodyByStep.set(at, list)
    }

    this.clock = new TempoClock(this.ctx, ({ time, step }) => {
      const barStep = step % arr.patternLen
      const when = time + (barStep % 2 === 1 ? swingShift : 0)
      const chord = this.chordAt(sequence, (step * stepMs) % totalMs)

      if (arr.kick.includes(barStep)) this.playKick(when, g.kick ?? 1)
      if (arr.snare.includes(barStep)) this.playSnare(when, g.snare ?? 1)
      if (arr.hat.includes(barStep)) this.playHat(when, 0.3 * (g.hat ?? 1), 0.04)
      if (arr.hatOpen?.includes(barStep)) this.playHat(when, 0.25 * (g.hat ?? 1), 0.22)

      const bassHit = arr.bass.find(b => b.step === barStep)
      if (bassHit) {
        this.playBass(chord.rootMidi + bassHit.interval, when, arr.bassDecay, arr.bassWave ?? 'triangle', g.bass ?? 1)
      }

      for (const n of melodyByStep.get(step) ?? []) {
        const durSec = Math.max(1, n.dur) * (60 / bpm / 4)
        this.playMelodyNote(n.midi + MELODY_TRANSPOSE, when, durSec)
      }

      const padHit = arr.pad?.find(p => p.step === barStep)
      if (padHit) {
        const midis = padHit.notes === 'all'
          ? chord.voicing
          : padHit.notes.map(i => chord.voicing[i % chord.voicing.length])
        // Slight per-note stagger reads as a strum/pluck instead of a stab.
        midis.forEach((midi, i) => {
          this.playPadNote(midi, when + i * 0.014, arr.padDecay ?? 0.6, (arr.padGain ?? 0.4) / Math.max(1, midis.length * 0.6), arr.padWave ?? 'triangle')
        })
      }
    }, { bpm, stepsPerBeat: arr.stepsPerBeat })
    this.clock.start()
  }

  stop(): void {
    this.clock?.stop()
    this.clock = null
    if (this.audioSource) {
      try { this.audioSource.stop() } catch { /* already stopped */ }
      this.audioSource = null
    }
  }

  private chordAt(sequence: BackingChord[], elapsedMs: number): BackingChord {
    let acc = 0
    for (const c of sequence) {
      acc += c.durationMs
      if (elapsedMs < acc) return c
    }
    return sequence[sequence.length - 1]
  }

  private playBass(midi: number, when: number, decay: number, wave: OscillatorType, gainMul: number): void {
    const osc = this.ctx.createOscillator()
    osc.type = wave
    osc.frequency.value = midiToHz(midi)
    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(0, when)
    gain.gain.linearRampToValueAtTime(0.9 * gainMul, when + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.001, when + decay)
    osc.connect(gain)
    // Saw bass goes through the pad lowpass so it growls instead of buzzing.
    gain.connect(wave === 'sawtooth' ? this.padFilter : this.out)
    osc.start(when)
    osc.stop(when + decay + 0.05)
  }

  private playPadNote(midi: number, when: number, decay: number, gainLevel: number, wave: OscillatorType): void {
    const osc = this.ctx.createOscillator()
    osc.type = wave
    osc.frequency.value = midiToHz(midi)
    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(0, when)
    gain.gain.linearRampToValueAtTime(gainLevel, when + 0.015)
    gain.gain.exponentialRampToValueAtTime(0.001, when + decay)
    osc.connect(gain)
    gain.connect(this.padFilter)
    osc.start(when)
    osc.stop(when + decay + 0.05)
  }

  private playMelodyNote(midi: number, when: number, durSec: number): void {
    const osc = this.ctx.createOscillator()
    osc.type = 'triangle'
    osc.frequency.value = midiToHz(midi)
    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(0, when)
    gain.gain.linearRampToValueAtTime(MELODY_GAIN, when + 0.02)
    gain.gain.setValueAtTime(MELODY_GAIN, when + Math.max(0.02, durSec - 0.06))
    gain.gain.linearRampToValueAtTime(0.0001, when + durSec + 0.05)
    osc.connect(gain)
    gain.connect(this.out)
    osc.start(when)
    osc.stop(when + durSec + 0.1)
  }

  private playKick(when: number, gainMul: number): void {
    const osc = this.ctx.createOscillator()
    osc.type = 'sine'
    osc.frequency.setValueAtTime(110, when)
    osc.frequency.exponentialRampToValueAtTime(45, when + 0.1)
    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(0.8 * gainMul, when)
    gain.gain.exponentialRampToValueAtTime(0.001, when + 0.14)
    osc.connect(gain)
    gain.connect(this.out)
    osc.start(when)
    osc.stop(when + 0.16)
  }

  private playSnare(when: number, gainMul: number): void {
    const src = this.ctx.createBufferSource()
    src.buffer = this.noiseBuffer()
    const filter = this.ctx.createBiquadFilter()
    filter.type = 'bandpass'
    filter.frequency.value = 1800
    filter.Q.value = 0.8
    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(0.4 * gainMul, when)
    gain.gain.exponentialRampToValueAtTime(0.001, when + 0.12)
    src.connect(filter)
    filter.connect(gain)
    gain.connect(this.out)
    src.start(when)
  }

  private playHat(when: number, gainLevel: number, decay: number): void {
    const src = this.ctx.createBufferSource()
    src.buffer = this.noiseBuffer()
    const filter = this.ctx.createBiquadFilter()
    filter.type = 'highpass'
    filter.frequency.value = 6000
    const gain = this.ctx.createGain()
    gain.gain.setValueAtTime(gainLevel, when)
    gain.gain.exponentialRampToValueAtTime(0.001, when + decay)
    src.connect(filter)
    filter.connect(gain)
    gain.connect(this.out)
    src.start(when)
  }

  private noiseBuffer(): AudioBuffer {
    if (this.noise) return this.noise
    const length = Math.floor(this.ctx.sampleRate * 0.25)
    const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate)
    const data = buffer.getChannelData(0)
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1
    this.noise = buffer
    return buffer
  }
}
