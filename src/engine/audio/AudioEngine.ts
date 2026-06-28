import type { MusicalCommand, InstrumentMode } from '../types'
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

  // Attack only — gains ramp up and stay. Call silence() to release.
  play(cmd: MusicalCommand, mode: InstrumentMode = 'synth'): void {
    const now = this.ctx.currentTime
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

  // Release — mode-specific decay shape when hand leaves wheel
  silence(mode: InstrumentMode = 'synth'): void {
    const now = this.ctx.currentTime
    this.voiceGains.forEach(g => {
      g.gain.cancelScheduledValues(now)
      g.gain.setValueAtTime(g.gain.value, now)
      if (mode === 'piano') {
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.7)
        g.gain.linearRampToValueAtTime(0, now + 0.72)
      } else if (mode === 'guitar') {
        g.gain.exponentialRampToValueAtTime(0.001, now + 0.35)
        g.gain.linearRampToValueAtTime(0, now + 0.37)
      } else if (mode === 'pad') {
        g.gain.linearRampToValueAtTime(0, now + 0.5)
      } else {
        g.gain.linearRampToValueAtTime(0, now + 0.08)
      }
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
