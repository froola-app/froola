import { floatTo16BitPCM, encodeMp3 } from './mp3';

const encodeBuffer = vi.fn().mockReturnValue(new Uint8Array([1, 2, 3]));
const flush = vi.fn().mockReturnValue(new Uint8Array([9]));
const Mp3EncoderMock = vi.fn();

vi.mock('@breezystack/lamejs', () => ({
  Mp3Encoder: class {
    constructor(...args: unknown[]) {
      Mp3EncoderMock(...args);
    }
    encodeBuffer(...args: unknown[]) { return encodeBuffer(...args); }
    flush(...args: unknown[]) { return flush(...args); }
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('floatTo16BitPCM', () => {
  it('converts float samples to clamped int16', () => {
    const out = floatTo16BitPCM(new Float32Array([0, 1, -1, 0.5, 2, -2]));
    expect(Array.from(out)).toEqual([0, 32767, -32768, 16383, 32767, -32768]);
  });
});

function makeBuffer(channels: number, length: number, sampleRate = 44100): AudioBuffer {
  const data = Array.from({ length: channels }, () => new Float32Array(length));
  return {
    numberOfChannels: channels,
    length,
    sampleRate,
    getChannelData: (ch: number) => data[ch],
  } as unknown as AudioBuffer;
}

describe('encodeMp3', () => {
  it('constructs the encoder with the buffer sampleRate/channels and flushes', () => {
    const buffer = makeBuffer(2, 2000, 48000);
    const blob = encodeMp3(buffer);
    expect(Mp3EncoderMock).toHaveBeenCalledWith(2, 48000, 128);
    expect(flush).toHaveBeenCalledOnce();
    expect(blob.type).toBe('audio/mpeg');
  });

  it('encodes mono buffers with a single channel argument', () => {
    const buffer = makeBuffer(1, 1152);
    encodeMp3(buffer);
    expect(Mp3EncoderMock).toHaveBeenCalledWith(1, 44100, 128);
    expect(encodeBuffer).toHaveBeenCalledWith(expect.any(Int16Array));
    expect(encodeBuffer.mock.calls[0]).toHaveLength(1);
  });

  it('encodes stereo buffers with left and right channel arguments', () => {
    const buffer = makeBuffer(2, 1152);
    encodeMp3(buffer);
    expect(encodeBuffer).toHaveBeenCalledWith(expect.any(Int16Array), expect.any(Int16Array));
  });
});
