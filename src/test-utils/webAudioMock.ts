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
  return { ...makeNode(), type: 'sine', frequency: makeParam(), start: vi.fn(), stop: vi.fn() }
}

function makeGain() {
  return { ...makeNode(), gain: makeParam() }
}

function makeAnalyser() {
  return { ...makeNode(), fftSize: 256, getByteFrequencyData: vi.fn() }
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
  state: 'suspended' as AudioContextState,
  destination: makeNode(),
  createOscillator: vi.fn().mockImplementation(makeOscillator),
  createGain: vi.fn().mockImplementation(makeGain),
  createAnalyser: vi.fn().mockImplementation(makeAnalyser),
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
