import type { MusicalCommand } from '../types'
import { midiToHz } from '../music/scales'

export class AudioEngine {
  private ctx: AudioContext
  private oscillators: OscillatorNode[]
  private voiceGains: GainNode[]
  private masterGain: GainNode
  private analyser: AnalyserNode

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

  play(cmd: MusicalCommand): void {
    const now = this.ctx.currentTime
    const rampEnd = now + 0.012

    cmd.voicing.forEach((midi, i) => {
      const hz = midiToHz(midi)
      this.oscillators[i].frequency.setValueAtTime(
        this.oscillators[i].frequency.value,
        now
      )
      this.oscillators[i].frequency.linearRampToValueAtTime(hz, rampEnd)
      this.voiceGains[i].gain.setValueAtTime(this.voiceGains[i].gain.value, now)
      this.voiceGains[i].gain.linearRampToValueAtTime(0.7 / 3, rampEnd)
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
