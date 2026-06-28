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
  // Sampler output sits between soundfont-player and masterGain so we can
  // fade it independently of the oscillator voices.
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

  // Attack only — sustains until silence() is called.
  play(cmd: MusicalCommand, mode: InstrumentMode = 'synth'): void {
    const now = this.ctx.currentTime

    if ((mode === 'piano' || mode === 'guitar') && this.samplers[mode]) {
      const player = this.samplers[mode]!
      // Stop any previous looped nodes (chord change / re-entry)
      const prev = this.activeSampleNodes
      this.activeSampleNodes = []
      prev.forEach(n => { try { n.stop() } catch { /* already stopped */ } })
      // Restore samplerGain in case a release fade is in progress
      this.samplerGain.gain.cancelScheduledValues(now)
      this.samplerGain.gain.setValueAtTime(1, now)
      // Loop each voice so the note sustains until silence() is called
      this.activeSampleNodes = cmd.voicing.map(midi =>
        player.play(midi.toString(), undefined, { loop: true })
      )
      return
    }

    // Oscillator path: synth / fallback for piano+guitar while sampler loads
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

  // Mode-aware release triggered when hand leaves wheel.
  silence(mode: InstrumentMode = 'synth'): void {
    const now = this.ctx.currentTime

    // Always silence oscillators (synth and piano/guitar fallback)
    this.voiceGains.forEach(g => {
      g.gain.cancelScheduledValues(now)
      g.gain.setValueAtTime(g.gain.value, now)
      g.gain.linearRampToValueAtTime(0, now + 0.08)
    })

    if (mode === 'piano' || mode === 'guitar') {
      // Fade samplerGain — piano rings longer, guitar shorter
      const release = mode === 'piano' ? 2.0 : 0.6
      this.samplerGain.gain.cancelScheduledValues(now)
      this.samplerGain.gain.setValueAtTime(this.samplerGain.gain.value, now)
      this.samplerGain.gain.linearRampToValueAtTime(0, now + release)
      // Stop looped nodes at end of fade so they don't run forever
      const stopAt = now + release + 0.05
      const nodes = this.activeSampleNodes
      this.activeSampleNodes = []
      nodes.forEach(n => { try { n.stop(stopAt) } catch { /* already stopped */ } })
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
