import { vi } from 'vitest'

function makeParam() {
  return {
    value: 0,
    setValueAtTime: vi.fn().mockReturnThis(),
    linearRampToValueAtTime: vi.fn().mockReturnThis(),
    cancelScheduledValues: vi.fn().mockReturnThis(),
  }
}

function makeNode() {
  return { connect: vi.fn(), disconnect: vi.fn() }
}

function makeOscillator() {
  return { ...makeNode(), type: 'sine', frequency: makeParam(), detune: makeParam(), start: vi.fn(), stop: vi.fn() }
}

function makeGain() {
  return { ...makeNode(), gain: makeParam() }
}

function makeStereoPanner() {
  return { ...makeNode(), pan: makeParam() }
}

function makeConvolver() {
  return { ...makeNode(), buffer: null as AudioBuffer | null, normalize: true }
}

function makeBuffer(channels: number, length: number) {
  const data = Array.from({ length: channels }, () => new Float32Array(length))
  return { numberOfChannels: channels, length, getChannelData: (ch: number) => data[ch] }
}

function makeAnalyser() {
  return { ...makeNode(), fftSize: 256, getByteFrequencyData: vi.fn() }
}

function makeBiquadFilter() {
  return { ...makeNode(), type: 'lowpass', frequency: makeParam(), Q: makeParam() }
}

function makeCompressor() {
  return {
    ...makeNode(),
    threshold: makeParam(),
    knee: makeParam(),
    ratio: makeParam(),
    attack: makeParam(),
    release: makeParam(),
  }
}

const mockAudioContext = {
  currentTime: 0,
  sampleRate: 44100,
  state: 'suspended' as AudioContextState,
  destination: makeNode(),
  createOscillator: vi.fn().mockImplementation(makeOscillator),
  createGain: vi.fn().mockImplementation(makeGain),
  createAnalyser: vi.fn().mockImplementation(makeAnalyser),
  createBiquadFilter: vi.fn().mockImplementation(makeBiquadFilter),
  createStereoPanner: vi.fn().mockImplementation(makeStereoPanner),
  createConvolver: vi.fn().mockImplementation(makeConvolver),
  createBuffer: vi.fn().mockImplementation(makeBuffer),
  createDynamicsCompressor: vi.fn().mockImplementation(makeCompressor),
  resume: vi.fn().mockResolvedValue(undefined),
  suspend: vi.fn().mockResolvedValue(undefined),
}

function MockAudioContext() {
  return mockAudioContext
}
MockAudioContext.prototype = mockAudioContext

vi.stubGlobal('AudioContext', MockAudioContext)

export { mockAudioContext }
