import type { MusicalCommand, InstrumentMode } from '../types'
import { midiToHz } from '../music/scales'
import type Soundfont from 'soundfont-player'

type Player = Awaited<ReturnType<typeof Soundfont.instrument>>

export class AudioEngine {
  private ctx: AudioContext
  private oscillators: OscillatorNode[]
  private voiceGains: GainNode[]
  private masterGain: GainNode
  private analyser: AnalyserNode
  // Sampler output sits between soundfont-player and masterGain so we can
  // fade it independently of the oscillator voices.
  private samplerGain: GainNode
  private samplers: Partial<Record<'piano' | 'guitar', Player>> = {}
  private samplerLoading = new Set<'piano' | 'guitar'>()

  constructor() {
    this.ctx = new AudioContext()

    this.masterGain = this.ctx.createGain()
    this.masterGain.gain.value = 0.7

    const compressor = this.ctx.createDynamicsCompressor()
    compressor.threshold.value = -6
    compressor.knee.value = 3
    compressor.ratio.value = 4
    compressor.attack.value = 0.003
    compressor.release.value = 0.1

    this.analyser = this.ctx.createAnalyser()
    this.analyser.fftSize = 256

    this.masterGain.connect(compressor)
    compressor.connect(this.analyser)
    this.analyser.connect(this.ctx.destination)

    this.samplerGain = this.ctx.createGain()
    this.samplerGain.gain.value = 1
    this.samplerGain.connect(this.masterGain)

    this.oscillators = []
    this.voiceGains = []

    for (let i = 0; i < 3; i++) {
      const osc = this.ctx.createOscillator()
      osc.type = 'sine'
      const gain = this.ctx.createGain()
      gain.gain.value = 0
      osc.connect(gain)
      gain.connect(this.masterGain)
      osc.start()
      this.oscillators.push(osc)
      this.voiceGains.push(gain)
    }
  }

  // Fire-and-forget async load. Idempotent — safe to call every rAF frame.
  startLoadingSampler(mode: 'piano' | 'guitar'): void {
    if (this.samplers[mode] || this.samplerLoading.has(mode)) return
    this.samplerLoading.add(mode)
    const name = mode === 'piano' ? 'acoustic_grand_piano' : 'acoustic_guitar_nylon'
    import('soundfont-player')
      .then(({ default: SF }) => SF.instrument(this.ctx, name, { destination: this.samplerGain }))
      .then(player => {
        this.samplers[mode] = player
        this.samplerLoading.delete(mode)
      })
  }

  // Attack only — stays at peak gain. Call silence() to release.
  play(cmd: MusicalCommand, mode: InstrumentMode = 'synth'): void {
    const now = this.ctx.currentTime

    if ((mode === 'piano' || mode === 'guitar') && this.samplers[mode]) {
      const player = this.samplers[mode]!
      // Snap samplerGain back in case a release fade is in progress
      this.samplerGain.gain.cancelScheduledValues(now)
      this.samplerGain.gain.setValueAtTime(1, now)
      cmd.voicing.forEach(midi => player.play(midi.toString()))
      return
    }

    // Oscillator path: synth / pad / fallback for piano+guitar while loading
    const peakGain = 0.7 / 3
    cmd.voicing.forEach((midi, i) => {
      const hz = midiToHz(midi)
      this.oscillators[i].frequency.cancelScheduledValues(now)
      this.oscillators[i].frequency.setValueAtTime(hz, now)
      this.voiceGains[i].gain.cancelScheduledValues(now)
      this.voiceGains[i].gain.setValueAtTime(this.voiceGains[i].gain.value, now)

      if (mode === 'piano') {
        this.voiceGains[i].gain.linearRampToValueAtTime(peakGain, now + 0.008)
      } else if (mode === 'guitar') {
        this.voiceGains[i].gain.linearRampToValueAtTime(peakGain, now + 0.005)
      } else if (mode === 'pad') {
        this.voiceGains[i].gain.linearRampToValueAtTime(peakGain, now + 0.4)
      } else {
        this.voiceGains[i].gain.linearRampToValueAtTime(peakGain, now + 0.012)
      }
    })
  }

  // Mode-aware release triggered when hand leaves wheel.
  silence(mode: InstrumentMode = 'synth'): void {
    const now = this.ctx.currentTime

    // Always silence oscillators (covers synth/pad and piano/guitar fallback)
    this.voiceGains.forEach(g => {
      g.gain.cancelScheduledValues(now)
      g.gain.setValueAtTime(g.gain.value, now)
      if (mode === 'pad') {
        g.gain.linearRampToValueAtTime(0, now + 0.5)
      } else {
        g.gain.linearRampToValueAtTime(0, now + 0.08)
      }
    })

    if (mode === 'piano' || mode === 'guitar') {
      // Fade samplerGain — piano rings longer, guitar is shorter
      this.samplerGain.gain.cancelScheduledValues(now)
      this.samplerGain.gain.setValueAtTime(this.samplerGain.gain.value, now)
      const release = mode === 'piano' ? 2.0 : 0.6
      this.samplerGain.gain.linearRampToValueAtTime(0, now + release)
    }
  }

  getAnalyser(): AnalyserNode {
    return this.analyser
  }

  resume(): void {
    this.ctx.resume()
  }

  suspend(): void {
    this.ctx.suspend()
  }
}
