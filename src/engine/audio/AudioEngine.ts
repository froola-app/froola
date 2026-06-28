import type { MusicalCommand, InstrumentMode } from '../types'
import { midiToHz } from '../music/scales'
import type Soundfont from 'soundfont-player'

type Player = Awaited<ReturnType<typeof Soundfont.instrument>>
type SampleNode = { stop(when?: number): void }

export class AudioEngine {
  private ctx: AudioContext
  private oscillators: OscillatorNode[]
  private voiceGains: GainNode[]
  private masterGain: GainNode
  private analyser: AnalyserNode
  private samplerGain: GainNode
  private samplers: Partial<Record<'piano' | 'guitar', Player>> = {}
  private samplerLoading = new Set<'piano' | 'guitar'>()
  private activeSampleNodes: SampleNode[] = []

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
      // Triangle gives a rounder, more instrument-like tone than sine
      osc.type = 'triangle'
      const gain = this.ctx.createGain()
      gain.gain.value = 0
      osc.connect(gain)
      gain.connect(this.masterGain)
      osc.start()
      this.oscillators.push(osc)
      this.voiceGains.push(gain)
    }
  }

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

  play(cmd: MusicalCommand, mode: InstrumentMode = 'synth'): void {
    const now = this.ctx.currentTime

    if ((mode === 'piano' || mode === 'guitar') && this.samplers[mode]) {
      const player = this.samplers[mode]!

      // Clear previous attack samples
      const prev = this.activeSampleNodes
      this.activeSampleNodes = []
      prev.forEach(n => { try { n.stop() } catch { /* already stopped */ } })

      // Restore samplerGain in case a release is in progress
      this.samplerGain.gain.cancelScheduledValues(now)
      this.samplerGain.gain.setValueAtTime(1, now)

      // Play the real sample once for the characteristic attack sound
      this.activeSampleNodes = cmd.voicing.map(midi => player.play(midi.toString()))

      // Start triangle oscillators as the sustain layer.
      // The soundfont samples have no loop points so they can't sustain —
      // the oscillators hold the note indefinitely while the hand is on the wheel.
      // They fade in after the initial attack so they don't clash with it.
      const sustainGain = 0.7 / 3 * 0.45
      const fadeIn = mode === 'piano' ? 0.25 : 0.06
      cmd.voicing.forEach((midi, i) => {
        const hz = midiToHz(midi)
        this.oscillators[i].frequency.cancelScheduledValues(now)
        this.oscillators[i].frequency.setValueAtTime(hz, now)
        this.voiceGains[i].gain.cancelScheduledValues(now)
        this.voiceGains[i].gain.setValueAtTime(0, now)
        this.voiceGains[i].gain.linearRampToValueAtTime(sustainGain, now + fadeIn)
      })
      return
    }

    // Pure synth path (or piano/guitar while sampler is still loading)
    const peakGain = 0.7 / 3
    cmd.voicing.forEach((midi, i) => {
      const hz = midiToHz(midi)
      this.oscillators[i].frequency.cancelScheduledValues(now)
      this.oscillators[i].frequency.setValueAtTime(hz, now)
      this.voiceGains[i].gain.cancelScheduledValues(now)
      this.voiceGains[i].gain.setValueAtTime(this.voiceGains[i].gain.value, now)
      const attack = mode === 'piano' ? 0.008 : mode === 'guitar' ? 0.005 : 0.012
      this.voiceGains[i].gain.linearRampToValueAtTime(peakGain, now + attack)
    })
  }

  silence(mode: InstrumentMode = 'synth'): void {
    const now = this.ctx.currentTime

    if (mode === 'piano' || mode === 'guitar') {
      // Fade the sample output quickly (it's naturally decaying anyway)
      this.samplerGain.gain.cancelScheduledValues(now)
      this.samplerGain.gain.setValueAtTime(this.samplerGain.gain.value, now)
      this.samplerGain.gain.linearRampToValueAtTime(0, now + 0.3)
      const nodes = this.activeSampleNodes
      this.activeSampleNodes = []
      nodes.forEach(n => { try { n.stop(now + 0.35) } catch { /* already stopped */ } })

      // Fade the oscillator sustain layer — this is what the user hears sustaining
      const release = mode === 'piano' ? 1.8 : 0.5
      this.voiceGains.forEach(g => {
        g.gain.cancelScheduledValues(now)
        g.gain.setValueAtTime(g.gain.value, now)
        g.gain.linearRampToValueAtTime(0, now + release)
      })
      return
    }

    // Synth silence
    this.voiceGains.forEach(g => {
      g.gain.cancelScheduledValues(now)
      g.gain.setValueAtTime(g.gain.value, now)
      g.gain.linearRampToValueAtTime(0, now + 0.08)
    })
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
