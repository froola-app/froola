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

  it('merges consecutive identical samples into one record', () => {
    const held: Recording = {
      samples: [
        { dt: 100, noteIdx: 2, qualityIdx: 1, vibe: 0 },
        { dt: 100, noteIdx: 2, qualityIdx: 1, vibe: 0 },
        { dt: 100, noteIdx: 2, qualityIdx: 1, vibe: 0 },
        { dt: 100, noteIdx: 4, qualityIdx: 1, vibe: 0 },
      ],
      totalMs: 400,
    };
    const decoded = decode(encode(held));
    expect(decoded.samples).toEqual([
      { dt: 300, noteIdx: 2, qualityIdx: 1, vibe: 0 },
      { dt: 100, noteIdx: 4, qualityIdx: 1, vibe: 0 },
    ]);
    expect(decoded.totalMs).toBe(400);
  });

  it('splits a run when the merged dt would overflow uint16', () => {
    const samples = Array.from({ length: 800 }, () => (
      { dt: 100, noteIdx: 1, qualityIdx: 1, vibe: 0 }
    ));
    const decoded = decode(encode({ samples, totalMs: 80_000 }));
    expect(decoded.samples.length).toBe(2);
    expect(decoded.totalMs).toBe(80_000);
    for (const s of decoded.samples) expect(s.dt).toBeLessThanOrEqual(0xffff);
  });

  it('keeps a held-chord recording URL-short', () => {
    // 30s of play across 6 chord changes — the pre-RLE encoding was ~2000 chars
    const samples = Array.from({ length: 300 }, (_, i) => (
      { dt: 100, noteIdx: Math.floor(i / 50), qualityIdx: 2, vibe: 1 }
    ));
    expect(encode({ samples, totalMs: 30_000 }).length).toBeLessThan(60);
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
