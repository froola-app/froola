import { encode, decode } from './codec';
import type { Recording } from '../types';

const sample = { dt: 100, noteIdx: 3, qualityIdx: 1, vibe: 0 };
const recording: Recording = { samples: [sample], totalMs: 100 };

describe('codec', () => {
  it('encode produces a non-empty string', () => {
    expect(encode(recording)).toBeTruthy();
  });

  it('round-trips a single sample', () => {
    const decoded = decode(encode(recording));
    expect(decoded.samples).toHaveLength(1);
    expect(decoded.samples[0]).toEqual(sample);
    expect(decoded.totalMs).toBe(100);
  });

  it('round-trips multiple samples', () => {
    const multi: Recording = {
      samples: [
        { dt: 100, noteIdx: 0, qualityIdx: 0, vibe: 0 },
        { dt: 150, noteIdx: 6, qualityIdx: 6, vibe: 3 },
        { dt: 200, noteIdx: 3, qualityIdx: 3, vibe: 2 },
      ],
      totalMs: 450,
    };
    const decoded = decode(encode(multi));
    expect(decoded.samples).toEqual(multi.samples);
    expect(decoded.totalMs).toBe(450);
  });

  it('produces base64url (no +, /, or = characters)', () => {
    const encoded = encode(recording);
    expect(encoded).not.toMatch(/[+/=]/);
  });

  it('decode throws on wrong length', () => {
    expect(() => decode('YWJj')).toThrow('Invalid recording data');
  });

  it('decode throws on invalid noteIdx', () => {
    // Build a valid buffer then corrupt noteIdx to 255
    const buf = new Uint8Array(5);
    new DataView(buf.buffer).setUint16(0, 100, false);
    buf[2] = 255; buf[3] = 0; buf[4] = 0;
    const bad = btoa(String.fromCharCode(...buf))
      .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    expect(() => decode(bad)).toThrow('Invalid recording data');
  });
});
