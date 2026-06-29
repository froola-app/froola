import type { MusicalCommand, InstrumentMode } from '../types'
import { midiToHz } from '../music/scales'
import type Soundfont from 'soundfont-player'

type Player = Awaited<ReturnType<typeof Soundfont.instrument>>
type SampleNode = { stop(when?: number): void }

// Sound design ported from soundgo (github.com/Gojaehyeon/soundgo).
// soundgo's chord pad = 4 triangle oscillators → gain → lowpass(1800Hz) → out,
// with notes gliding over 0.12s and gentle gains. We mirror that chain here so
// Froola's synth voice has the same warm, rounded, slightly muffled character.
const VOICES = 4                 // soundgo pads every chord to 4 voices
const SYNTH_LOWPASS_HZ = 1800    // soundgo chordFilter cutoff
const CHORD_GLIDE = 0.12         // soundgo o.frequency.rampTo(freq, 0.12)
const CHORD_GAIN_RAMP = 0.06     // soundgo chordGain.gain.rampTo(_, 0.06)
const SYNTH_TOTAL_GAIN = 0.2     // soundgo targetChordGain cap
const SYNTH_VOICE_GAIN = SYNTH_TOTAL_GAIN / VOICES

// Subtle per-voice detune (cents) + stereo spread give the pad analog warmth and
// width instead of a flat, dead-center, perfectly-tuned image.
const VOICE_DETUNE = [-7, 7, -4, 4]
const VOICE_PAN = [-0.6, 0.6, -0.25, 0.25]

// A short, soft room reverb mixed in lightly for a sense of space (soundgo is dry).
const REVERB_SECONDS = 1.8
const REVERB_DECAY = 2.6
const REVERB_SEND = 0.18

export class AudioEngine {
  private ctx: AudioContext
  private oscillators: OscillatorNode[]
  private voiceGains: GainNode[]
  private synthFilter: BiquadFilterNode
  private masterGain: GainNode
  private analyser: AnalyserNode
  private samplerGain: GainNode
  private samplers: Partial<Record<'piano' | 'guitar', Player>> = {}
  private samplerLoading = new Set<'piano' | 'guitar'>()
  private activeSampleNodes: SampleNode[] = []

  constructor() {
    this.ctx = new AudioContext()

    // Master is unity now; the synth sits at soundgo's gentle 0.2 on its own,
    // and the sampler keeps its previous 0.7 level on a dedicated gain stage.
    this.masterGain = this.ctx.createGain()
    this.masterGain.gain.value = 1

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
    this.samplerGain.gain.value = 0.7
    this.samplerGain.connect(this.masterGain)

    // Reverb send → convolver → master, blended under the dry signal for space.
    const reverbSend = this.ctx.createGain()
    reverbSend.gain.value = REVERB_SEND
    const convolver = this.ctx.createConvolver()
    convolver.buffer = this.buildImpulse(REVERB_SECONDS, REVERB_DECAY)
    reverbSend.connect(convolver)
    convolver.connect(this.masterGain)
    this.samplerGain.connect(reverbSend)

    // soundgo routes the chord oscillators through a lowpass filter — this is
    // what gives it its warm, mellow tone instead of a raw buzzy triangle.
    this.synthFilter = this.ctx.createBiquadFilter()
    this.synthFilter.type = 'lowpass'
    this.synthFilter.frequency.value = SYNTH_LOWPASS_HZ
    this.synthFilter.connect(this.masterGain)
    this.synthFilter.connect(reverbSend)

    this.oscillators = []
    this.voiceGains = []

    for (let i = 0; i < VOICES; i++) {
      const osc = this.ctx.createOscillator()
      // Triangle gives a rounder, more instrument-like tone than sine
      osc.type = 'triangle'
      osc.detune.value = VOICE_DETUNE[i]
      const gain = this.ctx.createGain()
      gain.gain.value = 0
      const panner = this.ctx.createStereoPanner()
      panner.pan.value = VOICE_PAN[i]
      osc.connect(gain)
      gain.connect(panner)
      panner.connect(this.synthFilter)
      osc.start()
      this.oscillators.push(osc)
      this.voiceGains.push(gain)
    }
  }

  /** Decaying-noise impulse response for a short, soft room reverb. */
  private buildImpulse(seconds: number, decay: number): AudioBuffer {
    const rate = this.ctx.sampleRate
    const length = Math.max(1, Math.floor(rate * seconds))
    const buffer = this.ctx.createBuffer(2, length, rate)
    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch)
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay)
      }
    }
    return buffer
  }

  // soundgo pads a 3-note triad to 4 voices by adding the root an octave up.
  private voicingFor(cmd: MusicalCommand): number[] {
    if (cmd.voicing.length >= VOICES) return cmd.voicing.slice(0, VOICES)
    return [...cmd.voicing, cmd.voicing[0] + 12]
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

    // Wait silently if the sampler is still loading — no oscillator fallback
    if (mode === 'piano' || mode === 'guitar') {
      if (!this.samplers[mode]) return
    }

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
      // Pitch is set instantly here (under a percussive attack a glide sounds wrong).
      const sustainGain = SYNTH_VOICE_GAIN * 0.45
      const fadeIn = mode === 'piano' ? 0.25 : 0.06
      this.voicingFor(cmd).forEach((midi, i) => {
        const hz = midiToHz(midi)
        this.oscillators[i].frequency.cancelScheduledValues(now)
        this.oscillators[i].frequency.setValueAtTime(hz, now)
        this.voiceGains[i].gain.cancelScheduledValues(now)
        this.voiceGains[i].gain.setValueAtTime(0, now)
        this.voiceGains[i].gain.linearRampToValueAtTime(sustainGain, now + fadeIn)
      })
      return
    }

    // Pure synth path (or piano/guitar while sampler is still loading) — soundgo
    // chord pad: gentle per-voice gain, notes glide to pitch over CHORD_GLIDE.
    this.voicingFor(cmd).forEach((midi, i) => {
      const hz = midiToHz(midi)
      this.oscillators[i].frequency.cancelScheduledValues(now)
      this.oscillators[i].frequency.setValueAtTime(this.oscillators[i].frequency.value, now)
      this.oscillators[i].frequency.linearRampToValueAtTime(hz, now + CHORD_GLIDE)
      this.voiceGains[i].gain.cancelScheduledValues(now)
      this.voiceGains[i].gain.setValueAtTime(this.voiceGains[i].gain.value, now)
      this.voiceGains[i].gain.linearRampToValueAtTime(SYNTH_VOICE_GAIN, now + CHORD_GAIN_RAMP)
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
